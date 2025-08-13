#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

// 將 PROJECT_STATUS.md 的工作板（Backlog/Next/Doing/Blocked/Done）單向推送到 Trello
// 設計重點：
// 1) 讀取 .env（TRELLO_KEY/TRELLO_TOKEN/TRELLO_BOARD_ID）
// 2) 確保五個列表存在；不存在則建立
// 3) 以卡片名稱比對：沒有就建立，有就僅更新描述（避免誤改名稱）
// 4) 輕量節流，避免速率限制

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');
const crypto = require('crypto');

const TRELLO_API = 'https://api.trello.com/1';
const ENABLE_TRELLO_LABELS = (process.env.ENABLE_TRELLO_LABELS || 'false') === 'true';

function detectContextSourceLabel() {
  const fromEnv = process.env.AI_CONTEXT_SOURCE_LABEL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  if (process.env.CURSOR || process.env.CURSOR_SESSION_ID || process.env.CURSOR_WORKSPACE_ID) {
    return 'cursor chat';
  }
  if (process.env.CLAUDE_SANDBOX || process.env.ANTHROPIC_API_KEY) {
    return 'claude code cli';
  }
  return 'local cli';
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[錯誤] 缺少環境變數：${name}`);
    process.exit(1);
  }
  return value;
}

const TRELLO_KEY = getRequiredEnv('TRELLO_KEY');
const TRELLO_TOKEN = getRequiredEnv('TRELLO_TOKEN');
const TRELLO_BOARD_ID = getRequiredEnv('TRELLO_BOARD_ID');

function encodeQuery(params) {
  return new URLSearchParams(params).toString();
}

async function trello(method, apiPath, params = {}, body) {
  const url = `${TRELLO_API}${apiPath}?${encodeQuery({ key: TRELLO_KEY, token: TRELLO_TOKEN, ...params })}`;
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Trello ${method} ${apiPath} ${res.status} ${text}`);
  }
  return res.json();
}

async function getLists(boardId) {
  return trello('GET', `/boards/${boardId}/lists`, { fields: 'name,id,closed' });
}

async function getBoardMeta(boardId) {
  return trello('GET', `/boards/${boardId}`, { fields: 'id,name,url' });
}

async function getCanonicalBoardIdMaybe(boardId) {
  try {
    const info = await getBoardMeta(boardId);
    return (info && info.id) ? info.id : boardId;
  } catch (e) {
    return boardId;
  }
}

async function createList(boardId, name, pos = 'bottom') {
  return trello('POST', `/lists`, { idBoard: boardId, name, pos });
}

async function getCards(listId) {
  // 取更多中繼資料以利合併：dateLastActivity/pos/url/idList
  return trello('GET', `/lists/${listId}/cards`, { fields: 'name,id,desc,labels,dateLastActivity,pos,url,idList' });
}

async function createCard(listId, name, desc = '') {
  return trello('POST', `/cards`, { idList: listId, name, desc, pos: 'bottom' });
}

async function updateCard(cardId, patch = {}) {
  return trello('PUT', `/cards/${cardId}`, patch);
}

async function getLabels(boardId) {
  return trello('GET', `/boards/${boardId}/labels`, { fields: 'id,name,color' });
}

async function createLabel(boardId, name, color = null) {
  return trello('POST', `/labels`, { idBoard: boardId, name, color });
}

async function updateLabel(labelId, patch = {}) {
  return trello('PUT', `/labels/${labelId}`, patch);
}

async function addLabelToCard(cardId, labelId) {
  return trello('POST', `/cards/${cardId}/idLabels`, { value: labelId });
}

async function ensureLabels(boardId, names) {
  const existing = await getLabels(boardId);
  const byName = new Map(existing.map(l => [l.name, l]));
  const out = new Map();
  for (const name of names) {
    if (!name) continue;
    const isUid = typeof name === 'string' && name.startsWith('uid:');
    if (byName.has(name)) {
      const lab = byName.get(name);
      if (isUid && lab && lab.color !== 'black') {
        try { await updateLabel(lab.id, { color: 'black' }); } catch (_) {}
        lab.color = 'black';
      }
      out.set(name, lab);
      continue;
    }
    const created = await createLabel(boardId, name, isUid ? 'black' : null);
    out.set(name, created);
    await sleep(100);
  }
  return out;
}

