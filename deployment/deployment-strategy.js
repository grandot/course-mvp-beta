/**
 * 🚀 Task 3.7: 漸進式部署策略
 * 
 * 實現金絲雀部署，確保零停機和可回滾
 */

const { getMonitoringService } = require('../src/services/monitoringService');

class DeploymentStrategy {
  constructor(config = {}) {
    this.config = {
      phases: [
        { name: 'canary', traffic: 5, duration: 30 },      // 5% 流量，30分鐘
        { name: 'pilot', traffic: 25, duration: 60 },      // 25% 流量，60分鐘
        { name: 'gradual', traffic: 50, duration: 120 },   // 50% 流量，120分鐘
        { name: 'full', traffic: 100, duration: -1 }       // 100% 流量，永久
      ],
      rollbackThresholds: {
        errorRate: 0.01,        // 錯誤率>1%回滾
        responseTime: 200,      // 響應時間>200ms回滾  
        availability: 0.999,    // 可用性<99.9%回滾
        accuracyDrop: 0.05      // 準確率下降>5%回滾
      },
      ...config
    };
    
    this.currentPhase = 0;
    this.deploymentStart = null;
    this.monitoring = getMonitoringService();
    this.deploymentHistory = [];
    
    console.log('🚀 [DeploymentStrategy] 漸進式部署策略已初始化');
    console.log(`   部署階段: ${this.config.phases.length} 個`);
    console.log(`   回滾閾值: ${Object.keys(this.config.rollbackThresholds).length} 項`);
  }

  /**
   * 🎯 開始漸進式部署
   */
  async startDeployment() {
    console.log('🚀 [DeploymentStrategy] 開始漸進式部署...');
    
    this.deploymentStart = Date.now();
    this.currentPhase = 0;
    
    // 記錄部署開始
    this.deploymentHistory.push({
      event: 'deployment_start',
      timestamp: new Date().toISOString(),
      phase: this.getCurrentPhase()
    });
    
    // 執行部署前驗證
    const preDeploymentValid = await this.validatePreDeployment();
    if (!preDeploymentValid) {
      throw new Error('部署前驗證失敗');
    }
    
    // 開始第一階段部署
    return await this.executePhase(this.currentPhase);
  }

  /**
   * 🎯 執行特定階段的部署
   */
  async executePhase(phaseIndex) {
    if (phaseIndex >= this.config.phases.length) {
      console.log('✅ [DeploymentStrategy] 所有部署階段完成');
      return { success: true, message: '部署完成' };
    }
    
    const phase = this.config.phases[phaseIndex];
    console.log(`🎯 [DeploymentStrategy] 執行階段 ${phaseIndex + 1}: ${phase.name} (${phase.traffic}% 流量)`);
    
    try {
      // 配置流量分流
      await this.configureTrafficSplit(phase.traffic);
      
      // 記錄階段開始
      this.deploymentHistory.push({
        event: 'phase_start',
        timestamp: new Date().toISOString(),
        phase: phase,
        phaseIndex: phaseIndex
      });
      
      // 監控階段運行狀況
      const phaseResult = await this.monitorPhase(phase, phaseIndex);
      
      if (phaseResult.success) {
        console.log(`✅ [DeploymentStrategy] 階段 ${phase.name} 成功完成`);
        
        // 自動進入下一階段（如果不是最後階段）
        if (phaseIndex < this.config.phases.length - 1) {
          this.currentPhase = phaseIndex + 1;
          return await this.executePhase(this.currentPhase);
        } else {
          return await this.completeDeployment();
        }
      } else {
        console.error(`❌ [DeploymentStrategy] 階段 ${phase.name} 失敗: ${phaseResult.reason}`);
        return await this.rollback(phaseResult.reason);
      }
      
    } catch (error) {
      console.error(`❌ [DeploymentStrategy] 階段執行異常: ${error.message}`);
      return await this.rollback(`階段執行異常: ${error.message}`);
    }
  }

