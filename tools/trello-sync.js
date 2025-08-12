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
  return trello('GET', `/lists/${listId}/cards`, { fields: 'name,id,desc,labels' });
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

async function addLabelToCard(cardId, labelId) {
  return trello('POST', `/cards/${cardId}/idLabels`, { value: labelId });
}

async function ensureLabels(boardId, names) {
  const existing = await getLabels(boardId);
  const byName = new Map(existing.map(l => [l.name, l]));
  const out = new Map();
  for (const name of names) {
    if (!name) continue;
    if (byName.has(name)) { out.set(name, byName.get(name)); continue; }
    const created = await createLabel(boardId, name, null);
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

async function createOrUpdateByName(listId, items, options) {
  const { dryRun = false, labelContext = null } = options || {};
  const existing = await getCards(listId);
  const byName = new Map(existing.map(c => [c.name, c]));
  for (const name of items) {
    const { tags, pureName } = extractBracketTags(name);
    const desc = `source: PROJECT_STATUS.md\nsyncedAt: ${new Date().toISOString()}`;
    const found = byName.get(name) || byName.get(pureName);
    if (!found) {
      if (dryRun) {
        console.log(`[dry-run] ＋ 將建立卡片：${name}`);
      } else {
        const created = await createCard(listId, pureName, desc);
        console.log(`＋ 建立卡片：${pureName}`);
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
        await updateCard(found.id, { desc });
        console.log(`＝ 更新描述：${found.name}`);
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

  let labelContext = null;
  if (enableLabels) {
    const canonicalBoardId = await getCanonicalBoardIdMaybe(boardId);
    const allTags = new Set();
    for (const listName of wantedLists) {
      for (const item of (data[listName] || [])) {
        const { tags } = extractBracketTags(item);
        tags.forEach(t => allTags.add(t));
      }
    }
    const labelMap = await ensureLabels(canonicalBoardId, [...allTags]);
    labelContext = { byName: labelMap };
  }

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

  if (!isPull) {
    await syncPush(TRELLO_BOARD_ID, statusFile, {
      listsFilter,
      dryRun,
      enableLabels: enableLabelsFlag || ENABLE_TRELLO_LABELS,
    });
    console.log('完成：MD → Trello 單向推送');
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


