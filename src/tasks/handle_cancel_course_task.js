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
 * 智能課程名稱匹配（支援模糊匹配和部分匹配）
 * @param {string} targetCourseName - 目標課程名稱
 * @param {Array} allCourses - 所有課程列表
 * @returns {Array} 匹配的課程
 */
function smartCourseNameMatch(targetCourseName, allCourses) {
  if (!targetCourseName || !allCourses || allCourses.length === 0) {
    return [];
  }

  // 處理特殊標記：通用課程指稱
  if (targetCourseName === '*FUZZY_MATCH*') {
    // 如果用戶說"取消Lumi的課程"但沒有指定具體課程名，返回所有課程供用戶選擇
    return allCourses.filter(course => !course.cancelled);
  }

  // 精確匹配
  let matches = allCourses.filter(course => 
    course.courseName === targetCourseName && !course.cancelled
  );
  
  if (matches.length > 0) {
    return matches;
  }

  // 模糊匹配1：目標課程名包含在實際課程名中
  // 例如："跆拳道" 匹配 "跆拳道課"
  matches = allCourses.filter(course => 
    course.courseName.includes(targetCourseName) && !course.cancelled
  );
  
  if (matches.length > 0) {
    console.log(`🔍 模糊匹配成功: "${targetCourseName}" → ${matches.map(c => c.courseName).join(', ')}`);
    return matches;
  }

  // 模糊匹配2：實際課程名包含在目標課程名中
  // 例如："跆拳道課程" 匹配 "跆拳道課"
  matches = allCourses.filter(course => 
    targetCourseName.includes(course.courseName.replace(/課$/, '')) && !course.cancelled
  );
  
  if (matches.length > 0) {
    console.log(`🔍 反向模糊匹配成功: "${targetCourseName}" → ${matches.map(c => c.courseName).join(', ')}`);
    return matches;
  }

  // 模糊匹配3：去除"課"字後的匹配
  // 例如："數學" 匹配 "數學課"
  const cleanTarget = targetCourseName.replace(/課$/, '');
  matches = allCourses.filter(course => {
    const cleanCourseName = course.courseName.replace(/課$/, '');
    return (cleanTarget === cleanCourseName || 
            cleanCourseName.includes(cleanTarget) || 
            cleanTarget.includes(cleanCourseName)) && !course.cancelled;
  });

  if (matches.length > 0) {
    console.log(`🔍 去課字匹配成功: "${targetCourseName}" → ${matches.map(c => c.courseName).join(', ')}`);
    return matches;
  }

  return [];
}

