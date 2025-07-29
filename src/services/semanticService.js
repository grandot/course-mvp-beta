/**
 * SemanticService - 語義處理統一入口
 * 職責：意圖識別、實體提取、上下文分析
 * Phase 4: 整合規則引擎 + OpenAI 後備流程
 * Phase 5: 增加會話上下文支持和糾錯意圖處理
 */
const IntentRuleEngine = require('../utils/intentRuleEngine');
const OpenAIService = require('../internal/openaiService');
const DataService = require('./dataService');
const TimeService = require('./timeService');
const ConversationContext = require('../utils/conversationContext');

// Slot Template System 整合 (可選功能)
let SlotTemplateManager = null;
try {
  SlotTemplateManager = require('../slot-template/slotTemplateManager');
} catch (error) {
  // Slot Template System 尚未啟用或初始化失敗
  console.log('[SemanticService] Slot Template System 未啟用');
}

class SemanticService {
  constructor() {
    // Slot Template Manager 實例 (延遲初始化)
    this.slotTemplateManager = null;
    this.slotTemplateEnabled = false;
    this.slotTemplateInitialized = false;
  }

  /**
   * 初始化 Slot Template System (延遲初始化)
   */
  initializeSlotTemplateSystem() {
    // 避免重複初始化
    if (this.slotTemplateInitialized) {
      return;
    }
    
    if (SlotTemplateManager) {
      try {
        this.slotTemplateManager = new SlotTemplateManager();
        this.slotTemplateEnabled = true;
        this.slotTemplateInitialized = true;
        console.log('[SemanticService] Slot Template System 已啟用 (延遲初始化)');
      } catch (error) {
        console.warn('[SemanticService] Slot Template System 初始化失敗:', error.message);
        this.slotTemplateEnabled = false;
        this.slotTemplateInitialized = true; // 標記為已嘗試，避免重複
      }
    }
  }

  // 🚀 性能優化：條件式調試日誌（生產環境自動關閉）
  static debugLog(...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  }
  /**
   * 分析用戶訊息的整體語義 - 支援 Slot Template System
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @param {Object} options - 選項 { enableSlotTemplate: boolean }
   * @returns {Promise<Object>} 語義分析結果
   */
  async analyzeMessageWithSlotTemplate(text, userId, context = {}, options = {}) {
    const { enableSlotTemplate = true, useEnhancedExtraction = true } = options;
    
    // 延遲初始化 Slot Template System
    this.initializeSlotTemplateSystem();
    
    // Step 1: 如果啟用增強提取，使用新的 OpenAI 方法
    let semanticResult;
    if (useEnhancedExtraction) {
      SemanticService.debugLog(`[SemanticService] 使用增強版 Slot 提取`);
      try {
        const enhancedResult = await OpenAIService.analyzeIntentWithSlots(text, userId, {
          enableSlotExtraction: true,
          templateId: 'course_management'
        });
        
        if (enhancedResult.success) {
          // 轉換增強結果為標準 SemanticService 格式
          semanticResult = this.convertEnhancedResultToStandardFormat(enhancedResult, text, userId, context);
        } else {
          // 回退到標準語意分析
          console.warn('[SemanticService] 增強版提取失敗，回退到標準方法');
          semanticResult = await SemanticService.analyzeMessage(text, userId, context);
        }
      } catch (error) {
        console.warn('[SemanticService] 增強版提取出錯，回退到標準方法:', error.message);
        semanticResult = await SemanticService.analyzeMessage(text, userId, context);
      }
    } else {
      // 使用標準語意分析
      semanticResult = await SemanticService.analyzeMessage(text, userId, context);
    }
    
    // Step 2: 如果啟用並且可用，使用 Slot Template System 處理 (任務 4.3.1 & 4.3.2)
    if (enableSlotTemplate && this.slotTemplateEnabled && semanticResult.success) {
      SemanticService.debugLog(`[SemanticService] 使用 Slot Template System 與問題檢測處理語意結果`);
      
      try {
        // 增強語意結果格式以支援 Slot Template
        const enhancedSemanticResult = {
          ...semanticResult,
          text: text // 🚨 添加原始文本用於補充意圖檢測
        };
        
        // 🚨 使用新的帶問題檢測的處理方法
        const slotResult = await this.slotTemplateManager.processWithProblemDetection(
          userId, 
          enhancedSemanticResult
        );
        
        // 合併結果
        return {
          ...semanticResult,
          slotTemplate: slotResult,
          usedSlotTemplate: true,
          usedProblemDetection: true, // 🚨 新增標記
          usedEnhancedExtraction: useEnhancedExtraction,
          originalSemanticResult: semanticResult
        };
        
      } catch (error) {
        console.warn('[SemanticService] Slot Template 處理失敗，回退到標準結果:', error.message);
        
        // 回退到標準語意分析結果
        return {
          ...semanticResult,
          slotTemplate: null,
          usedSlotTemplate: false,
          usedEnhancedExtraction: useEnhancedExtraction,
          slotTemplateError: error.message
        };
      }
    }
    
    // 返回標準語意分析結果
    return {
      ...semanticResult,
      usedSlotTemplate: false,
      usedEnhancedExtraction: useEnhancedExtraction
    };
  }

  /**
   * 轉換增強結果為標準 SemanticService 格式
   * @param {Object} enhancedResult - 增強版分析結果
   * @param {string} text - 原始文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文
   * @returns {Object} 標準格式結果
   */
  convertEnhancedResultToStandardFormat(enhancedResult, text, userId, context) {
    const { analysis } = enhancedResult;
    
    // 將 slot_state 轉換為 entities 格式
    const entities = {};
    if (analysis.slot_state) {
      entities.course_name = analysis.slot_state.course;
      entities.location = analysis.slot_state.location;
      entities.teacher = analysis.slot_state.teacher;
      entities.confirmation = null; // 這個欄位不在 slot_state 中
      
      // 處理時間信息
      if (analysis.slot_state.date || analysis.slot_state.time) {
        entities.timeInfo = {};
        if (analysis.slot_state.date) entities.timeInfo.date = analysis.slot_state.date;
        if (analysis.slot_state.time) entities.timeInfo.time = analysis.slot_state.time;
        
        // 創建完整的時間信息對象
        if (entities.timeInfo.date && entities.timeInfo.time) {
          entities.timeInfo.start = `${entities.timeInfo.date}T${entities.timeInfo.time}:00Z`;
          // 假設課程時長為1小時
          const endTime = this.calculateEndTime(entities.timeInfo.time, 60);
          entities.timeInfo.end = `${entities.timeInfo.date}T${endTime}:00Z`;
        }
      }
    }
    
    return {
      success: true,
      method: 'enhanced_openai',
      intent: analysis.intent,
      confidence: analysis.confidence,
      entities,
      context,
      reasoning: analysis.reasoning,
      usage: enhancedResult.usage,
      analysis_time: Date.now(),
      slotState: analysis.slot_state, // 保留原始 slot_state 用於 Slot Template System
      extractionDetails: analysis.extraction_details
    };
  }

