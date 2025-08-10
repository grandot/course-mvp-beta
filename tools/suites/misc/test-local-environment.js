/**
 * 本機環境邏輯測試工具
 * 直接調用處理邏輯測試業務功能，跳過 webhook 和 LINE API
 */

require('dotenv').config();
const { parseIntent } = require('../../../src/intent/parseIntent');
const { extractSlots } = require('../../../src/intent/extractSlots'); 
const { executeTask } = require('../../../src/tasks');
const { getConversationManager } = require('../../../src/conversation/ConversationManager');

/**
 * 執行完整的消息處理並返回真實回覆
 */
async function processMessageAndGetResponse(userId, message) {
  try {
    console.log(`\n💬 輸入: "${message}"`);
    
    // 1. 意圖識別
    const intent = await parseIntent(message, userId);
    console.log(`🎯 識別意圖: ${intent}`);
    
    // 2. 實體提取
    const slots = await extractSlots(message, intent, userId);
    console.log(`📋 提取實體: ${JSON.stringify(slots)}`);
    
    // 3. 執行任務
    const result = await executeTask(intent, slots, userId, { message: { text: message } });
    console.log(`📤 機器人回覆: "${result.message}"`);
    
    // 4. 記錄到對話管理器
    const conversationManager = getConversationManager();
    await conversationManager.recordUserMessage(userId, message, intent, slots);
    await conversationManager.recordBotResponse(userId, result.message, { quickReply: result.quickReply });
    
    return {
      input: message,
      intent: intent,
      slots: slots,
      output: result.message,
      code: result.code,
      success: result.success,
      quickReply: result.quickReply || null
    };
    
  } catch (error) {
    console.log(`❌ 處理失敗: ${error.message}`);
    return {
      input: message,
      error: error.message,
      success: false,
      output: null
    };
  }
}

/**
 * 運行實際回覆測試
 */
