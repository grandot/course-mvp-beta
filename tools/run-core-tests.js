#!/usr/bin/env node

/**
 * 核心功能測試執行器
 * 使用真實環境測試10個核心場景
 */

const { RealEnvironmentTester } = require('./test-real-environment');
const { coreTestScenarios } = require('../QA/core-test-scenarios');

class CoreTestRunner {
  constructor() {
    this.tester = new RealEnvironmentTester();
    this.results = [];
  }
  
  /**
   * 執行所有核心測試
   */
  async runAllCoreTests() {
    console.log('🎯 開始執行10個核心功能測試');
    console.log('📊 測試模式：真實環境 (Render)');
    console.log('=' .repeat(60));
    
    // 轉換測試格式
    const testCases = coreTestScenarios.map(scenario => ({
      name: scenario.name,
      input: scenario.input,
      expectedKeywords: scenario.expectedKeywords,
      expected: scenario.expected,
      purpose: scenario.purpose,
      priority: scenario.priority,
      category: scenario.category,
      environment: scenario.environment,
      known_issue: scenario.known_issue,
      note: scenario.note
    }));
    
    // 執行測試
    this.results = await this.tester.runAllTests(testCases);
    
    // 生成專門的核心測試報告
    this.generateCoreTestReport();
    
    return this.results;
  }
  
  /**
   * 生成核心測試專用報告
   */
  generateCoreTestReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 核心功能測試報告');
    console.log('='.repeat(80));
    
    const categorySummary = {};
    const prioritySummary = { critical: 0, high: 0, medium: 0 };
    const priorityPassed = { critical: 0, high: 0, medium: 0 };
    
    this.results.forEach((result, index) => {
      const scenario = coreTestScenarios[index];
      const category = scenario.category;
      const priority = scenario.priority;
      
      // 分類統計
      if (!categorySummary[category]) {
        categorySummary[category] = { total: 0, passed: 0 };
      }
      categorySummary[category].total++;
      
      // 優先級統計
      prioritySummary[priority]++;
      
      if (result.testPassed) {
        categorySummary[category].passed++;
        priorityPassed[priority]++;
      }
      
      // 顯示測試結果
      console.log(`\n🧪 ${scenario.name}`);
      console.log(`   類別: ${category} | 優先級: ${priority.toUpperCase()}`);
      console.log(`   目的: ${scenario.purpose}`);
      console.log(`   輸入: "${result.testCase.input}"`);
      console.log(`   回覆: ${result.botReply || '(無回覆)'}`);
      
      const statusIcon = result.testPassed ? '✅' : '❌';
      console.log(`   結果: ${statusIcon} ${result.testPassed ? 'PASS' : 'FAIL'}`);
      
      if (scenario.environment) {
        console.log(`   環境: ${scenario.environment}`);
      }
      
      if (scenario.known_issue) {
        console.log(`   ⚠️ 已知問題: ${scenario.known_issue}`);
      }
      
      if (scenario.note) {
        console.log(`   📝 備註: ${scenario.note}`);
      }
      
      if (!result.testPassed && result.diagnosticLogs) {
        console.log('   🔍 診斷訊息: (詳見完整日誌)');
      }
    });
    
    // 分類統計
    console.log('\n📊 功能分類統計:');
    Object.entries(categorySummary).forEach(([category, stats]) => {
      const rate = Math.round((stats.passed / stats.total) * 100);
      console.log(`   ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
    });
    
    // 優先級統計
    console.log('\n🎯 優先級統計:');
    Object.entries(prioritySummary).forEach(([priority, total]) => {
      const passed = priorityPassed[priority];
      const rate = Math.round((passed / total) * 100);
      const icon = priority === 'critical' ? '🔴' : 
                   priority === 'high' ? '🟡' : '🟢';
      console.log(`   ${icon} ${priority.toUpperCase()}: ${passed}/${total} (${rate}%)`);
    });
    
    // 整體統計
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.testPassed).length;
    const passRate = Math.round((passedTests / totalTests) * 100);
    
    console.log('\n📈 整體統計:');
    console.log(`   總測試數: ${totalTests}`);
    console.log(`   通過數: ${passedTests}`);
    console.log(`   失敗數: ${totalTests - passedTests}`);
    console.log(`   通過率: ${passRate}%`);
    
    // 品質評估
    const criticalRate = Math.round((priorityPassed.critical / prioritySummary.critical) * 100);
    const highRate = Math.round((priorityPassed.high / prioritySummary.high) * 100);
    
    console.log('\n🎯 品質評估:');
    console.log(`   關鍵功能通過率: ${criticalRate}% (目標: ≥90%)`);
    console.log(`   重要功能通過率: ${highRate}% (目標: ≥80%)`);
    console.log(`   整體功能通過率: ${passRate}% (目標: ≥75%)`);
    
    if (criticalRate >= 90 && highRate >= 80 && passRate >= 75) {
      console.log('\n🎉 品質標準達成！核心功能運行良好');
    } else {
      console.log('\n⚠️ 部分品質指標未達標，需要進一步優化');
      
      if (criticalRate < 90) {
        console.log(`   🔴 關鍵功能需要優先修復 (${criticalRate}% < 90%)`);
      }
      if (highRate < 80) {
        console.log(`   🟡 重要功能需要改善 (${highRate}% < 80%)`);
      }
    }
  }
}

async function main() {
  try {
    const runner = new CoreTestRunner();
    await runner.runAllCoreTests();
    
    // 根據結果設定 exit code
    const passRate = runner.results.filter(r => r.testPassed).length / runner.results.length;
    process.exit(passRate >= 0.75 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ 核心測試執行失敗:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('🎯 核心功能測試工具啟動');
  main().catch(error => {
    console.error('❌ 未處理的錯誤:', error);
    process.exit(1);
  });
}

module.exports = { CoreTestRunner };