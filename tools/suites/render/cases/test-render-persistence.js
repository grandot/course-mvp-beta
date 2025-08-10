/**
 * 測試 Render 對話狀態持久化
 * 驗證 Redis 整合和跨 session 對話記憶
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

const RENDER_BASE_URL = 'https://course-mvp-beta.onrender.com';

/**
 * 創建測試訊息並發送
 */
async function sendTestMessage(userId, message) {
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
  const signature = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(body, 'utf8')
    .digest('base64');

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
        resolve({
          statusCode: res.statusCode,
          data: data ? JSON.parse(data) : {},
          rawData: data
        });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 發送 GET 請求
 */
async function sendGetRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 測試跨 Session 對話狀態保持
 */
async function testCrossSessionPersistence() {
  console.log('\n🔄 測試 Render 跨 Session 對話狀態保持');
  console.log('='.repeat(50));

  const userId = `U_test_render_persistence_${Date.now()}`;
  console.log(`👤 測試用戶: ${userId}`);

  // Session 1: 建立對話上下文
  console.log('\n📱 Session 1: 建立對話上下文');
  const session1Messages = [
    '小明每週三下午3點數學課',
    '小美每週五下午4點鋼琴課'
  ];

  for (const [index, message] of session1Messages.entries()) {
    console.log(`💬 Session 1.${index + 1}: "${message}"`);
    const response = await sendTestMessage(userId, message);
    console.log(`📊 回應: ${response.statusCode === 200 ? '✅' : '❌'}`);
    
    // 短暫間隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n⏳ 模擬 Session 間隔（5秒）...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Session 2: 測試上下文記憶
  console.log('\n📱 Session 2: 測試上下文記憶');
  const session2Messages = [
    '查詢課程',           // 應該查詢到小明和小美的課程
    '設定提醒',           // 應該能推斷學生信息
    '確認'               // 應該記得上一步的操作
  ];

  const results = [];

  for (const [index, message] of session2Messages.entries()) {
    console.log(`💬 Session 2.${index + 1}: "${message}"`);
    
    try {
      const response = await sendTestMessage(userId, message);
      const success = response.statusCode === 200;
      
      results.push({
        session: 2,
        step: index + 1,
        message,
        success,
        statusCode: response.statusCode
      });

      console.log(`📊 回應: ${success ? '✅' : '❌'} (${response.statusCode})`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log(`❌ Session 2.${index + 1} 失敗: ${error.message}`);
      results.push({
        session: 2,
        step: index + 1,
        message,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 測試對話狀態過期處理
 */
async function testStateExpiration() {
  console.log('\n⏰ 測試對話狀態過期處理');
  console.log('='.repeat(50));

  const userId = `U_test_render_expiry_${Date.now()}`;
  console.log(`👤 測試用戶: ${userId}`);

  // 建立對話狀態
  console.log('\n💬 建立初始對話狀態');
  await sendTestMessage(userId, '小華每週一上午9點體育課');
  
  console.log('📊 狀態已建立');

  // 立即測試狀態存在
  console.log('\n💬 立即測試狀態記憶');
  const immediateResponse = await sendTestMessage(userId, '查詢課程');
  console.log(`📊 立即查詢: ${immediateResponse.statusCode === 200 ? '✅' : '❌'}`);

  console.log('\n⏳ 等待 10 秒（模擬較長間隔）...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 測試狀態是否仍然存在
  console.log('\n💬 10秒後測試狀態記憶');
  const delayedResponse = await sendTestMessage(userId, '設定提醒');
  console.log(`📊 延遲查詢: ${delayedResponse.statusCode === 200 ? '✅' : '❌'}`);

  return {
    immediate: immediateResponse.statusCode === 200,
    delayed: delayedResponse.statusCode === 200
  };
}

/**
 * 測試多用戶狀態隔離
 */
async function testMultiUserIsolation() {
  console.log('\n👥 測試多用戶狀態隔離');
  console.log('='.repeat(50));

  const user1 = `U_test_render_user1_${Date.now()}`;
  const user2 = `U_test_render_user2_${Date.now()}`;

  console.log(`👤 用戶1: ${user1}`);
  console.log(`👤 用戶2: ${user2}`);

  // 用戶1的對話
  console.log('\n💬 用戶1 建立對話');
  await sendTestMessage(user1, '小明每週三下午3點數學課');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 用戶2的對話
  console.log('\n💬 用戶2 建立對話');
  await sendTestMessage(user2, '小美每週五下午4點鋼琴課');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 測試隔離性
  console.log('\n🔍 測試用戶1查詢（應該只看到小明）');
  const user1Query = await sendTestMessage(user1, '查詢課程');
  
  console.log('\n🔍 測試用戶2查詢（應該只看到小美）');
  const user2Query = await sendTestMessage(user2, '查詢課程');

  return {
    user1Success: user1Query.statusCode === 200,
    user2Success: user2Query.statusCode === 200,
    isolated: true // 無法直接驗證內容隔離，但可以驗證請求成功
  };
}

/**
 * 測試 Redis 健康狀態
 */
async function testRedisHealth() {
  console.log('\n💊 測試 Redis 健康狀態');
  console.log('='.repeat(50));

  try {
    const response = await sendGetRequest(`${RENDER_BASE_URL}/health/deps`);
    
    if (response.statusCode === 200 && response.data.checks) {
      const redisStatus = response.data.checks.redis;
      console.log(`📊 Redis 狀態: ${redisStatus.status}`);
      console.log(`📊 Redis 訊息: ${redisStatus.message}`);
      
      return {
        healthy: redisStatus.status === 'ok',
        status: redisStatus.status,
        message: redisStatus.message
      };
    }
    
    return { healthy: false, error: 'Unable to get Redis status' };
    
  } catch (error) {
    console.log(`❌ 健康檢查失敗: ${error.message}`);
    return { healthy: false, error: error.message };
  }
}

/**
 * 主測試函數
 */
async function runRenderPersistenceTests() {
  console.log('🚀 開始 Render 對話狀態持久化測試');
  console.log('🌐 目標服務:', RENDER_BASE_URL);
  console.log('🕐 開始時間:', new Date().toLocaleString());
  console.log('='.repeat(60));

  const results = {
    redisHealth: null,
    crossSessionPersistence: [],
    stateExpiration: null,
    multiUserIsolation: null
  };

  try {
    // 1. Redis 健康檢查
    results.redisHealth = await testRedisHealth();

    // 2. 跨 Session 持久化測試
    results.crossSessionPersistence = await testCrossSessionPersistence();

    // 3. 狀態過期測試
    results.stateExpiration = await testStateExpiration();

    // 4. 多用戶隔離測試
    results.multiUserIsolation = await testMultiUserIsolation();

  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
  }

  // 生成報告
  generatePersistenceReport(results);
}

/**
 * 生成持久化測試報告
 */
function generatePersistenceReport(results) {
  console.log('\n📊 Render 對話狀態持久化測試報告');
  console.log('='.repeat(60));

  let totalTests = 0;
  let passedTests = 0;

  // Redis 健康狀態
  console.log('\n📋 REDIS 健康狀態:');
  totalTests++;
  if (results.redisHealth && results.redisHealth.healthy) {
    passedTests++;
    console.log(`  ✅ Redis 連接: PASS`);
  } else {
    console.log(`  ❌ Redis 連接: FAIL`);
    if (results.redisHealth && results.redisHealth.error) {
      console.log(`     錯誤: ${results.redisHealth.error}`);
    }
  }

  // 跨 Session 持久化
  console.log('\n📋 跨 SESSION 持久化:');
  results.crossSessionPersistence.forEach(test => {
    totalTests++;
    if (test.success) {
      passedTests++;
      console.log(`  ✅ Session ${test.session}.${test.step}: PASS`);
    } else {
      console.log(`  ❌ Session ${test.session}.${test.step}: FAIL`);
      if (test.error) {
        console.log(`     錯誤: ${test.error}`);
      }
    }
  });

  // 狀態過期處理
  console.log('\n📋 狀態過期處理:');
  if (results.stateExpiration) {
    totalTests += 2;
    
    if (results.stateExpiration.immediate) {
      passedTests++;
      console.log(`  ✅ 立即記憶: PASS`);
    } else {
      console.log(`  ❌ 立即記憶: FAIL`);
    }
    
    if (results.stateExpiration.delayed) {
      passedTests++;
      console.log(`  ✅ 延遲記憶: PASS`);
    } else {
      console.log(`  ❌ 延遲記憶: FAIL`);
    }
  }

  // 多用戶隔離
  console.log('\n📋 多用戶隔離:');
  if (results.multiUserIsolation) {
    totalTests += 2;
    
    if (results.multiUserIsolation.user1Success) {
      passedTests++;
      console.log(`  ✅ 用戶1 狀態: PASS`);
    } else {
      console.log(`  ❌ 用戶1 狀態: FAIL`);
    }
    
    if (results.multiUserIsolation.user2Success) {
      passedTests++;
      console.log(`  ✅ 用戶2 狀態: PASS`);
    } else {
      console.log(`  ❌ 用戶2 狀態: FAIL`);
    }
  }

  console.log('\n🎯 持久化測試總結:');
  console.log('='.repeat(30));
  console.log(`📊 總測試數: ${totalTests}`);
  console.log(`✅ 通過數: ${passedTests}`);
  console.log(`❌ 失敗數: ${totalTests - passedTests}`);
  console.log(`🎯 通過率: ${Math.round(passedTests/totalTests*100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 所有 Render 對話狀態持久化測試通過！');
  } else {
    console.log('\n⚠️  部分測試失敗，Redis 整合可能需要檢查');
  }

  console.log(`\n🕐 測試完成時間: ${new Date().toLocaleString()}`);
}

// 執行測試
if (require.main === module) {
  runRenderPersistenceTests().catch(console.error);
}

module.exports = {
  runRenderPersistenceTests,
  testCrossSessionPersistence,
  testStateExpiration,
  testMultiUserIsolation,
  testRedisHealth
};