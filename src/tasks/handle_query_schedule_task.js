/**
 * 處理查詢課程表任務
 * 支持多種時間範圍的課程查詢
 */

const firebaseService = require('../services/firebaseService');

/**
 * 計算時間範圍
 */
function calculateDateRange(timeReference, specificDate = null) {
  const today = new Date();
  
  if (specificDate) {
    return {
      startDate: specificDate,
      endDate: specificDate,
      description: specificDate
    };
  }
  
  switch (timeReference) {
    case 'today':
      const todayStr = today.toISOString().split('T')[0];
      return {
        startDate: todayStr,
        endDate: todayStr,
        description: '今天'
      };
      
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      return {
        startDate: tomorrowStr,
        endDate: tomorrowStr,
        description: '明天'
      };
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return {
        startDate: yesterdayStr,
        endDate: yesterdayStr,
        description: '昨天'
      };
      
    case 'this_week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // 週日
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // 週六
      return {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        description: '本週'
      };
      
    case 'next_week':
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() - today.getDay() + 7); // 下週日
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6); // 下週六
      return {
        startDate: nextWeekStart.toISOString().split('T')[0],
        endDate: nextWeekEnd.toISOString().split('T')[0],
        description: '下週'
      };
      
    case 'last_week':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7); // 上週日
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // 上週六
      return {
        startDate: lastWeekStart.toISOString().split('T')[0],
        endDate: lastWeekEnd.toISOString().split('T')[0],
        description: '上週'
      };
      
    default:
      // 預設查詢未來7天
      const future7Days = new Date(today);
      future7Days.setDate(today.getDate() + 7);
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: future7Days.toISOString().split('T')[0],
        description: '未來7天'
      };
  }
}

/**
 * 格式化時間顯示
 */
function formatTime(timeString) {
  if (!timeString) return '時間未定';
  
  const [hour, minute] = timeString.split(':');
  const h = parseInt(hour);
  const m = minute === '00' ? '' : `:${minute}`;
  
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
  
  let message = `📅 ${description}的課程安排\n\n`;
  
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
        ? course.courseRecord.notes.substring(0, 20) + '...'
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
          endDate: dateRange.endDate
        }
      );
      
      allCourses.push(...courses);
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
      slots.timeReference || 'today',
      slots.specificDate
    );
    
    console.log('📅 查詢時間範圍:', dateRange);
    
    // 2. 查詢課程
    let courses = [];
    
    if (slots.studentName) {
      // 查詢特定學生的課程
      courses = await firebaseService.getCoursesByStudent(
        userId,
        slots.studentName,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      );
      
      // 如果指定了課程名稱，進一步篩選
      if (slots.courseName) {
        courses = courses.filter(course => 
          course.courseName.includes(slots.courseName)
        );
      }
    } else {
      // 查詢所有學生的課程
      courses = await getAllStudentCourses(userId, dateRange);
    }
    
    console.log(`📚 查詢到 ${courses.length} 筆課程`);
    
    // 3. 格式化結果
    const studentInfo = slots.studentName ? slots.studentName : '所有學生';
    const description = `${studentInfo}${dateRange.description}`;
    const message = formatCourseList(courses, description);
    
    // 4. 如果沒有課程，提供建議
    if (courses.length === 0) {
      const suggestionMessage = `${message}\n\n💡 您可以：\n• 新增課程：「小明明天上午10點英文課」\n• 查詢其他時間：「小明下週的課表」\n• 記錄課程內容：「記錄昨天數學課的內容」`;
      
      return {
        success: true,
        message: suggestionMessage,
        data: {
          courseCount: 0,
          dateRange
        }
      };
    }
    
    return {
      success: true,
      message: message,
      data: {
        courses,
        courseCount: courses.length,
        dateRange
      }
    };
    
  } catch (error) {
    console.error('❌ 查詢課表任務失敗:', error);
    
    // 根據錯誤類型提供不同的回應
    if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
      return {
        success: false,
        message: '❌ 資料查詢失敗，請稍後再試。'
      };
    } else {
      return {
        success: false,
        message: '❌ 查詢課表失敗，請檢查學生姓名並稍後再試。'
      };
    }
  }
}

module.exports = handle_query_schedule_task;