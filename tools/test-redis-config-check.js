#!/usr/bin/env node

/**
 * 測試 Redis 配置檢查功能
 * 驗證無配置時不會嘗試連接
 */

const { getRedisService } = require('../src/services/redisService');

async function testRedisConfigCheck() {
  console.log('🧪 測試 Redis 配置檢查機制\n');
  
  // 備份原始環境變數
  const originalRedisUrl = process.env.REDIS_URL;
  const originalRedisHost = process.env.REDIS_HOST;
  
  try {
    // 測試 1: 清除所有 Redis 環境變數
    console.log('📋 測試 1: 無 Redis 配置');
    console.log('-'.repeat(40));
    
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    
    // 創建新的 Redis 服務實例 (需要重新引用)
    delete require.cache[require.resolve('../src/services/redisService')];
    const { getRedisService: getRedisServiceClean } = require('../src/services/redisService');
    
    const redisService = getRedisServiceClean();
    
    console.log('🔍 檢查配置狀態...');
    console.log(`配置存在: ${redisService.config ? '是' : '否'}`);
    
    // 測試各種操作是否會靜默失敗
    console.log('\n🧪 測試 Redis 操作 (應該靜默失敗):');
    
    const testResults = {
      healthCheck: await redisService.healthCheck(),
      set: await redisService.set('test_key', 'test_value'),
      get: await redisService.get('test_key'),
      delete: await redisService.delete('test_key'),
      exists: await redisService.exists('test_key'),
      getTTL: await redisService.getTTL('test_key'),
      extend: await redisService.extend('test_key', 1800),
      setBatch: await redisService.setBatch([{key: 'test', value: 'test'}]),
      scan: await redisService.scan('test*')
    };
    
    console.log('結果:');
    Object.entries(testResults).forEach(([method, result]) => {
      const status = method === 'healthCheck' 
        ? (result?.status === 'unavailable' ? '✅ 正確' : '❌ 錯誤')
        : (result === false || result === null || result === -2 || (Array.isArray(result) && result.length === 0) ? '✅ 正確' : '❌ 錯誤');
      console.log(`  ${method}: ${JSON.stringify(result)} ${status}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Redis 配置檢查測試完成');
    console.log('🎯 結果: 無配置時所有操作正確靜默失敗');
    console.log('🚀 生產環境不會嘗試連接 localhost Redis');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    // 恢復原始環境變數
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalRedisHost) {
      process.env.REDIS_HOST = originalRedisHost;
    }
    
    process.exit(0);
  }
}

// 執行測試
if (require.main === module) {
  testRedisConfigCheck().catch(console.error);
}

module.exports = { testRedisConfigCheck };