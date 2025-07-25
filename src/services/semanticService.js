/**
 * SemanticService - 語義處理統一入口
 * 職責：意圖識別、實體提取、上下文分析
 * 禁止：直接調用 OpenAI/規則引擎
 */
class SemanticService {
  /**
   * 分析用戶訊息的整體語義
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 語義分析結果
   */
  // eslint-disable-next-line no-unused-vars
  static async analyzeMessage(text, userId, context = {}) {
    throw new Error('NotImplementedError: SemanticService.analyzeMessage not implemented');
  }

  /**
   * 提取課程相關實體信息
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 課程實體信息
   */
  // eslint-disable-next-line no-unused-vars
  static async extractCourseEntities(text, userId) {
    throw new Error('NotImplementedError: SemanticService.extractCourseEntities not implemented');
  }

  /**
   * 提取時間相關信息
   * @param {string} text - 用戶輸入文本
   * @returns {Promise<Object>} 時間信息
   */
  // eslint-disable-next-line no-unused-vars
  static async extractTimeInfo(text) {
    throw new Error('NotImplementedError: SemanticService.extractTimeInfo not implemented');
  }

  /**
   * 識別用戶意圖
   * @param {string} text - 用戶輸入文本
   * @param {Object} context - 上下文信息
   * @returns {Promise<string>} 意圖類型
   */
  // eslint-disable-next-line no-unused-vars
  static async identifyIntent(text, context = {}) {
    throw new Error('NotImplementedError: SemanticService.identifyIntent not implemented');
  }

  /**
   * 驗證語義分析結果
   * @param {Object} analysisResult - 分析結果
   * @returns {Promise<boolean>} 驗證是否通過
   */
  // eslint-disable-next-line no-unused-vars
  static async validateAnalysis(analysisResult) {
    throw new Error('NotImplementedError: SemanticService.validateAnalysis not implemented');
  }
}

module.exports = SemanticService;
