require('dotenv').config();

const { parseIntent } = require('./src/intent/parseIntent');
const { extractSlots } = require('./src/intent/extractSlots');
const { executeTask } = require('./src/tasks');

async function testFullFlow() {
  console.log('🧪 測試完整流程');
  
  const testMessage = '測試小明明天下午2點要上測試數學課';
  const userId = 'U_test_flow';
  
  try {
    console.log(`\n📝 輸入: ${testMessage}`);
    
    // Step 1: 意圖識別
    console.log('\n🎯 Step 1: 意圖識別');
    const intent = await parseIntent(testMessage, userId);
    console.log(`意圖: ${intent}`);
    
    // Step 2: Slots 提取
    console.log('\n📋 Step 2: Slots 提取');
    const slots = await extractSlots(testMessage, intent, userId);
    console.log('Slots:', JSON.stringify(slots, null, 2));
    
    // Step 3: 任務執行
    console.log('\n⚙️  Step 3: 任務執行');
    const result = await executeTask(intent, slots, userId);
    console.log('任務結果:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 流程執行失敗:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFullFlow();