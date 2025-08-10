#!/usr/bin/env node

/**
 * Trim PROJECT_STATUS.md Done items to max 5 and move overflow to doc/CHANGELOG.md
 * - Keeps completion date
 * - Appends concise entries to CHANGELOG
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

function toConciseChangelogEntry(text) {
  // Input example: "2025-08-10：修復 record_content 意圖誤判（內容記錄優先規則）"
  // Keep date + concise summary
  return `- ${text}`;
}

function appendToChangelog(entries) {
  if (entries.length === 0) return;
  let changelog = readFile(CHANGELOG_PATH);
  const header = '## [Unreleased] - 自動歸檔（狀態板 Done 溢出）';
  if (!changelog.includes(header)) {
    changelog = changelog.replace('# 📝 Change Log', `# 📝 Change Log\n\n${header}\n`);
  }
  const parts = changelog.split(header);
  const head = parts[0];
  const tail = parts[1] || '\n';
  const block = `\n${header}\n${entries.map(toConciseChangelogEntry).join('\n')}\n`;
  writeFile(CHANGELOG_PATH, head + block + tail);
}

function main() {
  const md = readFile(STATUS_PATH);
  const { lines, doneStart, doneEnd, doneItems } = extractDoneLines(md);
  if (doneStart === -1) {
    console.log('No Done section found.');
    return;
  }
  if (doneItems.length <= 5) {
    console.log('Done section is within limit.');
    return;
  }
  const keep = doneItems.slice(0, 5);
  const overflow = doneItems.slice(5);

  // Update PROJECT_STATUS.md
  const updated = [
    ...lines.slice(0, doneStart),
    ...keep.map(x => `- ${x.text}`),
    ...lines.slice(doneEnd),
  ].join('\n');
  writeFile(STATUS_PATH, updated);

  // Append to CHANGELOG
  appendToChangelog(overflow.map(x => x.text));

  console.log(`Trimmed Done: kept ${keep.length}, moved ${overflow.length} to CHANGELOG.`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('maintain-project-status failed:', e); process.exit(1); }
}


