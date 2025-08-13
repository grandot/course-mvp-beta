/**
 * 處理新增課程任務
 * 支持單次課程和重複課程的建立
 */

const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');
const { getConversationManager } = require('../conversation/ConversationManager');

/**
 * 驗證必要的 slots
 */
function validateSlots(slots) {
  const errors = [];

  if (!slots.studentName) {
    errors.push('學生姓名');
  }
  if (!slots.courseName) {
    errors.push('課程名稱');
  }
  if (!slots.scheduleTime) {
    errors.push('上課時間');
  }

  // 對於非重複課程，需要具體日期
  if (!slots.recurring && !slots.courseDate && !slots.timeReference) {
    errors.push('課程日期');
  }

  // 對於重複課程，每週重複需要星期幾，每日重複不需要
  if (slots.recurring && slots.recurrenceType === 'weekly' && (slots.dayOfWeek === null || slots.dayOfWeek === undefined)) {
    errors.push('星期幾');
  }

  return errors;
}

/**
 * 處理時間參考轉換為具體日期
 */
function resolveTimeReference(timeReference) {
  const today = new Date();
  let targetDate;

  switch (timeReference) {
    case 'today':
      targetDate = today;
      break;
    case 'tomorrow':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 1);
      break;
    case 'day_after_tomorrow':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 2);
      break;
    case 'yesterday':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 1);
      break;
    case 'day_before_yesterday':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 2);
      break;
    default:
      return null;
  }

  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式
}

/**
 * 使用 Asia/Taipei 時區的安全日期函數（防止跨日誤判）
 */
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  return taiwanTime;
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 檢查當月是否有指定日期
 */
function hasDateInMonth(year, month, day) {
  const testDate = new Date(year, month - 1, day);
  return testDate.getMonth() === month - 1 && testDate.getDate() === day;
}

/**
 * 處理重複課程的日期計算（符合人類直覺的推導邏輯）
 * @param {string} recurrenceType - 重複類型：daily, weekly, monthly
 * @param {number|array} dayOfWeek - 星期幾（僅每週重複需要）
 * @param {string} scheduleTime - 課程時間（HH:MM格式），用於判斷是否已過
 * @param {number} monthDay - 每月重複的目標日期（1-31）
 * @returns {string} 下次課程日期 YYYY-MM-DD
 */
