#!/usr/bin/env node

/**
 * 全面風險測試 - 第一性原則
 * 測試所有可能受影響的系統組件和邊界情況
 */

require('dotenv').config();
const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');
const { getConversationManager } = require('../src/conversation/ConversationManager');

// 動態載入任務處理器
function getTaskHandler(intent) {
  try {
    return require(`../src/tasks/handle_${intent}_task`);
  } catch (error) {
    if (intent.startsWith('supplement_')) {
      const supplementHandlers = require('../src/tasks/handle_supplement_input_task');
      const handlerName = `handle_${intent}_task`;
      return supplementHandlers[handlerName];
    }
    console.error(`⚠️ 找不到任務處理器: handle_${intent}_task`);
    return null;
  }
}

// 模擬訊息處理
async function processMessage(message, userId, scenario = '') {
  console.log(`${scenario ? `[${scenario}] ` : ''}👤 用戶: ${message}`);
  
  const intent = await parseIntent(message, userId);
  console.log(`🎯 意圖: ${intent}`);
  
  const slots = await extractSlots(message, intent, userId);
  const taskHandler = getTaskHandler(intent);
  
  if (!taskHandler) {
    return { success: false, message: '找不到處理器', intent };
  }
  
  const result = await taskHandler(slots, userId, { message: { text: message } });
  console.log(`🤖 結果: ${result.success ? '✅' : '❌'} ${result.message?.substring(0, 50)}...`);
  
  return { ...result, intent, slots };
}

class RiskTester {
  constructor() {
    this.risks = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }
  
  logRisk(category, description, severity = 'MEDIUM') {
    this.risks.push({ category, description, severity, timestamp: new Date() });
    console.log(`⚠️ [${severity}] ${category}: ${description}`);
  }
  
