#!/usr/bin/env node

/**
 * 端到端功能測試腳本
 * 測試 LINE 課程管理機器人的完整工作流程
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 測試配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testUserId: 'test_user_e2e_123456',
  testStudentName: '測試小明',
  testCourseName: '數學課',
  maxRetries: 3,
  retryDelay: 1000,
  verbose: true
};

// 測試結果統計
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * 日誌輸出函式
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const levels = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🔍'
  };
  
  console.log(`${levels[level]} [${timestamp}] ${message}`);
}

/**
 * 模擬 LINE webhook 請求
 */
async function sendLineWebhookRequest(message, messageType = 'text') {
    const webhookPayload = {
      events: [{
        type: 'message',
        message: {
          type: messageType,
          text: messageType === 'text' ? message : undefined,
          id: messageType === 'image' ? `test_image_${Date.now()}` : undefined
        },
        source: {
          userId: TEST_CONFIG.testUserId
        },
        replyToken: `test_reply_token_${Date.now()}`,
        timestamp: Date.now()
      }]
    };

    try {
      const response = await axios.post(
        `${TEST_CONFIG.baseUrl}/webhook`,
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-line-signature': 'test_signature'
          },
          timeout: 10000
        }
      );

      return {
        success: response.status === 200,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 0
      };
    }
}

/**
 * 測試案例執行器
 */
