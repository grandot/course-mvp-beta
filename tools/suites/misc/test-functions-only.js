#!/usr/bin/env node

/**
 * 功能單元測試工具
 * 直接測試任務處理器的核心邏輯，不依賴外部服務
 */

// 載入環境變數
require('dotenv').config();

const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');

/**
 * 模擬課程資料
 */
const mockCourseData = {
  id: 'mock_course_001',
  courseId: 'mock_course_001',
  userId: 'TEST_USER_12345',
  studentName: '小明',
  courseName: '數學課',
  courseDate: '2025-08-06', // 明天
  scheduleTime: '15:00',
  calendarEventId: 'mock_calendar_event_001',
  recurring: false,
  cancelled: false,
  createdAt: new Date()
};

/**
 * 模擬 Firebase 服務
 */
const mockFirebaseService = {
  findCourse: async (userId, studentName, courseName, courseDate) => {
    console.log(`🔍 模擬查找課程: ${studentName} 的 ${courseName} (${courseDate || '最近'})`);
    if (studentName === '小明' && courseName === '數學課') {
      return mockCourseData;
    }
    return null;
  },
  
  createReminder: async (reminderData) => {
    console.log('💾 模擬創建提醒:', reminderData);
    return {
      reminderId: 'mock_reminder_001',
      ...reminderData
    };
  },
  
  deleteCourse: async (courseId) => {
    console.log(`🗑️ 模擬取消課程: ${courseId}`);
    return true;
  }
};

/**
 * 模擬 Google Calendar 服務
 */
const mockGoogleCalendarService = {
  deleteEvent: async (calendarId, eventId) => {
    console.log(`📅 模擬刪除 Google Calendar 事件: ${eventId}`);
    return { success: true };
  }
};

/**
 * 測試 set_reminder 功能
 */
async function testSetReminder() {
  console.log('\n🧪 測試 set_reminder 功能');
  console.log('=' .repeat(50));
  
  try {
    // 替換真實服務為模擬服務
    const originalFirebaseService = require('../src/services').firebaseService;
    require('../src/services').firebaseService = mockFirebaseService;
    
    const handle_set_reminder_task = require('../src/tasks/handle_set_reminder_task');
    
    const testCases = [
      {
        name: '基本提醒設定',
        slots: {
          studentName: '小明',
          courseName: '數學課',
          reminderTime: 30
        }
      },
      {
        name: '指定時間提醒',
        slots: {
          studentName: '小明',
          courseName: '數學課',
          reminderTime: 15,
          reminderNote: '記得帶計算機'
        }
      },
      {
        name: '找不到課程',
        slots: {
          studentName: '小美',
          courseName: '英文課'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📝 測試案例: ${testCase.name}`);
      console.log('輸入 slots:', testCase.slots);
      
      const result = await handle_set_reminder_task(testCase.slots, 'TEST_USER_12345');
      
      console.log('✅ 結果:', result.success ? '成功' : '失敗');
      console.log('📄 訊息:', result.message);
    }
    
    // 恢復原始服務
    require('../src/services').firebaseService = originalFirebaseService;
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

/**
 * 測試 cancel_course 功能
 */
async function testCancelCourse() {
  console.log('\n🧪 測試 cancel_course 功能');
  console.log('=' .repeat(50));
  
  try {
    // 替換真實服務為模擬服務
    const originalFirebaseService = require('../src/services').firebaseService;
    const originalGoogleCalendarService = require('../src/services').googleCalendarService;
    
    require('../src/services').firebaseService = mockFirebaseService;
    require('../src/services').googleCalendarService = mockGoogleCalendarService;
    
    const handle_cancel_course_task = require('../src/tasks/handle_cancel_course_task');
    
    const testCases = [
      {
        name: '取消單次課程',
        slots: {
          studentName: '小明',
          courseName: '數學課',
          scope: 'single',
          timeReference: 'tomorrow'
        }
      },
      {
        name: '找不到課程',
        slots: {
          studentName: '小美',
          courseName: '英文課',
          scope: 'single'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📝 測試案例: ${testCase.name}`);
      console.log('輸入 slots:', testCase.slots);
      
      const result = await handle_cancel_course_task(testCase.slots, 'TEST_USER_12345');
      
      console.log('✅ 結果:', result.success ? '成功' : '失敗');
      console.log('📄 訊息:', result.message);
    }
    
    // 恢復原始服務
    require('../src/services').firebaseService = originalFirebaseService;
    require('../src/services').googleCalendarService = originalGoogleCalendarService;
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

/**
 * 測試語意處理與功能整合
 */
async function testSemanticIntegration() {
  console.log('\n🧪 測試語意處理與功能整合');
  console.log('=' .repeat(50));
  
  const testMessages = [
    '提醒我小明的數學課',
    '鋼琴課前15分鐘通知我',
    '取消小明明天的數學課',
    '刪掉Lumi的英文課'
  ];
  
  for (const message of testMessages) {
    console.log(`\n📝 測試訊息: "${message}"`);
    
    // 意圖識別
    const intent = await parseIntent(message);
    console.log('🎯 識別意圖:', intent);
    
    // 實體提取
    const slots = await extractSlots(message, intent);
    console.log('📋 提取 slots:', slots);
    
    // 確認處理器存在
    const taskHandlers = {
      'set_reminder': '../src/tasks/handle_set_reminder_task',
      'cancel_course': '../src/tasks/handle_cancel_course_task'
    };
    
    if (taskHandlers[intent]) {
      console.log('✅ 找到對應處理器');
    } else {
      console.log('❌ 找不到對應處理器');
    }
  }
}

/**
 * 主要測試函式
 */
async function main() {
  try {
    console.log('🚀 開始功能單元測試');
    console.log('=' .repeat(60));
    
    await testSemanticIntegration();
    await testSetReminder();
    await testCancelCourse();
    
    console.log('\n✅ 所有測試完成');
    
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  main();
}