  /**
   * 計算結束時間
   * @param {string} startTime - 開始時間 (HH:mm 格式)
   * @param {number} durationMinutes - 持續時間(分鐘)
   * @returns {string} 結束時間 (HH:mm 格式)
   */
  calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * 分析用戶訊息的整體語義 (原有方法，保持向後兼容)
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 語義分析結果
   */
  static async analyzeMessage(text, userId, context = {}) {
    this.debugLog(`🔧 [DEBUG] SemanticService.analyzeMessage - 開始分析: "${text}"`);
    this.debugLog(`🔧 [DEBUG] SemanticService.analyzeMessage - UserId: ${userId}`);

    if (!text || typeof text !== 'string') {
      throw new Error('SemanticService: text must be a non-empty string');
    }

    if (!userId) {
      throw new Error('SemanticService: userId is required');
    }

    try {
      // 檢查是否有等待補充資訊的上下文
      const pendingContext = ConversationContext.getPendingContext(userId);

      // Step 0: 🎯 檢測純時間輸入 - 拒絕處理歧義性極高的極端情況
      // 僅在沒有等待補充的上下文時執行
      if (!pendingContext) {
        const pureTimeInputCheck = SemanticService.detectPureTimeInput(text);
        if (pureTimeInputCheck.isPureTimeInput) {
          this.debugLog(`🔧 [DEBUG] SemanticService - 檢測到純時間輸入，拒絕處理: ${text}`);
          return {
            success: false,
            method: 'rejected_pure_time',
            intent: 'ambiguous_input',
            confidence: 0,
            entities: null,
            context,
            message: pureTimeInputCheck.rejectionMessage,
            analysis_time: Date.now(),
          };
        }
      }

      // Step 1: 先嘗試規則引擎分析獲取意圖上下文
      this.debugLog(`🔧 [DEBUG] SemanticService - 開始規則引擎分析`);
      let ruleResult = IntentRuleEngine.analyzeIntent(text);
      this.debugLog(`🔧 [DEBUG] SemanticService - 規則引擎結果:`, ruleResult);
      
      // Step 1.5: 🔧 處理糾錯意圖 - 需要會話上下文
      let finalIntent = ruleResult.intent;
      let entities = null;
      let processedTimeInfo = null;
      
      if (ruleResult.intent === 'correction_intent') {
        this.debugLog(`🔧 [DEBUG] SemanticService - 檢測到糾錯意圖，嘗試從會話上下文解析`);
        
        // 檢查是否有有效的會話上下文
        const hasContext = ConversationContext.hasValidContext(userId);
        if (hasContext) {
          // 從上下文解析實體
          entities = ConversationContext.resolveEntitiesFromContext(userId, text);
          // 處理當前輸入的時間信息（糾錯的新時間）
          processedTimeInfo = await this.processTimeInfo(text);
          
          // 將糾錯意圖映射為修改課程意圖進行後續處理
          finalIntent = 'modify_course';
          ruleResult.intent = 'modify_course';
          ruleResult.confidence = Math.min(ruleResult.confidence + 0.1, 1.0); // 提高信心度
          
          console.log(`🔧 [DEBUG] SemanticService - 糾錯意圖處理完成，映射為: ${finalIntent}, 課程: ${entities?.course_name}`); // [REMOVE_ON_PROD]
        } else {
          console.log(`🔧 [DEBUG] SemanticService - 糾錯意圖但無會話上下文，回退到普通處理`); // [REMOVE_ON_PROD]
          // 沒有上下文，使用普通流程處理
          entities = await this.extractCourseEntities(text, userId, ruleResult.intent);
          processedTimeInfo = await this.processTimeInfo(text);
          
          // 保持原始意圖，但降低信心度
          ruleResult.confidence = Math.max(ruleResult.confidence - 0.3, 0.1);
        }
      } else {
        // Step 2: 💡 利用意圖上下文進行語義理解的實體提取（非糾錯意圖）
        this.debugLog(`🔧 [DEBUG] SemanticService - 開始實體提取`);
        entities = await this.extractCourseEntities(text, userId, ruleResult.intent);
        processedTimeInfo = await this.processTimeInfo(text);
      }
      
      this.debugLog(`🔧 [DEBUG] SemanticService - 實體提取結果:`, entities);
      this.debugLog(`🔧 [DEBUG] SemanticService - 時間處理結果:`, processedTimeInfo);

      // Step 3: 二進制判斷 - 規則匹配就用規則，不匹配就用 AI
      if (ruleResult.confidence > 0 && finalIntent !== 'unknown') {
        // 高信心度：使用規則引擎結果
        this.debugLog(`🔧 [DEBUG] SemanticService - 使用規則引擎結果 (高信心度: ${ruleResult.confidence})`);
        const result = {
          success: true,
          method: 'rule_engine',
          intent: finalIntent,
          confidence: ruleResult.confidence,
          entities: {
            course_name: entities.course_name,
            location: entities.location,
            teacher: entities.teacher,
            student: entities.student, // 🚨 新增學生信息
            confirmation: entities.confirmation,
            recurrence_pattern: entities.recurrence_pattern, // 🔧 Phase 3: 新增重複模式
            timeInfo: processedTimeInfo,
          },
          context,
          analysis_time: Date.now(),
        };
        
        // 🔧 更新會話上下文（除了糾錯意圖，因為已經在上面處理過了）
        if (ruleResult.intent !== 'correction_intent') {
          this.updateConversationContext(userId, finalIntent, entities, result);
        }
        
        return result;
      }
      // 低信心度：調用 OpenAI 作為後備
      this.debugLog(`🔧 [DEBUG] SemanticService - 調用 OpenAI 作為後備 (低信心度: ${ruleResult.confidence})`);
      const openaiResult = await OpenAIService.analyzeIntent(text, userId);
      this.debugLog(`🔧 [DEBUG] SemanticService - OpenAI 分析結果:`, openaiResult);

      // 記錄 token 使用量
      if (openaiResult.usage) {
        const cost = OpenAIService.calculateCost(
          openaiResult.usage.total_tokens,
          openaiResult.model,
        );

        await DataService.logTokenUsage({
          user_id: userId,
          model: openaiResult.model,
          total_tokens: openaiResult.usage.total_tokens,
          total_cost_twd: cost,
          user_message: text,
        });
      }

      if (openaiResult.success) {
        // OpenAI 成功返回結構化結果
        const { analysis } = openaiResult;
        const result = {
          success: true,
          method: 'openai',
          intent: analysis.intent,
          confidence: analysis.confidence,
          entities: {
            course_name: analysis.entities.course_name,
            location: analysis.entities.location,
            teacher: analysis.entities.teacher,
            student: analysis.entities.student || entities.student, // 🚨 優先使用 OpenAI 提取的學生信息
            confirmation: entities.confirmation,
            // ✅ 使用統一處理的時間信息
            timeInfo: processedTimeInfo,
          },
          context,
          reasoning: analysis.reasoning,
          usage: openaiResult.usage,
          analysis_time: Date.now(),
        };
        
        // 🔧 更新會話上下文
        this.updateConversationContext(userId, analysis.intent, result.entities, result);
        
        return result;
      }
      // OpenAI 無法解析，回退到規則引擎結果
      const fallbackResult = {
        success: true,
        method: 'rule_engine_fallback',
        intent: finalIntent,
        confidence: ruleResult.confidence,
        entities: {
          course_name: entities.course_name,
          location: entities.location,
          teacher: entities.teacher,
          student: entities.student, // 🚨 新增學生信息
          confirmation: entities.confirmation,
          recurrence_pattern: entities.recurrence_pattern, // 🔧 Phase 3: 新增重複模式
          // ✅ 使用統一處理的時間信息
          timeInfo: processedTimeInfo,
        },
        context,
        openai_error: openaiResult.error,
        usage: openaiResult.usage,
        analysis_time: Date.now(),
      };
      
      // 🔧 更新會話上下文（除了糾錯意圖）
      if (ruleResult.intent !== 'correction_intent') {
        this.updateConversationContext(userId, finalIntent, entities, fallbackResult);
      }
      
      return fallbackResult;
    } catch (error) {
      // 所有方法失敗，返回錯誤信息
      return {
        success: false,
        error: error.message,
        method: 'error',
        intent: 'unknown',
        confidence: 0.0,
        entities: {
          course_name: null,
          location: null,
          teacher: null,
          confirmation: null,
          timeInfo: null,
        },
        context,
        analysis_time: Date.now(),
      };
    }
  }