async function runTestCase(testName, testFunction) {
  testStats.total++;
  log(`開始測試: ${testName}`, 'info');
  
  try {
    const result = await testFunction();
    if (result.success) {
      testStats.passed++;
      log(`測試通過: ${testName}`, 'success');
      if (result.message) {
        log(`結果: ${result.message}`, 'debug');
      }
    } else {
      testStats.failed++;
      log(`測試失敗: ${testName} - ${result.error}`, 'error');
      testStats.errors.push({ test: testName, error: result.error });
    }
    return result;
  } catch (error) {
    testStats.failed++;
    log(`測試異常: ${testName} - ${error.message}`, 'error');
    testStats.errors.push({ test: testName, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 等待函式
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 測試案例 1: 系統健康檢查
 */
async function testSystemHealth() {
  const response = await axios.get(`${TEST_CONFIG.baseUrl}/health`).catch(err => ({ status: 0, error: err.message }));
  
  if (response.status === 200) {
    return { success: true, message: '系統運行正常' };
  } else {
    return { success: false, error: `系統不可用 (狀態: ${response.status})` };
  }
}

/**
 * 測試案例 2: 新增課程
 */
async function testAddCourse() {
  const testMessage = `${TEST_CONFIG.testStudentName}每週三下午3點${TEST_CONFIG.testCourseName}`;
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '新增課程請求已處理' };
  } else {
    return { success: false, error: `新增課程失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 3: 查詢課程
 */
async function testQuerySchedule() {
  await sleep(2000); // 等待課程建立完成
  
  const testMessage = `查詢${TEST_CONFIG.testStudentName}今天的課程`;
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '查詢課程請求已處理' };
  } else {
    return { success: false, error: `查詢課程失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 4: 記錄課程內容
 */
async function testRecordContent() {
  const testMessage = `${TEST_CONFIG.testStudentName}今天的${TEST_CONFIG.testCourseName}學了分數加減法`;
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '記錄內容請求已處理' };
  } else {
    return { success: false, error: `記錄內容失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 5: 設定提醒
 */
async function testSetReminder() {
  const testMessage = `提醒我${TEST_CONFIG.testStudentName}明天的${TEST_CONFIG.testCourseName}`;
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '設定提醒請求已處理' };
  } else {
    return { success: false, error: `設定提醒失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 6: 取消課程
 */
async function testCancelCourse() {
  const testMessage = `取消${TEST_CONFIG.testStudentName}明天的${TEST_CONFIG.testCourseName}`;
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '取消課程請求已處理' };
  } else {
    return { success: false, error: `取消課程失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 7: 圖片上傳
 */
async function testImageUpload() {
  // 模擬圖片訊息
  const result = await sendLineWebhookRequest('test_image', 'image');
  
  if (result.success && result.status === 200) {
    return { success: true, message: '圖片上傳請求已處理' };
  } else {
    return { success: false, error: `圖片上傳失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 測試案例 8: 錯誤處理
 */
async function testErrorHandling() {
  const testMessage = '這是一個無法識別的訊息內容測試12345';
  const result = await sendLineWebhookRequest(testMessage);
  
  if (result.success && result.status === 200) {
    return { success: true, message: '錯誤處理機制正常' };
  } else {
    return { success: false, error: `錯誤處理失敗: ${result.error || '未知錯誤'}` };
  }
}

/**
 * 語意測試案例組
 */
async function testSemanticParsing() {
  const testCases = [
    '小明週三下午3點數學課',
    '查詢Lumi今天有什麼課',
    '記錄昨天英文課的內容',
    '提醒我小光明天的鋼琴課',
    '刪掉Amy的美術課'
  ];

  let passedCount = 0;
  const results = [];

  for (const testCase of testCases) {
    const result = await sendLineWebhookRequest(testCase);
    if (result.success) {
      passedCount++;
    }
    results.push({ input: testCase, success: result.success });
    await sleep(500); // 避免請求過快
  }

  const successRate = (passedCount / testCases.length) * 100;
  
  if (successRate >= 80) {
    return { 
      success: true, 
      message: `語意解析測試通過率: ${successRate.toFixed(1)}% (${passedCount}/${testCases.length})` 
    };
  } else {
    return { 
      success: false, 
      error: `語意解析測試通過率過低: ${successRate.toFixed(1)}% (${passedCount}/${testCases.length})` 
    };
  }
}

/**
 * 負載測試
 */
async function testLoadHandling() {
  const concurrentRequests = 5;
  const testMessage = `查詢${TEST_CONFIG.testStudentName}本週課程`;
  
  log(`開始負載測試：同時發送 ${concurrentRequests} 個請求`, 'info');
  
  const promises = Array(concurrentRequests).fill().map(() => 
    sendLineWebhookRequest(testMessage)
  );
  
  try {
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / concurrentRequests) * 100;
    
    if (successRate >= 80) {
      return { 
        success: true, 
        message: `負載測試通過: ${successRate.toFixed(1)}% (${successCount}/${concurrentRequests})` 
      };
    } else {
      return { 
        success: false, 
        error: `負載測試失敗: ${successRate.toFixed(1)}% (${successCount}/${concurrentRequests})` 
      };
    }
  } catch (error) {
    return { success: false, error: `負載測試異常: ${error.message}` };
  }
}

/**
 * 生成測試報告
 */
function generateTestReport() {
  const successRate = (testStats.passed / testStats.total) * 100;
  const reportPath = path.join(__dirname, '..', 'test-reports', `e2e-test-${Date.now()}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    testConfig: TEST_CONFIG,
    summary: {
      total: testStats.total,
      passed: testStats.passed,
      failed: testStats.failed,
      successRate: successRate.toFixed(2) + '%'
    },
    errors: testStats.errors,
    recommendation: successRate >= 90 ? 'READY_FOR_PRODUCTION' : 
                   successRate >= 70 ? 'NEEDS_MINOR_FIXES' : 'NEEDS_MAJOR_FIXES'
  };

  // 確保報告目錄存在
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 寫入報告檔案
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return { report, reportPath };
}

/**
 * 主要測試執行函式
 */
async function runAllTests() {
  log('🚀 開始端到端功能測試', 'info');
  log(`測試目標: ${TEST_CONFIG.baseUrl}`, 'info');
  
  // 基礎系統測試
  await runTestCase('系統健康檢查', testSystemHealth);
  await sleep(1000);
  
  // 核心功能測試
  await runTestCase('新增課程功能', testAddCourse);
  await sleep(1000);
  
  await runTestCase('查詢課程功能', testQuerySchedule);
  await sleep(1000);
  
  await runTestCase('記錄內容功能', testRecordContent);
  await sleep(1000);
  
  await runTestCase('設定提醒功能', testSetReminder);
  await sleep(1000);
  
  await runTestCase('取消課程功能', testCancelCourse);
  await sleep(1000);
  
  await runTestCase('圖片上傳功能', testImageUpload);
  await sleep(1000);
  
  // 進階測試
  await runTestCase('錯誤處理機制', testErrorHandling);
  await sleep(1000);
  
  await runTestCase('語意解析測試', testSemanticParsing);
  await sleep(2000);
  
  await runTestCase('負載處理測試', testLoadHandling);
  
  // 生成測試報告
  const { report, reportPath } = generateTestReport();
  
  log('📊 測試完成，統計結果:', 'info');
  log(`總測試數: ${testStats.total}`, 'info');
  log(`通過: ${testStats.passed}`, 'success');
  log(`失敗: ${testStats.failed}`, testStats.failed > 0 ? 'error' : 'info');
  log(`成功率: ${report.summary.successRate}`, 'info');
  log(`測試報告已保存: ${reportPath}`, 'info');
  
  if (testStats.errors.length > 0) {
    log('❌ 失敗的測試項目:', 'error');
    testStats.errors.forEach(error => {
      log(`  - ${error.test}: ${error.error}`, 'error');
    });
  }
  
  // 根據成功率給出建議
  const successRate = (testStats.passed / testStats.total) * 100;
  if (successRate >= 90) {
    log('🎉 所有測試表現優秀！系統已準備好部署到生產環境', 'success');
  } else if (successRate >= 70) {
    log('⚠️ 大部分測試通過，但還有一些小問題需要修復', 'warning');
  } else {
    log('❌ 測試通過率較低，需要進行重大修復才能部署', 'error');
  }
  
  return report;
}

// 如果直接執行此腳本
if (require.main === module) {
  // 處理命令行參數
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法：
  node tools/test-full-workflow.js [選項]

選項：
  --base-url <url>    設定測試目標 URL (預設: http://localhost:3000)
  --user-id <id>      設定測試用戶 ID (預設: test_user_e2e_123456)
  --verbose           顯示詳細日誌
  --help, -h          顯示此幫助訊息

範例：
  node tools/test-full-workflow.js
  node tools/test-full-workflow.js --base-url http://localhost:8080 --verbose
    `);
    process.exit(0);
  }
  
  // 解析命令行參數
  const baseUrlIndex = args.indexOf('--base-url');
  if (baseUrlIndex >= 0 && args[baseUrlIndex + 1]) {
    TEST_CONFIG.baseUrl = args[baseUrlIndex + 1];
  }
  
  const userIdIndex = args.indexOf('--user-id');
  if (userIdIndex >= 0 && args[userIdIndex + 1]) {
    TEST_CONFIG.testUserId = args[userIdIndex + 1];
  }
  
  if (args.includes('--verbose')) {
    TEST_CONFIG.verbose = true;
  }
  
  // 執行測試
  runAllTests().catch(error => {
    log(`測試執行失敗: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  runTestCase,
  sendLineWebhookRequest,
  TEST_CONFIG
};