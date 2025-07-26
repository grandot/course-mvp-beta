/**
 * SemanticService - 語義處理統一入口
 * 職責：意圖識別、實體提取、上下文分析
 * Phase 4: 整合規則引擎 + OpenAI 後備流程
 */
const IntentRuleEngine = require('../utils/intentRuleEngine');
const OpenAIService = require('../internal/openaiService');
const DataService = require('./dataService');
const TimeService = require('./timeService');

class SemanticService {
  /**
   * 分析用戶訊息的整體語義
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 語義分析結果
   */
  static async analyzeMessage(text, userId, context = {}) {
    console.log(`🔧 [DEBUG] SemanticService.analyzeMessage - 開始分析: "${text}"`); // [REMOVE_ON_PROD]
    console.log(`🔧 [DEBUG] SemanticService.analyzeMessage - UserId: ${userId}`); // [REMOVE_ON_PROD]

    if (!text || typeof text !== 'string') {
      throw new Error('SemanticService: text must be a non-empty string');
    }

    if (!userId) {
      throw new Error('SemanticService: userId is required');
    }

    try {
      // Step 1: 先嘗試規則引擎分析獲取意圖上下文
      console.log(`🔧 [DEBUG] SemanticService - 開始規則引擎分析`); // [REMOVE_ON_PROD]
      const ruleResult = IntentRuleEngine.analyzeIntent(text);
      console.log(`🔧 [DEBUG] SemanticService - 規則引擎結果:`, ruleResult); // [REMOVE_ON_PROD]
      
      // Step 2: 💡 利用意圖上下文進行語義理解的實體提取
      console.log(`🔧 [DEBUG] SemanticService - 開始實體提取`); // [REMOVE_ON_PROD]
      const entities = await this.extractCourseEntities(text, userId, ruleResult.intent);
      const processedTimeInfo = await this.processTimeInfo(text);
      console.log(`🔧 [DEBUG] SemanticService - 實體提取結果:`, entities); // [REMOVE_ON_PROD]
      console.log(`🔧 [DEBUG] SemanticService - 時間處理結果:`, processedTimeInfo); // [REMOVE_ON_PROD]

      // Step 3: 檢查信心度和意圖，低於 0.8 或 unknown 則調用 OpenAI
      if (ruleResult.confidence >= 0.8 && ruleResult.intent !== 'unknown') {
        // 高信心度：使用規則引擎結果
        console.log(`🔧 [DEBUG] SemanticService - 使用規則引擎結果 (高信心度: ${ruleResult.confidence})`); // [REMOVE_ON_PROD]
        return {
          success: true,
          method: 'rule_engine',
          intent: ruleResult.intent,
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
      }
      // 低信心度：調用 OpenAI 作為後備
      console.log(`🔧 [DEBUG] SemanticService - 調用 OpenAI 作為後備 (低信心度: ${ruleResult.confidence})`); // [REMOVE_ON_PROD]
      const openaiResult = await OpenAIService.analyzeIntent(text, userId);
      console.log(`🔧 [DEBUG] SemanticService - OpenAI 分析結果:`, openaiResult); // [REMOVE_ON_PROD]

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

        return {
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
      }
      // OpenAI 無法解析，回退到規則引擎結果
      return {
        success: true,
        method: 'rule_engine_fallback',
        intent: ruleResult.intent,
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

    // 🧠 使用 AI 驅動的課程名稱提取（異步）
    let courseName = await OpenAIService.extractCourseName(text);

    // 💡 語義理解增強：如果 AI 提取失敗，使用意圖上下文智能提取
    if (!courseName && intentHint && userId) {
      courseName = await this.intelligentCourseExtraction(text, intentHint, userId);
    }

    // 如果有用戶ID且提取到課程名稱，嘗試模糊匹配現有課程
    if (userId && courseName) {
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
      // 使用 OpenAI 的輔助方法提取時間和日期
      const time = OpenAIService.extractTime(text);
      const date = OpenAIService.extractDate(text);

      // 🔧 修復：使用提取出的時間字符串，而不是完整句子
      let parsedTime = null;
      if (time || date) {
        try {
          // 構建純時間字符串用於解析
          const timeString = [date, time].filter(Boolean).join(' ') || time || text;
          parsedTime = await TimeService.parseTimeString(timeString);
        } catch (parseError) {
          // 解析失敗，但不影響其他信息
          console.warn('Time parsing failed for:', timeString, parseError.message);
          parsedTime = null;
        }
      }

      return {
        time,
        date,
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
      'unknown',
    ];

    if (!validIntents.includes(analysisResult.intent)) {
      return false;
    }

    return true;
  }
}

module.exports = SemanticService;
