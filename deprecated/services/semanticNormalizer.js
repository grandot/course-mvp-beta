/**
 * 語意標準化器 (Semantic Normalizer)
 * 
 * 職責：
 * 1. 將 OpenAI 的自然語言輸出映射為系統標準格式
 * 2. 執行 Enum 約束驗證  
 * 3. 提供 fallback 安全機制
 * 4. 統一所有語意分析結果的格式
 * 
 * 第一性原則：確定性操作用確定性方法，格式標準化是確定性需求
 */

const fs = require('fs');
const path = require('path');

class SemanticNormalizer {
  constructor() {
    this.intentMap = null;
    this.entityKeyMap = null;
    this.entityValueMap = null;
    this._loadMappingData();
  }

  /**
   * 加載映射數據文件
   */
  _loadMappingData() {
    try {
      const dataPath = path.join(__dirname, '../../data');
      
      // 加載Intent映射表
      const intentMapPath = path.join(dataPath, 'intentMap.json');
      this.intentMap = JSON.parse(fs.readFileSync(intentMapPath, 'utf8'));
      
      // 加載Entity鍵名映射表
      const entityKeyMapPath = path.join(dataPath, 'entityKeyMap.json');
      this.entityKeyMap = JSON.parse(fs.readFileSync(entityKeyMapPath, 'utf8'));
      
      // 加載Entity值映射表
      const entityValueMapPath = path.join(dataPath, 'entityValueMap.json');
      this.entityValueMap = JSON.parse(fs.readFileSync(entityValueMapPath, 'utf8'));
      
      console.log('[SemanticNormalizer] 映射數據加載成功');
      
    } catch (error) {
      console.error('[SemanticNormalizer] 映射數據加載失敗:', error.message);
      // 初始化空映射，避免系統崩潰
      this.intentMap = { intent_mappings: {}, fallback_patterns: {}, _standard_intents: [] };
      this.entityKeyMap = { entity_key_mappings: {}, fallback_patterns: {} };
      this.entityValueMap = { common_course_names: {}, time_phrase_mappings: {} };
    }
  }

  /**
   * 標準化Intent
   * @param {string} intent - 原始Intent
   * @param {Object} config - 配置選項
   * @returns {Object} Intent映射結果
   */
  normalizeIntent(intent, config = {}) {
    const defaultConfig = {
      strict_mode: false,
      fallback_enabled: true,
      log_unmapped: true
    };
    const finalConfig = { ...defaultConfig, ...config };

    if (!intent || typeof intent !== 'string') {
      return {
        mapped_intent: 'unknown',
        original_intent: intent,
        mapping_source: 'fallback',
        confidence: 0.1
      };
    }

    const cleanIntent = intent.trim();
    
    // 1. 檢查是否已經是標準Intent（優先級最高）
    if (this._isValidIntent(cleanIntent)) {
      return {
        mapped_intent: cleanIntent,
        original_intent: cleanIntent,
        mapping_source: 'direct',
        confidence: 1.0
      };
    }

    // 2. 直接映射檢查
    const directMapping = this.intentMap.intent_mappings[cleanIntent];
    if (directMapping && this._isValidIntent(directMapping)) {
      return {
        mapped_intent: directMapping,
        original_intent: cleanIntent,
        mapping_source: 'direct',
        confidence: 0.95
      };
    }

    // 3. Fallback模式匹配
    if (finalConfig.fallback_enabled) {
      const fallbackResult = this._findFallbackIntent(cleanIntent);
      if (fallbackResult.success) {
        return {
          mapped_intent: fallbackResult.intent,
          original_intent: cleanIntent,
          mapping_source: 'fallback',
          confidence: 0.7
        };
      }
    }

    // 4. 記錄未映射項目
    if (finalConfig.log_unmapped) {
      console.warn(`[SemanticNormalizer] 未映射的Intent: "${cleanIntent}"`);
    }

    // 5. 最終fallback
    return {
      mapped_intent: 'unknown',
      original_intent: cleanIntent,
      mapping_source: 'none',
      confidence: 0.1
    };
  }

