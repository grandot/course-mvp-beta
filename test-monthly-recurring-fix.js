/**
 * 每月重複課程修復驗證測試
 */

const { parseIntent } = require('./src/intent/parseIntent');
const { extractSlots } = require('./src/intent/extractSlots');

async function runMonthlyRecurringTests() {
  console.log('🧪 每月重複課程修復驗證測試\n');
  
  const testCases = [
    {
      name: '正向測試1：標準每月重複',
      input: 'Lumi每月20號數學測驗課',
      expectedIntent: 'create_recurring_course',
      expectedSlots: {
        studentName: 'Lumi',
        courseName: '數學測驗課',
        recurring: true,
        recurrenceType: 'monthly'
      }
    },
    {
      name: '正向測試2：每個月變體',
      input: 'Lumi每個月20號要數學測驗',
      expectedIntent: 'create_recurring_course',
      expectedSlots: {
        studentName: 'Lumi',
        courseName: '數學測驗課',
        recurring: true,
        recurrenceType: 'monthly'
      }
    },
    {
      name: '正向測試3：無「課」字但有課程詞',
      input: '小明每月15號鋼琴訓練',
      expectedIntent: 'create_recurring_course',
      expectedSlots: {
        studentName: '小明',
        courseName: '鋼琴訓練',
        recurring: true,
        recurrenceType: 'monthly'
      }
    },
    {
      name: '反向測試1：查詢本月課表',
      input: '查本月課表',
      expectedIntent: 'query_schedule',
      shouldNotBe: 'create_recurring_course'
    },
    {
      name: '反向測試2：查詢語氣',
      input: '看這個月課表',
      expectedIntent: 'query_schedule', 
      shouldNotBe: 'create_recurring_course'
    },
    {
      name: '反向測試3：每月課表查詢',
      input: '每月課表',
      expectedIntent: 'query_schedule',
      shouldNotBe: 'create_recurring_course'
    },
    {
      name: '學生名測試：基本提取功能',
      input: '新增Lumi下午3點數學課',
      expectedIntent: 'add_course',
      expectedSlots: {
        studentName: 'Lumi',
        courseName: '數學課'
      }
    }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    console.log(`   輸入: "${testCase.input}"`);
    
    try {
      // 測試意圖識別
      const intent = await parseIntent(testCase.input, 'TEST_USER');
      console.log(`   意圖: ${intent}`);
      
      let intentPassed = true;
      if (testCase.expectedIntent && intent !== testCase.expectedIntent) {
        console.log(`   ❌ 意圖錯誤: 期望 ${testCase.expectedIntent}, 實際 ${intent}`);
        intentPassed = false;
      }
      if (testCase.shouldNotBe && intent === testCase.shouldNotBe) {
        console.log(`   ❌ 意圖錯誤: 不應該是 ${testCase.shouldNotBe}`);
        intentPassed = false;
      }
      
      // 測試槽位提取
      let slotsPassed = true;
      if (testCase.expectedSlots) {
        const slots = await extractSlots(testCase.input, intent || 'add_course', 'TEST_USER');
        console.log(`   槽位:`, JSON.stringify(slots, null, 2));
        
        for (const [key, expectedValue] of Object.entries(testCase.expectedSlots)) {
          if (slots[key] !== expectedValue) {
            console.log(`   ❌ 槽位錯誤 ${key}: 期望 "${expectedValue}", 實際 "${slots[key]}"`);
            slotsPassed = false;
          }
        }
      }
      
      if (intentPassed && slotsPassed) {
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
    console.log('🎉 所有測試通過！每月重複課程修復成功！');
    return true;
  } else {
    console.log('❌ 部分測試失敗，需要進一步修復');
    return false;
  }
}

// 執行測試
if (require.main === module) {
  runMonthlyRecurringTests().catch(console.error);
}

module.exports = { runMonthlyRecurringTests };