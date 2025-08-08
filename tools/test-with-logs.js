#!/usr/bin/env node

/**
 * 整合 Render 日誌的 LINE Bot 測試工具
 * 在執行測試的同時獲取和分析 Render 應用程式日誌
 */

require('dotenv').config();

// 🧪 設定測試環境變數
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_LINE_SERVICE = 'true';

console.log('🧪 整合日誌測試環境初始化：');
console.log('   NODE_ENV =', process.env.NODE_ENV);
console.log('   USE_MOCK_LINE_SERVICE =', process.env.USE_MOCK_LINE_SERVICE);
const { LineWebhookSimulator, runTestSuite } = require('./test-line-bot-automation');
const { getRenderLogs, getTestPeriodLogs, analyzeLogs } = require('./get-render-logs');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  TARGET_URL: process.env.TEST_TARGET_URL || 'http://localhost:3000/webhook',  // 改為本地測試
  TEST_USER_ID: 'U_test_with_logs_12345',
  RESULTS_DIR: './test-results/test-with-logs',
  LOG_ANALYSIS_ENABLED: true
};

// 確保結果目錄存在
if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
  fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
}

/**
 * 整合日誌的測試結果收集器
 */
class TestWithLogsCollector {
  constructor() {
    this.testStartTime = null;
    this.testEndTime = null;
    this.testResults = [];
    this.renderLogs = null;
    this.logAnalysis = null;
  }

  startTest() {
    this.testStartTime = new Date();
    console.log(`🚀 測試開始: ${this.testStartTime.toISOString()}`);
  }

  endTest() {
    this.testEndTime = new Date();
    const duration = this.testEndTime - this.testStartTime;
    console.log(`🏁 測試結束: ${this.testEndTime.toISOString()}`);
    console.log(`⏱️  測試總時長: ${duration}ms (${(duration/1000).toFixed(1)}秒)`);
  }

  addTestResult(testCase, result) {
    this.testResults.push({
      ...testCase,
      result,
      timestamp: new Date().toISOString()
    });
  }

  async fetchRenderLogs() {
    console.log('\\n📜 獲取測試期間的 Render 日誌...');
    
    try {
      this.renderLogs = await getTestPeriodLogs(
        this.testStartTime, 
        this.testEndTime
      );

      if (this.renderLogs.success) {
        console.log(`✅ 成功獲取 ${this.renderLogs.logCount} 條日誌`);
        
        // 分析日誌
        if (CONFIG.LOG_ANALYSIS_ENABLED) {
          console.log('🔍 分析日誌內容...');
          this.logAnalysis = analyzeLogs(this.renderLogs.logs);
        }
      } else {
        console.log(`❌ 獲取日誌失敗: ${this.renderLogs.error}`);
      }

    } catch (error) {
      console.error('❌ 獲取日誌過程出錯:', error.message);
      this.renderLogs = { success: false, error: error.message };
    }
  }

  generateReport() {
    const report = {
      meta: {
        timestamp: new Date().toISOString(),
        testStartTime: this.testStartTime?.toISOString(),
        testEndTime: this.testEndTime?.toISOString(),
        duration: this.testEndTime ? this.testEndTime - this.testStartTime : null,
        targetUrl: CONFIG.TARGET_URL
      },
      testResults: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.result.status === 'passed').length,
        failed: this.testResults.filter(r => r.result.status === 'failed').length,
        details: this.testResults
      },
      renderLogs: {
        success: this.renderLogs?.success || false,
        logCount: this.renderLogs?.logCount || 0,
        error: this.renderLogs?.error || null
      },
      logAnalysis: this.logAnalysis,
      correlation: this.correlateTestsWithLogs()
    };

    return report;
  }

  /**
   * 關聯測試結果與日誌
   */
  correlateTestsWithLogs() {
    if (!this.renderLogs?.success || !this.logAnalysis) {
      return { available: false };
    }

    const correlations = [];

    this.testResults.forEach(testResult => {
      const testTime = new Date(testResult.timestamp);
      
      // 找出測試時間前後 30 秒內的錯誤日誌
      const relatedErrors = this.logAnalysis.errors.filter(error => {
        // 這裡簡化處理，實際可以根據日誌時間戳進行精確匹配
        return error.content.toLowerCase().includes('error') || 
               error.content.toLowerCase().includes('failed');
      });

      // 找出相關的 HTTP 請求日誌
      const relatedRequests = this.logAnalysis.requests.filter(request => {
        return request.content.includes('webhook') || 
               request.content.includes('POST');
      });

      if (relatedErrors.length > 0 || relatedRequests.length > 0) {
        correlations.push({
          testId: testResult.id,
          testName: testResult.name,
          testStatus: testResult.result.status,
          relatedErrors: relatedErrors.slice(0, 3), // 最多 3 條錯誤
          relatedRequests: relatedRequests.slice(0, 2) // 最多 2 條請求
        });
      }
    });

    return {
      available: true,
      correlations,
      summary: {
        testsWithErrors: correlations.length,
        totalErrors: this.logAnalysis.errors.length,
        totalWarnings: this.logAnalysis.warnings.length,
        slowRequests: this.logAnalysis.performance.slowRequests.length
      }
    };
  }

  saveReport() {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-with-logs-${timestamp}.json`;
    const filepath = path.join(CONFIG.RESULTS_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\\n📊 測試報告已保存: ${filepath}`);
    
    return { report, filepath };
  }
}