  /**
   * 提取課程相關實體信息
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {string} intentHint - 意圖提示，用於上下文理解
   * @returns {Promise<Object>} 課程實體信息
   */
  static async extractCourseEntities(text, userId = null, intentHint = null) {
    if (!text) {
      return {
        course_name: null,
        location: null,
        teacher: null,
        student: null,
        confirmation: null,
      };
    }

    // 🚨 架構重構：OpenAI優先，正則fallback
    console.log(`🔧 [DEBUG] 🚨🚨🚨 架構重構 - 開始OpenAI完整實體提取: "${text}"`);
    
    // Step 1: 優先使用 OpenAI 完整實體提取
    let openaiResult;
    try {
      console.log(`🔧 [DEBUG] 🚨 正在調用 OpenAI.extractAllEntities...`);
      openaiResult = await OpenAIService.extractAllEntities(text);
      console.log(`🔧 [DEBUG] 🚨 OpenAI調用完成:`, openaiResult);
    } catch (error) {
      console.error(`🔧 [ERROR] 🚨 OpenAI調用失敗:`, error);
      openaiResult = { success: false, error: error.message };
    }
    
    if (openaiResult.success && openaiResult.entities) {
      console.log(`🔧 [DEBUG] OpenAI實體提取成功:`, openaiResult.entities);
      
      const entities = openaiResult.entities;
      let courseName = entities.course_name;
      let student = entities.student;
      let location = entities.location;
      
      // 🚨 重要：處理OpenAI提取的時間和日期信息
      let extractedDateTime = '';
      
      // 合併日期和時間短語
      if (entities.date_phrase) {
        extractedDateTime += entities.date_phrase;
      }
      if (entities.time_phrase) {
        extractedDateTime += entities.time_phrase;
      }
      
      console.log(`🔧 [DEBUG] OpenAI時間合併: "${extractedDateTime}"`);
      
      // 🚨 關鍵：用提取的日期時間替換原始文本進行時間處理
      if (extractedDateTime) {
        text = extractedDateTime; // 例如: "明天早上十點"
      }
      
      // 執行模糊匹配（如果需要）
      if (userId && courseName && (intentHint === 'modify_course' || intentHint === 'cancel_course')) {
        courseName = await this.performFuzzyMatching(courseName, userId);
      }
      
      return await this.buildEntityResult(text, courseName, location, student, arguments[0]); // 傳遞處理後文本和原始文本
    }
    
    // Step 2: OpenAI失敗，fallback到正則表達式智能分離
    console.log(`🔧 [DEBUG] 🚨 OpenAI提取失敗，fallback到正則表達式分離。原因:`, openaiResult.error || 'Unknown');
    
    return await this.extractEntitiesWithRegex(text, userId, intentHint);
  }