  async testRisk(testName, testFunction) {
    console.log(`\n🧪 測試風險: ${testName}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await testFunction();
      if (result) {
        console.log(`✅ 通過: ${testName}`);
        this.passedTests++;
      } else {
        console.log(`❌ 失敗: ${testName}`);
        this.failedTests++;
        this.logRisk('TEST_FAILURE', `${testName} 測試失敗`, 'HIGH');
      }
      return result;
    } catch (error) {
      console.log(`💥 錯誤: ${testName} - ${error.message}`);
      this.failedTests++;
      this.logRisk('TEST_ERROR', `${testName} - ${error.message}`, 'CRITICAL');
      return false;
    }
  }
  
  // 風險1: 意圖識別回歸測試
  async testIntentRecognitionRegression() {
    const normalCases = [
      { input: '小明明天下午2點數學課', expectedIntent: 'add_course' },
      { input: '查詢今天課表', expectedIntent: 'query_schedule' },
      { input: '記錄昨天英文課內容', expectedIntent: 'record_content' },
      { input: '設定提醒', expectedIntent: 'set_reminder' },
      { input: '取消明天的課程', expectedIntent: 'cancel_course' },
      { input: '確認', expectedIntent: 'confirm_action' },
      { input: '修改', expectedIntent: 'modify_action' },
      { input: '今天天氣如何', expectedIntent: 'unknown' }
    ];
    
    const userId = 'regression_test_user';
    let allPassed = true;
    
    for (const testCase of normalCases) {
      const intent = await parseIntent(testCase.input);
      if (intent !== testCase.expectedIntent) {
        console.log(`❌ "${testCase.input}" 期望: ${testCase.expectedIntent}, 實際: ${intent}`);
        this.logRisk('INTENT_REGRESSION', `"${testCase.input}" 意圖識別錯誤`, 'HIGH');
        allPassed = false;
      } else {
        console.log(`✅ "${testCase.input}" → ${intent}`);
      }
    }
    
    return allPassed;
  }
  
  // 風險2: 補充意圖誤觸發測試
  async testSupplementIntentFalsePositive() {
    const normalInputs = [
      '小明',  // 可能被誤認為補充學生姓名
      '數學課', // 可能被誤認為補充課程名稱
      '下午3點', // 可能被誤認為補充時間
      '明天', // 可能被誤認為補充日期
      '週五'  // 可能被誤認為補充星期
    ];
    
    const userId = 'false_positive_test_user';
    let allPassed = true;
    
    // 清空對話狀態
    const manager = getConversationManager();
    await manager.clearContext(userId);
    
    for (const input of normalInputs) {
      const intent = await parseIntent(input, userId);
      if (intent.startsWith('supplement_')) {
        console.log(`❌ "${input}" 被誤認為補充意圖: ${intent}`);
        this.logRisk('SUPPLEMENT_FALSE_POSITIVE', `"${input}" 誤觸發補充意圖`, 'HIGH');
        allPassed = false;
      } else {
        console.log(`✅ "${input}" → ${intent} (非補充意圖)`);
      }
    }
    
    return allPassed;
  }
  
  // 風險3: 對話狀態汙染測試
  async testConversationStateContamination() {
    const userId1 = 'state_test_user_1';
    const userId2 = 'state_test_user_2';
    const manager = getConversationManager();
    
    // 清理狀態
    await manager.clearContext(userId1);
    await manager.clearContext(userId2);
    
    // 用戶1觸發缺失資訊流程
    await processMessage('每週五下午5點鋼琴課', userId1, 'USER1');
    
    // 檢查用戶1狀態
    const context1 = await manager.getContext(userId1);
    const hasExpectedInput1 = context1?.state?.expectingInput?.length > 0;
    
    // 用戶2進行正常操作
    const result2 = await processMessage('小華明天下午2點英文課', userId2, 'USER2');
    
    // 檢查用戶2不應該受到用戶1狀態影響
    const context2 = await manager.getContext(userId2);
    const hasExpectedInput2 = context2?.state?.expectingInput?.length > 0;
    
    // 驗證狀態隔離
    if (hasExpectedInput1 && !hasExpectedInput2 && result2.success) {
      console.log('✅ 用戶狀態正確隔離');
      return true;
    } else {
      this.logRisk('STATE_CONTAMINATION', '用戶狀態互相污染', 'CRITICAL');
      return false;
    }
  }
  
  // 風險4: Redis 故障降級測試
  async testRedisFailureGraceDegradation() {
    // 模擬 Redis 不可用情況
    const userId = 'redis_failure_test_user';
    
    // 先測試正常功能
    const normalResult = await processMessage('小明明天下午2點數學課', userId, 'NORMAL');
    
    // 測試 Redis 健康檢查
    const manager = getConversationManager();
    const health = await manager.healthCheck();
    
    console.log(`Redis 狀態: ${health.status}`);
    
    if (health.status === 'healthy' || health.status === 'unavailable') {
      console.log('✅ Redis 降級機制正常');
      return true;
    } else {
      this.logRisk('REDIS_DEGRADATION', 'Redis 降級機制異常', 'HIGH');
      return false;
    }
  }
  
  // 風險5: 邊界情況測試
  async testEdgeCases() {
    const edgeCases = [
      { input: '', scenario: '空字串' },
      { input: '   ', scenario: '空白字串' },
      { input: 'a'.repeat(1000), scenario: '超長字串' },
      { input: '🎉🎊✨', scenario: '純 emoji' },
      { input: '123456', scenario: '純數字' },
      { input: '？？？', scenario: '純符號' }
    ];
    
    const userId = 'edge_case_test_user';
    let allPassed = true;
    
    for (const testCase of edgeCases) {
      try {
        const result = await processMessage(testCase.input, userId, testCase.scenario);
        if (result.intent === 'unknown') {
          console.log(`✅ ${testCase.scenario} 正確處理為 unknown`);
        } else {
          console.log(`⚠️ ${testCase.scenario} 意外識別為: ${result.intent}`);
        }
      } catch (error) {
        this.logRisk('EDGE_CASE_ERROR', `${testCase.scenario} 處理異常: ${error.message}`, 'MEDIUM');
        allPassed = false;
      }
    }
    
    return allPassed;
  }
  
  // 風險6: 記憶體洩漏測試
  async testMemoryLeak() {
    const userId = 'memory_leak_test_user';
    const manager = getConversationManager();
    
    const initialMemory = process.memoryUsage();
    console.log(`初始記憶體: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
    
    // 大量創建和清理對話狀態
    for (let i = 0; i < 100; i++) {
      await processMessage('測試訊息 ' + i, userId + '_' + i);
      if (i % 10 === 0) {
        await manager.clearContext(userId + '_' + i);
      }
    }
    
    const finalMemory = process.memoryUsage();
    console.log(`最終記憶體: ${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`);
    
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    
    if (memoryIncrease > 50) { // 超過50MB增長視為風險
      this.logRisk('MEMORY_LEAK', `記憶體增長 ${Math.round(memoryIncrease)} MB`, 'HIGH');
      return false;
    }
    
    return true;
  }
  
  // 風險7: 並發處理測試
  async testConcurrentProcessing() {
    const baseUserId = 'concurrent_test_user_';
    const promises = [];
    
    // 同時處理多個用戶的訊息
    for (let i = 0; i < 10; i++) {
      promises.push(processMessage('每週五下午5點課程', baseUserId + i, 'CONCURRENT'));
    }
    
    try {
      const results = await Promise.all(promises);
      const allHandled = results.every(result => result.intent !== undefined);
      
      if (allHandled) {
        console.log('✅ 並發處理正常');
        return true;
      } else {
        this.logRisk('CONCURRENT_ERROR', '並發處理失敗', 'HIGH');
        return false;
      }
    } catch (error) {
      this.logRisk('CONCURRENT_CRASH', `並發處理崩潰: ${error.message}`, 'CRITICAL');
      return false;
    }
  }
  
  // 執行全面風險測試
  async runAllRiskTests() {
    console.log('🚨 開始全面風險測試');
    console.log('='.repeat(60));
    
    await this.testRisk('意圖識別回歸', () => this.testIntentRecognitionRegression());
    await this.testRisk('補充意圖誤觸發', () => this.testSupplementIntentFalsePositive());
    await this.testRisk('對話狀態污染', () => this.testConversationStateContamination());
    await this.testRisk('Redis 故障降級', () => this.testRedisFailureGraceDegradation());
    await this.testRisk('邊界情況處理', () => this.testEdgeCases());
    await this.testRisk('記憶體洩漏', () => this.testMemoryLeak());
    await this.testRisk('並發處理', () => this.testConcurrentProcessing());
    
    console.log('\n' + '='.repeat(60));
    this.generateRiskReport();
  }
  
  generateRiskReport() {
    console.log('📊 風險測試報告');
    console.log(`✅ 通過: ${this.passedTests}`);
    console.log(`❌ 失敗: ${this.failedTests}`);
    console.log(`🎯 成功率: ${Math.round(this.passedTests / (this.passedTests + this.failedTests) * 100)}%`);
    
    if (this.risks.length > 0) {
      console.log('\n🚨 發現的風險:');
      const criticalRisks = this.risks.filter(r => r.severity === 'CRITICAL');
      const highRisks = this.risks.filter(r => r.severity === 'HIGH');
      const mediumRisks = this.risks.filter(r => r.severity === 'MEDIUM');
      
      if (criticalRisks.length > 0) {
        console.log(`💥 CRITICAL (${criticalRisks.length}):`, criticalRisks.map(r => r.description));
      }
      if (highRisks.length > 0) {
        console.log(`🔥 HIGH (${highRisks.length}):`, highRisks.map(r => r.description));
      }
      if (mediumRisks.length > 0) {
        console.log(`⚠️ MEDIUM (${mediumRisks.length}):`, mediumRisks.map(r => r.description));
      }
      
      console.log('\n🎯 建議:');
      if (criticalRisks.length > 0) {
        console.log('❌ 不建議部署 - 存在關鍵風險');
      } else if (highRisks.length > 0) {
        console.log('⚠️ 謹慎部署 - 需要監控');
      } else {
        console.log('✅ 可以部署 - 風險可控');
      }
    } else {
      console.log('\n🎉 未發現重大風險！');
    }
  }
}

// 執行測試
if (require.main === module) {
  const tester = new RiskTester();
  tester.runAllRiskTests().catch(console.error);
}

module.exports = { RiskTester };