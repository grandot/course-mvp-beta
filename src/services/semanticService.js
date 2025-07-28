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
    
    // 嘗試初始化 Slot Template System
    this.initializeSlotTemplateSystem();
  }

  /**
   * 初始化 Slot Template System
   */
  initializeSlotTemplateSystem() {
    if (SlotTemplateManager) {
      try {
        this.slotTemplateManager = new SlotTemplateManager();
        this.slotTemplateEnabled = true;
        console.log('[SemanticService] Slot Template System 已啟用');
      } catch (error) {
        console.warn('[SemanticService] Slot Template System 初始化失敗:', error.message);
        this.slotTemplateEnabled = false;
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
    
    // Step 1: 如果啟用增強提取，使用新的 OpenAI 方法
    let semanticResult;
    if (useEnhancedExtraction) {
      this.debugLog(`[SemanticService] 使用增強版 Slot 提取`);
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
    
    // Step 2: 如果啟用並且可用，使用 Slot Template System 處理
    if (enableSlotTemplate && this.slotTemplateEnabled && semanticResult.success) {
      this.debugLog(`[SemanticService] 使用 Slot Template System 處理語意結果`);
      
      try {
        // 添加原始文本到上下文
        const enhancedContext = {
          ...context,
          raw_text: text
        };
        
        // 增強語意結果格式以支援 Slot Template
        const enhancedSemanticResult = {
          ...semanticResult,
          context: enhancedContext
        };
        
        // 使用 Slot Template Manager 處理
        const slotResult = await this.slotTemplateManager.processSemanticResult(
          userId, 
          enhancedSemanticResult
        );
        
        // 合併結果
        return {
          ...semanticResult,
          slotTemplate: slotResult,
          usedSlotTemplate: true,
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

      // Step 3: 檢查信心度和意圖，低於 0.8 或 unknown 則調用 OpenAI
      if (ruleResult.confidence >= 0.8 && finalIntent !== 'unknown') {
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
            confirmation: entities.confirmation,
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
          confirmation: entities.confirmation,
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
        confirmation: null,
      };
    }

    // 🚀 性能優化：優先使用快速正則提取，OpenAI 作為後備
    let courseName = this.extractCourseNameByRegex(text);
    
    // 只有正則提取失敗時才調用 OpenAI（減少 API 調用）
    if (!courseName) {
      courseName = await OpenAIService.extractCourseName(text);
    }

    // 💡 語義理解增強：如果 AI 提取失敗，使用意圖上下文智能提取
    if (!courseName && intentHint && userId) {
      courseName = await this.intelligentCourseExtraction(text, intentHint, userId);
    }

    // 🚀 性能優化：只在修改/取消操作時進行模糊匹配（避免不必要查詢）
    if (userId && courseName && (intentHint === 'modify_course' || intentHint === 'cancel_course')) {
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
          courseName = matchedCourse.course_name; // 使用完整的課程名稱
        }
      } catch (error) {
        // 模糊匹配失敗不影響原有流程
        console.warn('Course fuzzy matching failed:', error.message);
      }
    }

    // 提取地點
    let location = null;
    const locationPatterns = [
      /在(.+?)教室/,
      /在(.+?)上課/,
      /地點[：:](.+)/,
      /(.+?)教室/,
      /(.+?)大樓/,
    ];

    locationPatterns.forEach((pattern) => {
      if (!location) {
        const match = text.match(pattern);
        if (match) {
          location = match[1] ? match[1].trim() : match[0].trim();
          // 清理不必要的詞語
          location = location.replace(/上課|在|教室$/, '').trim();
          if (location) {
            location += '教室'; // 統一格式
          }
        }
      }
    });

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

    // 🔧 修復：添加時間信息處理
    const timeInfo = await this.processTimeInfo(text);

    return {
      courseName, // 統一使用駝峰式命名
      course_name: courseName, // 保持向後兼容
      location,
      teacher,
      confirmation,
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

    // 常見課程名稱模式
    const coursePatterns = [
      // 直接課程名 + 課/班等
      /([^\s，。！？]+(?:課|班|課程|課堂|學習|訓練))/g,
      // 學科名稱
      /(數學|國文|英文|物理|化學|生物|歷史|地理|公民|音樂|美術|體育|電腦|程式|鋼琴|小提琴|吉他|舞蹈|繪畫|書法|珠算|心算|作文|閱讀|口語|聽力|發音|文法|單字|會話)/g,
      // 語言課程
      /(中文|英語|日文|韓文|法文|德文|西班牙文|義大利文|俄文|阿拉伯文)/g,
      // 才藝類
      /(鋼琴|小提琴|大提琴|吉他|爵士鼓|薩克斯風|長笛|二胡|古箏|琵琶|笛子|唱歌|聲樂|合唱|舞蹈|芭蕾|街舞|國標舞|民族舞|現代舞|繪畫|素描|水彩|油畫|國畫|書法|陶藝|雕塑)/g,
      // 運動類
      /(游泳|籃球|足球|排球|網球|桌球|羽毛球|棒球|跆拳道|空手道|柔道|劍道|瑜珈|有氧|健身|田徑|體操|攀岩|滑板|直排輪)/g,
    ];

    for (const pattern of coursePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 返回第一個匹配的課程名稱
        const courseName = matches[0].trim();
        if (courseName.length >= 2 && courseName.length <= 10) {
          return courseName;
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
}

module.exports = SemanticService;
