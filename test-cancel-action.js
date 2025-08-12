/**
 * 測試撤銷操作功能
 * 1. 新增課程
 * 2. 模擬撤銷操作
 * 3. 驗證物理刪除
 */

const handle_add_course_task = require('./src/tasks/handle_add_course_task');
const handle_cancel_action_task = require('./src/tasks/handle_cancel_action_task');
const firebaseService = require('./src/services/firebaseService');
const googleCalendarService = require('./src/services/googleCalendarService');

async function testCancelAction() {
  const userId = 'TEST_CANCEL_' + Date.now();
  const testTime = new Date();
  testTime.setHours(testTime.getHours() + 2);
  const hours = testTime.getHours().toString().padStart(2, '0');
  const minutes = testTime.getMinutes().toString().padStart(2, '0');
  
  console.log('========================================');
  console.log('🧪 開始測試撤銷功能');
  console.log('========================================\n');

  try {
    // Step 1: 新增課程
    console.log('📝 Step 1: 新增測試課程...');
    const addSlots = {
      studentName: '測試學生',
      courseName: '撤銷測試課',
      scheduleTime: `${hours}:${minutes}`,
      timeReference: 'tomorrow',
      recurring: false
    };

    const addResult = await handle_add_course_task(addSlots, userId);
    
    if (!addResult.success) {
      throw new Error('新增課程失敗: ' + addResult.message);
    }

    const courseId = addResult.data?.courseId;
    const eventId = addResult.data?.eventId;
    
    console.log('✅ 課程新增成功');
    console.log('   - Course ID:', courseId);
    console.log('   - Event ID:', eventId);

    // Step 2: 驗證資料存在
    console.log('\n📝 Step 2: 驗證資料已寫入...');
    
    // 檢查 Firebase
    const firestore = firebaseService.getCollection('courses');
    const courseDoc = await firestore.doc(courseId).get();
    
    if (!courseDoc.exists) {
      throw new Error('Firebase 中找不到課程');
    }
    console.log('✅ Firebase 課程存在');

    // 檢查 Google Calendar (如果有 eventId)
    if (eventId) {
      const student = await firebaseService.getStudent(userId, '測試學生');
      if (student?.calendarId) {
        try {
          await googleCalendarService.getEvent(student.calendarId, eventId);
          console.log('✅ Google Calendar 事件存在');
        } catch (e) {
          console.log('⚠️ Google Calendar 事件檢查失敗（可能是權限問題）');
        }
      }
    }

    // Step 3: 模擬撤銷操作
    console.log('\n📝 Step 3: 執行撤銷操作...');
    
    // 建立模擬的對話上下文
    const { getConversationManager } = require('./src/conversation/ConversationManager');
    const conversationManager = getConversationManager();
    
    // 設定 lastActions
    const context = await conversationManager.getContext(userId);
    context.state.lastActions = {
      add_course: {
        intent: 'add_course',
        slots: addSlots,
        result: addResult,
        timestamp: Date.now()
      }
    };
    await conversationManager.saveContext(userId, context);

    // 執行撤銷
    const cancelResult = await handle_cancel_action_task({}, userId, {});
    
    if (!cancelResult.success) {
      throw new Error('撤銷操作失敗: ' + cancelResult.message);
    }
    
    console.log('✅ 撤銷操作完成');
    console.log('   訊息:', cancelResult.message);

    // Step 4: 驗證物理刪除
    console.log('\n📝 Step 4: 驗證物理刪除...');
    
    // 檢查 Firebase 是否已刪除
    const deletedDoc = await firestore.doc(courseId).get();
    
    if (deletedDoc.exists) {
      const data = deletedDoc.data();
      if (data.cancelled) {
        throw new Error('❌ Firebase 是軟刪除（cancelled=true），應該要物理刪除！');
      } else {
        throw new Error('❌ Firebase 文檔仍然存在，物理刪除失敗！');
      }
    }
    console.log('✅ Firebase 已物理刪除');

    // 檢查 Google Calendar
    if (eventId) {
      const student = await firebaseService.getStudent(userId, '測試學生');
      if (student?.calendarId) {
        try {
          await googleCalendarService.getEvent(student.calendarId, eventId);
          throw new Error('❌ Google Calendar 事件仍然存在！');
        } catch (e) {
          if (e.message.includes('Not Found') || e.response?.status === 404) {
            console.log('✅ Google Calendar 事件已刪除');
          } else {
            console.log('⚠️ Google Calendar 檢查失敗:', e.message);
          }
        }
      }
    }

    console.log('\n========================================');
    console.log('✅ 測試成功！撤銷功能正常運作');
    console.log('========================================');
    
    // 清理
    await firebaseService.shutdownFirebase();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error('詳細錯誤:', error);
    
    // 清理
    await firebaseService.shutdownFirebase();
    process.exit(1);
  }
}

// 執行測試
testCancelAction();