#!/usr/bin/env node

/**
 * LINE Bot 自動化測試工具
 * 模擬真實的 LINE 多輪對話，取代手動測試
 * 
 * 功能：
 * - 模擬 LINE Webhook 請求
 * - 測試多輪對話上下文
 * - 測試 Quick Reply 互動
 * - 生成詳細測試報告
 */

require('dotenv').config();

// 🧪 設定測試環境變數
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_LINE_SERVICE = 'true';

console.log('🧪 測試環境初始化：');
console.log('   NODE_ENV =', process.env.NODE_ENV);
console.log('   USE_MOCK_LINE_SERVICE =', process.env.USE_MOCK_LINE_SERVICE);
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 測試目標 URL（本機或 Render）
  TARGET_URL: process.env.TEST_TARGET_URL || 'http://localhost:3000/webhook',
  
  // LINE Bot 配置
  CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  
  // 測試用戶
  TEST_USER_ID: 'U_test_automation_user_12345',
  
  // 測試報告路徑
  REPORT_PATH: './test-results',
  
  // 測試間隔（毫秒）
  TEST_INTERVAL: 1500,
  
  // 超時設定
  TIMEOUT: 10000
};

// 測試結果收集器
class TestResultCollector {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
  }
  
  addResult(testCase, result) {
    this.results.push({
      ...testCase,
      result,
      timestamp: new Date().toISOString()
    });
    
    this.stats.total++;
    this.stats[result.status]++;
  }
  
  generateReport() {
    const duration = Date.now() - this.startTime;
    const passRate = (this.stats.passed / this.stats.total * 100).toFixed(1);
    
    return {
      summary: {
        total: this.stats.total,
        passed: this.stats.passed,
        failed: this.stats.failed,
        skipped: this.stats.skipped,
        passRate: `${passRate}%`,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      results: this.results
    };
  }
  
  saveReport(filename = 'line-bot-test-report.json') {
    if (!fs.existsSync(CONFIG.REPORT_PATH)) {
      fs.mkdirSync(CONFIG.REPORT_PATH, { recursive: true });
    }
    
    const report = this.generateReport();
    const filepath = path.join(CONFIG.REPORT_PATH, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    console.log(`\\n📊 測試報告已保存: ${filepath}`);
    return report;
  }
}

// LINE Webhook 模擬器
class LineWebhookSimulator {
  constructor(targetUrl, channelSecret) {
    this.targetUrl = targetUrl;
    this.channelSecret = channelSecret;
    this.conversationState = new Map(); // 模擬對話狀態
  }
  
  /**
   * 生成 LINE Signature
   */
  generateSignature(body) {
    if (!this.channelSecret) {
      console.warn('⚠️ 未設定 LINE_CHANNEL_SECRET，使用預設值');
      // 使用 .env 中的 LINE_CHANNEL_SECRET
      const defaultSecret = process.env.LINE_CHANNEL_SECRET || '80f460b316f763dbf30e780a73dc2a76';
      return crypto
        .createHmac('SHA256', defaultSecret)
        .update(body)
        .digest('base64');
    }
    
    return crypto
      .createHmac('SHA256', this.channelSecret)
      .update(body)
      .digest('base64');
  }
  
  /**
   * 建立 LINE Webhook 請求格式
   */
  createWebhookRequest(userId, message, replyToken = null) {
    const requestBody = {
      destination: 'test-destination',
      events: [{
        type: 'message',
        mode: 'active',
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: userId
        },
        replyToken: replyToken || `reply_token_${Date.now()}`,
        message: {
          type: 'text',
          id: `msg_${Date.now()}`,
          text: message
        }
      }]
    };
    
    return requestBody;
  }
  
  /**
   * 發送測試訊息
   */
  async sendMessage(userId, message, expectResponse = true) {
    const requestBody = this.createWebhookRequest(userId, message);
    const bodyString = JSON.stringify(requestBody);
    const signature = this.generateSignature(bodyString);
    
    const headers = {
      'Content-Type': 'application/json',
      'x-line-signature': `${signature}`,
      'User-Agent': 'LineBotSdk/1.0 LineBot-Automation-Test'
    };
    
    try {
      console.log(`📤 發送: "${message}"`);
      
      const startTime = Date.now();
      const response = await axios.post(this.targetUrl, requestBody, {
        headers,
        timeout: CONFIG.TIMEOUT
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`📨 狀態: ${response.status} (${responseTime}ms)`);
      
      // 解析回應內容
      let botReply = null;
      let quickReplies = null;
      
      if (response.data && response.data.length > 0) {
        const firstReply = response.data[0];
        if (firstReply.type === 'text') {
          botReply = firstReply.text;
        }
        if (firstReply.quickReply) {
          quickReplies = firstReply.quickReply.items.map(item => item.action.label);
        }
      }
      
      console.log(`💬 回覆: "${botReply || '(無回覆)'}"`);
      if (quickReplies && quickReplies.length > 0) {
        console.log(`🔘 快速回覆: [${quickReplies.join(', ')}]`);
      }
      
      return {
        success: true,
        status: response.status,
        responseTime,
        botReply,
        quickReplies,
        raw: response.data
      };
      
    } catch (error) {
      console.log(`❌ 錯誤: ${error.message}`);
      console.log(`🔍 詳細錯誤:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code
      });
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 'timeout',
        responseTime: Date.now() - (startTime || Date.now()),
        details: error.response?.data
      };
    }
  }
  
  /**
   * 等待指定時間
   */
  async wait(ms = CONFIG.TEST_INTERVAL) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 測試案例定義
const TEST_SUITES = {
  // 基礎功能測試
  basic: [
    {
      id: 'basic_001',
      name: '新增單次課程',
      steps: [
        { message: '小明明天下午3點數學課', expectKeywords: ['確認', '修改'] }
      ]
    },
    {
      id: 'basic_002', 
      name: '新增重複課程',
      steps: [
        { message: '小明每週三下午3點數學課', expectKeywords: ['確認', '修改'] }
      ]
    },
    {
      id: 'basic_003',
      name: '查詢今日課程',
      steps: [
        { message: '小明今天有什麼課？', expectKeywords: ['今天', '課程', '小明'] }
      ]
    }
  ],
  
  // 多輪對話測試
  multiTurn: [
    {
      id: 'multi_001',
      name: '缺失學生名稱補充',
      steps: [
        { 
          message: '明天下午3點數學課', 
          expectKeywords: ['學生', '哪位'] 
        },
        { 
          message: '小明', 
          expectKeywords: ['確認', '小明', '數學課'] 
        }
      ]
    },
    {
      id: 'multi_002',
      name: '缺失課程名稱補充',
      steps: [
        { 
          message: '小明明天下午3點有課', 
          expectKeywords: ['課程', '什麼課'] 
        },
        { 
          message: '英文課', 
          expectKeywords: ['確認', '英文課'] 
        }
      ]
    },
    {
      id: 'multi_003',
      name: 'Quick Reply 確認流程',
      steps: [
        { 
          message: '小明明天下午3點數學課', 
          expectKeywords: ['確認', '修改'], 
          expectQuickReply: true 
        },
        { 
          message: '確認', 
          expectKeywords: ['成功', '已安排'] 
        }
      ]
    },
    {
      id: 'multi_004',
      name: 'Quick Reply 修改流程',
      steps: [
        { 
          message: '小明明天下午3點數學課', 
          expectKeywords: ['確認', '修改'], 
          expectQuickReply: true 
        },
        { 
          message: '修改', 
          expectKeywords: ['修改', '時間', '課程'] 
        },
        {
          message: '改成下午4點',
          expectKeywords: ['確認', '4點', '16:00']
        }
      ]
    }
  ],
  
  // 錯誤處理測試
  errorHandling: [
    {
      id: 'error_001',
      name: '無法識別的意圖',
      steps: [
        { 
          message: '今天天氣如何？', 
          expectKeywords: ['不太理解', '無法識別', '請說'] 
        }
      ]
    },
    {
      id: 'error_002',
      name: '糾錯功能',
      steps: [
        { 
          message: '小明明天下午3點數學課', 
          expectKeywords: ['確認'] 
        },
        { 
          message: '不對，是4點', 
          expectKeywords: ['修改', '4點'] 
        }
      ]
    }
  ],
  
  // 邊界情況測試
  boundary: [
    {
      id: 'boundary_001',
      name: '多學生混淆處理',
      steps: [
        { 
          message: '明天下午3點數學課', 
          expectKeywords: ['學生', '哪位'] 
        },
        { 
          message: '小明和小華都要上', 
          expectKeywords: ['兩個', '都', '分別'] 
        }
      ]
    },
    {
      id: 'boundary_002',
      name: '時間格式多樣性',
      steps: [
        { 
          message: '小明明天 3:30PM 英文課', 
          expectKeywords: ['確認', '15:30', '3:30'] 
        }
      ]
    }
  ]
};

/**
 * 執行單一測試案例
 */
async function runTestCase(simulator, testCase, collector) {
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
      
      const response = await simulator.sendMessage(userId, step.message);
      
      // 驗證回應
      const stepResult = {
        message: step.message,
        response: response.botReply,
        passed: true,
        checks: []
      };
      
      // 檢查關鍵詞
      if (step.expectKeywords && step.expectKeywords.length > 0) {
        const keywordCheck = step.expectKeywords.some(keyword => 
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
      
      // 等待下一步
      if (i < testCase.steps.length - 1) {
        await simulator.wait();
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
  
  collector.addResult(testCase, testResult);
}

/**
 * 執行測試套件
 */
async function runTestSuite(suiteName, tests) {
  console.log(`\\n🎯 開始執行測試套件: ${suiteName}`);
  console.log('='.repeat(60));
  
  const simulator = new LineWebhookSimulator(CONFIG.TARGET_URL, CONFIG.CHANNEL_SECRET);
  const collector = new TestResultCollector();
  
  for (let i = 0; i < tests.length; i++) {
    const testCase = tests[i];
    await runTestCase(simulator, testCase, collector);
    
    // 測試間隔
    if (i < tests.length - 1) {
      console.log(`\\n⏳ 等待 ${CONFIG.TEST_INTERVAL}ms 後繼續...`);
      await simulator.wait();
    }
  }
  
  // 生成報告
  const report = collector.generateReport();
  console.log(`\\n📊 ${suiteName} 測試完成:`);
  console.log(`   總計: ${report.summary.total}`);
  console.log(`   通過: ${report.summary.passed}`);
  console.log(`   失敗: ${report.summary.failed}`);
  console.log(`   通過率: ${report.summary.passRate}`);
  console.log(`   耗時: ${report.summary.duration}`);
  
  return { report, collector };
}

/**
 * 執行所有測試
 */
async function runAllTests() {
  console.log('🚀 LINE Bot 自動化測試開始');
  console.log(`🎯 測試目標: ${CONFIG.TARGET_URL}`);
  console.log(`👤 測試用戶: ${CONFIG.TEST_USER_ID}`);
  console.log('='.repeat(80));
  
  const allResults = {};
  const startTime = Date.now();
  
  // 檢查目標服務是否可用
  try {
    console.log('🔍 檢查目標服務可用性...');
    await axios.get(CONFIG.TARGET_URL.replace('/webhook', '/health'), { timeout: 5000 });
    console.log('✅ 目標服務正常');
  } catch (error) {
    console.log('⚠️ 無法連接到目標服務，但繼續測試...');
  }
  
  // 執行各個測試套件
  for (const [suiteName, tests] of Object.entries(TEST_SUITES)) {
    try {
      const { report, collector } = await runTestSuite(suiteName, tests);
      allResults[suiteName] = report;
      
      // 保存單個套件報告
      collector.saveReport(`${suiteName}-test-report.json`);
      
    } catch (error) {
      console.error(`❌ 測試套件 ${suiteName} 執行失敗:`, error.message);
      allResults[suiteName] = { error: error.message };
    }
  }
  
  // 生成總體報告
  const totalDuration = Date.now() - startTime;
  const summary = {
    timestamp: new Date().toISOString(),
    duration: `${totalDuration}ms`,
    config: {
      targetUrl: CONFIG.TARGET_URL,
      testUserId: CONFIG.TEST_USER_ID
    },
    suites: allResults
  };
  
  // 保存總體報告
  const reportPath = path.join(CONFIG.REPORT_PATH, 'full-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  
  console.log('\\n🎉 所有測試執行完成！');
  console.log(`📊 總體報告: ${reportPath}`);
  console.log(`⏱️  總耗時: ${totalDuration}ms`);
  
  // 輸出測試統計
  let totalTests = 0, totalPassed = 0, totalFailed = 0;
  Object.values(allResults).forEach(suite => {
    if (suite.summary) {
      totalTests += suite.summary.total;
      totalPassed += suite.summary.passed;
      totalFailed += suite.summary.failed;
    }
  });
  
  const overallPassRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0.0';
  
  console.log(`\\n📈 整體統計:`);
  console.log(`   總測試數: ${totalTests}`);
  console.log(`   通過數: ${totalPassed}`);
  console.log(`   失敗數: ${totalFailed}`);
  console.log(`   整體通過率: ${overallPassRate}%`);
  
  return summary;
}

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('📖 LINE Bot 自動化測試工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node tools/test-line-bot-automation.js [options]');
    console.log('');
    console.log('選項:');
    console.log('  --all              執行所有測試套件');
    console.log('  --basic            執行基礎功能測試');
    console.log('  --multi            執行多輪對話測試');
    console.log('  --error            執行錯誤處理測試');
    console.log('  --boundary         執行邊界情況測試');
    console.log('  --url <url>        指定測試目標 URL');
    console.log('  --user <id>        指定測試用戶 ID');
    console.log('  --interval <ms>    設定測試間隔（毫秒）');
    console.log('  --help, -h         顯示此說明');
    console.log('');
    console.log('範例:');
    console.log('  npm run test:line-bot                    # 執行所有測試');
    console.log('  npm run test:line-bot -- --basic         # 只執行基礎測試');
    console.log('  npm run test:line-bot -- --url http://localhost:3000/webhook');
    return;
  }
  
  // 處理參數
  if (args.includes('--url')) {
    const urlIndex = args.indexOf('--url');
    CONFIG.TARGET_URL = args[urlIndex + 1];
  }
  
  if (args.includes('--user')) {
    const userIndex = args.indexOf('--user');
    CONFIG.TEST_USER_ID = args[userIndex + 1];
  }
  
  if (args.includes('--interval')) {
    const intervalIndex = args.indexOf('--interval');
    CONFIG.TEST_INTERVAL = parseInt(args[intervalIndex + 1]) || CONFIG.TEST_INTERVAL;
  }
  
  // 執行對應的測試套件
  if (args.includes('--basic')) {
    await runTestSuite('basic', TEST_SUITES.basic);
  } else if (args.includes('--multi')) {
    await runTestSuite('multiTurn', TEST_SUITES.multiTurn);
  } else if (args.includes('--error')) {
    await runTestSuite('errorHandling', TEST_SUITES.errorHandling);
  } else if (args.includes('--boundary')) {
    await runTestSuite('boundary', TEST_SUITES.boundary);
  } else {
    // 預設執行所有測試
    await runAllTests();
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  });
}

module.exports = {
  LineWebhookSimulator,
  TestResultCollector,
  runTestSuite,
  runAllTests
};