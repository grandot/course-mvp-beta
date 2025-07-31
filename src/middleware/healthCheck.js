/**
 * 健康檢查中間件 - Phase 5 實現
 * 監控三層語意記憶系統的健康狀態
 */

class HealthCheckMiddleware {
  constructor(config = {}) {
    this.config = config;
    this.services = new Map();
    this.lastCheckTime = Date.now();
    this.healthStatus = {
      overall: 'healthy',
      services: {},
      timestamp: Date.now()
    };
    
    // 啟動定期健康檢查
    if (config.interval) {
      this.startPeriodicCheck(config.interval);
    }
  }

  /**
   * 註冊服務進行健康檢查
   * @param {string} serviceName 服務名稱
   * @param {Object} service 服務實例
   * @param {Function} healthCheckFn 健康檢查函數
   */
  registerService(serviceName, service, healthCheckFn) {
    this.services.set(serviceName, {
      service,
      healthCheck: healthCheckFn,
      lastCheck: 0,
      status: 'unknown',
      metrics: {}
    });
    
    console.log(`🏥 已註冊健康檢查服務: ${serviceName}`);
  }

  /**
   * Express 中間件
   */
  middleware() {
    return async (req, res, next) => {
      if (req.path === (this.config.endpoint || '/health')) {
        const healthReport = await this.getHealthReport();
        
        const statusCode = healthReport.overall === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthReport);
      } else {
        next();
      }
    };
  }

  /**
   * 獲取健康報告
   * @returns {Promise<Object>} 健康報告
   */
  async getHealthReport() {
    const now = Date.now();
    const report = {
      overall: 'healthy',
      timestamp: now,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {},
      system: this.getSystemMetrics()
    };

    let hasUnhealthyService = false;

    // 檢查每個註冊的服務
    for (const [serviceName, serviceInfo] of this.services) {
      try {
        const serviceHealth = await this.checkService(serviceName, serviceInfo);
        report.services[serviceName] = serviceHealth;
        
        if (serviceHealth.status !== 'healthy') {
          hasUnhealthyService = true;
        }
        
      } catch (error) {
        report.services[serviceName] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: now
        };
        hasUnhealthyService = true;
      }
    }

    // 設定整體狀態
    report.overall = hasUnhealthyService ? 'unhealthy' : 'healthy';
    
    this.healthStatus = report;
    return report;
  }

  /**
   * 檢查單個服務
   * @param {string} serviceName 服務名稱
   * @param {Object} serviceInfo 服務信息
   * @returns {Promise<Object>} 服務健康狀態
   */
  async checkService(serviceName, serviceInfo) {
    const startTime = Date.now();
    
    try {
      // 執行服務特定的健康檢查
      const healthResult = await serviceInfo.healthCheck(serviceInfo.service);
      const responseTime = Date.now() - startTime;
      
      const status = {
        status: healthResult.healthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: startTime,
        metrics: healthResult.metrics || {},
        details: healthResult.details || {}
      };
      
      // 更新服務信息
      serviceInfo.lastCheck = startTime;
      serviceInfo.status = status.status;
      serviceInfo.metrics = status.metrics;
      
      return status;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        lastCheck: startTime,
        error: error.message,
        metrics: {}
      };
    }
  }

  /**
   * 獲取系統指標
   * @returns {Object} 系統指標
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * 啟動定期健康檢查
   * @param {number} interval 檢查間隔（毫秒）
   */
  startPeriodicCheck(interval) {
    setInterval(async () => {
      try {
        await this.getHealthReport();
        console.log(`🏥 定期健康檢查完成: ${this.healthStatus.overall}`);
      } catch (error) {
        console.error('🏥 定期健康檢查失敗:', error.message);
      }
    }, interval);
    
    console.log(`🏥 已啟動定期健康檢查 (間隔: ${interval}ms)`);
  }

  /**
   * 預設服務健康檢查函數
   */
  static createDefaultHealthChecks() {
    return {
      // EnhancedSemanticService 健康檢查
      enhancedSemanticService: async (service) => {
        const stats = service.getServiceStats();
        const healthy = stats && typeof stats === 'object';
        
        return {
          healthy,
          metrics: {
            memoryYamlCacheSize: stats.memoryYamlStats?.cacheSize || 0,
            smartQueryTypes: stats.smartQueryStats?.supportedQueryTypes || 0,
            enhancedContextActive: stats.enhancedContextStats?.activeContexts || 0
          },
          details: {
            configuration: stats.configuration || {},
            lastUpdate: Date.now()
          }
        };
      },

      // OptimizedMemoryYamlService 健康檢查
      optimizedMemoryYamlService: async (service) => {
        const perfStats = service.getPerformanceStats();
        const healthy = perfStats.cacheSize >= 0 && perfStats.memoryUsageMB < 100;
        
        return {
          healthy,
          metrics: {
            cacheSize: perfStats.cacheSize,
            hitRate: perfStats.hitRate,
            memoryUsageMB: parseFloat(perfStats.memoryUsageMB),
            pendingBatchUpdates: perfStats.pendingBatchUpdates
          },
          details: {
            maxCacheSize: perfStats.maxCacheSize,
            maxMemoryMB: perfStats.maxMemoryMB,
            batchUpdates: perfStats.batchUpdates
          }
        };
      },

      // SmartQueryEngine 健康檢查
      smartQueryEngine: async (service) => {
        const stats = service.getQueryStats();
        const healthy = stats && stats.supportedQueryTypes > 0;
        
        return {
          healthy,
          metrics: {
            supportedQueryTypes: stats.supportedQueryTypes,
            totalPatterns: stats.totalPatterns,
            lastQueryTime: stats.lastQueryTime || 0
          },
          details: {
            queryTypes: stats.queryTypes || []
          }
        };
      },

      // EnhancedConversationContext 健康檢查
      enhancedConversationContext: async (contextClass) => {
        const stats = contextClass.getEnhancedStats();
        const healthy = stats.activeContexts >= 0;
        
        return {
          healthy,
          metrics: {
            activeContexts: stats.activeContexts,
            expandedTriggerIntents: stats.expandedTriggerIntents,
            contextsWithLearning: stats.contextsWithLearning,
            averageLearningData: stats.averageLearningDataPerContext
          },
          details: {
            triggerIntentCount: stats.expandedTriggerIntents
          }
        };
      }
    };
  }
}

module.exports = HealthCheckMiddleware;