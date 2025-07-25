/**
 * DataService - 數據處理統一入口
 * 職責：數據存取、查詢、格式化
 * 禁止：直接調用 Firebase
 */
class DataService {
  /**
   * 創建課程記錄
   * @param {Object} courseData - 課程數據
   * @returns {Promise<Object>} 創建結果
   */
  // eslint-disable-next-line no-unused-vars
  static async createCourse(courseData) {
    throw new Error('NotImplementedError: DataService.createCourse not implemented');
  }

  /**
   * 獲取用戶課程列表
   * @param {string} userId - 用戶ID
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 課程列表
   */
  // eslint-disable-next-line no-unused-vars
  static async getUserCourses(userId, filters = {}) {
    throw new Error('NotImplementedError: DataService.getUserCourses not implemented');
  }

  /**
   * 更新課程信息
   * @param {string} courseId - 課程ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  // eslint-disable-next-line no-unused-vars
  static async updateCourse(courseId, updateData) {
    throw new Error('NotImplementedError: DataService.updateCourse not implemented');
  }

  /**
   * 刪除課程記錄
   * @param {string} courseId - 課程ID
   * @returns {Promise<boolean>} 刪除是否成功
   */
  // eslint-disable-next-line no-unused-vars
  static async deleteCourse(courseId) {
    throw new Error('NotImplementedError: DataService.deleteCourse not implemented');
  }

  /**
   * 查詢課程記錄
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  // eslint-disable-next-line no-unused-vars
  static async queryCourses(criteria) {
    throw new Error('NotImplementedError: DataService.queryCourses not implemented');
  }

  /**
   * 記錄 token 使用量
   * @param {Object} usageData - 使用量數據
   * @returns {Promise<Object>} 記錄結果
   */
  // eslint-disable-next-line no-unused-vars
  static async recordTokenUsage(usageData) {
    throw new Error('NotImplementedError: DataService.recordTokenUsage not implemented');
  }

  /**
   * 驗證數據格式
   * @param {Object} data - 待驗證數據
   * @param {string} schema - 驗證模式
   * @returns {Promise<boolean>} 驗證結果
   */
  // eslint-disable-next-line no-unused-vars
  static async validateData(data, schema) {
    throw new Error('NotImplementedError: DataService.validateData not implemented');
  }
}

module.exports = DataService;
