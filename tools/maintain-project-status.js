#!/usr/bin/env node

/**
 * 同步 PROJECT_STATUS.md 的 Done 條目到 CHANGELOG，並在條目超過 5 時修剪狀態板。
 * 新流程（與使用者預期對齊）：
 * 1) 無論 Done 條目數多少，將 Done 條目「並行」同步到 doc/CHANGELOG.md（避免重複追加）
 * 2) 若 Done 條目數 > 5，僅保留最近 5 條於 PROJECT_STATUS.md，其餘維持在 CHANGELOG（Unreleased 區塊）
 */

const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.resolve(__dirname, '../PROJECT_STATUS.md');
const CHANGELOG_PATH = path.resolve(__dirname, '../doc/CHANGELOG.md');

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, s) { fs.writeFileSync(p, s, 'utf8'); }

function extractDoneLines(markdown) {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex(l => l.trim().startsWith('### Done（最近 5 筆'));
  if (startIdx === -1) return { lines, doneStart: -1, doneEnd: -1, doneItems: [] };
  let i = startIdx + 1;
  const items = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ') || line.startsWith('## ')) break;
    if (line.trim().startsWith('- ')) items.push({ idx: i, text: line.trim().slice(2) });
    i += 1;
  }
  return { lines, doneStart: startIdx + 1, doneEnd: i, doneItems: items };
}

function normalizeEntry(text) { return `- ${text}`; }

function appendToChangelogIfMissing(entries) {
  if (entries.length === 0) return { appended: 0 };
  let changelog = readFile(CHANGELOG_PATH);
  const header = '## [Unreleased] - 自動歸檔（狀態板 Done 溢出）';
  if (!changelog.includes(header)) {
    changelog = changelog.replace('# 📝 Change Log', `# 📝 Change Log\n\n${header}\n`);
  }

  // 僅追加尚未存在於 CHANGELOG 的條目
  const candidateLines = entries.map(normalizeEntry);
  const missing = candidateLines.filter(line => !changelog.includes(line));
  if (missing.length === 0) {
    return { appended: 0 };
  }

  const parts = changelog.split(header);
  const head = parts[0];
  const tail = parts[1] || '\n';
  const block = `\n${header}\n${missing.join('\n')}\n`;
  writeFile(CHANGELOG_PATH, head + block + tail);
  return { appended: missing.length };
}

function main() {
  const md = readFile(STATUS_PATH);
  const { lines, doneStart, doneEnd, doneItems } = extractDoneLines(md);
  if (doneStart === -1) {
    console.log('No Done section found.');
    return;
  }

  // 1) 並行同步 Done 條目到 CHANGELOG（避免重複）
  const allDoneTexts = doneItems.map(x => x.text);
  const { appended } = appendToChangelogIfMissing(allDoneTexts);

  // 2) 若 Done 條目數 > 5，修剪狀態板僅保留 5 條
  if (doneItems.length > 5) {
    const keep = doneItems.slice(0, 5);
    const updated = [
      ...lines.slice(0, doneStart),
      ...keep.map(x => `- ${x.text}`),
      ...lines.slice(doneEnd),
    ].join('\n');
    writeFile(STATUS_PATH, updated);
    console.log(`Synced CHANGELOG (appended ${appended}), trimmed Done: kept ${keep.length}, removed ${doneItems.length - keep.length}.`);
    return;
  }

  console.log(`Synced CHANGELOG (appended ${appended}). Done section within limit: ${doneItems.length} items.`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('maintain-project-status failed:', e); process.exit(1); }
}