  /**
   * 標準化Entities
   * @param {Object} entities - 原始entities
   * @param {Object} config - 配置選項
   * @returns {Object} Entity映射結果
   */
  normalizeEntities(entities, config = {}) {
    const defaultConfig = {
      strict_mode: false,
      fallback_enabled: true,
      log_unmapped: true
    };
    const finalConfig = { ...defaultConfig, ...config };

    if (!entities || typeof entities !== 'object') {
      return {
        mapped_entities: {},
        original_entities: entities || {},
        key_mappings: {},
        value_mappings: {},
        unmapped_keys: []
      };
    }

    const mappedEntities = {};
    const keyMappings = {};
    const valueMappings = {};
    const unmappedKeys = [];

    // 遍歷所有原始entities
    for (const [originalKey, originalValue] of Object.entries(entities)) {
      // 1. 標準化鍵名
      const mappedKey = this._normalizeEntityKey(originalKey, finalConfig);
      if (mappedKey !== originalKey) {
        keyMappings[originalKey] = mappedKey;
      }

      // 2. 標準化值
      const mappedValue = this._normalizeEntityValue(mappedKey, originalValue, finalConfig);
      if (mappedValue !== originalValue) {
        valueMappings[`${mappedKey}`] = { original: originalValue, mapped: mappedValue };
      }

      // 3. 記錄結果
      if (mappedKey === originalKey && !this._isStandardEntityKey(mappedKey)) {
        unmappedKeys.push(originalKey);
        if (finalConfig.log_unmapped) {
          console.warn(`[SemanticNormalizer] 未映射的Entity鍵: "${originalKey}"`);
        }
      }

      mappedEntities[mappedKey] = mappedValue;
    }

    return {
      mapped_entities: mappedEntities,
      original_entities: entities,
      key_mappings: keyMappings,
      value_mappings: valueMappings,
      unmapped_keys: unmappedKeys
    };
  }

  /**
   * 統一標準化入口
   * @param {Object} result - AI或Regex分析結果
   * @param {Object} config - 配置選項
   * @returns {Object} 標準化結果
   */
  normalize(result, config = {}) {
    const startTime = Date.now();
    
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return {
        intent: this.normalizeIntent('unknown', config),
        entities: this.normalizeEntities({}, config),
        success: false,
        errors: ['Invalid input result'],
        warnings: [],
        debug_info: {
          normalizer_version: '1.0.0',
          processing_time_ms: 0,
          config_used: config
        }
      };
    }

    const errors = [];
    const warnings = [];

