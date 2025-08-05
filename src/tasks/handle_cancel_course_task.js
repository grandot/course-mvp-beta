/**
 * 取消課程任務處理器
 * 處理「取消小明明天的數學課」「刪掉Lumi的鋼琴課」等語句
 */

const { firebaseService } = require('../services');
const { googleCalendarService } = require('../services');

/**
 * 根據時間參考計算具體日期
 * @param {string} timeReference - 時間參考 (today/tomorrow/yesterday等)
 * @returns {string|null} 日期字串 (YYYY-MM-DD)
 */
function calculateDateFromReference(timeReference) {
  if (!timeReference) return null;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  let targetDate;

  switch (timeReference) {
    case 'today':
      targetDate = new Date(year, month, day);
      break;
    case 'tomorrow':
      targetDate = new Date(year, month, day + 1);
      break;
    case 'yesterday':
      targetDate = new Date(year, month, day - 1);
      break;
    default:
      return null;
  }

  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const targetDay = String(targetDate.getDate()).padStart(2, '0');

  return `${targetYear}-${targetMonth}-${targetDay}`;
}

/**
 * 查找要取消的課程
 * @param {string} userId - 用戶ID
 * @param {string} studentName - 學生姓名
 * @param {string} courseName - 課程名稱
 * @param {string} specificDate - 特定日期
 * @param {string} timeReference - 時間參考
 * @param {string} scope - 取消範圍 (single/recurring/all)
 * @returns {Array} 符合條件的課程陣列
 */
async function findCoursesToCancel(userId, studentName, courseName, specificDate, timeReference, scope) {
  try {
    let courseDate = specificDate;

    // 如果沒有指定具體日期，根據時間參考計算
    if (!courseDate && timeReference) {
      courseDate = calculateDateFromReference(timeReference);
    }

    if (scope === 'single' && courseDate) {
      // 取消單次課程
      const course = await firebaseService.findCourse(userId, studentName, courseName, courseDate);
      return course ? [course] : [];
    } if (scope === 'recurring' || scope === 'all') {
      // 取消重複課程或所有課程
      const courses = await firebaseService.getCoursesByStudent(userId, studentName);
      return courses.filter((course) => course.courseName === courseName && !course.cancelled);
    }
    // 預設情況：查找最近的課程
    const course = await firebaseService.findCourse(userId, studentName, courseName, courseDate);
    return course ? [course] : [];
  } catch (error) {
    console.error('❌ 查找課程失敗:', error);
    throw error;
  }
}

/**
 * 從 Google Calendar 刪除事件
 * @param {Object} course - 課程資料
 * @returns {boolean} 是否成功刪除
 */
async function deleteFromGoogleCalendar(course) {
  try {
    if (!course.calendarEventId) {
      console.log('⚠️ 課程沒有 Google Calendar 事件ID，跳過刪除');
      return true;
    }

    // 查找學生的 calendarId
    const student = await firebaseService.getStudent(course.userId, course.studentName);
    if (!student || !student.calendarId) {
      console.log('⚠️ 找不到學生的 calendarId，跳過 Google Calendar 刪除');
      return true;
    }

    // 從 Google Calendar 刪除事件
    const deleteResult = await googleCalendarService.deleteEvent(student.calendarId, course.calendarEventId);

    if (deleteResult.success) {
      console.log('✅ Google Calendar 事件已刪除:', course.calendarEventId);
      return true;
    }
    console.error('❌ Google Calendar 刪除失敗:', deleteResult.message);
    return false;
  } catch (error) {
    console.error('❌ Google Calendar 刪除異常:', error);
    return false;
  }
}

/**
 * 取消課程任務處理器
 * @param {Object} slots - 提取的槽位資料
 * @param {string} userId - LINE 用戶ID
 * @returns {Object} 處理結果 { success: boolean, message: string }
 */
async function handle_cancel_course_task(slots, userId) {
  try {
    console.log('🗑️ 開始處理取消課程任務:', slots);

    // 1. 驗證必要參數
    if (!slots.studentName) {
      return {
        success: false,
        message: '❌ 請提供學生姓名，例如：「取消小明的數學課」',
      };
    }

    if (!slots.courseName) {
      return {
        success: false,
        message: '❌ 請提供課程名稱，例如：「取消小明的數學課」',
      };
    }

    // 2. 查找要取消的課程
    const coursesToCancel = await findCoursesToCancel(
      userId,
      slots.studentName,
      slots.courseName,
      slots.specificDate,
      slots.timeReference,
      slots.scope || 'single',
    );

    if (!coursesToCancel || coursesToCancel.length === 0) {
      return {
        success: false,
        message: `❌ 找不到 ${slots.studentName} 的 ${slots.courseName}，請確認課程是否存在`,
      };
    }

    // 3. 執行取消操作
    const cancelResults = [];
    let successCount = 0;
    let failCount = 0;

    for (const course of coursesToCancel) {
      try {
        // 3.1 從 Google Calendar 刪除（如果有事件ID）
        const gcalDeleted = await deleteFromGoogleCalendar(course);

        // 3.2 在 Firebase 中標記為已取消
        const firebaseDeleted = await firebaseService.deleteCourse(course.id || course.courseId);

        if (firebaseDeleted) {
          successCount++;
          cancelResults.push({
            course,
            success: true,
            gcalDeleted,
          });
          console.log(`✅ 課程取消成功: ${course.studentName} 的 ${course.courseName} (${course.courseDate})`);
        } else {
          failCount++;
          cancelResults.push({
            course,
            success: false,
            error: 'Firebase 更新失敗',
          });
        }
      } catch (error) {
        failCount++;
        cancelResults.push({
          course,
          success: false,
          error: error.message,
        });
        console.error(`❌ 取消課程失敗: ${course.studentName} 的 ${course.courseName}`, error);
      }
    }

    // 4. 生成回應訊息
    let message = '';

    if (successCount > 0) {
      if (successCount === 1) {
        const successCourse = cancelResults.find((r) => r.success).course;
        const dateStr = successCourse.courseDate;
        const timeStr = successCourse.scheduleTime;
        message += `✅ 已取消 ${slots.studentName} 的 ${slots.courseName}\n`;
        message += `📅 原定時間：${dateStr} ${timeStr}`;
      } else {
        message += `✅ 已取消 ${successCount} 堂 ${slots.studentName} 的 ${slots.courseName}`;
      }
    }

    if (failCount > 0) {
      if (message) message += '\n\n';
      message += `⚠️ 有 ${failCount} 堂課程取消失敗，請稍後再試`;
    }

    // 5. 如果有成功取消的課程，提供相關提示
    if (successCount > 0) {
      message += '\n\n💡 提示：已取消的課程仍保留在記錄中，可隨時查看歷史資料';
    }

    console.log(`📊 取消結果統計: 成功=${successCount}, 失敗=${failCount}`);

    return {
      success: successCount > 0,
      message,
    };
  } catch (error) {
    console.error('❌ 取消課程失敗:', error);
    return {
      success: false,
      message: '❌ 取消課程失敗，請稍後再試',
    };
  }
}

module.exports = handle_cancel_course_task;
