/**
 * ScenarioTemplate - 場景模板抽象基類
 * 職責：定義統一的場景介面，讓各種業務場景都有相同的操作模式
 * 設計原則：
 * - 抽象方法強制子類實現業務邏輯
 * - 通用方法提供共用功能
 * - 配置驅動的訊息格式化
 * 
 * TODO: 技術債 - 當前實現主要是Service調用協調層
 * 未來場景切換需求時應重構為包含真正業務規則邏輯
 */

class ScenarioTemplate {
  constructor(config) {
    if (!config) {
      throw new Error('ScenarioTemplate: config is required');
    }

    this.config = config;
    this.entityType = config.entity_type;
    this.entityName = config.entity_name;
    this.scenarioName = config.scenario_name;

    // 驗證必要配置
    this.validateConfig();
  }

  /**
   * 驗證配置完整性
   */
  validateConfig() {
    const requiredFields = ['scenario_name', 'entity_type', 'entity_name', 'messages'];
    
    for (const field of requiredFields) {
      if (!this.config[field]) {
        throw new Error(`ScenarioTemplate: Missing required config field: ${field}`);
      }
    }

    if (!this.config.messages || typeof this.config.messages !== 'object') {
      throw new Error('ScenarioTemplate: messages must be an object');
    }
  }

  // ==================== 抽象方法 - 子類必須實現 ====================

  /**
   * 創建實體
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 創建結果 { success, message, data? }
   */
  async createEntity(entities, userId) {
    throw new Error('ScenarioTemplate.createEntity must be implemented by subclass');
  }

  /**
   * 修改實體
   * @param {Object} entities - 從語義分析提取的實體信息（包含要修改的內容）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果 { success, message, data? }
   */
  async modifyEntity(entities, userId) {
    throw new Error('ScenarioTemplate.modifyEntity must be implemented by subclass');
  }

  /**
   * 取消實體
   * @param {Object} entities - 從語義分析提取的實體信息（包含要取消的實體標識）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 取消結果 { success, message, data? }
   */
  async cancelEntity(entities, userId) {
    throw new Error('ScenarioTemplate.cancelEntity must be implemented by subclass');
  }

  /**
   * 查詢實體列表
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 查詢結果 { success, message?, data }
   */
  async queryEntities(userId) {
    throw new Error('ScenarioTemplate.queryEntities must be implemented by subclass');
  }

  /**
   * 清空所有實體
   * @param {Object} entities - 從語義分析提取的實體信息（包含確認信息）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 清空結果 { success, message, action?, data? }
   */
  async clearAllEntities(entities, userId) {
    throw new Error('ScenarioTemplate.clearAllEntities must be implemented by subclass');
  }

  // ==================== 通用方法 - 子類可直接使用 ====================

  /**
   * 獲取場景配置
   * @returns {Object} 完整配置對象
   */
  getConfig() {
    return this.config;
  }

  /**
   * 獲取實體類型（資料庫集合名稱）
   * @returns {string} 實體類型
   */
  getEntityType() {
    return this.entityType;
  }

  /**
   * 獲取實體顯示名稱
   * @returns {string} 實體顯示名稱
   */
  getEntityName() {
    return this.entityName;
  }

  /**
   * 獲取場景名稱
   * @returns {string} 場景名稱
   */
  getScenarioName() {
    return this.scenarioName;
  }

  /**
   * 格式化訊息模板
   * @param {string} template - 訊息模板，支援 {key} 格式的變數替換
   * @param {Object} data - 要替換的變數數據
   * @returns {string} 格式化後的訊息
   * 
   * @example
   * formatMessage("✅ {entity_name}「{name}」已成功新增！", {
   *   entity_name: "課程",
   *   name: "數學課"
   * })
   * // 返回: "✅ 課程「數學課」已成功新增！"
   */
  formatMessage(template, data) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    if (!data || typeof data !== 'object') {
      return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  /**
   * 獲取配置中的訊息模板
   * @param {string} messageKey - 訊息鍵名
   * @returns {string} 訊息模板
   */
  getMessageTemplate(messageKey) {
    const message = this.config.messages[messageKey];
    if (!message) {
      console.warn(`ScenarioTemplate: Message template not found: ${messageKey}`);
      return `[Missing message: ${messageKey}]`;
    }
    return message;
  }

  /**
   * 格式化配置中的訊息
   * @param {string} messageKey - 訊息鍵名
   * @param {Object} data - 要替換的變數數據
   * @returns {string} 格式化後的訊息
   */
  formatConfigMessage(messageKey, data = {}) {
    const template = this.getMessageTemplate(messageKey);
    
    // 自動添加常用變數
    const enrichedData = {
      entity_name: this.entityName,
      scenario_name: this.scenarioName,
      ...data
    };

    return this.formatMessage(template, enrichedData);
  }

  /**
   * 驗證必要欄位
   * @param {Object} entities - 實體數據
   * @param {Array<string>} requiredFields - 必要欄位列表
   * @returns {Object} 驗證結果 { isValid, missingFields }
   */
  validateRequiredFields(entities, requiredFields = null) {
    const fieldsToCheck = requiredFields || this.config.required_fields || [];
    const missingFields = [];

    for (const field of fieldsToCheck) {
      if (!entities || !entities[field]) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * 建立標準錯誤回應
   * @param {string} error - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Object} additionalData - 額外數據
   * @returns {Object} 標準錯誤回應
   */
  createErrorResponse(error, message, additionalData = {}) {
    return {
      success: false,
      error,
      message,
      ...additionalData
    };
  }

  /**
   * 建立標準成功回應
   * @param {string} message - 成功訊息
   * @param {Object} data - 回應數據
   * @returns {Object} 標準成功回應
   */
  createSuccessResponse(message, data = {}) {
    return {
      success: true,
      message,
      ...data
    };
  }

  /**
   * 日誌輸出（場景相關）
   * @param {string} level - 日誌等級 (info, warn, error)
   * @param {string} message - 日誌訊息
   * @param {Object} data - 額外數據
   */
  log(level, message, data = null) {
    const logMessage = `[${this.scenarioName}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data ? JSON.stringify(data) : '');
        break;
      case 'warn':
        console.warn(logMessage, data ? JSON.stringify(data) : '');
        break;
      case 'error':
        console.error(logMessage, data ? JSON.stringify(data) : '');
        break;
      default:
        console.log(logMessage, data ? JSON.stringify(data) : '');
    }
  }
}

module.exports = ScenarioTemplate;