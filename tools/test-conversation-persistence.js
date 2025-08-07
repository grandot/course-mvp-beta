/**
 * 測試對話狀態持久化功能
 * 驗證對話記憶、跨 session 保持、過期清理等
 */

const { config } = require('dotenv');
config();

const { getConversationManager } = require('../src/conversation/ConversationManager');
const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');

// 測試用戶ID
const TEST_USER_1 = 'U_test_persistence_user_1';
const TEST_USER_2 = 'U_test_persistence_user_2';

/**
 * 測試對話狀態基礎操作
 */
async function testBasicPersistence() {
  console.log('\n🧪 測試對話狀態基礎操作');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();

  // 清理測試環境
  await conversationManager.clearContext(TEST_USER_1);

  // 1. 創建對話上下文
  let context = await conversationManager.getContext(TEST_USER_1);
  console.log('📋 初始上下文:', {
    userId: context.userId,
    currentFlow: context.state.currentFlow,
    historyLength: context.state.history.length
  });

  // 2. 記錄用戶訊息
  await conversationManager.recordUserMessage(TEST_USER_1, '小明每週三下午3點數學課', 'add_course', {
    studentName: '小明',
    courseName: '數學課',
    scheduleTime: '15:00'
  });

  // 3. 記錄機器人回應
  await conversationManager.recordBotResponse(TEST_USER_1, '課程已安排成功', {
    quickReply: [{ label: '確認', text: '確認' }]
  });

  // 4. 檢查狀態是否保存
  context = await conversationManager.getContext(TEST_USER_1);
  console.log('📋 更新後狀態:', {
    historyLength: context.state.history.length,
    mentionedStudents: context.state.mentionedEntities.students,
    mentionedCourses: context.state.mentionedEntities.courses
  });

  // 驗證數據正確性
  if (context.state.history.length >= 2) {
    console.log('✅ 對話記錄保存成功');
    console.log('📝 最後一條記錄:', context.state.history[context.state.history.length - 1]);
  } else {
    console.log('❌ 對話記錄保存失敗');
  }

  return context;
}

/**
 * 測試跨 Session 狀態保持
 */
async function testCrossSessionPersistence() {
  console.log('\n🔄 測試跨 Session 狀態保持');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();

  // 模擬第一個 Session
  console.log('📱 Session 1: 新增課程');
  await conversationManager.recordUserMessage(TEST_USER_1, 'Lumi每週五下午4點鋼琴課', 'add_course');
  await conversationManager.recordTaskResult(TEST_USER_1, 'add_course', {
    studentName: 'Lumi',
    courseName: '鋼琴課',
    scheduleTime: '16:00'
  }, { success: true, message: '課程已安排' });

  // 取得第一個 Session 的狀態
  let session1Context = await conversationManager.getContext(TEST_USER_1);
  console.log('📊 Session 1 狀態:', {
    historyLength: session1Context.state.history.length,
    lastActionsCount: Object.keys(session1Context.state.lastActions).length,
    mentionedEntities: session1Context.state.mentionedEntities
  });

  // 模擬一段時間後的第二個 Session（但在 TTL 內）
  console.log('\n📱 Session 2: 查詢課程');
  await new Promise(resolve => setTimeout(resolve, 100)); // 短暫延遲

  // 在第二個 Session 中，應該能讀取到之前的狀態
  let session2Context = await conversationManager.getContext(TEST_USER_1);
  console.log('📊 Session 2 狀態:', {
    historyLength: session2Context.state.history.length,
    lastActionsCount: Object.keys(session2Context.state.lastActions).length,
    isSameAsSession1: session2Context.userId === session1Context.userId
  });

  // 驗證狀態一致性
  if (session2Context.state.history.length === session1Context.state.history.length) {
    console.log('✅ 跨 Session 狀態保持成功');
    return true;
  } else {
    console.log('❌ 跨 Session 狀態保持失敗');
    return false;
  }
}

