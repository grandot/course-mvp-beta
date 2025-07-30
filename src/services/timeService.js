/**
 * TimeService - 時間處理統一入口
 * 職責：時間解析、格式化、計算、驗證
 * 禁止：直接使用 new Date()
 */
class TimeService {
  /**
   * 獲取當前用戶時間
   * @param {string} timezone - 時區設定
   * @returns {Date} 當前時間
   */
  static getCurrentUserTime(timezone = 'Asia/Taipei') {
    const now = new Date();
    // 創建在指定時區的時間對象
    return this.createDateInTimezone(now, timezone);
  }

  /**
   * 解析時間字符串
   * @param {string} timeString - 時間字符串
   * @param {Date} referenceTime - 參考時間
   * @param {string} timezone - 用戶時區（默認台北時間）
   * @returns {Promise<Date>} 解析後的時間
   */
  static async parseTimeString(timeString, referenceTime = null, timezone = 'Asia/Taipei') {
    if (!timeString || typeof timeString !== 'string') {
      throw new Error('TimeService: timeString must be a non-empty string');
    }

    // 使用參考時間或當前時間作為基準
    const baseTime = referenceTime || new Date();
    const normalizedInput = timeString.trim().toLowerCase();

    // 解析相對日期（今天、明天、週幾）
    const dateOffset = this.parseDateOffset(normalizedInput, baseTime);

    // 解析時間部分
    const timeInfo = this.parseTimeComponent(normalizedInput);

    // 將基準時間轉換到用戶時區進行計算
    const userLocalTime = this.convertToUserTimezone(baseTime, timezone);

    // 調整日期
    if (dateOffset !== 0) {
      userLocalTime.setDate(userLocalTime.getDate() + dateOffset);
    }

    // 設置時間
    if (timeInfo.hour !== null) {
      userLocalTime.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
    } else {
      // 🚨 修復：如果沒有找到時間組件，拋出錯誤而不是返回當前時間
      throw new Error('No time component found in the input');
    }

    return userLocalTime;
  }

