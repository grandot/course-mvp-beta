#!/usr/bin/env node

/**
 * 直接測試 Redis 連接
 * 使用與生產環境相同的配置
 */

const Redis = require('ioredis');

// 使用與 .env 相同的配置
const REDIS_URL = 'rediss://default:ATpyAAIjcDEwNjE3OTUxMGMzYTQ0NWMwOTZjZjhjM2NkN2U0NGRhY3AxMA@lenient-oyster-14962.upstash.io:6379';

async function testDirectRedisConnection() {
  console.log('🧪 直接測試 Redis 連接');
  console.log('🔗 Redis URL:', REDIS_URL.replace(/:([^:@]+)@/, ':***@'));
  console.log('=' .repeat(50));
  
  try {
    console.log('1️⃣ 創建 Redis 客戶端...');
    const redis = new Redis(REDIS_URL);
    
    // 設定事件監聽器
    redis.on('connect', () => {
      console.log('✅ Redis 連接成功');
    });
    
    redis.on('error', (error) => {
      console.error('❌ Redis 連接錯誤:', error.message);
    });
    
    redis.on('close', () => {
      console.log('🔌 Redis 連接已關閉');
    });
    
    console.log('2️⃣ 測試 PING...');
    const pong = await redis.ping();
    console.log('✅ PING 結果:', pong);
    
    console.log('3️⃣ 測試寫入...');
    await redis.set('test_key', 'test_value', 'EX', 60);
    console.log('✅ 寫入成功');
    
    console.log('4️⃣ 測試讀取...');
    const value = await redis.get('test_key');
    console.log('✅ 讀取結果:', value);
    
    console.log('5️⃣ 測試刪除...');
    await redis.del('test_key');
    console.log('✅ 刪除成功');
    
    console.log('6️⃣ 關閉連接...');
    await redis.quit();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Redis 連接測試完全成功！');
    
  } catch (error) {
    console.error('\n❌ Redis 連接測試失敗:');
    console.error('錯誤訊息:', error.message);
    console.error('錯誤代碼:', error.code);
    console.error('完整錯誤:', error);
  }
}

if (require.main === module) {
  testDirectRedisConnection();
}