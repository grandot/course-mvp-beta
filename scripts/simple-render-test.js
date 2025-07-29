#!/usr/bin/env node

/**
 * 簡化的Render API測試 - 找出正確的API格式
 */

require('dotenv').config();
const https = require('https');

const config = {
  serviceId: process.env.RENDER_SERVICE_ID,
  apiToken: process.env.RENDER_API_TOKEN
};

function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json'
      }
    };

    console.log(`Testing: https://api.render.com${path}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log('✅ Success!');
          console.log(data.substring(0, 200) + '...');
        } else {
          console.log(`❌ Failed: ${data.substring(0, 100)}`);
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request failed: ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 測試Render API端點...\n');

  const testEndpoints = [
    `/v1/services/${config.serviceId}`,  // 基本服務信息
    `/v1/services`,                      // 服務列表
    `/v1/owners/me`,                     // 用戶信息
  ];

  for (const endpoint of testEndpoints) {
    try {
      await testEndpoint(endpoint);
      console.log('---\n');
    } catch (error) {
      console.log(`Error testing ${endpoint}: ${error.message}\n`);
    }
  }
}

main().catch(console.error);