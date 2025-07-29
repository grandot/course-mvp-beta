#!/usr/bin/env node

/**
 * Render 日誌獲取工具
 * 使用方法：node scripts/get-render-logs.js [options]
 */

require('dotenv').config();
const https = require('https');

// 配置項
const config = {
  serviceId: process.env.RENDER_SERVICE_ID,
  apiToken: process.env.RENDER_API_TOKEN,
  limit: process.argv.includes('--limit') ? 
    process.argv[process.argv.indexOf('--limit') + 1] : '50'
};

/**
 * 獲取 Render 服務日誌 - 嘗試多個端點
 */
async function getRenderLogs() {
  const endpoints = [
    `/v1/services/${config.serviceId}/logs?limit=${config.limit}`,
    `/v1/services/${config.serviceId}/application-logs?limit=${config.limit}`,
    `/v1/logs?serviceIds=${config.serviceId}&limit=${config.limit}`,
    `/v1/services/${config.serviceId}/events?limit=${config.limit}`, // fallback
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`🔍 嘗試端點 ${i + 1}/${endpoints.length}: ${endpoint}`);
    
    try {
      const logs = await tryEndpoint(endpoint);
      console.log(`✅ 成功獲取日誌，使用端點: ${endpoint}\n`);
      return logs;
    } catch (error) {
      console.log(`❌ 端點 ${endpoint} 失敗: ${error.message}`);
      if (i === endpoints.length - 1) {
        console.log('🚫 所有端點都失敗了\n');
        throw error;
      }
    }
  }
}

/**
 * 嘗試單個端點
 */
function tryEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`${res.statusCode}: ${data.substring(0, 100)}`));
            return;
          }
          
          const logs = JSON.parse(data);
          resolve(logs);
        } catch (error) {
          reject(new Error(`解析失敗: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`請求失敗: ${error.message}`));
    });

    req.end();
  });
}

/**
 * 智能格式化日誌輸出 - 支持多種日誌格式
 */
function formatLogs(logs) {
  if (!logs || !Array.isArray(logs)) {
    return '❌ 無法獲取日誌數據';
  }

  return logs.map(logEntry => {
    // 判斷是事件日誌還是應用程式日誌
    if (logEntry.event) {
      // 事件日誌格式
      return formatEventLog(logEntry);
    } else if (logEntry.message || logEntry.log || logEntry.content) {
      // 應用程式日誌格式
      return formatApplicationLog(logEntry);
    } else {
      // 未知格式，顯示原始內容
      return formatRawLog(logEntry);
    }
  }).join('\n');
}

/**
 * 格式化事件日誌
 */
function formatEventLog(logEntry) {
  const event = logEntry.event;
  const timestamp = new Date(event.timestamp).toLocaleString('zh-TW');
  const eventType = event.type?.replace(/_/g, ' ').toUpperCase() || 'EVENT';
  
  let details = '';
  if (event.details) {
    if (event.details.deployStatus) {
      details = `Deploy: ${event.details.deployStatus}`;
    } else if (event.details.buildStatus) {
      details = `Build: ${event.details.buildStatus}`;
    } else {
      details = JSON.stringify(event.details);
    }
  }
  
  return `[${timestamp}] 🔧 ${eventType}: ${details}`;
}

/**
 * 格式化應用程式日誌
 */
function formatApplicationLog(logEntry) {
  const timestamp = logEntry.timestamp ? 
    new Date(logEntry.timestamp).toLocaleString('zh-TW') : 
    new Date().toLocaleString('zh-TW');
  const message = logEntry.message || logEntry.log || logEntry.content || '';
  const level = logEntry.level?.toUpperCase() || 'INFO';
  
  // 添加相應的 emoji
  let emoji = '📝';
  if (level.includes('ERROR')) emoji = '❌';
  else if (level.includes('WARN')) emoji = '⚠️';
  else if (level.includes('DEBUG')) emoji = '🐛';
  else if (message.includes('Received message')) emoji = '📨';
  
  return `[${timestamp}] ${emoji} ${level}: ${message}`;
}

/**
 * 格式化未知格式日誌
 */
function formatRawLog(logEntry) {
  const timestamp = new Date().toLocaleString('zh-TW');
  const content = JSON.stringify(logEntry);
  return `[${timestamp}] 🔍 RAW: ${content}`;
}

/**
 * 智能過濾特定關鍵詞的日誌
 */
function filterLogs(logs, keyword) {
  if (!keyword) return logs;
  
  return logs.filter(logEntry => {
    const lowerKeyword = keyword.toLowerCase();
    
    // 對於事件日誌
    if (logEntry.event) {
      const searchText = JSON.stringify(logEntry.event).toLowerCase();
      return searchText.includes(lowerKeyword);
    }
    
    // 對於應用程式日誌
    if (logEntry.message || logEntry.log || logEntry.content) {
      const message = (logEntry.message || logEntry.log || logEntry.content || '').toLowerCase();
      const level = (logEntry.level || '').toLowerCase();
      return message.includes(lowerKeyword) || level.includes(lowerKeyword);
    }
    
    // 對於未知格式
    const searchText = JSON.stringify(logEntry).toLowerCase();
    return searchText.includes(lowerKeyword);
  });
}

/**
 * 主函數
 */
async function main() {
  console.log('🔍 正在獲取 Render 日誌...\n');

  // 檢查必要的環境變數
  if (!config.serviceId) {
    console.error('❌ 錯誤: 請設置 RENDER_SERVICE_ID 環境變數');
    process.exit(1);
  }

  if (!config.apiToken) {
    console.error('❌ 錯誤: 請設置 RENDER_API_TOKEN 環境變數');
    process.exit(1);
  }

  console.log(`🔍 Service ID: ${config.serviceId}`);
  console.log(`🔑 API Token: ${config.apiToken.substring(0, 8)}...`);
  
  // 調試模式
  const debugMode = process.argv.includes('--debug');

  try {
    let logs = await getRenderLogs();
    
    if (debugMode) {
      console.log('🔍 調試模式 - 原始數據結構:');
      console.log(JSON.stringify(logs.slice(0, 2), null, 2));
      console.log('\n');
    }
    
    // 支援關鍵詞過濾
    const keyword = process.argv.includes('--filter') ? 
      process.argv[process.argv.indexOf('--filter') + 1] : null;
    
    if (keyword) {
      logs = filterLogs(logs, keyword);
      console.log(`🔎 已過濾關鍵詞: "${keyword}"\n`);
    }

    if (logs.length === 0) {
      console.log('📝 沒有找到日誌記錄');
      return;
    }

    console.log(`📋 顯示最近 ${logs.length} 條日誌:\n`);
    console.log(formatLogs(logs));

  } catch (error) {
    console.error(`❌ 獲取日誌失敗: ${error.message}`);
    process.exit(1);
  }
}

// 顯示使用說明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔧 Render 日誌獲取工具

使用方法:
  node scripts/get-render-logs.js [options]

選項:
  --limit <數量>    獲取的日誌條數 (預設: 50)
  --filter <關鍵詞>  過濾包含關鍵詞的日誌
  --help, -h       顯示此說明

環境變數:
  RENDER_SERVICE_ID   你的 Render 服務 ID
  RENDER_API_TOKEN    你的 Render API Token

範例:
  node scripts/get-render-logs.js --limit 100
  node scripts/get-render-logs.js --filter "每週二"
  node scripts/get-render-logs.js --filter "ERROR" --limit 20
  `);
  process.exit(0);
}

// 執行主函數
main();