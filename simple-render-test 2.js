require('dotenv').config();

/**
 * 簡化版 Render 環境測試
 */

async function testRenderEnvironment() {
  console.log('🧪 簡化版 Render 環境測試');
  console.log('---');
  
  // 測試消息
  const testMessage = "小明明天下午2點要上數學課";
  const webhookUrl = process.env.WEBHOOK_URL;
  
  console.log('📝 測試消息:', testMessage);
  console.log('🌐 Webhook URL:', webhookUrl);
  console.log('---');
  
  // 構造 webhook payload
  const payload = {
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          text: testMessage
        },
        replyToken: `test-reply-token-${Date.now()}`,
        source: {
          userId: 'U_test_simple'
        }
      }
    ]
  };
  
  try {
    console.log('🚀 發送 webhook 請求...');
    
    const response = await fetch(`${webhookUrl}/debug/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    console.log('📊 響應狀態:', response.status);
    console.log('📋 響應結果:', JSON.stringify(result, null, 2));
    
    if (result.status === 'debug_success') {
      console.log('✅ Debug webhook 測試成功');
      console.log('🤖 服務類型:', result.serviceType);
      console.log('👤 用戶類型:', result.isTestUser ? '測試用戶' : '正式用戶');
      
      // 等待服務處理
      console.log('⏳ 等待 3 秒讓服務處理...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 檢查健康狀態
      console.log('🏥 檢查服務健康狀態...');
      const healthResponse = await fetch(`${webhookUrl}/health/deps`);
      const healthData = await healthResponse.json();
      
      console.log('🏥 服務狀態:', healthData.status);
      console.log('🔥 Firebase:', healthData.checks.firebase.status);
      console.log('📡 Redis:', healthData.checks.redis.status);
      
      return true;
    } else {
      console.log('❌ Debug webhook 測試失敗');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error.message);
    return false;
  }
}

// 執行測試
testRenderEnvironment().then(success => {
  console.log('---');
  console.log(success ? '✅ 測試完成' : '❌ 測試失敗');
  process.exit(success ? 0 : 1);
});