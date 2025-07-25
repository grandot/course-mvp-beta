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
  // eslint-disable-next-line no-unused-vars
  static getCurrentUserTime(timezone = 'Asia/Taipei') {
    throw new Error('NotImplementedError: TimeService.getCurrentUserTime not implemented');
  }

  /**
   * 解析時間字符串
   * @param {string} timeString - 時間字符串
   * @param {Date} referenceTime - 參考時間
   * @returns {Promise<Date>} 解析後的時間
   */
  // eslint-disable-next-line no-unused-vars
  static async parseTimeString(timeString, referenceTime = null) {
    throw new Error('NotImplementedError: TimeService.parseTimeString not implemented');
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
}

module.exports = TimeService;
