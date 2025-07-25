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

    // 解析相對日期（今天、明天）
    const dateOffset = this.parseDateOffset(normalizedInput);

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
    }

    return userLocalTime;
  }

  /**
   * 格式化時間顯示
   * @param {Date} time - 時間對象
   * @param {string} format - 格式類型
   * @returns {string} 格式化後的時間字符串
   */
  // eslint-disable-next-line no-unused-vars
  static formatForDisplay(time, format = 'MM/DD HH:MM AM/PM') {
    throw new Error('NotImplementedError: TimeService.formatForDisplay not implemented');
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
   * 解析日期偏移（今天、明天等）
   * @param {string} input - 標準化輸入
   * @returns {number} 日期偏移量
   */
  static parseDateOffset(input) {
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
      三点: 3,
      四点: 4,
      五点: 5,
      六点: 6,
      七点: 7,
      八点: 8,
      九点: 9,
      十点: 10,
    };

    // 檢查中文時間
    const chineseEntries = Object.entries(chineseTimeMap);
    const matchedEntry = chineseEntries.find(([chinese]) => input.includes(chinese));
    if (matchedEntry) {
      [, hour] = matchedEntry;
    }

    // 處理上午/下午/PM/AM
    if (hour !== null) {
      if (input.includes('下午') || input.includes('pm')) {
        if (hour < 12) hour += 12;
      } else if (input.includes('上午') || input.includes('am')) {
        if (hour === 12) hour = 0;
      }
    }

    // 處理半點
    if (input.includes('半') && hour !== null) {
      minute = 30;
    }

    // 處理數字時間（如：下午三點、3 PM）
    const numberMatch = input.match(/(\d{1,2})點/) || input.match(/(\d{1,2})\s*(pm|am)/);
    if (numberMatch && hour === null) {
      hour = parseInt(numberMatch[1], 10);
      if (input.includes('下午') || input.includes('pm')) {
        if (hour < 12) hour += 12;
      } else if (input.includes('上午') || input.includes('am')) {
        if (hour === 12) hour = 0;
      }
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
}

module.exports = TimeService;
