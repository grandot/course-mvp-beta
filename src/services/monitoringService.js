/**
 * 🎯 Task 3.5: 全面監控系統服務
 * 負責收集、分析和監控語義處理系統的各項指標
 * 
 * 監控範圍：
 * - Token使用量和成本分析
 * - 準確率和性能監控
 * - 緩存命中率和響應時間
 * - 異常檢測和自動告警
 * - 趨勢分析和預測
 */

const fs = require('fs');
const path = require('path');

class MonitoringService {
  constructor() {
    // 🎯 Task 3.5: 監控指標初始化
    this.metrics = {
      // Token和成本相關指標
      token_usage: {
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_estimate: 0,
        requests_count: 0,
        average_tokens_per_request: 0
      },
      
      // 準確率指標
      accuracy: {
        total_requests: 0,
        successful_intents: 0,
        unknown_intents: 0,
        accuracy_rate: 0,
        confidence_scores: []
      },
      
      // 性能指標
      performance: {
        response_times: [],
        average_response_time: 0,
        cache_hit_rate: 0,
        normalizer_performance: 0,
        throughput: 0
      },
      
      // Entity質量指標
      entity_quality: {
        total_entities_extracted: 0,
        valid_entities: 0,
        quality_score: 0,
        entity_types: {}
      },
      
      // 系統資源使用
      system_resources: {
        memory_usage: 0,
        cpu_usage: 0,
        cache_size: 0,
        active_connections: 0
      }
    };
    
    // 🎯 Task 3.5: 歷史數據存儲
    this.historicalData = [];
    this.alertThresholds = this.initializeAlertThresholds();
    this.trends = {
      token_usage_trend: [],
      accuracy_trend: [],
      performance_trend: []
    };
    
    // 🎯 Task 3.5: 告警狀態追蹤
    this.alertStatus = {
      active_alerts: [],
      alert_history: [],
      last_alert_time: null
    };
    
    console.log('[MonitoringService] 全面監控系統已初始化');
  }

  /**
   * 🎯 Task 3.5: 初始化告警閾值
   * @private
   */
  initializeAlertThresholds() {
    return {
      accuracy_drop: 0.05,           // 準確率下降超過5%
      response_time_increase: 0.50,  // 響應時間增加超過50%
      cost_spike: 1.5,               // 成本異常增長150%
      cache_hit_rate_drop: 0.20,     // 緩存命中率下降超過20%
      memory_usage_high: 0.85,       // 內存使用率超過85%
      error_rate_high: 0.10          // 錯誤率超過10%
    };
  }

  /**
   * 🎯 Task 3.5: 記錄Token使用情況
   * @param {Object} tokenData - Token使用數據
   */
  recordTokenUsage(tokenData) {
    const { prompt_tokens, completion_tokens, model = 'gpt-3.5-turbo' } = tokenData;
    const total_tokens = prompt_tokens + completion_tokens;
    
    // 更新Token統計
    this.metrics.token_usage.total_tokens += total_tokens;
    this.metrics.token_usage.prompt_tokens += prompt_tokens;
    this.metrics.token_usage.completion_tokens += completion_tokens;
    this.metrics.token_usage.requests_count += 1;
    
    // 計算平均Token使用量
    this.metrics.token_usage.average_tokens_per_request = 
      this.metrics.token_usage.total_tokens / this.metrics.token_usage.requests_count;
    
    // 估算成本 (基於OpenAI定價)
    const cost = this.calculateTokenCost(total_tokens, model);
    this.metrics.token_usage.cost_estimate += cost;
    
    // 記錄趨勢數據
    this.trends.token_usage_trend.push({
      timestamp: Date.now(),
      tokens: total_tokens,
      cost: cost,
      model: model
    });
    
    // 保持趨勢數據在合理範圍內 (最近100條記錄)
    if (this.trends.token_usage_trend.length > 100) {
      this.trends.token_usage_trend.shift();
    }
    
    console.log(`[MonitoringService] Token使用記錄: ${total_tokens} tokens, 估算成本: $${cost.toFixed(4)}`);
  }

