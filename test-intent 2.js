const { parseIntent } = require('./src/intent/parseIntent');

async function testIntent() {
  console.log('🧪 測試意圖識別');
  const testCases = [
    '測試小明明天下午2點要上測試數學課',
    '測試Lumi後天晚上八點半要上測試鋼琴課',
    '明天下午3點要上測試數學課'
  ];

  for (const test of testCases) {
    try {
      console.log(`\n輸入: ${test}`);
      const result = await parseIntent(test);
      console.log(`意圖: ${result}`);
    } catch (error) {
      console.log(`錯誤: ${error.message}`);
    }
  }
}

testIntent();