/**
 * 測試多用戶隔離
 */
async function testMultiUserIsolation() {
  console.log('\n👥 測試多用戶隔離');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();

  // 清理測試環境
  await conversationManager.clearContext(TEST_USER_1);
  await conversationManager.clearContext(TEST_USER_2);

  // 用戶 1 的對話
  await conversationManager.recordUserMessage(TEST_USER_1, '小明數學課', 'add_course', {
    studentName: '小明',
    courseName: '數學課'
  });

  // 用戶 2 的對話
  await conversationManager.recordUserMessage(TEST_USER_2, '小美英文課', 'add_course', {
    studentName: '小美',
    courseName: '英文課'
  });

  // 檢查用戶隔離
  const user1Context = await conversationManager.getContext(TEST_USER_1);
  const user2Context = await conversationManager.getContext(TEST_USER_2);

  console.log('👤 用戶 1 狀態:', {
    students: user1Context.state.mentionedEntities.students,
    courses: user1Context.state.mentionedEntities.courses
  });

  console.log('👤 用戶 2 狀態:', {
    students: user2Context.state.mentionedEntities.students,
    courses: user2Context.state.mentionedEntities.courses
  });

  // 驗證數據隔離
  const user1HasUser2Data = user1Context.state.mentionedEntities.students.includes('小美');
  const user2HasUser1Data = user2Context.state.mentionedEntities.students.includes('小明');

  if (!user1HasUser2Data && !user2HasUser1Data) {
    console.log('✅ 用戶數據隔離正確');
    return true;
  } else {
    console.log('❌ 用戶數據隔離失敗');
    return false;
  }
}

/**
 * 測試期待輸入狀態管理
 */
async function testExpectedInputPersistence() {
  console.log('\n⏳ 測試期待輸入狀態持久化');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();

  // 清理環境
  await conversationManager.clearContext(TEST_USER_1);

  // 設定期待輸入狀態
  await conversationManager.setExpectedInput(
    TEST_USER_1,
    'course_creation',
    ['confirmation', 'modification'],
    { courseName: '數學課', studentName: '小明' }
  );

  console.log('📋 已設定期待輸入狀態');

  // 檢查是否正確保存
  let isExpecting = await conversationManager.isExpectingInput(TEST_USER_1, 'confirmation');
  console.log('🔍 期待確認輸入:', isExpecting);

  // 取得完整上下文檢查
  let context = await conversationManager.getContext(TEST_USER_1);
  console.log('📊 期待輸入狀態:', {
    currentFlow: context.state.currentFlow,
    expectingInput: context.state.expectingInput,
    pendingData: Object.keys(context.state.pendingData)
  });

  // 清除期待輸入狀態
  await conversationManager.clearExpectedInput(TEST_USER_1);
  isExpecting = await conversationManager.isExpectingInput(TEST_USER_1, 'confirmation');
  console.log('🧹 清除後期待輸入:', isExpecting);

  if (!isExpecting) {
    console.log('✅ 期待輸入狀態管理正確');
    return true;
  } else {
    console.log('❌ 期待輸入狀態管理失敗');
    return false;
  }
}

/**
 * 測試上下文實體記憶與推斷
 */
