/**
 * Phase 3: 三層記憶系統配置
 * 從 src/config/production.js 中提取的高級功能配置
 */

const memorySystemConfig = {
  // Layer 1: ConversationContext 配置
  conversationContext: {
    enabled: true,
    enhanced: true, // 使用增強版
    ttl: 300000,    // 5 分鐘
    maxContexts: 10000
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
    batchUpdateInterval: 10000 // 10 秒
  },

  // Layer 3: SmartQuery 配置
  smartQuery: {
    enabled: true,
    queryTypes: 5,
    responseTimeout: 5000,
    cacheResults: true
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
    retryAttempts: 3
  }
};

module.exports = {
  memorySystemConfig,
  
  // 預期在 Phase 3 整合到主配置
  integrateIntoProduction: () => {
    console.log('⚠️ Memory System 尚未在 Phase 1 中實現');
    console.log('📋 計劃在 Phase 3 中啟用此功能');
    return false;
  }
};