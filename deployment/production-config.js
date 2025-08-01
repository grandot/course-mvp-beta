/**
 * 🚀 Task 3.7: 生產環境配置
 * 
 * 功能：
 * - 生產環境專用配置
 * - 性能優化參數
 * - 監控和告警設定
 * - 安全性配置
 */

module.exports = {
  // 🎯 環境標識
  environment: 'production',
  
  // 🎯 Phase 3 組件配置
  phase3: {
    // PromptConfigManager 生產配置
    promptConfig: {
      mode: 'minimal',           // 生產環境使用最小化模式
      enableCaching: true,       // 啟用 prompt 緩存
      tokenOptimization: true,   // 啟用 token 優化
      fallbackMode: 'evidence_minimal' // fallback 模式
    },
    
    // EnhancedSemanticNormalizer 生產配置
    semanticNormalizer: {
      enableCache: true,         // 啟用緩存
      maxCacheSize: 5000,        // 生產環境增大緩存
      precomputeMappings: true,  // 啟用預計算
      fuzzyMatching: true,       // 啟用模糊匹配
      performanceOptimization: true
    },
    
    // MonitoringService 生產配置
    monitoring: {
      enabled: true,             // 生產環境必須啟用監控
      realTimeAlerts: true,      // 實時告警
      dataRetention: 30,         // 數據保留30天
      exportInterval: 24,        // 每24小時導出報告
      alertThresholds: {
        accuracy_drop: 0.03,     // 準確率下降>3%告警
        response_time_increase: 0.30, // 響應時間增加>30%告警
        cost_spike: 1.2,         // 成本增長>120%告警
        cache_hit_rate_drop: 0.15, // 緩存命中率下降>15%告警
        memory_usage_high: 0.80, // 內存使用>80%告警
        error_rate_high: 0.05    // 錯誤率>5%告警
      }
    }
  },
  
  // 🎯 性能優化配置
  performance: {
    // 緩存配置
    cache: {
      maxSize: 10000,           // 生產環境大緩存
      ttl: 3600 * 24,          // 24小時 TTL
      cleanupInterval: 3600,    // 每小時清理一次
      memoryThreshold: 0.85     // 內存使用率閾值
    },
    
    // 並發控制
    concurrency: {
      maxConcurrentRequests: 100, // 最大併發請求
      queueTimeout: 5000,        // 隊列超時5秒
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 1000 // 每分鐘最大請求數
      }
    },
    
    // 響應時間目標
    responseTime: {
      target: 50,               // 目標響應時間50ms
      warning: 100,             // 100ms以上警告
      critical: 500             // 500ms以上嚴重告警
    }
  },
  
  // 🎯 監控和日誌配置
  monitoring: {
    // 日誌配置
    logging: {
      level: 'info',            // 生產環境日誌級別
      enableDebug: false,       // 關閉debug日誌
      logRotation: true,        // 啟用日誌輪轉
      maxLogSize: '100MB',      // 最大日誌文件大小
      maxLogFiles: 10           // 保留日誌文件數量
    },
    
    // 指標收集
    metrics: {
      enableCollection: true,   // 啟用指標收集
      collectionInterval: 60,   // 每60秒收集一次
      retention: {
        detailed: 7,            // 詳細數據保留7天
        summary: 30,            // 摘要數據保留30天
        alerts: 90              // 告警記錄保留90天
      }
    },
    
    // 健康檢查
    healthCheck: {
      enabled: true,
      interval: 300,            // 每5分鐘檢查一次
      timeout: 10,              // 10秒超時
      endpoints: [
        '/health',
        '/metrics',
        '/status'
      ]
    }
  },
  
  // 🎯 安全配置
  security: {
    // API Key 管理
    apiKeys: {
      rotation: true,           // 啟用密鑰輪轉
      rotationInterval: 30,     // 30天輪轉一次
      validation: true,         // 啟用密鑰驗證
      encryption: true          // 啟用密鑰加密存儲
    },
    
    // 請求限制
    requestLimits: {
      maxPayloadSize: '1MB',    // 最大請求體大小
      timeout: 30,              // 30秒請求超時
      maxHeaderSize: '16KB'     // 最大請求頭大小
    },
    
    // 數據保護
    dataProtection: {
      enableEncryption: true,   // 啟用數據加密
      enableMasking: true,      // 啟用敏感數據遮罩
      auditLogging: true        // 啟用審計日誌
    }
  },
  
  // 🎯 災難恢復配置
  disasterRecovery: {
    // 備份配置
    backup: {
      enabled: true,
      interval: 6,              // 每6小時備份一次
      retention: 30,            // 備份保留30天
      compression: true,        // 啟用備份壓縮
      encryption: true          // 啟用備份加密
    },
    
    // failover 配置
    failover: {
      enabled: true,
      healthCheckInterval: 30,  // 30秒健康檢查
      failoverTimeout: 60,      // 60秒failover超時
      maxRetries: 3             // 最大重試次數
    },
    
    // 恢復配置
    recovery: {
      autoRecovery: true,       // 啟用自動恢復
      recoveryTimeout: 300,     // 5分鐘恢復超時
      dataConsistencyCheck: true // 啟用數據一致性檢查
    }
  },
  
  // 🎯 部署配置
  deployment: {
    // 漸進式部署策略
    strategy: {
      type: 'canary',           // 金絲雀部署
      phases: [
        { name: 'canary', traffic: 5 },    // 5% 流量
        { name: 'pilot', traffic: 25 },     // 25% 流量  
        { name: 'gradual', traffic: 50 },   // 50% 流量
        { name: 'full', traffic: 100 }      // 100% 流量
      ],
      rollbackThresholds: {
        errorRate: 0.01,        // 錯誤率>1%回滾
        responseTime: 200,      // 響應時間>200ms回滾
        availability: 0.999     // 可用性<99.9%回滾
      }
    },
    
    // 部署驗證
    validation: {
      preDeployment: [
        'healthCheck',
        'configValidation',
        'dependencyCheck'
      ],
      postDeployment: [
        'functionalTest',
        'performanceTest', 
        'monitoringValidation'
      ]
    }
  },
  
  // 🎯 環境變數配置
  environment_variables: {
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    ENABLE_MONITORING: 'true',
    ENABLE_CACHING: 'true',
    MAX_CACHE_SIZE: '10000',
    MONITORING_RETENTION_DAYS: '30',
    HEALTH_CHECK_INTERVAL: '300',
    BACKUP_INTERVAL_HOURS: '6'
  }
};