  /**
   * 格式化時間顯示 (MM/DD HH:MM AM/PM 格式)
   * @param {string|Date} isoTimeOrDate - ISO時間字符串或Date對象
   * @returns {string} 格式化後的時間字符串
   */
  static formatForDisplay(isoTimeOrDate) {
    if (!isoTimeOrDate) return null;

    const date = typeof isoTimeOrDate === 'string'
      ? new Date(isoTimeOrDate)
      : isoTimeOrDate;

    if (Number.isNaN(date.getTime())) return null;

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${month}/${day} ${displayHours}:${minutes} ${ampm}`;
  }

  /**
   * 格式化時間用於存儲 (YYYY-MM-DD 格式)
   * @param {string|Date} isoTimeOrDate - ISO時間字符串或Date對象
   * @returns {string} YYYY-MM-DD 格式
   */
  static formatForStorage(isoTimeOrDate) {
    if (!isoTimeOrDate) return null;

    const date = typeof isoTimeOrDate === 'string'
      ? new Date(isoTimeOrDate)
      : isoTimeOrDate;

    if (Number.isNaN(date.getTime())) return null;

    // 使用本地日期避免時區轉換問題
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * 創建統一時間信息對象
   * @param {string|Date} parsedTime - 解析後的時間
   * @returns {Object|null} 統一格式的時間信息
   */
  static createTimeInfo(parsedTime) {
    if (!parsedTime) return null;

    const date = typeof parsedTime === 'string'
      ? new Date(parsedTime)
      : parsedTime;

    if (Number.isNaN(date.getTime())) return null;

    return {
      display: this.formatForDisplay(date),
      date: this.formatForStorage(date),
      raw: typeof parsedTime === 'string' ? parsedTime : date.toISOString(),
      timestamp: date.getTime(),
    };
  }

  /**
   * 驗證時間信息格式
   * @param {Object} timeInfo - 時間信息對象
   * @returns {boolean} 驗證結果
   */
  static validateTimeInfo(timeInfo) {
    if (!timeInfo) return true; // null 是有效的

    if (typeof timeInfo !== 'object') return false;

    const requiredFields = ['display', 'date', 'raw'];
    const hasAllFields = requiredFields.every((field) => field in timeInfo);

    if (!hasAllFields) return false;

    // 驗證 display 格式 (MM/DD HH:MM AM/PM)
    if (timeInfo.display && !timeInfo.display.match(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/)) {
      return false;
    }

    // 驗證 date 格式 (YYYY-MM-DD)
    if (timeInfo.date && !timeInfo.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return false;
    }

    return true;
  }

  /**
   * 驗證時間有效性
   * @param {Date} time - 待驗證時間
   * @returns {Promise<boolean>} 驗證結果
   */
  // eslint-disable-next-line no-unused-vars
  static async validateTime(time) {
    throw new Error('NotImplementedError: TimeService.validateTime not implemented');
  }

  /**
   * 計算時間範圍
   * @param {Date} startTime - 開始時間
   * @param {Date} endTime - 結束時間
   * @returns {Promise<Object>} 時間範圍信息
   */
  // eslint-disable-next-line no-unused-vars
  static async calculateTimeRange(startTime, endTime) {
    throw new Error('NotImplementedError: TimeService.calculateTimeRange not implemented');
  }

  /**
   * 檢查時間衝突
   * @param {Date} newTime - 新時間
   * @param {Array} existingTimes - 已存在的時間列表
   * @returns {Promise<boolean>} 是否有衝突
   */
  // eslint-disable-next-line no-unused-vars
  static async checkTimeConflict(newTime, existingTimes) {
    throw new Error('NotImplementedError: TimeService.checkTimeConflict not implemented');
  }

  /**
   * 解析日期偏移（今天、明天、週幾等）
   * @param {string} input - 標準化輸入
   * @param {Date} referenceTime - 參考時間，用於計算星期幾
   * @returns {number} 日期偏移量
   */
  static parseDateOffset(input, referenceTime = null) {
    // 處理相對日期
    if (input.includes('今天') || input.includes('今日')) {
      return 0;
    }
    if (input.includes('明天') || input.includes('明日')) {
      return 1;
    }
    if (input.includes('後天')) {
      return 2;
    }
    if (input.includes('昨天') || input.includes('昨日')) {
      return -1;
    }
    if (input.includes('前天')) {
      return -2;
    }

    // 🔧 新增：處理星期幾
    const weekdayMap = {
      '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0,
      '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 0,
      '禮拜一': 1, '禮拜二': 2, '禮拜三': 3, '禮拜四': 4, '禮拜五': 5, '禮拜六': 6, '禮拜日': 0
    };

    for (const [weekdayText, targetDay] of Object.entries(weekdayMap)) {
      if (input.includes(weekdayText)) {
        const baseTime = referenceTime || new Date();
        const currentDay = baseTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        
        // 計算到目標星期幾的偏移天數
        let offset = targetDay - currentDay;
        
        // 🚨 修復：如果目標日期是過去的，則指向下一週；如果是今天，允許
        if (offset < 0) {
          offset += 7;
        }
        
        return offset;
      }
    }

    return 0; // 默認今天
  }

  /**
   * 解析時間組件（小時、分鐘）
   * @param {string} input - 標準化輸入
   * @returns {Object} {hour, minute}
   */
  static parseTimeComponent(input) {
    let hour = null;
    let minute = 0;

    // 處理 HH:MM 格式
    const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      return { hour, minute };
    }

    // 處理 HH:M 格式
    const shortTimeMatch = input.match(/(\d{1,2}):(\d{1})/);
    if (shortTimeMatch) {
      hour = parseInt(shortTimeMatch[1], 10);
      minute = parseInt(shortTimeMatch[2], 10) * 10; // 2:3 -> 2:30
      return { hour, minute };
    }

    // 處理中文數字時間 - 按長度排序，避免十一點被誤認為一點
    const chineseTimeMap = {
      十一點: 11,
      十二點: 12,
      十一点: 11,
      十二点: 12,
      一點: 1,
      二點: 2,
      兩點: 2, // 🚨 新增：支持"兩點"
      三點: 3,
      四點: 4,
      五點: 5,
      六點: 6,
      七點: 7,
      八點: 8,
      九點: 9,
      十點: 10,
      一点: 1,
      二点: 2,
      兩点: 2, // 🚨 新增：支持簡體"兩点"
      三点: 3,
      四点: 4,
      五点: 5,
      六点: 6,
      七点: 7,
      八点: 8,
      九点: 9,
      十点: 10,
    };

    // 檢查中文時間 - 優先檢查帶分鐘的格式
    const chineseMinuteMatch = input.match(/(十一|十二|一|二|兩|三|四|五|六|七|八|九|十)[點点](\d{1,2})/);
    if (chineseMinuteMatch) {
      const chineseHour = chineseMinuteMatch[1];
      const chineseHourMap = {
        十一: 11, 十二: 12, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5,
        六: 6, 七: 7, 八: 8, 九: 9, 十: 10
      };
      hour = chineseHourMap[chineseHour];
      minute = parseInt(chineseMinuteMatch[2], 10);
    } else {
      // 檢查中文時間（無分鐘）
      const chineseEntries = Object.entries(chineseTimeMap);
      const matchedEntry = chineseEntries.find(([chinese]) => input.includes(chinese));
      if (matchedEntry) {
        [, hour] = matchedEntry;
      }
    }

    // 處理上午/下午/晚上/PM/AM
    if (hour !== null) {
      if (input.includes('下午') || input.includes('晚上') || input.includes('pm')) {
        if (hour < 12) hour += 12;
      } else if (input.includes('上午') || input.includes('早上') || input.includes('am')) {
        if (hour === 12) hour = 0;
      } else if (input.includes('中午')) {
        // 中午12點保持為12，其他時間需要判斷
        if (hour !== 12 && hour < 12) hour += 12;
      } else {
        // 🔧 智能默認時間段 - 當沒有明確指定上午/下午時
        if (hour >= 1 && hour <= 5) {
          // 1-5點默認為下午（14:00-17:00）
          hour += 12;
        } else if (hour >= 6 && hour <= 11) {
          // 6-11點需要根據上下文判斷，但修改時間通常是下午
          // 在課程修改場景中，6-11點傾向於下午/晚上
          if (input.includes('改成') || input.includes('修改') || input.includes('變更')) {
            hour += 12; // 修改場景默認下午
          }
          // 其他情況保持原樣（上午）
        }
        // 12點保持為12（中午），0點保持為0（午夜）
      }
    }

    // 處理半點
    if (input.includes('半') && hour !== null) {
      minute = 30;
    }

    // 處理數字時間（如：下午三點、晚上八點、3 PM）
    const numberMatch = input.match(/(\d{1,2})點/) || input.match(/(\d{1,2})\s*(pm|am)/);
    if (numberMatch && hour === null) {
      hour = parseInt(numberMatch[1], 10);
      if (input.includes('下午') || input.includes('晚上') || input.includes('pm')) {
        if (hour < 12) hour += 12;
      } else if (input.includes('上午') || input.includes('早上') || input.includes('am')) {
        if (hour === 12) hour = 0;
      } else if (input.includes('中午')) {
        // 中午12點保持為12，其他時間需要判斷
        if (hour !== 12 && hour < 12) hour += 12;
      } else {
        // 🔧 智能默認時間段 - 數字時間也適用相同邏輯
        if (hour >= 1 && hour <= 5) {
          // 1-5點默認為下午（14:00-17:00）
          hour += 12;
        } else if (hour >= 6 && hour <= 11) {
          // 在課程修改場景中，6-11點傾向於下午/晚上
          if (input.includes('改成') || input.includes('修改') || input.includes('變更')) {
            hour += 12; // 修改場景默認下午
          }
        }
      }
    }

    // 🔧 修復：處理分鐘數 (四點20、3點45、晚上八點30)
    const minuteMatch = input.match(/(\d{1,2})點(\d{1,2})/) || input.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
    if (minuteMatch) {
      const matchedHour = parseInt(minuteMatch[1], 10);
      const matchedMinute = parseInt(minuteMatch[2], 10);
      
      // 如果還沒設定小時，使用匹配到的小時
      if (hour === null) {
        hour = matchedHour;
        // 處理上午/下午/晚上
        if (input.includes('下午') || input.includes('晚上') || input.includes('pm')) {
          if (hour < 12) hour += 12;
        } else if (input.includes('上午') || input.includes('早上') || input.includes('am')) {
          if (hour === 12) hour = 0;
        } else if (input.includes('中午')) {
          // 中午12點保持為12，其他時間需要判斷
          if (hour !== 12 && hour < 12) hour += 12;
        } else {
          // 🔧 智能默認時間段 - 分鐘數場景也適用
          if (hour >= 1 && hour <= 5) {
            // 1-5點默認為下午（14:00-17:00）
            hour += 12;
          } else if (hour >= 6 && hour <= 11) {
            // 在課程修改場景中，6-11點傾向於下午/晚上
            if (input.includes('改成') || input.includes('修改') || input.includes('變更')) {
              hour += 12;
            }
          }
        }
      }
      
      // 設定分鐘數
      minute = matchedMinute;
    }

    return { hour, minute };
  }

  /**
   * 在指定時區創建 Date 對象
   * @param {Date} sourceDate - 源時間
   * @param {string} timezone - 目標時區
   * @returns {Date} 在指定時區的時間對象
   */
  // eslint-disable-next-line no-unused-vars
  static createDateInTimezone(sourceDate, timezone) {
    // 簡化版本：直接複製源時間，但解釋為在指定時區的本地時間
    return new Date(sourceDate.getTime());
  }

  /**
   * 將時間轉換到用戶時區
   * @param {Date} sourceDate - 源時間
   * @param {string} timezone - 用戶時區
   * @returns {Date} 轉換後的時間
   */
  static convertToUserTimezone(sourceDate, timezone) {
    // 獲取源時間在指定時區的表示
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const timeString = formatter.format(sourceDate);
    return new Date(timeString);
  }

  /**
   * 在指定時間基礎上添加分鐘
   * @param {Date} date - 基準時間
   * @param {number} minutes - 要添加的分鐘數
   * @returns {Date} 添加後的時間
   */
  static addMinutes(date, minutes) {
    if (!date || !(date instanceof Date)) {
      throw new Error('TimeService: date must be a Date object');
    }
    
    if (typeof minutes !== 'number') {
      throw new Error('TimeService: minutes must be a number');
    }

    const result = new Date(date.getTime());
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * 解析 ISO 日期時間字符串為 Date 對象
   * @param {string} isoString - ISO 格式的日期時間字符串
   * @returns {Date} 解析後的 Date 對象
   */
  static parseDateTime(isoString) {
    if (!isoString || typeof isoString !== 'string') {
      throw new Error('TimeService: isoString must be a non-empty string');
    }

    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      throw new Error('TimeService: Invalid date string format');
    }

    return date;
  }

  /**
   * 計算重複課程的智能起始日期
   * @param {string} recurrenceType - 重複類型 ('daily', 'weekly', 'monthly')
   * @param {string} timeOfDay - 時間 (HH:MM 格式)
   * @param {Date} currentTime - 當前時間
   * @param {Array} daysOfWeek - 星期幾陣列 (0=週日, 1=週一, ..., 6=週六)
   * @param {number} dayOfMonth - 每月第幾天 (1-31)
   * @returns {string} 起始日期 (YYYY-MM-DD 格式)
   */
  static calculateSmartStartDate(recurrenceType, timeOfDay, currentTime = null, daysOfWeek = [], dayOfMonth = 1) {
    const now = currentTime || this.getCurrentUserTime();
    const [hour, minute] = timeOfDay.split(':').map(Number);

    switch (recurrenceType) {
      case 'daily':
        return this.calculateDailyStartDate(now, hour, minute);
      case 'weekly':
        return this.calculateWeeklyStartDate(now, hour, minute, daysOfWeek);
      case 'monthly':
        return this.calculateMonthlyStartDate(now, hour, minute, dayOfMonth);
      default:
        throw new Error(`Unsupported recurrence type: ${recurrenceType}`);
    }
  }

  /**
   * 計算每日重複課程的起始日期
   * @param {Date} now - 當前時間
   * @param {number} hour - 小時
   * @param {number} minute - 分鐘
   * @returns {string} 起始日期 (YYYY-MM-DD 格式)
   */
  static calculateDailyStartDate(now, hour, minute) {
    const today = new Date(now);
    today.setHours(hour, minute, 0, 0);

    // 如果今天的時間已過，從明天開始
    if (now > today) {
      today.setDate(today.getDate() + 1);
    }

    return this.formatForStorage(today);
  }

  /**
   * 計算每週重複課程的起始日期
   * @param {Date} now - 當前時間
   * @param {number} hour - 小時
   * @param {number} minute - 分鐘
   * @param {Array} daysOfWeek - 星期幾陣列
   * @returns {string} 起始日期 (YYYY-MM-DD 格式)
   */
  static calculateWeeklyStartDate(now, hour, minute, daysOfWeek) {
    if (!daysOfWeek || daysOfWeek.length === 0) {
      throw new Error('daysOfWeek must be provided for weekly recurrence');
    }

    const targetDay = daysOfWeek[0]; // 取第一個星期幾
    const currentDay = now.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0) daysUntilTarget += 7;

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    targetDate.setHours(hour, minute, 0, 0);

    // 如果是同一天但時間已過，移到下週
    if (daysUntilTarget === 0 && now > targetDate) {
      targetDate.setDate(targetDate.getDate() + 7);
    }

    return this.formatForStorage(targetDate);
  }

  /**
   * 計算每月重複課程的起始日期
   * @param {Date} now - 當前時間
   * @param {number} hour - 小時
   * @param {number} minute - 分鐘
   * @param {number} dayOfMonth - 每月第幾天
   * @returns {string} 起始日期 (YYYY-MM-DD 格式)
   */
  static calculateMonthlyStartDate(now, hour, minute, dayOfMonth) {
    const targetDate = new Date(now);
    targetDate.setDate(dayOfMonth);
    targetDate.setHours(hour, minute, 0, 0);

    // 如果本月的日期已過，移到下個月
    if (now > targetDate) {
      targetDate.setMonth(targetDate.getMonth() + 1);
      targetDate.setDate(dayOfMonth);
    }

    return this.formatForStorage(targetDate);
  }

  /**
   * 獲取下一個指定星期幾的日期
   * @param {Date} fromDate - 起始日期
   * @param {number} targetDay - 目標星期幾 (0=週日, 1=週一, ..., 6=週六)
   * @returns {Date} 下一個指定星期幾的日期
   */
  static getNextWeekday(fromDate, targetDay) {
    const date = new Date(fromDate);
    const currentDay = date.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) daysUntilTarget += 7;

    date.setDate(date.getDate() + daysUntilTarget);
    return date;
  }

  /**
   * 獲取下一個指定月份日期
   * @param {Date} fromDate - 起始日期
   * @param {number} dayOfMonth - 月份中的第幾天
   * @returns {Date} 下一個指定月份日期
   */
  static getNextMonthDay(fromDate, dayOfMonth) {
    const date = new Date(fromDate);
    
    // 設定為當月指定日期
    date.setDate(dayOfMonth);
    
    // 如果已經過了，移到下個月
    if (date <= fromDate) {
      date.setMonth(date.getMonth() + 1);
      date.setDate(dayOfMonth);
    }

    return date;
  }

  /**
   * 解析星期幾文字為數字
   * @param {string} dayText - 星期幾文字 (週一、週二等)
   * @returns {number} 星期幾數字 (0=週日, 1=週一, ..., 6=週六)
   */
  static parseWeekdayToNumber(dayText) {
    const weekdayMap = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6,
      '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6,
      '禮拜日': 0, '禮拜一': 1, '禮拜二': 2, '禮拜三': 3, '禮拜四': 4, '禮拜五': 5, '禮拜六': 6
    };

    return weekdayMap[dayText] !== undefined ? weekdayMap[dayText] : null;
  }

  /**
   * 將星期幾數字轉換為中文文字
   * @param {number} dayNumber - 星期幾數字 (0=週日, 1=週一, ..., 6=週六)
   * @returns {string} 星期幾文字
   */
  static formatWeekdayToText(dayNumber) {
    const weekdayTexts = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return weekdayTexts[dayNumber] || '未知';
  }

  /**
   * 獲取一週的開始日期 (週一)
   * @param {Date} date - 參考日期
   * @returns {Date} 一週的開始日期
   */
  static getStartOfWeek(date) {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // 調整為週一
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }

  /**
   * 獲取一週的結束日期 (週日)
   * @param {Date} date - 參考日期
   * @returns {Date} 一週的結束日期
   */
  static getEndOfWeek(date) {
    const endOfWeek = new Date(date);
    const day = endOfWeek.getDay();
    const diff = endOfWeek.getDate() - day + (day === 0 ? 0 : 7); // 調整為週日
    endOfWeek.setDate(diff);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  }

  /**
   * 獲取一個月的開始日期 (第1天)
   * @param {Date} date - 參考日期
   * @returns {Date} 一個月的開始日期
   */
  static getStartOfMonth(date) {
    const startOfMonth = new Date(date);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return startOfMonth;
  }

  /**
   * 獲取一個月的結束日期 (最後一天)
   * @param {Date} date - 參考日期
   * @returns {Date} 一個月的結束日期
   */
  static getEndOfMonth(date) {
    const endOfMonth = new Date(date);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0); // 設為上個月的最後一天
    endOfMonth.setHours(23, 59, 59, 999);
    return endOfMonth;
  }
}

module.exports = TimeService;
