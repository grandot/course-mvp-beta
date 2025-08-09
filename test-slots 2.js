const { extractSlots } = require('./src/intent/extractSlots');

async function testSlots() {
  console.log('🧪 測試 Slots 提取');
  
  const testCases = [
    {
      message: '測試小明明天下午2點要上測試數學課',
      intent: 'add_course'
    },
    {
      message: '測試Lumi後天晚上八點半要上測試鋼琴課',
      intent: 'add_course'
    },
    {
      message: '明天下午3點要上測試數學課',
      intent: 'add_course'
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n輸入: ${testCase.message}`);
      console.log(`意圖: ${testCase.intent}`);
      
      const result = await extractSlots(testCase.message, testCase.intent);
      console.log('Slots:', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.log(`錯誤: ${error.message}`);
      console.log('Stack:', error.stack);
    }
  }
}

testSlots();