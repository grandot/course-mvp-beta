#!/usr/bin/env node

/**
 * 一鍵執行所有測試的主控制器
 * 包含本機測試、Render 測試、LINE Bot 自動化測試
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 測試配置
const CONFIG = {
  LOCAL_URL: 'http://localhost:3000',
  RENDER_URL: process.env.RENDER_URL || 'https://course-mvp-beta.onrender.com',
  RESULTS_DIR: './test-results',
  TIMEOUT: 30000
};

// 確保結果目錄存在
if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
  fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
}

/**
 * 執行命令並捕獲輸出
 */
function runCommand(command, options = {}) {
  console.log(`🔧 執行: ${command}`);
  
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      timeout: CONFIG.TIMEOUT,
      ...options
    });
    
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.stderr || '' 
    };
  }
}

/**
 * 檢查服務可用性
 */
async function checkService(url, name) {
  console.log(`\\n🔍 檢查 ${name} 服務可用性: ${url}`);
  
  try {
    const axios = require('axios');
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    console.log(`✅ ${name} 服務正常 (${response.status})`);
    return true;
  } catch (error) {
    console.log(`❌ ${name} 服務不可用: ${error.message}`);
    return false;
  }
}

/**
 * 執行程式碼品質檢查
 */
async function runQualityChecks() {
  console.log('\\n📋 執行程式碼品質檢查...');
  console.log('='.repeat(50));
  
  const results = {
    lint: null,
    format: null
  };
  
  // ESLint 檢查
  console.log('\\n🔍 執行 ESLint 檢查...');
  results.lint = runCommand('npm run lint');
  
  if (results.lint.success) {
    console.log('✅ ESLint 檢查通過');
  } else {
    console.log('⚠️ ESLint 發現問題，但繼續測試...');
  }
  
  // Prettier 格式檢查
  console.log('\\n🎨 檢查程式碼格式...');
  results.format = runCommand('npx prettier --check src/');
  
  if (results.format.success) {
    console.log('✅ 程式碼格式正確');
  } else {
    console.log('⚠️ 程式碼格式需要調整，但繼續測試...');
  }
  
  return results;
}

/**
 * 執行基礎功能測試
 */
async function runBasicTests() {
  console.log('\\n🧪 執行基礎功能測試...');
  console.log('='.repeat(50));
  
  const results = {
    quickTest: null,
    intentParsing: null,
    slotExtraction: null
  };
  
  // 快速測試
  if (fs.existsSync('./tools/quick-test.js')) {
    console.log('\\n⚡ 執行快速測試...');
    results.quickTest = runCommand('npm run test:quick');
  }
  
  // 意圖識別測試
  console.log('\\n🎯 測試意圖識別...');
  results.intentParsing = runCommand('node tools/send-test-message.js "小明明天下午3點數學課"');
  
  // 實體提取測試  
  console.log('\\n🔍 測試實體提取...');
  results.slotExtraction = runCommand('node tools/send-test-message.js "查詢小明今天的課程"');
  
  return results;
}

/**
 * 執行 LINE Bot 自動化測試
 */
async function runLineBotTests(environment = 'local') {
  console.log(`\\n🤖 執行 LINE Bot 自動化測試 (${environment})...`);
  console.log('='.repeat(50));
  
  const results = {
    basic: null,
    multiTurn: null,
    errorHandling: null
  };
  
  const baseCommand = environment === 'local' 
    ? 'npm run test:line-bot:local' 
    : 'npm run test:line-bot:production';
  
  // 基礎功能測試
  console.log('\\n📌 執行基礎功能測試...');
  results.basic = runCommand(`${baseCommand} -- --basic`);
  
  // 多輪對話測試
  console.log('\\n💬 執行多輪對話測試...');
  results.multiTurn = runCommand(`${baseCommand} -- --multi`);
  
  // 錯誤處理測試
  console.log('\\n🚨 執行錯誤處理測試...');
  results.errorHandling = runCommand(`${baseCommand} -- --error`);
  
  return results;
}

/**
 * 執行 Render 環境特定測試
 */
async function runRenderTests() {
  console.log('\\n☁️ 執行 Render 環境測試...');
  console.log('='.repeat(50));
  
  if (!fs.existsSync('./tools/test-render-deployment.js')) {
    console.log('⚠️ Render 測試工具不存在，跳過...');
    return { skipped: true };
  }
  
  const result = runCommand('node tools/test-render-deployment.js');
  return result;
}

/**
 * 生成測試總結報告
 */
