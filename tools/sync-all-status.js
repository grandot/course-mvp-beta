#!/usr/bin/env node

/**
 * 一鍵同步更新所有狀態文檔
 * 自動收集系統狀態並更新：
 * - PROJECT_STATUS.md (專案管理視角)
 * - AI_TASK_CONTEXT.md (AI 工作上下文)
 * - doc/CHANGELOG.md (版本歷史)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 文檔路徑
const PROJECT_STATUS = path.resolve(__dirname, '../PROJECT_STATUS.md');
const AI_TASK_CONTEXT = path.resolve(__dirname, '../AI_TASK_CONTEXT.md');
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
  const aiContext = readFile(AI_TASK_CONTEXT);
  const changelog = readFile(CHANGELOG);
  
  // 從 PROJECT_STATUS 提取 Done 項目（安全的regex匹配）
  const doneItems = [];
  try {
    const doneMatch = projectStatus.match(/### Done[（(][^)）]*[)）][^#]*?(?=###|\z)/s);
    if (doneMatch && doneMatch[0]) {
      const lines = doneMatch[0].split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          doneItems.push(line.trim().substring(2));
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 無法解析 PROJECT_STATUS Done 項目:', error.message);
  }
  
  // 從 AI_TASK_CONTEXT 提取當前重點（安全的regex匹配）
  const currentFocus = [];
  try {
    const focusMatch = aiContext.match(/### 當前重點\n?([\s\S]*?)(?=###|\z)/);
    if (focusMatch && focusMatch[1]) {
      const lines = focusMatch[1].split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          currentFocus.push(line.trim().substring(2));
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 無法解析 AI_TASK_CONTEXT 當前重點:', error.message);
  }
  
  return { doneItems, currentFocus, projectStatus, aiContext, changelog };
}

// 3. 更新 PROJECT_STATUS.md
function updateProjectStatus(status, existing) {
  console.log('📝 更新 PROJECT_STATUS.md...');
  
  let content = existing.projectStatus;
  
  // 更新最後更新時間
  content = content.replace(
    /\*\*最後更新\*\*: .*/,
    `**最後更新**: ${status.date}`
  );
  
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