  /**
   * 🚨 新增：使用正則表達式進行實體提取（fallback方法）
   */
  static async extractEntitiesWithRegex(text, userId, intentHint) {
    // 傳統的正則提取邏輯
    let courseName = this.extractCourseNameByRegex(text);
    
    // 如果正則也失敗，嘗試單獨調用OpenAI課程名提取
    if (!courseName) {
      courseName = await OpenAIService.extractCourseName(text);
    }

    // 💡 語義理解增強：如果 AI 提取失敗，使用意圖上下文智能提取
    if (!courseName && intentHint && userId) {
      courseName = await this.intelligentCourseExtraction(text, intentHint, userId);
    }

    // 執行模糊匹配（如果需要）
    if (userId && courseName && (intentHint === 'modify_course' || intentHint === 'cancel_course')) {
      courseName = await this.performFuzzyMatching(courseName, userId);
    }

    // 🚨 智能分離：從混雜內容中提取地點、學生
    let location = null;
    let student = null;
    
    // 檢測混雜模式：「日期+地點+時間+學生+課程」  
    // 🚨 修復：明確限制學生姓名為2個字符，使用正向先行斷言確保課程匹配
    const smartExtraction = /^(明天|後天|今天|昨天)?(前台|後台|一樓|二樓|三樓|四樓|五樓)?(下午|上午|晚上|早上)?(一點|兩點|三點|四點|五點|六點|七點|八點|九點|十點|十一點|十二點|[0-9]+點)?(小[\u4e00-\u9fff]{1,2})?([\u4e00-\u9fff]*課)$/;
    const smartMatch = text.match(smartExtraction);
    if (smartMatch) {
      console.log(`🔧 [DEBUG] 正則智能分離成功: 日期="${smartMatch[1]}", 地點="${smartMatch[2]}", 模糊時間="${smartMatch[3]}", 具體時間="${smartMatch[4]}", 學生="${smartMatch[5]}", 課程="${smartMatch[6]}"`);
      if (smartMatch[2]) location = smartMatch[2];
      if (smartMatch[5]) student = smartMatch[5];
      // 🚨 同時更新課程名稱，使用分離出的課程
      if (smartMatch[6]) courseName = smartMatch[6];
      
      // 🚨 重要：處理智能分離出的時間和日期信息
      let extractedDateTime = '';
      
      // 處理日期
      if (smartMatch[1]) {
        extractedDateTime += smartMatch[1]; // "後天"
      }
      
      // 處理時間
      if (smartMatch[3] || smartMatch[4]) {
        const vagueTime = smartMatch[3]; // 下午、上午等
        const specificTime = smartMatch[4]; // 兩點、三點等
        
        // 合併模糊時間和具體時間
        if (vagueTime && specificTime) {
          extractedDateTime += vagueTime + specificTime; // "後天下午兩點"
        } else if (specificTime) {
          extractedDateTime += specificTime; // "兩點"
        } else if (vagueTime) {
          extractedDateTime += vagueTime; // "下午"
        }
      }
      
      console.log(`🔧 [DEBUG] 正則時間合併: "${extractedDateTime}"`);
      
      // 🚨 關鍵：用提取的日期時間替換原始文本進行時間處理
      if (extractedDateTime) {
        text = extractedDateTime; // 例如: "後天下午兩點"
      }
    }
    
    return await this.buildEntityResult(text, courseName, location, student, arguments[0]); // 傳遞處理後文本和原始文本
  }

  /**
   * 🚨 新增：執行模糊匹配
   */
  static async performFuzzyMatching(courseName, userId) {
    try {
      const dataService = require('./dataService');
      const existingCourses = await dataService.getUserCourses(userId, { status: 'scheduled' });
      
      // 模糊匹配：尋找包含提取到課程名稱的課程
      const matchedCourse = existingCourses.find(course => {
        const existingName = course.course_name.toLowerCase();
        const extractedName = courseName.toLowerCase();
        
        // 雙向匹配：提取的名稱包含在現有課程中，或現有課程包含在提取的名稱中
        return existingName.includes(extractedName) || extractedName.includes(existingName);
      });
      
      if (matchedCourse) {
        return matchedCourse.course_name; // 使用完整的課程名稱
      }
    } catch (error) {
      // 模糊匹配失敗不影響原有流程
      console.warn('Course fuzzy matching failed:', error.message);
    }
    return courseName;
  }

  /**
   * 🚨 新增：構建最終的實體結果
   */
  static async buildEntityResult(text, courseName, location, student, originalText = null) {
    // 使用原始文本進行重複模式提取（如果提供）
    const textForRecurrencePattern = originalText || text;
    
    // 如果智能分離未成功，使用傳統模式提取地點
    if (!location) {
      const locationPatterns = [
        /在(.+?)教室/,
        /在(.+?)上課/,
        /地點[：:](.+)/,
        /(.+?)教室/,
        /(.+?)大樓/,
        /(前台|後台|一樓|二樓|三樓|四樓|五樓)/,
      ];

      locationPatterns.forEach((pattern) => {
        if (!location) {
          const match = text.match(pattern);
          if (match) {
            location = match[1] ? match[1].trim() : match[0].trim();
            // 清理不必要的詞語
            location = location.replace(/上課|在|教室$/, '').trim();
            if (location && !location.includes('樓')) {
              location += '教室'; // 統一格式
            }
          }
        }
      });
    }

    // 提取老師 (避免和地點信息混淆)
    let teacher = null;
    const teacherPatterns = [
      /上([一-龯]{1,3})老師/, // "上王老師"
      /上([一-龯]{1,3})教授/, // "上李教授"
      /([一-龯]{1,3})老師的/, // "王老師的"
      /([一-龯]{1,3})教授的/, // "李教授的"
      /老師[：:]([一-龯]{1,3})/,
      /教授[：:]([一-龯]{1,3})/,
    ];

    teacherPatterns.forEach((pattern) => {
      if (!teacher) {
        const match = text.match(pattern);
        if (match && match[1]) {
          teacher = match[1].trim();
        }
      }
    });

    // 檢查是否為確認回應
    let confirmation = null;
    if (text === '確認清空' || text === '確認') {
      confirmation = '確認清空';
    }

    // 🔧 Phase 3: 添加重複模式提取
    let recurrence_pattern = null;
    const recurrencePatterns = [
      /每週/, /weekly/, /每天/, /daily/, /每月/, /monthly/,
      /重複/, /定期/, /固定/, /循環/, /週期性/
    ];

    for (const pattern of recurrencePatterns) {
      if (pattern.test(textForRecurrencePattern)) {
        // 保留完整的重複模式信息，不要簡化
        if (/每週.*[一二三四五六日]|每周.*[一二三四五六日]/.test(textForRecurrencePattern)) {
          // 提取完整的週重複模式，如 "每週二"
          const weekMatch = textForRecurrencePattern.match(/(每週.*[一二三四五六日]|每周.*[一二三四五六日])/);
          recurrence_pattern = weekMatch ? weekMatch[1] : '每週';
        } else if (/每週|每周|weekly/.test(textForRecurrencePattern)) {
          recurrence_pattern = '每週';
        } else if (/每天|每日|daily/.test(textForRecurrencePattern)) {
          recurrence_pattern = '每天';
        } else if (/每月.*\d+號|每月/.test(textForRecurrencePattern)) {
          // 提取完整的月重複模式，如 "每月15號"
          const monthMatch = textForRecurrencePattern.match(/(每月.*\d+號|每月)/);
          recurrence_pattern = monthMatch ? monthMatch[1] : '每月';
        } else {
          recurrence_pattern = '每週'; // 預設為每週
        }
        break;
      }
    }

    // 🔧 修復：添加時間信息處理
    const timeInfo = await this.processTimeInfo(text);

    return {
      courseName, // 統一使用駝峰式命名
      course_name: courseName, // 保持向後兼容
      location,
      teacher,
      student, // 🚨 新增學生信息
      confirmation,
      recurrence_pattern, // 🔧 Phase 3: 新增重複模式
      timeInfo, // 新增時間信息
    };
  }

