#!/usr/bin/env node

/**
 * 同步 PROJECT_STATUS.md 的 Done 條目到 CHANGELOG，並在條目超過 5 時修剪狀態板。
 * 新流程（與使用者預期對齊）：
 * 1) 無論 Done 條目數多少，將 Done 條目「並行」同步到 doc/CHANGELOG.md（避免重複追加）
 * 2) 若 Done 條目數 > 5，僅保留最近 5 條於 PROJECT_STATUS.md，其餘維持在 CHANGELOG（Unreleased 區塊）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function extractDoingLines(markdown) {
  const lines = markdown.split('\n');
  const headerIdx = lines.findIndex(l => l.trim().startsWith('### Doing（最多 3 項'));
  if (headerIdx === -1) return { lines, doingHeaderIdx: -1, doingStart: -1, doingEnd: -1, doingItems: [] };
  let i = headerIdx + 1;
  const items = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ') || line.startsWith('## ')) break;
    if (line.trim().startsWith('- ')) items.push({ idx: i, text: line.trim().slice(2) });
    i += 1;
  }
  return { lines, doingHeaderIdx: headerIdx, doingStart: headerIdx + 1, doingEnd: i, doingItems: items };
}

function extractNextLines(markdown) {
  const lines = markdown.split('\n');
  // 相容不同標題描述
  const headerIdx = lines.findIndex(l => /### Next（/.test(l));
  if (headerIdx === -1) return { lines, nextHeaderIdx: -1, nextStart: -1, nextEnd: -1, nextItems: [] };
  let i = headerIdx + 1;
  const items = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ') || line.startsWith('## ')) break;
    if (line.trim().startsWith('- ')) items.push({ idx: i, text: line.trim().slice(2) });
    i += 1;
  }
  return { lines, nextHeaderIdx: headerIdx, nextStart: headerIdx + 1, nextEnd: i, nextItems: items };
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
  let md = readFile(STATUS_PATH);

  // 0) 嘗試自動從 Doing 遷移到 Done：檢查近期 commit 與 CHANGELOG
  try {
    const { doingHeaderIdx, doingStart, doingEnd, doingItems } = extractDoingLines(md);
    if (doingHeaderIdx !== -1 && doingItems.length > 0) {
      const recentCommits = (() => {
        try { return execSync('git log -n 50 --pretty=format:%s%n%b', { encoding: 'utf8' }); } catch (_) { return ''; }
      })();
      const changelogFull = readFile(CHANGELOG_PATH);

      const normalize = (s) => (s || '')
        .replace(/\[[^\]]*\]/g, '') // 移除 [P1][UX]
        .replace(/[（(][^）)]*[）)]/g, '') // 移除括號內容（含中英文）
        .replace(/\s+/g, '')
        .toLowerCase();

      const toTitle = (s) => (s || '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[（(][^）)]*[）)]/g, '')
        .trim();

      const migrated = [];
      const remaining = [];
      for (const it of doingItems) {
        const key = normalize(it.text);
        const found = key && (normalize(recentCommits).includes(key) || normalize(changelogFull).includes(key));
        if (found) migrated.push(toTitle(it.text)); else remaining.push(it.text);
      }

      if (migrated.length > 0) {
        // 更新 Doing 區塊內容
        const lines = md.split('\n');
        const headerLine = lines[doingHeaderIdx];
        const newDoingSection = [headerLine, ...remaining.map(t => `- ${t}`)];
        const updatedAfterDoing = [
          ...lines.slice(0, doingHeaderIdx),
          ...newDoingSection,
          ...lines.slice(doingEnd),
        ];
        md = updatedAfterDoing.join('\n');

        // 把遷移條目插入 Done 區塊最前面（加上日期）
        const { lines: lines2, doneStart, doneEnd, doneItems } = extractDoneLines(md);
        if (doneStart !== -1) {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          const dated = migrated.map(t => `${y}-${m}-${d}：${t}`);

          const newMd = [
            ...lines2.slice(0, doneStart),
            ...dated.map(t => `- ${t}`),
            ...lines2.slice(doneStart, doneEnd),
            ...lines2.slice(doneEnd),
          ].join('\n');
          md = newMd;

          // 同步到 CHANGELOG（避免重複）
          appendToChangelogIfMissing(dated);
        }
      }
    }
  } catch (e) {
    // 靜默忽略自動遷移錯誤，保持現有流程
  }

  // 0.5) 嘗試自動從 Next 遷移到 Doing：若近期 commit/CHANGELOG 含關鍵詞，視為已開工
  try {
    let changed = false;
    const { nextHeaderIdx, nextStart, nextEnd, nextItems } = extractNextLines(md);
    if (nextHeaderIdx !== -1 && nextItems.length > 0) {
      const recentCommits = (() => {
        try { return execSync('git log -n 50 --pretty=format:%s%n%b', { encoding: 'utf8' }); } catch (_) { return ''; }
      })();
      const changelogFull = readFile(CHANGELOG_PATH);
      const normalize = (s) => (s || '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[（(][^）)]*[）)]/g, '')
        .replace(/（需求定義完成；尚未開工）/g, '')
        .replace(/（需求定義完成，尚未開工）/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

      const lines = md.split('\n');
      const { doingHeaderIdx, doingStart, doingEnd, doingItems } = extractDoingLines(md);
      const doingHeader = doingHeaderIdx !== -1 ? lines[doingHeaderIdx] : '### Doing（最多 3 項）';
      const currentDoingSet = new Set(doingItems.map(x => normalize(x.text)));

      const toMove = [];
      const stay = [];
      for (const it of nextItems) {
        const key = normalize(it.text);
        const found = key && (normalize(recentCommits).includes(key) || normalize(changelogFull).includes(key));
        if (found) toMove.push(it.text); else stay.push(it.text);
      }

      if (toMove.length > 0) {
        // 更新 Next 區塊
        const newNextSection = [lines[nextHeaderIdx], ...stay.map(t => `- ${t}`)];
        // 更新 Doing 區塊（追加未重複者）
        const added = toMove.filter(t => !currentDoingSet.has(normalize(t)));
        const newDoingSection = [doingHeader, ...doingItems.map(x => `- ${x.text}`), ...added.map(t => `- ${t}`)];

        const updated = [
          ...lines.slice(0, nextHeaderIdx),
          ...newNextSection,
          ...lines.slice(nextEnd, doingHeaderIdx !== -1 ? doingHeaderIdx : nextEnd),
          ...newDoingSection,
          ...lines.slice(doingHeaderIdx !== -1 ? doingEnd : (nextEnd)),
        ].join('\n');
        md = updated;
        changed = true;
        console.log(`Auto-moved from Next to Doing: ${added.length} item(s).`);
      }
    }
  } catch (_) {}

  // 1) 並行同步 Done 條目到 CHANGELOG（避免重複）
  const { lines, doneStart, doneEnd, doneItems } = extractDoneLines(md);
  if (doneStart === -1) {
    console.log('No Done section found.');
    return;
  }
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

  // 若有遷移過，覆寫檔案
  if (md !== readFile(STATUS_PATH)) {
    writeFile(STATUS_PATH, md);
  }
  console.log(`Synced CHANGELOG (appended ${appended}). Done section within limit: ${doneItems.length} items.`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('maintain-project-status failed:', e); process.exit(1); }
}


