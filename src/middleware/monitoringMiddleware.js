/**
 * 🎯 Task 3.5: 監控中間件
 * 自動收集和記錄語義處理過程中的各項指標
 * 
 * 功能：
 * - 攔截和監控所有語義分析請求
 * - 自動記錄Token使用量和響應時間
 * - 追蹤準確率和Entity質量
 * - 集成緩存性能監控
 */

const { getMonitoringService } = require('../services/monitoringService');

class MonitoringMiddleware {
  constructor() {
    this.monitoringService = getMonitoringService();
    this.requestStartTimes = new Map();
    
    console.log('[MonitoringMiddleware] 監控中間件已初始化');
  }

  /**
   * 🎯 Task 3.5: 語義分析請求攔截器
   * 在請求開始時記錄起始時間和基本信息
   */
  beforeSemanticAnalysis(requestId, text, userId, options = {}) {
    const startTime = Date.now();
    this.requestStartTimes.set(requestId, startTime);
    
    // 記錄請求基本信息
    console.log(`[MonitoringMiddleware] 開始監控請求 ${requestId}: "${text.substring(0, 50)}..."`);
    
    return {
      requestId,
      startTime,
      text,
      userId,
      options
    };
  }

  /**
   * 🎯 Task 3.5: 語義分析結果處理器
   * 在請求完成後記錄所有相關指標
   */
  afterSemanticAnalysis(requestId, result, additionalData = {}) {
    const endTime = Date.now();
    const startTime = this.requestStartTimes.get(requestId);
    
    if (!startTime) {
      console.warn(`[MonitoringMiddleware] 找不到請求 ${requestId} 的開始時間`);
      return;
    }
    
    const responseTime = endTime - startTime;
    this.requestStartTimes.delete(requestId);
    
    try {
      // 🎯 記錄Token使用情況（如果有）
      if (additionalData.tokenUsage) {
        this.monitoringService.recordTokenUsage({
          prompt_tokens: additionalData.tokenUsage.prompt_tokens || 0,
          completion_tokens: additionalData.tokenUsage.completion_tokens || 0,
          model: additionalData.tokenUsage.model || 'gpt-3.5-turbo'
        });
      }
      
      // 🎯 記錄準確率指標
      this.monitoringService.recordAccuracy({
        intent: result.intent || result.final_intent || 'unknown',
        confidence: result.confidence || 0,
        is_successful: this.isSuccessfulResult(result)
      });
      
      // 🎯 記錄性能指標
      this.monitoringService.recordPerformance({
        response_time: responseTime,
        cache_hit_rate: additionalData.cacheHitRate,
        normalizer_time: additionalData.normalizerTime,
        cache_size: additionalData.cacheSize,
        throughput: this.calculateThroughput()
      });
      
      // 🎯 記錄Entity質量指標
      if (result.entities) {
        this.monitoringService.recordEntityQuality({
          entities: result.entities,
          valid_count: this.countValidEntities(result.entities),
          entity_types: this.categorizeEntityTypes(result.entities)
        });
      }
      
      console.log(`[MonitoringMiddleware] 完成監控請求 ${requestId}: ${responseTime}ms, Intent: ${result.intent || result.final_intent}`);
      
    } catch (error) {
      console.error(`[MonitoringMiddleware] 監控數據記錄失敗:`, error.message);
    }
  }

  /**
   * 🎯 Task 3.5: 判斷結果是否成功
   * @param {Object} result - 分析結果
   * @returns {boolean} 是否成功
   * @private
   */
  isSuccessfulResult(result) {
    const intent = result.intent || result.final_intent;
    const confidence = result.confidence || 0;
    
    // 成功標準：Intent不是unknown且信心度合理
    return intent !== 'unknown' && confidence > 0.3;
  }

  /**
   * 🎯 Task 3.5: 計算有效實體數量
   * @param {Object} entities - 實體對象
   * @returns {number} 有效實體數量
   * @private
   */
  countValidEntities(entities) {
    if (!entities || typeof entities !== 'object') return 0;
    
    let validCount = 0;
    for (const [key, value] of Object.entries(entities)) {
      // 檢查實體是否有效（非空、非null、非undefined）
      if (value !== null && value !== undefined && value !== '') {
        validCount++;
      }
    }
    
    return validCount;
  }

  /**
   * 🎯 Task 3.5: 分類實體類型
   * @param {Object} entities - 實體對象
   * @returns {Object} 實體類型統計
   * @private
   */
  categorizeEntityTypes(entities) {
    if (!entities || typeof entities !== 'object') return {};
    
    const entityTypes = {};
    
    for (const [key, value] of Object.entries(entities)) {
      if (value !== null && value !== undefined && value !== '') {
        // 基於鍵名分類實體類型
        let category = 'other';
        
        if (key.includes('course') || key.includes('課程')) {
          category = 'course';
        } else if (key.includes('student') || key.includes('學生')) {
          category = 'student';
        } else if (key.includes('time') || key.includes('時間')) {
          category = 'time';
        } else if (key.includes('date') || key.includes('日期')) {
          category = 'date';
        } else if (key.includes('teacher') || key.includes('老師')) {
          category = 'teacher';
        } else if (key.includes('location') || key.includes('地點')) {
          category = 'location';
        }
        
        entityTypes[category] = (entityTypes[category] || 0) + 1;
      }
    }
    
    return entityTypes;
  }

