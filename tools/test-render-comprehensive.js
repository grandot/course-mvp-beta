/**
 * Render 服務全面測試工具
 * 測試部署在 Render 上的各種對話情境
 */

const https = require('https');
const crypto = require('crypto');

// Render 服務 URL
const RENDER_BASE_URL = 'https://course-mvp-beta.onrender.com';

// 測試配置
const TEST_CONFIG = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'test-secret',
  testUsers: [
    'U_test_render_user_1',
    'U_test_render_user_2',
    'U_test_render_comprehensive'
  ]
};

/**
 * 創建 LINE webhook 簽名
 */
function createLineSignature(body, channelSecret) {
  return crypto
    .createHmac('SHA256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');
}

/**
 * 發送 HTTP 請求
 */
function sendRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData,
            rawData: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData,
            rawData: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 模擬 LINE 文字訊息事件
 */
function createTextMessageEvent(userId, text, replyToken = null) {
  const messageEvent = {
    events: [{
      type: 'message',
      message: {
        type: 'text',
        text: text
      },
      source: {
        userId: userId,
        type: 'user'
      },
      replyToken: replyToken || `test-reply-token-${Date.now()}`,
      timestamp: Date.now()
    }]
  };

  return messageEvent;
}

/**
 * 發送 Webhook 請求到 Render
 */
async function sendWebhookToRender(userId, message, replyToken = null) {
  console.log(`🔄 發送訊息到 Render: "${message}"`);
  
  const event = createTextMessageEvent(userId, message, replyToken);
  const body = JSON.stringify(event);
  
  // 創建 LINE 簽名
  const signature = createLineSignature(body, TEST_CONFIG.channelSecret);
  
  const headers = {
    'X-Line-Signature': signature,
    'Content-Type': 'application/json'
  };

  try {
    const response = await sendRequest(
      `${RENDER_BASE_URL}/webhook`,
      'POST',
      event,
      headers
    );

    console.log(`📊 Render 回應:`, {
      status: response.statusCode,
      success: response.statusCode === 200
    });

    if (response.statusCode !== 200) {
      console.log(`❌ 錯誤回應:`, response.data);
    }

    return response;

  } catch (error) {
    console.error(`❌ 請求失敗:`, error.message);
    return { statusCode: 500, error: error.message };
  }
}

/**
 * 測試基礎 Webhook 功能
 */
