#!/usr/bin/env node

/**
 * 測試核心多輪對話邏輯 - 不依賴外部服務
 */

const LineController = require('../src/controllers/lineController');
const ConversationContext = require('../src/utils/conversationContext');

// 模擬環境，避免外部服務依賴
process.env.NODE_ENV = 'test';

function testCoreLogic() {
  console.log('\n🎯 測試第一性原則核心邏輯\n');

  const userId = 'test-user-core';

  // 測試完整性檢查
  console.log('📝 測試 1：完整性檢查');
  const entities1 = {
    course_name: '排球',
    timeInfo: null,
    location: null,
    teacher: null,
    student: null
  };
  
  const completenessCheck1 = LineController.checkCourseCompleteness('排球', entities1);
  console.log('輸入：排球');
  console.log('結果：', completenessCheck1);
  console.log(completenessCheck1.needsFollowUp ? '✅ 正確識別需要追問' : '❌ 未正確識別需要追問');

  // 測試補充信息檢測 (pending 狀態)
  console.log('\n📝 測試 2：補充信息檢測 - pending 狀態');
  
  // 設置 pending 狀態上下文
  const pendingContext = {
    lastAction: 'record_course_pending',
    lastCourse: '排球',
    executionResult: {
      awaitingSupplementFor: 'time',
      status: 'awaiting_supplement'
    }
  };
  
  const entities2 = {
    course_name: null,
    timeInfo: {
      display: '07/29 10:20 AM',
      date: '2025-07-29'
    },
    location: null,
    teacher: null,
    student: null
  };
  
  const isSupplementInfo = LineController.detectSupplementInfo('明天早上十點20', entities2, pendingContext);
  console.log('輸入：明天早上十點20 (在 pending 狀態)');
  console.log('結果：', isSupplementInfo);
  console.log(isSupplementInfo ? '✅ 正確識別為補充信息' : '❌ 未正確識別為補充信息');

  // 測試合併邏輯
  console.log('\n📝 測試 3：上下文合併邏輯');
  
  const contextForMerge = {
    lastCourse: '排球',
    lastTimeInfo: null,
    lastLocation: null,
    lastTeacher: null,
    lastStudent: null
  };
  
  const supplementEntities = {
    course_name: null,
    timeInfo: {
      display: '07/29 10:20 AM',
      date: '2025-07-29'
    },
    location: null,
    teacher: null,
    student: null
  };
  
  const mergedEntities = LineController.mergeContextWithSupplement(contextForMerge, supplementEntities);
  console.log('上下文：', contextForMerge);
  console.log('補充：', supplementEntities);
  console.log('合併結果：', mergedEntities);
  
  const hasCourse = mergedEntities.course_name === '排球';
  const hasTime = mergedEntities.timeInfo && mergedEntities.timeInfo.display === '07/29 10:20 AM';
  console.log(hasCourse && hasTime ? '✅ 正確合併課程名稱和時間' : '❌ 合併失敗');

  // 測試非 pending 狀態不會誤判
  console.log('\n📝 測試 4：非 pending 狀態檢測');
  
  const nonPendingContext = {
    lastAction: 'record_course', // 已完成狀態
    lastCourse: '籃球'
  };
  
  const isNotSupplement = LineController.detectSupplementInfo('羽毛球', { course_name: '羽毛球' }, nonPendingContext);
  console.log('輸入：羽毛球 (在非 pending 狀態)');
  console.log('結果：', isNotSupplement);
  console.log(!isNotSupplement ? '✅ 正確識別為新課程請求' : '❌ 錯誤識別為補充信息');

  // 測試新課程關鍵詞過濾
  console.log('\n📝 測試 5：新課程關鍵詞過濾');
  
  const isNotSupplementWithKeyword = LineController.detectSupplementInfo('籃球課', { course_name: '籃球' }, pendingContext);
  console.log('輸入：籃球課 (在 pending 狀態但有課程關鍵詞)');
  console.log('結果：', isNotSupplementWithKeyword);
  console.log(!isNotSupplementWithKeyword ? '✅ 正確識別為新課程請求' : '❌ 錯誤識別為補充信息');

  console.log('\n🎯 核心邏輯測試完成');
}

testCoreLogic();