/**
 * 查找要取消的課程（增強版：支援智能匹配）
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

    // 先獲取該學生的所有課程，用於智能匹配
    const allStudentCourses = await firebaseService.getCoursesByStudent(userId, studentName);
    
    // 使用智能匹配找到目標課程
    const matchedCourses = smartCourseNameMatch(courseName, allStudentCourses);
    
    if (matchedCourses.length === 0) {
      return [];
    }

    // 如果智能匹配找到多個課程但沒有指定具體課程名，需要用戶澄清
    if (courseName === '*FUZZY_MATCH*' && matchedCourses.length > 1) {
      // 返回特殊格式，讓上層處理用戶選擇
      return { needClarification: true, courses: matchedCourses };
    }

    // 根據取消範圍過濾課程
    let targetCourses = matchedCourses;

    if (scope === 'single' && courseDate) {
      // 取消單次課程
      targetCourses = matchedCourses.filter(course => course.courseDate === courseDate);
    } else if (scope === 'future') {
      // 取消明天起所有課程
      const tomorrowDate = calculateDateFromReference('tomorrow');
      targetCourses = matchedCourses.filter(course => course.courseDate >= tomorrowDate);
    } else if (scope === 'recurring' || scope === 'all') {
      // 取消重複課程或所有課程
      targetCourses = matchedCourses;
    }

    return targetCourses.filter(course => !course.cancelled);
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

    // 根據刪除範圍決定處理方式
    if (course.scope === 'all' || course.scope === 'recurring') {
      // 刪除整個重複事件系列 - 使用 Google Calendar 的重複事件刪除
      const deleted = await googleCalendarService.deleteRecurringEvent(student.calendarId, course.calendarEventId);
      if (deleted) {
        console.log('✅ Google Calendar 重複事件系列已刪除:', course.calendarEventId);
        return true;
      }
    } else {
      // 根據產品規則：主動取消不物理刪除 GCal 事件，僅做標記
      const result = await googleCalendarService.markEventCancelled(student.calendarId, course.calendarEventId);
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
        if (courses.some((c) => c.courseName === slots.courseName && c.isRecurring)) {
          hasRecurring = true; break;
        }
      }
      if (hasRecurring) {
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

    // 3. 查找要取消的課程（支援智能匹配）
    let coursesToCancel = await findCoursesToCancel(
      userId,
      slots.studentName,
      slots.courseName,
      slots.specificDate,
      slots.timeReference,
      slots.scope || 'single',
    );

    // 處理需要澄清的情況（多個課程匹配）
    if (coursesToCancel && coursesToCancel.needClarification) {
      const courses = coursesToCancel.courses;
      const uniqueCourseNames = [...new Set(courses.map(c => c.courseName))];
      
      if (uniqueCourseNames.length > 1) {
        // 多種課程類型，讓用戶選擇
        const quickReply = uniqueCourseNames.slice(0, 4).map(courseName => ({
          label: courseName,
          text: `取消${slots.studentName}的${courseName}`,
        }));

        return {
          success: false,
          code: 'NEED_COURSE_CLARIFICATION',
          message: `請選擇要取消的課程：\n\n${uniqueCourseNames.map(name => `• ${name}`).join('\n')}`,
          showQuickReply: true,
          quickReply,
        };
      } else {
        // 同一種課程但多個時段，繼續處理
        coursesToCancel = courses;
      }
    }

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
        
        // 處理替代名稱的澄清情況
        if (coursesToCancel && coursesToCancel.needClarification) {
          coursesToCancel = coursesToCancel.courses;
        }
        
        if (coursesToCancel && coursesToCancel.length > 0) {
          // 更新找到的學生名稱
          slots.studentName = alt;
          break;
        }
      }
    }

    if (!coursesToCancel || coursesToCancel.length === 0) {
      // 提供更智能的錯誤訊息和建議
      let errorMessage = `❌ 找不到 ${slots.studentName} 的`;
      
      // 如果課程名稱不是通用指稱，提供具體課程名
      if (slots.courseName !== '*FUZZY_MATCH*') {
        errorMessage += `「${slots.courseName}」`;
      } else {
        errorMessage += '課程';
      }

      // 嘗試提供相似的課程建議
      try {
        const allStudentCourses = await firebaseService.getCoursesByStudent(userId, slots.studentName);
        const activeCourses = allStudentCourses.filter(course => !course.cancelled);
        
        if (activeCourses.length > 0) {
          const courseNames = [...new Set(activeCourses.map(c => c.courseName))];
          errorMessage += `\n\n📚 ${slots.studentName} 目前的課程：\n`;
          errorMessage += courseNames.map(name => `• ${name}`).join('\n');
          
          // 提供 Quick Reply 選項
          const quickReply = courseNames.slice(0, 4).map(courseName => ({
            label: courseName,
            text: `取消${slots.studentName}的${courseName}`,
          }));
          
          return {
            success: false,
            code: 'NOT_FOUND_WITH_SUGGESTIONS',
            message: errorMessage,
            showQuickReply: true,
            quickReply,
          };
        } else {
          errorMessage += `\n\n📝 ${slots.studentName} 目前沒有安排任何課程`;
        }
      } catch (error) {
        console.warn('⚠️ 無法獲取課程建議:', error.message);
        errorMessage += '\n\n💡 建議：\n';
        errorMessage += '• 檢查學生姓名拼寫\n';
        errorMessage += '• 確認課程是否已安排\n';
        errorMessage += '• 查看課表確認現有課程';
      }

      return {
        success: false,
        code: 'NOT_FOUND',
        message: errorMessage,
      };
    }

    // 4. 執行取消操作
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

    // 5. 生成回應訊息
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

    // 6. 如果有成功取消的課程，提供相關提示
    if (successCount > 0) {
      message += '\n\n💡 提示：已取消的課程仍保留在記錄中，可隨時查看歷史資料';
    }

    console.log(`📊 取消結果統計: 成功=${successCount}, 失敗=${failCount}`);

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
