#!/usr/bin/env node

/**
 * 一鍵同步更新所有狀態文檔
 * 自動收集系統狀態並更新：
 * - PROJECT_STATUS.md (專案管理視角)
 * - doc/CHANGELOG.md (版本歷史)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 文檔路徑
const PROJECT_STATUS = path.resolve(__dirname, '../PROJECT_STATUS.md');
const CHANGELOG = path.resolve(__dirname, '../doc/CHANGELOG.md');

// 工具函數
function readFile(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    console.warn(`⚠️ 無法讀取 ${path.basename(filepath)}:`, e.message);
    return '';
  }
}

// 內容差異檢測
function hasContentChanged(oldContent, newContent) {
  // 忽略時間戳的變化，只檢查實質內容
  const normalizeContent = (content) => {
    return content
      .replace(/\*\*最後更新\*\*: .*/g, '**最後更新**: DATE')
      .replace(/- 最後更新：.*/g, '- 最後更新：TIMESTAMP')
      .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}（台北時間, UTC\+8）/g, 'TIMESTAMP')
      .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')
      .trim();
  };
  
  return normalizeContent(oldContent) !== normalizeContent(newContent);
}

function writeFile(filepath, content, isDryRun = false) {
  const oldContent = readFile(filepath);
  
  if (hasContentChanged(oldContent, content)) {
    if (isDryRun) {
      console.log(`🧪 [Dry Run] 將會更新 ${path.basename(filepath)}`);
      // 顯示變化的預覽
      const filename = path.basename(filepath);
      console.log(`   📄 ${filename} 將有實質內容變化`);
    } else {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`✅ 已更新 ${path.basename(filepath)}`);
    }
    return true;
  } else {
    console.log(`⏭️ ${path.basename(filepath)} 無實質變化，跳過更新`);
    return false;
  }
}

function execCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function getTimestamp() {
  // 使用標準時區API，避免夏令時問題
  const now = new Date();
  const taipeiTime = now.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // 格式化為 YYYY-MM-DD HH:mm:ss
  const formatted = taipeiTime.replace(/\//g, '-').replace(/\s/g, ' ');
  return formatted + '（台北時間, UTC+8）';
}

function getTodayDate() {
  // 使用標準時區API，與 getTimestamp() 保持一致
  const now = new Date();
  const taipeiDate = now.toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // 格式化為 YYYY-MM-DD
  return taipeiDate.replace(/\//g, '-');
}

// 1. 收集系統狀態
function collectSystemStatus() {
  console.log('📊 收集系統狀態...');
  
  const status = {
    timestamp: getTimestamp(),
    date: getTodayDate(),
    git: {
      branch: execCommand('git branch --show-current'),
      lastCommit: execCommand('git log -1 --oneline'),
      uncommitted: execCommand('git status --porcelain')?.split('\n').filter(l => l).length || 0,
      recentCommits: execCommand('git log --oneline -5')?.split('\n') || []
    },
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      aiEnabled: process.env.ENABLE_AI_FALLBACK === 'true',
      aiConfidence: process.env.AI_FALLBACK_MIN_CONFIDENCE || '0.7',
      redisEnabled: !!process.env.REDIS_URL
    },
    tests: {
      lastRun: null, // TODO: 從測試報告讀取
      passRate: null  // TODO: 計算通過率
    }
  };
  
  // 檢查服務狀態（安全的JSON解析）
  try {
    const healthCheck = execCommand('curl -s http://localhost:3000/health');
    if (healthCheck && healthCheck.trim()) {
      status.service = JSON.parse(healthCheck);
    } else {
      status.service = { status: 'offline' };
    }
  } catch (error) {
    console.warn('⚠️ 健康檢查失敗:', error.message);
    status.service = { status: 'offline', error: error.message };
  }
  
  return status;
}

// 2. 解析現有文檔內容
function parseExistingDocs() {
  const projectStatus = readFile(PROJECT_STATUS);
  const changelog = readFile(CHANGELOG);
  
  // 從 PROJECT_STATUS 提取 Done 項目（以行為單位解析，避免複雜正則不穩定）
  const doneItems = [];
  try {
    const lines = projectStatus.split('\n');
    // 找到第一個以 "### Done" 開頭的標題（允許含括號備註）
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (/^###\s+Done(\s*[（(].*[)）])?\s*$/.test(l)) { startIdx = i + 1; break; }
    }
    if (startIdx >= 0) {
      for (let i = startIdx; i < lines.length; i++) {
        const raw = lines[i];
        if (/^###\s+/.test(raw)) break; // 下一個區塊
        const t = raw.trim();
        if (t.startsWith('- ')) doneItems.push(t.substring(2));
      }
    }
  } catch (error) {
    console.warn('⚠️ 無法解析 PROJECT_STATUS Done 項目:', error.message);
  }
  
  return { doneItems, projectStatus, changelog };
}

// 3. 更新 PROJECT_STATUS.md
function updateProjectStatus(status, existing) {
  console.log('📝 更新 PROJECT_STATUS.md...');
  
  let content = existing.projectStatus;
  
  // 更新最後更新時間（若不存在則自動新增在第一個標題之後）
  if (/\*\*最後更新\*\*: .*/.test(content)) {
    content = content.replace(/\*\*最後更新\*\*: .*/, `**最後更新**: ${status.date}`);
  } else {
    content = content.replace(/^(#.*\n)/, `$1\n**最後更新**: ${status.date}\n`);
  }
  
  // 更新版本號（只在有實質程式碼變更時）
  const hasCodeChanges = status.git.recentCommits.length > 0 && 
    status.git.recentCommits[0].match(/^(?!docs:|sync:|merge:|格式化:|formatting:)/i) &&
    (status.git.recentCommits[0].includes('修復') || 
     status.git.recentCommits[0].includes('新增') ||
     status.git.recentCommits[0].includes('Fixed') ||
     status.git.recentCommits[0].includes('Add') ||
     status.git.recentCommits[0].includes('feat:') ||
     status.git.recentCommits[0].includes('fix:'));
     
  if (hasCodeChanges) {
    const currentVersion = content.match(/\*\*版本\*\*: (\d+)\.(\d+)\.(\d+)/);
    if (currentVersion) {
      const [, major, minor, patch] = currentVersion;
      const newPatch = parseInt(patch) + 1;
      content = content.replace(
        /\*\*版本\*\*: \d+\.\d+\.\d+/,
        `**版本**: ${major}.${minor}.${newPatch}`
      );
      console.log(`📈 版本號更新: ${major}.${minor}.${patch} → ${major}.${minor}.${newPatch}`);
    }
  }
  
  // 如果有重大修復，更新概覽區塊
  if (status.git.recentCommits.length > 0 && 
      (status.git.recentCommits[0].includes('確認按鈕') || status.git.recentCommits[0].includes('Google Calendar'))) {
    content = content.replace(
      /## 概覽（快速掃描）[\s\S]*?---/,
      `## 概覽（快速掃描）
- ✅ **核心功能修復完成**：確認按鈕 + Google Calendar 同步已解決
- 系統狀態：MVP 核心功能完全正常運作  
- 主要成果：確認功能恢復、日曆即時同步、環境變數載入修復
- 最新完成：**確認按鈕修復** + **Google Calendar 同步修復**

---`
    );
  }
  
  return content;
}

// （移除）AI_TASK_CONTEXT.md 不再由此工具自動更新

// 從 git commits 動態生成 changelog 條目
function generateChangelogEntries(status) {
  const entries = [];
  
  // 分析最近的 commits 生成條目
  for (const commit of status.git.recentCommits.slice(0, 3)) { // 只看最近3個
    const entry = analyzeCommitForChangelog(commit, status.date);
    if (entry) {
      entries.push(entry);
    }
  }
  
  return entries;
}

function analyzeCommitForChangelog(commit, date) {
  // 跳過文檔更新和merge commits
  if (commit.match(/^(docs|sync|merge|format):/i) || 
      commit.includes('同步更新狀態文檔') ||
      commit.includes('Generated with')) {
    return null;
  }
  
  // 分析commit類型和生成對應條目
  if (commit.includes('修復') || commit.includes('fix:')) {
    if (commit.includes('確認按鈕') || commit.includes('confirm')) {
      return {
        type: '🚀 Fixed',
        title: '確認按鈕功能修復',
        details: [
          '修復意圖識別問題',
          '雙重保險設計：AI + 規則兜底'
        ],
        date
      };
    }
    if (commit.includes('Google Calendar') || commit.includes('Calendar')) {
      return {
        type: '🚀 Fixed', 
        title: 'Google Calendar 同步修復',
        details: [
          '環境變數載入修復',
          '課程直接寫入日曆'
        ],
        date
      };
    }
  }
  
  if (commit.includes('新增') || commit.includes('feat:') || commit.includes('Add')) {
    return {
      type: '✨ Added',
      title: commit.replace(/^[a-f0-9]+\s+/, '').substring(0, 50),
      details: [],
      date
    };
  }
  
  return null;
}

// 5. 更新 CHANGELOG.md（增量模式，保留歷史）
function updateChangelog(status, existing) {
  console.log('📜 更新 CHANGELOG.md（增量追加 PROJECT_STATUS.md 的 Done 條目）...');

  let content = existing.changelog;

  // 由 PROJECT_STATUS.md 的 Done 區塊生成 changelog 條目
  // 增量策略：只追加新的條目，不覆蓋現有歷史
  const doneItems = Array.isArray(existing.doneItems) ? existing.doneItems : [];
  const dateItemMap = new Map(); // dateStr -> [items]

  for (const line of doneItems) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})[:：]\s*(.+)$/);
    if (!m) continue;
    const [, dateStr, rest] = m;
    if (!dateItemMap.has(dateStr)) dateItemMap.set(dateStr, []);
    dateItemMap.get(dateStr).push(rest.trim());
  }

  if (dateItemMap.size === 0) return content;

  // 找 changelog 目前最新日期（預設很早的日期）
  const mLatest = content.match(/^##\s+(\d{4}-\d{2}-\d{2})\b/m);
  const latestDate = mLatest ? mLatest[1] : '1900-01-01';

  // 幫助函式：找某日期區塊範圍
  function findDateSectionRange(md, dateStr) {
    const re = new RegExp(`^##\\s+${dateStr}\\b[\\/\s\S]*?`, 'm');
    // 粗略判斷存在與否
    const idx = md.search(new RegExp(`^##\\s+${dateStr}\\b`, 'm'));
    if (idx < 0) return null;
    // 找到該標題到下一個日期標題的範圍
    const after = md.slice(idx + 2);
    const nextIdxRel = after.search(/^##\s+\d{4}-\d{2}-\d{2}\b/m);
    const end = nextIdxRel >= 0 ? idx + 2 + nextIdxRel : md.length;
    return { start: idx, end };
  }

  // 依日期新建或補充區塊（置頂插入新的日期區塊）
  for (const [dateStr, items] of dateItemMap.entries()) {
    if (!items || items.length === 0) continue;
    const exists = new RegExp(`^##\s+${dateStr}\b`, 'm').test(content);
    if (!exists && dateStr >= latestDate) {
      // 新建日期區塊，置頂插入
      let newSection = `## ${dateStr} - 系統更新 📝\n\n`;
      newSection += '### 🐛 Fixed\n';
      for (const it of items) newSection += `- ${it}\n`;
      newSection += '\n---\n\n';
      const firstDate = content.match(/(^##\s+\d{4}-\d{2}-\d{2}.*)/m);
      if (firstDate) {
        content = content.replace(firstDate[1], newSection + firstDate[1]);
      } else {
        // 若沒有任何日期區塊，直接附加在檔頭後
        content = content.trimEnd() + '\n\n' + newSection;
      }
      continue;
    }

    // 已存在該日期區塊 → 補上缺少的條目
    const range = findDateSectionRange(content, dateStr);
    if (range) {
      const section = content.slice(range.start, range.end);
      let updatedSection = section;
      for (const it of items) {
        if (!section.includes(`- ${it}`)) {
          // 盡量插到 "### 🐛 Fixed" 後面，若沒有就加在該區塊末尾
          if (/###\s*🐛\s*Fixed/.test(updatedSection)) {
            updatedSection = updatedSection.replace(/(###\s*🐛\s*Fixed\s*\n)/, `$1- ${it}\n`);
          } else {
            updatedSection = updatedSection.replace(/\n+$/, '') + `\n- ${it}\n`;
          }
        }
      }
      content = content.slice(0, range.start) + updatedSection + content.slice(range.end);
    }
  }

  // 增量模式：只處理新的日期條目，保留現有歷史
  function addNewEntriesOnly(md, newDateItemMap) {
    // 檢查哪些日期是新的或需要更新的
    const existingDates = new Set();
    const dateRegex = /^##\s+(\d{4}-\d{2}-\d{2})\b/gm;
    let match;
    while ((match = dateRegex.exec(md)) !== null) {
      existingDates.add(match[1]);
    }

    let result = md;
    
    // 只處理新日期或需要更新的日期
    for (const [dateStr, items] of newDateItemMap) {
      if (existingDates.has(dateStr)) {
        // 日期已存在，跳過以保留歷史（避免重複）
        console.log(`⏭️ 跳過已存在的日期區塊: ${dateStr}`);
        continue;
      }
      
      // 這是新日期，需要添加
      const newSection = `## ${dateStr} - 系統更新 📝\n\n### 🐛 Fixed\n${items.map(item => `- ${item}`).join('\n')}\n\n---\n\n`;
      
      // 插入到第一個日期區塊之前
      const firstDateMatch = result.match(/^##\s+\d{4}-\d{2}-\d{2}/m);
      if (firstDateMatch) {
        const insertPos = result.indexOf(firstDateMatch[0]);
        result = result.slice(0, insertPos) + newSection + result.slice(insertPos);
      } else {
        // 沒有日期區塊，插入到 header 後面
        const headerMatch = result.match(/^#\s+.*\n\n?/);
        const headerEnd = headerMatch ? headerMatch[0].length : 0;
        result = result.slice(0, headerEnd) + newSection + result.slice(headerEnd);
      }
      
      console.log(`✅ 添加新日期區塊: ${dateStr} (${items.length} 項)`);
    }
    
    return result;
  }

  return addNewEntriesOnly(content, dateItemMap);
}

// 檢查 commit 與 Done 區塊一致性
function checkCommitConsistency(status, existing) {
  console.log('🔍 檢查 commit 與 Done 區塊一致性...');
  
  const warnings = [];
  const importantCommitPatterns = [
    { pattern: /fix.*quick.*reply|修復.*快速回覆|修復.*取消.*重複/i, type: 'BUG修復' },
    { pattern: /feat.*recurring|重複課程|每月|每週|每天/i, type: '重複功能' },
    { pattern: /fix.*calendar|修復.*日曆|calendar.*sync/i, type: 'Calendar修復' },
    { pattern: /feat.*modify|修改課程|modify.*course/i, type: '修改功能' }
  ];
  
  // 檢查最近7天的重要 commit
  const recentImportantCommits = [];
  for (const commit of status.git.recentCommits.slice(0, 10)) {
    for (const { pattern, type } of importantCommitPatterns) {
      if (pattern.test(commit)) {
        recentImportantCommits.push({ commit, type });
        break;
      }
    }
  }
  
  // 檢查是否有重要 commit 未反映在 Done 區塊
  for (const { commit, type } of recentImportantCommits) {
    const commitShort = commit.substring(0, 60);
    const isDoneItemFound = existing.doneItems.some(itemText => {
      const lowerItemText = itemText.toLowerCase();
      const commitText = commit.toLowerCase();
      
      // 檢查關鍵詞匹配
      if (type === 'BUG修復' && (lowerItemText.includes('quick reply') || lowerItemText.includes('取消重複') || lowerItemText.includes('快速回覆'))) {
        return true;
      }
      if (type === '重複功能' && (lowerItemText.includes('重複課程') || lowerItemText.includes('recurring'))) {
        return true;
      }
      if (type === 'Calendar修復' && (lowerItemText.includes('calendar') || lowerItemText.includes('日曆'))) {
        return true;
      }
      if (type === '修改功能' && (lowerItemText.includes('修改課程') || lowerItemText.includes('modify'))) {
        return true;
      }
      
      return false;
    });
    
    if (!isDoneItemFound) {
      warnings.push(`⚠️ 重要 commit 可能未反映在 Done 區塊：${commitShort}`);
    }
  }
  
  if (warnings.length > 0) {
    console.log('\n🚨 一致性檢查警告：');
    warnings.forEach(warning => console.log(warning));
    console.log('💡 建議檢查是否需要更新 PROJECT_STATUS.md 的 Done 區塊\n');
  } else {
    console.log('✅ commit 與 Done 區塊一致性良好\n');
  }
  
  return warnings;
}

// 主函數
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  if (isDryRun) {
    console.log('🧪 Dry Run 模式 - 只預覽變化，不實際寫入\n');
  } else {
    console.log('🚀 開始同步所有狀態文檔...\n');
  }
  
  try {
    // 1. 收集狀態
    const status = collectSystemStatus();
    
    // 2. 解析現有文檔
    const existing = parseExistingDocs();

    // 3. 檢查一致性
    const warnings = checkCommitConsistency(status, existing);

    // 4. 更新各文檔（僅 PROJECT_STATUS 與 CHANGELOG）
    const updatedProjectStatus = updateProjectStatus(status, existing);
    const updatedChangelog = updateChangelog(status, existing);

    // 5. 寫入文檔（只在有變化時）
    const updates = {
      projectStatus: writeFile(PROJECT_STATUS, updatedProjectStatus, isDryRun),
      changelog: writeFile(CHANGELOG, updatedChangelog, isDryRun)
    };

    const updatedCount = Object.values(updates).filter(Boolean).length;

    console.log(`\n✨ 同步完成！已更新 ${updatedCount}/2 個文檔`);
    console.log('📊 PROJECT_STATUS.md - 專案管理視角');
    console.log('📜 CHANGELOG.md - 版本歷史\n');
    
    // 5. 提示是否要提交
    if (status.git.uncommitted > 0) {
      console.log('💡 提示：有未提交的變更，建議執行：');
      console.log('   git add -A && git commit -m "docs: 同步更新狀態文檔"');
    }
    
  } catch (error) {
    console.error('❌ 同步失敗:', error.message);
    process.exit(1);
  }
}

// 執行
if (require.main === module) {
  main();
}

module.exports = { 
  collectSystemStatus, 
  updateProjectStatus, 
  updateChangelog,
  getTimestamp,
  getTodayDate
};