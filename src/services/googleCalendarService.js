const { google } = require('googleapis');

/**
 * Google Calendar API 服務封裝
 * 專精處理時間邏輯、重複規則、衝突檢測
 */

let calendar = null;
let auth = null;
let authMode = 'uninitialized'; // 'oauth2' | 'service_account' | 'mock' | 'disabled'

/**
 * 初始化 Google Calendar API
 */
function initializeGoogleCalendar() {
  if (!calendar) {
    try {
      // 確保 dotenv 已載入（防止環境變數未載入）
      if (typeof require !== 'undefined') {
        try {
          require('dotenv').config();
        } catch (e) {
          // dotenv 可能已載入或不可用，忽略錯誤
        }
      }
      
      // 1) Mock（測試）
      if (process.env.USE_MOCK_CALENDAR === 'true') {
        calendar = {
          calendars: {
            insert: async () => ({ data: { id: `mock-calendar-${Date.now()}` } }),
          },
          events: {
            insert: async () => ({ data: { id: `mock-event-${Date.now()}` } }),
            delete: async () => ({}),
            list: async () => ({ data: { items: [] } }),
            get: async () => ({ data: { id: `mock-event-${Date.now()}` } }),
            update: async ({ eventId }) => ({ data: { id: eventId || `mock-event-${Date.now()}` } }),
          },
          calendarList: {
            list: async () => ({ data: { items: [] } }),
          },
        };
        authMode = 'mock';
        console.log('🧪 使用 Mock Calendar 服務');
      } else if (
        process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN
      ) {
        // 2) OAuth2（推薦，與 gcal-setup.md 一致）
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
          process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN });
        auth = oauth2Client;
        calendar = google.calendar({ version: 'v3', auth });
        authMode = 'oauth2';
        console.log('🔐 已使用 OAuth2 模式初始化 Google Calendar (client configured, using refresh_token)');
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        // 3) Service Account（備選）
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
        authMode = 'service_account';
        console.log('🔐 已使用 Service Account 模式初始化 Google Calendar');
      } else {
        authMode = 'disabled';
        throw new Error('❌ 缺少 Google Calendar 憑證環境變數（OAuth 或 Service Account 任一可）');
      }
      console.log('✅ Google Calendar 服務初始化完成（模式：' + authMode + '）');
    } catch (error) {
      console.error('❌ Google Calendar 初始化失敗:', error?.response?.data || error?.message || error);
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
      description: '由 LINE 課程管理機器人自動創建的學生課程日曆',
      timeZone: 'Asia/Taipei',
    };

    console.log('📝 準備建立日曆:', JSON.stringify(calendarResource));
    const response = await calendarService.calendars.insert({ resource: calendarResource });

    const calendarId = response.data.id;
    console.log('✅ 已創建新日曆:', calendarId);

    return calendarId;
  } catch (error) {
    console.error('❌ 創建日曆失敗:', error?.response?.data || error?.message || error);
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
  }
  // 簡單的小時加法
  const newHourStr = newHour.toString().padStart(2, '0');
  return `${date}T${newHourStr}:${minute}:${second}${timezone}`;
}

/**
 * 建立重複規則
 * @param {boolean} recurring - 是否重複
 * @param {string} recurrenceType - 重複類型: daily, weekly, monthly
 * @param {number} dayOfWeek - 星期幾（仅每週重複需要）
 * @returns {Array<string>} Google Calendar 重複規則陣列
 */
function buildRecurrenceRule(recurring, recurrenceType = null, dayOfWeek = null) {
  if (!recurring) return [];

  // 檢查環境變數控制
  const enableDaily = process.env.ENABLE_DAILY_RECURRING === 'true';

  if (enableDaily && recurrenceType === 'daily') {
    return ['RRULE:FREQ=DAILY'];
  }

  if (recurrenceType === 'weekly' || !recurrenceType) {
    // 每週重複（原有邏輯，預設行為）
    const dayMapping = {
      0: 'SU',
      1: 'MO',
      2: 'TU',
      3: 'WE',
      4: 'TH',
      5: 'FR',
      6: 'SA',
    };

    if (dayOfWeek !== null && dayMapping[dayOfWeek]) {
      return [`RRULE:FREQ=WEEKLY;BYDAY=${dayMapping[dayOfWeek]}`];
    }

    return ['RRULE:FREQ=WEEKLY'];
  }

  if (recurrenceType === 'monthly') {
    return ['RRULE:FREQ=MONTHLY'];
  }

  // 向下兼容：預設為每週重複
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
      recurrenceType = null,
      dayOfWeek = null,
      studentName,
      userId,
      courseId,
    } = courseData;

    const startDateTime = buildDateTime(courseDate, scheduleTime);
    const endDateTime = addHours(startDateTime, 1);

    const eventResource = {
      summary: userId ? `[${userId}] ${studentName} - ${courseName}` : `${studentName} - ${courseName}`,
      description: `${studentName}的課程\n由 LINE 課程管理機器人自動創建`,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Taipei',
      },
      recurrence: buildRecurrenceRule(recurring, recurrenceType, dayOfWeek),
      extendedProperties: {
        private: {
          userId: userId || '',
          studentName: studentName || '',
          courseId: courseId || '',
        },
      },
      reminders: {
        useDefault: false,
        overrides: [], // 我們使用自己的提醒系統
      },
    };

    console.log('📝 準備建立事件: calendarId=', calendarId, ' resource=', JSON.stringify(eventResource));
    const response = await calendarService.events.insert({ calendarId, resource: eventResource });

    const eventId = response.data.id;
    console.log('✅ 已創建課程事件:', eventId);

    return {
      eventId,
      ...response.data,
    };
  } catch (error) {
    console.error('❌ 創建課程事件失敗:', error?.response?.data || error?.message || error);
    throw error;
  }
}