  /**
   * 統一處理時間信息（避免重複調用）
   * @param {string} text - 用戶輸入文本
   * @returns {Promise<Object|null>} 處理後的時間信息
   */
  static async processTimeInfo(text) {
    if (!text) return null;

    try {
      const timeInfo = await this.extractTimeInfo(text);

      // 使用 TimeService 統一創建時間信息對象
      return timeInfo?.parsed_time
        ? TimeService.createTimeInfo(timeInfo.parsed_time)
        : null;
    } catch (error) {
      console.warn('Time processing failed:', error.message);
      return null;
    }
  }

  /**
   * 提取時間相關信息（內部使用）
   * @param {string} text - 用戶輸入文本
   * @returns {Promise<Object>} 時間信息
   */
  static async extractTimeInfo(text) {
    if (!text) {
      return {
        time: null,
        date: null,
        parsed_time: null,
      };
    }

    try {
      // 🔧 修復：直接使用完整文本進行時間解析，避免 OpenAI 提取遺漏
      let parsedTime = null;
      try {
        // 直接用完整文本解析，TimeService 已經能處理複雜時間表達
        parsedTime = await TimeService.parseTimeString(text);
      } catch (parseError) {
        // 如果直接解析失敗，嘗試使用 OpenAI 輔助提取
        console.log(`🔧 [DEBUG] 直接時間解析失敗，嘗試 OpenAI 輔助提取: ${parseError.message}`);
        
        const time = await OpenAIService.extractTime(text);
        const date = await OpenAIService.extractDate(text);
        
        if (time || date) {
          const timeString = [date, time].filter(Boolean).join(' ') || time || text;
          parsedTime = await TimeService.parseTimeString(timeString);
        }
      }

      return {
        time: null, // 保持舊接口兼容
        date: null, // 保持舊接口兼容
        parsed_time: parsedTime,
      };
    } catch (error) {
      return {
        time: null,
        date: null,
        parsed_time: null,
        error: error.message,
      };
    }
  }

  /**
   * 識別用戶意圖
   * @param {string} text - 用戶輸入文本
   * @param {Object} context - 上下文信息
   * @returns {Promise<string>} 意圖類型
   */
  static async identifyIntent(text) {
    if (!text) {
      return 'unknown';
    }

    try {
      // 直接使用規則引擎進行意圖識別
      const result = IntentRuleEngine.analyzeIntent(text);
      return result.intent;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 智能課程提取 - 利用意圖上下文進行語義理解
   * @param {string} text - 用戶輸入文本
   * @param {string} intent - 意圖類型
   * @param {string} userId - 用戶ID
   * @returns {Promise<string|null>} 提取的課程名稱
   */
  static async intelligentCourseExtraction(text, intent, userId) {
    try {
      // 1. 根據意圖分析語義模式
      let candidateNames = [];
      
      switch (intent) {
        case 'modify_course':
        case 'cancel_course': {
          // 修改/取消意圖：提取動作前的主要名詞
          const modifyPatterns = [
            /^([^修改取消刪除調整更改變更改成改到換成換到]+)(?=修改|取消|刪除|調整|更改|變更|改成|改到|換成|換到)/,
            /^([^改]+)改成/,
            /^([^改]+)改到/,
            /^([^換]+)換成/,
            /^([^換]+)換到/,
          ];
          
          for (const pattern of modifyPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              const candidate = match[1].trim();
              if (candidate && candidate.length >= 2 && candidate.length <= 10) {
                candidateNames.push(candidate);
              }
            }
          }
          break;
        }
        
        case 'record_course': {
          // 新增意圖：提取主要名詞，但避免時間詞彙
          const recordPatterns = [
            /^([^今明後下週月日年時點分]+)(?=課|班|時間|在|上)/,
            /([^今明後下週月日年時點分\d]+)課/,
            /([^今明後下週月日年時點分\d]+)班/,
          ];
          
          for (const pattern of recordPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              const candidate = match[1].trim();
              if (candidate && candidate.length >= 2 && candidate.length <= 10) {
                candidateNames.push(candidate);
              }
            }
          }
          break;
        }
      }
      
      // 2. 過濾候選名稱：排除時間、動作詞彙
      const timeWords = ['上午', '下午', '晚上', '早上', '中午', '點', '分', '時間', '今天', '明天', '後天', '週', '月', '日', '年'];
      const actionWords = ['修改', '取消', '刪除', '調整', '更改', '變更', '改成', '改到', '換成', '換到', '新增', '安排'];
      
      candidateNames = candidateNames.filter(name => {
        const cleanName = name.trim();
        return cleanName && 
               !timeWords.some(word => cleanName.includes(word)) &&
               !actionWords.some(word => cleanName.includes(word)) &&
               !/\d/.test(cleanName); // 排除數字
      });
      
      // 3. 與用戶現有課程進行智能匹配
      if (candidateNames.length > 0) {
        const dataService = require('./dataService');
        const existingCourses = await dataService.getUserCourses(userId, { status: 'scheduled' });
        
        // 優先匹配現有課程
        for (const candidate of candidateNames) {
          const matchedCourse = existingCourses.find(course => {
            const existingName = course.course_name.toLowerCase();
            const candidateName = candidate.toLowerCase();
            
            // 多種匹配策略
            return existingName.includes(candidateName) || 
                   candidateName.includes(existingName) ||
                   existingName.replace(/課$/, '') === candidateName ||
                   candidateName === existingName.replace(/課$/, '');
          });
          
          if (matchedCourse) {
            console.log(`Intelligent extraction matched: "${candidate}" -> "${matchedCourse.course_name}"`);
            return matchedCourse.course_name;
          }
        }
        
        // 如果沒有匹配現有課程，返回最佳候選
        const bestCandidate = candidateNames[0];
        console.log(`Intelligent extraction candidate: "${bestCandidate}"`);
        return bestCandidate;
      }
      
      return null;
    } catch (error) {
      console.warn('Intelligent course extraction failed:', error.message);
      return null;
    }
  }

