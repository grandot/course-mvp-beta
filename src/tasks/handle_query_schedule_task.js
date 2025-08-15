/**
 * 處理查詢課程表任務
 * 支持多種時間範圍的課程查詢
 */

const firebaseService = require('../services/firebaseService');

/**
 * 計算時間範圍
 */
function calculateDateRange(timeReference, specificDate = null) {
  const TZ = 'Asia/Taipei';

  // 以台北時區格式化 YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const today = new Date();
  // 診斷：系統 vs 台北時間
  try {
    if (process.env.ENABLE_DIAGNOSTICS === 'true') {
      const now = new Date();
      const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      console.log('🕐 時間計算診斷:', {
        systemTime: now.toISOString(),
        taiwanTime: taiwanTime.toISOString(),
        timeReference,
      });
    }
  } catch (_) {}
  const todayStr = fmt.format(today); // 本地（台北）今日字串

  // 將 YYYY-MM-DD 當作 UTC 零點，便於做加減天數，再輸出 YYYY-MM-DD
  const toUtcDate = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00Z`);
  const addDaysStr = (yyyyMmDd, n) => {
    const d = toUtcDate(yyyyMmDd);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  if (specificDate) {
    return { startDate: specificDate, endDate: specificDate, description: specificDate };
  }

  switch (timeReference) {
    case 'today': {
      return { startDate: todayStr, endDate: todayStr, description: '今天' };
    }
    case 'tomorrow': {
      const s = addDaysStr(todayStr, 1);
      return { startDate: s, endDate: s, description: '明天' };
    }
    case 'yesterday': {
      const s = addDaysStr(todayStr, -1);
      return { startDate: s, endDate: s, description: '昨天' };
    }
    case 'this_week': {
      const base = toUtcDate(todayStr);
      const dow = base.getUTCDay(); // 0(日)-6(六)
      const start = new Date(base);
      start.setUTCDate(base.getUTCDate() - dow);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        description: '本週',
      };
    }
    case 'next_week': {
      const base = toUtcDate(todayStr);
      const dow = base.getUTCDay();
      const start = new Date(base);
      start.setUTCDate(base.getUTCDate() - dow + 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        description: '下週',
      };
    }
    case 'last_week': {
      const base = toUtcDate(todayStr);
      const dow = base.getUTCDay();
      const start = new Date(base);
      start.setUTCDate(base.getUTCDate() - dow - 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        description: '上週',
      };
    }
    default: {
      // 預設未來7天（含今日）
      const end = addDaysStr(todayStr, 7);
      return {
        startDate: todayStr,
        endDate: end,
        description: '未來7天',
      };
    }
  }
}

/**
 * 格式化時間顯示
 */
function formatTime(timeString) {
  if (!timeString) return '時間未定';

  const [hour, minute] = timeString.split(':');
  const h = parseInt(hour);
  const m = `:${minute}`;

  if (h === 0) return `午夜12${m}`;
  if (h < 12) return `上午${h}${m}`;
  if (h === 12) return `中午12${m}`;
  return `下午${h - 12}${m}`;
}

/**
 * 格式化日期顯示
 */
function formatDate(dateString) {
  if (!dateString) return '日期未定';

  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const weekday = weekdays[date.getDay()];

  return `${month}/${day} (${weekday})`;
}

/**
 * 格式化課程列表
 */
function formatCourseList(courses, description) {
  if (!courses || courses.length === 0) {
    return `📅 ${description}沒有安排課程`;
  }

  let message = `📅 ${description}的課表\n\n`;

  // 按日期和時間排序
  courses.sort((a, b) => {
    const dateCompare = a.courseDate.localeCompare(b.courseDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.scheduleTime || '').localeCompare(b.scheduleTime || '');
  });

  let currentDate = '';

  courses.forEach((course, index) => {
    const courseDate = formatDate(course.courseDate);
    const courseTime = formatTime(course.scheduleTime);

    // 如果是新的日期，顯示日期標題
    if (courseDate !== currentDate) {
      if (currentDate !== '') message += '\n';
      message += `📆 ${courseDate}\n`;
      currentDate = courseDate;
    }

    message += `  ${courseTime} - ${course.courseName}`;

    if (course.isRecurring) {
      message += ' 🔄';
    }

    // 如果有課程記錄，顯示摘要
    if (course.courseRecord?.notes) {
      const summary = course.courseRecord.notes.length > 20
        ? `${course.courseRecord.notes.substring(0, 20)}...`
        : course.courseRecord.notes;
      message += `\n    📝 ${summary}`;
    }

    // 如果有照片，顯示數量
    if (course.courseRecord?.photos && course.courseRecord.photos.length > 0) {
      message += ` 📸 ${course.courseRecord.photos.length}張照片`;
    }

    message += '\n';
  });

  return message.trim();
}

/**
 * 將重複課程在給定日期範圍內展開為單日實例
 * 規則：
 * - weekly: 依據 dayOfWeek 與 scheduleTime，每週生成一次
 * - daily: 每天生成一次
 * - monthly: 先簡化為每月同日，若跨區間則不展開（本案主要處理 weekly/daily）
 */
function expandRecurringCourses(recurringCourses, dateRange) {
  if (!recurringCourses || recurringCourses.length === 0) return [];

  const start = new Date(`${dateRange.startDate}T00:00:00+08:00`);
  const end = new Date(`${dateRange.endDate}T23:59:59+08:00`);

  const results = [];
  for (const c of recurringCourses) {
    const recurrenceType = c.recurrenceType || 'weekly';
    if (recurrenceType === 'daily') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        results.push({
          ...c,
          courseDate: dateStr,
          isRecurring: true,
          source: 'recurrence',
        });
      }
    } else if (recurrenceType === 'weekly') {
      // 支援數字或陣列格式的 dayOfWeek
      let daysSet;
      if (typeof c.dayOfWeek === 'number') {
        daysSet = new Set([c.dayOfWeek]);
      } else if (Array.isArray(c.dayOfWeek)) {
        // 過濾有效的週幾值（0-6）
        daysSet = new Set(c.dayOfWeek.filter((d) => typeof d === 'number' && d >= 0 && d <= 6));
      } else {
        continue; // 無效格式，跳過
      }

      if (daysSet.size === 0) continue; // 沒有有效的週幾值

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (daysSet.has(d.getDay())) {
          const dateStr = d.toISOString().split('T')[0];
          results.push({
            ...c,
            courseDate: dateStr,
            isRecurring: true,
            source: 'recurrence',
          });
        }
      }
    } else if (recurrenceType === 'monthly') {
      // 簡化處理：若基準日存在且在區間內，才加入一次
      const base = c.courseDate ? new Date(`${c.courseDate}T00:00:00+08:00`) : null;
      if (base && base >= start && base <= end) {
        results.push({
          ...c, courseDate: c.courseDate, isRecurring: true, source: 'recurrence',
        });
      }
    }
  }
  return results;
}

function dedupeCourses(list) {
  if (!list || list.length === 0) return [];
  const map = new Map();
  for (const c of list) {
    const k = `${c.studentName}|${c.courseDate}|${c.scheduleTime || '00:00'}|${c.courseName}`;
    if (!map.has(k)) map.set(k, c);
  }
  return Array.from(map.values());
}

/**
 * 查詢所有學生（如果沒有指定學生名稱）
 */
async function getAllStudentCourses(userId, dateRange) {
  try {
    // 先取得所有學生
    const parent = await firebaseService.getOrCreateParent(userId);

    if (!parent.students || parent.students.length === 0) {
      return [];
    }

    const allCourses = [];

    // 查詢每個學生的課程
    for (const student of parent.students) {
      const courses = await firebaseService.getCoursesByStudent(
        userId,
        student.studentName,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      );

      // 過濾掉已取消的課程
      const activeCourses = courses.filter((course) => !course.cancelled);
      allCourses.push(...activeCourses);
    }

    return allCourses;
  } catch (error) {
    console.error('❌ 查詢所有學生課程失敗:', error);
    return [];
  }
}

/**
 * 主要處理函式
 */
async function handle_query_schedule_task(slots, userId, messageEvent = null) {
  try {
    console.log('🎯 開始處理查詢課表任務');
    console.log('📋 接收參數:', slots);

    // 1. 確定查詢的時間範圍
    const dateRange = calculateDateRange(
      slots.timeReference || 'this_week', // 改這一個字就夠了
      slots.specificDate,
    );

    console.log('📅 查詢時間範圍:', dateRange);

    // 2. 查詢課程
    let courses = [];

    if (slots.studentName) {
      // 單一學生：單次課程 + 重複課展開
      const singleAll = await firebaseService.getCoursesByStudent(
        userId,
        slots.studentName,
        { startDate: dateRange.startDate, endDate: dateRange.endDate },
      );
      const single = singleAll.filter((course) => !course.cancelled);
      let expanded = [];
      try {
        // 從所有課程中篩選重複課程並展開
        const allCoursesRaw = await firebaseService.getCoursesByStudent(userId, slots.studentName);
        const allCourses = allCoursesRaw.filter((course) => !course.cancelled);
        const recurring = allCourses.filter((course) => course.isRecurring);
        expanded = expandRecurringCourses(recurring, dateRange);
      } catch (e) {
        console.warn('⚠️ 重複課查詢或展開失敗，採用單次課程降級:', e?.message || e);
      }
      courses = dedupeCourses([...single, ...expanded]);

      if (slots.courseName) {
        // 課名正規化（移除尾字「課」），雙向包含以提高容錯
        const normalize = (s) => String(s || '').replace(/課$/, '');
        const q = normalize(slots.courseName);
        courses = courses.filter((course) => {
          const name = normalize(course.courseName);
          return name.includes(q) || q.includes(name);
        });
      }
    } else {
      // 多學生：每位學生單次 + 重複展開彙總
      const parent = await firebaseService.getOrCreateParent(userId);
      const all = [];
      if (parent.students && parent.students.length > 0) {
        for (const s of parent.students) {
          const singleAll = await firebaseService.getCoursesByStudent(
            userId,
            s.studentName,
            { startDate: dateRange.startDate, endDate: dateRange.endDate },
          );
          const single = singleAll.filter((course) => !course.cancelled);
          let expanded = [];
          try {
            // 從所有課程中篩選重複課程並展開
            const allCoursesRaw = await firebaseService.getCoursesByStudent(userId, s.studentName);
            const allCourses = allCoursesRaw.filter((course) => !course.cancelled);
            const recurring = allCourses.filter((course) => course.isRecurring);
            expanded = expandRecurringCourses(recurring, dateRange);
          } catch (e) {
            console.warn('⚠️ 重複課查詢或展開失敗（多學生），採用單次課程降級:', e?.message || e);
          }
          all.push(...single, ...expanded);
        }
      }
      courses = dedupeCourses(all);
    }

    console.log(`📚 查詢到 ${courses.length} 筆課程`);

    // 3. 格式化結果
    const studentInfo = slots.studentName ? slots.studentName : '所有學生';
    const description = `${studentInfo}${dateRange.description}`;
    const message = formatCourseList(courses, description);

    // 4. 如果沒有課程，提供建議
    if (courses.length === 0) {
      const suggestionMessage = `${message}\n\n🔎 指引：\n• 查詢：「小明下週的課表」\n• 新增：「小明明天上午10點英文課」\n• 記錄：「記錄昨天數學課的內容」`;

      return {
        success: true,
        code: 'QUERY_OK_EMPTY',
        message: suggestionMessage,
        data: {
          courseCount: 0,
          dateRange,
        },
      };
    }

    return {
      success: true,
      code: 'QUERY_OK',
      message,
      data: {
        courses,
        courseCount: courses.length,
        dateRange,
      },
      // 不再提供查詢結果 Quick Reply（依 PM 新規則）
    };
  } catch (error) {
    console.error('❌ 查詢課表任務失敗:', error);

    // 根據錯誤類型提供不同的回應
    if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
      return {
        success: false,
        code: 'FIREBASE_ERROR',
        message: '❌ 資料查詢失敗，請稍後再試。',
      };
    }
    return {
      success: false,
      code: 'QUERY_FAILED',
      message: '❌ 查詢課表失敗，請檢查學生姓名並稍後再試。',
    };
  }
}

module.exports = handle_query_schedule_task;
