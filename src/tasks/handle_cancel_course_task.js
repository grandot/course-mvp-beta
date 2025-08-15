/**
 * 取消課程任務處理器
 * 處理「取消小明明天的數學課」「刪掉Lumi的鋼琴課」等語句
 */

const { firebaseService } = require('../services');
const { googleCalendarService } = require('../services');
const { getConversationManager } = require('../conversation/ConversationManager');

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

function getAlternateStudentNames(name) {
  const names = new Set();
  if (!name) return [];
  names.add(name);
  if (name.startsWith('測試')) {
    names.add(name.replace(/^測試/, ''));
  } else {
    names.add(`測試${name}`);
  }
  return Array.from(names);
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
    } if (scope === 'future') {
      // 取消明天起所有課程
      const courses = await firebaseService.getCoursesByStudent(userId, studentName, { startDate: calculateDateFromReference('tomorrow') });
      return courses.filter((course) => {
        const dbName = String(course.courseName || '').replace(/課$/, '');
        const queryName = String(courseName || '').replace(/課$/, '');
        return dbName === queryName && !course.cancelled;
      });
    } if (scope === 'recurring' || scope === 'all') {
      // 取消重複課程或所有課程 - 查找所有相關課程讓 Google Calendar 處理重複邏輯
      const courses = await firebaseService.getCoursesByStudent(userId, studentName);
      return courses.filter((course) => {
        const dbName = String(course.courseName || '').replace(/課$/, '');
        const queryName = String(courseName || '').replace(/課$/, '');
        return dbName === queryName && !course.cancelled;
      });
    }
    // 預設情況：查找最近的課程（使用模糊匹配邏輯）
    const allCourses = await firebaseService.getCoursesByStudent(userId, studentName);
    const filtered = allCourses.filter((course) => {
      const dbName = String(course.courseName || '').replace(/課$/, '');
      const queryName = String(courseName || '').replace(/課$/, '');
      return dbName === queryName && !course.cancelled;
    });
    return filtered.length > 0 ? [filtered[0]] : [];
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

    // 使用已設置的 calendarId 或查找學生的 calendarId
    let calendarId = course.calendarId;
    if (!calendarId) {
      const student = await firebaseService.getStudent(course.userId, course.studentName);
      if (!student || !student.calendarId) {
        console.log('⚠️ 找不到學生的 calendarId，跳過 Google Calendar 刪除');
        return true;
      }
      calendarId = student.calendarId;
    }

    // 根據刪除範圍決定處理方式
    if (course.scope === 'all' || course.scope === 'recurring') {
      // 刪除整個重複事件系列 - 使用 Google Calendar 的重複事件刪除
      const deleted = await googleCalendarService.deleteRecurringEvent(calendarId, course.calendarEventId);
      if (deleted) {
        console.log('✅ Google Calendar 重複事件系列已刪除:', course.calendarEventId);
        return true;
      }
    } else {
      // 根據產品規則：主動取消不物理刪除 GCal 事件，僅做標記
      const result = await googleCalendarService.markEventCancelled(calendarId, course.calendarEventId);
      if (result.success) {
        console.log('✅ Google Calendar 事件已標記為取消:', course.calendarEventId);
        return true;
      }
    }
    console.error('❌ Google Calendar 操作失敗');
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
      // 先進入期待輸入，保留已知的課名等欄位
      try {
        const conversationManager = getConversationManager();
        await conversationManager.setExpectedInput(
          userId,
          'cancel_course_flow',
          ['student_name_input'],
          {
            intent: 'cancel_course',
            existingSlots: slots,
          },
        );
      } catch (_) {}

      // 嘗試從用戶的學生列表提供 Quick Reply 選項
      try {
        const students = await firebaseService.getStudentsByUser(userId);
        if (students && students.length > 0) {
          const quickReply = students.slice(0, 4).map((student) => ({
            label: student.studentName,
            text: `取消${student.studentName}的課程`,
          }));

          return {
            success: false,
            code: 'MISSING_STUDENT',
            message: '❌ 請提供學生姓名，例如：「取消小明的數學課」',
            showQuickReply: true,
            quickReply,
          };
        }
      } catch (error) {
        console.error('❌ 獲取學生列表失敗:', error);
      }

      return {
        success: false,
        code: 'MISSING_STUDENT',
        message: '❌ 請提供學生姓名，例如：「取消小明的數學課」',
      };
    }

    if (!slots.courseName) {
      // 先進入期待輸入，保留已知的學生等欄位
      try {
        const conversationManager = getConversationManager();
        await conversationManager.setExpectedInput(
          userId,
          'cancel_course_flow',
          ['course_name_input'],
          {
            intent: 'cancel_course',
            existingSlots: slots,
          },
        );
      } catch (_) {}

      return {
        success: false,
        code: 'MISSING_COURSE',
        message: '❌ 請提供課程名稱，例如：「取消小明的數學課」',
      };
    }

    // 2. 若未指定範圍且疑似重複課，先提示選擇範圍
    if (!slots.scope) {
      // 嘗試以多個候選學生名稱查詢，避免『測試』前綴不一致
      const candidates = getAlternateStudentNames(slots.studentName);
      let hasRecurring = false;
      for (const candidate of candidates) {
        const courses = await firebaseService.getCoursesByStudent(userId, candidate);
        if (courses.some((c) => {
          const dbName = String(c.courseName || '').replace(/課$/, '');
          const queryName = String(slots.courseName || '').replace(/課$/, '');
          return dbName === queryName && c.isRecurring;
        })) {
          hasRecurring = true; break;
        }
      }
      if (hasRecurring) {
        // 保存當前 slots 到對話狀態，供 QuickReply 使用
        try {
          const conversationManager = getConversationManager();
          await conversationManager.setExpectedInput(
            userId,
            'cancel_course_flow',
            ['scope_input'],
            {
              intent: 'cancel_course',
              existingSlots: slots,
            },
          );
        } catch (_) {}

        return {
          success: false,
          showQuickReply: true,
          code: 'RECURRING_CANCEL_OPTIONS',
          message: '請問是要取消哪個範圍？\n\n🔘 只取消今天\n🔘 取消明天起所有課程\n🔘 刪除整個重複課程',
          quickReply: [
            { label: '只取消今天', text: '只取消今天' },
            { label: '取消之後全部', text: '取消之後全部' },
            { label: '刪除整個重複', text: '刪除整個重複' },
          ],
        };
      }
    }

    // 3. 查找要取消的課程
    let coursesToCancel = await findCoursesToCancel(
      userId,
      slots.studentName,
      slots.courseName,
      slots.specificDate,
      slots.timeReference,
      slots.scope || 'single',
    );
    if ((!coursesToCancel || coursesToCancel.length === 0) && slots.studentName) {
      // 使用候選名稱再嘗試一次
      const altNames = getAlternateStudentNames(slots.studentName).filter((n) => n !== slots.studentName);
      for (const alt of altNames) {
        coursesToCancel = await findCoursesToCancel(
          userId,
          alt,
          slots.courseName,
          slots.specificDate,
          slots.timeReference,
          slots.scope || 'single',
        );
        if (coursesToCancel && coursesToCancel.length > 0) break;
      }
    }

    if (!coursesToCancel || coursesToCancel.length === 0) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: `❌ 找不到 ${slots.studentName} 的 ${slots.courseName}，請確認課程是否存在`,
      };
    }

    // 4. 執行取消操作
    const cancelResults = [];
    let successCount = 0;
    let failCount = 0;

    for (const course of coursesToCancel) {
      try {
        // 設置取消範圍到課程物件
        course.scope = slots.scope || 'single';
        
        // 確保有 calendarId（避免二次查詢）
        if (!course.calendarId && course.studentName) {
          const student = await firebaseService.getStudent(course.userId, course.studentName);
          if (student && student.calendarId) {
            course.calendarId = student.calendarId;
          }
        }
        
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

    // 5. 生成回應訊息
    let message = '';

    if (successCount > 0) {
      const scope = slots.scope || 'single';
      
      if (scope === 'all' || scope === 'recurring') {
        // 刪除整個重複課程系列
        message += `✅ 已刪除整個重複課程\n`;
        message += `📚 課程：${slots.studentName} 的 ${slots.courseName}`;
        if (successCount > 1) {
          message += `\n📊 共影響 ${successCount} 堂課`;
        }
      } else if (scope === 'future') {
        // 取消明天起所有課程
        message += `✅ 已取消明天起所有課程\n`;
        message += `📚 課程：${slots.studentName} 的 ${slots.courseName}`;
        message += `\n📊 共取消 ${successCount} 堂課`;
      } else if (successCount === 1) {
        // 單次課程取消
        const successCourse = cancelResults.find((r) => r.success).course;
        const dateStr = successCourse.courseDate;
        const timeStr = successCourse.scheduleTime;
        message += `✅ 已取消 ${slots.studentName} 的 ${slots.courseName}\n`;
        message += `📅 原定時間：${dateStr} ${timeStr}`;
      } else {
        // 多堂單次課程
        message += `✅ 已取消 ${successCount} 堂 ${slots.studentName} 的 ${slots.courseName}`;
      }
    }

    if (failCount > 0) {
      if (message) message += '\n\n';
      message += `⚠️ 有 ${failCount} 堂課程取消失敗，請稍後再試`;
    }

    // 6. 如果有成功取消的課程，提供相關提示
    if (successCount > 0) {
      message += '\n\n💡 提示：已取消的課程仍保留在記錄中，可隨時查看歷史資料';
    }

    console.log(`📊 取消結果統計: scope=${slots.scope || 'single'}, 成功=${successCount}, 失敗=${failCount}, deleteRecurringEvent=${(slots.scope === 'all' || slots.scope === 'recurring') ? 'true' : 'false'}`);

    return {
      success: successCount > 0,
      code: successCount > 0 ? 'COURSE_CANCEL_OK' : 'COURSE_CANCEL_FAILED_PARTIAL',
      message,
    };
  } catch (error) {
    console.error('❌ 取消課程失敗:', error);
    return {
      success: false,
      code: 'COURSE_CANCEL_FAILED',
      message: '❌ 取消課程失敗，請稍後再試',
    };
  }
}

module.exports = handle_cancel_course_task;