  /**
   * 驗證語義分析結果
   * @param {Object} analysisResult - 分析結果
   * @returns {Promise<boolean>} 驗證是否通過
   */
  static async validateAnalysis(analysisResult) {
    if (!analysisResult || typeof analysisResult !== 'object') {
      return false;
    }

    // 檢查必要字段
    const requiredFields = ['success', 'intent', 'confidence'];
    const missingField = requiredFields.some((field) => !(field in analysisResult));
    if (missingField) {
      return false;
    }

    // 檢查信心度範圍
    if (typeof analysisResult.confidence !== 'number'
        || analysisResult.confidence < 0
        || analysisResult.confidence > 1) {
      return false;
    }

    // 檢查意圖類型
    const validIntents = [
      'cancel_course',
      'record_course',
      'query_schedule',
      'modify_course',
      'set_reminder',
      'clear_schedule',
      'correction_intent',
      'unknown',
    ];

    if (!validIntents.includes(analysisResult.intent)) {
      return false;
    }

    return true;
  }

  /**
   * 🎯 檢測純時間輸入 - 拒絕處理歧義性極高的極端情況
   * @param {string} text - 用戶輸入文本
   * @returns {Object} 檢測結果 {isPureTimeInput: boolean, rejectionMessage: string}
   */
  static detectPureTimeInput(text) {
    const trimmedText = text.trim();
    
    // 🎯 第一性原則：極其保守的純時間檢測 - 只攔截明顯的純時間
    // 避免誤傷正常的課程創建請求
    
    // 1. 先快速檢查：如果輸入很長，很可能包含課程信息
    if (trimmedText.length > 15) {
      return { isPureTimeInput: false };
    }
    
    // 2. 極其精確的純時間模式 - 只匹配明顯的純時間
    const strictPureTimePatterns = [
      // 純時段
      /^(早上|上午|中午|下午|晚上|夜晚)$/,
      
      // 純數字時間  
      /^\d{1,2}[點時]$/,
      /^\d{1,2}[點時]半$/,
      /^\d{1,2}:\d{2}$/,
      
      // 純中文數字時間
      /^(十一|十二|一|二|兩|三|四|五|六|七|八|九|十)[點时]$/,
      /^(十一|十二|一|二|兩|三|四|五|六|七|八|九|十)[點时]半$/,
      
      // 日期+時段（無具體時間）
      /^(今天|明天|後天|昨天|前天)(早上|上午|中午|下午|晚上|夜晚)$/,
      
      // 日期+時段+數字時間（但沒有課程名）
      /^(今天|明天|後天|昨天|前天)(早上|上午|中午|下午|晚上|夜晚)[0-9]+點$/,
      /^(今天|明天|後天|昨天|前天)(早上|上午|中午|下午|晚上|夜晚)(十一|十二|一|二|兩|三|四|五|六|七|八|九|十)[點时]$/,
      
      // 時段+數字時間
      /^(早上|上午|中午|下午|晚上|夜晚)[0-9]+點$/,
      /^(早上|上午|中午|下午|晚上|夜晚)(十一|十二|一|二|兩|三|四|五|六|七|八|九|十)[點时]$/
    ];
    
    // 3. 檢查是否匹配嚴格的純時間模式
    const isPureTime = strictPureTimePatterns.some(pattern => pattern.test(trimmedText));
    
    if (isPureTime) {
      const rejectionMessage = `我需要更清楚的課程資訊才能幫您安排。僅提供時間「${trimmedText}」無法確定您的具體需求。\n\n請完整輸入課程資訊，例如：「明天下午3點數學課」、「後天早上10點鋼琴課」`;
      
      return {
        isPureTimeInput: true,
        rejectionMessage
      };
    }
    
    return { isPureTimeInput: false };
  }

  /**
   * 更新會話上下文
   * @param {string} userId - 用戶ID
   * @param {string} intent - 意圖類型
   * @param {Object} entities - 提取的實體
   * @param {Object} result - 執行結果（可選）
   */
  static updateConversationContext(userId, intent, entities, result = null) {
    // 只有特定意圖才需要更新會話上下文
    const contextUpdateIntents = [
      'record_course',
      'modify_course', 
      'cancel_course',
    ];

    if (!contextUpdateIntents.includes(intent)) {
      return;
    }

    // 只有提取到課程名稱才更新上下文
    if (entities?.course_name) {
      ConversationContext.updateContext(userId, intent, entities, result);
      this.debugLog(`🔧 [DEBUG] SemanticService - 已更新會話上下文: ${intent} -> ${entities.course_name}`);
    }
  }