  /**
   * 🎯 Task 3.5: 計算吞吐量
   * @returns {number} 當前吞吐量 (RPS)
   * @private
   */
  calculateThroughput() {
    // 簡單的吞吐量計算：基於最近的請求數量
    const currentTime = Date.now();
    const recentRequests = Array.from(this.requestStartTimes.values()).filter(
      startTime => (currentTime - startTime) < 60000 // 最近1分鐘
    );
    
    return recentRequests.length / 60; // 每秒請求數
  }

  /**
   * 🎯 Task 3.5: OpenAI調用監控包裝器
   * 用於監控OpenAI API調用的Token使用情況
   */
  wrapOpenAICall(originalFunction, functionName) {
    return async (...args) => {
      const requestId = `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      try {
        const result = await originalFunction.apply(this, args);
        const endTime = Date.now();
        
        // 提取Token使用信息
        if (result && result.usage) {
          this.monitoringService.recordTokenUsage({
            prompt_tokens: result.usage.prompt_tokens,
            completion_tokens: result.usage.completion_tokens,
            model: args[0]?.model || 'gpt-3.5-turbo'
          });
        }
        
        console.log(`[MonitoringMiddleware] OpenAI調用監控 ${functionName}: ${endTime - startTime}ms`);
        
        return result;
      } catch (error) {
        console.error(`[MonitoringMiddleware] OpenAI調用失敗 ${functionName}:`, error.message);
        throw error;
      }
    };
  }

  /**
   * 🎯 Task 3.5: 緩存性能監控
   * 監控緩存命中率和響應時間
   */
  recordCachePerformance(cacheStats) {
    if (cacheStats) {
      this.monitoringService.recordPerformance({
        cache_hit_rate: cacheStats.hit_ratio || 0,
        cache_size: cacheStats.total_cache_size || 0,
        normalizer_time: cacheStats.avg_response_time || 0
      });
    }
  }

  /**
   * 🎯 Task 3.5: 批量監控數據記錄
   * 用於一次性記錄多個指標
   */
  recordBatchMetrics(metricsData) {
    const {
      tokenUsage,
      accuracy,
      performance,
      entityQuality
    } = metricsData;
    
    if (tokenUsage) {
      this.monitoringService.recordTokenUsage(tokenUsage);
    }
    
    if (accuracy) {
      this.monitoringService.recordAccuracy(accuracy);
    }
    
    if (performance) {
      this.monitoringService.recordPerformance(performance);
    }
    
    if (entityQuality) {
      this.monitoringService.recordEntityQuality(entityQuality);
    }
  }

  /**
   * 🎯 Task 3.5: 健康檢查監控
   * 定期檢查系統健康狀態
   */
  performHealthCheck() {
    const dashboardData = this.monitoringService.getDashboardData();
    const summary = dashboardData.summary;
    
    console.log(`[MonitoringMiddleware] 健康檢查: ${summary.system_health}`);
    console.log(`  - 總請求數: ${summary.key_metrics.total_requests}`);
    console.log(`  - 準確率: ${summary.key_metrics.accuracy_rate}`);
    console.log(`  - 平均響應時間: ${summary.key_metrics.average_response_time}`);
    console.log(`  - 緩存命中率: ${summary.key_metrics.cache_hit_rate}`);
    console.log(`  - 活躍告警: ${dashboardData.alerts.active_alerts.length} 個`);
    
    // 清理過期告警
    this.monitoringService.clearExpiredAlerts();
    
    return dashboardData;
  }

  /**
   * 🎯 Task 3.5: 獲取監控統計摘要
   * 提供簡化的監控數據用於快速查看
   */
  getMonitoringSummary() {
    const dashboardData = this.monitoringService.getDashboardData();
    return {
      timestamp: dashboardData.timestamp,
      system_health: dashboardData.summary.system_health,
      key_metrics: dashboardData.summary.key_metrics,
      active_alerts_count: dashboardData.alerts.active_alerts.length,
      recommendations_count: dashboardData.recommendations.length
    };
  }
}

// 🎯 Task 3.5: 單例模式
let middlewareInstance = null;

function getMonitoringMiddleware() {
  if (!middlewareInstance) {
    middlewareInstance = new MonitoringMiddleware();
  }
  return middlewareInstance;
}

module.exports = {
  MonitoringMiddleware,
  getMonitoringMiddleware
};