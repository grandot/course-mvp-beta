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
    if (!text || typeof text !== 'string') {
      throw new Error('SemanticService: text must be a non-empty string');
    }

    if (!userId) {
      throw new Error('SemanticService: userId is required');
    }

    try {
      // Step 1: 先嘗試規則引擎分析
      const ruleResult = IntentRuleEngine.analyzeIntent(text);

      // Step 2: 檢查信心度和意圖，低於 0.8 或 unknown 則調用 OpenAI
      if (ruleResult.confidence >= 0.8 && ruleResult.intent !== 'unknown') {
        // 高信心度：使用規則引擎結果
        const entities = await this.extractCourseEntities(text, userId);
        const timeInfo = await this.extractTimeInfo(text);

        return {
          success: true,
          method: 'rule_engine',
          intent: ruleResult.intent,
          confidence: ruleResult.confidence,
          entities,
          timeInfo,
          context,
          analysis_time: Date.now(),
        };
      }
      // 低信心度：調用 OpenAI 作為後備
      const openaiResult = await OpenAIService.analyzeIntent(text, userId);

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
        const timeInfo = await this.extractTimeInfo(text);

        return {
          success: true,
          method: 'openai',
          intent: analysis.intent,
          confidence: analysis.confidence,
          entities: analysis.entities,
          timeInfo,
          context,
          reasoning: analysis.reasoning,
          usage: openaiResult.usage,
          analysis_time: Date.now(),
        };
      }
      // OpenAI 無法解析，回退到規則引擎結果
      const entities = await this.extractCourseEntities(text, userId);
      const timeInfo = await this.extractTimeInfo(text);

      return {
        success: true,
        method: 'rule_engine_fallback',
        intent: ruleResult.intent,
        confidence: ruleResult.confidence,
        entities,
        timeInfo,
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
        entities: {},
        timeInfo: null,
        context,
        analysis_time: Date.now(),
      };
    }
  }

  /**
   * 提取課程相關實體信息
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 課程實體信息
   */
  static async extractCourseEntities(text) {
    if (!text) {
      return {
        course_name: null,
        location: null,
        teacher: null,
      };
    }

    // 使用 OpenAI 的輔助方法提取實體
    const courseName = OpenAIService.extractCourseName(text);

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

    return {
      course_name: courseName,
      location,
      teacher,
    };
  }

  /**
   * 提取時間相關信息
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

      // 嘗試使用 TimeService 解析完整時間
      let parsedTime = null;
      if (time || date) {
        try {
          parsedTime = await TimeService.parseTimeString(text);
        } catch (parseError) {
          // 解析失敗，但不影響其他信息
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
      'unknown',
    ];

    if (!validIntents.includes(analysisResult.intent)) {
      return false;
    }

    return true;
  }
}

module.exports = SemanticService;