  /**
   * 🚀 性能優化：使用正則表達式快速提取課程名稱
   * @param {string} text - 輸入文本
   * @returns {string|null} 提取的課程名稱
   */
  static extractCourseNameByRegex(text) {
    if (!text || typeof text !== 'string') return null;

    // 🚨 智能分離：檢測混雜內容並分離課程名稱
    const mixedPattern = /.*([明後今昨]天).*([下午晚早中]午|[0-9]+點).*([\u4e00-\u9fff]{1,3})(課|班|學習)/;
    const mixedMatch = text.match(mixedPattern);
    if (mixedMatch) {
      console.log(`🔧 [DEBUG] 檢測到混雜內容，智能分離: "${text}"`);
      // 嘗試提取真正的課程名稱
      const potentialCourse = text.match(/([\u4e00-\u9fff]{2,6})(課|班)/);
      if (potentialCourse) {
        return potentialCourse[0];
      }
    }

    // 常見課程名稱模式
    const coursePatterns = [
      // 才藝類 + 課
      /(鋼琴|小提琴|大提琴|吉他|爵士鼓|薩克斯風|長笛|二胡|古箏|琵琶|笛子|唱歌|聲樂|合唱|舞蹈|芭蕾|街舞|國標舞|民族舞|現代舞|繪畫|素描|水彩|油畫|國畫|書法|陶藝|雕塑|直排輪|游泳|籃球|足球|排球|網球|桌球|羽毛球|棒球|跆拳道|空手道|柔道|劍道|瑜珈|有氧|健身|田徑|體操|攀岩|滑板)課?/g,
      // 學科名稱
      /(數學|國文|英文|物理|化學|生物|歷史|地理|公民|音樂|美術|體育|電腦|程式|作文|閱讀|口語|聽力|發音|文法|單字|會話)課?/g,
      // 語言課程
      /(中文|英語|日文|韓文|法文|德文|西班牙文|義大利文|俄文|阿拉伯文)課?/g,
      // 直接課程名 + 課/班等
      /([^\s，。！？]+(?:課|班|課程|課堂|學習|訓練))/g,
    ];

    for (const pattern of coursePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 智能過濾：排除包含時間/地點/人名的匹配
        for (const match of matches) {
          const courseName = match.trim();
          // 排除明顯的混雜內容
          if (!/(前台|後台|下午|上午|晚上|早上|明天|今天|昨天|[0-9]+點|小[一-龯]{1,2})/g.test(courseName)) {
            if (courseName.length >= 2 && courseName.length <= 10) {
              return courseName.endsWith('課') ? courseName : courseName + '課';
            }
          }
        }
      }
    }

    // 如果沒有匹配到特定模式，嘗試提取主要名詞
    const nounPattern = /([一-龯a-zA-Z0-9]{2,8})(?=課|班|學習|上課|下課|時間|地點|老師)/;
    const nounMatch = text.match(nounPattern);
    if (nounMatch && nounMatch[1]) {
      return nounMatch[1].trim();
    }