async function runLocalLogicTests() {
  console.log('🧪 開始本機邏輯測試');
  console.log('='.repeat(50));
  
  const testUserId = process.env.TEST_USER_ID || 'U_test_user_qa';
  
  const testCases = [
    {
      name: '基礎課程新增',
      input: '小明每週三下午3點數學課',
      expectedIntent: 'add_course',
      expectedSuccess: true,
      expectedKeywords: ['課程', '安排', '成功']
    },
    {
      name: '課程查詢', 
      input: '查詢小明課程',
      expectedIntent: 'query_schedule',
      expectedSuccess: true,
      expectedKeywords: ['課程', '小明']
    },
    {
      name: '確認操作',
      input: '確認',
      expectedIntent: 'confirm_action',
      expectedSuccess: true,
      expectedKeywords: ['確認']
    },
    {
      name: '設定提醒',
      input: '設定提醒',
      expectedIntent: 'set_reminder', 
      expectedSuccess: true,
      expectedKeywords: ['提醒']
    },
    {
      name: '未知意圖',
      input: '隨機無意義文字xyz123',
      expectedIntent: 'unknown',
      expectedSuccess: true,
      expectedKeywords: ['不太理解', '試試']
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n📝 測試: ${testCase.name}`);
    console.log('-'.repeat(30));
    
    const result = await processMessageAndGetResponse(testUserId, testCase.input);
    
    // 驗證結果
    const intentMatch = result.intent === testCase.expectedIntent;
    const successMatch = result.success === testCase.expectedSuccess;
    const keywordMatch = testCase.expectedKeywords.every(keyword => 
      result.output && result.output.includes(keyword)
    );
    
    const testPassed = intentMatch && successMatch && (keywordMatch || !result.output);
    
    results.push({
      name: testCase.name,
      input: testCase.input,
      expectedIntent: testCase.expectedIntent,
      actualIntent: result.intent,
      expectedSuccess: testCase.expectedSuccess,
      actualSuccess: result.success,
      expectedKeywords: testCase.expectedKeywords,
      actualOutput: result.output,
      quickReply: result.quickReply,
      intentMatch: intentMatch,
      successMatch: successMatch,
      keywordMatch: keywordMatch,
      testPassed: testPassed,
      error: result.error
    });
    
    console.log(`✨ 預期意圖: ${testCase.expectedIntent} | 實際意圖: ${result.intent} | ${intentMatch ? '✅' : '❌'}`);
    console.log(`✨ 預期成功: ${testCase.expectedSuccess} | 實際成功: ${result.success} | ${successMatch ? '✅' : '❌'}`);
    if (result.output) {
      console.log(`✨ 關鍵詞檢查: ${keywordMatch ? '✅' : '❌'} (${testCase.expectedKeywords.join(', ')})`);
    }
    console.log(`🎯 測試結果: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    // 短暫延遲
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * 多輪對話測試
 */
async function runMultiTurnLogicTest() {
  console.log('\n🔄 多輪對話邏輯測試');
  console.log('='.repeat(50));
  
  const testUserId = process.env.TEST_USER_ID || 'U_test_user_qa';
  
  const conversation = [
    {
      step: 1,
      input: '小美每週五下午4點鋼琴課',
      expectedKeywords: ['課程', '安排', '成功'],
      description: '新增課程'
    },
    {
      step: 2,
      input: '確認',  
      expectedKeywords: ['確認'],
      description: '確認操作，應記住上一輪的課程信息'
    },
    {
      step: 3,
      input: '查詢課程',
      expectedKeywords: ['小美', '鋼琴課'],
      description: '查詢課程，應顯示剛才新增的課程'
    }
  ];
  
  const results = [];
  
  for (const turn of conversation) {
    console.log(`\n📝 第${turn.step}輪: ${turn.description}`);
    console.log('-'.repeat(30));
    
    const result = await processMessageAndGetResponse(testUserId, turn.input);
    
    const keywordMatch = result.output && turn.expectedKeywords.every(keyword => 
      result.output.includes(keyword)
    );
    
    results.push({
      step: turn.step,
      input: turn.input,
      description: turn.description,
      expectedKeywords: turn.expectedKeywords,
      actualOutput: result.output,
      quickReply: result.quickReply,
      success: result.success,
      keywordMatch: keywordMatch,
      testPassed: result.success && keywordMatch
    });
    
    console.log(`✨ 關鍵詞檢查: ${keywordMatch ? '✅' : '❌'} (${turn.expectedKeywords.join(', ')})`);
    console.log(`🎯 測試結果: ${result.success && keywordMatch ? '✅ PASS' : '❌ FAIL'}`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  return results;
}

/**
 * 生成測試報告
 */
function generateDetailedReport(singleTests, multiTurnTests) {
  console.log('\n📊 本機邏輯測試報告');
  console.log('='.repeat(60));
  
  // 單輪測試報告
  console.log('\n📋 單輪對話測試結果:');
  singleTests.forEach(test => {
    console.log(`\n🧪 ${test.name}:`);
    console.log(`   輸入: "${test.input}"`);
    console.log(`   預期意圖: ${test.expectedIntent} | 實際意圖: ${test.actualIntent}`);
    console.log(`   預期成功: ${test.expectedSuccess} | 實際成功: ${test.actualSuccess}`);
    if (test.actualOutput) {
      console.log(`   實際輸出: "${test.actualOutput.substring(0, 100)}..."`);
    }
    if (test.error) {
      console.log(`   錯誤信息: ${test.error}`);
    }
    console.log(`   測試結果: ${test.testPassed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  // 多輪測試報告
  console.log('\n📋 多輪對話測試結果:');
  multiTurnTests.forEach(test => {
    console.log(`\n🔄 第${test.step}輪 - ${test.description}:`);
    console.log(`   輸入: "${test.input}"`);
    console.log(`   預期關鍵詞: [${test.expectedKeywords.join(', ')}]`);
    if (test.actualOutput) {
      console.log(`   實際輸出: "${test.actualOutput.substring(0, 100)}..."`);
    }
    console.log(`   測試結果: ${test.testPassed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  // 統計
  const totalSingle = singleTests.length;
  const passedSingle = singleTests.filter(t => t.testPassed).length;
  const totalMulti = multiTurnTests.length;
  const passedMulti = multiTurnTests.filter(t => t.testPassed).length;
  
  console.log('\n🎯 測試統計:');
  console.log(`單輪對話: ${passedSingle}/${totalSingle} 通過`);
  console.log(`多輪對話: ${passedMulti}/${totalMulti} 通過`);
  console.log(`總體通過率: ${Math.round((passedSingle + passedMulti)/(totalSingle + totalMulti)*100)}%`);
}

/**
 * 主函數
 */
async function main() {
  try {
    const singleTests = await runLocalLogicTests();
    const multiTurnTests = await runMultiTurnLogicTest();
    generateDetailedReport(singleTests, multiTurnTests);
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  runLocalLogicTests, 
  runMultiTurnLogicTest, 
  processMessageAndGetResponse 
};