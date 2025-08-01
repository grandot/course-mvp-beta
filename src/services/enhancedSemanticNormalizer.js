/**
 * 增強版語義標準化服務 - Task 3.2 強化映射能力
 * 支持模糊匹配、相似度計算、智能映射等進階功能
 * Phase 3: 應對極簡prompt產生的更多樣化輸出
 */

const fs = require('fs');
const path = require('path');

class EnhancedSemanticNormalizer {
  constructor() {
    this.intentMap = null;
    this.entityKeyMap = null;
    this.entityValueMap = null;
    this.loadMappingData();
    
    // Phase 3.2 新增：相似度匹配配置
    this.fuzzyMatchConfig = {
      intent_similarity_threshold: 0.6,
      entity_similarity_threshold: 0.7,
      keyword_match_threshold: 0.5,
      enable_phonetic_matching: true,
      enable_semantic_clustering: true
    };

    // 🎯 Task 3.4: 增強版緩存機制
    this.matchCache = new Map();
    this.maxCacheSize = 2000; // 增加緩存容量
    this.cacheHits = 0;
    this.cacheRequests = 0;
    this.cacheSizeStats = { peak: 0, average: 0 };
    
    // 🎯 Task 3.4: 分層緩存系統
    this.intentMappingCache = new Map(); // Intent映射專用緩存
    this.entityMappingCache = new Map();  // Entity映射專用緩存
    this.fuzzyMatchCache = new Map();     // 模糊匹配專用緩存
    
    // 🎯 Task 3.4: 預載入機制 - 載入數據後立即建立常用映射索引
    this.preComputedMappings = new Map();
    this.initializePerformanceOptimizations();
  }

  /**
   * 載入映射數據
   * @private
   */
  loadMappingData() {
    try {
      // 🎯 Task 3.4: 使用增強版映射數據文件
      const intentMapPath = path.join(__dirname, '../../data/enhancedIntentMap.json');
      const entityKeyMapPath = path.join(__dirname, '../../data/entityKeyMap.json'); 
      const entityValueMapPath = path.join(__dirname, '../../data/entityValueMap.json');

      this.intentMap = JSON.parse(fs.readFileSync(intentMapPath, 'utf8'));
      this.entityKeyMap = JSON.parse(fs.readFileSync(entityKeyMapPath, 'utf8'));
      this.entityValueMap = JSON.parse(fs.readFileSync(entityValueMapPath, 'utf8'));
      
      console.log('[EnhancedSemanticNormalizer] 映射數據載入成功');
    } catch (error) {
      console.error('[EnhancedSemanticNormalizer] 映射數據載入失敗:', error.message);
      this._loadDefaultMappings();
    }
  }

  /**
   * 🎯 Task 3.4: 初始化性能优化機制
   * 預計算常用映射，建立快速查找索引
   * @private
   */
  initializePerformanceOptimizations() {
    try {
      console.log('[EnhancedSemanticNormalizer] 開始性能優化初始化...');
      
      // 1. 預計算常用Intent映射
      this.preComputeIntentMappings();
      
      // 2. 建立Entity鍵名反向索引
      this.buildEntityKeyIndex();
      
      // 3. 預載入模糊匹配候選項
      this.preLoadFuzzyMatchCandidates();
      
      // 4. 初始化緩存命中率統計
      this.initializeCacheStats();
      
      console.log(`[EnhancedSemanticNormalizer] 性能優化初始化完成`);
      console.log(`   - 預計算映射: ${this.preComputedMappings.size} 項`);
      console.log(`   - Intent緩存: ${this.intentMappingCache.size} 項`);
      console.log(`   - Entity緩存: ${this.entityMappingCache.size} 項`);
      
    } catch (error) {
      console.error('[EnhancedSemanticNormalizer] 性能優化初始化失敗:', error.message);
    }
  }

  /**
   * 🎯 Task 3.4: 預計算Intent映射
   * @private
   */
  preComputeIntentMappings() {
    const startTime = Date.now();
    let preComputedCount = 0;
    
    // 處理增強版映射數據
    if (this.intentMap?.intent_mappings) {
      for (const [categoryKey, category] of Object.entries(this.intentMap.intent_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          // 處理嵌套結構
          for (const [chineseIntent, englishIntent] of Object.entries(category)) {
            const cacheKey = `intent:${chineseIntent.trim()}`;
            const result = {
              mapped_intent: englishIntent,
              original_intent: chineseIntent.trim(),
              mapping_source: 'precomputed_direct',
              confidence: 0.98
            };
            this.intentMappingCache.set(cacheKey, result);
            this.preComputedMappings.set(chineseIntent.toLowerCase(), englishIntent);
            preComputedCount++;
          }
        }
      }
    }
    
    console.log(`   預計算Intent映射: ${preComputedCount} 項 (${Date.now() - startTime}ms)`);
  }

  /**
   * 🎯 Task 3.4: 建立Entity鍵名反向索引
   * @private
   */
  buildEntityKeyIndex() {
    const startTime = Date.now();
    let indexCount = 0;
    
    if (this.entityKeyMap?.key_mappings) {
      for (const [categoryKey, category] of Object.entries(this.entityKeyMap.key_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          for (const [chineseKey, englishKey] of Object.entries(category)) {
            const cacheKey = `entity_key:${chineseKey.trim()}`;
            this.entityMappingCache.set(cacheKey, {
              mapped_key: englishKey,
              original_key: chineseKey.trim(),
              mapping_source: 'precomputed_index'
            });
            indexCount++;
          }
        }
      }
    }
    
    console.log(`   建立Entity索引: ${indexCount} 項 (${Date.now() - startTime}ms)`);
  }

