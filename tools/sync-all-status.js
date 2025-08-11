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

function writeFile(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`✅ 已更新 ${path.basename(filepath)}`);
}

function execCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function getTimestamp() {
  const now = new Date();
  const taipei = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return taipei.toISOString().replace('T', ' ').split('.')[0] + '（台北時間, UTC+8）';
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  
  // 檢查服務狀態
  const healthCheck = execCommand('curl -s http://localhost:3000/health');
  status.service = healthCheck ? JSON.parse(healthCheck) : { status: 'offline' };
  
  return status;
}

// 2. 解析現有文檔內容
function parseExistingDocs() {
  const projectStatus = readFile(PROJECT_STATUS);
  const aiContext = readFile(AI_TASK_CONTEXT);
  const changelog = readFile(CHANGELOG);
  
  // 從 PROJECT_STATUS 提取 Done 項目
  const doneMatch = projectStatus.match(/### Done（最近 5 筆[\s\S]*?###/);
  const doneItems = [];
  if (doneMatch) {
    const lines = doneMatch[0].split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('- ')) {
        doneItems.push(line.trim().substring(2));
      }
    }
  }
  
  // 從 AI_TASK_CONTEXT 提取當前重點
  const currentFocus = [];
  const focusMatch = aiContext.match(/### 當前重點\n([\s\S]*?)###/);
  if (focusMatch) {
    const lines = focusMatch[1].split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('- ')) {
        currentFocus.push(line.trim().substring(2));
      }
    }
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
  
  // 更新關鍵指標（如果有測試結果）
  if (status.tests.passRate !== null) {
    content = content.replace(
      /\| 自動化測試通過率（受控） \| \d+% \| \d+% \|/,
      `| 自動化測試通過率（受控） | 100% | ${status.tests.passRate}% |`
    );
  }
  
  // 保持其他內容不變，僅更新時間戳和動態資料
  return content;
}

// 4. 更新 AI_TASK_CONTEXT.md
function updateAITaskContext(status, existing) {
  console.log('🤖 更新 AI_TASK_CONTEXT.md...');
  
  const sections = [];
  
  // 標題和時間戳
  sections.push('## AI 任務上下文（聊天）\n');
  sections.push(`- 最後更新：${status.timestamp}\n`);
  
  // 當前重點（保留現有的）
  sections.push('### 當前重點');
  if (existing.currentFocus.length > 0) {
    existing.currentFocus.forEach(item => {
      sections.push(`- ${item}`);
    });
  }
  sections.push('');
  
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

// 5. 更新 CHANGELOG.md
function updateChangelog(status, existing) {
  console.log('📜 更新 CHANGELOG.md...');
  
  let content = existing.changelog;
  
  // 如果沒有 Unreleased 區塊，創建一個
  if (!content.includes('## [Unreleased]')) {
    const lines = content.split('\n');
    const headerEnd = lines.findIndex(line => line.startsWith('## ['));
    if (headerEnd > 0) {
      lines.splice(headerEnd, 0, '', '## [Unreleased]', '');
      content = lines.join('\n');
    }
  }
  
  // 從 PROJECT_STATUS 同步 Done 項目到 Unreleased
  if (existing.doneItems.length > 0) {
    const unreleasedMatch = content.match(/## \[Unreleased\]([\s\S]*?)##/);
    if (unreleasedMatch) {
      const existingUnreleased = unreleasedMatch[1];
      const newItems = [];
      
      // 檢查並添加新項目
      existing.doneItems.forEach(item => {
        // 提取日期和內容
        const match = item.match(/^(\d{4}-\d{2}-\d{2})：(.*)$/);
        if (match && !existingUnreleased.includes(match[2])) {
          newItems.push(`- ${match[2]} (${match[1]})`);
        }
      });
      
      if (newItems.length > 0) {
        content = content.replace(
          /## \[Unreleased\]/,
          `## [Unreleased]\n\n### Added\n${newItems.join('\n')}\n`
        );
      }
    }
  }
  
  return content;
}

// 主函數
async function main() {
  console.log('🚀 開始同步所有狀態文檔...\n');
  
  try {
    // 1. 收集狀態
    const status = collectSystemStatus();
    
    // 2. 解析現有文檔
    const existing = parseExistingDocs();
    
    // 3. 更新各文檔
    const updatedProjectStatus = updateProjectStatus(status, existing);
    const updatedAIContext = updateAITaskContext(status, existing);
    const updatedChangelog = updateChangelog(status, existing);
    
    // 4. 寫入文檔
    writeFile(PROJECT_STATUS, updatedProjectStatus);
    writeFile(AI_TASK_CONTEXT, updatedAIContext);
    writeFile(CHANGELOG, updatedChangelog);
    
    console.log('\n✨ 所有文檔已同步更新！');
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

module.exports = { collectSystemStatus, updateProjectStatus, updateAITaskContext, updateChangelog };