const { google } = require('googleapis');

/**
 * Google Calendar API 服務封裝
 * 專精處理時間邏輯、重複規則、衝突檢測
 */

let calendar = null;
let auth = null;

/**
 * 初始化 Google Calendar API
 */
function initializeGoogleCalendar() {
  if (!calendar) {
    try {
      // 檢查必要的環境變數
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('❌ 缺少 Google Calendar 環境變數');
      }

      // 使用服務帳戶認證
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      calendar = google.calendar({ version: 'v3', auth });
      console.log('✅ Google Calendar 服務初始化完成');
    } catch (error) {
      console.error('❌ Google Calendar 初始化失敗:', error);
      throw error;
    }
  }
  return calendar;
}

/**
 * 創建新的日曆（為每個學生建立獨立日曆）
 */
async function createCalendar(studentName, userId) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    const calendarResource = {
      summary: `${studentName}的課程 (${userId})`,
      description: `由 LINE 課程管理機器人自動創建的學生課程日曆`,
      timeZone: 'Asia/Taipei',
    };

    const response = await calendarService.calendars.insert({
      resource: calendarResource,
    });

    const calendarId = response.data.id;
    console.log('✅ 已創建新日曆:', calendarId);
    
    return calendarId;
  } catch (error) {
    console.error('❌ 創建日曆失敗:', error);
    throw error;
  }
}

/**
 * 建立日期時間字串
 */
function buildDateTime(courseDate, scheduleTime, timeZone = 'Asia/Taipei') {
  if (!courseDate || !scheduleTime) {
    throw new Error('課程日期和時間都是必填項目');
  }
  
  return `${courseDate}T${scheduleTime}:00+08:00`;
}

/**
 * 加一小時（預設課程長度）
 */
