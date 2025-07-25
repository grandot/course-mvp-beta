/**
 * LINE Service - LINE Bot 統一服務層
 * 職責：LINE Bot 相關業務邏輯統一入口
 * 架構：統一服務層，內部協調 internal/lineService
 */
const InternalLineService = require('../internal/lineService');

class LineService {
  /**
   * 發送回覆訊息給 LINE 用戶
   * @param {string} replyToken - LINE reply token
   * @param {Object|Array|string} messages - 要發送的訊息
   * @return {Promise<Object>} 發送結果
   */
  static async replyMessage(replyToken, messages) {
    return InternalLineService.replyMessage(replyToken, messages);
  }

  /**
   * 格式化課程查詢結果為 LINE 訊息
   * @param {Array} courses - 課程陣列
   * @param {string} intent - 意圖類型
   * @return {string} 格式化的回覆訊息
   */
  static formatCourseResponse(courses, intent) {
    return InternalLineService.formatCourseResponse(courses, intent);
  }
}

module.exports = LineService;
