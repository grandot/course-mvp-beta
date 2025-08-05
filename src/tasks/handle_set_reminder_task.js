/**
 * 設定提醒任務處理器
 * 處理「提醒我小明的數學課」「鋼琴課前30分鐘通知我」等語句
 */

const { firebaseService } = require('../services');
const { googleCalendarService } = require('../services');

/**
 * 計算提醒觸發時間
 * @param {string} courseDate - 課程日期 (YYYY-MM-DD)
 * @param {string} scheduleTime - 課程時間 (HH:mm)
 * @param {number} reminderTime - 提前分鐘數
 * @returns {Date} 觸發時間
 */
function calculateTriggerTime(courseDate, scheduleTime, reminderTime = 30) {
  try {
    // 組合課程完整時間
    const courseDateTime = new Date(`${courseDate}T${scheduleTime}:00+08:00`);
    
    if (isNaN(courseDateTime.getTime())) {
      throw new Error('無效的日期時間格式');
    }
    
    // 計算提醒時間（提前 reminderTime 分鐘）
    const triggerTime = new Date(courseDateTime.getTime() - (reminderTime * 60 * 1000));
    
    console.log(`📅 課程時間: ${courseDateTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
    console.log(`⏰ 提醒時間: ${triggerTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
    
    return triggerTime;
  } catch (error) {
    console.error('❌ 計算提醒時間失敗:', error);
    throw error;
  }
}

/**
 * 查找對應的課程
 * @param {string} userId - 用戶ID
 * @param {string} studentName - 學生姓名
 * @param {string} courseName - 課程名稱
 * @param {string} specificDate - 特定日期（可選）
 * @param {string} timeReference - 時間參考（today/tomorrow等）
 * @returns {Object|null} 課程資料
 */
async function findTargetCourse(userId, studentName, courseName, specificDate = null, timeReference = null) {
  try {
    let courseDate = specificDate;
    
    // 如果沒有指定具體日期，根據時間參考計算
    if (!courseDate && timeReference) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      switch (timeReference) {
        case 'today':
          courseDate = `${year}-${month}-${day}`;
          break;
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          courseDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          courseDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          break;
        default:
          // 如果沒有明確時間參考，查找最近的課程
          break;
      }
    }
    
    // 查找課程
    const course = await firebaseService.findCourse(userId, studentName, courseName, courseDate);
    
    if (!course) {
      console.log(`❓ 找不到對應課程: 學生=${studentName}, 課程=${courseName}, 日期=${courseDate}`);
      return null;
    }
    
    console.log(`📚 找到課程: ${course.studentName} 的 ${course.courseName} (${course.courseDate} ${course.scheduleTime})`);
    return course;
  } catch (error) {
    console.error('❌ 查找課程失敗:', error);
    throw error;
  }
}

/**
 * 設定提醒任務處理器
 * @param {Object} slots - 提取的槽位資料
 * @param {string} userId - LINE 用戶ID
 * @returns {Object} 處理結果 { success: boolean, message: string }
 */
async function handle_set_reminder_task(slots, userId) {
  try {
    console.log('🔔 開始處理設定提醒任務:', slots);
    
    // 1. 驗證必要參數
    if (!slots.studentName) {
      return { 
        success: false, 
        message: '❌ 請提供學生姓名，例如：「提醒我小明的數學課」' 
      };
    }
    
    if (!slots.courseName) {
      return { 
        success: false, 
        message: '❌ 請提供課程名稱，例如：「提醒我小明的數學課」' 
      };
    }
    
    // 2. 查找對應課程
    const course = await findTargetCourse(
      userId, 
      slots.studentName, 
      slots.courseName,
      slots.specificDate,
      slots.timeReference
    );
    
    if (!course) {
      return {
        success: false,
        message: `❌ 找不到 ${slots.studentName} 的 ${slots.courseName}，請確認課程是否已安排`
      };
    }
    
    // 3. 檢查課程是否已過期
    const now = new Date();
    const courseDateTime = new Date(`${course.courseDate}T${course.scheduleTime}:00+08:00`);
    
    if (courseDateTime < now) {
      return {
        success: false,
        message: `❌ ${slots.studentName} 的 ${slots.courseName} (${course.courseDate} ${course.scheduleTime}) 已經過了，無法設定提醒`
      };
    }
    
    // 4. 設定預設提醒時間（如果沒有指定）
    const reminderTime = slots.reminderTime || 30; // 預設提前30分鐘
    
    // 5. 計算觸發時間
    const triggerTime = calculateTriggerTime(course.courseDate, course.scheduleTime, reminderTime);
    
    // 檢查觸發時間是否已過
    if (triggerTime < now) {
      return {
        success: false,
        message: `❌ 提醒時間已過，無法設定 ${reminderTime} 分鐘前的提醒`
      };
    }
    
    // 6. 建立提醒資料
    const reminderData = {
      courseId: course.id || course.courseId,
      userId: userId,
      studentName: slots.studentName,
      courseName: slots.courseName,
      reminderTime: reminderTime,
      reminderNote: slots.reminderNote || `${slots.studentName} 的 ${slots.courseName}即將開始`,
      triggerTime: triggerTime,
      courseDate: course.courseDate,
      scheduleTime: course.scheduleTime
    };
    
    // 7. 儲存提醒記錄到 Firebase
    const reminder = await firebaseService.createReminder(reminderData);
    
    // 8. 格式化回應訊息
    const courseTimeStr = courseDateTime.toLocaleString('zh-TW', { 
      timeZone: 'Asia/Taipei',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const triggerTimeStr = triggerTime.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei', 
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let message = `✅ 提醒設定完成！\n`;
    message += `📚 課程：${slots.studentName} 的 ${slots.courseName}\n`;
    message += `📅 上課時間：${courseTimeStr}\n`;
    message += `⏰ 提醒時間：${triggerTimeStr} (提前 ${reminderTime} 分鐘)`;
    
    if (slots.reminderNote) {
      message += `\n📝 提醒內容：${slots.reminderNote}`;
    }
    
    console.log('✅ 提醒設定成功:', reminder.reminderId);
    
    return {
      success: true,
      message: message
    };
    
  } catch (error) {
    console.error('❌ 設定提醒失敗:', error);
    return {
      success: false,
      message: '❌ 提醒設定失敗，請稍後再試'
    };
  }
}

module.exports = handle_set_reminder_task;