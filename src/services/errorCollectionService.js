/**
 * 錯誤案例收集服務
 * 自動收集和分析語意理解錯誤，為持續優化提供數據支援
 */

class ErrorCollectionService {
  constructor() {
    this.firebaseService = require('./firebaseService');
  }

  /**
   * 記錄實體提取錯誤
   */
  async recordExtractionError(originalMessage, intent, extractedSlots, expectedSlots, userId, confidence) {
    try {
      const errorRecord = {
        type: 'extraction_error',
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        originalMessage,
        intent,
        extractedSlots,
        expectedSlots,
        confidence,
        errorType: this.classifyExtractionError(extractedSlots, expectedSlots),
        // 數據脫敏
        messageLength: originalMessage.length,
        hasNumbers: /\d/.test(originalMessage),
        hasEnglish: /[a-zA-Z]/.test(originalMessage),
        createdAt: new Date(),
      };

      const docRef = await this.firebaseService.addDocument('error_cases', errorRecord);
      console.log('📊 錯誤案例已記錄:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('❌ 記錄提取錯誤失敗:', error);
      return null;
    }
  }

  /**
   * 記錄意圖識別錯誤
   */
  async recordIntentError(originalMessage, identifiedIntent, expectedIntent, userId, confidence) {
    try {
      const errorRecord = {
        type: 'intent_error',
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        originalMessage,
        identifiedIntent,
        expectedIntent,
        confidence,
        errorCategory: this.classifyIntentError(identifiedIntent, expectedIntent),
        // 數據脫敏
        messageLength: originalMessage.length,
        hasNumbers: /\d/.test(originalMessage),
        hasEnglish: /[a-zA-Z]/.test(originalMessage),
        createdAt: new Date(),
      };

      const docRef = await this.firebaseService.addDocument('error_cases', errorRecord);
      console.log('📊 意圖錯誤已記錄:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('❌ 記錄意圖錯誤失敗:', error);
      return null;
    }
  }

  /**
   * 記錄低置信度案例（潛在問題）
   */
  async recordLowConfidenceCase(originalMessage, intent, extractedSlots, confidence, userId) {
    try {
      if (confidence >= 0.5) return null; // 只記錄低置信度案例

      const record = {
        type: 'low_confidence',
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        originalMessage,
        intent,
        extractedSlots,
        confidence,
        improvementNeeded: this.suggestImprovement(intent, extractedSlots),
        // 數據脫敏
        messageLength: originalMessage.length,
        hasNumbers: /\d/.test(originalMessage),
        hasEnglish: /[a-zA-Z]/.test(originalMessage),
        createdAt: new Date(),
      };

      const docRef = await this.firebaseService.addDocument('error_cases', record);
      console.log('📊 低置信度案例已記錄:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('❌ 記錄低置信度案例失敗:', error);
      return null;
    }
  }

  /**
   * 生成錯誤分析報告
   */
  async generateErrorReport(timeRange = '7d') {
    try {
      const startDate = this.getStartDate(timeRange);
      const errors = await this.firebaseService.queryDocuments(
        'error_cases',
        ['createdAt', '>=', startDate],
      );

      const report = {
        timeRange,
        totalErrors: errors.length,
        errorTypes: this.analyzeErrorTypes(errors),
        commonPatterns: this.identifyCommonPatterns(errors),
        recommendations: this.generateRecommendations(errors),
        generatedAt: new Date().toISOString(),
      };

      console.log('📊 錯誤分析報告生成完成:', report);
      return report;
    } catch (error) {
      console.error('❌ 生成錯誤報告失敗:', error);
      return null;
    }
  }

  /**
   * 分類實體提取錯誤類型
   */
  classifyExtractionError(extracted, expected) {
    const missingFields = [];
    const incorrectFields = [];

    for (const [key, expectedValue] of Object.entries(expected || {})) {
      if (!extracted[key]) {
        missingFields.push(key);
      } else if (extracted[key] !== expectedValue) {
        incorrectFields.push(key);
      }
    }

    if (missingFields.length > 0 && incorrectFields.length > 0) {
      return 'mixed_errors';
    } if (missingFields.length > 0) {
      return 'missing_fields';
    } if (incorrectFields.length > 0) {
      return 'incorrect_fields';
    }
    return 'unknown_error';
  }

  /**
   * 分類意圖識別錯誤類型
   */
  classifyIntentError(identified, expected) {
    if (!identified || identified === 'unknown') {
      return 'failed_identification';
    } if (this.areRelatedIntents(identified, expected)) {
      return 'related_intent_confusion';
    }
    return 'completely_wrong_intent';
  }

  /**
   * 判斷兩個意圖是否相關
   */
  areRelatedIntents(intent1, intent2) {
    const relatedGroups = [
      ['add_course', 'create_recurring_course', 'modify_course'],
      ['record_content', 'add_course_content', 'query_course_content'],
      ['query_schedule', 'query_course_content'],
      ['cancel_course', 'modify_course', 'stop_recurring_course'],
    ];

    return relatedGroups.some((group) => group.includes(intent1) && group.includes(intent2));
  }

  /**
   * 建議改進方向
   */
  suggestImprovement(intent, slots) {
    const suggestions = [];

    if (!slots.studentName) {
      suggestions.push('improve_student_name_extraction');
    }
    if (!slots.courseName) {
      suggestions.push('improve_course_name_extraction');
    }
    if (intent.includes('content') && !slots.content) {
      suggestions.push('improve_content_extraction');
    }
    if (intent.includes('reminder') && !slots.reminderTime) {
      suggestions.push('improve_time_extraction');
    }

    return suggestions;
  }

  /**
   * 獲取起始日期
   */
  getStartDate(timeRange) {
    const now = new Date();
    const days = parseInt(timeRange.replace('d', '')) || 7;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  /**
   * 分析錯誤類型分佈
   */
  analyzeErrorTypes(errors) {
    const typeCount = {};
    errors.forEach((error) => {
      const type = error.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return typeCount;
  }

  /**
   * 識別常見錯誤模式
   */
  identifyCommonPatterns(errors) {
    const patterns = {};

    errors.forEach((error) => {
      // 按訊息長度分組
      const lengthGroup = error.messageLength < 10 ? 'short'
        : error.messageLength < 20 ? 'medium' : 'long';
      patterns[`length_${lengthGroup}`] = (patterns[`length_${lengthGroup}`] || 0) + 1;

      // 按意圖分組
      if (error.intent) {
        patterns[`intent_${error.intent}`] = (patterns[`intent_${error.intent}`] || 0) + 1;
      }
    });

    return patterns;
  }

  /**
   * 生成改進建議
   */
  generateRecommendations(errors) {
    const recommendations = [];

    // 分析高頻錯誤類型
    const errorTypes = this.analyzeErrorTypes(errors);
    const topErrorType = Object.keys(errorTypes).reduce((a, b) => (errorTypes[a] > errorTypes[b] ? a : b));

    if (topErrorType === 'extraction_error') {
      recommendations.push('優化實體提取規則和 AI prompt');
    } else if (topErrorType === 'intent_error') {
      recommendations.push('收緊意圖識別規則，減少誤判');
    } else if (topErrorType === 'low_confidence') {
      recommendations.push('增強規則匹配精確度');
    }

    // 分析置信度趨勢
    const lowConfidenceCount = errors.filter((e) => e.confidence < 0.5).length;
    if (lowConfidenceCount / errors.length > 0.3) {
      recommendations.push('考慮調整置信度閾值或改進提取策略');
    }

    return recommendations;
  }
}

module.exports = new ErrorCollectionService();