/**
 * 將事件標記為「已取消」而不物理刪除
 * - 在 summary 前加上【已取消】（若尚未存在）
 * - 設為透明（不佔忙碌時段）
 * - 於 extendedProperties.private.cancelled 設為 'true'
 */
async function markEventCancelled(calendarId, eventId) {
  try {
    const calendarService = initializeGoogleCalendar();

    // 取得現有事件
    const existing = await calendarService.events.get({ calendarId, eventId });
    const resource = existing.data || {};

    const hasPrefix = typeof resource.summary === 'string' && resource.summary.includes('【已取消】');
    const summary = hasPrefix ? resource.summary : `【已取消】${resource.summary || ''}`;

    // 準備 extendedProperties.private
    const extendedPrivate = {
      ...(resource.extendedProperties && resource.extendedProperties.private ? resource.extendedProperties.private : {}),
      cancelled: 'true',
    };

    const updated = {
      ...resource,
      summary,
      transparency: 'transparent',
      extendedProperties: {
        ...(resource.extendedProperties || {}),
        private: extendedPrivate,
      },
    };

    await calendarService.events.update({ calendarId, eventId, resource: updated });
    console.log('✅ 事件已標記為已取消:', eventId);
    return { success: true };
  } catch (error) {
    console.error('❌ 標記事件為已取消失敗:', error?.response?.data || error?.message || error);
    return { success: false, message: error?.message };
  }
}

/**
 * 查詢事件（檢查時間衝突）
 */
async function getEvents(calendarId, timeMin, timeMax) {
  try {
    const calendarService = initializeGoogleCalendar();

    const response = await calendarService.events.list({
      calendarId,
      timeMin,
      timeMax,
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

    let events = await getEvents(calendarId, dayStart, dayEnd);

    // 過濾「已取消」事件（不應參與衝突判斷）
    events = (events || []).filter((event) => {
      try {
        const cancelledFlag = event?.extendedProperties?.private?.cancelled === 'true';
        const cancelledTitle = typeof event?.summary === 'string' && event.summary.includes('【已取消】');
        return !(cancelledFlag || cancelledTitle);
      } catch (_) {
        return true;
      }
    });

    // 檢查是否有時間重疊
    const newStart = new Date(startDateTime);
    const newEnd = new Date(endDateTime);

    const conflicts = events.filter((event) => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);

      // 檢查時間重疊
      return (newStart < eventEnd && newEnd > eventStart);
    });

    if (conflicts.length > 0) {
      console.log('⚠️ 發現時間衝突:', conflicts.length, '個事件');
      return {
        hasConflict: true,
        conflicts: conflicts.map((event) => ({
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
        })),
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
      calendarId,
      eventId,
    });

    // 合併更新資料
    const updatedResource = {
      ...existingEvent.data,
      ...updateData,
    };

    const response = await calendarService.events.update({
      calendarId,
      eventId,
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
        calendarId,
        eventId,
      });
    } else {
      // 只刪除單一事件實例
      await calendarService.events.delete({
        calendarId,
        eventId,
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
      calendarId,
      eventId,
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
        courseDate: event.start.dateTime
          ? event.start.dateTime.split('T')[0]
          : event.start.date,
        scheduleTime: event.start.dateTime
          ? event.start.dateTime.split('T')[1].substring(0, 5)
          : '00:00',
        isRecurring: !!event.recurrence,
        syncedAt: new Date(),
      };

      // 檢查是否已存在，避免重複儲存
      const existingCourse = await firebaseService.findCourse(
        userId,
        studentName,
        courseData.courseName,
        courseData.courseDate,
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
    return { ok: true, authMode };
  } catch (error) {
    console.error('❌ Google Calendar 連接測試失敗:', error);
    return { ok: false, authMode, error: error.message };
  }
}

/**
 * 驗證目前憑證對 calendarId 是否可存取
 * - ok=true 代表可用
 * - ok=false 搭配 reason: 'not_found' | 'forbidden' | 'unknown'
 */
async function verifyCalendarAccess(calendarId) {
  try {
    const calendarService = initializeGoogleCalendar();
    await calendarService.calendars.get({ calendarId });
    return { ok: true };
  } catch (error) {
    const status = error?.response?.status;
    const msg = error?.message || '';
    if (status === 404 || /Not Found/i.test(msg)) return { ok: false, reason: 'not_found', error };
    if (status === 403 || /Forbidden/i.test(msg)) return { ok: false, reason: 'forbidden', error };
    return { ok: false, reason: 'unknown', error };
  }
}

module.exports = {
  // 初始化
  initializeGoogleCalendar,
  testConnection,
  getAuthMode: () => authMode,

  // 日曆管理
  createCalendar,

  // 事件操作
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  getEvents,
  markEventCancelled,

  // 衝突檢查
  checkConflict,

  // 同步功能
  syncCalendarToFirebase,

  // 輔助函式
  buildDateTime,
  addHours,
  buildRecurrenceRule,
  
  // 驗證工具
  verifyCalendarAccess,
};
