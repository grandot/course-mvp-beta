/**
 * EnhancedSemanticService - 增強版語義處理服務
 * 三層語意記憶系統 - Phase 3 實現
 * 
 * 職責：
 * - 整合三層記憶系統 (ConversationContext + Memory.yaml + SmartQueryEngine)
 * - 實現 Regex 優先 → GPT Fallback 智能分流機制
 * - 處理省略語句智能補全
 * - 提供完整的語義理解和實體提取
 * 
 * 架構：
 * Layer 1: ConversationContext (短期記憶, 5分鐘TTL)
 * Layer 2: Memory.yaml (語義背景, 用戶隔離YAML檔案)
 * Layer 3: SmartQueryEngine (實時查詢處理)
 */

// Phase 1/2 遺留組件已移除，統一使用 Phase 3 組件
const MemoryYamlService = require('./memoryYamlService');
const SmartQueryEngine = require('./smartQueryEngine');
const ConversationContext = require('../utils/conversationContext');
const EnhancedConversationContext = require('../utils/enhancedConversationContext');
const IntentRuleEngine = require('../utils/intentRuleEngine');
const OpenAIService = require('../internal/openaiService');
const DataService = require('./dataService');
const { getEnhancedSemanticNormalizer } = require('./enhancedSemanticNormalizer');
const { getMonitoringMiddleware } = require('../middleware/monitoringMiddleware');

class EnhancedSemanticService {
  constructor(config = {}) {
    
    // 三層記憶系統初始化
    this.memoryYamlService = new MemoryYamlService(config.memoryYaml || {});
    this.smartQueryEngine = new SmartQueryEngine();
    
    // 🎯 Task 3.3: 初始化增強版語義標準化器
    this.enhancedNormalizer = getEnhancedSemanticNormalizer();
    
    // 🎯 Task 3.5: 初始化監控中間件
    this.monitoringMiddleware = getMonitoringMiddleware();
    
    // 配置參數
    this.regexFirstPriority = config.regexFirstPriority !== false; // 預設啟用
    this.memoryInjectionEnabled = config.memoryInjectionEnabled !== false; // 預設啟用
    this.smartQueryBypass = config.smartQueryBypass !== false; // 預設啟用
    this.enhancedContextEnabled = config.enhancedContextEnabled !== false; // 預設啟用增強上下文
    this.useEnhancedNormalizer = config.useEnhancedNormalizer !== false; // 預設啟用增強標準化
    
    console.log('🚀 EnhancedSemanticService 初始化完成');
    console.log(`   Regex 優先機制: ${this.regexFirstPriority ? '✅' : '❌'}`);
    console.log(`   記憶注入: ${this.memoryInjectionEnabled ? '✅' : '❌'}`);
    console.log(`   SmartQuery 繞過: ${this.smartQueryBypass ? '✅' : '❌'}`);
    console.log(`   增強上下文: ${this.enhancedContextEnabled ? '✅' : '❌'}`);
    console.log(`   🎯 增強標準化器: ${this.useEnhancedNormalizer ? '✅' : '❌'}`);
  }

