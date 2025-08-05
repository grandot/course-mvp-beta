/**
 * 生產環境配置 - Phase 5 實現
 * 三層語意記憶系統生產級配置
 */

const productionConfig = {
  // 服務器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    timeout: 30000,
    keepAlive: true,
  },

  // 三層記憶系統配置
  memorySystem: {
    // Layer 1: ConversationContext 配置
    conversationContext: {
      enabled: true,
      enhanced: true, // 使用增強版
      ttl: 300000, // 5 分鐘
      maxContexts: 10000,
    },

    // Layer 2: Memory.yaml 配置
    memoryYaml: {
      enabled: true,
      optimized: true, // 使用優化版
      maxRecords: 20,
      storagePath: process.env.MEMORY_STORAGE_PATH || './memory',

      // LRU 快取配置
      lruCacheSize: 1000,
      cacheTTL: 600000, // 10 分鐘
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB

      // 批量更新配置
      batchUpdateEnabled: true,
      batchUpdateInterval: 10000, // 10 秒
    },

    // Layer 3: SmartQuery 配置
    smartQuery: {
      enabled: true,
      queryTypes: 5,
      responseTimeout: 5000,
      cacheResults: true,
    },
  },

  // 語義服務配置
  semanticService: {
    enhanced: true, // 使用增強版
    regexFirstPriority: true,
    memoryInjectionEnabled: true,
    smartQueryBypass: true,
    enhancedContextEnabled: true,

    // 性能配置
    maxConcurrentRequests: 100,
    requestTimeout: 30000,
    retryAttempts: 3,
  },

  // OpenAI 配置
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7,
    timeout: 20000,
    retryAttempts: 2,
  },

  // 監控配置
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000,
      endpoint: '/health',
    },

    metrics: {
      enabled: true,
      endpoint: '/metrics',
      collectInterval: 60000,
    },

    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      file: {
        enabled: true,
        path: './logs/app.log',
        maxSize: '10m',
        maxFiles: 5,
      },
    },
  },

  // 安全配置
  security: {
    cors: {
      enabled: true,
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },

    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 分鐘
      max: 1000, // 每 IP 最多 1000 請求
      skipSuccessful: false,
    },

    helmet: {
      enabled: true,
      options: {
        contentSecurityPolicy: false, // 避免與 LINE Bot Webhook 衝突
      },
    },
  },

  // 資料庫配置
  database: {
    firebase: {
      enabled: true,
      timeout: 10000,
      retryAttempts: 3,
    },
  },

  // 優雅降級配置
  gracefulDegradation: {
    enabled: true,
    fallbackMode: 'basic',

    // 服務降級策略
    serviceFailures: {
      openai: {
        maxFailures: 5,
        resetTime: 300000, // 5 分鐘
        fallback: 'regex_only',
      },

      memoryYaml: {
        maxFailures: 3,
        resetTime: 180000, // 3 分鐘
        fallback: 'context_only',
      },

      firebase: {
        maxFailures: 3,
        resetTime: 300000,
        fallback: 'memory_only',
      },
    },
  },
};

module.exports = productionConfig;
