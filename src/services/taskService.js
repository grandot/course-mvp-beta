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

        case 'query_schedule': {
          const options = this._calculateDateRange(entities);
          return await this.scenarioTemplate.queryEntities(userId, options);
        }

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
   * 計算查詢日期範圍
   * @param {Object} entities - 實體信息（包含 timeInfo）
   * @returns {Object} 日期範圍選項 { startDate, endDate }
   */
  _calculateDateRange(entities) {
    const TimeService = require('./timeService');
    
    // 🎯 輔助函數：統一創建返回對象（包含child_name支持）
    const createResult = (startDate, endDate) => {
      const result = { startDate, endDate };
      if (entities.child_name) {
        result.child_name = entities.child_name;
        console.log(`🔧 [DEBUG] _calculateDateRange - 檢測到學童過濾: ${entities.child_name}`);
      }
      return result;
    };
    
    // 獲取當前時間作為基準
    const today = TimeService.getCurrentUserTime();
    
    // 檢查是否為週查詢（無論是否有 timeInfo）
    // 🔧 修復：優先檢查原始用戶輸入，這是最準確的來源
    let checkText = '';
    
    // 嘗試從多個來源獲取原始文本或關鍵詞（按優先級排序）
    if (entities.originalUserInput) {
      checkText = entities.originalUserInput;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用原始用戶輸入: "${checkText}"`);
    } else if (entities.course_name) {
      checkText = entities.course_name;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 course_name: "${checkText}"`);
    } else if (entities.raw_text) {
      checkText = entities.raw_text;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 raw_text: "${checkText}"`);
    } else if (entities.timeInfo && entities.timeInfo.raw) {
      checkText = entities.timeInfo.raw;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 timeInfo.raw: "${checkText}"`);
    }
    
    // 檢查文本中的時間範圍關鍵詞
    // 🚨 關鍵修復：最具體的匹配條件必須放在前面，避免被包含匹配
    if (checkText) {
      // 🆕 月查詢處理 - 最高優先級
      if (checkText.includes('下下月')) {
        // 返回下下月的範圍
        const nextNextMonth = new Date(today);
        nextNextMonth.setMonth(nextNextMonth.getMonth() + 2);
        const startOfMonth = TimeService.getStartOfMonth(nextNextMonth);
        const endOfMonth = TimeService.getEndOfMonth(nextNextMonth);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下下月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      } else if (checkText.includes('下月')) {
        // 返回下月的範圍
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const startOfMonth = TimeService.getStartOfMonth(nextMonth);
        const endOfMonth = TimeService.getEndOfMonth(nextMonth);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      } else if (checkText.includes('本月') || checkText.includes('這個月') || checkText.includes('這月')) {
        // 返回本月的範圍
        const startOfMonth = TimeService.getStartOfMonth(today);
        const endOfMonth = TimeService.getEndOfMonth(today);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「本月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      }
      // 週查詢處理 - 次要優先級
      else if (checkText.includes('下下週') || checkText.includes('下下周')) {
        // 返回下下週的範圍 - 最具體的條件放在最前面
        const nextNextWeek = new Date(today);
        nextNextWeek.setDate(nextNextWeek.getDate() + 14);
        const startOfWeek = TimeService.getStartOfWeek(nextNextWeek);
        const endOfWeek = TimeService.getEndOfWeek(nextNextWeek);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下下週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      } else if (checkText.includes('下週') || checkText.includes('下周')) {
        // 返回下週的範圍 - 放在下下週之後
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const startOfWeek = TimeService.getStartOfWeek(nextWeek);
        const endOfWeek = TimeService.getEndOfWeek(nextWeek);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      } else if (checkText.includes('這週') || checkText.includes('這周') ||
          checkText.includes('本週') || checkText.includes('本周')) {
        // 返回這週的範圍
        const startOfWeek = TimeService.getStartOfWeek(today);
        const endOfWeek = TimeService.getEndOfWeek(today);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「這週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      }
    }
    
    // 如果有具體的時間信息，使用該時間信息計算範圍
    if (entities.timeInfo && entities.timeInfo.date) {
      const targetDate = new Date(entities.timeInfo.date);
      
      // 返回指定日期的範圍（當天）
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用具體日期，範圍: ${TimeService.formatForStorage(startOfDay)} 到 ${TimeService.formatForStorage(endOfDay)}`);
      return createResult(
        TimeService.formatForStorage(startOfDay),
        TimeService.formatForStorage(endOfDay)
      );
    }
    
    // 🎯 第一性原則：添加child_name過濾支持
    const result = {};
    
    // 從entities中提取child_name（如果存在）
    if (entities.child_name) {
      result.child_name = entities.child_name;
      console.log(`🔧 [DEBUG] _calculateDateRange - 檢測到學童過濾: ${entities.child_name}`);
    }
    
    // 默認返回（可能包含child_name，不限制時間範圍，使用場景模板的默認範圍）
    console.log(`🔧 [DEBUG] _calculateDateRange - 無法識別特定時間範圍，使用預設4週範圍`);
    return result;
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