// 4. 更新 AI_TASK_CONTEXT.md
function updateAITaskContext(status, existing) {
  console.log('🤖 更新 AI_TASK_CONTEXT.md...');
  
  const sections = [];

  // 如果檔案已採用「當前上下文摘要」格式，就只更新時間戳並原樣輸出
  if (/###\s*當前上下文摘要/.test(existing.aiContext)) {
    const updated = existing.aiContext.replace(
      /- 最後更新：.*\n/,
      `- 最後更新：${status.timestamp}\n`
    );
    return updated;
  }
  
  // 標題和時間戳
  sections.push('## AI 任務上下文（聊天）\n');
  sections.push(`- 最後更新：${status.timestamp}\n`);
  
  // 當前重點（完全保留現有內容，不自動覆蓋）
  const currentFocusMatch = existing.aiContext.match(/### 當前重點\n?([\s\S]*?)(?=###|$)/);
  if (currentFocusMatch) {
    sections.push('### 當前重點');
    sections.push(currentFocusMatch[1].trim());
    sections.push('');
  } else {
    // 如果沒有現有內容，創建空的當前重點區塊
    sections.push('### 當前重點');
    sections.push('');
  }
  
  // 最近變更（從 git 獲取）
  sections.push('### 最近變更（已部署）');
  if (status.git.recentCommits.length > 0) {
    sections.push(`- 最新提交：${status.git.lastCommit}`);
    sections.push(`- 分支：${status.git.branch}`);
    if (status.git.uncommitted > 0) {
      sections.push(`- 未提交變更：${status.git.uncommitted} 個檔案`);
    }
  }
  sections.push('');
  
  // 當前狀態
  sections.push('### 當前狀態');
  sections.push(`- AI Fallback：${status.env.aiEnabled ? '已開啟' : '已關閉'}（ENABLE_AI_FALLBACK=${status.env.aiEnabled}）`);
  sections.push(`- AI 信心閾值：${status.env.aiConfidence}`);
  sections.push(`- Redis：${status.env.redisEnabled ? '已啟用' : '未啟用'}`);
  sections.push(`- 服務狀態：${status.service.status || 'offline'}`);
  sections.push('');
  
  // 下一步（保留現有內容的這部分）
  const nextStepsMatch = existing.aiContext.match(/### 下一步（待指示後執行）([\s\S]*?)###/);
  if (nextStepsMatch) {
    sections.push('### 下一步（待指示後執行）');
    sections.push(nextStepsMatch[1].trim());
    sections.push('');
  }
  
  // 既往共識（保留）
  const consensusMatch = existing.aiContext.match(/### 既往共識([\s\S]*?)###/);
  if (consensusMatch) {
    sections.push('### 既往共識');
    sections.push(consensusMatch[1].trim());
    sections.push('');
  }
  
  return sections.join('\n');
}

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

// 5. 更新 CHANGELOG.md
function updateChangelog(status, existing) {
  console.log('📜 更新 CHANGELOG.md...');
  
  let content = existing.changelog;
  
  // 生成動態條目
  const newEntries = generateChangelogEntries(status);
  
  if (newEntries.length === 0) {
    // 只更新現有日期格式（如果有的話）
    content = content.replace(
      /## (\d{4}-\d{2}-\d{2})/g,
      `## ${status.date}`
    );
    return content;
  }
  
  // 智能添加新的日期區塊（置頂，最新在前）
  const hasDateSections = content.match(/## \d{4}-\d{2}-\d{2}/);
  
  if (hasDateSections) {
    // 在第一個日期區塊前插入新條目
    let newSection = `## ${status.date} - `;
    
    // 生成標題（基於條目類型）
    const hasFixed = newEntries.some(e => e.type === '🚀 Fixed');
    const hasAdded = newEntries.some(e => e.type === '✨ Added');
    
    if (hasFixed && hasAdded) {
      newSection += '功能修復與新增 🔧✨\n\n';
    } else if (hasFixed) {
      newSection += '功能修復 🔧\n\n';
    } else if (hasAdded) {
      newSection += '功能新增 ✨\n\n';
    } else {
      newSection += '系統更新 📝\n\n';
    }
    
    // 按類型組織條目
    const fixedEntries = newEntries.filter(e => e.type === '🚀 Fixed');
    const addedEntries = newEntries.filter(e => e.type === '✨ Added');
    
    if (fixedEntries.length > 0) {
      newSection += '### 🐛 Fixed\n';
      for (const entry of fixedEntries) {
        newSection += `- **${entry.title}**: `;
        if (entry.details.length > 0) {
          newSection += entry.details.join('，');
        }
        newSection += '\n';
      }
      newSection += '\n';
    }
    
    if (addedEntries.length > 0) {
      newSection += '### ✨ Added\n';
      for (const entry of addedEntries) {
        newSection += `- ${entry.title}\n`;
      }
      newSection += '\n';
    }
    
    newSection += '---\n\n';
    
    // 插入到第一個日期區塊前
    const firstDateMatch = content.match(/(## \d{4}-\d{2}-\d{2})/);
    if (firstDateMatch) {
      content = content.replace(firstDateMatch[1], newSection + firstDateMatch[1]);
    }
  }
  
  return content;
}

// 主函數
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const forceContext = process.argv.includes('--force-context') || process.argv.includes('--force');
  
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
    
    // 3. 更新各文檔
    const updatedProjectStatus = updateProjectStatus(status, existing);
    const updatedAIContext = updateAITaskContext(status, existing);
    const updatedChangelog = updateChangelog(status, existing);
    
    // 4. 寫入文檔（只在有變化時）
    const updates = {
      projectStatus: writeFile(PROJECT_STATUS, updatedProjectStatus, isDryRun),
      aiContext: (() => {
        if (forceContext && !isDryRun) {
          fs.writeFileSync(AI_TASK_CONTEXT, updatedAIContext, 'utf8');
          console.log('✅ 已更新 AI_TASK_CONTEXT.md（force-context）');
          return true;
        }
        return writeFile(AI_TASK_CONTEXT, updatedAIContext, isDryRun);
      })(),
      changelog: writeFile(CHANGELOG, updatedChangelog, isDryRun)
    };
    
    const updatedCount = Object.values(updates).filter(Boolean).length;
    
    console.log(`\n✨ 同步完成！已更新 ${updatedCount}/3 個文檔`);
    console.log('📊 PROJECT_STATUS.md - 專案管理視角');
    console.log('🤖 AI_TASK_CONTEXT.md - AI 工作上下文');
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
  updateAITaskContext, 
  updateChangelog,
  getTimestamp,
  getTodayDate
};