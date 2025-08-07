#!/usr/bin/env node

/**
 * Render 生產環境測試工具
 * 透過 HTTP 請求測試部署在 Render 上的機器人
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Render 生產環境 URL
const RENDER_URL = 'https://course-mvp-beta.onrender.com';
const WEBHOOK_URL = `${RENDER_URL}/webhook`;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// 模擬 LINE 訊息事件
function createLineEvent(message, userId = 'TEST_USER_RENDER') {
  return {
    events: [{
      type: 'message',
      message: {
        type: 'text',
        id: '1234567890',
        text: message
      },
      timestamp: Date.now(),
      source: {
        type: 'user',
        userId: userId
      },
      replyToken: 'test-reply-token-' + Date.now(),
      mode: 'active'
    }]
  };
}

// 計算 LINE 簽名
function calculateSignature(body) {
  const signature = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return signature;
}

// 發送測試訊息到 Render
async function sendTestMessage(message, userId) {
  try {
    console.log('📤 發送測試訊息到 Render:', message);
    console.log('🌐 Webhook URL:', WEBHOOK_URL);
    
    const payload = createLineEvent(message, userId);
    const body = JSON.stringify(payload);
    const signature = calculateSignature(body);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signature
      }
    });
    
    console.log('✅ 回應狀態:', response.status);
    console.log('📥 回應資料:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('❌ 伺服器回應錯誤:');
      console.error('  狀態碼:', error.response.status);
      console.error('  完整錯誤回應:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('❌ 無法連接到伺服器:', error.message);
    } else {
      console.error('❌ 請求錯誤:', error.message);
    }
  }
}

// 檢查服務健康狀態
async function checkHealth() {
  try {
    console.log('🏥 檢查服務健康狀態...');
    const response = await axios.get(`${RENDER_URL}/health`);
    console.log('✅ 服務狀態:', response.data);
    return true;
  } catch (error) {
    console.error('❌ 服務可能未啟動或無法連接');
    return false;
  }
}

// 批量測試
async function runBatchTests() {
  const testCases = [
    { message: '幫我新增小明星期三下午3點的數學課', delay: 2000 },
    { message: '查詢小明這週的課程', delay: 2000 },
    { message: '記錄小明今天數學課學了分數', delay: 2000 },
    { message: '提醒我小明明天的數學課', delay: 2000 },
    { message: '取消小明的英文課', delay: 2000 }
  ];
  
  console.log('🧪 開始批量測試 Render 環境...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    console.log(`\n📌 測試案例 ${i + 1}/${testCases.length}`);
    console.log('='.repeat(50));
    
    await sendTestMessage(testCases[i].message);
    
    if (i < testCases.length - 1) {
      console.log(`\n⏳ 等待 ${testCases[i].delay / 1000} 秒後繼續...`);
      await new Promise(resolve => setTimeout(resolve, testCases[i].delay));
    }
  }
  
  console.log('\n🎉 批量測試完成！');
}

// 主程式
async function main() {
  const args = process.argv.slice(2);
  
  console.log('🚀 Render 生產環境測試工具');
  console.log('='.repeat(50));
  
  // 先檢查健康狀態
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.log('⚠️  服務可能未正常運行，請檢查 Render 部署狀態');
    return;
  }
  
  console.log('');
  
  if (args.length === 0) {
    console.log('📖 使用方法:');
    console.log('  單一測試: node tools/test-render.js "測試訊息"');
    console.log('  批量測試: node tools/test-render.js --batch');
    console.log('');
    console.log('📝 測試範例:');
    console.log('  node tools/test-render.js "小明每週三下午3點數學課"');
    console.log('  node tools/test-render.js "查詢小明今天的課程"');
    return;
  }
  
  if (args[0] === '--batch') {
    await runBatchTests();
  } else {
    const message = args.join(' ');
    await sendTestMessage(message);
  }
}

// 執行主程式
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  });
}

module.exports = {
  sendTestMessage,
  checkHealth
};