  /**
   * 🎯 Task 3.5: 計算Token成本
   * @param {number} tokens - Token數量
   * @param {string} model - 模型名稱
   * @returns {number} 成本估算
   * @private
   */
  calculateTokenCost(tokens, model) {
    // OpenAI定價 (2025年估算)
    const pricing = {
      'gpt-3.5-turbo': 0.002 / 1000,    // $0.002 per 1K tokens
      'gpt-4': 0.03 / 1000,             // $0.03 per 1K tokens
      'gpt-4-turbo': 0.01 / 1000        // $0.01 per 1K tokens
    };
    
    const rate = pricing[model] || pricing['gpt-3.5-turbo'];
    return tokens * rate;
  }

  /**
   * 🎯 Task 3.5: 記錄準確率指標
   * @param {Object} accuracyData - 準確率數據
   */
  recordAccuracy(accuracyData) {
    const { intent, confidence, is_successful } = accuracyData;
    
    this.metrics.accuracy.total_requests += 1;
    
    if (is_successful && intent !== 'unknown') {
      this.metrics.accuracy.successful_intents += 1;
    } else {
      this.metrics.accuracy.unknown_intents += 1;
    }
    
    // 記錄信心度分數
    if (confidence !== undefined) {
      this.metrics.accuracy.confidence_scores.push(confidence);
      
      // 保持信心度記錄在合理範圍內
      if (this.metrics.accuracy.confidence_scores.length > 1000) {
        this.metrics.accuracy.confidence_scores.shift();
      }
    }
    
    // 計算準確率
    this.metrics.accuracy.accuracy_rate = 
      this.metrics.accuracy.successful_intents / this.metrics.accuracy.total_requests;
    
    // 記錄趨勢數據
    this.trends.accuracy_trend.push({
      timestamp: Date.now(),
      accuracy_rate: this.metrics.accuracy.accuracy_rate,
      confidence: confidence || 0
    });
    
    if (this.trends.accuracy_trend.length > 100) {
      this.trends.accuracy_trend.shift();
    }
    
    // 檢查準確率告警
    this.checkAccuracyAlert();
  }

  /**
   * 🎯 Task 3.5: 記錄性能指標
   * @param {Object} performanceData - 性能數據
   */
  recordPerformance(performanceData) {
    const { 
      response_time, 
      cache_hit_rate, 
      normalizer_time,
      cache_size,
      throughput 
    } = performanceData;
    
    // 記錄響應時間
    if (response_time !== undefined) {
      this.metrics.performance.response_times.push(response_time);
      
      // 保持響應時間記錄在合理範圍內
      if (this.metrics.performance.response_times.length > 1000) {
        this.metrics.performance.response_times.shift();
      }
      
      // 計算平均響應時間
      this.metrics.performance.average_response_time = 
        this.metrics.performance.response_times.reduce((a, b) => a + b, 0) / 
        this.metrics.performance.response_times.length;
    }
    
    // 更新其他性能指標
    if (cache_hit_rate !== undefined) {
      this.metrics.performance.cache_hit_rate = cache_hit_rate;
    }
    
    if (normalizer_time !== undefined) {
      this.metrics.performance.normalizer_performance = normalizer_time;
    }
    
    if (cache_size !== undefined) {
      this.metrics.system_resources.cache_size = cache_size;
    }
    
    if (throughput !== undefined) {
      this.metrics.performance.throughput = throughput;
    }
    
    // 記錄性能趨勢
    this.trends.performance_trend.push({
      timestamp: Date.now(),
      response_time: response_time || 0,
      cache_hit_rate: cache_hit_rate || 0,
      throughput: throughput || 0
    });
    
    if (this.trends.performance_trend.length > 100) {
      this.trends.performance_trend.shift();
    }
    
    // 檢查性能告警
    this.checkPerformanceAlert();
  }

  /**
   * 🎯 Task 3.5: 記錄Entity質量指標
   * @param {Object} entityData - Entity數據
   */
  recordEntityQuality(entityData) {
    const { entities, valid_count, entity_types } = entityData;
    
    if (entities && typeof entities === 'object') {
      const entityCount = Object.keys(entities).length;
      this.metrics.entity_quality.total_entities_extracted += entityCount;
      this.metrics.entity_quality.valid_entities += valid_count || entityCount;
      
      // 統計Entity類型
      if (entity_types) {
        for (const [type, count] of Object.entries(entity_types)) {
          this.metrics.entity_quality.entity_types[type] = 
            (this.metrics.entity_quality.entity_types[type] || 0) + count;
        }
      }
      
      // 計算質量分數
      this.metrics.entity_quality.quality_score = 
        this.metrics.entity_quality.valid_entities / 
        this.metrics.entity_quality.total_entities_extracted;
    }
  }