  /**
   * 🎯 主要方法：增強版訊息分析
   * 實現三層記憶協作的智能分流機制
   * @param {string} text 用戶輸入文本
   * @param {string} userId 用戶ID
   * @param {Object} context 上下文信息
   * @returns {Promise<Object>} 增強版語義分析結果
   */
  async analyzeMessage(text, userId, context = {}) {
    const startTime = Date.now();
    
    // 🎯 Task 3.5: 開始監控請求
    const requestId = `semantic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestInfo = this.monitoringMiddleware.beforeSemanticAnalysis(requestId, text, userId, context);
    
    try {
      console.log(`🔍 增強版語義分析開始: "${text}" [${userId}] [RequestID: ${requestId}]`);
      
      // Phase 1: SmartQuery 優先檢查 (Layer 3)
      if (this.smartQueryBypass) {
        const smartQueryResult = await this.handleSmartQueryFirst(text, userId);
        if (smartQueryResult) {
          console.log(`⚡ SmartQuery 直接回應 (${Date.now() - startTime}ms)`);
          return smartQueryResult;
        }
      }

      // Phase 2: 載入三層記憶
      const memoryLayers = await this.loadTripleMemory(userId);
      
      // Phase 3: Regex 優先 + Context 補全
      let regexResult = null;
      if (this.regexFirstPriority) {
        regexResult = await this.regexFirstWithContextEnhancement(text, userId, memoryLayers);
        
        // 檢查 Regex 結果完整性
        if (regexResult && this.isSlotExtractionComplete(regexResult)) {
          console.log(`✅ Regex 優先成功完成 (${Date.now() - startTime}ms)`);
          await this.updateTripleMemory(userId, regexResult, memoryLayers);
          return regexResult;
        }
      }

      // Phase 4: GPT Fallback with Memory Injection
      const gptResult = await this.gptFallbackWithMemory(text, userId, memoryLayers, regexResult);
      
      // Phase 5: 更新三層記憶
      await this.updateTripleMemory(userId, gptResult, memoryLayers);
      
      // 🎯 Task 3.3: 應用增強版語義標準化
      let finalResult = gptResult;
      if (this.useEnhancedNormalizer && gptResult) {
        finalResult = this.applyEnhancedNormalization(gptResult);
        console.log(`🎯 增強版語義分析完成 (${Date.now() - startTime}ms) [Enhanced Normalized]`);
      } else {
        console.log(`🎯 增強版語義分析完成 (${Date.now() - startTime}ms)`);
      }
      
      // 🎯 Task 3.5: 完成監控請求
      this.monitoringMiddleware.afterSemanticAnalysis(requestId, finalResult, {
        cacheHitRate: this.enhancedNormalizer?.getCacheStats()?.performance_stats?.hit_ratio / 100 || 0,
        normalizerTime: this.enhancedNormalizer?.getCacheStats()?.performance_stats?.avg_response_time || 0,
        cacheSize: this.enhancedNormalizer?.getCacheStats()?.total_cache_size || 0
      });
      
      return finalResult;
      
    } catch (error) {
      console.error(`❌ 增強版語義分析失敗:`, error.message);
      
      // 降級到語意控制器
      console.log(`🔄 降級到語意控制器`);
      const controllerResult = await SemanticController.analyze(text, context || {});
      
      // 🎯 適配新語意控制器返回格式到增強服務格式
      const fallbackResult = {
        success: true,
        intent: controllerResult.final_intent,
        confidence: controllerResult.confidence,
        entities: controllerResult.entities || {},
        method: `enhanced_fallback_${controllerResult.source}`,
        reasoning: controllerResult.reason,
        used_rule: controllerResult.used_rule,
        execution_time: controllerResult.execution_time,
        debug_info: controllerResult.debug_info,
        enhanced_context: context,
        fallback_reason: 'enhanced_service_error'
      };

      // 🎯 Task 3.3: 對fallback結果也應用增強標準化
      let finalFallbackResult = fallbackResult;
      if (this.useEnhancedNormalizer) {
        finalFallbackResult = this.applyEnhancedNormalization(fallbackResult);
      }
      
      // 🎯 Task 3.5: 監控錯誤處理的fallback結果
      this.monitoringMiddleware.afterSemanticAnalysis(requestId, finalFallbackResult, {
        cacheHitRate: 0, // fallback情況無緩存
        normalizerTime: 0,
        cacheSize: 0,
        error: error.message
      });
      
      return finalFallbackResult;
    }
  }

  /**
   * 🎯 Task 3.3: 應用增強版語義標準化
   * 將增強版SemanticNormalizer應用到分析結果
   * @param {Object} result - 語義分析結果
   * @returns {Object} 標準化後的結果
   */
  applyEnhancedNormalization(result) {
    if (!result || !this.enhancedNormalizer) {
      return result;
    }

    try {
      const normalizedResult = { ...result };

      // 標準化Intent
      if (result.intent) {
        const intentNormalization = this.enhancedNormalizer.normalizeIntent(result.intent);
        normalizedResult.intent = intentNormalization.mapped_intent;
        
        // 添加標準化元數據
        if (!normalizedResult.debug_info) normalizedResult.debug_info = {};
        normalizedResult.debug_info.intent_normalization = {
          original_intent: intentNormalization.original_intent,
          mapped_intent: intentNormalization.mapped_intent,
          mapping_source: intentNormalization.mapping_source,
          confidence: intentNormalization.confidence
        };
      }

      // 標準化Entities
      if (result.entities && typeof result.entities === 'object') {
        const entityNormalization = this.enhancedNormalizer.normalizeEntities(result.entities);
        normalizedResult.entities = entityNormalization.mapped_entities;
        
        // 添加標準化元數據
        if (!normalizedResult.debug_info) normalizedResult.debug_info = {};
        normalizedResult.debug_info.entity_normalization = {
          applied: entityNormalization.normalization_applied,
          mapping_stats: entityNormalization.mapping_stats,
          original_entities: entityNormalization.original_entities
        };
      }

      // 更新method標記
      if (normalizedResult.method) {
        normalizedResult.method = `${normalizedResult.method}_enhanced_normalized`;
      }

      return normalizedResult;

    } catch (error) {
      console.error('[EnhancedSemanticService] 標準化失敗:', error.message);
      return result; // 標準化失敗時返回原結果
    }
  }

  /**
   * Phase 1: SmartQuery 優先檢查處理
   * @param {string} text 用戶輸入
   * @param {string} userId 用戶ID
   * @returns {Promise<Object|null>} SmartQuery 結果或 null
   */
  async handleSmartQueryFirst(text, userId) {
    try {
      const queryResult = await this.smartQueryEngine.handleExplicitQuery(text, userId);
      
      if (queryResult) {
        return {
          success: true,
          method: 'smart_query_bypass',
          intent: 'explicit_query',
          confidence: 1.0,
          entities: null,
          data: queryResult.data,
          queryType: queryResult.queryType,
          bypassSemanticProcessing: true,
          source: 'smart_query_engine',
          analysis_time: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ SmartQuery 處理失敗:`, error.message);
      return null;
    }
  }

  /**
   * Phase 2: 載入三層記憶系統 (支援增強上下文)
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} 三層記憶數據
   */
  async loadTripleMemory(userId) {
    const startTime = Date.now();
    
    try {
      // Layer 1: ConversationContext (短期記憶) - 使用增強版或原版
      let conversationContext;
      if (this.enhancedContextEnabled) {
        conversationContext = EnhancedConversationContext.getContext(userId) || {};
        console.log(`📚 使用增強版 ConversationContext`);
      } else {
        conversationContext = ConversationContext.getContext(userId) || {};
        console.log(`📚 使用標準版 ConversationContext`);
      }
      
      // Layer 2: Memory.yaml (語義背景)
      const memoryYaml = await this.memoryYamlService.getUserMemory(userId);
      
      // Layer 3: 已在 handleSmartQueryFirst 中處理
      
      console.log(`📚 三層記憶載入完成 (${Date.now() - startTime}ms)`);
      console.log(`   - ConversationContext: ${Object.keys(conversationContext).length} 個鍵值`);
      console.log(`   - Memory.yaml: ${this.memoryYamlService.getTotalRecords(memoryYaml)} 筆記錄`);
      
      return {
        conversationContext,
        memoryYaml,
        loadTime: Date.now() - startTime,
        enhancedContext: this.enhancedContextEnabled
      };
      
    } catch (error) {
      console.error(`❌ 三層記憶載入失敗:`, error.message);
      return {
        conversationContext: {},
        memoryYaml: this.memoryYamlService.createEmptyUserMemory(userId),
        loadTime: Date.now() - startTime,
        error: error.message,
        enhancedContext: this.enhancedContextEnabled
      };
    }
  }

  /**
   * Phase 3: Regex 優先 + Context 補全機制
   * @param {string} text 用戶輸入
   * @param {string} userId 用戶ID
   * @param {Object} memoryLayers 三層記憶數據
   * @returns {Promise<Object|null>} Regex 分析結果或 null
   */
  async regexFirstWithContextEnhancement(text, userId, memoryLayers) {
    try {
      // 1. 基礎 Regex 分析
      const regexResult = IntentRuleEngine.analyzeIntent(text);
      
      if (!regexResult.success || regexResult.confidence < 0.7) {
        console.log(`📋 Regex 分析信心不足: ${regexResult.confidence}`);
        return null;
      }

      // 2. 使用三層記憶進行 Context 補全
      const enhancedResult = await this.enhanceWithTripleMemory(regexResult, text, userId, memoryLayers);
      
      // 3. 實體提取增強
      if (enhancedResult.entities) {
        enhancedResult.entities = this.enhanceEntityExtraction(enhancedResult.entities, memoryLayers);
      }

      console.log(`🎯 Regex + Context 增強完成: ${enhancedResult.intent}`);
      return {
        ...enhancedResult,
        method: 'regex_with_memory_enhancement',
        source: 'enhanced_regex_engine',
        memoryLayers: {
          used: ['conversation_context', 'memory_yaml'],
          loadTime: memoryLayers.loadTime
        }
      };
      
    } catch (error) {
      console.warn(`⚠️ Regex + Context 增強失敗:`, error.message);
      return null;
    }
  }

  /**
   * Phase 4: GPT Fallback with Memory Injection
   * @param {string} text 用戶輸入
   * @param {string} userId 用戶ID
   * @param {Object} memoryLayers 三層記憶數據
   * @param {Object|null} regexResult Regex 分析結果 (可能不完整)
   * @returns {Promise<Object>} GPT 分析結果
   */
  async gptFallbackWithMemory(text, userId, memoryLayers, regexResult = null) {
    try {
      console.log(`🤖 GPT Fallback 開始 (with Memory Injection)`);
      
      // 1. 生成記憶摘要注入 GPT prompt
      const memorySummary = await this.generateMemorySummary(memoryLayers);
      
      // 2. 增強 GPT prompt with memory context
      const enhancedPrompt = this.buildMemoryEnhancedPrompt(text, memorySummary, regexResult);
      
      // 3. 調用 OpenAI 進行語義分析 (使用更簡單的方法)
      let gptResult;
      try {
        gptResult = await OpenAIService.analyzeIntentWithSlots(enhancedPrompt, userId, {
          enableSlotExtraction: true,
          templateId: 'course_management',
          context: {
            hasMemory: memorySummary.length > 0,
            hasRegexFallback: !!regexResult,
            memoryRecordCount: this.memoryYamlService.getTotalRecords(memoryLayers.memoryYaml)
          }
        });
      } catch (openaiError) {
        console.warn('OpenAI analyzeIntentWithSlots 失敗，嘗試基礎方法:', openaiError.message);
        // 降級到基礎 OpenAI 調用
        gptResult = await OpenAIService.analyzeIntent(text, userId);
      }

      if (gptResult.success) {
        // 4. 轉換為標準格式
        const standardResult = this.convertGptResultToStandardFormat(gptResult, text, userId);
        
        console.log(`✅ GPT Fallback 成功: ${standardResult.intent}`);
        return {
          ...standardResult,
          method: 'gpt_fallback_with_memory',
          source: 'openai_with_memory_injection',
          memoryInjected: memorySummary.length > 0,
          regexFallback: !!regexResult
        };
      } else {
        throw new Error(`GPT 分析失敗: ${gptResult.error}`);
      }
      
    } catch (error) {
      console.error(`❌ GPT Fallback 失敗:`, error.message);
      
      // 最終降級：返回 Regex 結果或空結果
      if (regexResult) {
        console.log(`🔄 使用 Regex 結果作為最終降級`);
        return { ...regexResult, method: 'regex_final_fallback' };
      }
      
      return {
        success: false,
        method: 'enhanced_analysis_failed',
        intent: 'unknown',
        confidence: 0,
        entities: null,
        error: error.message,
        analysis_time: Date.now()
      };
    }
  }

  /**
   * Phase 5: 更新三層記憶系統
   * @param {string} userId 用戶ID
   * @param {Object} analysisResult 分析結果
   * @param {Object} memoryLayers 記憶層數據
   */
  async updateTripleMemory(userId, analysisResult, memoryLayers) {
    try {
      console.log(`💾 更新三層記憶系統...`);
      
      // 1. 更新 ConversationContext (Layer 1) - 使用增強版或原版
      if (analysisResult.success && analysisResult.intent !== 'explicit_query') {
        if (this.enhancedContextEnabled) {
          EnhancedConversationContext.updateContext(
            userId, 
            analysisResult.intent, 
            analysisResult.entities || {}, 
            analysisResult
          );
          console.log(`   ✅ EnhancedConversationContext 已更新`);
        } else {
          ConversationContext.updateContext(
            userId, 
            analysisResult.intent, 
            analysisResult.entities || {}, 
            analysisResult
          );
          console.log(`   ✅ ConversationContext 已更新`);
        }
      }

      // 2. 更新 Memory.yaml (Layer 2) - 僅課程相關意圖
      if (this.shouldUpdateMemoryYaml(analysisResult)) {
        const memoryUpdate = this.extractMemoryUpdateFromResult(analysisResult);
        if (memoryUpdate) {
          const updateResult = await this.memoryYamlService.updateUserMemory(userId, memoryUpdate);
          if (updateResult.success) {
            console.log(`   ✅ Memory.yaml 已更新 (${updateResult.recordCount} 筆記錄)`);
          } else {
            console.warn(`   ⚠️ Memory.yaml 更新失敗: ${updateResult.error}`);
          }
        }
      }

      // 3. SmartQueryEngine 不需要更新 (唯讀查詢)
      
    } catch (error) {
      console.error(`❌ 三層記憶更新失敗:`, error.message);
    }
  }

  /**
   * 使用三層記憶增強 Regex 結果
   * @param {Object} regexResult Regex 分析結果
   * @param {string} text 原始文本
   * @param {string} userId 用戶ID
   * @param {Object} memoryLayers 記憶層數據
   * @returns {Promise<Object>} 增強後結果
   */
  async enhanceWithTripleMemory(regexResult, text, userId, memoryLayers) {
    const enhanced = { ...regexResult };
    
    // 1. ConversationContext 補全
    const contextEnhancement = this.enhanceWithConversationContext(enhanced, memoryLayers.conversationContext);
    Object.assign(enhanced, contextEnhancement);
    
    // 2. Memory.yaml 補全
    const memoryEnhancement = this.enhanceWithMemoryYaml(enhanced, text, memoryLayers.memoryYaml);
    Object.assign(enhanced, memoryEnhancement);
    
    return enhanced;
  }

  /**
   * 使用 ConversationContext 增強結果
   * @param {Object} result 分析結果
   * @param {Object} context ConversationContext 數據
   * @returns {Object} 增強部分
   */
  enhanceWithConversationContext(result, context) {
    const enhancement = {};
    
    // 省略語句補全邏輯
    if (result.entities) {
      // 如果缺少學生名稱，嘗試從上下文補充
      if (!result.entities.student && context.lastStudent) {
        enhancement.entities = { ...result.entities, student: context.lastStudent };
        console.log(`🔄 從 ConversationContext 補全學生: ${context.lastStudent}`);
      }
      
      // 如果缺少課程名稱，嘗試從上下文補充
      if (!result.entities.courseName && context.lastCourse) {
        enhancement.entities = { ...enhancement.entities, courseName: context.lastCourse };
        console.log(`🔄 從 ConversationContext 補全課程: ${context.lastCourse}`);
      }
    }
    
    return enhancement;
  }

  /**
   * 使用 Memory.yaml 增強結果
   * @param {Object} result 分析結果
   * @param {string} text 原始文本
   * @param {Object} memoryYaml Memory.yaml 數據
   * @returns {Object} 增強部分
   */
  enhanceWithMemoryYaml(result, text, memoryYaml) {
    const enhancement = {};
    
    // 基於記憶的智能推斷
    if (result.entities && memoryYaml.students) {
      const students = Object.keys(memoryYaml.students);
      
      // 智能學生名稱推斷
      if (!result.entities.student && students.length === 1) {
        enhancement.entities = { ...result.entities, student: students[0] };
        console.log(`🧠 從 Memory.yaml 推斷唯一學生: ${students[0]}`);
      }
      
      // 課程上下文推斷
      if (result.entities.student && !result.entities.courseName) {
        const studentCourses = memoryYaml.students[result.entities.student]?.courses || [];
        if (studentCourses.length === 1) {
          enhancement.entities = { ...enhancement.entities, courseName: studentCourses[0].courseName };
          console.log(`🧠 從 Memory.yaml 推斷唯一課程: ${studentCourses[0].courseName}`);
        }
      }
    }
    
    return enhancement;
  }

  /**
   * 生成記憶摘要用於 GPT 注入
   * @param {Object} memoryLayers 記憶層數據
   * @returns {Promise<string>} 記憶摘要
   */
  async generateMemorySummary(memoryLayers) {
    let summary = '';
    
    // ConversationContext 摘要
    if (Object.keys(memoryLayers.conversationContext).length > 0) {
      summary += `會話上下文: 最近意圖=${memoryLayers.conversationContext.lastIntent || '無'}\n`;
    }
    
    // Memory.yaml 摘要
    if (memoryLayers.memoryYaml && Object.keys(memoryLayers.memoryYaml.students).length > 0) {
      const yamlSummary = await this.memoryYamlService.generateMemorySummary(memoryLayers.memoryYaml.userId);
      if (yamlSummary) {
        summary += yamlSummary;
      }
    }
    
    return summary;
  }

  /**
   * 構建記憶增強的 GPT prompt
   * @param {string} text 原始文本
   * @param {string} memorySummary 記憶摘要
   * @param {Object|null} regexResult Regex 結果
   * @returns {string} 增強的 prompt
   */
  buildMemoryEnhancedPrompt(text, memorySummary, regexResult) {
    let prompt = `分析以下用戶輸入的意圖和實體：\n\n用戶輸入："${text}"\n\n`;
    
    if (memorySummary) {
      prompt += `用戶記憶背景：\n${memorySummary}\n\n`;
    }
    
    if (regexResult) {
      prompt += `規則引擎分析參考：\n意圖=${regexResult.intent}, 信心=${regexResult.confidence}\n\n`;
    }
    
    prompt += `請基於記憶背景進行語義理解和實體提取。`;
    
    return prompt;
  }

  /**
   * 轉換 GPT 結果為標準格式
   * @param {Object} gptResult GPT 原始結果
   * @param {string} text 原始文本
   * @param {string} userId 用戶ID
   * @returns {Object} 標準格式結果
   */
  convertGptResultToStandardFormat(gptResult, text, userId) {
    return {
      success: true,
      intent: gptResult.intent || 'unknown',
      confidence: gptResult.confidence || 0.8,
      entities: gptResult.entities || null,
      context: { userId, originalText: text },
      analysis_time: Date.now(),
      gptRawResult: gptResult
    };
  }

  /**
   * 檢查實體提取是否完整
   * @param {Object} result 分析結果
   * @returns {boolean} 是否完整
   */
  isSlotExtractionComplete(result) {
    if (!result.success || !result.entities) {
      return false;
    }
    
    // 課程管理相關意圖的必要欄位檢查
    const courseIntents = ['add_course', 'modify_course', 'query_course', 'record_lesson_content'];
    
    if (courseIntents.includes(result.intent)) {
      // 必須有學生名稱和課程名稱
      return !!(result.entities.student && result.entities.courseName);
    }
    
    return true; // 其他意圖視為完整
  }

  /**
   * 判斷是否應該更新 Memory.yaml
   * @param {Object} result 分析結果
   * @returns {boolean} 是否更新
   */
  shouldUpdateMemoryYaml(result) {
    if (!result.success) return false;
    
    const memoryIntents = [
      'add_course', 'modify_course', 'record_lesson_content',
      'upload_class_photo', 'set_reminder'
    ];
    
    return memoryIntents.includes(result.intent);
  }

  /**
   * 從分析結果提取 Memory.yaml 更新數據
   * @param {Object} result 分析結果
   * @returns {Object|null} 更新數據
   */
  extractMemoryUpdateFromResult(result) {
    if (!result.entities) return null;
    
    const { student, courseName, course_name, schedule, teacher, location, notes } = result.entities;
    
    // 處理不同的命名格式
    const finalCourseName = courseName || course_name;
    
    if (!student || !finalCourseName) return null;
    
    return {
      student,
      courseName: finalCourseName,
      schedule: schedule || {},
      teacher,
      location,
      notes
    };
  }

  /**
   * 增強實體提取
   * @param {Object} entities 原始實體
   * @param {Object} memoryLayers 記憶層數據
   * @returns {Object} 增強後實體
   */
  enhanceEntityExtraction(entities, memoryLayers) {
    const enhanced = { ...entities };
    
    // 基於記憶的實體標準化
    if (entities.student && memoryLayers.memoryYaml.students) {
      const studentNames = Object.keys(memoryLayers.memoryYaml.students);
      // 模糊匹配學生名稱
      const matchedStudent = studentNames.find(name => 
        name.includes(entities.student) || entities.student.includes(name)
      );
      if (matchedStudent) {
        enhanced.student = matchedStudent;
      }
    }
    
    return enhanced;
  }

  /**
   * 獲取服務統計信息 (包含增強上下文統計)
   * @returns {Object} 統計信息
   */
  getServiceStats() {
    const baseStats = {
      memoryYamlStats: this.memoryYamlService.getServiceStats(),
      smartQueryStats: this.smartQueryEngine.getQueryStats(),
      configuration: {
        regexFirstPriority: this.regexFirstPriority,
        memoryInjectionEnabled: this.memoryInjectionEnabled,
        smartQueryBypass: this.smartQueryBypass,
        enhancedContextEnabled: this.enhancedContextEnabled
      }
    };

    // 如果啟用增強上下文，添加增強統計
    if (this.enhancedContextEnabled) {
      baseStats.enhancedContextStats = EnhancedConversationContext.getEnhancedStats();
    } else {
      baseStats.conversationContextStats = ConversationContext.getStats();
    }

    return baseStats;
  }

  /**
   * 🆕 智能預測用戶下一步操作 (如果啟用增強上下文)
   * @param {string} userId 用戶ID
   * @param {string} currentIntent 當前意圖
   * @returns {Object|null} 預測結果
   */
  predictUserNextAction(userId, currentIntent) {
    if (!this.enhancedContextEnabled) {
      console.log('⚠️ 預測功能需要啟用增強上下文');
      return null;
    }

    return EnhancedConversationContext.predictNextAction(userId, currentIntent);
  }
}

module.exports = EnhancedSemanticService;