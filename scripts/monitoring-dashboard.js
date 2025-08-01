#!/usr/bin/env node
/**
 * 🎯 Task 3.5: 監控儀表板工具
 * 提供命令行界面查看監控數據和生成報告
 * 
 * 使用方法：
 * node scripts/monitoring-dashboard.js status    # 查看當前狀態
 * node scripts/monitoring-dashboard.js report    # 生成詳細報告
 * node scripts/monitoring-dashboard.js alerts    # 查看告警信息
 * node scripts/monitoring-dashboard.js trends    # 查看趨勢分析
 */

const { getMonitoringService } = require('../src/services/monitoringService');
const { getMonitoringMiddleware } = require('../src/middleware/monitoringMiddleware');

class MonitoringDashboard {
  constructor() {
    this.monitoringService = getMonitoringService();
    this.middleware = getMonitoringMiddleware();
  }

  /**
   * 🎯 Task 3.5: 顯示系統狀態概覽
   */
  showStatus() {
    console.log('🎯 =====================================');
    console.log('🎯 語義處理系統監控儀表板');
    console.log('🎯 =====================================');
    
    const dashboardData = this.monitoringService.getDashboardData();
    const summary = dashboardData.summary;
    
    // 系統健康狀態
    const healthStatus = this.getHealthStatusEmoji(summary.system_health);
    console.log(`\n📊 系統健康狀態: ${healthStatus} ${summary.system_health.toUpperCase()}`);
    
    // 關鍵指標
    console.log('\n📈 關鍵指標:');
    console.log(`  └─ 總請求數: ${summary.key_metrics.total_requests}`);
    console.log(`  └─ 準確率: ${summary.key_metrics.accuracy_rate}`);
    console.log(`  └─ 平均響應時間: ${summary.key_metrics.average_response_time}`);
    console.log(`  └─ 緩存命中率: ${summary.key_metrics.cache_hit_rate}`);
    console.log(`  └─ 累計成本: ${summary.key_metrics.total_cost}`);
    
    // 成本預測
    console.log('\n💰 成本預測:');
    console.log(`  └─ 預估日成本: ${summary.projections.estimated_daily_cost}`);
    console.log(`  └─ 預估月成本: ${summary.projections.estimated_monthly_cost}`);
    
    // 活躍告警
    const activeAlerts = dashboardData.alerts.active_alerts;
    console.log(`\n🚨 活躍告警: ${activeAlerts.length} 個`);
    if (activeAlerts.length > 0) {
      activeAlerts.forEach(alert => {
        const levelEmoji = this.getAlertLevelEmoji(alert.level);
        console.log(`  └─ ${levelEmoji} [${alert.level.toUpperCase()}] ${alert.message}`);
      });
    } else {
      console.log('  └─ ✅ 無活躍告警');
    }
    
    // 優化建議
    const recommendations = dashboardData.recommendations;
    console.log(`\n💡 優化建議: ${recommendations.length} 項`);
    if (recommendations.length > 0) {
      recommendations.forEach(rec => {
        const priorityEmoji = this.getPriorityEmoji(rec.priority);
        console.log(`  └─ ${priorityEmoji} [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    } else {
      console.log('  └─ ✅ 系統運行良好，暫無建議');
    }
    
    console.log('\n🎯 =====================================');
  }

  /**
   * 🎯 Task 3.5: 生成詳細報告
   */
  generateReport() {
    console.log('📄 正在生成詳細監控報告...\n');
    
    const dashboardData = this.monitoringService.getDashboardData();
    const metrics = dashboardData.metrics;
    
    console.log('🎯 =====================================');
    console.log('🎯 詳細監控報告');
    console.log('🎯 =====================================');
    console.log(`📅 報告時間: ${dashboardData.timestamp}\n`);
    
    // Token使用詳情
    console.log('📊 Token使用統計:');
    console.log(`  └─ 總Token數: ${metrics.token_usage.total_tokens}`);
    console.log(`  └─ Prompt Tokens: ${metrics.token_usage.prompt_tokens}`);
    console.log(`  └─ Completion Tokens: ${metrics.token_usage.completion_tokens}`);
    console.log(`  └─ 平均每請求Token數: ${metrics.token_usage.average_tokens_per_request.toFixed(2)}`);
    console.log(`  └─ 累計成本估算: $${metrics.token_usage.cost_estimate.toFixed(4)}`);
    
    // 準確率詳情
    console.log('\n🎯 準確率分析:');
    console.log(`  └─ 總分析請求: ${metrics.accuracy.total_requests}`);
    console.log(`  └─ 成功識別: ${metrics.accuracy.successful_intents}`);
    console.log(`  └─ 未知意圖: ${metrics.accuracy.unknown_intents}`);
    console.log(`  └─ 準確率: ${(metrics.accuracy.accuracy_rate * 100).toFixed(2)}%`);
    
    if (metrics.accuracy.confidence_scores.length > 0) {
      const avgConfidence = metrics.accuracy.confidence_scores.reduce((a, b) => a + b, 0) / 
                           metrics.accuracy.confidence_scores.length;
      console.log(`  └─ 平均信心度: ${avgConfidence.toFixed(3)}`);
    }
    
    // 性能詳情
    console.log('\n⚡ 性能分析:');
    if (metrics.performance.response_times.length > 0) {
      console.log(`  └─ 平均響應時間: ${metrics.performance.average_response_time.toFixed(2)}ms`);
      console.log(`  └─ 最快響應: ${Math.min(...metrics.performance.response_times).toFixed(2)}ms`);
      console.log(`  └─ 最慢響應: ${Math.max(...metrics.performance.response_times).toFixed(2)}ms`);
    }
    console.log(`  └─ 緩存命中率: ${(metrics.performance.cache_hit_rate * 100).toFixed(2)}%`);
    console.log(`  └─ 系統吞吐量: ${metrics.performance.throughput.toFixed(2)} RPS`);
    
    // Entity質量詳情
    console.log('\n🏷️ Entity質量分析:');
    console.log(`  └─ 總提取Entity數: ${metrics.entity_quality.total_entities_extracted}`);
    console.log(`  └─ 有效Entity數: ${metrics.entity_quality.valid_entities}`);
    console.log(`  └─ 質量分數: ${(metrics.entity_quality.quality_score * 100).toFixed(2)}%`);
    
    if (Object.keys(metrics.entity_quality.entity_types).length > 0) {
      console.log('  └─ Entity類型分佈:');
      Object.entries(metrics.entity_quality.entity_types).forEach(([type, count]) => {
        console.log(`      ├─ ${type}: ${count}`);
      });
    }
    
    // 系統資源
    console.log('\n💾 系統資源:');
    console.log(`  └─ 緩存大小: ${metrics.system_resources.cache_size}`);
    console.log(`  └─ 內存使用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n🎯 =====================================');
  }

  /**
   * 🎯 Task 3.5: 顯示告警信息
   */
  showAlerts() {
    console.log('🚨 告警信息概覽\n');
    
    const dashboardData = this.monitoringService.getDashboardData();
    const alerts = dashboardData.alerts;
    
    // 活躍告警
    console.log(`📍 活躍告警 (${alerts.active_alerts.length} 個):`);
    if (alerts.active_alerts.length > 0) {
      alerts.active_alerts.forEach((alert, index) => {
        const levelEmoji = this.getAlertLevelEmoji(alert.level);
        const timeDiff = this.getTimeDifference(alert.timestamp);
        console.log(`\n  ${index + 1}. ${levelEmoji} [${alert.level.toUpperCase()}] ${alert.id}`);
        console.log(`     訊息: ${alert.message}`);
        console.log(`     時間: ${alert.timestamp} (${timeDiff}前)`);
        if (alert.data && Object.keys(alert.data).length > 0) {
          console.log(`     數據: ${JSON.stringify(alert.data, null, 6)}`);
        }
      });
    } else {
      console.log('  └─ ✅ 無活躍告警');
    }
    
    // 告警歷史
    console.log(`\n📜 告警歷史 (最近${Math.min(alerts.alert_history.length, 5)}條):`);
    if (alerts.alert_history.length > 0) {
      alerts.alert_history.slice(-5).forEach((alert, index) => {
        const levelEmoji = this.getAlertLevelEmoji(alert.level);
        const timeDiff = this.getTimeDifference(alert.timestamp);
        console.log(`  ${index + 1}. ${levelEmoji} [${alert.level.toUpperCase()}] ${alert.message} (${timeDiff}前)`);
      });
    } else {
      console.log('  └─ 📝 暫無告警歷史');
    }
    
    if (alerts.last_alert_time) {
      const lastAlertTime = this.getTimeDifference(new Date(alerts.last_alert_time).toISOString());
      console.log(`\n⏰ 最後告警時間: ${lastAlertTime}前`);
    }
  }

  /**
   * 🎯 Task 3.5: 顯示趨勢分析
   */
  showTrends() {
    console.log('📈 趨勢分析\n');
    
    const dashboardData = this.monitoringService.getDashboardData();
    const trends = dashboardData.trends;
    
    // Token使用趨勢
    console.log('💰 Token使用趨勢:');
    if (trends.token_usage_trend.length > 0) {
      const recentUsage = trends.token_usage_trend.slice(-5);
      console.log('  最近5次使用:');
      recentUsage.forEach((usage, index) => {
        const time = new Date(usage.timestamp).toLocaleTimeString();
        console.log(`    ${index + 1}. ${time}: ${usage.tokens} tokens, $${usage.cost.toFixed(4)}`);
      });
      
      const totalTokens = trends.token_usage_trend.reduce((sum, usage) => sum + usage.tokens, 0);
      const avgTokens = totalTokens / trends.token_usage_trend.length;
      console.log(`  └─ 平均Token使用: ${avgTokens.toFixed(2)} tokens/request`);
    } else {
      console.log('  └─ 📝 暫無使用數據');
    }
    
    // 準確率趨勢
    console.log('\n🎯 準確率趨勢:');
    if (trends.accuracy_trend.length > 0) {
      const recentAccuracy = trends.accuracy_trend.slice(-5);
      console.log('  最近5次分析:');
      recentAccuracy.forEach((acc, index) => {
        const time = new Date(acc.timestamp).toLocaleTimeString();
        console.log(`    ${index + 1}. ${time}: 準確率 ${(acc.accuracy_rate * 100).toFixed(1)}%, 信心度 ${acc.confidence.toFixed(3)}`);
      });
      
      const latestAccuracy = recentAccuracy[recentAccuracy.length - 1];
      const firstAccuracy = recentAccuracy[0];
      const trend = latestAccuracy.accuracy_rate - firstAccuracy.accuracy_rate;
      const trendEmoji = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
      console.log(`  └─ 準確率變化: ${trendEmoji} ${(trend * 100).toFixed(2)}%`);
    } else {
      console.log('  └─ 📝 暫無準確率數據');
    }
    
    // 性能趨勢
    console.log('\n⚡ 性能趨勢:');
    if (trends.performance_trend.length > 0) {
      const recentPerf = trends.performance_trend.slice(-5);
      console.log('  最近5次性能:');
      recentPerf.forEach((perf, index) => {
        const time = new Date(perf.timestamp).toLocaleTimeString();
        console.log(`    ${index + 1}. ${time}: 響應 ${perf.response_time.toFixed(2)}ms, 緩存 ${(perf.cache_hit_rate * 100).toFixed(1)}%, 吞吐 ${perf.throughput.toFixed(1)} RPS`);
      });
      
      const avgResponseTime = recentPerf.reduce((sum, perf) => sum + perf.response_time, 0) / recentPerf.length;
      console.log(`  └─ 平均響應時間: ${avgResponseTime.toFixed(2)}ms`);
    } else {
      console.log('  └─ 📝 暫無性能數據');
    }
  }

  /**
   * 🎯 Task 3.5: 執行健康檢查
   */
  performHealthCheck() {
    console.log('🏥 執行系統健康檢查...\n');
    
    const healthData = this.middleware.performHealthCheck();
    const summary = healthData.summary;
    
    console.log('🎯 健康檢查結果:');
    console.log(`  └─ 系統狀態: ${this.getHealthStatusEmoji(summary.system_health)} ${summary.system_health.toUpperCase()}`);
    console.log(`  └─ 活躍告警: ${healthData.alerts.active_alerts.length} 個`);
    console.log(`  └─ 優化建議: ${healthData.recommendations.length} 項`);
    
    // 各項指標檢查
    console.log('\n📊 指標檢查:');
    const metrics = healthData.metrics;
    
    // 準確率檢查
    const accuracyRate = metrics.accuracy.accuracy_rate;
    const accuracyStatus = accuracyRate >= 0.8 ? '✅' : accuracyRate >= 0.6 ? '⚠️' : '❌';
    console.log(`  └─ 準確率: ${accuracyStatus} ${(accuracyRate * 100).toFixed(2)}%`);
    
    // 響應時間檢查
    const responseTime = metrics.performance.average_response_time;
    const responseStatus = responseTime <= 50 ? '✅' : responseTime <= 100 ? '⚠️' : '❌';
    console.log(`  └─ 響應時間: ${responseStatus} ${responseTime?.toFixed(2) || 'N/A'}ms`);
    
    // 緩存命中率檢查
    const cacheHitRate = metrics.performance.cache_hit_rate;
    const cacheStatus = cacheHitRate >= 0.6 ? '✅' : cacheHitRate >= 0.4 ? '⚠️' : '❌';
    console.log(`  └─ 緩存命中率: ${cacheStatus} ${(cacheHitRate * 100).toFixed(2)}%`);
    
    // 成本檢查
    const totalCost = metrics.token_usage.cost_estimate;
    const costStatus = totalCost <= 1 ? '✅' : totalCost <= 5 ? '⚠️' : '❌';
    console.log(`  └─ 累計成本: ${costStatus} $${totalCost.toFixed(4)}`);
    
    console.log(`\n✅ 健康檢查完成於 ${new Date().toLocaleString()}`);
  }

  /**
   * 🎯 Task 3.5: 導出報告到文件
   */
  exportReport(format = 'json', outputPath = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `monitoring-report-${timestamp}.${format}`;
    const filePath = outputPath || defaultPath;
    
    console.log(`📁 正在導出${format.toUpperCase()}格式報告到: ${filePath}`);
    
    const reportContent = this.monitoringService.exportReport(format);
    
    require('fs').writeFileSync(filePath, reportContent, 'utf8');
    console.log('✅ 報告導出完成!');
    
    return filePath;
  }

  // 輔助方法
  getHealthStatusEmoji(status) {
    const emojis = {
      'healthy': '🟢',
      'warning': '🟡',
      'degraded': '🟠',
      'critical': '🔴'
    };
    return emojis[status] || '⚪';
  }

  getAlertLevelEmoji(level) {
    const emojis = {
      'low': '🔵',
      'medium': '🟡',
      'high': '🟠',
      'critical': '🔴'
    };
    return emojis[level] || '⚪';
  }

  getPriorityEmoji(priority) {
    const emojis = {
      'low': '🔵',
      'medium': '🟡',
      'high': '🔴'
    };
    return emojis[priority] || '⚪';
  }

  getTimeDifference(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}天`;
    if (diffHours > 0) return `${diffHours}小時`;
    if (diffMins > 0) return `${diffMins}分鐘`;
    return '剛剛';
  }
}

// 🎯 Task 3.5: 命令行界面
function main() {
  const dashboard = new MonitoringDashboard();
  const command = process.argv[2] || 'status';
  
  switch (command) {
    case 'status':
      dashboard.showStatus();
      break;
    case 'report':
      dashboard.generateReport();
      break;
    case 'alerts':
      dashboard.showAlerts();
      break;
    case 'trends':
      dashboard.showTrends();
      break;
    case 'health':
      dashboard.performHealthCheck();
      break;
    case 'export':
      const format = process.argv[3] || 'json';
      const outputPath = process.argv[4];
      dashboard.exportReport(format, outputPath);
      break;
    default:
      console.log('🎯 監控儀表板使用說明:');
      console.log('  node scripts/monitoring-dashboard.js status    # 查看當前狀態');
      console.log('  node scripts/monitoring-dashboard.js report    # 生成詳細報告');
      console.log('  node scripts/monitoring-dashboard.js alerts    # 查看告警信息');
      console.log('  node scripts/monitoring-dashboard.js trends    # 查看趨勢分析');
      console.log('  node scripts/monitoring-dashboard.js health    # 執行健康檢查');
      console.log('  node scripts/monitoring-dashboard.js export [json|text] [path] # 導出報告');
  }
}

if (require.main === module) {
  main();
}

module.exports = { MonitoringDashboard };