async function ensureLists(boardId, wantedNames) {
  // Trello 的 create list 需要完整 24 位 board id，不能用 shortLink
  const canonicalBoardId = await getCanonicalBoardIdMaybe(boardId);

  const existing = await getLists(canonicalBoardId);
  const byName = new Map(existing.filter(l => !l.closed).map(l => [l.name, l]));
  for (const name of wantedNames) {
    if (!byName.has(name)) {
      const created = await createList(canonicalBoardId, name);
      byName.set(name, created);
      // 輕量節流，避免快速連打 API
      await sleep(120);
    }
  }
  const out = {};
  for (const name of wantedNames) {
    if (byName.has(name)) out[name] = byName.get(name);
  }
  return out;
}

// 從 Markdown 取出指定 H3 區塊；標題允許後綴說明（例：Next（需求定義完成））
function extractSection(md, title) {
  const headerRe = new RegExp(`^###\\s+${title}(?:\\b|[（(])`, 'm');
  const match = md.match(headerRe);
  if (!match) return '';
  const startIdx = match.index;
  const afterHeader = md.slice(startIdx);
  const firstLineBreak = afterHeader.indexOf('\n');
  const contentStart = firstLineBreak >= 0 ? startIdx + firstLineBreak + 1 : md.length;
  const rest = md.slice(contentStart);
  const nextHeaderIdx = rest.search(/^###\s+/m);
  return nextHeaderIdx >= 0 ? rest.slice(0, nextHeaderIdx) : rest;
}

function parseBulletLines(sectionText) {
  return sectionText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('- '))
    .map(s => s.replace(/^-+\s*/, '').trim())
    .filter(Boolean);
}

function extractBracketTags(taskName) {
  // 解析開頭的 [P1][Feature] 這類標籤
  const tags = [];
  let rest = taskName.trim();
  while (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end <= 1) break;
    const tag = rest.slice(1, end).trim();
    if (tag) tags.push(tag);
    rest = rest.slice(end + 1).trim();
    if (!rest.startsWith('[')) break;
  }
  return { tags, pureName: rest };
}

// 產生穩定的卡片唯一識別標籤名稱（不依賴括號後綴/規格連結）
function normalizeTaskBase(taskName) {
  const { pureName } = extractBracketTags(taskName);
  let base = pureName.split('（')[0].split('(')[0].split('|')[0].trim();
  const statusSuffixes = ['尚未實作', '支援', '實作中', '驗收中', '需求定義完成'];
  const versionInProgressRe = /v\d+\s*實作中$/;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of statusSuffixes) {
      if (base.endsWith(suf)) {
        base = base.slice(0, base.length - suf.length).trim();
        changed = true;
      }
    }
    if (versionInProgressRe.test(base)) {
      base = base.replace(versionInProgressRe, '').trim();
      changed = true;
    }
  }
  return base;
}

function deriveUidLabelName(taskName) {
  const base = normalizeTaskBase(taskName);
  const hash = crypto.createHash('sha1').update(base, 'utf8').digest('hex').slice(0, 12);
  return `uid:${hash}`;
}

function parseUidFromDesc(desc) {
  const m = (desc || '').match(/^uid:([0-9a-f]{12})/m);
  return m ? `uid:${m[1]}` : null;
}

function upsertHeaderInDesc(originalDesc, uidLine, sourceValue) {
  const nowIso = new Date().toISOString();
  const lines = (originalDesc || '').split(/\r?\n/);
  // 移除既有的 header 行，避免重複
  const rest = lines.filter(l => !/^uid:[0-9a-f]{12}/i.test(l) && !/^source:/i.test(l) && !/^syncedAt:/i.test(l));
  const header = [uidLine, `source: ${sourceValue}`, `syncedAt: ${nowIso}`];
  return header.concat(rest.length > 0 ? [''].concat(rest) : []).join('\n');
}

function parseProjectStatus(filePath) {
  const md = fs.readFileSync(filePath, 'utf8');
  const sections = ['Backlog', 'Next', 'Doing', 'Blocked', 'Done'];
  const result = {};
  for (const name of sections) {
    const text = extractSection(md, name);
    result[name] = parseBulletLines(text);
  }
  if (Array.isArray(result.Done)) {
    result.Done = result.Done.slice(0, 5);
  }
  return result;
}

function getUidKeyForCard(card) {
  // 一律以「名稱推導出的規範化 UID」作為群組鍵，避免舊版 UID 標籤（未規範化）造成分裂
  // 仍保留讀取卡片上的 uid: 標籤以便後續可能進行自動修復，但群組鍵只用 derived
  const derived = deriveUidLabelName(card.name || '');
  return derived;
}

