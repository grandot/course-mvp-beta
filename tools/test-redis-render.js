#!/usr/bin/env node

/**
 * 測試 Render 環境 Redis 連接
 */

const axios = require('axios');

const RENDER_URL = 'https://course-mvp-beta.onrender.com';

// 創建一個簡單的測試端點請求
async function testRedisConnection() {
  console.log('🔍 測試 Render 環境 Redis 連接...');
  
  try {
    // 發送一個測試請求到自定義端點
    const testPayload = {
      action: 'test_redis',
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(`${RENDER_URL}/test/redis`, testPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log('✅ Redis 測試結果:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.error('❌ 服務回應錯誤:');
      console.error('  狀態碼:', error.response.status);
      console.error('  錯誤訊息:', error.response.data);
    } else if (error.request) {
      console.error('❌ 無法連接到服務:', error.message);
    } else {
      console.error('❌ 請求錯誤:', error.message);
    }
  }
}

testRedisConnection();