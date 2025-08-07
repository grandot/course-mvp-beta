#!/usr/bin/env node

/**
 * 真實環境測試工具
 * 測試部署在 Render 上的 LINE Bot webhook 完整流程
 */

require('dotenv').config();
const crypto = require('crypto');
const fetch = require('node-fetch');

/**
 * 真實環境測試器
 */
class RealEnvironmentTester {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.lineChannelSecret = process.env.LINE_CHANNEL_SECRET;
    this.renderApiKey = process.env.RENDER_API_KEY;
    this.renderServiceId = process.env.RENDER_SERVICE_ID;
    
    this.validateConfig();
  }
  
  /**
   * 驗證配置
   */
  validateConfig() {
    const requiredVars = {
      'WEBHOOK_URL': this.webhookUrl,
      'LINE_CHANNEL_SECRET': this.lineChannelSecret,
      'RENDER_API_KEY': this.renderApiKey,
      'RENDER_SERVICE_ID': this.renderServiceId
    };
    
    for (const [name, value] of Object.entries(requiredVars)) {
      if (!value) {
        throw new Error(`❌ 缺少環境變數: ${name}`);
      }
    }
    
    console.log('✅ 環境變數檢查通過');
  }
  
  /**
   * 生成 LINE 簽章
   */
  generateLineSignature(body) {
    return crypto
      .createHmac('SHA256', this.lineChannelSecret)
      .update(body)
      .digest('base64');
  }
  
  /**
   * 構造 LINE webhook payload
   */
  createWebhookPayload(message) {
    return {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: message
        },
        source: {
          userId: 'U_real_env_test',
          type: 'user'
        },
        replyToken: 'test-reply-token-' + Date.now(),
        timestamp: Date.now()
      }]
    };
  }
  
  /**
   * 發送 webhook 請求
   */
  async sendWebhookRequest(testCase) {
    const payload = this.createWebhookPayload(testCase.input);
    const bodyString = JSON.stringify(payload);
    const signature = this.generateLineSignature(bodyString);
    
    console.log(`📡 發送 webhook 請求到: ${this.webhookUrl}`);
    console.log(`💬 測試訊息: "${testCase.input}"`);
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Line-Signature': signature,
          'User-Agent': 'LineBotWebhook/2.0'
        },
        body: bodyString,
        timeout: 15000 // 15秒超時
      });
      
      console.log(`📊 Webhook 狀態碼: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Webhook 錯誤: ${errorText}`);
      }
      
      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      };
      
    } catch (error) {
      console.log(`❌ Webhook 請求失敗: ${error.message}`);
      return {
        status: 0,
        ok: false,
        error: error.message
      };
    }
  }
  
  /**
   * 獲取 Render 日誌
   */
  async fetchRenderLogs() {
    console.log('📋 獲取 Render 日誌...');
    
    try {
      // 方法 1: 使用 Render CLI (推薦)
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync(
          `render logs -r ${this.renderServiceId} --limit 10 -o json`,
          { timeout: 10000 }
        );
        
        // 解析 JSON Lines 格式的日誌
        const logLines = stdout.trim().split('\n').filter(line => line.trim());
        const logs = logLines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        });
        
        console.log(`✅ 通過 CLI 獲取到 ${logs.length} 條日誌`);
        
        // 組合所有日誌訊息
        const logMessages = logs.map(entry => entry.message).join('\n');
        return logMessages;
        
      } catch (cliError) {
        console.log(`⚠️  CLI 方法失敗: ${cliError.message}`);
        
        // 方法 2: 回退到 API 方法
        const response = await fetch(
          `https://api.render.com/v1/services/${this.renderServiceId}/logs?limit=50`,
          {
            headers: {
              'Authorization': `Bearer ${this.renderApiKey}`,
              'Accept': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Render API 錯誤: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const logs = data.map(entry => entry.message).join('\n');
        console.log(`✅ 通過 API 獲取到日誌`);
        return logs;
      }
      
    } catch (error) {
      console.log(`❌ 獲取日誌失敗: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 從日誌中擷取機器人回覆
   */
  extractBotReply(logs) {
    if (!logs) {
      return null;
    }
    
    // 尋找機器人回覆的模式
    const patterns = [
      /📤 機器人回覆[：:]\s*"([^"]+)"/,
      /機器人回覆[：:]\s*"([^"]+)"/,
      /bot response[：:]?\s*"([^"]+)"/i,
      /reply[：:]?\s*"([^"]+)"/i
    ];
    
    for (const pattern of patterns) {
      const match = logs.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // 如果沒有找到特定格式，嘗試找包含成功關鍵字的行
    const lines = logs.split('\n');
    for (const line of lines.reverse()) { // 從最新的開始找
      if (line.includes('成功') || line.includes('安排') || line.includes('課程')) {
        return line.trim();
      }
    }
    
    return null;
  }
  
  /**
   * 檢查關鍵字匹配
   */
  checkKeywords(reply, expectedKeywords) {
    if (!reply) {
      return false;
    }
    
    return expectedKeywords.every(keyword => 
      reply.includes(keyword)
    );
  }
  
  /**
   * 執行單個測試
   */
  async runSingleTest(testCase) {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 測試案例: ${testCase.name || '未命名測試'}`);
    console.log('='.repeat(60));
    
    // 1. 發送 webhook 請求
    const webhookResult = await this.sendWebhookRequest(testCase);
    
    // 等待處理完成
    console.log('⏳ 等待 3 秒讓服務處理...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. 獲取日誌
    const logs = await this.fetchRenderLogs();
    
    // 3. 擷取機器人回覆
    const botReply = this.extractBotReply(logs);
    console.log(`🤖 機器人回覆: ${botReply || '(未找到回覆)'}`);
    
    // 4. 檢查關鍵字
    const keywordMatch = this.checkKeywords(botReply, testCase.expectedKeywords);
    console.log(`🔍 預期關鍵字: [${testCase.expectedKeywords.join(', ')}]`);
    console.log(`✨ 關鍵字匹配: ${keywordMatch ? '✅' : '❌'}`);
    
    // 5. 判斷測試結果
    const testPassed = webhookResult.ok && botReply && keywordMatch;
    console.log(`🎯 測試結果: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      testCase: testCase,
      webhookStatus: webhookResult.status,
      webhookOk: webhookResult.ok,
      botReply: botReply,
      keywordMatch: keywordMatch,
      testPassed: testPassed,
      error: webhookResult.error
    };
  }
  
  /**
   * 執行所有測試
   */
  async runAllTests(testCases) {
    console.log('🚀 開始真實環境測試');
    console.log(`📡 Webhook URL: ${this.webhookUrl}`);
    console.log(`🖥️  Render Service: ${this.renderServiceId}`);
    
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      try {
        const result = await this.runSingleTest(testCase);
        results.push(result);
        
        // 測試間隔
        if (i < testCases.length - 1) {
          console.log('\n⏳ 等待 5 秒後繼續下一個測試...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error) {
        console.log(`❌ 測試執行失敗: ${error.message}`);
        results.push({
          testCase: testCase,
          error: error.message,
          testPassed: false
        });
      }
    }
    
    return results;
  }
  
  /**
   * 生成測試報告
   */
  generateReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 真實環境測試報告');
    console.log('='.repeat(80));
    
    results.forEach((result, index) => {
      console.log(`\n🧪 測試 ${index + 1}: ${result.testCase.name || '未命名'}`);
      console.log(`   輸入: "${result.testCase.input}"`);
      console.log(`   Webhook: ${result.webhookStatus} ${result.webhookOk ? '✅' : '❌'}`);
      console.log(`   回覆: ${result.botReply || '(無)'}`);
      console.log(`   關鍵字: ${result.keywordMatch ? '✅' : '❌'}`);
      console.log(`   結果: ${result.testPassed ? '✅ PASS' : '❌ FAIL'}`);
      
      if (result.error) {
        console.log(`   錯誤: ${result.error}`);
      }
    });
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.testPassed).length;
    const passRate = Math.round((passedTests / totalTests) * 100);
    
    console.log('\n📈 測試統計:');
    console.log(`   總測試數: ${totalTests}`);
    console.log(`   通過數: ${passedTests}`);
    console.log(`   失敗數: ${totalTests - passedTests}`);
    console.log(`   通過率: ${passRate}%`);
    
    if (passRate === 100) {
      console.log('\n🎉 所有測試通過！真實環境運行正常');
    } else {
      console.log(`\n⚠️  有 ${totalTests - passedTests} 個測試失敗，請檢查日誌`);
    }
  }
}

/**
 * 預設測試案例
 */
const defaultTestCases = [
  {
    name: '新增課程測試',
    input: '小明每週三下午3點數學課',
    expectedKeywords: ['課程', '安排', '成功']
  },
  {
    name: '查詢課程測試',
    input: '查詢小明的課程',
    expectedKeywords: ['小明', '課程']
  },
  {
    name: '每日重複課程',
    input: '小美每天早上8點晨練課',
    expectedKeywords: ['課程', '成功', '每天']
  }
];

/**
 * 主程式
 */
async function main() {
  try {
    const tester = new RealEnvironmentTester();
    
    // 可以從命令列參數或使用預設測試
    const testCases = defaultTestCases;
    
    const results = await tester.runAllTests(testCases);
    tester.generateReport(results);
    
    // 根據測試結果設定 exit code
    const allPassed = results.every(r => r.testPassed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ 測試工具執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  console.log('🧪 真實環境測試工具啟動');
  console.log('📋 檢查環境變數...');
  
  main().catch(error => {
    console.error('❌ 未處理的錯誤:', error);
    process.exit(1);
  });
}

module.exports = { RealEnvironmentTester };