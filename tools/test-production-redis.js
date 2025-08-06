#!/usr/bin/env node

/**
 * 測試生產環境 Redis 連接狀態
 * 透過 webhook 請求驗證 Redis 是否正常工作
 */

const https = require('https');
const crypto = require('crypto');

const LINE_CHANNEL_SECRET = '80f460b316f763dbf30e780a73dc2a76'; // 從 .env 取得

function generateSignature(body) {
  const signature = crypto.createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return `SHA256=${signature}`;
}

function testRedisHealth() {
  return new Promise((resolve, reject) => {
    const testMessage = {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: 'TEST_REDIS_HEALTH_CHECK'
        },
        source: {
          type: 'user',
          userId: 'test_redis_health_user'
        },
        replyToken: 'test_reply_token_' + Date.now(),
        timestamp: Date.now()
      }]
    };

    const body = JSON.stringify(testMessage);
    const signature = generateSignature(body);

    const options = {
      hostname: 'course-mvp-beta.onrender.com',
      port: 443,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Line-Signature': signature
      }
    };

    console.log('🧪 發送 Redis 健康檢查請求...');
    console.log('📝 測試訊息:', testMessage.events[0].message.text);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📊 回應狀態碼:', res.statusCode);
        console.log('📋 回應內容:', data);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (error) => {
      console.error('❌ 請求失敗:', error);
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

// 檢查 ConversationManager 狀態
function testConversationState() {
  return new Promise((resolve, reject) => {
    const testMessage = {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: '小明明天下午2點數學課'
        },
        source: {
          type: 'user',
          userId: 'redis_test_user_' + Date.now()
        },
        replyToken: 'test_reply_token_' + Date.now(),
        timestamp: Date.now()
      }]
    };

    const body = JSON.stringify(testMessage);
    const signature = generateSignature(body);

    const options = {
      hostname: 'course-mvp-beta.onrender.com',
      port: 443,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Line-Signature': signature
      }
    };

    console.log('\n🧪 測試多輪對話狀態保存...');
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📊 課程安排回應狀態:', res.statusCode);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (error) => {
      console.error('❌ 多輪對話測試失敗:', error);
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

async function runProductionTest() {
  console.log('🚀 開始生產環境 Redis 連接測試');
  console.log('=' .repeat(50));
  
  try {
    // 測試 1: 健康檢查
    await testRedisHealth();
    
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 測試 2: 多輪對話狀態
    await testConversationState();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ 生產環境測試完成');
    console.log('📋 請檢查 Render 日誌確認 Redis 連接狀態');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

if (require.main === module) {
  runProductionTest();
}

module.exports = { testRedisHealth, testConversationState };