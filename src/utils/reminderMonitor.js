/**
 * 提醒執行器監控工具
 * 提供健康檢查、告警和觀測功能
 */

const { reminderExecutor } = require('../services/reminderExecutorService');

/**
 * 健康檢查配置
 */
const HEALTH_CONFIG = {
  // 警告閾值
  WARNING_THRESHOLDS: {
    ERROR_RATE: 0.1,        // 錯誤率 > 10%
    FAILED_RATE: 0.2,       // 失敗率 > 20%
    EXECUTION_TIME: 30000   // 執行時間 > 30秒
  },
  
  // 嚴重閾值
  CRITICAL_THRESHOLDS: {
    ERROR_RATE: 0.3,        // 錯誤率 > 30%
    FAILED_RATE: 0.5,       // 失敗率 > 50%
    EXECUTION_TIME: 60000   // 執行時間 > 60秒
  }
};

/**
 * 健康檢查器
 */
class ReminderHealthChecker {
  constructor() {
    this.lastCheckTime = null;
    this.alerts = [];
  }

  /**
   * 執行健康檢查
   */
  async checkHealth() {
    const now = new Date();
    const stats = reminderExecutor.getStats();
    const config = {
      enabled: reminderExecutor.isEnabled(),
      isRunning: reminderExecutor.isRunning
    };

    const health = {
      timestamp: now.toISOString(),
      status: 'healthy',
      level: 'info',
      stats,
      config,
      alerts: [],
      recommendations: []
    };

    // 檢查基礎狀態
    if (!config.enabled) {
      health.status = 'disabled';
      health.level = 'warning';
      health.alerts.push('提醒執行器已停用');
      health.recommendations.push('檢查 REMINDER_EXECUTOR_ENABLED 環境變數');
    }

    // 檢查執行統計
    if (stats.scanned > 0) {
      const errorRate = stats.errorCount / stats.scanned;
      const failedRate = stats.failed / stats.scanned;

      // 錯誤率檢查
      if (errorRate >= HEALTH_CONFIG.CRITICAL_THRESHOLDS.ERROR_RATE) {
        health.status = 'critical';
        health.level = 'error';
        health.alerts.push(`錯誤率過高: ${(errorRate * 100).toFixed(1)}%`);
        health.recommendations.push('檢查 Firebase 連接和索引設定');
      } else if (errorRate >= HEALTH_CONFIG.WARNING_THRESHOLDS.ERROR_RATE) {
        health.status = 'warning';
        health.level = 'warning';
        health.alerts.push(`錯誤率偏高: ${(errorRate * 100).toFixed(1)}%`);
      }

      // 失敗率檢查
      if (failedRate >= HEALTH_CONFIG.CRITICAL_THRESHOLDS.FAILED_RATE) {
        health.status = 'critical';
        health.level = 'error';
        health.alerts.push(`失敗率過高: ${(failedRate * 100).toFixed(1)}%`);
        health.recommendations.push('檢查 LINE API 設定和網路連接');
      } else if (failedRate >= HEALTH_CONFIG.WARNING_THRESHOLDS.FAILED_RATE) {
        health.status = 'warning';
        health.level = 'warning';
        health.alerts.push(`失敗率偏高: ${(failedRate * 100).toFixed(1)}%`);
      }

      // 執行時間檢查
      if (stats.duration >= HEALTH_CONFIG.CRITICAL_THRESHOLDS.EXECUTION_TIME) {
        health.status = 'critical';
        health.level = 'error';
        health.alerts.push(`執行時間過長: ${stats.duration}ms`);
        health.recommendations.push('檢查批次大小和資料庫查詢效能');
      } else if (stats.duration >= HEALTH_CONFIG.WARNING_THRESHOLDS.EXECUTION_TIME) {
        health.status = 'warning';
        health.level = 'warning';
        health.alerts.push(`執行時間偏長: ${stats.duration}ms`);
      }
    }

    // 更新檢查時間
    this.lastCheckTime = now;
    this.alerts = health.alerts.slice(); // 保存副本

    return health;
  }

  /**
   * 取得監控摘要
   */
  getMonitoringSummary() {
    return {
      lastCheckTime: this.lastCheckTime?.toISOString(),
      activeAlerts: this.alerts.length,
      alerts: this.alerts,
      healthCheckEnabled: true,
      monitoringVersion: '1.0.0'
    };
  }

  /**
   * 取得性能指標
   */
  getPerformanceMetrics() {
    const stats = reminderExecutor.getStats();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      throughput: {
        scanned: stats.scanned,
        sent: stats.sent,
        successRate: stats.scanned > 0 ? (stats.sent / stats.scanned) : 0
      },
      latency: {
        executionTime: stats.duration,
        avgTimePerReminder: stats.scanned > 0 ? (stats.duration / stats.scanned) : 0
      },
      errors: {
        errorCount: stats.errorCount,
        errorRate: stats.scanned > 0 ? (stats.errorCount / stats.scanned) : 0,
        recentErrors: stats.errors.slice(-3)
      },
      distribution: {
        sent: stats.sent,
        failed: stats.failed,
        expired: stats.expired,
        cancelled: stats.cancelled,
        skipped: stats.skipped
      }
    };

    return metrics;
  }
}

/**
 * 日誌格式化器
 */
class ReminderLogger {
  /**
   * 記錄執行結果
   */
  static logExecution(result) {
    const { summary, config } = result;
    const level = summary.errorCount > 0 ? 'WARN' : 'INFO';
    
    console.log(`[${level}] 提醒執行器完成:`);
    console.log(`  ⏱️  執行時間: ${summary.duration}ms`);
    console.log(`  📊 掃描: ${summary.scanned}, 發送: ${summary.sent}, 失敗: ${summary.failed}`);
    console.log(`  ⚠️  過期: ${summary.expired}, 取消: ${summary.cancelled}, 錯誤: ${summary.errorCount}`);
    
    if (summary.errorCount > 0) {
      console.log(`  ❌ 最近錯誤:`);
      summary.errors.forEach((error, index) => {
        console.log(`     ${index + 1}. ${error.message}`);
      });
    }
  }

  /**
   * 記錄健康檢查結果
   */
  static logHealthCheck(health) {
    const icon = health.level === 'error' ? '🚨' : health.level === 'warning' ? '⚠️' : '✅';
    
    console.log(`${icon} 提醒系統健康檢查: ${health.status.toUpperCase()}`);
    
    if (health.alerts.length > 0) {
      console.log(`  告警 (${health.alerts.length}):`);
      health.alerts.forEach((alert, index) => {
        console.log(`    ${index + 1}. ${alert}`);
      });
    }
    
    if (health.recommendations.length > 0) {
      console.log(`  建議:`);
      health.recommendations.forEach((rec, index) => {
        console.log(`    ${index + 1}. ${rec}`);
      });
    }
  }

  /**
   * 記錄性能指標
   */
  static logMetrics(metrics) {
    console.log('📈 提醒系統性能指標:');
    console.log(`  處理量: ${metrics.throughput.scanned} 筆, 成功率: ${(metrics.throughput.successRate * 100).toFixed(1)}%`);
    console.log(`  延遲: ${metrics.latency.executionTime}ms (平均 ${metrics.latency.avgTimePerReminder.toFixed(1)}ms/筆)`);
    console.log(`  錯誤率: ${(metrics.errors.errorRate * 100).toFixed(1)}%`);
  }
}

// 創建全域健康檢查器實例
const healthChecker = new ReminderHealthChecker();

module.exports = {
  ReminderHealthChecker,
  ReminderLogger,
  healthChecker,
  HEALTH_CONFIG
};