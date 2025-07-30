/**
 * RecurringCourseCalculator - 重複課程動態計算器
 * 職責：動態計算重複課程的未來實例
 * 設計原則：不預先創建課程實例，查詢時即時計算
 */
const TimeService = require('../services/timeService');

class RecurringCourseCalculator {
  /**
   * 計算重複課程的未來時間點
   * @param {Object} course - 重複課程對象
   * @param {string} startDate - 查詢起始日期 (YYYY-MM-DD)
   * @param {string} endDate - 查詢結束日期 (YYYY-MM-DD)
   * @param {number} maxCount - 最大計算實例數
   * @returns {Array} 未來課程實例陣列
   */
  static calculateFutureOccurrences(course, startDate, endDate, maxCount = 50) {
    const occurrences = [];
    
    // 使用本地日期避免時區問題
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    // 確定課程開始日期
    let courseStartDate;
    if (course.recurrence_details?.start_date) {
      const [courseYear, courseMonth, courseDay] = course.recurrence_details.start_date.split('-').map(Number);
      courseStartDate = new Date(courseYear, courseMonth - 1, courseDay);
    } else if (course.course_date) {
      const [courseYear, courseMonth, courseDay] = course.course_date.split('-').map(Number);
      courseStartDate = new Date(courseYear, courseMonth - 1, courseDay);
    } else {
      courseStartDate = start;
    }

    // 🚨 修復：查詢應該從查詢起始日期開始，不受錯誤 start_date 影響
    // 根據第一性原則：查詢範圍內的所有符合規則的實例都應該被找到
    let current = new Date(start.getTime());
    let iterationCount = 0;
    
    // 智能計算最大迭代次數，根據重複類型調整
    let maxIterations;
    if (course.daily_recurring) {
      // 每日重複：計算查詢範圍的總天數 + 緩衝
      const totalDays = Math.ceil((end.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
      maxIterations = Math.min(totalDays + 10, maxCount + 50);
    } else if (course.weekly_recurring) {
      // 週重複：計算週數 * 7 + 緩衝
      const totalWeeks = Math.ceil((end.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
      maxIterations = Math.min(totalWeeks * 7 + 20, maxCount * 3);
    } else if (course.monthly_recurring) {
      // 月重複：計算月數 * 31 + 緩衝
      const totalMonths = Math.ceil((end.getTime() - current.getTime()) / (30 * 24 * 60 * 60 * 1000));
      maxIterations = Math.min(totalMonths * 31 + 30, maxCount * 5);
    } else {
      // 預設：保守估計
      maxIterations = maxCount * 2;
    }

    console.log(`🔄 [RecurringCalculator] 計算 "${course.course_name}" 的重複實例`);
    console.log(`🔄 查詢範圍: ${startDate} 到 ${endDate}`);
    console.log(`🔄 課程開始日期: ${TimeService.formatForStorage(courseStartDate)}`);
    console.log(`🔄 計算起始日期: ${TimeService.formatForStorage(current)}`);
    console.log(`🔄 最大迭代次數: ${maxIterations} (智能計算)`);

    while (current <= end && occurrences.length < maxCount && iterationCount < maxIterations) {
      iterationCount++;
      
      if (this.matchesRecurrenceRule(current, course)) {
        // 構建時間顯示（結合日期和時間）
        const timeDisplay = this.buildTimeDisplay(current, course);
        const instanceDate = TimeService.formatForStorage(current);
        
        occurrences.push({
          id: `${course.id}_${instanceDate}`, // 唯一ID
          date: instanceDate,
          course_name: course.course_name,
          child_name: course.child_name, // 🎯 確保學童信息被保留
          schedule_time: timeDisplay,
          recurring_label: this.getRecurrenceLabel(course),
          is_recurring_instance: true,
          original_course_id: course.id,
          location: course.location,
          teacher: course.teacher,
          status: 'scheduled',
          // 額外的重複課程元數據
          recurrence_type: this.getRecurrenceType(course),
          instance_date: instanceDate
        });
        
        console.log(`✅ 找到重複實例: ${course.course_name} 於 ${instanceDate} (週${['日','一','二','三','四','五','六'][current.getDay()]})`);
      }

      // 移動到下一個可能的日期
      current = this.getNextPossibleDate(current, course);
      
      // 避免無效的日期進展（檢查日期是否真的前進了）
      const expectedMinDate = new Date(current.getTime() - 24 * 60 * 60 * 1000);
      if (current <= expectedMinDate) {
        console.warn(`⚠️ [RecurringCalculator] 日期進展異常，停止計算`);
        break;
      }
    }

    if (iterationCount >= maxIterations) {
      console.warn(`⚠️ [RecurringCalculator] 達到最大迭代次數限制 (${maxIterations})，停止計算`);
    }

    console.log(`🔄 [RecurringCalculator] 計算完成: 找到 ${occurrences.length} 個重複實例`);
    return occurrences;
  }

  /**
   * 檢查指定日期是否符合重複規則
   * @param {Date} date - 要檢查的日期
   * @param {Object} course - 重複課程對象
   * @returns {boolean} 是否符合規則
   */
  static matchesRecurrenceRule(date, course) {
    const { recurrence_details } = course;

    if (course.daily_recurring) {
      return true; // 每天都符合
    }

    if (course.weekly_recurring) {
      const dayOfWeek = date.getDay();
      return recurrence_details?.days_of_week?.includes(dayOfWeek) || false;
    }

    if (course.monthly_recurring) {
      const dayOfMonth = date.getDate();
      return dayOfMonth === recurrence_details?.day_of_month;
    }

    return false;
  }

  /**
   * 獲取下一個可能的日期（性能優化版本）
   * @param {Date} current - 當前日期
   * @param {Object} course - 重複課程對象
   * @returns {Date} 下一個可能的日期
   */
  static getNextPossibleDate(current, course) {
    const next = new Date(current);

    if (course.daily_recurring) {
      // 每日重複：直接跳到下一天
      next.setDate(next.getDate() + 1);
    } else if (course.weekly_recurring) {
      // 週重複：跳到下一個符合的星期
      const targetDaysOfWeek = course.recurrence_details?.days_of_week || [];
      if (targetDaysOfWeek.length === 0) {
        // 如果沒有指定星期，逐日檢查
        next.setDate(next.getDate() + 1);
      } else {
        // 找到下一個目標星期
        const currentDay = current.getDay();
        let daysToAdd = 1;
        
        // 尋找下一個符合的星期幾
        for (let i = 1; i <= 7; i++) {
          const nextDay = (currentDay + i) % 7;
          if (targetDaysOfWeek.includes(nextDay)) {
            daysToAdd = i;
            break;
          }
        }
        
        next.setDate(next.getDate() + daysToAdd);
      }
    } else if (course.monthly_recurring) {
      // 月重複：跳到下一個符合的日期
      const targetDayOfMonth = course.recurrence_details?.day_of_month;
      if (!targetDayOfMonth) {
        // 如果沒有指定日期，逐日檢查
        next.setDate(next.getDate() + 1);
      } else {
        // 跳到下一個目標日期
        if (current.getDate() < targetDayOfMonth) {
          // 本月內的目標日期
          next.setDate(targetDayOfMonth);
        } else {
          // 下個月的目標日期
          next.setMonth(next.getMonth() + 1);
          next.setDate(targetDayOfMonth);
        }
      }
    } else {
      // 預設：下一天
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * 獲取重複課程的顯示標籤
   * @param {Object} course - 重複課程對象
   * @returns {string} 重複標籤（純文字，用於課程名稱後的括號）
   */
  static getRecurrenceLabel(course) {
    if (course.daily_recurring) return '每天';
    
    if (course.weekly_recurring) {
      const days = course.recurrence_details?.days_of_week?.map(d => 
        TimeService.formatWeekdayToText(d)
      ).join('、') || '未指定';
      return `每${days}`;
    }
    
    if (course.monthly_recurring) {
      const dayOfMonth = course.recurrence_details?.day_of_month || '未指定';
      return `每月${dayOfMonth}號`;
    }
    
    return '';
  }

  /**
   * 建構時間顯示字串（結合日期和時間）
   * @param {Date} date - 日期對象
   * @param {Object} course - 重複課程對象
   * @returns {string} 時間顯示字串
   */
  static buildTimeDisplay(date, course) {
    // 使用課程的原始時間，但顯示具體日期
    const timeOfDay = course.recurrence_details?.time_of_day || 
                     course.schedule_time || 
                     '時間待定';
    
    // 如果有具體時間，結合日期顯示
    if (timeOfDay && timeOfDay !== '時間待定') {
      return TimeService.formatForDisplay(new Date(date.toDateString() + ' ' + timeOfDay));
    }
    
    // 否則使用原始的 schedule_time
    return course.schedule_time || '時間待定';
  }

  /**
   * 取得重複類型
   * @param {Object} course - 重複課程對象
   * @returns {string} 重複類型
   */
  static getRecurrenceType(course) {
    if (course.daily_recurring) return 'daily';
    if (course.weekly_recurring) return 'weekly';
    if (course.monthly_recurring) return 'monthly';
    return 'none';
  }

  /**
   * 檢查單一日期是否與重複課程時間衝突
   * @param {string} userId - 用戶ID
   * @param {string} date - 檢查日期 (YYYY-MM-DD)
   * @param {string} time - 檢查時間
   * @param {Array} recurringCourses - 重複課程列表
   * @returns {Array} 衝突的課程列表
   */
  static checkDateConflicts(userId, date, time, recurringCourses) {
    const conflicts = [];
    const checkDate = new Date(date);

    for (const course of recurringCourses) {
      if (course.student_id !== userId) continue;
      
      if (this.matchesRecurrenceRule(checkDate, course) && this.timesOverlap(time, course.schedule_time)) {
        conflicts.push({
          course_id: course.id,
          course_name: course.course_name,
          date: date,
          time: course.schedule_time,
          conflict_type: 'recurring'
        });
      }
    }

    return conflicts;
  }

  /**
   * 簡化的時間重疊檢查
   * @param {string} time1 - 時間1
   * @param {string} time2 - 時間2
   * @returns {boolean} 是否重疊
   */
  static timesOverlap(time1, time2) {
    // 簡化版本：相同時間視為衝突
    // 實際實作需要考慮課程持續時間
    return time1 === time2;
  }

  /**
   * 計算重複課程在指定日期範圍內的總數
   * @param {Object} course - 重複課程對象
   * @param {string} startDate - 起始日期
   * @param {string} endDate - 結束日期
   * @returns {number} 總課程數
   */
  static countOccurrences(course, startDate, endDate) {
    const occurrences = this.calculateFutureOccurrences(course, startDate, endDate);
    return occurrences.length;
  }

  /**
   * 檢查重複課程是否在指定日期有課
   * @param {Object} course - 重複課程對象
   * @param {string} date - 檢查日期 (YYYY-MM-DD)
   * @returns {boolean} 是否有課
   */
  static hasOccurrenceOnDate(course, date) {
    const checkDate = new Date(date);
    return this.matchesRecurrenceRule(checkDate, course);
  }

  /**
   * 獲取重複課程的下一次上課時間
   * @param {Object} course - 重複課程對象
   * @param {Date} fromDate - 起始時間
   * @returns {string|null} 下次上課日期 (YYYY-MM-DD) 或 null
   */
  static getNextOccurrence(course, fromDate = null) {
    const startDate = fromDate ? TimeService.formatForStorage(fromDate) : TimeService.formatForStorage(TimeService.getCurrentUserTime());
    const endDate = TimeService.formatForStorage(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // 一年後

    const occurrences = this.calculateFutureOccurrences(course, startDate, endDate, 1);
    return occurrences.length > 0 ? occurrences[0].date : null;
  }

  /**
   * 生成重複課程的完整描述
   * @param {Object} course - 重複課程對象
   * @returns {string} 完整描述
   */
  static generateCourseDescription(course) {
    const label = this.getRecurrenceLabel(course);
    const nextOccurrence = this.getNextOccurrence(course);
    
    let description = `${course.course_name} ${label}`;
    
    if (nextOccurrence) {
      const nextDisplay = TimeService.formatForDisplay(new Date(nextOccurrence + 'T' + (course.recurrence_details?.time_of_day || '00:00')));
      description += `\n📅 下次上課：${nextDisplay}`;
    }

    if (course.location) {
      description += `\n📍 地點：${course.location}`;
    }

    if (course.teacher) {
      description += `\n👨‍🏫 老師：${course.teacher}`;
    }

    return description;
  }

  /**
   * 驗證重複課程規則的有效性
   * @param {Object} course - 重複課程對象
   * @returns {Object} 驗證結果
   */
  static validateRecurrenceRule(course) {
    const errors = [];

    // 檢查是否有重複類型
    const hasRecurrenceType = course.daily_recurring || course.weekly_recurring || course.monthly_recurring;
    if (!hasRecurrenceType) {
      errors.push('未設定重複類型');
    }

    // 檢查重複詳細資訊
    if (hasRecurrenceType && !course.recurrence_details) {
      errors.push('缺少重複詳細資訊');
    }

    // 檢查週重複的 days_of_week
    if (course.weekly_recurring && (!course.recurrence_details?.days_of_week || course.recurrence_details.days_of_week.length === 0)) {
      errors.push('週重複課程必須指定星期幾');
    }

    // 檢查月重複的 day_of_month
    if (course.monthly_recurring && !course.recurrence_details?.day_of_month) {
      errors.push('月重複課程必須指定第幾天');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = RecurringCourseCalculator;