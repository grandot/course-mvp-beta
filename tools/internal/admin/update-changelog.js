#!/usr/bin/env node

/**
 * Append concise entries to doc/CHANGELOG.md based on input lines
 * Usage: node tools/update-changelog.js "2025-08-10：修復 ..." "2025-08-11：..."
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.resolve(__dirname, '../doc/CHANGELOG.md');

function appendConcise(entries) {
  if (!entries || entries.length === 0) return;
  const header = '## [Unreleased] - 自動歸檔（狀態板 Done 溢出）';
  let changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  if (!changelog.includes(header)) {
    changelog = changelog.replace('# 📝 Change Log', `# 📝 Change Log\n\n${header}\n`);
  }
  const parts = changelog.split(header);
  const head = parts[0];
  const tail = parts[1] || '\n';
  const block = `\n${header}\n${entries.map(e => `- ${e}`).join('\n')}\n`;
  fs.writeFileSync(CHANGELOG_PATH, head + block + tail, 'utf8');
  console.log(`Appended ${entries.length} entries to CHANGELOG.`);
}

function main() {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length === 0) {
    console.log('Usage: node tools/update-changelog.js "YYYY-MM-DD：摘要" ...');
    process.exit(0);
  }
  appendConcise(args);
}

if (require.main === module) {
  main();
}