  /**
   * 🎯 Task 3.4: 預載入模糊匹配候選項
   * @private
   */
  preLoadFuzzyMatchCandidates() {
    const startTime = Date.now();
    let candidateCount = 0;
    
    // 為常用Intent準備模糊匹配候選項
    const commonIntents = [
      '記錄課程', '查詢課表', '修改課程', '取消課程', '清空課表',
      '設提醒', '記錄內容', '上傳照片', '查詢內容'  
    ];
    
    for (const intent of commonIntents) {
      // 生成常見的變形和錯字
      const variants = this.generateIntentVariants(intent);
      for (const variant of variants) {
        const cacheKey = `fuzzy:${variant}`;
        if (!this.fuzzyMatchCache.has(cacheKey)) {
          const fuzzyResult = this._computeFuzzyMatch(variant, intent);
          if (fuzzyResult.confidence > 0.6) {
            this.fuzzyMatchCache.set(cacheKey, fuzzyResult);
            candidateCount++;
          }
        }
      }
    }
    
    console.log(`   預載入模糊匹配: ${candidateCount} 項 (${Date.now() - startTime}ms)`);
  }

  /**
   * 🎯 Task 3.4: 生成Intent變形
   * @private
   */
  generateIntentVariants(intent) {
    const variants = [];
    
    // 簡體繁體變形
    const simplifiedVariants = intent.replace(/課程/g, '课程').replace(/記錄/g, '记录');
    if (simplifiedVariants !== intent) variants.push(simplifiedVariants);
    
    // 常見錯字變形
    const typoVariants = [
      intent.replace(/記錄/g, '紀錄'),
      intent.replace(/課程/g, '課程'),
      intent.replace(/查詢/g, '查询')
    ];
    
    variants.push(...typoVariants.filter(v => v !== intent));
    
    // 順序變形
    if (intent.includes('課程') && intent.includes('記錄')) {
      variants.push('課程記錄');
    }
    
    return [...new Set(variants)]; // 去重
  }

  /**
   * 🎯 Task 3.4: 計算模糊匹配（輔助方法）
   * @private
   */
  _computeFuzzyMatch(variant, target) {
    const similarity = this._calculateStringSimilarity(variant, target);
    return {
      mapped_intent: this.preComputedMappings.get(target.toLowerCase()) || 'unknown',
      original_intent: variant,
      confidence: similarity,
      mapping_source: 'precomputed_fuzzy'
    };
  }

  /**
   * 🎯 Task 3.4: 計算字符串相似度
   * @private
   */
  _calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    const distance = this._levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  /**
   * 🎯 Task 3.4: 初始化緩存統計
   * @private
   */
  initializeCacheStats() {
    this.cacheStats = {
      requests: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      lastReset: Date.now(),
      peakCacheSize: 0,
      avgResponseTime: 0,
      totalResponseTime: 0
    };
  }

  /**
   * 📈 Phase 3.2 核心功能：增強版Intent標準化
   * 支持模糊匹配、相似度計算、智能fallback
   * @param {string} intent - 原始intent
   * @param {Object} config - 配置選項
   * @returns {Object} 標準化結果
   */
  normalizeIntent(intent, config = {}) {
    if (!intent || typeof intent !== 'string') {
      return { 
        mapped_intent: 'unknown', 
        original_intent: intent, 
        mapping_source: 'none',
        confidence: 0 
      };
    }

    const cleanIntent = intent.trim();
    
    // 🎯 Task 3.3: 檢查是否為標準Intent，如果是則直接返回
    if (this._isStandardIntent(cleanIntent)) {
      this._recordCacheHit('standard');
      return {
        mapped_intent: cleanIntent,
        original_intent: cleanIntent,
        mapping_source: 'standard',
        confidence: 1.0
      };
    }
    
    // 🎯 Task 3.4: 增強版分層緩存檢查
    const requestStartTime = Date.now();
    this._recordCacheRequest();
    
    const cacheKey = `intent:${cleanIntent}`;
    
    // 1. 檢查預計算映射緩存（最快）
    if (this.intentMappingCache.has(cacheKey)) {
      this._recordCacheHit('precomputed', requestStartTime);
      return this.intentMappingCache.get(cacheKey);
    }
    
    // 2. 檢查模糊匹配緩存
    const fuzzyCacheKey = `fuzzy:${cleanIntent}`;
    if (this.fuzzyMatchCache.has(fuzzyCacheKey)) {
      this._recordCacheHit('fuzzy', requestStartTime);
      return this.fuzzyMatchCache.get(fuzzyCacheKey);
    }
    
    // 3. 檢查通用緩存
    if (this.matchCache.has(cacheKey)) {
      this._recordCacheHit('general', requestStartTime);
      return this.matchCache.get(cacheKey);
    }

    let result = null;

    // Level 1: 直接映射（最高優先級）
    result = this._directIntentMatch(cleanIntent);
    if (result.success) {
      const finalResult = {
        mapped_intent: result.mapped_intent,
        original_intent: cleanIntent,
        mapping_source: 'direct',
        confidence: 0.95
      };
      this._updateCache(cacheKey, finalResult);
      return finalResult;
    }

    // Level 2: 📊 新增 - 模糊字符匹配
    result = this._fuzzyIntentMatch(cleanIntent);
    if (result.success && result.confidence >= this.fuzzyMatchConfig.intent_similarity_threshold) {
      result.mapping_source = 'fuzzy';
      this._updateCache(cacheKey, result);
      return result;
    }

    // Level 3: 📊 新增 - 關鍵詞匹配
    result = this._keywordIntentMatch(cleanIntent);
    if (result.success && result.confidence >= this.fuzzyMatchConfig.keyword_match_threshold) {
      result.mapping_source = 'keyword';
      this._updateCache(cacheKey, result);
      return result;
    }

    // Level 4: 📊 新增 - 語義聚類匹配
    result = this._semanticClusterMatch(cleanIntent);
    if (result.success && result.confidence >= this.fuzzyMatchConfig.intent_similarity_threshold) {
      result.mapping_source = 'semantic';
      this._updateCache(cacheKey, result);
      return result;
    }

    // Level 5: Fallback patterns（保持原有邏輯）
    result = this._findFallbackIntent(cleanIntent);
    if (result.success) {
      result.mapping_source = 'fallback';
      result.confidence = 0.7;
      this._updateCache(cacheKey, result);
      return result;
    }

    // Level 6: 最終fallback
    const finalResult = {
      mapped_intent: 'unknown',
      original_intent: cleanIntent,
      mapping_source: 'none',
      confidence: 0
    };
    
    // 🎯 Task 3.4: 增強版緩存更新策略
    this._updateEnhancedCache(cacheKey, finalResult, requestStartTime);
    this._recordCacheMiss(requestStartTime);
    
    return finalResult;
  }

