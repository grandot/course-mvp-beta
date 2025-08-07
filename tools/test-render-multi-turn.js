/**
 * Render 多輪對話專項測試
 * 測試上下文記憶、Quick Reply、期待輸入等進階功能
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

// 測試配置
const RENDER_BASE_URL = 'https://course-mvp-beta.onrender.com';
const TEST_USER_PREFIX = 'U_test_render_multi_';

/**
 * 創建 LINE webhook 簽名
 */
function createSignature(body, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
}

/**
 * 發送測試消息到 Render
 */
async function sendTestMessage(userId, message) {
  console.log(`💬 發送: "${message}"`);
  
  const event = {
    events: [{
      type: 'message',
      message: { type: 'text', text: message },
      source: { userId, type: 'user' },
      replyToken: `test-reply-token-${Date.now()}`,
      timestamp: Date.now()
    }]
  };

  const body = JSON.stringify(event);
  const signature = createSignature(body, process.env.LINE_CHANNEL_SECRET);

  return new Promise((resolve, reject) => {
    const url = new URL(`${RENDER_BASE_URL}/webhook`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsedData,
            rawData: data
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

/**
 * 測試多輪對話場景1：課程新增 + 確認流程
 */
async function testCourseCreationFlow() {
  console.log('\n📚 測試場景1: 課程新增 + 確認流程');
  console.log('='.repeat(50));

  const userId = `${TEST_USER_PREFIX}course_${Date.now()}`;
  
  const flow = [
    {
      step: 1,
      message: '小明每週三下午3點數學課',
      description: '新增課程請求'
    },
    {
      step: 2,
      message: '確認',
      description: '確認課程安排（測試上下文記憶）'
    },
    {
      step: 3,
      message: '查詢課程',
      description: '查詢課程（測試實體記憶推斷）'
    }
  ];

  const results = [];

  for (const item of flow) {
    console.log(`\n📝 第${item.step}步: ${item.description}`);
    
    try {
      const response = await sendTestMessage(userId, item.message);
      const success = response.statusCode === 200;
      
      results.push({
        step: item.step,
        message: item.message,
        success,
        statusCode: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} 狀態: ${response.statusCode}`);
      
      // 步驟間延遲
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ 第${item.step}步失敗: ${error.message}`);
      results.push({
        step: item.step,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試多輪對話場景2：修改操作流程
 */
async function testModificationFlow() {
  console.log('\n✏️ 測試場景2: 修改操作流程');
  console.log('='.repeat(50));

  const userId = `${TEST_USER_PREFIX}modify_${Date.now()}`;
  
  const flow = [
    {
      step: 1,
      message: 'Lumi每週五下午4點鋼琴課',
      description: '新增課程'
    },
    {
      step: 2,
      message: '修改',
      description: '點擊修改按鈕'
    },
    {
      step: 3,
      message: '改成下午5點',
      description: '修改時間'
    },
    {
      step: 4,
      message: '確認',
      description: '確認修改'
    }
  ];

  const results = [];

  for (const item of flow) {
    console.log(`\n📝 第${item.step}步: ${item.description}`);
    
    try {
      const response = await sendTestMessage(userId, item.message);
      const success = response.statusCode === 200;
      
      results.push({
        step: item.step,
        message: item.message,
        success,
        statusCode: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} 狀態: ${response.statusCode}`);
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
    } catch (error) {
      console.log(`❌ 第${item.step}步失敗: ${error.message}`);
      results.push({
        step: item.step,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試多輪對話場景3：內容記錄 + 補充
 */
async function testContentRecordingFlow() {
  console.log('\n📝 測試場景3: 內容記錄 + 補充');
  console.log('='.repeat(50));

  const userId = `${TEST_USER_PREFIX}content_${Date.now()}`;
  
  const flow = [
    {
      step: 1,
      message: '記錄小美今天鋼琴課的內容',
      description: '記錄課程內容請求'
    },
    {
      step: 2,
      message: '學了小星星的曲子',
      description: '補充具體內容'
    },
    {
      step: 3,
      message: '表現很好',
      description: '再次補充內容'
    }
  ];

  const results = [];

  for (const item of flow) {
    console.log(`\n📝 第${item.step}步: ${item.description}`);
    
    try {
      const response = await sendTestMessage(userId, item.message);
      const success = response.statusCode === 200;
      
      results.push({
        step: item.step,
        message: item.message,
        success,
        statusCode: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} 狀態: ${response.statusCode}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ 第${item.step}步失敗: ${error.message}`);
      results.push({
        step: item.step,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試 Quick Reply 按鈕場景
 */
async function testQuickReplyFlow() {
  console.log('\n📱 測試場景4: Quick Reply 按鈕互動');
  console.log('='.repeat(50));

  const userId = `${TEST_USER_PREFIX}quickreply_${Date.now()}`;
  
  // 常見的 Quick Reply 按鈕文字
  const quickReplyButtons = [
    { text: '確認', description: '確認操作' },
    { text: '修改', description: '修改操作' },
    { text: '取消操作', description: '取消操作' },
    { text: '查詢今天課表', description: '查詢課表' },
    { text: '新增課程', description: '新增課程' },
    { text: '記錄課程內容', description: '記錄內容' }
  ];

  // 先發送一個會產生 Quick Reply 的請求
  console.log('\n📝 步驟1: 發送新增課程請求（預期產生 Quick Reply）');
  await sendTestMessage(userId, '小華每週二上午10點美術課');
  
  // 等待處理完成
  await new Promise(resolve => setTimeout(resolve, 2000));

  const results = [];

  for (const button of quickReplyButtons.slice(0, 3)) { // 只測試前3個
    console.log(`\n🖱️  測試按鈕: ${button.text}`);
    
    try {
      const response = await sendTestMessage(userId, button.text);
      const success = response.statusCode === 200;
      
      results.push({
        button: button.text,
        description: button.description,
        success,
        statusCode: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} 狀態: ${response.statusCode}`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log(`❌ 按鈕"${button.text}"失敗: ${error.message}`);
      results.push({
        button: button.text,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試錯誤恢復場景
 */
async function testErrorRecoveryFlow() {
  console.log('\n⚠️ 測試場景5: 錯誤恢復流程');
  console.log('='.repeat(50));

  const userId = `${TEST_USER_PREFIX}recovery_${Date.now()}`;
  
  const flow = [
    {
      step: 1,
      message: '隨機無意義文字 xyz123',
      description: '發送無法識別的訊息'
    },
    {
      step: 2,
      message: '小明每週三下午3點數學課',
      description: '發送正常請求（測試錯誤恢復）'
    },
    {
      step: 3,
      message: '查詢課程',
      description: '驗證系統正常運作'
    }
  ];

  const results = [];

  for (const item of flow) {
    console.log(`\n📝 第${item.step}步: ${item.description}`);
    
    try {
      const response = await sendTestMessage(userId, item.message);
      const success = response.statusCode === 200;
      
      results.push({
        step: item.step,
        message: item.message,
        success,
        statusCode: response.statusCode,
        data: response.data
      });

      console.log(`${success ? '✅' : '❌'} 狀態: ${response.statusCode}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ 第${item.step}步失敗: ${error.message}`);
      results.push({
        step: item.step,
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
async function runRenderMultiTurnTests() {
  console.log('🚀 開始 Render 多輪對話專項測試');
  console.log('🌐 目標服務:', RENDER_BASE_URL);
  console.log('🕐 開始時間:', new Date().toLocaleString());
  console.log('='.repeat(60));

  const allResults = {
    courseCreation: [],
    modification: [],
    contentRecording: [],
    quickReply: [],
    errorRecovery: []
  };

  try {
    // 測試各種多輪對話場景
    allResults.courseCreation = await testCourseCreationFlow();
    allResults.modification = await testModificationFlow();
    allResults.contentRecording = await testContentRecordingFlow();
    allResults.quickReply = await testQuickReplyFlow();
    allResults.errorRecovery = await testErrorRecoveryFlow();

  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
  }

  // 生成報告
  generateReport(allResults);
}

/**
 * 生成測試報告
 */
function generateReport(results) {
  console.log('\n📊 Render 多輪對話測試報告');
  console.log('='.repeat(60));

  let totalTests = 0;
  let passedTests = 0;

  const scenarios = [
    { key: 'courseCreation', name: '課程新增流程' },
    { key: 'modification', name: '修改操作流程' },
    { key: 'contentRecording', name: '內容記錄流程' },
    { key: 'quickReply', name: 'Quick Reply 互動' },
    { key: 'errorRecovery', name: '錯誤恢復流程' }
  ];

  scenarios.forEach(scenario => {
    console.log(`\n📋 ${scenario.name.toUpperCase()}:`);
    
    const tests = results[scenario.key] || [];
    tests.forEach(test => {
      totalTests++;
      const stepInfo = test.step ? `第${test.step}步` : `按鈕"${test.button}"`;
      
      if (test.success) {
        passedTests++;
        console.log(`  ✅ ${stepInfo}: PASS`);
      } else {
        console.log(`  ❌ ${stepInfo}: FAIL`);
        if (test.error) {
          console.log(`     錯誤: ${test.error}`);
        }
      }
    });
  });

  console.log('\n🎯 測試總結:');
  console.log('='.repeat(30));
  console.log(`📊 總測試數: ${totalTests}`);
  console.log(`✅ 通過數: ${passedTests}`);
  console.log(`❌ 失敗數: ${totalTests - passedTests}`);
  console.log(`🎯 通過率: ${Math.round(passedTests/totalTests*100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 所有 Render 多輪對話測試通過！');
  } else {
    console.log('\n⚠️  部分測試失敗，多輪對話功能可能需要檢查');
  }

  console.log(`\n🕐 測試完成時間: ${new Date().toLocaleString()}`);
}

// 執行測試
if (require.main === module) {
  runRenderMultiTurnTests().catch(console.error);
}

module.exports = {
  runRenderMultiTurnTests,
  testCourseCreationFlow,
  testModificationFlow,
  testContentRecordingFlow,
  testQuickReplyFlow,
  testErrorRecoveryFlow
};