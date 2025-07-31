/**
 * 測試學生姓名提取修復效果
 * 驗證"昨天"不再被誤認為學生姓名
 */

const SemanticService = require('./src/services/semanticService');

async function testStudentNameExtraction() {
  console.log('🧪 測試學生姓名提取修復效果...\n');
  
  const testCases = [
    {
      input: "昨天的科学实验课 老师说他表现很好 成功造出来火箭",
      expected: null, // 不應該提取到學生姓名
      description: "昨天 - 應該被排除的時間詞彙"
    },
    {
      input: "小明昨天的課程怎麼樣",
      expected: "小明", // 應該提取到小明
      description: "小明昨天 - 應該提取到小明，排除昨天"
    },
    {
      input: "今天小美的課表",
      expected: "小美", // 應該提取到小美
      description: "今天小美 - 應該提取到小美，排除今天"
    },
    {
      input: "明天有什麼課",
      expected: null, // 不應該提取到學生姓名
      description: "明天 - 應該被排除的時間詞彙"
    }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`測試案例: "${testCase.input}"`);
    console.log(`預期結果: ${testCase.expected || 'null'}`);
    
    const result = SemanticService.extractStudentName(testCase.input);
    const actualName = result ? result.name : null;
    
    console.log(`實際結果: ${actualName || 'null'}`);
    
    const isPass = actualName === testCase.expected;
    console.log(`結果: ${isPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`說明: ${testCase.description}\n`);
    
    if (isPass) passed++;
  }
  
  console.log(`\n📊 測試結果: ${passed}/${total} 通過`);
  
  if (passed === total) {
    console.log('🎉 所有測試通過！修復成功！');
  } else {
    console.log('⚠️ 部分測試失敗，需要進一步調整');
  }
}

// 執行測試
testStudentNameExtraction().catch(console.error);