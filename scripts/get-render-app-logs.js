#!/usr/bin/env node

/**
 * Render 應用程序日誌獲取工具 - 使用正確的API格式
 * 基於官方Render MCP server的list_logs功能
 */

require('dotenv').config();
const https = require('https');

// 配置項
const config = {
  serviceId: process.env.RENDER_SERVICE_ID,
  apiToken: process.env.RENDER_API_TOKEN,
  limit: process.argv.includes('--limit') ? 
    parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : 50,
  startTime: process.argv.includes('--start') ?
    process.argv[process.argv.indexOf('--start') + 1] : null,
  endTime: process.argv.includes('--end') ?
    process.argv[process.argv.indexOf('--end') + 1] : null,
  level: process.argv.includes('--level') ?
    process.argv[process.argv.indexOf('--level') + 1] : null,
  filter: process.argv.includes('--filter') ?
    process.argv[process.argv.indexOf('--filter') + 1] : null
};

/**
 * 獲取 Render 應用程序日誌 - 使用正確的v1 API
 */
async function getRenderApplicationLogs() {
  // 構建查詢參數
  const queryParams = new URLSearchParams();
  queryParams.append('limit', config.limit.toString());
  
  if (config.startTime) {
    queryParams.append('startTime', config.startTime);
  }
  
  if (config.endTime) {
    queryParams.append('endTime', config.endTime);
  }
  
  if (config.level) {
    queryParams.append('level', config.level);
  }

  // 使用正確的Render API端點
  queryParams.append('resource', config.serviceId); // resource參數是必需的
  
  // 獲取 ownerId
  const servicesResponse = await makeRequest('/v1/services', 'GET');
  const ownerId = servicesResponse[0]?.service?.ownerId;
  
  if (!ownerId) {
    throw new Error('無法獲取 ownerId');
  }
  
  // 構建正確的日誌查詢參數
  const logQueryParams = new URLSearchParams();
  logQueryParams.append('ownerId', ownerId);
  logQueryParams.append('resource', config.serviceId);
  logQueryParams.append('limit', config.limit.toString());
  
  if (config.startTime) {
    logQueryParams.append('startTime', config.startTime);
  }
  
  if (config.endTime) {
    logQueryParams.append('endTime', config.endTime);
  }
  
  if (config.level) {
    logQueryParams.append('level', config.level);
  }

  const endpoints = [
    // 正確的 Render 日誌 API 端點
    `/v1/logs?${logQueryParams.toString()}`,
    // 備選：服務事件端點
    `/v1/services/${config.serviceId}/events?limit=${config.limit}`,
  ];

  for (let i = 0; i < endpoints.length - 1; i++) { // 跳過GraphQL暫時
    const endpoint = endpoints[i];
    console.log(`🔍 嘗試應用程序日誌端點 ${i + 1}: ${endpoint}`);
    
    try {
      const logs = await makeRequest(endpoint, 'GET');
      console.log(`✅ 成功獲取應用程序日誌！使用端點: ${endpoint}\n`);
      return logs;
    } catch (error) {
      console.log(`❌ 端點失敗: ${error.message}`);
      
      // 如果是權限問題，提供詳細信息
      if (error.message.includes('401') || error.message.includes('403')) {
        console.log(`🔑 權限問題 - 檢查 RENDER_API_TOKEN 是否正確`);
      }
      
      if (i === endpoints.length - 2) {
        console.log('🚫 所有REST端點都失敗，嘗試GraphQL方式...\n');
      }
    }
  }

  // 嘗試GraphQL查詢（最後手段）
  try {
    console.log('🔍 嘗試GraphQL查詢方式...');
    return await getLogsViaGraphQL();
  } catch (error) {
    console.log(`❌ GraphQL也失敗: ${error.message}`);
    throw new Error('所有獲取日誌的方式都失敗了');
  }
}

/**
 * 使用GraphQL獲取日誌
 */
async function getLogsViaGraphQL() {
  const query = `
    query GetServiceLogs($serviceId: String!, $limit: Int) {
      service(id: $serviceId) {
        id
        name
        logs(first: $limit) {
          edges {
            node {
              id
              timestamp
              level
              message
              type
            }
          }
        }
      }
    }
  `;

  const variables = {
    serviceId: config.serviceId,
    limit: config.limit
  };

  const payload = JSON.stringify({
    query,
    variables
  });

  return makeRequest('/graphql', 'POST', payload, {
    'Content-Type': 'application/json'
  });
}

/**
 * 發送HTTP請求
 */
function makeRequest(path, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
        'User-Agent': 'RenderAppLogsClient/1.0',
        ...extraHeaders
      }
    };

    console.log(`📡 發送 ${method} 請求到: https://api.render.com${path}`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 HTTP狀態: ${res.statusCode}`);
        console.log(`📋 響應頭: ${JSON.stringify(res.headers, null, 2)}`);
        
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            return;
          }
          
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          console.log(`📝 原始響應內容 (前500字符): ${data.substring(0, 500)}`);
          reject(new Error(`解析JSON失敗: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`請求失敗: ${error.message}`));
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * 格式化應用程序日誌
 */
