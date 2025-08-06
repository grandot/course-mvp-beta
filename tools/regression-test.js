#!/usr/bin/env node

/**
 * 核心功能回歸測試 - 評估修改後的系統風險
 * 專注測試：我的修改是否破壞了現有的5個核心功能
 */

require('dotenv').config();

// 測試案例：模擬真實用戶完整輸入
const CORE_TEST_CASES = [
  {
    name: "新增課程 - 完整輸入",
    message: "小明每週三下午3點數學課",
    expectedIntent: "add_course",
    shouldSuccess: true
  },
  {
    name: "查詢課程 - 完整輸入", 
    message: "查詢小明今天的課程",
    expectedIntent: "query_schedule",
    shouldSuccess: true
  },
  {
    name: "記錄內容 - 完整輸入",
    message: "今天小明的數學課學了分數",
    expectedIntent: "record_content", 
    shouldSuccess: true
  },
  {
    name: "設定提醒 - 完整輸入",
    message: "提醒我小明的數學課",
    expectedIntent: "set_reminder",
    shouldSuccess: true
  },
  {
    name: "取消課程 - 完整輸入",
    message: "取消小明明天的數學課", 
    expectedIntent: "cancel_course",
    shouldSuccess: true
  }
];

// 邊界測試：我的修改可能影響的情況
const EDGE_TEST_CASES = [
  {
    name: "正常對話 - 不應觸發期待輸入",
    message: "你好",
    expectedIntent: "unknown", 
    shouldNotTriggerPending: true
  },
  {
    name: "完整輸入 - 不應等待補充",
    message: "小光明天早上10點英文課",
    expectedIntent: "add_course",
    shouldNotTriggerPending: true  
  },
  {
    name: "切換話題 - 應該清理狀態",
    sequence: [
      "小明", // 觸發補充
      "查詢課程" // 切換話題，應該不受影響
    ]
  }
];

class RegressionTester {
  constructor() {
    this.results = {
      coreFeatures: [],
      edgeCases: [],
      systemHealth: {}
    };
  }

  async runTest() {
    console.log('🧪 開始核心功能回歸測試...\n');
    
    // 1. 測試核心功能是否被破壞
    await this.testCoreFeatures();
    
    // 2. 測試邊界情況
    await this.testEdgeCases();
    
    // 3. 評估系統健康度
    await this.evaluateSystemHealth();
    
    // 4. 生成風險報告
    this.generateRiskReport();
  }

  async testCoreFeatures() {
    console.log('📋 測試核心功能...');
    
    for (const testCase of CORE_TEST_CASES) {
      console.log(`\n🔬 ${testCase.name}`);
      console.log(`👤 輸入: "${testCase.message}"`);
      
      try {
        const result = await this.processMessage(testCase.message, 'test-user');
        
        const success = result.intent === testCase.expectedIntent;
        console.log(`🎯 意圖: ${result.intent} ${success ? '✅' : '❌'}`);
        
        this.results.coreFeatures.push({
          ...testCase,
          actualIntent: result.intent,
          success: success,
          error: result.error
        });
        
      } catch (error) {
        console.log(`❌ 錯誤: ${error.message}`);
        this.results.coreFeatures.push({
          ...testCase,
          success: false,
          error: error.message
        });
      }
    }
  }

  async testEdgeCases() {
    console.log('\n\n📋 測試邊界情況...');
    
    for (const testCase of EDGE_TEST_CASES) {
      console.log(`\n🔬 ${testCase.name}`);
      
      try {
        if (testCase.sequence) {
          // 測試序列對話
          for (let i = 0; i < testCase.sequence.length; i++) {
            const message = testCase.sequence[i];
            console.log(`👤 [${i+1}] 輸入: "${message}"`);
            const result = await this.processMessage(message, 'edge-test-user');
            console.log(`🎯 [${i+1}] 意圖: ${result.intent}`);
          }
        } else {
          // 測試單一輸入
          console.log(`👤 輸入: "${testCase.message}"`);
          const result = await this.processMessage(testCase.message, 'edge-test-user');
          
          const intentMatch = result.intent === testCase.expectedIntent;
          console.log(`🎯 意圖: ${result.intent} ${intentMatch ? '✅' : '❌'}`);
          
          this.results.edgeCases.push({
            ...testCase,
            actualIntent: result.intent,
            success: intentMatch
          });
        }
        
      } catch (error) {
        console.log(`❌ 錯誤: ${error.message}`);
        this.results.edgeCases.push({
          ...testCase,
          success: false,
          error: error.message
        });
      }
    }
  }

  async evaluateSystemHealth() {
    console.log('\n\n📊 評估系統健康度...');
    
    // Redis 連接測試
    try {
      const { getRedisService } = require('../src/services/redisService');
      const redisService = getRedisService();
      
      const startTime = Date.now();
      const health = await redisService.healthCheck();
      const redisLatency = Date.now() - startTime;
      
      console.log(`🔗 Redis 延遲: ${redisLatency}ms`);
      console.log(`🔗 Redis 狀態: ${health.status}`);
      this.results.systemHealth.redisLatency = redisLatency;
      this.results.systemHealth.redisStatus = health.status;
      
    } catch (error) {
      console.log(`❌ Redis 連接失敗: ${error.message}`);
      this.results.systemHealth.redisError = error.message;
    }
    
    // 記憶體使用評估
    const memUsage = process.memoryUsage();
    console.log(`💾 記憶體使用: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    this.results.systemHealth.memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  async processMessage(message, userId) {
    // 簡化版的訊息處理 - 只測試意圖識別
    const { parseIntent } = require('../src/intent/parseIntent');
    
    try {
      const intent = await parseIntent(message, userId);
      return { intent };
    } catch (error) {
      return { intent: 'error', error: error.message };
    }
  }

  generateRiskReport() {
    console.log('\n\n🔥 風險評估報告');
    console.log('================');
    
    // 核心功能風險
    const coreFailures = this.results.coreFeatures.filter(r => !r.success);
    const coreRisk = coreFailures.length / this.results.coreFeatures.length;
    
    console.log(`\n📊 核心功能風險: ${Math.round(coreRisk * 100)}%`);
    if (coreFailures.length > 0) {
      console.log('❌ 失敗的功能:');
      coreFailures.forEach(f => console.log(`   - ${f.name}: ${f.error || '意圖識別錯誤'}`));
    } else {
      console.log('✅ 所有核心功能正常');
    }
    
    // 系統性能風險
    console.log(`\n⚡ 性能影響:`);
    if (this.results.systemHealth.redisLatency) {
      const latencyRisk = this.results.systemHealth.redisLatency > 100 ? '高' : '低';
      console.log(`   Redis 延遲: ${this.results.systemHealth.redisLatency}ms (風險: ${latencyRisk})`);
    }
    
    // 總體風險評級
    let riskLevel = '低';
    if (coreRisk > 0.5) riskLevel = '極高';
    else if (coreRisk > 0.2) riskLevel = '高';
    else if (coreRisk > 0) riskLevel = '中等';
    
    console.log(`\n🎯 總體風險評級: ${riskLevel}`);
    
    // 建議
    console.log(`\n💡 建議:`);
    if (coreRisk > 0) {
      console.log('   - 🚨 立即回滾修改，修復核心功能');
      console.log('   - 🔧 簡化實現方案');
    } else {
      console.log('   - ✅ 核心功能未受影響');
      console.log('   - 🔍 繼續監控系統性能');
    }
  }
}

// 執行測試
if (require.main === module) {
  const tester = new RegressionTester();
  tester.runTest().catch(console.error);
}

module.exports = { RegressionTester };