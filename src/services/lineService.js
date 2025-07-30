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
   * 獲取消息內容（圖片、音頻等）
   * @param {string} messageId - 消息ID
   * @returns {Promise<Object>} 消息內容
   */
  static async getMessageContent(messageId) {
    return InternalLineService.getMessageContent(messageId);
  }

  /**
   * 創建帶 Quick Reply 的文字消息
   * @param {string} text - 消息文字
   * @param {Array} quickReplyItems - Quick Reply 按鈕陣列
   * @returns {Object} LINE 消息對象
   */
  static createQuickReplyMessage(text, quickReplyItems) {
    return InternalLineService.createQuickReplyMessage(text, quickReplyItems);
  }

  /**
   * 創建 Quick Reply 按鈕
   * @param {string} label - 按鈕標籤
   * @param {string} text - 點擊後發送的文字
   * @returns {Object} Quick Reply 按鈕對象
   */
  static createQuickReplyButton(label, text) {
    return InternalLineService.createQuickReplyButton(label, text);
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