function formatApplicationLogs(rawLogs) {
  // 處理不同的日誌格式
  let logs = [];

  if (rawLogs.logs) {
    logs = rawLogs.logs;
  } else if (rawLogs.data && rawLogs.data.service && rawLogs.data.service.logs) {
    // GraphQL 響應格式
    logs = rawLogs.data.service.logs.edges.map(edge => edge.node);
  } else if (Array.isArray(rawLogs)) {
    logs = rawLogs;
  } else {
    console.log('⚠️  未知的日誌格式，顯示原始數據:');
    return JSON.stringify(rawLogs, null, 2);
  }

  if (logs.length === 0) {
    return '📝 沒有找到應用程序日誌';
  }

  return logs.map(logEntry => {
    const timestamp = logEntry.timestamp ? 
      new Date(logEntry.timestamp).toLocaleString('zh-TW') : 
      new Date().toLocaleString('zh-TW');
    
    const level = (logEntry.level || 'INFO').toUpperCase();
    const message = logEntry.message || logEntry.text || JSON.stringify(logEntry);
    const type = logEntry.type ? ` [${logEntry.type}]` : '';
    
    // 添加相應的 emoji
    let emoji = '📝';
    if (level.includes('ERROR')) emoji = '❌';
    else if (level.includes('WARN')) emoji = '⚠️';
    else if (level.includes('DEBUG')) emoji = '🐛';
    else if (message.includes('POST') || message.includes('GET')) emoji = '📨';
    else if (message.includes('課程') || message.includes('課表')) emoji = '📚';
    
    return `[${timestamp}] ${emoji} ${level}${type}: ${message}`;
  }).join('\n');
}

/**
 * 過濾日誌
 */
function filterLogs(logs, keyword) {
  if (!keyword || !Array.isArray(logs)) return logs;
  
  const lowerKeyword = keyword.toLowerCase();
  return logs.filter(logEntry => {
    const searchText = JSON.stringify(logEntry).toLowerCase();
    return searchText.includes(lowerKeyword);
  });
}

/**
 * 主函數
 */
async function main() {
  console.log('🔍 正在獲取 Render 應用程序日誌...\n');

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
  console.log(`📊 限制條數: ${config.limit}`);
  
  if (config.level) console.log(`📋 日誌級別: ${config.level}`);
  if (config.filter) console.log(`🔎 關鍵詞過濾: ${config.filter}`);

  try {
    let rawLogs = await getRenderApplicationLogs();
    
    console.log(`\n📋 獲取到的原始數據結構:`);
    console.log(JSON.stringify(rawLogs, null, 2).substring(0, 500) + '...\n');

    // 過濾日誌
    if (config.filter && rawLogs.logs) {
      rawLogs.logs = filterLogs(rawLogs.logs, config.filter);
      console.log(`🔎 已過濾關鍵詞: "${config.filter}"\n`);
    }

    console.log(`📋 格式化的應用程序日誌:\n`);
    const formattedLogs = formatApplicationLogs(rawLogs);
    console.log(formattedLogs);

  } catch (error) {
    console.error(`❌ 獲取應用程序日誌失敗: ${error.message}`);
    
    console.log('\n🛠️  故障排除建議:');
    console.log('1. 檢查 RENDER_API_TOKEN 是否有效');
    console.log('2. 檢查 RENDER_SERVICE_ID 是否正確');
    console.log('3. 確認服務正在運行並產生日誌');
    console.log('4. 檢查API權限是否包含日誌讀取');
    
    process.exit(1);
  }
}

// 顯示使用說明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔧 Render 應用程序日誌獲取工具

使用方法:
  node scripts/get-render-app-logs.js [options]

選項:
  --limit <數量>       獲取的日誌條數 (預設: 50)  
  --level <級別>       過濾日誌級別 (ERROR, WARN, INFO, DEBUG)
  --filter <關鍵詞>     過濾包含關鍵詞的日誌
  --start <時間>       開始時間 (RFC3339格式)
  --end <時間>         結束時間 (RFC3339格式)
  --help, -h          顯示此說明

環境變數:
  RENDER_SERVICE_ID   你的 Render 服務 ID
  RENDER_API_TOKEN    你的 Render API Token

範例:
  node scripts/get-render-app-logs.js --limit 100
  node scripts/get-render-app-logs.js --level ERROR
  node scripts/get-render-app-logs.js --filter "課表" --limit 20
  node scripts/get-render-app-logs.js --start "2025-07-29T00:00:00Z"
  `);
  process.exit(0);
}

// 執行主函數
main();