function calculateNextCourseDate(recurrenceType, dayOfWeek = null, scheduleTime = null, monthDay = null) {
  const today = getTaiwanDate();
  const todayStr = formatDateString(today);

  if (recurrenceType === 'daily') {
    // 每日重複：今天指定時間未過→今天；否則→明天
    if (scheduleTime) {
      const targetDateTime = new Date(`${todayStr}T${scheduleTime}:00+08:00`);
      const nowTaiwan = getTaiwanDate();

      // 如果今天的指定時間還沒到，從今天開始
      if (targetDateTime > nowTaiwan) {
        return todayStr;
      }
    }

    // 時間已過或未指定時間：從明天開始
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDateString(tomorrow);
  }

  if (recurrenceType === 'weekly' && dayOfWeek !== null) {
    // 每週重複：從「現在」起找最近的符合週幾；若今天且未過→今天
    const currentDay = today.getDay();

    // 將 dayOfWeek 正規化為代碼集合（0~6）
    const daySet = new Set(
      Array.isArray(dayOfWeek)
        ? dayOfWeek.map((d) => (typeof d === 'string' ? Number(d) : d)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        : [dayOfWeek],
    );

    // 如果今天就在集合內，且指定時間未過，直接使用今天
    if (daySet.has(currentDay) && scheduleTime) {
      const targetDateTime = new Date(`${todayStr}T${scheduleTime}:00+08:00`);
      const nowTaiwan = getTaiwanDate();
      if (targetDateTime > nowTaiwan) {
        return todayStr;
      }
    }

    // 計算距離最近的下一個符合週幾
    let minDelta = 8; // 大於一週即可
    for (const d of daySet) {
      let delta = d - currentDay;
      if (delta <= 0) delta += 7;
      if (delta < minDelta) minDelta = delta;
    }
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + (minDelta === 8 ? 7 : minDelta));
    return formatDateString(nextDate);
  }

  if (recurrenceType === 'monthly') {
    // 每月重複（BYMONTHDAY）：本月有該日且未過→本月；否則→下月；小月無該日→跳過
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // 使用用戶指定的日期作為目標日期（BYMONTHDAY 模式）
    // monthDay 參數由呼叫方傳入，若無則使用當日
    const targetDay = monthDay || currentDay;

    // 檢查本月該日是否存在且時間未過
    if (hasDateInMonth(currentYear, currentMonth, targetDay) && scheduleTime) {
      const targetDateTime = new Date(`${todayStr}T${scheduleTime}:00+08:00`);
      const nowTaiwan = getTaiwanDate();
      if (targetDateTime > nowTaiwan) {
        return todayStr;
      }
    }

    // 嘗試下個月同一天
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // 檢查下月是否有該日
    if (hasDateInMonth(nextYear, nextMonth, targetDay)) {
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    }
    // 小月無該日：跳過到再下個月（不自動改為月底）
    let skipMonth = nextMonth + 1;
    let skipYear = nextYear;
    if (skipMonth > 12) {
      skipMonth = 1;
      skipYear += 1;
    }
    return `${skipYear}-${String(skipMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  }

  // 預設回傳明天
  const defaultDate = new Date(today);
  defaultDate.setDate(today.getDate() + 1);
  return formatDateString(defaultDate);
}

/**
 * 確保學生有對應的 Google Calendar
 */
async function ensureStudentCalendar(userId, studentName) {
  try {
    // 查詢學生是否已存在
    let student = await firebaseService.getStudent(userId, studentName);

    if (!student) {
      console.log('📚 創建新學生資料:', studentName);

      // 為學生創建 Google Calendar
      const calendarId = await googleCalendarService.createCalendar(studentName, userId);

      // 在 Firebase 中記錄學生資料
      student = await firebaseService.addStudent(userId, studentName, calendarId);
      return student;
    }

    // 無 calendarId → 自動補建
    if (!student.calendarId) {
      const calendarId = await googleCalendarService.createCalendar(studentName, userId);
      if (firebaseService.updateStudentCalendarId) {
        await firebaseService.updateStudentCalendarId(userId, studentName, calendarId);
      }
      return { ...student, calendarId };
    }

    // 有 calendarId，但可能不是現在的 OAuth 身份 → 驗證，失敗則重建並回寫
    if (googleCalendarService.verifyCalendarAccess) {
      const access = await googleCalendarService.verifyCalendarAccess(student.calendarId);
      if (!access.ok) {
        console.warn('⚠️ calendarId 無法存取，將自動重建:', access.reason);
        const calendarId = await googleCalendarService.createCalendar(studentName, userId);
        if (firebaseService.updateStudentCalendarId) {
          await firebaseService.updateStudentCalendarId(userId, studentName, calendarId);
        }
        return { ...student, calendarId };
      }
    }

    return student;
  } catch (error) {
    console.error('❌ 確保學生日曆失敗:', error);
    throw error;
  }
}

/**
 * 主要處理函式
 */
async function handle_add_course_task(slots, userId, messageEvent = null) {
  try {
    console.log('🎯 開始處理新增課程任務');
    console.log('📋 接收參數:', slots);

    // -1. 極小回退：若缺時間/日期參照，嘗試從原始訊息補齊（提升多輪與自然語句容錯）
    if (messageEvent && messageEvent.message && typeof messageEvent.message.text === 'string') {
      const raw = messageEvent.message.text;
      // 補時間
      if (!slots.scheduleTime) {
        try {
          const { parseScheduleTime } = require('../intent/timeParser');
          const t = parseScheduleTime(raw);
          if (t) slots.scheduleTime = t;
        } catch (_) {}
      }
      // 補日期/時間參照
      if (!slots.courseDate && !slots.timeReference) {
        try {
          const { parseTimeReference, parseSpecificDate } = require('../intent/extractSlots');
          const d = parseSpecificDate(raw);
          const r = parseTimeReference(raw);
          if (d) slots.courseDate = d; else if (r) slots.timeReference = r;
        } catch (_) {}
      }
    }

    // 0. 先校驗時間格式（即使缺其他欄位也優先提示時間錯誤）
    if (slots.scheduleTime || slots.invalidTime) {
      const timeOk = slots.scheduleTime ? /^([01]\d|2[0-3]):([0-5]\d)$/.test(slots.scheduleTime) : false;
      if (!timeOk) {
        const conversationManager = getConversationManager();
        await conversationManager.setExpectedInput(
          userId,
          'course_creation',
          ['schedule_time_input'],
          { intent: 'add_course', existingSlots: slots, missingFields: ['上課時間'] },
        );
        return {
          success: false,
          code: 'VALIDATION_ERROR',
          message: '❌ 時間格式不正確，請重新輸入正確的時間（例如：下午2點 或 14:00）',
          expectingInput: true,
          missingFields: ['上課時間'],
        };
      }
    }

    // 1. 優先處理重複功能關閉但用戶要求重複的情況
    if (slots.recurringRequested) {
      // 可觀測性：NDJSON 格式日誌（降級時）
      const observabilityLog = {
        intent: 'add_course',
        userId,
        traceId: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        recurringRequested: true,
        disabledByFlag: true,
        status: 'disabled',
        timestamp: new Date().toISOString(),
      };
      console.log(`OBSERVABILITY: ${JSON.stringify(observabilityLog)}`);

      return {
        success: false,
        code: 'RECURRING_DISABLED',
        message: '⚠️ 重複課程功能目前未開放，僅支援單次課程。\n\n範例：「小明明天下午3點數學課」',
      };
    }

    // 2. 驗證必要參數
    const missingFields = validateSlots(slots);
    if (missingFields.length > 0) {
      const conversationManager = getConversationManager();

      // 建立期待輸入類型陣列
      const expectedInputs = [];
      if (missingFields.includes('學生姓名')) expectedInputs.push('student_name_input');
      if (missingFields.includes('課程名稱')) expectedInputs.push('course_name_input');
      if (missingFields.includes('上課時間')) expectedInputs.push('schedule_time_input');
      if (missingFields.includes('課程日期')) expectedInputs.push('course_date_input');
      if (missingFields.includes('星期幾')) expectedInputs.push('day_of_week_input');

      // 設定期待輸入狀態，保存當前已有的 slots
      await conversationManager.setExpectedInput(
        userId,
        'course_creation',
        expectedInputs,
        {
          intent: 'add_course',
          existingSlots: slots,
          missingFields,
        },
      );

      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: `❓ 請提供以下資訊：${missingFields.join('、')}\n\n範例：「小明每週三下午3點數學課」`,
        expectingInput: true,
        missingFields,
      };
    }

    // 3. 統一重複功能檢查（使用單一事實來源）
    const { isRecurringEnabled } = require('../intent/extractSlots');
    if (slots.recurring && !isRecurringEnabled()) {
      return {
        success: false,
        code: 'RECURRING_DISABLED',
        message: '⚠️ 重複課程功能目前未開放，僅支援單次課程。\n\n範例：「小明明天下午3點數學課」',
      };
    }

    // 4. 處理時間和日期
    let { courseDate } = slots;

    if (!courseDate && slots.timeReference) {
      courseDate = resolveTimeReference(slots.timeReference);
    }

    if (!courseDate && slots.recurring) {
      // 支援不同類型的重複課程（weekly 可為多天；monthly 使用 monthDay）
      courseDate = calculateNextCourseDate(
        slots.recurrenceType || 'weekly',
        slots.dayOfWeek,
        slots.scheduleTime,
        slots.monthDay || (slots.courseDate ? new Date(slots.courseDate).getDate() : null),
      );
    }

    // 若 courseDate 存在但不是 YYYY-MM-DD，視為無效並以 timeReference/recurring 推導
    if (courseDate && !/^\d{4}-\d{2}-\d{2}$/.test(courseDate)) {
      console.log(`⚠️ 無效的 courseDate 格式: ${courseDate}，嘗試以參考時間或重複規則推導`);
      courseDate = null;
      if (slots.timeReference) {
        courseDate = resolveTimeReference(slots.timeReference);
      }
      if (!courseDate && slots.recurring) {
        courseDate = calculateNextCourseDate(
          slots.recurrenceType || 'weekly',
          slots.dayOfWeek,
          slots.scheduleTime,
          slots.monthDay || null,
        );
      }
    }

    if (!courseDate) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: '❓ 請提供以下資訊：課程日期\n\n範例：「小明每週三下午3點數學課」',
        expectingInput: true,
        missingFields: ['課程日期'],
      };
    }

    // 3.1 非重複課：禁止建立過去時間
    if (!slots.recurring) {
      const dateTimeStr = `${courseDate}T${slots.scheduleTime || '00:00'}:00`;
      const targetMs = Date.parse(dateTimeStr);
      if (!Number.isNaN(targetMs) && targetMs < Date.now()) {
        return {
          success: false,
          code: 'VALIDATION_ERROR',
          message: '❌ 無法建立過去時間的課程，請確認日期時間後重新輸入',
        };
      }
    }

    // 3. 確保學生有對應的日曆
    let student;
    try {
      student = await ensureStudentCalendar(userId, slots.studentName);
    } catch (e) {
      console.warn('⚠️ 確保學生日曆失敗，將採用 Firebase 先落地的降級策略:', e?.message || e);
      student = { calendarId: null, studentName: slots.studentName };
    }
    console.log('👤 學生日曆:', student.calendarId);

    // 4. 檢查時間衝突（僅檢查首個實例，降低成本與假陽性）
    const conflictCheck = await googleCalendarService.checkConflict(
      student.calendarId,
      courseDate,
      slots.scheduleTime,
    );

    if (conflictCheck.hasConflict) {
      const conflictInfo = conflictCheck.conflicts
        .map((c) => `• ${c.summary} (${c.start.split('T')[1].substring(0, 5)})`)
        .join('\n');

      const conflictMessage = slots.recurring
        ? `⚠️ 首個時段衝突\n\n${courseDate} ${slots.scheduleTime} 已有以下課程：\n${conflictInfo}\n\n💡 註：僅檢查首個實例時段，後續時段請自行確認。\n\n請選擇其他時間或確認是否要覆蓋。`
        : `⚠️ 時間衝突\n\n${courseDate} ${slots.scheduleTime} 已有以下課程：\n${conflictInfo}\n\n請選擇其他時間或確認是否要覆蓋。`;

      return {
        success: false,
        code: 'CONFLICT_ERROR',
        message: conflictMessage,
      };
    }

    // 5. 建立 Google Calendar 事件
    const eventData = {
      courseName: slots.courseName,
      courseDate,
      scheduleTime: slots.scheduleTime,
      recurring: slots.recurring || false,
      recurrenceType: slots.recurrenceType || null,
      dayOfWeek: slots.dayOfWeek,
      studentName: slots.studentName,
      userId,
      // 為 monthly 重複類型提供 monthDay 參數（優先來自 slots.monthDay，其次 courseDate 派生）
      monthDay: (slots.recurrenceType === 'monthly')
        ? (typeof slots.monthDay === 'number' ? slots.monthDay : new Date(courseDate).getDate())
        : null,
    };

    let calendarEvent = { eventId: null };
    try {
      if (student.calendarId) {
        calendarEvent = await googleCalendarService.createEvent(
          student.calendarId,
          eventData,
        );
        console.log('📅 Google Calendar 事件已創建:', calendarEvent.eventId);
      } else {
        console.warn('⚠️ 無學生 calendarId，跳過 GCal 事件建立，將僅寫入 Firebase');
      }
    } catch (e) {
      console.warn('⚠️ 建立 GCal 事件失敗，嘗試自動重建日曆並重試一次:', e?.message || e);
      try {
        const reStudent = await ensureStudentCalendar(userId, slots.studentName);
        if (reStudent.calendarId) {
          student = reStudent;
          calendarEvent = await googleCalendarService.createEvent(
            student.calendarId,
            eventData,
          );
          console.log('📅 重試後事件已創建:', calendarEvent.eventId);
        }
      } catch (e2) {
        console.warn('⚠️ 重試建立 GCal 事件仍失敗，採用 Firebase 降級策略:', e2?.message || e2);
        // calendarEvent 仍為 { eventId: null }
      }
    }

    // 6. 同步資料到 Firebase
    const courseData = {
      userId,
      studentName: slots.studentName,
      courseName: slots.courseName,
      courseDate,
      scheduleTime: slots.scheduleTime,
      calendarEventId: calendarEvent.eventId,
      calendarId: student.calendarId,
      isRecurring: slots.recurring || false,
      recurrenceType: slots.recurrenceType || null,
      duration: 60, // 預設1小時
      createdFrom: 'line_bot',
    };

    // 只有當 dayOfWeek 不是 undefined 或 null 時才加入
    if (slots.dayOfWeek !== undefined && slots.dayOfWeek !== null) {
      courseData.dayOfWeek = slots.dayOfWeek;
    }

    const savedCourse = await firebaseService.saveCourse(courseData);
    console.log('💾 Firebase 課程資料已儲存:', savedCourse.courseId);

    // 可觀測性：NDJSON 格式日誌（建立系列時）
    if (slots.recurring) {
      try {
        const logger = require('../utils/logger');
        logger.info({
          intent: 'add_course',
          userId,
          traceId: logger.generateTraceId('course'),
          recurring: true,
          recurrenceType: slots.recurrenceType,
          startDate: courseDate,
          scheduleTime: slots.scheduleTime,
          rule: Array.isArray(calendarEvent.recurrence) ? calendarEvent.recurrence.join(';') : null,
          status: 'success',
        });
      } catch (_) {}
    }

    // 6.5 檢查小月策略提示（29/30/31號的月重複）
    let smallMonthWarning = '';
    if (slots.recurring && slots.recurrenceType === 'monthly') {
      const monthDay = new Date(courseDate).getDate();
      if (monthDay >= 29) {
        const today = getTaiwanDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 檢查未來幾個月是否會遇到小月問題
        const futureIssues = [];
        for (let i = 1; i <= 6; i++) { // 檢查未來6個月
          let checkMonth = currentMonth + i;
          let checkYear = currentYear;
          if (checkMonth > 12) {
            checkMonth -= 12;
            checkYear += 1;
          }

          if (!hasDateInMonth(checkYear, checkMonth, monthDay)) {
            futureIssues.push(`${checkYear}年${checkMonth}月`);
          }
        }

        if (futureIssues.length > 0) {
          smallMonthWarning = `\n\n💡 小月提醒：${futureIssues.slice(0, 2).join('、')}${futureIssues.length > 2 ? '等' : ''}將無${monthDay}號，課程會自動跳過。\n如需改為每月最後一天，請告知調整。`;
        }
      }
    }

    // 7. 格式化成功訊息
    const timeDisplay = slots.scheduleTime.replace(/(\d{2}):(\d{2})/, (match, hour, minute) => {
      const h = parseInt(hour, 10);
      const mm = minute.padStart(2, '0');
      if (h === 0) return `上午12:${mm}`; // 00:xx → 上午12:xx
      if (h < 12) return `上午${h}:${mm}`;
      if (h === 12) return `中午12:${mm}`;
      return `下午${h - 12}:${mm}`;
    });

    let message = '✅ 課程已安排成功！\n\n';
    if (!calendarEvent.eventId) {
      message = '✅ 課程已暫存成功（日曆稍後同步）！\n\n';
    }
    message += `👦 學生：${slots.studentName}\n`;
    message += `📚 課程：${slots.courseName}\n`;

    if (slots.recurring) {
      let recurringDisplay = '';

      if (slots.recurrenceType === 'daily') {
        recurringDisplay = `🔄 重複：每天 ${timeDisplay}\n`;
      } else if (slots.recurrenceType === 'weekly' && slots.dayOfWeek !== null) {
        // 週期：支援單天或多天顯示
        const zhDaysFull = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const zhDaysShort = ['日', '一', '二', '三', '四', '五', '六'];
        const normalizeIndex = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const map = {
              SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
            };
            const up = val.trim().toUpperCase();
            if (map.hasOwnProperty(up)) return map[up];
            const n = Number(up);
            if (Number.isFinite(n)) return n;
          }
          return null;
        };
        if (Array.isArray(slots.dayOfWeek)) {
          const short = slots.dayOfWeek
            .map(normalizeIndex)
            .filter((n) => n !== null && n >= 0 && n <= 6)
            .map((n) => zhDaysShort[n]);
          const joined = short.join(''); // 例：一三五
          if (joined) {
            recurringDisplay = `🔄 重複：每週${joined} ${timeDisplay}\n`;
          } else {
            // 後備：單天（若解析失敗）
            const idx = normalizeIndex(slots.dayOfWeek[0]);
            const label = (idx !== null && idx >= 0 && idx <= 6) ? zhDaysFull[idx] : '週';
            recurringDisplay = `🔄 重複：每${label} ${timeDisplay}\n`;
          }
        } else {
          const idx = normalizeIndex(slots.dayOfWeek);
          const label = (idx !== null && idx >= 0 && idx <= 6) ? zhDaysFull[idx] : '週';
          recurringDisplay = `🔄 重複：每${label} ${timeDisplay}\n`;
        }
      } else if (slots.recurrenceType === 'monthly') {
        const md = (typeof eventData.monthDay === 'number' && eventData.monthDay >= 1 && eventData.monthDay <= 31)
          ? `${eventData.monthDay}號`
          : '';
        recurringDisplay = `🔄 重複：每月${md ? ' ' + md : ''} ${timeDisplay}\n`;
      } else {
        // 向下兼容：預設為每週
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const dayName = slots.dayOfWeek !== null ? days[slots.dayOfWeek] : '不明';
        recurringDisplay = `🔄 重複：每${dayName} ${timeDisplay}\n`;
      }

      message += recurringDisplay;
      message += `📅 下次上課：${courseDate}`;
    } else {
      message += `📅 日期：${courseDate}\n`;
      message += `🕐 時間：${timeDisplay}`;
    }

    // 加入小月提醒
    message += smallMonthWarning;

    // 設定期待確認狀態（簡化版）
    const result = {
      success: true,
      code: 'ADD_COURSE_OK',
      message,
      data: {
        courseId: savedCourse.courseId,
        eventId: calendarEvent.eventId,
      },
      quickReply: [
        { label: '✅ 確認', text: '確認' },
        { label: '❌ 取消操作', text: '取消操作' },
      ],
    };

    if (result.success && result.quickReply) {
      const conversationManager = getConversationManager();

      const context = await conversationManager.getContext(userId);
      context.state.expectingInput = ['confirmation', 'modification'];
      context.state.pendingData = {
        lastOperation: { intent: 'add_course', slots, result },
        timestamp: Date.now(),
      };
      // 同步記錄至 lastActions 以供修改流程穩定讀取
      context.state.lastActions = context.state.lastActions || {};
      context.state.lastActions.add_course = {
        intent: 'add_course',
        slots,
        result,
        timestamp: Date.now(),
      };
      await conversationManager.saveContext(userId, context);
    }

    return result;
  } catch (error) {
    console.error('❌ 新增課程任務失敗:', error);

    // 根據錯誤類型提供不同的回應
    if (error.message.includes('Calendar')) {
      return {
        success: false,
        code: 'SYSTEM_ERROR',
        message: '❌ 日曆服務暫時無法使用，請稍後再試。',
      };
    } if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
      return {
        success: false,
        code: 'SYSTEM_ERROR',
        message: '❌ 資料儲存失敗，請稍後再試。',
      };
    }
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '❌ 新增課程失敗，請檢查輸入資訊並稍後再試。',
    };
  }
}

module.exports = handle_add_course_task;