    return null;
  }

  /**
   * 創建支援 Slot Template System 的 SemanticService 實例
   * @returns {SemanticService} SemanticService 實例
   */
  static createWithSlotTemplate() {
    return new SemanticService();
  }

  /**
   * 檢查 Slot Template System 是否可用
   * @returns {boolean} 是否可用
   */
  static isSlotTemplateAvailable() {
    return SlotTemplateManager !== null;
  }

  /**
   * 獲取 Slot Template 系統狀態
   * @returns {Object} 系統狀態
   */
  static getSlotTemplateStatus() {
    return {
      available: SlotTemplateManager !== null,
      version: SlotTemplateManager ? '1.0.0' : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 分析重複課程語義 (Phase 1.3 - 重複課程功能)
   * @param {string} text - 用戶輸入文本
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 重複課程分析結果
   */
  static async analyzeRecurringCourse(text, context = {}) {
    this.debugLog(`🔧 [DEBUG] SemanticService.analyzeRecurringCourse - 分析重複課程: "${text}"`);

    if (!text || typeof text !== 'string') {
      throw new Error('SemanticService: text must be a non-empty string');
    }

    try {
      // 檢測重複模式關鍵詞
      const recurringPatterns = {
        daily: ['每天', '每日', '天天'],
        weekly: ['每週', '每周', '每星期', '週一', '週二', '週三', '週四', '週五', '週六', '週日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        monthly: ['每月', '每個月', '月初', '月中', '月底']
      };

      let recurrenceType = null;
      let daysOfWeek = [];
      let dayOfMonth = null;

      // 識別重複類型
      for (const [type, keywords] of Object.entries(recurringPatterns)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          recurrenceType = type;

          if (type === 'weekly') {
            daysOfWeek = this.extractDaysOfWeek(text);
          } else if (type === 'monthly') {
            dayOfMonth = this.extractDayOfMonth(text);
          }

          break;
        }
      }

      if (!recurrenceType) {
        return {
          success: false,
          isRecurring: false,
          reason: 'No recurring pattern detected'
        };
      }

      // 提取課程名稱
      const courseName = await this.extractCourseName(text);
      if (!courseName) {
        return {
          success: false,
          isRecurring: true,
          recurrenceType,
          reason: 'Course name not found'
        };
      }

      // 提取時間資訊
      const timeInfo = await this.extractTimeInfo(text);
      if (!timeInfo.parsed_time) {
        return {
          success: false,
          isRecurring: true,
          recurrenceType,
          courseName,
          reason: 'Time information not found'
        };
      }

      // 將時間轉換為 HH:MM 格式
      const timeOfDay = this.formatTimeToHHMM(timeInfo.parsed_time);

      // 計算智能起始日期
      const startDate = TimeService.calculateSmartStartDate(
        recurrenceType,
        timeOfDay,
        TimeService.getCurrentUserTime(),
        daysOfWeek,
        dayOfMonth
      );

      return {
        success: true,
        intent: 'create_recurring_course',
        isRecurring: true,
        recurrenceType, // 新增：將重複類型放在根層級
        entities: {
          course_name: courseName,
          recurrenceType,
          timeInfo: {
            ...TimeService.createTimeInfo(timeInfo.parsed_time),
            recurring: {
              type: recurrenceType,
              days_of_week: daysOfWeek,
              day_of_month: dayOfMonth,
              start_date: startDate,
              time_of_day: timeOfDay
            }
          }
        },
        recurrence_details: {
          type: recurrenceType,
          days_of_week: daysOfWeek,
          day_of_month: dayOfMonth,
          start_date: startDate,
          time_of_day: timeOfDay
        },
        analysis_time: Date.now()
      };

    } catch (error) {
      this.debugLog(`❌ SemanticService.analyzeRecurringCourse - 錯誤: ${error.message}`);
      return {
        success: false,
        error: error.message,
        isRecurring: false,
        analysis_time: Date.now()
      };
    }
  }

  /**
   * 提取星期幾信息
   * @param {string} text - 用戶輸入文本
   * @returns {Array} 星期幾數字陣列 (0=週日, 1=週一, ..., 6=週六)
   */
  static extractDaysOfWeek(text) {
    const dayMap = {
      '週一': 1, '週二': 2, '週三': 3, '週四': 4, 
      '週五': 5, '週六': 6, '週日': 0,
      '周一': 1, '周二': 2, '周三': 3, '周四': 4, 
      '周五': 5, '周六': 6, '周日': 0,
      '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, 
      '星期五': 5, '星期六': 6, '星期日': 0,
      '禮拜一': 1, '禮拜二': 2, '禮拜三': 3, '禮拜四': 4, 
      '禮拜五': 5, '禮拜六': 6, '禮拜日': 0
    };

    const days = [];
    for (const [day, num] of Object.entries(dayMap)) {
      if (text.includes(day)) {
        days.push(num);
      }
    }

    // 去重並排序
    const uniqueDays = [...new Set(days)].sort((a, b) => a - b);

    // 如果沒有具體指定星期幾，但使用了"每週"或"每周"，默認週一
    if (uniqueDays.length === 0 && (text.includes('每週') || text.includes('每周') || text.includes('每星期'))) {
      uniqueDays.push(1); // 預設週一
    }

    return uniqueDays;
  }

  /**
   * 提取月份中的日期
   * @param {string} text - 用戶輸入文本
   * @returns {number} 日期數字 (1-31)
   */
  static extractDayOfMonth(text) {
    // 提取月份中的日期（如：5號、15號）
    const match = text.match(/(\d{1,2})號/);
    if (match) {
      const day = parseInt(match[1]);
      return (day >= 1 && day <= 31) ? day : 1;
    }

    // 檢查特殊情況
    if (text.includes('月初')) return 1;
    if (text.includes('月中')) return 15;
    if (text.includes('月底')) return 30;

    return 1; // 預設1號
  }

  /**
   * 提取課程名稱 (簡化版本，可以調用現有方法)
   * @param {string} text - 用戶輸入文本
   * @returns {Promise<string|null>} 課程名稱
   */
  static async extractCourseName(text) {
    // 先嘗試正則表達式快速提取
    let courseName = this.extractCourseNameByRegex(text);
    
    // 如果正則失敗，嘗試 OpenAI 提取
    if (!courseName) {
      try {
        courseName = await OpenAIService.extractCourseName(text);
      } catch (error) {
        this.debugLog(`OpenAI course name extraction failed: ${error.message}`);
      }
    }

    // 標準化課程名稱
    if (courseName) {
      courseName = this.normalizeCourseNameForConsistency(courseName);
    }

    return courseName;
  }

  /**
   * 標準化課程名稱以確保一致性
   * 解決創建時 "數學" vs 查詢時 "數學課" 的不一致問題
   * @param {string} courseName - 原始課程名稱
   * @returns {string} 標準化後的課程名稱
   */
  static normalizeCourseNameForConsistency(courseName) {
    if (!courseName || typeof courseName !== 'string') {
      return courseName;
    }

    // 去除前後空白
    let normalized = courseName.trim();

    // 如果課程名稱沒有以 "課" 結尾，自動添加
    // 除非是某些特殊詞彙（如：學習、班級、訓練等）
    const specialSuffixes = ['學習', '班', '訓練', '培訓', '輔導', '指導', '課程', '課堂'];
    const hasSpecialSuffix = specialSuffixes.some(suffix => normalized.endsWith(suffix));
    
    if (!normalized.endsWith('課') && !hasSpecialSuffix) {
      normalized = normalized + '課';
    }

    // 移除重複的 "課" 後綴
    normalized = normalized.replace(/課課+$/, '課');

    // 標準化常見課程名稱別名
    const aliases = {
      '英語課': '英文課',
      '中文課': '國文課',
      '數學課程': '數學課',
      '英文課程': '英文課',
      '物理課程': '物理課',
      '化學課程': '化學課',
      '生物課程': '生物課',
      '歷史課程': '歷史課',
      '地理課程': '地理課'
    };

    if (aliases[normalized]) {
      normalized = aliases[normalized];
    }

    return normalized;
  }

  /**
   * 將 Date 對象轉換為 HH:MM 格式
   * @param {Date} dateTime - 時間對象
   * @returns {string} HH:MM 格式的時間字符串
   */
  static formatTimeToHHMM(dateTime) {
    if (!dateTime || !(dateTime instanceof Date)) {
      return '00:00';
    }

    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 檢查輸入是否包含重複課程關鍵詞
   * @param {string} text - 用戶輸入文本
   * @returns {boolean} 是否包含重複課程關鍵詞
   */
  static hasRecurringKeywords(text) {
    if (!text || typeof text !== 'string') return false;

    const recurringKeywords = [
      '每天', '每日', '天天',
      '每週', '每星期', 
      '週一', '週二', '週三', '週四', '週五', '週六', '週日',
      '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日',
      '每月', '每個月', '月初', '月中', '月底',
      '定期', '固定', '例行'
    ];

    return recurringKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 生成重複課程描述
   * @param {Object} recurrenceDetails - 重複詳細資訊
   * @returns {string} 重複課程描述
   */
  static generateRecurrenceDescription(recurrenceDetails) {
    const { type, days_of_week, day_of_month, time_of_day } = recurrenceDetails;

    switch (type) {
      case 'daily':
        return `每天${this.formatTimeDisplay(time_of_day)}`;
      case 'weekly':
        const days = days_of_week?.map(d => TimeService.formatWeekdayToText(d)).join('、') || '未指定';
        return `${days}${this.formatTimeDisplay(time_of_day)}`;
      case 'monthly':
        return `每月${day_of_month}號${this.formatTimeDisplay(time_of_day)}`;
      default:
        return '重複課程';
    }
  }

  /**
   * 格式化時間顯示
   * @param {string} timeOfDay - HH:MM 格式時間
   * @returns {string} 格式化後的時間顯示
   */
  static formatTimeDisplay(timeOfDay) {
    if (!timeOfDay) return '';

    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';

    return ` ${displayHours}${displayMinutes} ${ampm}`;
  }
}

module.exports = SemanticService;
