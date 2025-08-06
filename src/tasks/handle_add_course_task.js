/**
 * 處理新增課程任務
 * 支持單次課程和重複課程的建立
 */

const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');

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

  // 對於重複課程，需要星期幾
  if (slots.recurring && slots.dayOfWeek === null && slots.dayOfWeek === undefined) {
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
 * 處理重複課程的日期計算
 */
function calculateNextCourseDate(dayOfWeek) {
  const today = new Date();
  const currentDay = today.getDay();

  let daysUntilNext = dayOfWeek - currentDay;
  if (daysUntilNext <= 0) {
    daysUntilNext += 7; // 下週同一天
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);

  return nextDate.toISOString().split('T')[0];
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

    // 1. 驗證必要參數
    const missingFields = validateSlots(slots);
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `❓ 請提供以下資訊：${missingFields.join('、')}\n\n範例：「小明每週三下午3點數學課」`,
      };
    }

    // 2. 處理時間和日期
    let { courseDate } = slots;

    if (!courseDate && slots.timeReference) {
      courseDate = resolveTimeReference(slots.timeReference);
    }

    if (!courseDate && slots.recurring && slots.dayOfWeek !== null) {
      courseDate = calculateNextCourseDate(slots.dayOfWeek);
    }

    if (!courseDate) {
      return {
        success: false,
        message: '❓ 請指定課程的具體日期或時間（如：明天、週三等）',
      };
    }

    // 3. 確保學生有對應的日曆
    const student = await ensureStudentCalendar(userId, slots.studentName);
    console.log('👤 學生日曆:', student.calendarId);

    // 4. 檢查時間衝突
    const conflictCheck = await googleCalendarService.checkConflict(
      student.calendarId,
      courseDate,
      slots.scheduleTime,
    );

    if (conflictCheck.hasConflict) {
      const conflictInfo = conflictCheck.conflicts
        .map((c) => `• ${c.summary} (${c.start.split('T')[1].substring(0, 5)})`)
        .join('\n');

      return {
        success: false,
        message: `⚠️ 時間衝突\n\n${courseDate} ${slots.scheduleTime} 已有以下課程：\n${conflictInfo}\n\n請選擇其他時間或確認是否要覆蓋。`,
      };
    }

    // 5. 建立 Google Calendar 事件
    const eventData = {
      courseName: slots.courseName,
      courseDate,
      scheduleTime: slots.scheduleTime,
      recurring: slots.recurring || false,
      dayOfWeek: slots.dayOfWeek,
      studentName: slots.studentName,
    };

    const calendarEvent = await googleCalendarService.createEvent(
      student.calendarId,
      eventData,
    );

    console.log('📅 Google Calendar 事件已創建:', calendarEvent.eventId);

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
      duration: 60, // 預設1小時
      createdFrom: 'line_bot',
    };

    // 只有當 dayOfWeek 不是 undefined 或 null 時才加入
    if (slots.dayOfWeek !== undefined && slots.dayOfWeek !== null) {
      courseData.dayOfWeek = slots.dayOfWeek;
    }

    const savedCourse = await firebaseService.saveCourse(courseData);
    console.log('💾 Firebase 課程資料已儲存:', savedCourse.courseId);

    // 7. 格式化成功訊息
    const timeDisplay = slots.scheduleTime.replace(/(\d{2}):(\d{2})/, (match, hour, minute) => {
      const h = parseInt(hour);
      const m = minute === '00' ? '' : `:${minute}`;
      if (h === 0) return `午夜12${m}`;
      if (h < 12) return `上午${h}${m}:00`;
      if (h === 12) return `中午12${m}:00`;
      return `下午${h - 12}${m}:00`;
    });

    let message = '✅ 課程已安排成功！\n\n';
    message += `👦 學生：${slots.studentName}\n`;
    message += `📚 課程：${slots.courseName}\n`;

    if (slots.recurring) {
      const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      const dayName = days[slots.dayOfWeek];
      message += `🔄 重複：每${dayName} ${timeDisplay}\n`;
      message += `📅 下次上課：${courseDate}`;
    } else {
      message += `📅 日期：${courseDate}\n`;
      message += `🕐 時間：${timeDisplay}`;
    }

    return {
      success: true,
      message,
      data: {
        courseId: savedCourse.courseId,
        eventId: calendarEvent.eventId,
      },
      quickReply: [
        { label: '✅ 確認', text: '確認' },
        { label: '✏️ 修改', text: '修改' },
        { label: '❌ 取消操作', text: '取消操作' }
      ]
    };
  } catch (error) {
    console.error('❌ 新增課程任務失敗:', error);

    // 根據錯誤類型提供不同的回應
    if (error.message.includes('Calendar')) {
      return {
        success: false,
        message: '❌ 日曆服務暫時無法使用，請稍後再試。',
      };
    } if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
      return {
        success: false,
        message: '❌ 資料儲存失敗，請稍後再試。',
      };
    }
    return {
      success: false,
      message: '❌ 新增課程失敗，請檢查輸入資訊並稍後再試。',
    };
  }
}

module.exports = handle_add_course_task;