async function testBasicWebhook() {
  console.log('\n🚀 測試 Render Webhook 基礎功能');
  console.log('='.repeat(50));

  const testCases = [
    {
      name: '簡單問候',
      message: '你好',
      userId: TEST_CONFIG.testUsers[0]
    },
    {
      name: '課程新增',
      message: '小明明天下午2點數學課',
      userId: TEST_CONFIG.testUsers[0]
    },
    {
      name: '課程查詢',
      message: '查詢小明課程',
      userId: TEST_CONFIG.testUsers[0]
    },
    {
      name: '未知意圖',
      message: '隨機無意義文字 xyz123',
      userId: TEST_CONFIG.testUsers[0]
    }
  ];

  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n📝 測試: ${testCase.name}`);
    console.log(`💬 訊息: "${testCase.message}"`);
    
    try {
      const response = await sendWebhookToRender(
        testCase.userId, 
        testCase.message
      );
      
      const success = response.statusCode === 200;
      results.push({
        ...testCase,
        success,
        statusCode: response.statusCode,
        response: response.data
      });

      console.log(`${success ? '✅' : '❌'} ${testCase.name}: ${success ? 'PASS' : 'FAIL'}`);
      
      // 短暫延遲避免請求過快
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
      results.push({
        ...testCase,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試多輪對話上下文記憶
 */
async function testMultiTurnDialogue() {
  console.log('\n🔄 測試 Render 多輪對話上下文記憶');
  console.log('='.repeat(50));

  const userId = TEST_CONFIG.testUsers[1];
  
  const conversationFlow = [
    {
      step: 1,
      message: '小美每週三下午3點鋼琴課',
      expected: '新增課程成功'
    },
    {
      step: 2, 
      message: '確認',
      expected: '確認操作，應該記得上一輪的課程資訊'
    },
    {
      step: 3,
      message: '查詢課程',
      expected: '應該查詢到小美的課程'
    },
    {
      step: 4,
      message: '設定提醒',
      expected: '應該自動推斷小美的鋼琴課'
    }
  ];

  const results = [];
  
  console.log(`👤 測試用戶: ${userId}`);
  
  for (const step of conversationFlow) {
    console.log(`\n📝 第${step.step}輪: "${step.message}"`);
    console.log(`🎯 期望: ${step.expected}`);
    
    try {
      const response = await sendWebhookToRender(userId, step.message);
      
      const success = response.statusCode === 200;
      results.push({
        ...step,
        success,
        response: response.data
      });

      console.log(`${success ? '✅' : '❌'} 第${step.step}輪: ${success ? 'PASS' : 'FAIL'}`);
      
      // 多輪對話間需要適當間隔
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log(`❌ 第${step.step}輪: ERROR - ${error.message}`);
      results.push({
        ...step,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試 Quick Reply 按鈕互動
 */
async function testQuickReplyButtons() {
  console.log('\n📱 測試 Render Quick Reply 按鈕互動');
  console.log('='.repeat(50));

  const userId = TEST_CONFIG.testUsers[2];
  
  // 先發送一個會產生 Quick Reply 的訊息
  console.log('📝 步驟1: 發送新增課程請求（應產生 Quick Reply 按鈕）');
  const step1Response = await sendWebhookToRender(
    userId, 
    'Lumi每週五下午4點英文課'
  );

  console.log('📊 步驟1 結果:', {
    success: step1Response.statusCode === 200,
    status: step1Response.statusCode
  });

  // 短暫延遲
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 模擬點擊 Quick Reply 按鈕
  const quickReplyTests = [
    { button: '確認', expected: '確認課程安排' },
    { button: '修改', expected: '進入修改流程' },
    { button: '取消操作', expected: '取消當前操作' }
  ];

  const results = [];

  for (const test of quickReplyTests) {
    console.log(`\n🖱️  模擬點擊: ${test.button}`);
    
    try {
      const response = await sendWebhookToRender(userId, test.button);
      
      const success = response.statusCode === 200;
      results.push({
        button: test.button,
        success,
        response: response.data
      });

      console.log(`${success ? '✅' : '❌'} 按鈕"${test.button}": ${success ? 'PASS' : 'FAIL'}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ 按鈕"${test.button}": ERROR - ${error.message}`);
      results.push({
        button: test.button,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試錯誤處理與恢復
 */
async function testErrorHandlingAndRecovery() {
  console.log('\n⚠️ 測試 Render 錯誤處理與恢復');
  console.log('='.repeat(50));

  const testCases = [
    {
      name: '無效簽名',
      test: async () => {
        const event = createTextMessageEvent(TEST_CONFIG.testUsers[0], '測試無效簽名');
        const response = await sendRequest(
          `${RENDER_BASE_URL}/webhook`,
          'POST',
          event,
          { 'X-Line-Signature': 'invalid-signature' }
        );
        return response;
      },
      expectedStatus: 400
    },
    {
      name: '缺少簽名',
      test: async () => {
        const event = createTextMessageEvent(TEST_CONFIG.testUsers[0], '測試缺少簽名');
        const response = await sendRequest(
          `${RENDER_BASE_URL}/webhook`,
          'POST',
          event
        );
        return response;
      },
      expectedStatus: 400
    },
    {
      name: '無效 JSON',
      test: async () => {
        const response = await sendRequest(
          `${RENDER_BASE_URL}/webhook`,
          'POST',
          null,
          {
            'X-Line-Signature': 'test-sig',
            'Content-Type': 'application/json'
          }
        );
        return response;
      },
      expectedStatus: [400, 500] // 可能是 400 或 500
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🧪 測試: ${testCase.name}`);
    
    try {
      const response = await testCase.test();
      const expectedStatuses = Array.isArray(testCase.expectedStatus) 
        ? testCase.expectedStatus 
        : [testCase.expectedStatus];
      
      const isExpectedStatus = expectedStatuses.includes(response.statusCode);
      
      results.push({
        name: testCase.name,
        success: isExpectedStatus,
        actualStatus: response.statusCode,
        expectedStatus: testCase.expectedStatus
      });

      console.log(`${isExpectedStatus ? '✅' : '❌'} ${testCase.name}: ${isExpectedStatus ? 'PASS' : 'FAIL'} (Status: ${response.statusCode})`);
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
      results.push({
        name: testCase.name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試服務健康狀態
 */
async function testServiceHealth() {
  console.log('\n💊 測試 Render 服務健康狀態');
  console.log('='.repeat(50));

  const healthEndpoints = [
    { name: '基礎健康檢查', path: '/health' },
    { name: '依賴服務檢查', path: '/health/deps' },
    { name: '配置檢查', path: '/debug/config' }
  ];

  const results = [];

  for (const endpoint of healthEndpoints) {
    console.log(`\n🔍 檢查: ${endpoint.name}`);
    
    try {
      const response = await sendRequest(`${RENDER_BASE_URL}${endpoint.path}`);
      
      const success = response.statusCode === 200;
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        success,
        status: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} ${endpoint.name}: ${success ? 'PASS' : 'FAIL'}`);
      
      if (success && response.data) {
        console.log('📊 回應數據:', JSON.stringify(response.data, null, 2));
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
      results.push({
        name: endpoint.name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 主測試函數
 */
async function runComprehensiveRenderTests() {
  console.log('🚀 開始 Render 服務全面測試');
  console.log('🌐 目標服務:', RENDER_BASE_URL);
  console.log('🕐 時間:', new Date().toLocaleString());
  console.log('='.repeat(60));

  const allResults = {
    serviceHealth: [],
    basicWebhook: [],
    multiTurnDialogue: [],
    quickReplyButtons: [],
    errorHandlingAndRecovery: []
  };

  try {
    // 1. 服務健康狀態檢查
    allResults.serviceHealth = await testServiceHealth();

    // 2. 基礎 Webhook 功能測試
    allResults.basicWebhook = await testBasicWebhook();

    // 3. 多輪對話測試
    allResults.multiTurnDialogue = await testMultiTurnDialogue();

    // 4. Quick Reply 按鈕測試
    allResults.quickReplyButtons = await testQuickReplyButtons();

    // 5. 錯誤處理測試
    allResults.errorHandlingAndRecovery = await testErrorHandlingAndRecovery();

  } catch (error) {
    console.error('❌ 測試過程發生嚴重錯誤:', error);
  }

  // 生成測試報告
  generateTestReport(allResults);
}

/**
 * 生成測試報告
 */
function generateTestReport(results) {
  console.log('\n📊 Render 服務測試報告');
  console.log('='.repeat(60));

  let totalTests = 0;
  let passedTests = 0;

  for (const [category, tests] of Object.entries(results)) {
    console.log(`\n📋 ${category.toUpperCase()}:`);
    
    for (const test of tests) {
      totalTests++;
      if (test.success) {
        passedTests++;
        console.log(`  ✅ ${test.name || test.step || test.button}: PASS`);
      } else {
        console.log(`  ❌ ${test.name || test.step || test.button}: FAIL`);
        if (test.error) {
          console.log(`     錯誤: ${test.error}`);
        }
      }
    }
  }

  console.log('\n🎯 測試總結:');
  console.log('='.repeat(30));
  console.log(`總測試數: ${totalTests}`);
  console.log(`通過數: ${passedTests}`);
  console.log(`失敗數: ${totalTests - passedTests}`);
  console.log(`通過率: ${Math.round(passedTests/totalTests*100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 所有 Render 服務測試通過！');
  } else {
    console.log('\n⚠️  部分測試失敗，請檢查 Render 服務狀態');
  }
}

// 執行測試
if (require.main === module) {
  runComprehensiveRenderTests().catch(console.error);
}

module.exports = {
  runComprehensiveRenderTests,
  testBasicWebhook,
  testMultiTurnDialogue,
  testQuickReplyButtons,
  testErrorHandlingAndRecovery,
  testServiceHealth
};