  /**
   * 🎯 Task 3.5: 檢查準確率告警
   * @private
   */
  checkAccuracyAlert() {
    const currentAccuracy = this.metrics.accuracy.accuracy_rate;
    const recentTrend = this.trends.accuracy_trend.slice(-10);
    
    if (recentTrend.length >= 2) {
      const previousAccuracy = recentTrend[recentTrend.length - 2].accuracy_rate;
      const accuracyDrop = previousAccuracy - currentAccuracy;
      
      if (accuracyDrop > this.alertThresholds.accuracy_drop) {
        this.triggerAlert('accuracy_drop', {
          current_accuracy: currentAccuracy,
          previous_accuracy: previousAccuracy,
          drop_percentage: (accuracyDrop * 100).toFixed(2)
        });
      }
    }
  }

  /**
   * 🎯 Task 3.5: 檢查性能告警
   * @private
   */
  checkPerformanceAlert() {
    const currentResponseTime = this.metrics.performance.average_response_time;
    const recentTrend = this.trends.performance_trend.slice(-10);
    
    if (recentTrend.length >= 2) {
      const previousResponseTime = recentTrend[recentTrend.length - 2].response_time;
      const responseTimeIncrease = (currentResponseTime - previousResponseTime) / previousResponseTime;
      
      if (responseTimeIncrease > this.alertThresholds.response_time_increase) {
        this.triggerAlert('performance_degradation', {
          current_response_time: currentResponseTime,
          previous_response_time: previousResponseTime,
          increase_percentage: (responseTimeIncrease * 100).toFixed(2)
        });
      }
    }
    
    // 檢查緩存命中率
    const cacheHitRate = this.metrics.performance.cache_hit_rate;
    if (cacheHitRate < (1 - this.alertThresholds.cache_hit_rate_drop)) {
      this.triggerAlert('cache_hit_rate_drop', {
        current_hit_rate: (cacheHitRate * 100).toFixed(2),
        threshold: ((1 - this.alertThresholds.cache_hit_rate_drop) * 100).toFixed(2)
      });
    }
  }