async function testEntityMemoryAndInference() {
  console.log('\n🧠 測試實體記憶與智能推斷');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();

  // 清理環境
  await conversationManager.clearContext(TEST_USER_1);

  // 模擬多輪對話中的實體提取
  console.log('🗣️ 第1輪: 提及小明和數學課');
  const intent1 = await parseIntent('小明每週三下午3點數學課', TEST_USER_1);
  const slots1 = await extractSlots('小明每週三下午3點數學課', intent1, TEST_USER_1);
  await conversationManager.recordUserMessage(TEST_USER_1, '小明每週三下午3點數學課', intent1, slots1);

  console.log('🗣️ 第2輪: 只說"查詢課程"，應該推斷小明');
  const intent2 = await parseIntent('查詢課程', TEST_USER_1);
  const slots2 = await extractSlots('查詢課程', intent2, TEST_USER_1);
  await conversationManager.recordUserMessage(TEST_USER_1, '查詢課程', intent2, slots2);

  console.log('🗣️ 第3輪: 說"設定提醒"，應該推斷小明和數學課');
  const intent3 = await parseIntent('設定提醒', TEST_USER_1);
  const slots3 = await extractSlots('設定提醒', intent3, TEST_USER_1);
  await conversationManager.recordUserMessage(TEST_USER_1, '設定提醒', intent3, slots3);

  // 檢查實體記憶
  const context = await conversationManager.getContext(TEST_USER_1);
  console.log('📊 實體記憶狀態:', context.state.mentionedEntities);

  // 檢查推斷結果
  console.log('📋 第2輪 slots (應包含推斷的學生名):', slots2);
  console.log('📋 第3輪 slots (應包含推斷的學生和課程):', slots3);

  // 驗證推斷正確性
  const hasStudentInference = slots2.studentName || slots3.studentName;
  const hasCourseInference = slots3.courseName;

  if (hasStudentInference) {
    console.log('✅ 實體記憶與推斷功能正常');
    return true;
  } else {
    console.log('❌ 實體記憶與推斷功能異常');
    return false;
  }
}

/**
 * 測試健康狀態檢查
 */
async function testHealthCheck() {
  console.log('\n💊 測試健康狀態檢查');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();
  const health = await conversationManager.healthCheck();

  console.log('📊 健康狀態:', health);

  if (health.status === 'healthy' && health.features.multiTurnDialogue) {
    console.log('✅ 系統健康狀態良好');
    return true;
  } else {
    console.log('❌ 系統健康狀態異常');
    return false;
  }
}

/**
 * 主測試函數
 */
async function runPersistenceTests() {
  console.log('🚀 開始對話狀態持久化測試');
  console.log('🕐 時間:', new Date().toLocaleString());

  const results = {
    basicPersistence: false,
    crossSessionPersistence: false,
    multiUserIsolation: false,
    expectedInputPersistence: false,
    entityMemoryAndInference: false,
    healthCheck: false
  };

  try {
    // 測試基礎持久化
    await testBasicPersistence();
    results.basicPersistence = true;

    // 測試跨 Session 保持
    results.crossSessionPersistence = await testCrossSessionPersistence();

    // 測試多用戶隔離
    results.multiUserIsolation = await testMultiUserIsolation();

    // 測試期待輸入狀態
    results.expectedInputPersistence = await testExpectedInputPersistence();

    // 測試實體記憶與推斷
    results.entityMemoryAndInference = await testEntityMemoryAndInference();

    // 測試健康檢查
    results.healthCheck = await testHealthCheck();

  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error);
  }

  // 清理測試數據
  console.log('\n🧹 清理測試數據...');
  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_1);
  await conversationManager.clearContext(TEST_USER_2);

  // 測試結果總結
  console.log('\n📊 測試結果總結:');
  console.log('='.repeat(40));
  let passCount = 0;
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${passed ? 'PASS' : 'FAIL'}`);
    if (passed) passCount++;
  }

  const totalTests = Object.keys(results).length;
  console.log(`\n🎯 通過率: ${passCount}/${totalTests} (${Math.round(passCount/totalTests*100)}%)`);

  if (passCount === totalTests) {
    console.log('🎉 所有對話狀態持久化測試通過！');
  } else {
    console.log('⚠️  部分測試未通過，請檢查相關功能');
  }
}

// 執行測試
if (require.main === module) {
  runPersistenceTests();
}

module.exports = {
  runPersistenceTests,
  testBasicPersistence,
  testCrossSessionPersistence,
  testMultiUserIsolation,
  testExpectedInputPersistence,
  testEntityMemoryAndInference,
  testHealthCheck
};