    try {
      // 標準化Intent
      const intentResult = this.normalizeIntent(result.intent, config);
      
      // 標準化Entities
      const entitiesResult = this.normalizeEntities(result.entities, config);
      
      // 檢查成功狀態
      const success = intentResult.confidence > 0.5 && entitiesResult.unmapped_keys.length === 0;
      
      // 收集警告
      if (intentResult.mapping_source === 'fallback') {
        warnings.push(`Intent "${intentResult.original_intent}" 使用fallback映射`);
      }
      if (entitiesResult.unmapped_keys.length > 0) {
        warnings.push(`發現 ${entitiesResult.unmapped_keys.length} 個未映射的Entity鍵`);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        intent: intentResult,
        entities: entitiesResult,
        success,
        errors,
        warnings,
        debug_info: {
          normalizer_version: '1.0.0',
          processing_time_ms: processingTime,
          config_used: config
        }
      };

    } catch (error) {
      errors.push(`標準化過程發生錯誤: ${error.message}`);
      const processingTime = Date.now() - startTime;
      return {
        intent: this.normalizeIntent('unknown', config),
        entities: this.normalizeEntities({}, config),
        success: false,
        errors,
        warnings,
        debug_info: {
          normalizer_version: '1.0.0',
          processing_time_ms: processingTime,
          config_used: config
        }
      };
    }
  }

  /**
   * 標準化Entity鍵名
   * @private
   */
  _normalizeEntityKey(key, config) {
    if (!key || typeof key !== 'string') return key;

    const cleanKey = key.trim();
    
    // 直接映射
    const directMapping = this.entityKeyMap.entity_key_mappings[cleanKey];
    if (directMapping) {
      return directMapping;
    }

    // Fallback模式
    if (config.fallback_enabled) {
      const fallbackMapping = this.entityKeyMap.fallback_patterns[cleanKey.toLowerCase()];
      if (fallbackMapping) {
        return fallbackMapping;
      }
    }

    // 檢查是否已經是標準鍵名
    if (this._isStandardEntityKey(cleanKey)) {
      return cleanKey;
    }

    return cleanKey; // 保持原樣
  }

  /**
   * 標準化Entity值
   * @private
   */
  _normalizeEntityValue(key, value, config, visited = new WeakSet()) {
    if (value === null || value === undefined) return value;

    // 處理不同類型的值
    switch (typeof value) {
      case 'string':
        return this._normalizeStringValue(key, value, config);
      case 'object':
        // 防止循環引用
        if (visited.has(value)) {
          console.warn('[SemanticNormalizer] 檢測到循環引用，跳過處理');
          return '[Circular Reference]';
        }
        visited.add(value);

        if (Array.isArray(value)) {
          const result = value.map(item => this._normalizeEntityValue(key, item, config, visited));
          visited.delete(value);
          return result;
        } else {
          // 遞歸處理對象
          const normalizedObj = {};
          for (const [subKey, subValue] of Object.entries(value)) {
            const normalizedSubKey = this._normalizeEntityKey(subKey, config);
            normalizedObj[normalizedSubKey] = this._normalizeEntityValue(normalizedSubKey, subValue, config, visited);
          }
          visited.delete(value);
          return normalizedObj;
        }
      default:
        return value;
    }
  }

  /**
   * 標準化字符串值
   * @private
   */
  _normalizeStringValue(key, value, config) {
    if (!value || typeof value !== 'string') return value;

    const cleanValue = value.trim();
    
    // 根據鍵名類型決定映射策略
    switch (key) {
      case 'course_name':
        return this.entityValueMap.common_course_names[cleanValue] || cleanValue;
      
      case 'time_phrase':
      case 'date_phrase':
        return this.entityValueMap.time_phrase_mappings[cleanValue] || cleanValue;
      
      case 'location':
        return this.entityValueMap.location_mappings[cleanValue] || cleanValue;
      
      case 'confirmation':
        const confirmationMapping = this.entityValueMap.confirmation_mappings[cleanValue];
        return confirmationMapping !== undefined ? confirmationMapping : cleanValue;
      
      case 'performance':
        return this.entityValueMap.performance_mappings[cleanValue] || cleanValue;
      
      default:
        return cleanValue;
    }
  }

  /**
   * Fallback Intent查找
   * @private
   */
  _findFallbackIntent(intent) {
    const lowerIntent = intent.toLowerCase();
    
    // 檢查fallback patterns - 按最長匹配優先
    const matches = [];
    for (const [pattern, mappedIntent] of Object.entries(this.intentMap.fallback_patterns)) {
      if (lowerIntent.includes(pattern.toLowerCase())) {
        if (this._isValidIntent(mappedIntent)) {
          matches.push({ pattern, mappedIntent, length: pattern.length });
        }
      }
    }
    
    if (matches.length > 0) {
      // 選擇最長的匹配
      matches.sort((a, b) => b.length - a.length);
      return { success: true, intent: matches[0].mappedIntent };
    }
    
    return { success: false, intent: null };
  }

  /**
   * 檢查是否為有效的標準Intent
   * @private
   */
  _isValidIntent(intent) {
    return this.intentMap._standard_intents.includes(intent);
  }

  /**
   * 檢查是否為標準Entity鍵名
   * @private
   */
  _isStandardEntityKey(key) {
    return this.entityKeyMap._standard_entity_keys && 
           this.entityKeyMap._standard_entity_keys.includes(key);
  }

  /**
   * 獲取所有支持的標準Intent
   */
  getSupportedIntents() {
    return [...this.intentMap._standard_intents];
  }

  /**
   * 獲取所有支持的標準Entity鍵名
   */
  getSupportedEntityKeys() {
    return this.entityKeyMap._standard_entity_keys ? 
           [...this.entityKeyMap._standard_entity_keys] : [];
  }

  /**
   * 重新加載映射數據（用於運行時更新）
   */
  reloadMappingData() {
    console.log('[SemanticNormalizer] 重新加載映射數據...');
    this._loadMappingData();
  }

  /**
   * 獲取映射統計信息
   */
  getMappingStats() {
    return {
      intent_mappings: Object.keys(this.intentMap.intent_mappings || {}).length,
      fallback_patterns: Object.keys(this.intentMap.fallback_patterns || {}).length,
      entity_key_mappings: Object.keys(this.entityKeyMap.entity_key_mappings || {}).length,
      entity_value_categories: Object.keys(this.entityValueMap || {}).length - 1, // 減去_metadata
      standard_intents: this.intentMap._standard_intents?.length || 0,
      standard_entity_keys: this.entityKeyMap._standard_entity_keys?.length || 0
    };
  }
}

// 單例模式
let instance = null;

/**
 * 獲取SemanticNormalizer單例
 */
function getInstance() {
  if (!instance) {
    instance = new SemanticNormalizer();
  }
  return instance;
}

module.exports = {
  SemanticNormalizer,
  getInstance
};