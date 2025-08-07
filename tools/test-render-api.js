require('dotenv').config();
const https = require('https');

const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;

console.log('🔍 Render API 檢查');
console.log('='.repeat(40));

if (!apiKey || !serviceId) {
  console.log('❌ 環境變數缺失');
  console.log('API Key:', apiKey ? '有' : '無');
  console.log('Service ID:', serviceId ? '有' : '無');
  process.exit(1);
}

console.log('✅ 環境變數正常');
console.log('API Key:', apiKey.substring(0, 10) + '...');
console.log('Service ID:', serviceId);
console.log('測試 API 連接...');

// 測試 1: 獲取服務信息
const testServiceInfo = () => {
  return new Promise((resolve) => {
    const url = `https://api.render.com/v1/services/${serviceId}`;
    
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      console.log(`\n📡 服務信息 API - 狀態碼: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ 服務 API 正常');
          resolve(true);
        } else {
          console.log('❌ 服務 API 錯誤:', data.substring(0, 200));
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ 請求錯誤:', error.message);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ 請求超時');
      resolve(false);
    });
    
    req.end();
  });
};

// 測試 2: 獲取日誌
const testLogsAPI = () => {
  return new Promise((resolve) => {
    const url = `https://api.render.com/v1/services/${serviceId}/logs?limit=5`;
    
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      console.log(`\n📋 日誌 API - 狀態碼: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ 日誌 API 正常');
          resolve(true);
        } else {
          console.log('❌ 日誌 API 錯誤:', data.substring(0, 200));
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ 請求錯誤:', error.message);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ 請求超時');
      resolve(false);
    });
    
    req.end();
  });
};

// 執行測試
async function runTests() {
  const serviceOk = await testServiceInfo();
  const logsOk = await testLogsAPI();
  
  console.log('\n📊 測試結果:');
  console.log('服務 API:', serviceOk ? '✅ 正常' : '❌ 失敗');
  console.log('日誌 API:', logsOk ? '✅ 正常' : '❌ 失敗');
  
  if (!serviceOk || !logsOk) {
    console.log('\n💡 可能的原因:');
    console.log('1. API Token 過期');
    console.log('2. Service ID 不正確');
    console.log('3. API 權限不足');
    console.log('4. Render API 端點變更');
  }
}

runTests().catch(console.error);