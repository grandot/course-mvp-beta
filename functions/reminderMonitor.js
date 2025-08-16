/* eslint-disable */
/**
 * 簡化版提醒系統監控（Functions 專用）
 */
const { reminderExecutor } = require('./reminderExecutorService');

class ReminderHealthChecker {
  constructor() { this.last = null; this.alerts = []; }

  async checkHealth() {
    const stats = reminderExecutor.getStats();
    const enabled = reminderExecutor.isEnabled();
    const health = {
      timestamp: new Date().toISOString(),
      status: enabled ? 'healthy' : 'disabled',
      level: enabled ? 'info' : 'warning',
      stats,
      alerts: [],
      recommendations: [],
    };
    if (!enabled) health.recommendations.push('設定 REMINDER_EXECUTOR_ENABLED=true');
    if (stats.errorCount > 0) { health.level = 'warning'; health.alerts.push('近期有錯誤'); }
    this.last = health; return health;
  }

  getMonitoringSummary() {
    return { lastCheckTime: this.last?.timestamp || null, activeAlerts: this.last?.alerts?.length || 0 };
  }
}

const ReminderLogger = {
  logExecution(result) {
    const s = result?.summary || {};
    console.log(`[INFO] 提醒執行器完成: 掃描:${s.scanned} 發送:${s.sent} 失敗:${s.failed} 過期:${s.expired} 取消:${s.cancelled} 錯誤:${s.errorCount}`);
  },
  logHealthCheck(health) {
    console.log(`[HEALTH] ${health.status} | level=${health.level} alerts=${health.alerts.length}`);
  },
};

const healthChecker = new ReminderHealthChecker();

module.exports = { ReminderHealthChecker, ReminderLogger, healthChecker };
