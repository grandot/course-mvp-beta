/**
 * 修改課程任務處理器
 * 支援單次課程的時間/日期修改，維持 Google Calendar 與 Firebase 一致性
 */

const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');
const { getConversationManager } = require('../conversation/ConversationManager');

/**
 * 處理時間參考轉換為具體日期
 */
function toYmdFromReference(timeReference) {
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
    case 'yesterday':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 1);
      break;
    case 'day_after_tomorrow':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 2);
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
 * 檢查時間是否為過去時間
 */
function isPastTime(courseDate, scheduleTime) {
  const now = new Date();
  const courseDateTime = new Date(`${courseDate}T${scheduleTime}:00`);
  return courseDateTime < now;
}

/**
 * 格式化時間顯示 HH:MM
 */
function fmtHm(isoDateTimeOrTime) {
  if (typeof isoDateTimeOrTime === 'string') {
    if (isoDateTimeOrTime.includes('T')) {
      // ISO datetime string
      const time = isoDateTimeOrTime.split('T')[1];
      return time.substring(0, 5); // HH:MM
    } if (isoDateTimeOrTime.includes(':')) {
      // Already HH:MM format
      return isoDateTimeOrTime.substring(0, 5);
    }
  }
  return isoDateTimeOrTime;
}

/**
 * 轉換為中文時間格式
 */
function toZhTime(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  const mm = minute.toString().padStart(2, '0');

  if (hour === 0) return `上午12:${mm}`;
  if (hour < 12) return `上午${hour}:${mm}`;
  if (hour === 12) return `中午12:${mm}`;
  return `下午${hour - 12}:${mm}`;
}

/**
 * 確保學生有對應的 Google Calendar（自癒邏輯）
 */
async function ensureStudentCalendarSafe(userId, studentName) {
  const student = await firebaseService.getStudent(userId, studentName);

  if (!student) {
    throw new Error(`找不到學生資料: ${studentName}`);
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
}

/**
 * 建立事件摘要
 */
function buildEventSummary(userId, studentName, courseName) {
  return `[${userId}] ${studentName} - ${courseName}`;
}

async function handle_modify_course_task(slots, userId, event) {
  try {
    // 1) 目標課程定位（優先上下文，fallback DB）
    const conversationManager = getConversationManager();
    const ctx = await conversationManager.getContext(userId).catch(() => null);
    let course = null;

    if (ctx && ctx.state && (ctx.state.lastActions || ctx.state.pendingData)) {
      // 從最近 add_course 操作取目標
      const last = ctx.state.lastActions && Object.values(ctx.state.lastActions).sort((a, b) => b.timestamp - a.timestamp)[0];
      const op = last || (ctx.state.pendingData && ctx.state.pendingData.lastOperation) || null;
      if (op && op.intent === 'add_course' && op.slots) {
        const s = op.slots;
        course = await firebaseService.findCourse(userId, s.studentName, s.courseName, s.courseDate);
      }
    }

    if (!course && slots && slots.studentName && slots.courseName) {
      // timeReference → YYYY-MM-DD（若必要）
      const courseDate = slots.courseDate || toYmdFromReference(slots.timeReference);
      course = await firebaseService.findCourse(userId, slots.studentName, slots.courseName, courseDate);
    }

    if (!course) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: '❓ 請提供學生、課程與日期，以便定位要修改的課程',
      };
    }

    // 2) 驗證非重複課
    if (course.isRecurring) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: '🔄 重複課程請使用「取消 → 重新新增」進行修改',
      };
    }

    // 3) 自癒 calendarId / 存取
    const student = await ensureStudentCalendarSafe(userId, course.studentName);

    // 4) 準備新值與合法性檢查
    const newCourseDate = slots.courseDateNew || course.courseDate;
    const newScheduleTime = slots.scheduleTimeNew || course.scheduleTime;

    // 只有實際修改時間/日期時才檢查過去時間
    const timeOrDateChanged = 
      (slots.courseDateNew && slots.courseDateNew !== course.courseDate) ||
      (slots.scheduleTimeNew && slots.scheduleTimeNew !== course.scheduleTime);
    if (timeOrDateChanged && isPastTime(newCourseDate, newScheduleTime)) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: '❌ 新時間早於現在，請提供未來時間',
      };
    }

    // 5) 衝突檢查（只在時間/日期實際變更時執行）
    if (timeOrDateChanged) {
      const conflict = await googleCalendarService.checkConflict(student.calendarId, newCourseDate, newScheduleTime);
      if (conflict && conflict.hasConflict) {
        const list = (conflict.conflicts || []).map((c) => `• ${c.summary} (${fmtHm(c.start)})`).join('\n');
        return {
          success: false,
          code: 'CONFLICT_ERROR',
          message: `⚠️ 時間衝突\n\n${newCourseDate} ${newScheduleTime} 已有：\n${list}\n\n請換一個時間再試。`,
        };
      }
    }

    // 6) 更新 Google Calendar（先 GCal, 後 Firebase）
    const start = googleCalendarService.buildDateTime(newCourseDate, newScheduleTime);
    const end = googleCalendarService.addHours(start, 1);
    const summary = buildEventSummary(userId, course.studentName, slots.courseNameNew || course.courseName);

    try {
      await googleCalendarService.updateEvent(
        course.calendarId || student.calendarId,
        course.calendarEventId,
        {
          start: { dateTime: start, timeZone: 'Asia/Taipei' },
          end: { dateTime: end, timeZone: 'Asia/Taipei' },
          summary,
        },
      );
    } catch (e) {
      return {
        success: false,
        code: 'SYSTEM_ERROR',
        message: '❌ 日曆更新失敗，請稍後再試',
      };
    }

    // 7) 更新 Firebase（與 GCal 對齊）
    const updateData = {
      courseDate: newCourseDate,
      scheduleTime: newScheduleTime,
    };
    if (slots.courseNameNew) updateData.courseName = slots.courseNameNew;

    await firebaseService.updateDocument('courses', course.courseId, updateData);

    // 8) 成功訊息（沿用新增課格式的中文時間）
    const timeDisplay = toZhTime(newScheduleTime);
    const msgLines = [
      '✅ 課程已更新！',
      `👦 學生：${course.studentName}`,
      `📚 課程：${updateData.courseName || course.courseName}`,
      `📅 日期：${newCourseDate}`,
      `🕐 時間：${timeDisplay}`,
    ];

    return { success: true, message: msgLines.join('\n') };
  } catch (error) {
    console.error('❌ 修改課程失敗:', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '❌ 修改課程時發生錯誤，請稍後再試',
    };
  }
}

module.exports = handle_modify_course_task;
