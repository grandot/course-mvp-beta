const { MarkdownParser } = require('../qa-system/core/MarkdownParser');
const { processMessageAndGetResponse } = require('./test-local-environment');

async function testFive() {
  console.log('🧪 測試修復後的 5 個案例');
  console.log('='.repeat(50));
  
  // 解析測試計劃
  const parser = new MarkdownParser();
  const testCases = await parser.parse('./QA/comprehensive-test-plan.md');
  
  // 只取前5個測試
  const firstFive = testCases.slice(0, 5);
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < firstFive.length; i++) {
    const testCase = firstFive[i];
    console.log(`\n📝 測試 ${i+1}/5: ${testCase.id} - ${testCase.name}`);
    console.log(`輸入: ${testCase.input}`);
    
    try {
      const result = await processMessageAndGetResponse('U_test_5', testCase.input);
      
      // 檢查關鍵字匹配
      const keywordMatch = testCase.expectedKeywords ? 
        testCase.expectedKeywords.every(keyword => 
          result.output && result.output.includes(keyword)
        ) : true;
      
      const success = result.success && keywordMatch;
      
      if (success) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        console.log(`   業務成功: ${result.success}, 關鍵字匹配: ${keywordMatch}`);
        if (!keywordMatch && testCase.expectedKeywords) {
          console.log(`   預期關鍵字: [${testCase.expectedKeywords.join(', ')}]`);
        }
        failed++;
      }
      
    } catch (error) {
      console.log('❌ ERROR: ' + error.message);
      failed++;
    }
    
    // 短暫延遲避免過載
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n📊 測試結果: ${passed}/5 通過 (${Math.round(passed/5*100)}%)`);
}

testFive().catch(console.error);