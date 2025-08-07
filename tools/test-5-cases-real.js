const { MarkdownParser } = require('../qa-system/core/MarkdownParser');
const { RealEnvironmentTester } = require('./test-real-environment');

async function testFiveReal() {
  console.log('🌐 測試線上環境 - 5 個案例');
  console.log('='.repeat(50));
  
  try {
    // 解析測試計劃
    const parser = new MarkdownParser();
    const testCases = await parser.parse('./QA/comprehensive-test-plan.md');
    
    // 只取前5個測試
    const firstFive = testCases.slice(0, 5);
    
    // 初始化線上測試器
    const realTester = new RealEnvironmentTester();
    
    // 使用完整的測試執行流程，包含增強的診斷日誌
    console.log('🚀 開始執行測試...');
    const results = await realTester.runAllTests(firstFive);
    
    // 生成包含診斷日誌的完整報告
    realTester.generateReport(results);
  } catch (error) {
    console.error('❌ 測試程序失敗:', error.message);
  }
}

testFiveReal().catch(console.error);