  /**
   * 🎯 監控階段運行狀況
   */
  async monitorPhase(phase, phaseIndex) {
    console.log(`📊 [DeploymentStrategy] 開始監控階段 ${phase.name}...`);
    
    const monitoringDuration = phase.duration > 0 ? phase.duration * 1000 : 60000; // 至少監控1分鐘
    const checkInterval = 10000; // 每10秒檢查一次
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkMetrics = async () => {
        try {
          const metrics = await this.collectPhaseMetrics();
          const healthCheck = this.evaluateHealth(metrics);
          
          console.log(`📈 [DeploymentStrategy] 階段監控 - 錯誤率: ${(metrics.errorRate * 100).toFixed(2)}%, 響應時間: ${metrics.avgResponseTime.toFixed(1)}ms, 可用性: ${(metrics.availability * 100).toFixed(2)}%`);
          
          // 檢查是否需要回滾
          if (!healthCheck.healthy) {
            console.warn(`⚠️ [DeploymentStrategy] 檢測到問題: ${healthCheck.reason}`);
            resolve({ success: false, reason: healthCheck.reason, metrics });
            return;
          }
          
          // 檢查是否監控時間已滿
          const elapsed = Date.now() - startTime;
          if (elapsed >= monitoringDuration) {
            console.log(`✅ [DeploymentStrategy] 階段 ${phase.name} 監控完成`);
            resolve({ success: true, metrics });
            return;
          }
          
          // 繼續監控
          setTimeout(checkMetrics, checkInterval);
          
        } catch (error) {
          console.error(`❌ [DeploymentStrategy] 監控過程異常: ${error.message}`);
          resolve({ success: false, reason: `監控異常: ${error.message}` });
        }
      };
      
      // 開始監控
      checkMetrics();
    });
  }

  /**
   * 🎯 收集階段指標
   */
  async collectPhaseMetrics() {
    const dashboardData = this.monitoring.getDashboardData();
    const metrics = dashboardData.metrics;
    
    return {
      errorRate: this.calculateErrorRate(metrics),
      avgResponseTime: metrics.performance.average_response_time || 0,
      availability: this.calculateAvailability(metrics),
      accuracyRate: metrics.accuracy.accuracy_rate || 1,
      requestCount: metrics.accuracy.total_requests || 0,
      systemHealth: dashboardData.summary.system_health
    };
  }

  /**
   * 🎯 計算錯誤率
   */
  calculateErrorRate(metrics) {
    const totalRequests = metrics.accuracy.total_requests || 0;
    const unknownIntents = metrics.accuracy.unknown_intents || 0;
    
    if (totalRequests === 0) return 0;
    return unknownIntents / totalRequests;
  }

  /**
   * 🎯 計算可用性
   */
  calculateAvailability(metrics) {
    // 基於系統健康狀態和響應時間計算可用性
    const avgResponseTime = metrics.performance.average_response_time || 0;
    const systemHealthy = this.isSystemHealthy(metrics);
    
    if (!systemHealthy) return 0.99; // 系統不健康時可用性降低
    if (avgResponseTime > 1000) return 0.995; // 響應時間過長時可用性降低
    
    return 0.999; // 正常情況下的可用性
  }

  /**
   * 🎯 判斷系統是否健康
   */
  isSystemHealthy(metrics) {
    // 基於多個指標判斷系統健康
    const errorRate = this.calculateErrorRate(metrics);
    const avgResponseTime = metrics.performance.average_response_time || 0;
    
    return errorRate < 0.05 && avgResponseTime < 500;
  }

  /**
   * 🎯 評估健康狀況
   */
  evaluateHealth(metrics) {
    const thresholds = this.config.rollbackThresholds;
    
    // 檢查錯誤率
    if (metrics.errorRate > thresholds.errorRate) {
      return { healthy: false, reason: `錯誤率過高: ${(metrics.errorRate * 100).toFixed(2)}%` };
    }
    
    // 檢查響應時間
    if (metrics.avgResponseTime > thresholds.responseTime) {
      return { healthy: false, reason: `響應時間過長: ${metrics.avgResponseTime.toFixed(1)}ms` };
    }
    
    // 檢查可用性
    if (metrics.availability < thresholds.availability) {
      return { healthy: false, reason: `可用性過低: ${(metrics.availability * 100).toFixed(2)}%` };
    }
    
    // 檢查準確率下降
    const accuracyDrop = 1 - metrics.accuracyRate;
    if (accuracyDrop > thresholds.accuracyDrop) {
      return { healthy: false, reason: `準確率下降: ${(accuracyDrop * 100).toFixed(2)}%` };
    }
    
    return { healthy: true };
  }

  /**
   * 🎯 配置流量分流
   */
  async configureTrafficSplit(percentage) {
    console.log(`🔀 [DeploymentStrategy] 配置流量分流: ${percentage}% 新系統, ${100 - percentage}% 舊系統`);
    
    // 這裡應該配置負載均衡器或路由規則
    // 在實際環境中，這會調用負載均衡器的API
    
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ [DeploymentStrategy] 流量分流配置完成: ${percentage}%`);
        resolve();
      }, 1000);
    });
  }

  /**
   * 🎯 執行回滾
   */
  async rollback(reason) {
    console.error(`🔄 [DeploymentStrategy] 開始回滾，原因: ${reason}`);
    
    this.deploymentHistory.push({
      event: 'rollback_start',
      timestamp: new Date().toISOString(),
      reason: reason,
      currentPhase: this.getCurrentPhase()
    });
    
    try {
      // 將流量完全切回舊系統
      await this.configureTrafficSplit(0);
      
      // 記錄回滾完成
      this.deploymentHistory.push({
        event: 'rollback_complete',
        timestamp: new Date().toISOString()
      });
      
      console.log('✅ [DeploymentStrategy] 回滾完成');
      
      return {
        success: false,
        rolled_back: true,
        reason: reason,
        deployment_duration: Date.now() - this.deploymentStart
      };
      
    } catch (error) {
      console.error(`❌ [DeploymentStrategy] 回滾失敗: ${error.message}`);
      
      return {
        success: false,
        rolled_back: false,
        reason: reason,
        rollback_error: error.message
      };
    }
  }

  /**
   * 🎯 完成部署
   */
  async completeDeployment() {
    console.log('🎉 [DeploymentStrategy] 部署成功完成！');
    
    this.deploymentHistory.push({
      event: 'deployment_complete',
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.deploymentStart
    });
    
    return {
      success: true,
      deployment_duration: Date.now() - this.deploymentStart,
      phases_completed: this.config.phases.length,
      final_traffic: 100
    };
  }

  /**
   * 🎯 部署前驗證
   */
  async validatePreDeployment() {
    console.log('🔍 [DeploymentStrategy] 執行部署前驗證...');
    
    try {
      // 健康檢查
      const healthCheck = await this.performHealthCheck();
      if (!healthCheck.healthy) {
        console.error(`❌ 健康檢查失敗: ${healthCheck.reason}`);
        return false;
      }
      
      // 配置驗證
      const configValid = this.validateConfig();
      if (!configValid.valid) {
        console.error(`❌ 配置驗證失敗: ${configValid.reason}`);
        return false;
      }
      
      // 依賴檢查
      const dependenciesReady = await this.checkDependencies();
      if (!dependenciesReady.ready) {
        console.error(`❌ 依賴檢查失敗: ${dependenciesReady.reason}`);
        return false;
      }
      
      console.log('✅ [DeploymentStrategy] 部署前驗證通過');
      return true;
      
    } catch (error) {
      console.error(`❌ [DeploymentStrategy] 部署前驗證異常: ${error.message}`);
      return false;
    }
  }

  /**
   * 🎯 執行健康檢查
   */
  async performHealthCheck() {
    try {
      const dashboardData = this.monitoring.getDashboardData();
      const systemHealth = dashboardData.summary.system_health;
      
      if (systemHealth === 'critical') {
        return { healthy: false, reason: '系統狀態critical' };
      }
      
      return { healthy: true };
    } catch (error) {
      return { healthy: false, reason: `健康檢查異常: ${error.message}` };
    }
  }

  /**
   * 🎯 驗證配置
   */
  validateConfig() {
    if (!this.config.phases || this.config.phases.length === 0) {
      return { valid: false, reason: '部署階段配置為空' };
    }
    
    if (!this.config.rollbackThresholds) {
      return { valid: false, reason: '回滾閾值配置缺失' };
    }
    
    return { valid: true };
  }

  /**
   * 🎯 檢查依賴
   */
  async checkDependencies() {
    try {
      // 檢查監控服務
      if (!this.monitoring) {
        return { ready: false, reason: '監控服務未初始化' };
      }
      
      // 檢查關鍵組件
      const dashboardData = this.monitoring.getDashboardData();
      if (!dashboardData) {
        return { ready: false, reason: '無法獲取監控數據' };
      }
      
      return { ready: true };
    } catch (error) {
      return { ready: false, reason: `依賴檢查異常: ${error.message}` };
    }
  }

  /**
   * 🎯 獲取當前階段信息
   */
  getCurrentPhase() {
    return this.config.phases[this.currentPhase] || null;
  }

  /**
   * 🎯 獲取部署狀態
   */
  getDeploymentStatus() {
    return {
      current_phase: this.currentPhase,
      phase_info: this.getCurrentPhase(),
      deployment_start: this.deploymentStart,
      history: this.deploymentHistory,
      is_active: this.deploymentStart !== null
    };
  }

  /**
   * 🎯 生成部署報告
   */
  generateDeploymentReport() {
    const status = this.getDeploymentStatus();
    const duration = this.deploymentStart ? Date.now() - this.deploymentStart : 0;
    
    return {
      deployment_summary: {
        status: status.is_active ? 'in_progress' : 'completed',
        duration: duration,
        phases_planned: this.config.phases.length,
        current_phase: this.currentPhase + 1
      },
      phase_details: this.config.phases.map((phase, index) => ({
        ...phase,
        status: index < this.currentPhase ? 'completed' : 
                index === this.currentPhase ? 'in_progress' : 'pending'
      })),
      deployment_history: this.deploymentHistory,
      rollback_thresholds: this.config.rollbackThresholds
    };
  }
}

module.exports = { DeploymentStrategy };