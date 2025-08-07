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
    
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < firstFive.length; i++) {
      const testCase = firstFive[i];
      console.log(`\n📝 測試 ${i+1}/5: ${testCase.id} - ${testCase.name}`);
      console.log(`輸入: ${testCase.input}`);
      
      try {
        const result = await realTester.runSingleTest(testCase);
        
        if (result.success) {
          console.log('✅ PASS');
          passed++;
        } else {
          console.log('❌ FAIL');
          console.log(`   原因: ${result.error || '未知錯誤'}`);
          failed++;
        }
        
      } catch (error) {
        console.log('❌ ERROR: ' + error.message);
        failed++;
      }
      
      // 延遲避免過載線上服務
      console.log('⏳ 等待 3 秒...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`\n📊 線上測試結果: ${passed}/5 通過 (${Math.round(passed/5*100)}%)`);
    
  } catch (error) {
    console.error('❌ 測試程序失敗:', error.message);
  }
}

testFiveReal().catch(console.error);