  /**
   * 📈 Phase 3.2 新增：模糊字符匹配
   * 使用編輯距離和相似度計算
   * @private
   */
  _fuzzyIntentMatch(intent) {
    const lowerIntent = intent.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // 檢查所有直接映射
    for (const [chineseIntent, standardIntent] of Object.entries(this.intentMap.intent_mappings)) {
      const similarity = this._calculateStringSimilarity(lowerIntent, chineseIntent.toLowerCase());
      if (similarity > bestScore && similarity >= this.fuzzyMatchConfig.intent_similarity_threshold) {
        bestScore = similarity;
        bestMatch = {
          success: true,
          mapped_intent: standardIntent,
          original_intent: intent,
          confidence: similarity,
          match_method: 'fuzzy_similarity'
        };
      }
    }

    return bestMatch || { success: false };
  }

  /**
   * 📈 Phase 3.2 新增：關鍵詞匹配
   * 基於關鍵詞提取和權重計算
   * @private
   */
  _keywordIntentMatch(intent) {
    const keywords = this._extractKeywords(intent);
    if (keywords.length === 0) return { success: false };

    // 關鍵詞權重映射
    const keywordWeights = {
      // 記錄類
      '記錄': { intent: 'record_course', weight: 0.9 },
      '新增': { intent: 'record_course', weight: 0.8 },
      '添加': { intent: 'record_course', weight: 0.8 },
      '安排': { intent: 'record_course', weight: 0.7 },
      '預約': { intent: 'record_course', weight: 0.7 },
      
      // 查詢類
      '查詢': { intent: 'query_schedule', weight: 0.9 },
      '查看': { intent: 'query_schedule', weight: 0.8 },
      '問': { intent: 'query_schedule', weight: 0.7 },
      '什麼': { intent: 'query_schedule', weight: 0.6 },
      '怎麼樣': { intent: 'query_course_content', weight: 0.8 },
      
      // 修改類
      '修改': { intent: 'modify_course', weight: 0.9 },
      '更改': { intent: 'modify_course', weight: 0.8 },
      '調整': { intent: 'modify_course', weight: 0.8 },
      '變更': { intent: 'modify_course', weight: 0.7 },
      
      // 取消類
      '取消': { intent: 'cancel_course', weight: 0.9 },
      '刪除': { intent: 'cancel_course', weight: 0.8 },
      '移除': { intent: 'cancel_course', weight: 0.7 },
      
      // 清空類
      '清空': { intent: 'clear_schedule', weight: 0.9 },
      '清除': { intent: 'clear_schedule', weight: 0.8 },
      '全部刪除': { intent: 'clear_schedule', weight: 0.9 }
    };

    let bestMatch = null;
    let bestScore = 0;

    // 計算每個關鍵詞的權重得分
    const intentScores = {};
    for (const keyword of keywords) {
      const weightInfo = keywordWeights[keyword];
      if (weightInfo) {
        if (!intentScores[weightInfo.intent]) {
          intentScores[weightInfo.intent] = 0;
        }
        intentScores[weightInfo.intent] += weightInfo.weight;
      }
    }

    // 找出最高得分的意圖
    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          success: true,
          mapped_intent: intent,
          original_intent: intent,
          confidence: Math.min(score, 1.0),
          match_method: 'keyword_weight'
        };
      }
    }

    return bestMatch || { success: false };
  }

  /**
   * 📈 Phase 3.2 新增：語義聚類匹配
   * 基於預定義的語義類別進行匹配
   * @private
   */
  _semanticClusterMatch(intent) {
    const semanticClusters = {
      'course_management': {
        patterns: ['課程', '課堂', '上課', '學習', '教學', '功課', '作業'],
        intents: ['record_course', 'modify_course', 'query_course_content']
      },
      'schedule_operations': {
        patterns: ['時間', '排程', '行程', '安排', '計劃', '預約'],
        intents: ['query_schedule', 'modify_course', 'record_course']
      },
      'content_operations': {
        patterns: ['內容', '資料', '信息', '記錄', '檔案', '照片'],
        intents: ['record_lesson_content', 'upload_class_photo', 'query_course_content']
      },
      'administrative': {
        patterns: ['提醒', '通知', '設定', '清空', '管理'],
        intents: ['set_reminder', 'clear_schedule', 'modify_course']
      }
    };

    let bestMatch = null;
    let bestScore = 0;

    for (const [clusterName, cluster] of Object.entries(semanticClusters)) {
      for (const pattern of cluster.patterns) {
        if (intent.includes(pattern)) {
          const confidence = 0.65; // 語義聚類的基礎信心度（略高於0.6）
          if (confidence > bestScore) {
            bestScore = confidence;
            // 選擇該聚類中最可能的意圖（簡單選擇第一個）
            bestMatch = {
              success: true,
              mapped_intent: cluster.intents[0],
              original_intent: intent,
              confidence: confidence,
              match_method: 'semantic_cluster',
              cluster: clusterName
            };
          }
        }
      }
    }

    return bestMatch || { success: false };
  }

  /**
   * 📈 Phase 3.2 增強版Entity標準化
   * 支持更智能的值映射和錯誤恢復
   * @param {Object} entities - 原始entities
   * @param {Object} config - 配置選項
   * @returns {Object} 標準化結果
   */
  normalizeEntities(entities, config = {}) {
    if (!entities || typeof entities !== 'object') {
      return {
        mapped_entities: {},
        original_entities: entities,
        normalization_applied: false,
        mapping_stats: { keys_mapped: 0, values_mapped: 0, errors: [] }
      };
    }

    const result = {
      mapped_entities: {},
      original_entities: entities,
      normalization_applied: true,
      mapping_stats: { 
        keys_mapped: 0, 
        values_mapped: 0, 
        errors: [],
        fuzzy_matches: 0,
        direct_matches: 0 
      }
    };

    try {
      for (const [key, value] of Object.entries(entities)) {
        // 🎯 增強版鍵名標準化
        const keyResult = this._enhancedNormalizeEntityKey(key, config);
        const normalizedKey = keyResult.mapped_key;
        
        if (keyResult.match_method === 'fuzzy') {
          result.mapping_stats.fuzzy_matches++;
        } else if (keyResult.match_method === 'direct') {
          result.mapping_stats.direct_matches++;
        }

        // 🎯 增強版值標準化
        const normalizedValue = this._enhancedNormalizeEntityValue(normalizedKey, value, config);
        
        result.mapped_entities[normalizedKey] = normalizedValue;
        
        if (keyResult.mapped) result.mapping_stats.keys_mapped++;
        if (normalizedValue !== value) result.mapping_stats.values_mapped++;
      }
    } catch (error) {
      result.mapping_stats.errors.push(`Entity normalization error: ${error.message}`);
      console.error('[EnhancedSemanticNormalizer] Entity標準化錯誤:', error);
    }

    return result;
  }

  /**
   * 📈 Phase 3.2 新增：增強版Entity鍵名標準化
   * 支持模糊匹配和相似度計算
   * @private
   */
  _enhancedNormalizeEntityKey(key, config = {}) {
    if (!key || typeof key !== 'string') {
      return { mapped_key: key, mapped: false, match_method: 'none' };
    }

    const cleanKey = key.trim();

    // Level 1: 直接映射
    const directMapping = this.entityKeyMap.entity_key_mappings[cleanKey];
    if (directMapping) {
      return { mapped_key: directMapping, mapped: true, match_method: 'direct' };
    }

    // Level 2: 📊 新增 - 模糊鍵名匹配  
    if (config.enable_fuzzy_key_matching !== false) {
      const fuzzyResult = this._fuzzyKeyMatch(cleanKey);
      if (fuzzyResult.success && fuzzyResult.confidence >= this.fuzzyMatchConfig.entity_similarity_threshold) { 
        return { 
          mapped_key: fuzzyResult.mapped_key, 
          mapped: true, 
          match_method: 'fuzzy',
          confidence: fuzzyResult.confidence 
        };
      }
    }

    // Level 3: Fallback patterns
    const fallbackMapping = this.entityKeyMap.fallback_patterns?.[cleanKey.toLowerCase()];
    if (fallbackMapping) {
      return { mapped_key: fallbackMapping, mapped: true, match_method: 'fallback' };
    }

    // Level 4: 檢查是否已經是標準鍵名
    if (this._isStandardEntityKey(cleanKey)) {
      return { mapped_key: cleanKey, mapped: false, match_method: 'standard' };
    }

    return { mapped_key: cleanKey, mapped: false, match_method: 'none' };
  }

  /**
   * 📈 Phase 3.2 新增：模糊鍵名匹配
   * @private
   */
  _fuzzyKeyMatch(key) {
    const lowerKey = key.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [chineseKey, standardKey] of Object.entries(this.entityKeyMap.entity_key_mappings)) {
      const similarity = this._calculateStringSimilarity(lowerKey, chineseKey.toLowerCase());
      if (similarity > bestScore && similarity >= this.fuzzyMatchConfig.entity_similarity_threshold) {
        bestScore = similarity;
        bestMatch = {
          success: true,
          mapped_key: standardKey,
          confidence: similarity
        };
      }
    }

    return bestMatch || { success: false };
  }

  /**
   * 📈 Phase 3.2 新增：增強版Entity值標準化
   * 支持更智能的值映射
   * @private
   */
  _enhancedNormalizeEntityValue(key, value, config) {
    if (value === null || value === undefined) return value;

    // 處理不同類型的值
    switch (typeof value) {
      case 'string':
        return this._enhancedNormalizeStringValue(key, value, config);
      case 'object':
        if (Array.isArray(value)) {
          return value.map(item => this._enhancedNormalizeEntityValue(key, item, config));
        } else {
          // 遞歸處理對象
          const normalizedObj = {};
          for (const [subKey, subValue] of Object.entries(value)) {
            const keyResult = this._enhancedNormalizeEntityKey(subKey, config);
            normalizedObj[keyResult.mapped_key] = this._enhancedNormalizeEntityValue(keyResult.mapped_key, subValue, config);
          }
          return normalizedObj;
        }
      case 'boolean':
      case 'number':
        return value;
      default:
        return value;
    }
  }

  /**
   * 📈 Phase 3.2 新增：增強版字符串值標準化
   * @private
   */
  _enhancedNormalizeStringValue(key, value, config) {
    if (!value || typeof value !== 'string') return value;

    const cleanValue = value.trim();

    // 根據鍵名類型決定映射策略
    if (key === 'course_name' || key.includes('course')) {
      return this._smartCourseNameMapping(cleanValue);
    } else if (key === 'confirmation' || key.includes('confirmation')) {
      return this._smartConfirmationMapping(cleanValue);
    } else if (key === 'performance' || key.includes('performance')) {
      return this._smartPerformanceMapping(cleanValue);
    } else if (key === 'grade' || key.includes('grade')) {
      return this._smartGradeMapping(cleanValue);
    } else if (key === 'time_phrase' || key === 'date_phrase' || key.includes('time') || key.includes('date')) {
      return this._smartTimeMapping(cleanValue);
    } else if (key === 'location' || key.includes('location')) {
      return this._smartLocationMapping(cleanValue);
    } else if (key.includes('mood')) {
      return this._smartMoodMapping(cleanValue);
    } else if (key.includes('status')) {
      return this._smartConfirmationMapping(cleanValue); // status可以當作confirmation處理
    } else {
      // 📊 新增：通用表情符號和特殊字符處理
      return this._smartGenericMapping(cleanValue);
    }
  }

  /**
   * 📈 Phase 3.2 新增：智能課程名稱映射
   * @private
   */
  _smartCourseNameMapping(courseName) {
    // 直接映射
    const directMapping = this.entityValueMap.common_course_names?.[courseName];
    if (directMapping) return directMapping;

    // 模糊匹配 (新增)
    const fuzzyMatch = this._findSimilarCourseName(courseName);
    if (fuzzyMatch.success && fuzzyMatch.confidence > 0.8) {
      return fuzzyMatch.mapped_name;
    }

    return courseName; // 保持原樣
  }

  /**
   * 📈 Phase 3.2 新增：智能確認信息映射
   * 處理更多樣化的確認表達
   * @private
   */
  _smartConfirmationMapping(confirmation) {
    const cleanConfirmation = confirmation.toLowerCase().trim();
    
    // 首先檢查數據文件中的映射
    if (this.entityValueMap.confirmation_mappings) {
      // 檢查嵌套結構
      for (const [categoryKey, category] of Object.entries(this.entityValueMap.confirmation_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapped = category[cleanConfirmation] || category[confirmation];
          if (mapped !== undefined) return mapped;
        }
      }
      
      // 檢查flat結構
      const directMapping = this.entityValueMap.confirmation_mappings[cleanConfirmation] || 
                            this.entityValueMap.confirmation_mappings[confirmation];
      if (directMapping !== undefined) return directMapping;
    }
    
    // Fallback to hardcoded mappings
    const enhancedConfirmationMap = {
      // 基本映射
      '是': true, '對': true, '好': true, '確認': true, '同意': true,
      'yes': true, 'ok': true, 'okay': true,
      '不是': false, '否': false, '不': false, '不同意': false, 'no': false,
      
      // 擴展映射
      '沒錯': true, '正確': true, '對的': true, '就是': true, '當然': true,
      '可以': true, '行': true, '好的': true, '沒問題': true,
      '不對': false, '錯': false, '不是的': false, '不可以': false, '不行': false,
      
      // 表情符號
      '👍': true, '✅': true, '✓': true,
      '👎': false, '❌': false, '✗': false
    };

    const mapped = enhancedConfirmationMap[cleanConfirmation];
    return mapped !== undefined ? mapped : confirmation;
  }

  /**
   * 📈 Phase 3.2 新增：智能表現評價映射
   * @private
   */
  _smartPerformanceMapping(performance) {
    const cleanPerformance = performance.toLowerCase().trim();
    
    // 首先檢查數據文件中的映射
    if (this.entityValueMap.performance_mappings) {
      // 檢查嵌套結構
      for (const [categoryKey, category] of Object.entries(this.entityValueMap.performance_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapped = category[cleanPerformance] || category[performance];
          if (mapped !== undefined) return mapped;
        }
      }
      
      // 檢查flat結構
      const directMapping = this.entityValueMap.performance_mappings[cleanPerformance] || 
                            this.entityValueMap.performance_mappings[performance];
      if (directMapping !== undefined) return directMapping;
    }
    
    // Fallback to hardcoded mappings
    const enhancedPerformanceMap = {
      // 優秀級別
      '很好': 'excellent', '非常好': 'excellent', '棒': 'excellent', '優秀': 'excellent',
      '完美': 'excellent', '傑出': 'excellent', '超棒': 'excellent', '頂呱呱': 'excellent',
      '厲害': 'excellent', '讚': 'excellent', 'a+': 'excellent', '100分': 'excellent',
      '👍': 'excellent', '💯': 'excellent', '🎉': 'excellent',
      
      // 良好級別
      '好': 'good', '不錯': 'good', '還可以': 'good', '還行': 'good',
      
      // 普通級別
      '普通': 'average', '一般': 'average', '馬馬虎虎': 'average', '中等': 'average',
      '😐': 'average',
      
      // 需要改進級別
      '差': 'poor', '不好': 'poor', '需要努力': 'poor', '有待改善': 'poor', '要加油': 'poor',
      '👎': 'poor', '😞': 'poor',
      
      // 進步指標
      '進步': 'improving', '有進步': 'improving', '變好': 'improving',
      '退步': 'declining', '變差': 'declining'
    };

    return enhancedPerformanceMap[performance] || enhancedPerformanceMap[cleanPerformance] || performance;
  }

  /**
   * 📈 Phase 3.2 新增：智能年級映射
   * @private
   */
  _smartGradeMapping(grade) {
    const cleanGrade = grade.toLowerCase().trim();
    
    // 檢查數據文件中的映射
    if (this.entityValueMap.student_info_mappings?.grade_levels) {
      const mapped = this.entityValueMap.student_info_mappings.grade_levels[grade] || 
                    this.entityValueMap.student_info_mappings.grade_levels[cleanGrade];
      if (mapped) return mapped;
    }
    
    // Fallback mappings
    const gradeMap = {
      '小一': 'grade_1', '小二': 'grade_2', '小三': 'grade_3', 
      '小四': 'grade_4', '小五': 'grade_5', '小六': 'grade_6',
      '國一': 'grade_7', '國二': 'grade_8', '國三': 'grade_9',
      '高一': 'grade_10', '高二': 'grade_11', '高三': 'grade_12',
      '一年級': 'grade_1', '二年級': 'grade_2', '三年級': 'grade_3',
      '四年級': 'grade_4', '五年級': 'grade_5', '六年級': 'grade_6'
    };
    
    return gradeMap[grade] || gradeMap[cleanGrade] || grade;
  }

  /**
   * 📈 Phase 3.2 新增：智能時間映射
   * @private
   */
  _smartTimeMapping(timePhrase) {
    const cleanTime = timePhrase.toLowerCase().trim();
    
    // 檢查數據文件中的映射
    if (this.entityValueMap.time_phrase_mappings) {
      // 檢查嵌套結構
      for (const [categoryKey, category] of Object.entries(this.entityValueMap.time_phrase_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapped = category[cleanTime] || category[timePhrase];
          if (mapped) return mapped;
        }
      }
      
      // 檢查flat結構
      const directMapping = this.entityValueMap.time_phrase_mappings[cleanTime] || 
                            this.entityValueMap.time_phrase_mappings[timePhrase];
      if (directMapping) return directMapping;
    }
    
    return timePhrase;
  }

  /**
   * 📈 Phase 3.2 新增：智能地點映射
   * @private
   */
  _smartLocationMapping(location) {
    const cleanLocation = location.toLowerCase().trim();
    
    // 檢查數據文件中的映射
    if (this.entityValueMap.location_mappings) {
      // 檢查嵌套結構
      for (const [categoryKey, category] of Object.entries(this.entityValueMap.location_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapped = category[cleanLocation] || category[location];
          if (mapped) return mapped;
        }
      }
      
      // 檢查flat結構
      const directMapping = this.entityValueMap.location_mappings[cleanLocation] || 
                            this.entityValueMap.location_mappings[location];
      if (directMapping) return directMapping;
    }
    
    return location;
  }

  /**
   * 📈 Phase 3.2 新增：智能情緒映射
   * @private
   */
  _smartMoodMapping(mood) {
    const cleanMood = mood.toLowerCase().trim();
    
    // 檢查數據文件中的映射
    if (this.entityValueMap.mood_indicators) {
      // 檢查嵌套結構
      for (const [categoryKey, category] of Object.entries(this.entityValueMap.mood_indicators)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapped = category[cleanMood] || category[mood];
          if (mapped) return mapped;
        }
      }
    }
    
    // Fallback mappings
    const moodMap = {
      '😊': 'happy', '😄': 'happy', '😁': 'happy', '🎉': 'excited',
      '😢': 'sad', '😠': 'angry', '😰': 'worried', '😴': 'tired',
      '開心': 'happy', '快樂': 'happy', '高興': 'happy', '興奮': 'excited',
      '難過': 'sad', '生氣': 'angry', '煩惱': 'worried'
    };
    
    return moodMap[mood] || moodMap[cleanMood] || mood;
  }

  /**
   * 📈 Phase 3.2 新增：通用智能映射
   * 處理表情符號和其他特殊字符
   * @private
   */
  _smartGenericMapping(value) {
    // 表情符號和特殊字符的通用映射
    const genericMap = {
      // 積極表情符號
      '👍': true, '✅': true, '✓': true, '😊': 'happy', '😄': 'happy', 
      '😁': 'happy', '🎉': 'excited', '👌': true, '💯': 'excellent',
      
      // 消極表情符號
      '👎': false, '❌': false, '✗': false, '😢': 'sad', '😠': 'angry',
      '😰': 'worried', '😴': 'tired', '💔': 'sad',
      
      // 中性表情符號
      '😐': 'average', '🤔': 'thinking', '😑': 'average',
      
      // 其他常見符號
      '✔': true, '×': false, '○': true, '◯': true, '●': true
    };

    return genericMap[value] || value;
  }

  /**
   * 📈 Phase 3.2 新增：計算字符串相似度
   * 使用編輯距離算法
   * @private
   */
  _calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0;

    // 使用簡化的編輯距離計算相似度
    const maxLen = Math.max(len1, len2);
    const distance = this._levenshteinDistance(str1, str2);
    
    return 1 - distance / maxLen;
  }

  /**
   * 計算編輯距離（Levenshtein距離）
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // 刪除
          matrix[j - 1][i] + 1,     // 插入
          matrix[j - 1][i - 1] + indicator  // 替換
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 📈 Phase 3.2 新增：提取關鍵詞
   * @private
   */
  _extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    
    // 移除標點符號和特殊字符，但保留中文和英文
    const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
    
    // 中文字符分割 - 每個中文字符作為獨立單元
    const chineseChars = cleanText.match(/[\u4e00-\u9fa5]/g) || [];
    
    // 英文單詞分割
    const englishWords = cleanText.match(/[a-zA-Z0-9]+/g) || [];
    
    // 合併所有詞彙
    const allWords = [...chineseChars, ...englishWords];
    
    // 移除停用詞
    const stopWords = ['的', '是', '在', '了', '和', '與', '或', '但', '而', '這', '那', '我', '你', '他', '她', '要', '一', '個', '有', '也', '都', '會', '可以', '能', '對', '從', '還', '就', '為', '到', '不', '沒', '上', '下', '大', '小', '多', '少', '好', '很', '非常'];
    
    return allWords.filter(word => {
      if (!word || word.length === 0) return false;
      if (stopWords.includes(word)) return false;
      if (/^\s+$/.test(word)) return false; // 純空白字符
      return true;
    });
  }

  /**
   * 📈 Phase 3.2 新增：尋找相似課程名稱
   * @private
   */
  _findSimilarCourseName(courseName) {
    if (!this.entityValueMap.common_course_names) {
      return { success: false };
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [knownName, standardName] of Object.entries(this.entityValueMap.common_course_names)) {
      const similarity = this._calculateStringSimilarity(courseName.toLowerCase(), knownName.toLowerCase());
      if (similarity > bestScore && similarity > 0.7) {
        bestScore = similarity;
        bestMatch = {
          success: true,
          mapped_name: standardName,
          confidence: similarity
        };
      }
    }

    return bestMatch || { success: false };
  }

  /**
   * 📈 Phase 3.2 新增：緩存管理
   * @private
   */
  _updateCache(key, value) {
    if (this.matchCache.size >= this.maxCacheSize) {
      // 簡單的LRU策略：刪除最舊的條目
      const firstKey = this.matchCache.keys().next().value;
      this.matchCache.delete(firstKey);
    }
    this.matchCache.set(key, value);
  }

  /**
   * 清除緩存
   */
  clearCache() {
    this.matchCache.clear();
    console.log('[EnhancedSemanticNormalizer] 緩存已清除');
  }

  /**
   * 🎯 Task 3.4: 獲取增強版緩存統計
   */
  getCacheStats() {
    const totalCacheSize = this.getTotalCacheSize();
    
    return {
      // 基礎統計
      total_cache_size: totalCacheSize,
      max_cache_size: this.maxCacheSize,
      cache_utilization: (totalCacheSize / this.maxCacheSize * 100).toFixed(2) + '%',
      
      // 分層緩存統計
      cache_breakdown: {
        general_cache: this.matchCache.size,
        intent_mapping_cache: this.intentMappingCache.size,
        entity_mapping_cache: this.entityMappingCache.size,
        fuzzy_match_cache: this.fuzzyMatchCache.size,
        precomputed_mappings: this.preComputedMappings.size
      },
      
      // 性能統計
      performance_stats: this.cacheStats ? {
        total_requests: this.cacheStats.requests,
        cache_hits: this.cacheStats.hits,
        cache_misses: this.cacheStats.misses,
        hit_ratio: (this.cacheStats.hitRatio * 100).toFixed(2) + '%',
        avg_response_time: this.cacheStats.avgResponseTime?.toFixed(2) + 'ms',
        peak_cache_size: this.cacheStats.peakCacheSize,
        uptime: Math.floor((Date.now() - this.cacheStats.lastReset) / 1000) + 's'
      } : null,
      
      // 優化建議
      optimization_suggestions: this._generateOptimizationSuggestions(totalCacheSize)
    };
  }

  /**
   * 🎯 Task 3.4: 生成優化建議
   * @private
   */
  _generateOptimizationSuggestions(totalCacheSize) {
    const suggestions = [];
    
    if (this.cacheStats) {
      const hitRatio = this.cacheStats.hitRatio;
      
      if (hitRatio < 0.5) {
        suggestions.push('緩存命中率偏低，建議增加預計算映射');
      } else if (hitRatio > 0.8) {
        suggestions.push('緩存命中率良好，性能優化效果顯著');
      }
      
      if (totalCacheSize > this.maxCacheSize * 0.9) {
        suggestions.push('緩存使用率高，建議考慮增加緩存容量');
      }
      
      if (this.cacheStats.avgResponseTime > 10) {
        suggestions.push('平均響應時間較高，建議優化映射算法');
      }
    }
    
    if (suggestions.length === 0) {
      suggestions.push('系統運行狀況良好，無需優化');
    }
    
    return suggestions;
  }

  // ==== 保持原有的方法 ====

  _directIntentMatch(intent) {
    // 檢查flat mappings
    const directMapping = this.intentMap.intent_mappings[intent];
    if (directMapping) {
      return { success: true, mapped_intent: directMapping };
    }

    // 檢查嵌套結構中的mappings
    if (this.intentMap.intent_mappings) {
      for (const [categoryKey, category] of Object.entries(this.intentMap.intent_mappings)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          const mapping = category[intent];
          if (mapping) {
            return { success: true, mapped_intent: mapping };
          }
        }
      }
    }

    return { success: false };
  }

  _findFallbackIntent(intent) {
    const lowerIntent = intent.toLowerCase();
    const matches = [];
    
    // 檢查nested fallback patterns
    if (this.intentMap.fallback_patterns) {
      for (const [categoryKey, category] of Object.entries(this.intentMap.fallback_patterns)) {
        if (categoryKey.startsWith('_') && typeof category === 'object') {
          for (const [pattern, mappedIntent] of Object.entries(category)) {
            if (lowerIntent.includes(pattern.toLowerCase())) {
              if (this._isValidIntent(mappedIntent)) {
                matches.push({ pattern, mappedIntent, length: pattern.length });
              }
            }
          }
        } else if (typeof category === 'string') {
          // 處理flat structure fallback patterns
          if (lowerIntent.includes(categoryKey.toLowerCase())) {
            if (this._isValidIntent(category)) {
              matches.push({ pattern: categoryKey, mappedIntent: category, length: categoryKey.length });
            }
          }
        }
      }
    }
    
    if (matches.length > 0) {
      matches.sort((a, b) => b.length - a.length);
      return { success: true, mapped_intent: matches[0].mappedIntent };
    }
    
    return { success: false };
  }

  _isValidIntent(intent) {
    return this.intentMap._standard_intents && this.intentMap._standard_intents.includes(intent);
  }

  _isStandardEntityKey(key) {
    return this.entityKeyMap._standard_entity_keys && this.entityKeyMap._standard_entity_keys.includes(key);
  }

  _loadDefaultMappings() {
    this.intentMap = {
      _standard_intents: ['record_course', 'query_schedule', 'modify_course', 'cancel_course', 'unknown'],
      intent_mappings: {
        '記錄課程': 'record_course',
        '查詢課表': 'query_schedule',
        '修改課程': 'modify_course',
        '取消課程': 'cancel_course'
      },
      fallback_patterns: {
        'record': 'record_course',
        'query': 'query_schedule',
        'modify': 'modify_course',
        'cancel': 'cancel_course'
      }
    };

    this.entityKeyMap = {
      _standard_entity_keys: ['course_name', 'student_name', 'time', 'date'],
      entity_key_mappings: {
        '課程名稱': 'course_name',
        '學生姓名': 'student_name',
        '時間': 'time',
        '日期': 'date'
      },
      fallback_patterns: {}
    };

    this.entityValueMap = {
      common_course_names: {},
      confirmation_mappings: { '是': true, '否': false },
      performance_mappings: { '好': 'good', '差': 'poor' },
      time_phrase_mappings: {},
      location_mappings: {}
    };
  }

  _calculateCacheHitRatio() {
    // 簡化實現，實際應該跟踪hit/miss統計
    return 0.75; // 假設75%命中率
  }

  /**
   * 獲取映射統計信息
   */
  getMappingStats() {
    return {
      intent_mappings: Object.keys(this.intentMap.intent_mappings || {}).length,
      entity_key_mappings: Object.keys(this.entityKeyMap.entity_key_mappings || {}).length,
      entity_value_mappings: Object.keys(this.entityValueMap.common_course_names || {}).length,
      standard_intents: (this.intentMap._standard_intents || []).length,
      cache_stats: this.getCacheStats(),
      fuzzy_config: this.fuzzyMatchConfig
    };
  }

  /**
   * 🎯 Task 3.4: 記錄緩存請求
   * @private
   */
  _recordCacheRequest() {
    if (this.cacheStats) {
      this.cacheStats.requests++;
    }
  }

  /**
   * 🎯 Task 3.4: 記錄緩存命中
   * @private
   */
  _recordCacheHit(cacheType, startTime = null) {
    if (this.cacheStats) {
      this.cacheStats.hits++;
      this.cacheStats.hitRatio = this.cacheStats.hits / this.cacheStats.requests;
      
      if (startTime) {
        const responseTime = Date.now() - startTime;
        this.cacheStats.totalResponseTime += responseTime;
        this.cacheStats.avgResponseTime = this.cacheStats.totalResponseTime / this.cacheStats.requests;
      }
    }
    
    // 更新緩存大小統計
    const currentCacheSize = this.matchCache.size + this.intentMappingCache.size + 
                             this.entityMappingCache.size + this.fuzzyMatchCache.size;
    if (this.cacheStats && currentCacheSize > this.cacheStats.peakCacheSize) {
      this.cacheStats.peakCacheSize = currentCacheSize;
    }
  }

  /**
   * 🎯 Task 3.4: 記錄緩存未命中
   * @private
   */
  _recordCacheMiss(startTime) {
    if (this.cacheStats) {
      this.cacheStats.misses++;
      this.cacheStats.hitRatio = this.cacheStats.hits / this.cacheStats.requests;
      
      const responseTime = Date.now() - startTime;
      this.cacheStats.totalResponseTime += responseTime;
      this.cacheStats.avgResponseTime = this.cacheStats.totalResponseTime / this.cacheStats.requests;
    }
  }

  /**
   * 🎯 Task 3.4: 增強版緩存更新策略
   * @private
   */
  _updateEnhancedCache(cacheKey, result, startTime) {
    // 根據結果類型選擇合適的緩存
    if (result.mapping_source === 'direct' || result.confidence > 0.9) {
      // 高信心度結果存入Intent專用緩存
      this.intentMappingCache.set(cacheKey, result);
    } else if (result.mapping_source === 'fuzzy' && result.confidence > 0.6) {
      // 模糊匹配結果存入模糊匹配緩存
      const fuzzyCacheKey = `fuzzy:${result.original_intent}`;
      this.fuzzyMatchCache.set(fuzzyCacheKey, result);
    } else {
      // 一般結果存入通用緩存
      this._updateCache(cacheKey, result);
    }
    
    // 管理緩存大小
    this._manageCacheSize();
  }

  /**
   * 🎯 Task 3.4: 智能緩存大小管理
   * @private
   */
  _manageCacheSize() {
    const totalCacheSize = this.matchCache.size + this.intentMappingCache.size + 
                          this.entityMappingCache.size + this.fuzzyMatchCache.size;
    
    if (totalCacheSize > this.maxCacheSize * 1.5) {
      // 使用LRU策略清理最少使用的緩存項目
      this._performLRUCleanup();
    }
  }

  /**
   * 🎯 Task 3.4: LRU緩存清理
   * @private
   */
  _performLRUCleanup() {
    const targetSize = Math.floor(this.maxCacheSize * 0.8);
    
    // 清理通用緩存（優先清理）
    while (this.matchCache.size > targetSize / 4 && this.matchCache.size > 0) {
      const firstKey = this.matchCache.keys().next().value;
      this.matchCache.delete(firstKey);
    }
    
    // 清理模糊匹配緩存
    while (this.fuzzyMatchCache.size > targetSize / 4 && this.fuzzyMatchCache.size > 0) {
      const firstKey = this.fuzzyMatchCache.keys().next().value;
      this.fuzzyMatchCache.delete(firstKey);
    }
    
    console.log(`[EnhancedSemanticNormalizer] LRU緩存清理完成，當前大小: ${this.getTotalCacheSize()}`);
  }

  /**
   * 🎯 Task 3.4: 獲取總緩存大小
   */
  getTotalCacheSize() {
    return this.matchCache.size + this.intentMappingCache.size + 
           this.entityMappingCache.size + this.fuzzyMatchCache.size;
  }

  /**
   * 🎯 Task 3.3: 檢查是否為標準Intent
   * @private
   * @param {string} intent - Intent字符串
   * @returns {boolean} 是否為標準Intent
   */
  _isStandardIntent(intent) {
    const standardIntents = [
      'record_course', 'create_recurring_course', 'modify_course',
      'modify_recurring_course', 'cancel_course', 'stop_recurring_course',
      'query_schedule', 'clear_schedule', 'query_today_courses_for_content',
      'set_reminder', 'record_lesson_content', 'record_homework',
      'upload_class_photo', 'query_course_content', 'modify_course_content',
      'correction_intent', 'unknown'
    ];
    
    return standardIntents.includes(intent);
  }

  /**
   * 更新模糊匹配配置
   */
  updateFuzzyConfig(newConfig) {
    this.fuzzyMatchConfig = { ...this.fuzzyMatchConfig, ...newConfig };
    console.log('[EnhancedSemanticNormalizer] 模糊匹配配置已更新:', this.fuzzyMatchConfig);
  }
}

// 單例模式
let instance = null;

function getEnhancedSemanticNormalizer() {
  if (!instance) {
    instance = new EnhancedSemanticNormalizer();
  }
  return instance;
}

module.exports = {
  EnhancedSemanticNormalizer,
  getEnhancedSemanticNormalizer
};