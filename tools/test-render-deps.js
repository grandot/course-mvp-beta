#!/usr/bin/env node

/**
 * 測試 Render 環境依賴服務連接
 * 直接調用 /health/deps 端點檢查各依賴服務狀態
 */

const axios = require('axios');

const RENDER_URL = 'https://course-mvp-beta.onrender.com';

async function testDependencies() {
  console.log('🔍 測試 Render 環境依賴服務...');
  
  try {
    // 測試依賴服務健康檢查端點
    const response = await axios.get(`${RENDER_URL}/health/deps`, {
      timeout: 30000 // 30秒超時
    });
    
    console.log('✅ 依賴服務狀態:', JSON.stringify(response.data, null, 2));
    
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

testDependencies();