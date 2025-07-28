/**
 * Semantic Adapter - SemanticService 和 Slot Template System 的介面適配器
 * 
 * 職責:
 * - 提供向後兼容的 API 介面
 * - 管理新舊系統之間的切換
 * - 處理功能開關和部署策略
 * - 確保系統穩定性和降級處理
 */

const SemanticService = require('../services/semanticService');

class SemanticAdapter {
  constructor() {
    // 功能開關配置
    this.config = {
      enableSlotTemplate: process.env.ENABLE_SLOT_TEMPLATE === 'true' || false,
      fallbackOnError: true,
      maxRetries: 2,
      enableABTesting: process.env.ENABLE_AB_TESTING === 'true' || false,
      abTestingRatio: parseFloat(process.env.AB_TESTING_RATIO || '0.1') // 10% 用戶使用新系統
    };
    
    // 創建 SemanticService 實例 (支援 Slot Template)
    this.semanticServiceInstance = null;
    try {
      if (this.config.enableSlotTemplate && SemanticService.isSlotTemplateAvailable()) {
        this.semanticServiceInstance = SemanticService.createWithSlotTemplate();
        console.log('[SemanticAdapter] Slot Template System 已啟用');
      }
    } catch (error) {
      console.warn('[SemanticAdapter] Slot Template System 初始化失敗:', error.message);
    }
    
    // 統計資訊
    this.stats = {
      totalRequests: 0,
      slotTemplateRequests: 0,
      fallbackRequests: 0,
      errorRequests: 0,
      startTime: Date.now()
    };
  }

  /**
   * 統一的語意分析入口點 - 自動選擇使用舊系統或新系統
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 語義分析結果
   */
  async analyzeMessage(text, userId, context = {}, options = {}) {
    this.stats.totalRequests++;
    
    const requestOptions = {
      forceSlotTemplate: options.forceSlotTemplate || false,
      forceClassic: options.forceClassic || false,
      ...options
    };
    
    // 決定使用哪個系統
    const shouldUseSlotTemplate = this.shouldUseSlotTemplate(userId, requestOptions);
    
    if (shouldUseSlotTemplate && this.semanticServiceInstance) {
      return await this.analyzeWithSlotTemplate(text, userId, context, requestOptions);
    } else {
      return await this.analyzeWithClassicSystem(text, userId, context, requestOptions);
    }
  }

  /**
   * 使用 Slot Template System 進行分析
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 語義分析結果
   */
  async analyzeWithSlotTemplate(text, userId, context, options) {
    this.stats.slotTemplateRequests++;
    
    let retryCount = 0;
    while (retryCount < this.config.maxRetries) {
      try {
        console.log(`[SemanticAdapter] 使用 Slot Template System - 用戶: ${userId}, 嘗試: ${retryCount + 1}`);
        
        const result = await this.semanticServiceInstance.analyzeMessageWithSlotTemplate(
          text, 
          userId, 
          context, 
          options
        );
        
        // 增強結果以包含系統資訊
        return {
          ...result,
          systemUsed: 'slot_template',
          adapterVersion: '1.0.0',
          processingTime: this.calculateProcessingTime(),
          retryCount
        };
        
      } catch (error) {
        retryCount++;
        console.warn(`[SemanticAdapter] Slot Template 處理失敗 (嘗試 ${retryCount}/${this.config.maxRetries}):`, error.message);
        
        if (retryCount >= this.config.maxRetries) {
          if (this.config.fallbackOnError) {
            console.log(`[SemanticAdapter] 回退到經典系統 - 用戶: ${userId}`);
            return await this.analyzeWithClassicSystem(text, userId, context, { 
              ...options, 
              fallbackReason: 'slot_template_error',
              originalError: error.message 
            });
          } else {
            throw error;
          }
        }
        
        // 短暫延遲後重試
        await this.sleep(500 * retryCount);
      }
    }
  }

  /**
   * 使用經典系統進行分析
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 語義分析結果
   */
  async analyzeWithClassicSystem(text, userId, context, options) {
    if (options.fallbackReason) {
      this.stats.fallbackRequests++;
    }
    
    try {
      console.log(`[SemanticAdapter] 使用經典系統 - 用戶: ${userId}`);
      
      const result = await SemanticService.analyzeMessage(text, userId, context);
      
      return {
        ...result,
        systemUsed: 'classic',
        adapterVersion: '1.0.0',
        processingTime: this.calculateProcessingTime(),
        fallbackReason: options.fallbackReason || null,
        originalError: options.originalError || null
      };
      
    } catch (error) {
      this.stats.errorRequests++;
      console.error(`[SemanticAdapter] 經典系統也失敗了:`, error);
      throw error;
    }
  }