/**
 * 執行帶日誌分析的測試案例
 */
async function runTestCaseWithLogs(simulator, testCase, collector) {
  console.log(`\\n🧪 執行測試: ${testCase.name} (${testCase.id})`);
  console.log('─'.repeat(50));
  
  const userId = `${CONFIG.TEST_USER_ID}_${testCase.id}`;
  let testResult = {
    status: 'passed',
    steps: [],
    errors: []
  };

  try {
    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      console.log(`\\n📍 步驟 ${i + 1}/${testCase.steps.length}`);
      
      const stepStartTime = Date.now();
      const response = await simulator.sendMessage(userId, step.message);
      const stepDuration = Date.now() - stepStartTime;

      // 驗證回應
      const stepResult = {
        message: step.message,
        response: response.botReply,
        duration: stepDuration,
        passed: true,
        checks: []
      };

      // 檢查關鍵詞
      if (step.expectKeywords && step.expectKeywords.length > 0) {
        const keywordCheck = step.expectKeywords.every(keyword => 
          response.botReply && response.botReply.includes(keyword)
        );
        stepResult.checks.push({
          type: 'keywords',
          expected: step.expectKeywords,
          passed: keywordCheck
        });
        if (!keywordCheck) stepResult.passed = false;
      }

      // 檢查 Quick Reply
      if (step.expectQuickReply) {
        const quickReplyCheck = response.quickReplies && response.quickReplies.length > 0;
        stepResult.checks.push({
          type: 'quickReply',
          expected: true,
          actual: quickReplyCheck,
          passed: quickReplyCheck
        });
        if (!quickReplyCheck) stepResult.passed = false;
      }

      testResult.steps.push(stepResult);

      if (!stepResult.passed) {
        testResult.status = 'failed';
        testResult.errors.push(`步驟 ${i + 1} 驗證失敗`);
      }

      // 記錄慢回應
      if (stepDuration > 3000) {
        console.log(`⚠️ 慢回應: ${stepDuration}ms`);
      }

      // 等待下一步
      if (i < testCase.steps.length - 1) {
        await simulator.wait(1500); // 稍微增加間隔
      }
    }

  } catch (error) {
    testResult.status = 'failed';
    testResult.errors.push(`執行錯誤: ${error.message}`);
    console.log(`❌ 測試失敗: ${error.message}`);
  }

  // 輸出結果
  const statusIcon = testResult.status === 'passed' ? '✅' : '❌';
  console.log(`${statusIcon} 測試結果: ${testResult.status.toUpperCase()}`);

  if (testResult.errors.length > 0) {
    console.log('🔍 錯誤詳情:');
    testResult.errors.forEach(error => console.log(`   - ${error}`));
  }

  collector.addTestResult(testCase, testResult);
}

/**
 * 執行帶日誌的測試套件
 */
