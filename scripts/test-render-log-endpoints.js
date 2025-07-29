#!/usr/bin/env node

/**
 * 测试所有可能的Render日志API端点
 */

require('dotenv').config();
const https = require('https');

const config = {
  serviceId: process.env.RENDER_SERVICE_ID,
  apiToken: process.env.RENDER_API_TOKEN
};

// 所有可能的端点
const endpoints = [
  // 基本日志端点
  `/v1/services/${config.serviceId}/logs`,
  `/v1/services/${config.serviceId}/application-logs`, 
  `/v1/services/${config.serviceId}/app-logs`,
  `/v1/services/${config.serviceId}/runtime-logs`,
  
  // 事件端点（已知工作）
  `/v1/services/${config.serviceId}/events`,
  
  // 其他可能的格式
  `/v1/logs/${config.serviceId}`,
  `/logs/${config.serviceId}`,
  `/v1/services/${config.serviceId}/deployments/logs`,
  
  // GraphQL（需要POST）
  '/graphql'
];

function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.render.com',
      path: path + '?limit=5', // 只要5条测试
      method: method,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    console.log(`\n🔍 测试: ${method} https://api.render.com${path}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`   状态: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          console.log(`   ✅ 成功！数据预览:`);
          try {
            const parsed = JSON.parse(data);
            console.log(`   ${JSON.stringify(parsed, null, 2).substring(0, 200)}...`);
          } catch (e) {
            console.log(`   ${data.substring(0, 200)}...`);
          }
        } else {
          console.log(`   ❌ 失败: ${data.substring(0, 100)}`);
        }
        
        resolve({ 
          endpoint: path, 
          status: res.statusCode, 
          success: res.statusCode === 200,
          data: res.statusCode === 200 ? data : null
        });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ 网络错误: ${error.message}`);
      resolve({ endpoint: path, status: 'ERROR', success: false });
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function main() {
  console.log('🚀 开始测试所有Render日志API端点...');
  console.log(`Service ID: ${config.serviceId}`);
  console.log(`API Token: ${config.apiToken.substring(0, 8)}...`);

  const results = [];
  
  // 测试所有GET端点
  for (const endpoint of endpoints.slice(0, -1)) { // 除了GraphQL
    const result = await testEndpoint(endpoint);
    results.push(result);
  }
  
  // 测试GraphQL
  const graphqlQuery = JSON.stringify({
    query: `{
      service(id: "${config.serviceId}") {
        id
        name
        logs(first: 5) {
          edges {
            node {
              id
              message
              timestamp
            }
          }
        }
      }
    }`
  });
  
  const graphqlResult = await testEndpoint('/graphql', 'POST', graphqlQuery);
  results.push(graphqlResult);

  // 总结
  console.log('\n📊 测试结果总结:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`\n✅ 成功的端点 (${successful.length}个):`);
    successful.forEach(r => {
      console.log(`   ${r.endpoint}`);
    });
  }
  
  console.log(`\n❌ 失败的端点 (${failed.length}个):`);
  failed.forEach(r => {
    console.log(`   ${r.endpoint} (${r.status})`);
  });
  
  if (successful.length === 0) {
    console.log('\n🤔 建议:');
    console.log('1. 检查API Key权限');
    console.log('2. 尝试Render Dashboard直接查看');
    console.log('3. 联系Render支持确认日志API');
  }
}

main().catch(console.error);