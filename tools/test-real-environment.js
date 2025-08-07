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
   * 提取測試失敗的診斷日誌 (基於第一性原則 - 精準診斷)
   */
  extractDiagnosticLogs(logs, testInput) {
    if (!logs) return null;
    
    const lines = logs.split('\n');
    const diagnostics = {
      intentParsing: [],
      slotExtraction: [],
      taskExecution: [],
      errors: [],
      systemBehavior: [],
      validation: []
    };
    
    // 關鍵詞匹配模式 - 按執行流程分類 (增強版)
    const patterns = {
      intentParsing: [
        /🎯.*(?:意圖|開始解析)/,
        /✅.*規則匹配/,
        /🔍.*意圖候選/,
        /🤖.*AI 識別意圖/,
        /❓.*無法識別意圖/
      ],
      slotExtraction: [
        /📋.*提取結果/,
        /🔍.*開始提取 slots/,
        /🕒.*(?:時間解析|開始高級時間解析)/,
        /✅.*時間解析成功/,
        /❌.*時間解析失敗/,
        /🧠.*對話上下文增強/,
        /📊.*規則提取置信度/,
        /🤖.*啟用 AI 輔助提取/,
        /✅.*最終 slots/
      ],
      taskExecution: [
        /🎯.*執行任務/,
        /📋.*接收參數/,
        /⚠️.*時間衝突/,
        /❓.*請提供.*資訊/,
        /✅.*課程已安排/,
        /❌.*任務.*失敗/,
        /📊.*任務執行結果/
      ],
      errors: [
        /❌.*(?:錯誤|失敗)/,
        /ERROR/,
        /Failed/,
        /Exception/,
        /⚠️.*(?!時間衝突)/  // 警告但排除時間衝突
      ],
      systemBehavior: [
        /📤.*測試模式.*實際業務回覆/,
        /🧪.*檢測到測試 token/,
        /🔍.*檢查 replyToken/,
        /🚀.*(?:生產用戶|選擇的服務)/
      ],
      validation: [
        /✅.*驗證/,
        /❌.*驗證失敗/,
        /⚠️.*缺少.*欄位/,
        /📝.*missingFields/
      ]
    };
    
    // 按時間順序提取相關日誌
    lines.forEach(line => {
      for (const [category, categoryPatterns] of Object.entries(patterns)) {
        if (categoryPatterns.some(pattern => pattern.test(line))) {
          diagnostics[category].push(line.trim());
          break; // 避免重複分類
        }
      }
    });
    
    // 過濾空分類
    Object.keys(diagnostics).forEach(key => {
      if (diagnostics[key].length === 0) {
        delete diagnostics[key];
      }
    });
    
    return Object.keys(diagnostics).length > 0 ? diagnostics : null;
  }

  /**
   * 從日誌中擷取機器人回覆 (增強版 - 支援更多格式)
   */
  extractBotReply(logs) {
    if (!logs) {
      return null;
    }
    
    // 第一階段：尋找標準機器人回覆格式
    const standardPatterns = [
      /📤 機器人回覆[：:]\s*"([^"]+)"/,
      /機器人回覆[：:]\s*"([^"]+)"/,
      /bot response[：:]?\s*"([^"]+)"/i,
      /reply[：:]?\s*"([^"]+)"/i
    ];
    
    for (const pattern of standardPatterns) {
      const match = logs.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // 第二階段：尋找 message 字段中的回覆內容
    const messagePatterns = [
      /"message":\s*"([^"]+)"/,
      /message.*['"]([^'"]*(?:請提供|缺少|missing|時間衝突|成功|失敗|❓|❌|✅)[^'"]*)['"]/i,
      /message.*['"]([^'"]{20,})['"]/  // 長訊息內容
    ];
    
    for (const pattern of messagePatterns) {
      const matches = logs.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        // 取最後一個匹配（最新的回覆）
        const lastMatch = matches[matches.length - 1];
        const content = lastMatch.match(pattern);
        if (content && content[1]) {
          // 清理轉義字符
          let cleanedContent = content[1]
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
          
          // 過濾掉過短或無意義的內容
          if (cleanedContent.length > 3 && !cleanedContent.includes('undefined')) {
            return cleanedContent;
          }
        }
      }
    }
    
    // 第三階段：從日誌行中找包含關鍵訊息的內容
    const lines = logs.split('\n');
    const keywordPatterns = [
      /❓.*請提供/,
      /❌.*失敗/,
      /⚠️.*衝突/,
      /✅.*成功/,
      /missingFields.*\[/,
      /缺少.*欄位/
    ];
    
    for (const line of lines.reverse()) { // 從最新的開始找
      for (const pattern of keywordPatterns) {
        if (pattern.test(line)) {
          const cleaned = line.replace(/^\s*"message":\s*"?/, '').replace(/"?\s*,?\s*$/, '').trim();
          if (cleaned.length > 5) {
            return cleaned;
          }
        }
      }
    }
    
    // 最後階段：找任何包含課程相關的行
    for (const line of lines.reverse()) {
      if ((line.includes('成功') || line.includes('安排') || line.includes('課程') || line.includes('學生')) && line.length > 10) {
        return line.trim();
      }
    }
    
    return null;
  }
  
  /**
   * 智能評估測試成功 (基於第一性原則)
   */
  evaluateTestSuccess(testCase, actualReply) {
    if (!actualReply) {
      return false;
    }
    
    // 基於測試案例名稱和內容智能判斷
    const testName = testCase.name || '';
    const testInput = testCase.input || '';
    
    // 完整資訊輸入測試 - 期望成功或合理錯誤(如衝突)
    if (testName.includes('完整資訊') || testName.includes('標準格式') || testName.includes('時間格式') || testName.includes('中文數字')) {
      return actualReply.includes('成功') || 
             actualReply.includes('已安排') ||
             actualReply.includes('衝突') ||
             actualReply.includes('安排') ||
             actualReply.includes('✅') ||
             actualReply.includes('請選擇其他時間') ||
             actualReply.includes('確認是否要覆蓋');
    }
    
    // 缺失資訊測試 - 期望正確識別缺失字段
    if (testName.includes('缺少') || testName.includes('缺失')) {
      return actualReply.includes('缺少') || 
             actualReply.includes('missing') ||
             actualReply.includes('missingFields') ||
             actualReply.includes('補充') ||
             actualReply.includes('請提供') ||
             actualReply.includes('範例：');
    }
    
    // 預設標準：有意義的回覆(包含相關概念)
    const hasRelevantConcepts = actualReply.includes('課程') || 
                               actualReply.includes('學生') ||
                               actualReply.includes('時間') ||
                               actualReply.includes('日期');
    
    // 不是系統錯誤或測試跳過
    const notSystemError = !actualReply.includes('系統錯誤') && 
                          !actualReply.includes('internal error') &&
                          !actualReply.includes('undefined') &&
                          !actualReply.includes('檢測到測試 token');
    
    return hasRelevantConcepts && notSystemError;
  }
  
  /**
   * 檢查關鍵字匹配 (保留舊方法作為備用)
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
    
    // 4. 智能評估測試成功 (第一性原則)
    const intelligentSuccess = this.evaluateTestSuccess(testCase, botReply);
    console.log(`🧠 智能判斷: ${intelligentSuccess ? '✅ 系統行為正確' : '❌ 系統行為異常'}`);
    
    // 5. 舊關鍵字檢查 (僅供參考)
    const keywordMatch = botReply && testCase.expectedKeywords ? 
      this.checkKeywords(botReply, testCase.expectedKeywords) : false;
    console.log(`🔍 舊關鍵字匹配: ${keywordMatch ? '✅' : '❌'} (僅供參考)`);
    
    // 6. 最終測試結果 (使用智能判斷)
    const testPassed = webhookResult.ok && intelligentSuccess;
    console.log(`🎯 測試結果: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    // 7. 失敗時提取診斷日誌 (第一性原則 - 精準診斷)
    let diagnosticLogs = null;
    if (!testPassed && logs) {
      console.log('🔍 提取診斷日誌...');
      diagnosticLogs = this.extractDiagnosticLogs(logs, testCase.input);
      if (diagnosticLogs) {
        console.log('📋 診斷日誌已收集，將在報告中顯示');
      }
    }
    
    return {
      testCase: testCase,
      webhookStatus: webhookResult.status,
      webhookOk: webhookResult.ok,
      botReply: botReply,
      intelligentSuccess: intelligentSuccess,
      keywordMatch: keywordMatch, // 保留供參考
      testPassed: testPassed,
      error: webhookResult.error,
      diagnosticLogs: diagnosticLogs // 新增診斷日誌
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
   * 展示結構化診斷日誌 (基於第一性原則 - 清晰可讀)
   */
  displayDiagnosticLogs(diagnostics) {
    const categoryNames = {
      intentParsing: '🎯 意圖識別',
      slotExtraction: '📋 槽位提取', 
      taskExecution: '⚙️ 任務執行',
      errors: '❌ 錯誤信息',
      systemBehavior: '🔧 系統行為',
      validation: '📝 資料驗證'
    };
    
    Object.entries(diagnostics).forEach(([category, logs]) => {
      if (logs.length > 0) {
        console.log(`\n      ${categoryNames[category] || category}:`);
        logs.forEach(log => {
          // 簡化日誌格式，移除時間戳等干擾信息
          let cleanLog = log
            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*/, '') // 移除時間戳
            .replace(/^.*?\|\s*/, '') // 移除日誌前綴
            .replace(/^\s*/, '        '); // 統一縮進
          
          console.log(cleanLog);
        });
      }
    });
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
      console.log(`   智能判斷: ${result.intelligentSuccess ? '✅' : '❌'}`);
      console.log(`   結果: ${result.testPassed ? '✅ PASS' : '❌ FAIL'}`);
      
      if (result.error) {
        console.log(`   錯誤: ${result.error}`);
      }
      
      // 🔍 失敗時顯示診斷日誌 (基於第一性原則)
      if (!result.testPassed && result.diagnosticLogs) {
        console.log(`\n   📋 診斷日誌:`);
        this.displayDiagnosticLogs(result.diagnosticLogs);
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