  /**
   * 🎯 Task 3.5: 觸發告警
   * @param {string} alertType - 告警類型
   * @param {Object} alertData - 告警數據
   * @private
   */
  triggerAlert(alertType, alertData) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alertType,
      level: this.getAlertLevel(alertType),
      message: this.generateAlertMessage(alertType, alertData),
      data: alertData,
      timestamp: new Date().toISOString(),
      status: 'active'
    };
    
    // 檢查是否已有相同類型的活躍告警（避免重複告警）
    const existingAlert = this.alertStatus.active_alerts.find(a => a.type === alertType);
    if (!existingAlert) {
      this.alertStatus.active_alerts.push(alert);
      this.alertStatus.alert_history.push(alert);
      this.alertStatus.last_alert_time = Date.now();
      
      console.warn(`🚨 [MonitoringService] 告警觸發: ${alert.message}`);
      
      // 保持告警歷史在合理範圍內
      if (this.alertStatus.alert_history.length > 100) {
        this.alertStatus.alert_history.shift();
      }
    }
  }

  /**
   * 🎯 Task 3.5: 獲取告警級別
   * @param {string} alertType - 告警類型
   * @returns {string} 告警級別
   * @private
   */
  getAlertLevel(alertType) {
    const levels = {
      'accuracy_drop': 'high',
      'performance_degradation': 'medium',
      'cost_spike': 'high',
      'cache_hit_rate_drop': 'medium',
      'memory_usage_high': 'high',
      'error_rate_high': 'critical'
    };
    return levels[alertType] || 'low';
  }

  /**
   * 🎯 Task 3.5: 生成告警消息
   * @param {string} alertType - 告警類型
   * @param {Object} alertData - 告警數據
   * @returns {string} 告警消息
   * @private
   */
  generateAlertMessage(alertType, alertData) {
    const messages = {
      'accuracy_drop': `準確率下降警告: 從 ${alertData.previous_accuracy?.toFixed(2)} 降至 ${alertData.current_accuracy?.toFixed(2)} (下降 ${alertData.drop_percentage}%)`,
      'performance_degradation': `性能退化警告: 響應時間從 ${alertData.previous_response_time?.toFixed(2)}ms 增加至 ${alertData.current_response_time?.toFixed(2)}ms (增加 ${alertData.increase_percentage}%)`,
      'cost_spike': `成本異常增長警告: 成本使用量異常增加`,
      'cache_hit_rate_drop': `緩存命中率下降警告: 當前命中率 ${alertData.current_hit_rate}%, 低於閾值 ${alertData.threshold}%`,
      'memory_usage_high': `內存使用率過高警告`,
      'error_rate_high': `錯誤率過高警告`
    };
    return messages[alertType] || `未知告警類型: ${alertType}`;
  }

  /**
   * 🎯 Task 3.5: 獲取監控儀表板數據
   * @returns {Object} 儀表板數據
   */
  getDashboardData() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      trends: this.trends,
      alerts: this.alertStatus,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 🎯 Task 3.5: 生成監控摘要
   * @returns {Object} 監控摘要
   * @private
   */
  generateSummary() {
    const tokensPerDay = this.estimateTokensPerDay();
    const costPerDay = this.estimateCostPerDay();
    
    return {
      system_health: this.getSystemHealthStatus(),
      key_metrics: {
        total_requests: this.metrics.accuracy.total_requests,
        accuracy_rate: (this.metrics.accuracy.accuracy_rate * 100).toFixed(2) + '%', 
        average_response_time: (this.metrics.performance.average_response_time || 0).toFixed(2) + 'ms',
        cache_hit_rate: (this.metrics.performance.cache_hit_rate * 100).toFixed(2) + '%',
        total_cost: '$' + this.metrics.token_usage.cost_estimate.toFixed(4)
      },
      projections: {
        estimated_daily_tokens: tokensPerDay,
        estimated_daily_cost: '$' + costPerDay.toFixed(4),
        estimated_monthly_cost: '$' + (costPerDay * 30).toFixed(2)
      }
    };
  }

  /**
   * 🎯 Task 3.5: 估算每日Token使用量
   * @returns {number} 每日Token估算
   * @private
   */
  estimateTokensPerDay() {
    const recentTrend = this.trends.token_usage_trend.slice(-10);
    if (recentTrend.length < 2) return 0;
    
    const totalTokens = recentTrend.reduce((sum, entry) => sum + entry.tokens, 0);
    const timeSpan = recentTrend[recentTrend.length - 1].timestamp - recentTrend[0].timestamp;
    const tokensPerMs = totalTokens / timeSpan;
    
    return Math.round(tokensPerMs * 24 * 60 * 60 * 1000); // 每日估算
  }

  /**
   * 🎯 Task 3.5: 估算每日成本
   * @returns {number} 每日成本估算
   * @private
   */
  estimateCostPerDay() {
    const recentTrend = this.trends.token_usage_trend.slice(-10);
    if (recentTrend.length < 2) return 0;
    
    const totalCost = recentTrend.reduce((sum, entry) => sum + entry.cost, 0);
    const timeSpan = recentTrend[recentTrend.length - 1].timestamp - recentTrend[0].timestamp;
    const costPerMs = totalCost / timeSpan;
    
    return costPerMs * 24 * 60 * 60 * 1000; // 每日估算
  }

  /**
   * 🎯 Task 3.5: 獲取系統健康狀態
   * @returns {string} 健康狀態
   * @private
   */
  getSystemHealthStatus() {
    const activeAlertsCount = this.alertStatus.active_alerts.length;
    const accuracyRate = this.metrics.accuracy.accuracy_rate;
    const responseTime = this.metrics.performance.average_response_time;
    
    if (activeAlertsCount > 0) {
      const highSeverityAlerts = this.alertStatus.active_alerts.filter(
        alert => alert.level === 'critical' || alert.level === 'high'
      );
      if (highSeverityAlerts.length > 0) {
        return 'critical';
      }
      return 'warning';
    }
    
    if (accuracyRate < 0.8 || responseTime > 100) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * 🎯 Task 3.5: 生成優化建議
   * @returns {Array} 建議列表
   * @private
   */
  generateRecommendations() {
    const recommendations = [];
    
    // 準確率建議
    if (this.metrics.accuracy.accuracy_rate < 0.85) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        message: '建議檢查和優化Intent識別規則，當前準確率偏低',
        action: 'review_intent_rules'
      });
    }
    
    // 性能建議
    if (this.metrics.performance.average_response_time > 50) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: '建議優化緩存策略或增加預計算映射，響應時間較慢',
        action: 'optimize_caching'
      });
    }
    
    // 成本建議
    const dailyCostEstimate = this.estimateCostPerDay();
    if (dailyCostEstimate > 10) {
      recommendations.push({
        type: 'cost',
        priority: 'medium',
        message: '建議優化Prompt設計以減少Token使用量，成本較高',
        action: 'optimize_prompts'
      });
    }
    
    // 緩存建議
    if (this.metrics.performance.cache_hit_rate < 0.6) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        message: '建議增加預計算映射或調整緩存策略，命中率偏低',
        action: 'improve_cache_strategy'
      });
    }
    
    return recommendations;
  }

  /**
   * 🎯 Task 3.5: 清除過期告警
   * @param {number} maxAge - 最大年齡（毫秒）
   */
  clearExpiredAlerts(maxAge = 24 * 60 * 60 * 1000) { // 默認24小時
    const now = Date.now();
    this.alertStatus.active_alerts = this.alertStatus.active_alerts.filter(
      alert => (now - new Date(alert.timestamp).getTime()) < maxAge
    );
  }

  /**
   * 🎯 Task 3.5: 重置監控數據
   */
  resetMetrics() {
    // 保存當前數據到歷史記錄
    this.historicalData.push({
      timestamp: new Date().toISOString(),
      metrics: JSON.parse(JSON.stringify(this.metrics))
    });
    
    // 重置當前指標
    Object.keys(this.metrics).forEach(key => {
      if (typeof this.metrics[key] === 'object') {
        Object.keys(this.metrics[key]).forEach(subKey => {
          if (typeof this.metrics[key][subKey] === 'number') {
            this.metrics[key][subKey] = 0;
          } else if (Array.isArray(this.metrics[key][subKey])) {
            this.metrics[key][subKey] = [];
          }
        });
      }
    });
    
    console.log('[MonitoringService] 監控指標已重置');
  }

  /**
   * 🎯 Task 3.5: 導出監控報告
   * @param {string} format - 報告格式 ('json' | 'text')
   * @returns {string} 報告內容
   */
  exportReport(format = 'json') {
    const reportData = {
      report_time: new Date().toISOString(),
      dashboard_data: this.getDashboardData(),
      historical_data: this.historicalData.slice(-10), // 最近10條歷史記錄
      system_info: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version
      }
    };
    
    if (format === 'json') {
      return JSON.stringify(reportData, null, 2);
    } else if (format === 'text') {
      return this.generateTextReport(reportData);
    }
    
    return JSON.stringify(reportData);
  }

  /**
   * 🎯 Task 3.5: 生成文本格式報告
   * @param {Object} reportData - 報告數據
   * @returns {string} 文本報告
   * @private
   */
  generateTextReport(reportData) {
    const { dashboard_data } = reportData;
    const { metrics, summary } = dashboard_data;
    
    return `
=== 語義處理系統監控報告 ===
報告時間: ${reportData.report_time}

== 系統健康狀態 ==
健康狀態: ${summary.system_health}
活躍告警: ${dashboard_data.alerts.active_alerts.length} 個

== 關鍵指標 ==
總請求數: ${summary.key_metrics.total_requests}
準確率: ${summary.key_metrics.accuracy_rate}
平均響應時間: ${summary.key_metrics.average_response_time}
緩存命中率: ${summary.key_metrics.cache_hit_rate}
累計成本: ${summary.key_metrics.total_cost}

== Token使用統計 ==
總Token數: ${metrics.token_usage.total_tokens}
Prompt Tokens: ${metrics.token_usage.prompt_tokens}
Completion Tokens: ${metrics.token_usage.completion_tokens}
平均每請求Token數: ${metrics.token_usage.average_tokens_per_request.toFixed(2)}

== 成本預測 ==
預估日Token數: ${summary.projections.estimated_daily_tokens}
預估日成本: ${summary.projections.estimated_daily_cost}
預估月成本: ${summary.projections.estimated_monthly_cost}

== 活躍告警 ==
${dashboard_data.alerts.active_alerts.map(alert => 
  `- [${alert.level.toUpperCase()}] ${alert.message}`
).join('\n') || '無活躍告警'}

== 優化建議 ==
${dashboard_data.recommendations.map(rec => 
  `- [${rec.priority.toUpperCase()}] ${rec.message}`
).join('\n') || '系統運行良好，暫無建議'}
`;
  }
}

// 🎯 Task 3.5: 單例模式
let monitoringInstance = null;

function getMonitoringService() {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance;
}

module.exports = {
  MonitoringService,
  getMonitoringService
};