async function mergeDuplicatesInList(list, options = {}) {
  const { dryRun = false } = options;
  const cards = await getCards(list.id);
  if (!Array.isArray(cards) || cards.length === 0) return { mergedGroups: 0, archivedCards: 0 };

  // 依 UID 聚合
  const groups = new Map();
  for (const c of cards) {
    const key = getUidKeyForCard(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let mergedGroups = 0;
  let archivedCards = 0;

  for (const [uid, group] of groups.entries()) {
    if (!uid || group.length <= 1) continue;
    // 以最早活動時間卡片為主卡（較可能是原始/沿用卡）
    const sorted = group.slice().sort((a, b) => new Date(a.dateLastActivity || 0) - new Date(b.dateLastActivity || 0));
    const primary = sorted[0];
    const rest = sorted.slice(1);
    if (rest.length === 0) continue;

    mergedGroups += 1;

    if (dryRun) {
      console.log(`[dry-run] 將在列表「${list.name}」合併 UID=${uid} 的重複：保留「${primary.name}」，封存 ${rest.length} 張`);
      continue;
    }

    // 合併描述：把剩餘卡片的描述附加到主卡尾端，帶上來源資訊
    let newDesc = (primary.desc || '').trim();
    const ts = new Date().toISOString();
    for (const dup of rest) {
      const chunk = `\n\n---\nMerged duplicate at ${ts}\nFrom: ${dup.name}\nURL: ${dup.url || ''}\n\n${(dup.desc || '').trim()}\n---`;
      // 控制描述長度，避免極端情況超限（Trello 描述上限相對寬鬆，此處僅做保護）
      if ((newDesc + chunk).length <= 16000) {
        newDesc += chunk;
      }
    }

    await updateCard(primary.id, { desc: newDesc });

    // 合併標籤：把重複卡上的標籤補到主卡
    const have = new Set((primary.labels || []).map(l => l && l.id));
    for (const dup of rest) {
      for (const lab of (dup.labels || [])) {
        if (!lab || !lab.id) continue;
        if (!have.has(lab.id)) {
          try {
            await addLabelToCard(primary.id, lab.id);
            have.add(lab.id);
          } catch (_) {
            // 忽略標籤已被移除等非致命錯誤
          }
        }
      }
    }

    // 封存其餘重複卡
    for (const dup of rest) {
      try {
        await updateCard(dup.id, { closed: true });
        archivedCards += 1;
      } catch (e) {
        console.warn(`[警告] 封存卡片失敗：${dup.name} ${dup.id} ${e && e.message}`);
      }
      await sleep(120);
    }
  }

  return { mergedGroups, archivedCards };
}

async function mergeDuplicatesOnBoard(boardId, listsFilter = null, options = {}) {
  const { dryRun = false } = options;
  const canonicalBoardId = await getCanonicalBoardIdMaybe(boardId);
  const lists = await getLists(canonicalBoardId);
  const openLists = (lists || []).filter(l => !l.closed);
  const targetLists = listsFilter ? openLists.filter(l => listsFilter.includes(l.name)) : openLists;
  let totalGroups = 0;
  let totalArchived = 0;
  for (const list of targetLists) {
    const res = await mergeDuplicatesInList(list, { dryRun });
    if (res.mergedGroups > 0) {
      console.log(`列表「${list.name}」已合併群組：${res.mergedGroups}，封存卡片：${res.archivedCards}`);
    } else {
      console.log(`列表「${list.name}」沒有需要合併的重複卡`);
    }
    totalGroups += res.mergedGroups;
    totalArchived += res.archivedCards;
    await sleep(120);
  }
  console.log(`合併完成：群組共 ${totalGroups}，封存卡片共 ${totalArchived}`);
}

async function createOrUpdateByName(listId, items, options) {
  const { dryRun = false, labelContext = null } = options || {};
  const existing = await getCards(listId);
  const byName = new Map(existing.map(c => [c.name, c]));
  // 以 description 中的 uid 做快速查找
  const byUid = new Map();
  const uidRe = /^uid:([0-9a-f]{12})/m;
  for (const c of existing) {
    const m = (c.desc || '').match(uidRe);
    if (m) byUid.set(`uid:${m[1]}`, c);
  }
  // 以規範化主題名做後備查找（處理尾綴不同的情況）
  const byBase = new Map();
  for (const c of existing) {
    const base = normalizeTaskBase(c.name || '');
    if (base && !byBase.has(base)) byBase.set(base, c);
  }
  for (const name of items) {
    const { tags, pureName } = extractBracketTags(name);
    const uidLine = deriveUidLabelName(name); // e.g. uid:1a2b3c4d5e6f
    const base = normalizeTaskBase(name);

    // 精準比對順序：同 uid → 同名（純名優先）→ 同 base
    const foundByUid = byUid.get(uidLine);
    const foundByName = byName.get(pureName) || byName.get(name);
    const foundByBase = byBase.get(base);
    const found = foundByUid || foundByName || foundByBase;
    if (!found) {
      if (dryRun) {
        console.log(`[dry-run] ＋ 將建立卡片：${name}`);
      } else {
        const created = await createCard(listId, pureName, upsertHeaderInDesc('', uidLine, 'PROJECT_STATUS.md'));
        console.log(`＋ 建立卡片：${pureName}`);
        // 追加括號標籤（若啟用）
        if (labelContext && tags.length > 0) {
          for (const t of tags) {
            const label = labelContext.byName.get(t);
            if (label) await addLabelToCard(created.id, label.id);
          }
        }
        await sleep(120);
      }
    } else {
      if (dryRun) {
        console.log(`[dry-run] ＝ 將更新描述：${found.name}`);
      } else {
        // 在保留原描述其餘內容的前提下，於描述頂部維護 uid/source/syncedAt
        const nextDesc = upsertHeaderInDesc(found.desc || '', uidLine, 'PROJECT_STATUS.md');
        await updateCard(found.id, { desc: nextDesc });
        console.log(`＝ 更新描述：${found.name}`);
        // 確保括號標籤（若啟用）
        if (labelContext && tags.length > 0) {
          const have = new Set((found.labels || []).map(l => l.name));
          for (const t of tags) {
            if (have.has(t)) continue;
            const label = labelContext.byName.get(t);
            if (label) await addLabelToCard(found.id, label.id);
          }
        }
        await sleep(120);
      }
    }
  }
}

async function syncPush(boardId, statusFile, options) {
  const { listsFilter = null, dryRun = false, enableLabels = ENABLE_TRELLO_LABELS } = options || {};
  const wantedLists = ['Backlog', 'Next', 'Doing', 'Blocked', 'Done']
    .filter(n => !listsFilter || listsFilter.includes(n));
  const listsMap = await ensureLists(boardId, wantedLists);
  const data = parseProjectStatus(statusFile);

  // 準備標籤：
  // - UID 不再使用標籤（改寫入 description）
  // - 括號標籤：[P1][Feature] 等僅在啟用標籤時建立
  const canonicalBoardId = await getCanonicalBoardIdMaybe(boardId);
  const namesToEnsure = new Set();
  for (const listName of wantedLists) {
    for (const item of (data[listName] || [])) {
      // 括號標籤（可選）
      if (enableLabels) {
        const { tags } = extractBracketTags(item);
        tags.forEach(t => namesToEnsure.add(t));
      }
    }
  }
  const labelMap = await ensureLabels(canonicalBoardId, [...namesToEnsure]);
  const labelContext = { byName: labelMap };

  for (const listName of wantedLists) {
    const list = listsMap[listName];
    if (!list) {
      console.warn(`[警告] 找不到列表：${listName}，略過`);
      continue;
    }
    const items = data[listName] || [];
    if (items.length === 0) {
      console.log(`（無項目）${listName}`);
      continue;
    }
    console.log(`→ 同步 ${listName}（${items.length} 項）${dryRun ? '[dry-run]' : ''}`);
    await createOrUpdateByName(list.id, items, { dryRun, labelContext });
  }
}

async function main() {
  const statusFile = path.resolve(process.cwd(), 'PROJECT_STATUS.md');
  const isPull = process.argv.includes('--mode=pull');
  const dryRun = process.argv.includes('--dry-run');
  const listsArg = (process.argv.find(a => a.startsWith('--lists=')) || '').split('=')[1];
  const listsFilter = listsArg ? listsArg.split(',').map(s => s.trim()).filter(Boolean) : null;
  const enableLabelsFlag = process.argv.includes('--labels');
  const mergeDup = process.argv.includes('--merge-duplicates');

  if (!isPull && !mergeDup) {
    await syncPush(TRELLO_BOARD_ID, statusFile, {
      listsFilter,
      dryRun,
      enableLabels: enableLabelsFlag || ENABLE_TRELLO_LABELS,
    });
    console.log('完成：MD → Trello 單向推送');
    return;
  }

  if (mergeDup) {
    await mergeDuplicatesOnBoard(TRELLO_BOARD_ID, listsFilter, { dryRun });
    console.log('完成：重複卡合併流程');
    return;
  }

  // Pull 模式：從 Trello 讀取五個列表，直接覆寫 PROJECT_STATUS.md 的五個區塊
  const canonicalBoardId = await getCanonicalBoardIdMaybe(TRELLO_BOARD_ID);
  const board = await getBoardMeta(canonicalBoardId);
  const lists = await getLists(canonicalBoardId);
  const wanted = ['Backlog', 'Next', 'Doing', 'Blocked', 'Done'];
  const byName = new Map(lists.filter(l => !l.closed).map(l => [l.name, l]));

  const pulled = {};
  for (const name of wanted) {
    const list = byName.get(name);
    if (!list) { pulled[name] = []; continue; }
    const cards = await getCards(list.id);
    // 先為 Trello 卡片補齊 uid/source/syncedAt（若缺）
    for (const c of (cards || [])) {
      const hasUid = !!parseUidFromDesc(c.desc || '');
      if (!hasUid) {
        try {
          const uidLine = deriveUidLabelName(c.name || '');
          const nextDesc = upsertHeaderInDesc(c.desc || '', uidLine, 'manual');
          await updateCard(c.id, { desc: nextDesc });
          await sleep(80);
        } catch (e) {
          console.warn(`[警告] 卡片補寫 UID 失敗：${c.name} ${c.id} ${e && e.message}`);
        }
      } else {
        // 補寫缺失的 source/syncedAt（保持頂部三行格式）
        try {
          const uidInDesc = parseUidFromDesc(c.desc || '') || deriveUidLabelName(c.name || '');
          const needsSource = !/^source:/mi.test(c.desc || '');
          const needsSyncedAt = !/^syncedAt:/mi.test(c.desc || '');
          if (needsSource || needsSyncedAt) {
            const nextDesc = upsertHeaderInDesc(c.desc || '', uidInDesc, 'manual');
            await updateCard(c.id, { desc: nextDesc });
            await sleep(60);
          }
        } catch (_) {}
      }
    }
    const names = (cards || []).map(c => c.name);
    pulled[name] = name === 'Done' ? names.slice(0, 5) : names;
    await sleep(100);
  }

  function buildSection(name, items) {
    const bullets = items.map(i => `- ${i}`).join('\n');
    return `### ${name}\n${bullets}\n`;
  }

  // 直接寫回，不產生預覽檔

  // writeBack：覆寫 PROJECT_STATUS.md 內五個區塊的條目
  const md = fs.readFileSync(statusFile, 'utf8');
  function replaceSection(mdText, sectionName, lines) {
    const headerRe = new RegExp(`(^###\\s+${sectionName}.*$)`, 'm');
    const m = mdText.match(headerRe);
    if (!m) return mdText; // 沒找到就不動
    const headerStart = m.index;
    const headerEnd = headerStart + m[0].length;
    const rest = mdText.slice(headerEnd);
    const nextIdxRel = rest.search(/^###\s+/m);
    const nextIdx = nextIdxRel >= 0 ? headerEnd + nextIdxRel : mdText.length;
    const newBlock = `\n${lines.map(i => `- ${i}`).join('\n')}\n`;
    return mdText.slice(0, headerEnd) + newBlock + mdText.slice(nextIdx);
  }

  let newMd = md;
  newMd = replaceSection(newMd, 'Backlog', pulled.Backlog || []);
  newMd = replaceSection(newMd, 'Next', pulled.Next || []);
  newMd = replaceSection(newMd, 'Doing', pulled.Doing || []);
  newMd = replaceSection(newMd, 'Blocked', pulled.Blocked || []);
  newMd = replaceSection(newMd, 'Done', (pulled.Done || []).slice(0, 5));
  fs.writeFileSync(statusFile, newMd, 'utf8');
  console.log('已將 Trello 內容寫回 PROJECT_STATUS.md（五個區塊的條目已覆寫）');

  // 不再同步或修改 AI 任務上下文檔案
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


