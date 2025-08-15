/**
 * 時間解析「半」字邏輯單元測試
 * 
 * 測試目標：
 * 1. 確保「三點半」等真正的半點時間能正確解析為 30 分鐘
 * 2. 確保包含「半」但非半點時間的詞（如「半導體課」）不會被誤判
 */

const { extractSlots } = require('./src/intent/extractSlots');

async function runHalfLogicTests() {
  console.log('🧪 時間解析「半」字邏輯單元測試\n');
  
  const testCases = [
    {
      name: '核心問題：「三點半」為半點時間，課程名不被污染',
      input: 'Lumi每週一下午三點半數學課',
      expectedTime: '15:30',
      expectedCourse: '數學課'
    },
    {
      name: '「5點半」為半點時間，課程名不被污染',
      input: '小明明天下午5點半英文課',
      expectedTime: '17:30',
      expectedCourse: '英文課'
    },
    {
      name: '原始bug重現：趣味科學課不應變成半趣味科學課',
      input: 'Lumi每週一三五下午三點半趣味科學課',
      expectedTime: '15:30',
      expectedCourse: '趣味科學課'
    }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    console.log(`   輸入: "${testCase.input}"`);
    
    try {
      const slots = await extractSlots(testCase.input, 'add_course', 'TEST_USER');
      
      const timeMatch = slots.scheduleTime === testCase.expectedTime;
      const courseMatch = slots.courseName === testCase.expectedCourse;
      
      console.log(`   時間: ${slots.scheduleTime} ${timeMatch ? '✅' : '❌'} (期望: ${testCase.expectedTime})`);
      console.log(`   課程: ${slots.courseName} ${courseMatch ? '✅' : '❌'} (期望: ${testCase.expectedCourse})`);
      
      if (timeMatch && courseMatch) {
        console.log('   結果: 🎉 通過\n');
        passedTests++;
      } else {
        console.log('   結果: 💥 失敗\n');
      }
      
    } catch (error) {
      console.log(`   錯誤: ${error.message}`);
      console.log('   結果: 💥 異常\n');
    }
  }
  
  console.log('📊 測試總結:');
  console.log(`   通過: ${passedTests}/${totalTests}`);
  console.log(`   成功率: ${Math.round(passedTests / totalTests * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有測試通過！「半」字邏輯修復成功！');
    return true;
  } else {
    console.log('❌ 部分測試失敗，需要進一步修復');
    return false;
  }
}

// 執行測試
if (require.main === module) {
  runHalfLogicTests().catch(console.error);
}

module.exports = { runHalfLogicTests };