async function runTestSuiteWithLogs(suiteName, tests) {
  console.log(`\\n🎯 開始執行帶日誌的測試套件: ${suiteName}`);
  console.log('='.repeat(60));

  const collector = new TestWithLogsCollector();
  const simulator = new LineWebhookSimulator(CONFIG.TARGET_URL);

  // 開始測試
  collector.startTest();

  try {
    // 執行所有測試案例
    for (let i = 0; i < tests.length; i++) {
      const testCase = tests[i];
      await runTestCaseWithLogs(simulator, testCase, collector);

      // 測試間隔
      if (i < tests.length - 1) {
        console.log(`\\n⏳ 等待 2 秒後繼續...`);
        await simulator.wait(2000);
      }
    }

  } finally {
    // 結束測試
    collector.endTest();

    // 獲取測試期間的日誌
    await collector.fetchRenderLogs();

    // 生成並保存報告
    const { report, filepath } = collector.saveReport();

    // 輸出總結
    console.log(`\\n📊 ${suiteName} 測試總結:`);
    console.log(`   測試案例: ${report.testResults.total}`);
    console.log(`   通過: ${report.testResults.passed}`);
    console.log(`   失敗: ${report.testResults.failed}`);
    console.log(`   Render 日誌: ${report.renderLogs.logCount} 條`);
    
    if (report.logAnalysis) {
      console.log(`   日誌錯誤: ${report.logAnalysis.errors.length} 條`);
      console.log(`   日誌警告: ${report.logAnalysis.warnings.length} 條`);
      console.log(`   慢請求: ${report.logAnalysis.performance.slowRequests.length} 條`);
    }

    if (report.correlation.available) {
      console.log(`   測試與日誌關聯: ${report.correlation.correlations.length} 個`);
    }

    return report;
  }
}

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('📖 整合 Render 日誌的 LINE Bot 測試工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node tools/test-with-logs.js [options]');
    console.log('');
    console.log('選項:');
    console.log('  --basic            執行基礎功能測試');
    console.log('  --multi            執行多輪對話測試');
    console.log('  --error            執行錯誤處理測試');
    console.log('  --url <url>        指定測試目標 URL');
    console.log('  --no-log-analysis  停用日誌分析');
    console.log('  --help, -h         顯示此說明');
    console.log('');
    console.log('範例:');
    console.log('  npm run test:with-logs -- --multi     # 執行多輪對話測試並分析日誌');
    console.log('  npm run test:with-logs -- --basic     # 執行基礎測試並分析日誌');
    return;
  }

  // 處理參數
  if (args.includes('--url')) {
    const urlIndex = args.indexOf('--url');
    CONFIG.TARGET_URL = args[urlIndex + 1];
  }

  if (args.includes('--no-log-analysis')) {
    CONFIG.LOG_ANALYSIS_ENABLED = false;
  }

  console.log('🚀 整合日誌的 LINE Bot 測試開始');
  console.log(`🎯 測試目標: ${CONFIG.TARGET_URL}`);
  console.log(`📜 日誌分析: ${CONFIG.LOG_ANALYSIS_ENABLED ? '啟用' : '停用'}`);
  console.log('='.repeat(80));

  // 簡化的測試套件
  const TEST_SUITES = {
    basic: [
      {
        id: 'log_basic_001',
        name: '新增課程測試',
        steps: [
          { message: '小明明天下午3點數學課', expectKeywords: ['確認', '修改'] }
        ]
      }
    ],
    multi: [
      {
        id: 'log_multi_001',
        name: '多輪對話測試',
        steps: [
          { message: '明天下午3點有課', expectKeywords: ['學生', '哪位'] },
          { message: '小明', expectKeywords: ['確認', '小明'] }
        ]
      }
    ],
    error: [
      {
        id: 'log_error_001',
        name: '錯誤處理測試',
        steps: [
          { message: '今天天氣如何？', expectKeywords: ['不太理解', '無法識別'] }
        ]
      }
    ]
  };

  try {
    let report;

    if (args.includes('--basic')) {
      report = await runTestSuiteWithLogs('basic', TEST_SUITES.basic);
    } else if (args.includes('--multi')) {
      report = await runTestSuiteWithLogs('multi', TEST_SUITES.multi);
    } else if (args.includes('--error')) {
      report = await runTestSuiteWithLogs('error', TEST_SUITES.error);
    } else {
      // 預設執行基礎測試
      report = await runTestSuiteWithLogs('basic', TEST_SUITES.basic);
    }

    // 根據結果決定退出碼
    if (report.testResults.failed > 0) {
      console.log('\\n❌ 部分測試失敗');
      process.exit(1);
    } else {
      console.log('\\n✅ 所有測試通過');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 測試執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main();
}

module.exports = {
  runTestSuiteWithLogs,
  TestWithLogsCollector
};