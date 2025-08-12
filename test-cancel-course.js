/**
 * 測試主動取消課程功能
 * 驗證：
 * 1. Firebase 軟刪除（cancelled=true）
 * 2. Google Calendar 標記取消（不物理刪除）
 */

const handle_add_course_task = require('./src/tasks/handle_add_course_task');
const handle_cancel_course_task = require('./src/tasks/handle_cancel_course_task');
const firebaseService = require('./src/services/firebaseService');
const googleCalendarService = require('./src/services/googleCalendarService');

async function testCancelCourse() {
  const userId = 'TEST_CANCEL_COURSE_' + Date.now();
  const testTime = new Date();
  testTime.setHours(testTime.getHours() + 3);
  const hours = testTime.getHours().toString().padStart(2, '0');
  const minutes = testTime.getMinutes().toString().padStart(2, '0');
  
  console.log('========================================');
  console.log('🧪 測試主動取消課程功能');
  console.log('========================================\n');

  try {
    // Step 1: 新增課程
    console.log('📝 Step 1: 新增測試課程...');
    const addSlots = {
      studentName: '取消測試學生',
      courseName: '主動取消課',
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

    // Step 2: 執行主動取消
    console.log('\n📝 Step 2: 執行主動取消課程...');
    
    const cancelSlots = {
      studentName: '取消測試學生',
      courseName: '主動取消課',
      timeReference: 'tomorrow',
      scope: 'single'
    };

    const cancelResult = await handle_cancel_course_task(cancelSlots, userId);
    
    if (!cancelResult.success) {
      throw new Error('取消課程失敗: ' + cancelResult.message);
    }
    
    console.log('✅ 取消操作完成');
    console.log('   訊息:', cancelResult.message);

    // Step 3: 驗證 Firebase 軟刪除
    console.log('\n📝 Step 3: 驗證 Firebase 軟刪除...');
    
    const firestore = firebaseService.getCollection('courses');
    const courseDoc = await firestore.doc(courseId).get();
    
    if (!courseDoc.exists) {
      throw new Error('❌ Firebase 文檔不存在（被物理刪除了）！應該要軟刪除');
    }
    
    const courseData = courseDoc.data();
    if (!courseData.cancelled) {
      throw new Error('❌ Firebase cancelled 欄位不是 true！');
    }
    
    if (!courseData.cancelledAt) {
      throw new Error('❌ Firebase 沒有 cancelledAt 時間戳！');
    }
    
    console.log('✅ Firebase 軟刪除正確');
    console.log('   - cancelled:', courseData.cancelled);
    console.log('   - cancelledAt:', courseData.cancelledAt?.toDate?.() || courseData.cancelledAt);

    // Step 4: 驗證 Google Calendar 標記
    if (eventId) {
      console.log('\n📝 Step 4: 驗證 Google Calendar 標記...');
      
      const student = await firebaseService.getStudent(userId, '取消測試學生');
      if (student?.calendarId) {
        try {
          const event = await googleCalendarService.getEvent(student.calendarId, eventId);
          
          // 檢查標記
          const hasPrefix = event.summary?.includes('【已取消】');
          const isTransparent = event.transparency === 'transparent';
          const isCancelled = event.extendedProperties?.private?.cancelled === 'true';
          
          console.log('📅 Google Calendar 事件狀態:');
          console.log('   - Summary:', event.summary);
          console.log('   - 包含【已取消】:', hasPrefix ? '✅' : '❌');
          console.log('   - Transparency:', event.transparency, isTransparent ? '✅' : '❌');
          console.log('   - Private.cancelled:', event.extendedProperties?.private?.cancelled, isCancelled ? '✅' : '❌');
          
          if (!hasPrefix) {
            throw new Error('❌ Google Calendar 事件沒有【已取消】前綴！');
          }
          if (!isTransparent) {
            throw new Error('❌ Google Calendar 事件不是 transparent！');
          }
          if (!isCancelled) {
            throw new Error('❌ Google Calendar extendedProperties.private.cancelled 不是 true！');
          }
          
          console.log('✅ Google Calendar 標記正確');
          
        } catch (e) {
          if (e.message.includes('Not Found') || e.response?.status === 404) {
            throw new Error('❌ Google Calendar 事件被物理刪除了！應該要保留並標記');
          }
          throw e;
        }
      }
    }

    // Step 5: 驗證衝突檢查會忽略已取消事件
    console.log('\n📝 Step 5: 驗證衝突檢查忽略已取消事件...');
    
    const student = await firebaseService.getStudent(userId, '取消測試學生');
    if (student?.calendarId) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      const conflictCheck = await googleCalendarService.checkConflict(
        student.calendarId,
        dateStr,
        `${hours}:${minutes}`
      );
      
      if (conflictCheck.hasConflict) {
        throw new Error('❌ 衝突檢查誤判已取消事件為衝突！');
      }
      
      console.log('✅ 衝突檢查正確忽略已取消事件');
    }

    console.log('\n========================================');
    console.log('✅ 測試成功！主動取消功能正常運作');
    console.log('   - Firebase: 軟刪除 ✅');
    console.log('   - Google Calendar: 標記取消 ✅');
    console.log('   - 衝突檢查: 忽略已取消 ✅');
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
testCancelCourse();