function generateSummaryReport(allResults) {
  const summary = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      localUrl: CONFIG.LOCAL_URL,
      renderUrl: CONFIG.RENDER_URL
    },
    results: allResults,
    statistics: {
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      skippedSuites: 0
    }
  };
  
  // 計算統計資料
  const calculateStats = (results) => {
    Object.values(results).forEach(result => {
      if (typeof result === 'object' && result !== null) {
        if (result.skipped) {
          summary.statistics.skippedSuites++;
        } else if (result.success) {
          summary.statistics.passedSuites++;
        } else {
          summary.statistics.failedSuites++;
        }
        summary.statistics.totalSuites++;
        
        // 遞歸處理巢狀結果
        if (typeof result === 'object' && !result.hasOwnProperty('success')) {
          calculateStats(result);
        }
      }
    });
  };
  
  calculateStats(allResults);
  
  // 計算通過率
  const { totalSuites, passedSuites } = summary.statistics;
  summary.statistics.passRate = totalSuites > 0 
    ? `${(passedSuites / totalSuites * 100).toFixed(1)}%` 
    : '0%';
  
  return summary;
}

/**
 * 主測試流程
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 開始執行完整測試套件');
  console.log(`⏰ 開始時間: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));
  
  const allResults = {
    qualityChecks: null,
    basicTests: null,
    localLineBotTests: null,
    productionLineBotTests: null,
    renderTests: null
  };
  
  try {
    // 1. 程式碼品質檢查
    allResults.qualityChecks = await runQualityChecks();
    
    // 2. 基礎功能測試
    allResults.basicTests = await runBasicTests();
    
    // 3. 檢查本機服務
    const localServiceAvailable = await checkService(CONFIG.LOCAL_URL, '本機');
    
    if (localServiceAvailable) {
      // 4. 本機 LINE Bot 測試
      allResults.localLineBotTests = await runLineBotTests('local');
    } else {
      console.log('⚠️ 本機服務不可用，跳過本機 LINE Bot 測試');
      allResults.localLineBotTests = { skipped: true, reason: '本機服務不可用' };
    }
    
    // 5. 檢查 Render 服務
    const renderServiceAvailable = await checkService(CONFIG.RENDER_URL, 'Render');
    
    if (renderServiceAvailable) {
      // 6. Render 環境測試
      allResults.renderTests = await runRenderTests();
      
      // 7. 生產環境 LINE Bot 測試
      allResults.productionLineBotTests = await runLineBotTests('production');
    } else {
      console.log('⚠️ Render 服務不可用，跳過生產環境測試');
      allResults.renderTests = { skipped: true, reason: 'Render 服務不可用' };
      allResults.productionLineBotTests = { skipped: true, reason: 'Render 服務不可用' };
    }
    
  } catch (error) {
    console.error('❌ 測試執行過程中發生錯誤:', error);
  }
  
  // 生成總結報告
  const summary = generateSummaryReport(allResults);
  const totalTime = Date.now() - startTime;
  
  console.log('\\n📊 測試執行完成');
  console.log('='.repeat(80));
  console.log(`⏱️  總耗時: ${totalTime}ms (${(totalTime/1000).toFixed(1)}秒)`);
  console.log(`📈 測試統計:`);
  console.log(`   總測試套件: ${summary.statistics.totalSuites}`);
  console.log(`   通過: ${summary.statistics.passedSuites}`);
  console.log(`   失敗: ${summary.statistics.failedSuites}`);
  console.log(`   跳過: ${summary.statistics.skippedSuites}`);
  console.log(`   通過率: ${summary.statistics.passRate}`);
  
  // 保存詳細報告
  const reportPath = path.join(CONFIG.RESULTS_DIR, 'full-test-summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\\n📄 完整報告已保存: ${reportPath}`);
  
  // 根據結果決定退出碼
  const hasFailures = summary.statistics.failedSuites > 0;
  if (hasFailures) {
    console.log('\\n❌ 部分測試失敗，請檢查詳細報告');
    process.exit(1);
  } else {
    console.log('\\n✅ 所有測試通過或已跳過');
    process.exit(0);
  }
}

// 處理命令列參數
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('📖 完整測試套件執行工具');
  console.log('');
  console.log('使用方法:');
  console.log('  node tools/run-all-tests.js [options]');
  console.log('');
  console.log('選項:');
  console.log('  --local-only       只執行本機測試');
  console.log('  --production-only  只執行生產環境測試');
  console.log('  --skip-quality     跳過程式碼品質檢查');
  console.log('  --help, -h         顯示此說明');
  console.log('');
  console.log('或使用 npm 指令:');
  console.log('  npm run test:all           # 執行完整測試套件');
  console.log('  npm run test:local-only    # 只測試本機環境');
  console.log('  npm run test:production    # 只測試生產環境');
  process.exit(0);
}

// 根據參數調整測試範圍
if (args.includes('--local-only')) {
  CONFIG.RENDER_URL = null;
}

if (args.includes('--production-only')) {
  CONFIG.LOCAL_URL = null;
}

// 如果直接執行此檔案
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 測試套件執行失敗:', error);
    process.exit(1);
  });
}

module.exports = { main };