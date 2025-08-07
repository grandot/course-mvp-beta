#!/usr/bin/env node

/**
 * Render 部署環境特定測試工具
 * 測試 Render Serverless 環境的特殊情況
 */

require('dotenv').config();
const axios = require('axios');

const CONFIG = {
  RENDER_URL: process.env.RENDER_URL || 'https://course-mvp-beta.onrender.com',
  HEALTH_ENDPOINT: '/health',
  WEBHOOK_ENDPOINT: '/webhook'
};

/**
 * 測試 Render 服務健康狀況
 */
async function testHealthCheck() {
  console.log('🏥 測試 Render 服務健康狀況...');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(`${CONFIG.RENDER_URL}${CONFIG.HEALTH_ENDPOINT}`, {
      timeout: 10000
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ 健康檢查通過`);
    console.log(`   狀態碼: ${response.status}`);
    console.log(`   回應時間: ${responseTime}ms`);
    console.log(`   回應內容: ${JSON.stringify(response.data)}`);
    
    return { success: true, responseTime, data: response.data };
    
  } catch (error) {
    console.log(`❌ 健康檢查失敗: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 測試冷啟動情況
 */
async function testColdStart() {
  console.log('🧊 測試冷啟動情況...');
  console.log('   (如果服務已經閒置超過15分鐘，第一次請求會比較慢)');
  
  try {
    const startTime = Date.now();
    
    // 發送一個簡單的 webhook 請求
    const testPayload = {
      destination: 'test',
      events: [{
        type: 'message',
        mode: 'active',
        timestamp: Date.now(),
        source: { type: 'user', userId: 'U_cold_start_test' },
        replyToken: 'cold_start_reply_token',
        message: { type: 'text', id: 'msg_cold_start', text: 'hello' }
      }]
    };
    
    const response = await axios.post(
      `${CONFIG.RENDER_URL}${CONFIG.WEBHOOK_ENDPOINT}`,
      testPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 冷啟動可能需要更長時間
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ 冷啟動測試完成`);
    console.log(`   狀態碼: ${response.status}`);
    console.log(`   回應時間: ${responseTime}ms`);
    
    if (responseTime > 5000) {
      console.log(`⚠️  回應時間較長，可能是冷啟動`);
    }
    
    return { success: true, responseTime, coldStart: responseTime > 5000 };
    
  } catch (error) {
    console.log(`❌ 冷啟動測試失敗: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 測試 Redis 連接
 */
async function testRedisConnection() {
  console.log('🔴 測試 Redis 連接...');
  
  // 這個測試需要透過 webhook 來間接測試 Redis
  try {
    const testPayload = {
      destination: 'test',
      events: [{
        type: 'message',
        mode: 'active',
        timestamp: Date.now(),
        source: { type: 'user', userId: 'U_redis_test' },
        replyToken: 'redis_test_reply_token',
        message: { type: 'text', id: 'msg_redis_test', text: '測試 Redis 連接' }
      }]
    };
    
    // 第一個請求 - 建立上下文
    await axios.post(
      `${CONFIG.RENDER_URL}${CONFIG.WEBHOOK_ENDPOINT}`,
      {
        ...testPayload,
        events: [{
          ...testPayload.events[0],
          message: { ...testPayload.events[0].message, text: '明天下午3點有課' }
        }]
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 第二個請求 - 測試上下文是否保存在 Redis
    const response = await axios.post(
      `${CONFIG.RENDER_URL}${CONFIG.WEBHOOK_ENDPOINT}`,
      {
        ...testPayload,
        events: [{
          ...testPayload.events[0],
          message: { ...testPayload.events[0].message, text: '小明' },
          replyToken: 'redis_test_reply_token_2'
        }]
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    
    console.log(`✅ Redis 連接測試完成`);
    console.log(`   狀態碼: ${response.status}`);
    
    // 檢查回應是否包含上下文相關內容
    if (response.data && response.data.length > 0) {
      const reply = response.data[0];
      const hasContext = reply.text && (
        reply.text.includes('確認') || 
        reply.text.includes('小明') || 
        reply.text.includes('課程')
      );
      
      if (hasContext) {
        console.log(`✅ 上下文管理正常工作`);
        return { success: true, contextWorking: true };
      } else {
        console.log(`⚠️  上下文可能未正常工作`);
        return { success: true, contextWorking: false };
      }
    }
    
    return { success: true, contextWorking: false };
    
  } catch (error) {
    console.log(`❌ Redis 連接測試失敗: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 測試併發處理
 */
async function testConcurrency() {
  console.log('🔄 測試併發處理...');
  
  const concurrentRequests = 5;
  const promises = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    const testPayload = {
      destination: 'test',
      events: [{
        type: 'message',
        mode: 'active',
        timestamp: Date.now() + i,
        source: { type: 'user', userId: `U_concurrent_test_${i}` },
        replyToken: `concurrent_reply_token_${i}`,
        message: { 
          type: 'text', 
          id: `msg_concurrent_${i}`, 
          text: `小明${i}明天下午${i+1}點數學課` 
        }
      }]
    };
    
    const promise = axios.post(
      `${CONFIG.RENDER_URL}${CONFIG.WEBHOOK_ENDPOINT}`,
      testPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    ).then(response => ({ success: true, status: response.status, index: i }))
     .catch(error => ({ success: false, error: error.message, index: i }));
    
    promises.push(promise);
  }
  
  try {
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ 併發測試完成`);
    console.log(`   總請求數: ${concurrentRequests}`);
    console.log(`   成功: ${successful}`);
    console.log(`   失敗: ${failed}`);
    console.log(`   總時間: ${totalTime}ms`);
    console.log(`   平均時間: ${(totalTime/concurrentRequests).toFixed(0)}ms`);
    
    return {
      success: true,
      totalRequests: concurrentRequests,
      successful,
      failed,
      totalTime,
      averageTime: totalTime / concurrentRequests
    };
    
  } catch (error) {
    console.log(`❌ 併發測試失敗: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 主測試函式
 */
async function main() {
  console.log('🚀 Render 部署環境測試開始');
  console.log(`🎯 測試目標: ${CONFIG.RENDER_URL}`);
  console.log('='.repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    target: CONFIG.RENDER_URL,
    tests: {}
  };
  
  // 1. 健康檢查
  console.log('\\n📍 測試 1/4: 服務健康狀況');
  results.tests.healthCheck = await testHealthCheck();
  
  // 2. 冷啟動測試
  console.log('\\n📍 測試 2/4: 冷啟動性能');
  results.tests.coldStart = await testColdStart();
  
  // 3. Redis 連接測試
  console.log('\\n📍 測試 3/4: Redis 連接與上下文');
  results.tests.redisConnection = await testRedisConnection();
  
  // 4. 併發處理測試
  console.log('\\n📍 測試 4/4: 併發處理能力');
  results.tests.concurrency = await testConcurrency();
  
  // 生成總結報告
  console.log('\\n📊 測試總結:');
  console.log('='.repeat(60));
  
  const allTests = Object.values(results.tests);
  const passedTests = allTests.filter(t => t.success).length;
  const totalTests = allTests.length;
  
  console.log(`總測試數: ${totalTests}`);
  console.log(`通過: ${passedTests}`);
  console.log(`失敗: ${totalTests - passedTests}`);
  console.log(`通過率: ${(passedTests/totalTests*100).toFixed(1)}%`);
  
  // 特定建議
  console.log('\\n💡 建議:');
  
  if (results.tests.coldStart.success && results.tests.coldStart.coldStart) {
    console.log('   - 考慮使用定時 ping 來保持服務活躍');
  }
  
  if (results.tests.redisConnection.success && !results.tests.redisConnection.contextWorking) {
    console.log('   - 檢查 Redis 連接配置和上下文管理邏輯');
  }
  
  if (results.tests.concurrency.success && results.tests.concurrency.averageTime > 3000) {
    console.log('   - 考慮優化請求處理性能');
  }
  
  // 保存結果
  const fs = require('fs');
  const reportPath = './test-results/render-deployment-test.json';
  
  if (!fs.existsSync('./test-results')) {
    fs.mkdirSync('./test-results', { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\\n📄 詳細報告已保存: ${reportPath}`);
  
  return results;
}

// 如果直接執行此檔案
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Render 測試失敗:', error);
    process.exit(1);
  });
}

module.exports = { main };