function addHours(dateTimeString, hours = 1) {
  // 解析日期時間字串，保持原始格式
  // dateTimeString 格式: "2025-08-06T10:00:00+08:00"
  const match = dateTimeString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})([\+\-]\d{2}:\d{2})$/);
  
  if (!match) {
    throw new Error(`無效的日期時間格式: ${dateTimeString}`);
  }
  
  const [, date, hour, minute, second, timezone] = match;
  const newHour = parseInt(hour) + hours;
  
  // 處理小時進位（24小時制）
  if (newHour >= 24) {
    // 需要處理日期進位，使用 Date 物件
    const dateObj = new Date(dateTimeString);
    dateObj.setUTCHours(dateObj.getUTCHours() + hours);
    
    // 格式化為台北時區
    const taiwanTime = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
    const year = taiwanTime.getUTCFullYear();
    const month = String(taiwanTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(taiwanTime.getUTCDate()).padStart(2, '0');
    const h = String(taiwanTime.getUTCHours()).padStart(2, '0');
    const m = String(taiwanTime.getUTCMinutes()).padStart(2, '0');
    const s = String(taiwanTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${h}:${m}:${s}+08:00`;
  } else {
    // 簡單的小時加法
    const newHourStr = newHour.toString().padStart(2, '0');
    return `${date}T${newHourStr}:${minute}:${second}${timezone}`;
  }
}

/**
 * 建立重複規則
 */
function buildRecurrenceRule(recurring, dayOfWeek = null) {
  if (!recurring) return [];
  
  const dayMapping = {
    0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 
    4: 'TH', 5: 'FR', 6: 'SA'
  };
  
  if (dayOfWeek !== null && dayMapping[dayOfWeek]) {
    return [`RRULE:FREQ=WEEKLY;BYDAY=${dayMapping[dayOfWeek]}`];
  }
  
  return ['RRULE:FREQ=WEEKLY'];
}

/**
 * 創建課程事件
 */
async function createEvent(calendarId, courseData) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    const { 
      courseName, 
      courseDate, 
      scheduleTime, 
      recurring = false, 
      dayOfWeek = null,
      studentName 
    } = courseData;

    const startDateTime = buildDateTime(courseDate, scheduleTime);
    const endDateTime = addHours(startDateTime, 1);
    
    const eventResource = {
      summary: courseName,
      description: `${studentName}的課程\n由 LINE 課程管理機器人自動創建`,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Taipei',
      },
      recurrence: buildRecurrenceRule(recurring, dayOfWeek),
      reminders: {
        useDefault: false,
        overrides: [], // 我們使用自己的提醒系統
      },
    };

    const response = await calendarService.events.insert({
      calendarId: calendarId,
      resource: eventResource,
    });

    const eventId = response.data.id;
    console.log('✅ 已創建課程事件:', eventId);
    
    return {
      eventId,
      ...response.data
    };
  } catch (error) {
    console.error('❌ 創建課程事件失敗:', error);
    throw error;
  }
}

/**
 * 查詢事件（檢查時間衝突）
 */
async function getEvents(calendarId, timeMin, timeMax) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    const response = await calendarService.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('❌ 查詢事件失敗:', error);
    throw error;
  }
}

/**
 * 檢查時間衝突
 */
async function checkConflict(calendarId, courseDate, scheduleTime, duration = 1) {
  try {
    const startDateTime = buildDateTime(courseDate, scheduleTime);
    const endDateTime = addHours(startDateTime, duration);
    
    // 查詢當天的所有事件
    const dayStart = `${courseDate}T00:00:00+08:00`;
    const dayEnd = `${courseDate}T23:59:59+08:00`;
    
    const events = await getEvents(calendarId, dayStart, dayEnd);
    
    // 檢查是否有時間重疊
    const newStart = new Date(startDateTime);
    const newEnd = new Date(endDateTime);
    
    const conflicts = events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      
      // 檢查時間重疊
      return (newStart < eventEnd && newEnd > eventStart);
    });
    
    if (conflicts.length > 0) {
      console.log('⚠️ 發現時間衝突:', conflicts.length, '個事件');
      return {
        hasConflict: true,
        conflicts: conflicts.map(event => ({
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date
        }))
      };
    }
    
    return { hasConflict: false, conflicts: [] };
  } catch (error) {
    console.error('❌ 檢查時間衝突失敗:', error);
    return { hasConflict: false, conflicts: [] };
  }
}

/**
 * 更新事件
 */
async function updateEvent(calendarId, eventId, updateData) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    // 先取得現有事件
    const existingEvent = await calendarService.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });
    
    // 合併更新資料
    const updatedResource = {
      ...existingEvent.data,
      ...updateData,
    };
    
    const response = await calendarService.events.update({
      calendarId: calendarId,
      eventId: eventId,
      resource: updatedResource,
    });
    
    console.log('✅ 事件已更新:', eventId);
    return response.data;
  } catch (error) {
    console.error('❌ 更新事件失敗:', error);
    throw error;
  }
}

/**
 * 刪除事件
 */
async function deleteEvent(calendarId, eventId, deleteRecurring = false) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    if (deleteRecurring) {
      // 刪除整個重複事件系列
      await calendarService.events.delete({
        calendarId: calendarId,
        eventId: eventId,
      });
    } else {
      // 只刪除單一事件實例
      await calendarService.events.delete({
        calendarId: calendarId,
        eventId: eventId,
      });
    }
    
    console.log('✅ 事件已刪除:', eventId);
    return true;
  } catch (error) {
    console.error('❌ 刪除事件失敗:', error);
    throw error;
  }
}

/**
 * 取得特定事件詳情
 */
async function getEvent(calendarId, eventId) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    const response = await calendarService.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ 取得事件失敗:', error);
    throw error;
  }
}

/**
 * 同步日曆到 Firebase（定時任務用）
 */
async function syncCalendarToFirebase(calendarId, userId, studentName) {
  try {
    const calendarService = initializeGoogleCalendar();
    
    // 取得未來 30 天的事件
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const timeMin = now.toISOString();
    const timeMax = thirtyDaysLater.toISOString();
    
    const events = await getEvents(calendarId, timeMin, timeMax);
    
    // 轉換為 Firebase 格式並儲存
    const firebaseService = require('./firebaseService');
    
    for (const event of events) {
      const courseData = {
        userId,
        studentName,
        courseName: event.summary,
        calendarEventId: event.id,
        courseDate: event.start.dateTime ? 
          event.start.dateTime.split('T')[0] : 
          event.start.date,
        scheduleTime: event.start.dateTime ? 
          event.start.dateTime.split('T')[1].substring(0, 5) : 
          '00:00',
        isRecurring: !!event.recurrence,
        syncedAt: new Date()
      };
      
      // 檢查是否已存在，避免重複儲存
      const existingCourse = await firebaseService.findCourse(
        userId, 
        studentName, 
        courseData.courseName, 
        courseData.courseDate
      );
      
      if (!existingCourse) {
        await firebaseService.saveCourse(courseData);
      }
    }
    
    console.log(`✅ 日曆同步完成: ${events.length} 個事件`);
    return events.length;
  } catch (error) {
    console.error('❌ 日曆同步失敗:', error);
    throw error;
  }
}

/**
 * 測試 Google Calendar 連接
 */
async function testConnection() {
  try {
    const calendarService = initializeGoogleCalendar();
    
    // 嘗試列出日曆
    const response = await calendarService.calendarList.list({
      maxResults: 1,
    });
    
    console.log('🔗 Google Calendar 連接測試成功');
    return true;
  } catch (error) {
    console.error('❌ Google Calendar 連接測試失敗:', error);
    return false;
  }
}

module.exports = {
  // 初始化
  initializeGoogleCalendar,
  testConnection,
  
  // 日曆管理
  createCalendar,
  
  // 事件操作
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  getEvents,
  
  // 衝突檢查
  checkConflict,
  
  // 同步功能
  syncCalendarToFirebase,
  
  // 輔助函式
  buildDateTime,
  addHours,
  buildRecurrenceRule
};