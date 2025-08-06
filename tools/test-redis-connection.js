#!/usr/bin/env node

/**
 * Redis 連接測試工具
 * 用於驗證 Redis 環境設定和連接狀態
 * 
 * 使用方式：
 * node tools/test-redis-connection.js
 */

require('dotenv').config();
const Redis = require('ioredis');

// Upstash Redis 配置（使用 URL 格式更可靠）
let redisConfig;

if (process.env.REDIS_URL) {
  // 如果有完整的 Redis URL，直接使用
  redisConfig = process.env.REDIS_URL;
} else {
  // 手動組裝配置
  redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    retryDelayOnError: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true, // 延遲連接，等到第一次使用才連接
  };

  // 如果需要 TLS
  if (process.env.REDIS_TLS === 'true') {
    redisConfig.tls = {};
  }
}

async function testRedisConnection() {
  console.log('\n🔧 Redis 連接測試開始...\n');
  
  // 檢查環境變數
  console.log('📋 環境變數檢查:');
  console.log(`   REDIS_HOST: ${process.env.REDIS_HOST ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`   REDIS_PORT: ${process.env.REDIS_PORT || '預設 6379'}`);
  console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`   REDIS_TLS: ${process.env.REDIS_TLS || 'false'}`);
  console.log('');
  
  if (!process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
    console.log('❌ Redis 環境變數未完整設定');
    console.log('請參考 .env.example 設定 REDIS_HOST 和 REDIS_PASSWORD');
    process.exit(1);
  }
  
  const redis = new Redis(redisConfig);
  
  try {
    console.log('🔌 嘗試連接 Redis...');
    
    // 測試連接
    await redis.ping();
    console.log('✅ Redis 連接成功');
    
    // 測試寫入
    console.log('📝 測試資料寫入...');
    const testKey = 'test:connection:timestamp';
    const testValue = new Date().toISOString();
    await redis.set(testKey, testValue, 'EX', 60); // 60秒後過期
    console.log(`   寫入測試資料: ${testKey} = ${testValue}`);
    
    // 測試讀取
    console.log('📖 測試資料讀取...');
    const retrievedValue = await redis.get(testKey);
    console.log(`   讀取測試資料: ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      console.log('✅ 讀寫測試成功');
    } else {
      console.log('❌ 讀寫測試失敗');
    }
    
    // 測試過期設定
    console.log('⏰ 測試 TTL 設定...');
    const ttl = await redis.ttl(testKey);
    console.log(`   TTL 剩餘時間: ${ttl} 秒`);
    
    // 清理測試資料
    await redis.del(testKey);
    console.log('🧹 清理測試資料完成');
    
    // 測試對話狀態結構
    console.log('🗣️ 測試對話狀態儲存...');
    const userId = 'test_user_12345';
    const conversationState = {
      userId: userId,
      lastActivity: Date.now(),
      state: {
        currentFlow: null,
        expectingInput: [],
        lastActions: {},
        pendingData: {},
        history: [],
        mentionedEntities: {
          students: [],
          courses: [],
          dates: [],
          times: []
        }
      }
    };
    
    const stateKey = `conversation:${userId}`;
    await redis.set(stateKey, JSON.stringify(conversationState), 'EX', 1800); // 30分鐘過期
    console.log(`   儲存對話狀態: ${stateKey}`);
    
    // 讀取對話狀態
    const retrievedState = await redis.get(stateKey);
    const parsedState = JSON.parse(retrievedState);
    console.log(`   讀取對話狀態成功，用戶: ${parsedState.userId}`);
    
    // 清理測試狀態
    await redis.del(stateKey);
    console.log('🧹 清理對話狀態測試資料完成');
    
    console.log('\n✅ Redis 環境測試全部通過！');
    console.log('🚀 準備好開發多輪對話功能');
    
  } catch (error) {
    console.error('\n❌ Redis 連接測試失敗:');
    console.error(`   錯誤類型: ${error.name}`);
    console.error(`   錯誤訊息: ${error.message}`);
    
    // 提供常見問題的解決建議
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 建議檢查項目:');
      console.error('   1. REDIS_HOST 是否正確');
      console.error('   2. 網路連接是否正常');
      console.error('   3. Redis 服務是否在線上');
    } else if (error.message.includes('WRONGPASS')) {
      console.error('\n💡 建議檢查項目:');
      console.error('   1. REDIS_PASSWORD 是否正確');
      console.error('   2. Redis 認證設定是否正確');
    } else if (error.message.includes('TLS')) {
      console.error('\n💡 建議檢查項目:');
      console.error('   1. REDIS_TLS 設定是否正確');
      console.error('   2. Redis 服務是否啟用 TLS');
    }
    
    process.exit(1);
  } finally {
    // 關閉連接
    redis.disconnect();
    console.log('\n🔌 Redis 連接已關閉');
  }
}

// 主函式
async function main() {
  try {
    await testRedisConnection();
    process.exit(0);
  } catch (error) {
    console.error('測試過程發生未預期錯誤:', error);
    process.exit(1);
  }
}

// 執行測試
if (require.main === module) {
  main();
}

module.exports = { testRedisConnection };