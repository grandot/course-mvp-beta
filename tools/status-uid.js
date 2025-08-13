#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUS_PATH = path.resolve(process.cwd(), 'PROJECT_STATUS.md');
const UIDMAP_PATH = path.resolve(process.cwd(), 'PROJECT_STATUS.uidmap.json');

function readFileSafe(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFileSafe(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function loadUidMap() {
  try {
    return JSON.parse(readFileSafe(UIDMAP_PATH) || '{}');
  } catch (_) {
    return {};
  }
}

function saveUidMap(map) {
  writeFileSafe(UIDMAP_PATH, JSON.stringify(map, null, 2));
}

function sections() {
  return ['Backlog', 'Next', 'Doing', 'Blocked', 'Done'];
}

function extractSection(md, title) {
  const headerRe = new RegExp(`^###\\s+${title}(?:\\b|[（(])`, 'm');
  const m = md.match(headerRe);
  if (!m) return { start: -1, end: -1, text: '' };
  const headerStart = m.index;
  const headerEnd = headerStart + m[0].length;
  const rest = md.slice(headerEnd);
  const nextHeaderIdxRel = rest.search(/^###\s+/m);
  const nextHeaderAbs = nextHeaderIdxRel >= 0 ? headerEnd + nextHeaderIdxRel : md.length;
  const text = md.slice(headerEnd, nextHeaderAbs);
  return { start: headerEnd, end: nextHeaderAbs, text };
}

function stripInlineTokens(text) {
  return (text || '')
    .replace(/\s*\[uid:[0-9a-f]{8,12}\]/ig, '')
    .replace(/\s*\[key:[^\]]+\]/ig, '')
    .trim();
}

function parseInlineUid(text) {
  const m = (text || '').match(/\[uid:([0-9a-f]{8,12})\]/i);
  return m ? m[1].toLowerCase() : null;
}

function parseInlineKey(text) {
  const m = (text || '').match(/\[key:([^\]]+)\]/i);
  return m ? m[1].trim() : null;
}

function normalizePunctuation(s) {
  return (s || '')
    .replace(/[\u3000]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[「」『』]/g, '"')
    .replace(/[（）\(\)【】\[\]]/g, ' ')
    .replace(/[\*_`~]/g, '')
    .replace(/[，、。；；：:|｜]/g, ' ')
    .trim();
}

function removeDatePrefix(s) {
  return s.replace(/^\d{4}[\/-]\d{1,2}(?:[\/-]\d{1,2})?\s*[：:—\-]*\s*/, '');
}

function removeFrontTags(s) {
  let t = s.trim();
  while (t.startsWith('[')) {
    const end = t.indexOf(']');
    if (end <= 0) break;
    t = t.slice(end + 1).trim();
  }
  return t;
}

function removeSpecTail(s) {
  return s.replace(/(?:\||｜)\s*規格\s*[:：].*$/i, '').trim();
}

function tokenizeForKey(s) {
  const cleaned = s.toLowerCase();
  const tokens = cleaned.match(/[a-z0-9]+|[\u4e00-\u9fa5]+/g) || [];
  const stop = new Set(['任務','功能','設計','支援','完成','實作','規劃','流程','修復','同步','校準','強化','優化','整理','檢查','報告','測試','每日','每週','每月']);
  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!t) continue;
    if (stop.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  if (out.length >= 2) {
    out.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    return out.join('-');
  }
  // 後備：以空白壓縮為鍵
  return cleaned.replace(/\s+/g, '-');
}

function computeNormalizedKey(rawLine) {
  let base = stripInlineTokens(rawLine);
  base = removeFrontTags(base);
  base = removeSpecTail(base);
  base = removeDatePrefix(base);
  base = normalizePunctuation(base);
  return tokenizeForKey(base);
}

function genUid8() {
  return crypto.randomBytes(4).toString('hex');
}

function fixStatus() {
  const uidmap = loadUidMap();
  const md = readFileSafe(STATUS_PATH);
  let next = md;
  let changed = false;

  function replaceSection(name, newLines) {
    const { start, end } = extractSection(next, name);
    if (start < 0) return;
    const block = `\n${newLines.map(x => `- ${x}`).join('\n')}\n`;
    next = next.slice(0, start) + block + next.slice(end);
    changed = true;
  }

  for (const sec of sections()) {
    const { text } = extractSection(next, sec);
    if (!text) continue;
    const lines = text.split('\n');
    const outLines = [];
    for (const li of lines) {
      const t = li.trim();
      if (!t.startsWith('- ')) continue;
      const item = t.replace(/^\-\s*/, '').trim();
      const inlineUid = parseInlineUid(item);
      const inlineKey = parseInlineKey(item);
      const base = stripInlineTokens(item);
      const key = inlineKey || computeNormalizedKey(base);
      let uid = inlineUid || uidmap[key];
      if (!uid) {
        uid = genUid8();
      }
      uidmap[key] = uid; // 回寫
      // 只在 MD 寫回 UID；normalizedKey 僅維護於 uidmap.json
      outLines.push(`${base} [uid:${uid}]`);
    }
    if (outLines.length > 0) replaceSection(sec, outLines);
  }

  if (changed) {
    writeFileSafe(STATUS_PATH, next);
    saveUidMap(uidmap);
  }

  return { changed };
}

function main() {
  const argFix = process.argv.includes('--fix');
  if (!argFix) {
    console.log('用法: node tools/status-uid.js --fix  會為 PROJECT_STATUS.md 每條目補上 [uid] 與 [key]');
    process.exit(0);
  }
  const res = fixStatus();
  console.log(res.changed ? '已更新 PROJECT_STATUS.md 並寫入 PROJECT_STATUS.uidmap.json' : '無需更新');
}

if (require.main === module) {
  main();
}


