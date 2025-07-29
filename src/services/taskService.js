/**
 * TaskService - 任務執行協調層（重構為Scenario Layer架構）
 * 職責：協調單一場景模板的業務邏輯執行
 * 架構變更：從直接處理業務邏輯改為委託給場景模板
 * 設計原則：
 * - 啟動時載入單一場景，不支持動態切換
 * - 純協調邏輯，所有業務邏輯委託給場景模板
 * - 保持向後兼容的介面
 */

const ScenarioManager = require('../scenario/ScenarioManager');

class TaskService {
  constructor() {
    // ⚡ 性能優化：使用預加載的當前場景實例
    try {
      this.scenarioTemplate = ScenarioManager.getCurrentScenario();
      const scenarioType = this.scenarioTemplate.getScenarioName();
      // 🎯 優化：簡化初始化日誌，一行即可
      console.log(`✅ [TaskService] Initialized: ${scenarioType} (${this.scenarioTemplate.getEntityType()})`);
    } catch (error) {
      console.error(`❌ [TaskService] Initialization failed: ${error.message}`);
      throw new Error(`TaskService initialization failed: ${error.message}`);
    }
  }

  /**
   * 統一任務執行入口 - 委託給場景模板
   * @param {string} intent - 用戶意圖
   * @param {Object} entities - 實體信息（使用新契約：entities.timeInfo）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async executeIntent(intent, entities, userId) {
    // 🎯 優化：簡化參數日誌，只在 debug 模式顯示詳細信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [TaskService] ${intent} - User: ${userId}`);
    }

    if (!intent || !userId) {
      return {
        success: false,
        error: 'Missing required parameters',
        message: '缺少必要的參數信息',
      };
    }

    try {
      // 🎯 優化：直接委託，無需逐步記錄日誌
      switch (intent) {
        case 'record_course':
          return await this.scenarioTemplate.createEntity(entities, userId);

        case 'create_recurring_course':
          return await this.scenarioTemplate.createRecurringEntity(entities, userId);

        case 'modify_course':
          return await this.scenarioTemplate.modifyEntity(entities, userId);

        case 'modify_recurring_course':
          return await this.scenarioTemplate.modifyRecurringEntity(entities, userId);

        case 'cancel_course':
          return await this.scenarioTemplate.cancelEntity(entities, userId);

        case 'stop_recurring_course':
          return await this.scenarioTemplate.stopRecurringEntity(entities, userId);

        case 'query_schedule':
          return await this.scenarioTemplate.queryEntities(userId);

        case 'clear_schedule':
          return await this.scenarioTemplate.clearAllEntities(entities, userId);

        case 'set_reminder':
          return {
            success: false,
            error: 'Feature not implemented',
            message: '此功能將在後續版本中實現',
          };

        default:
          return {
            success: false,
            error: 'Unknown intent',
            message: '抱歉，我無法理解您的需求，請重新描述',
          };
      }
    } catch (error) {
      // 🎯 優化：簡化錯誤日誌
      console.error(`❌ [TaskService] ${intent} failed:`, error.message);
      return {
        success: false,
        error: error.message,
        message: '處理請求時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 獲取當前場景模板信息
   * @returns {Object} 場景模板信息
   */
  getScenarioInfo() {
    if (!this.scenarioTemplate) {
      return null;
    }

    return {
      scenarioName: this.scenarioTemplate.getScenarioName(),
      entityType: this.scenarioTemplate.getEntityType(),
      entityName: this.scenarioTemplate.getEntityName(),
      config: this.scenarioTemplate.getConfig()
    };
  }

  /**
   * 驗證場景模板是否正確初始化
   * @returns {boolean} 是否已正確初始化
   */
  isInitialized() {
    return !!this.scenarioTemplate;
  }

  /**
   * 獲取場景配置
   * @returns {Object} 場景配置
   */
  getScenarioConfig() {
    return this.scenarioTemplate ? this.scenarioTemplate.getConfig() : null;
  }

  /**
   * 驗證任務執行參數（保持向後兼容）
   * @param {string} intent - 意圖
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Object} 驗證結果 { valid, error }
   */
  validateExecutionParams(intent, entities, userId) {
    if (!intent) {
      return {
        valid: false,
        error: 'Intent is required',
      };
    }

    if (!userId) {
      return {
        valid: false,
        error: 'User ID is required',
      };
    }

    if (!entities || typeof entities !== 'object') {
      return {
        valid: false,
        error: 'Entities must be an object',
      };
    }

    // 委託給場景模板進行特定驗證
    if (this.scenarioTemplate) {
      try {
        const validation = this.scenarioTemplate.validateRequiredFields(entities);
        if (!validation.isValid) {
          return {
            valid: false,
            error: `Missing required fields: ${validation.missingFields.join(', ')}`,
          };
        }
      } catch (error) {
        console.warn('[TaskService] Scenario validation failed:', error.message);
        // 不阻斷流程，讓場景模板自己處理
      }
    }

    return {
      valid: true,
    };
  }

  /**
   * 靜態工廠方法 - 創建TaskService實例
   * @param {string} scenarioType - 場景類型（可選，默認從環境變數讀取）
   * @returns {TaskService} TaskService實例
   */
  static createInstance(scenarioType = null) {
    // 暫時設置環境變數（如果提供了參數）
    const originalScenarioType = process.env.SCENARIO_TYPE;
    if (scenarioType) {
      process.env.SCENARIO_TYPE = scenarioType;
    }

    try {
      const instance = new TaskService();
      return instance;
    } finally {
      // 恢復原始環境變數
      if (scenarioType && originalScenarioType !== undefined) {
        process.env.SCENARIO_TYPE = originalScenarioType;
      }
    }
  }
}

module.exports = TaskService;