  /**
   * 決定是否使用 Slot Template System
   * @param {string} userId - 用戶ID
   * @param {Object} options - 選項
   * @returns {boolean} 是否使用 Slot Template System
   */
  shouldUseSlotTemplate(userId, options) {
    // 強制選項
    if (options.forceSlotTemplate) return true;
    if (options.forceClassic) return false;
    
    // 檢查系統是否啟用
    if (!this.config.enableSlotTemplate || !this.semanticServiceInstance) {
      return false;
    }
    
    // A/B Testing 邏輯
    if (this.config.enableABTesting) {
      const userHash = this.hashUserId(userId);
      return userHash < this.config.abTestingRatio;
    }
    
    // 預設啟用 Slot Template System
    return true;
  }

  /**
   * 為用戶ID生成雜湊值 (用於 A/B Testing)
   * @param {string} userId - 用戶ID
   * @returns {number} 0-1 之間的雜湊值
   */
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉換為 32-bit 整數
    }
    return Math.abs(hash % 1000) / 1000; // 返回 0-1 之間的值
  }

  /**
   * 計算處理時間
   * @returns {number} 處理時間 (毫秒)
   */
  calculateProcessingTime() {
    return Date.now() - this.requestStartTime;
  }

  /**
   * 睡眠函數
   * @param {number} ms - 睡眠時間 (毫秒)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 獲取適配器統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    const runtime = Date.now() - this.stats.startTime;
    const slotTemplateRatio = this.stats.totalRequests > 0 
      ? this.stats.slotTemplateRequests / this.stats.totalRequests 
      : 0;
    const fallbackRatio = this.stats.totalRequests > 0 
      ? this.stats.fallbackRequests / this.stats.totalRequests 
      : 0;
    const errorRate = this.stats.totalRequests > 0 
      ? this.stats.errorRequests / this.stats.totalRequests 
      : 0;

    return {
      ...this.stats,
      runtime,
      slotTemplateRatio: Math.round(slotTemplateRatio * 100) / 100,
      fallbackRatio: Math.round(fallbackRatio * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      config: this.config,
      slotTemplateStatus: SemanticService.getSlotTemplateStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      slotTemplateRequests: 0,
      fallbackRequests: 0,
      errorRequests: 0,
      startTime: Date.now()
    };
    console.log('[SemanticAdapter] 統計資訊已重置');
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[SemanticAdapter] 配置已更新:', this.config);
  }

  /**
   * 健康檢查
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      adapter: { status: 'healthy' },
      classicSystem: { status: 'unknown' },
      slotTemplateSystem: { status: 'unknown' },
      timestamp: new Date().toISOString()
    };

    try {
      // 檢查經典系統
      const classicTest = await SemanticService.analyzeMessage('測試', 'health_check_user', {});
      health.classicSystem = {
        status: classicTest.success ? 'healthy' : 'degraded',
        confidence: classicTest.confidence || 0
      };
    } catch (error) {
      health.classicSystem = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    try {
      // 檢查 Slot Template 系統
      if (this.semanticServiceInstance) {
        const slotTemplateTest = await this.semanticServiceInstance.analyzeMessageWithSlotTemplate(
          '測試', 'health_check_user', {}, { enableSlotTemplate: true }
        );
        health.slotTemplateSystem = {
          status: slotTemplateTest.success ? 'healthy' : 'degraded',
          usedSlotTemplate: slotTemplateTest.usedSlotTemplate || false
        };
      } else {
        health.slotTemplateSystem = {
          status: 'disabled',
          reason: 'Slot Template System not initialized'
        };
      }
    } catch (error) {
      health.slotTemplateSystem = {
        status: 'unhealthy',
        error: error.message
      };
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }

    return health;
  }

  /**
   * 創建適配器實例的靜態工廠方法
   * @param {Object} config - 配置選項
   * @returns {SemanticAdapter} 適配器實例
   */
  static createAdapter(config = {}) {
    const adapter = new SemanticAdapter();
    if (Object.keys(config).length > 0) {
      adapter.updateConfig(config);
    }
    return adapter;
  }
}

module.exports = SemanticAdapter;