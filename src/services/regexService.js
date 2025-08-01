/**
 * RegexService - 增強版 Regex 分析服務
 * 職責：提供證據驅動的 Regex 意圖分析
 * 基於現有 IntentRuleEngine 擴展，增加匹配質量評估
 */

const IntentRuleEngine = require('../utils/intentRuleEngine');

class RegexService {
  /**
   * 分析用戶輸入 - 增強版 Regex 分析
   * @param {string} userText - 用戶輸入文本
   * @returns {Promise<RegexAnalysisResult>} 增強版分析結果
   */
  static async analyzeByRegex(userText) {
    try {
      // 使用現有 IntentRuleEngine 獲取基礎分析
      const baseResult = IntentRuleEngine.analyzeIntent(userText);
      
      // 增強分析：計算匹配細節
      const matchDetails = this.calculateMatchDetails(userText, baseResult);
      
      // 分析限制性
      const limitations = this.analyzeLimitations(userText);
      
      // 基礎實體提取（簡化版，主要為了結構完整性）
      const entities = this.extractBasicEntities(userText, baseResult.intent);

      return {
        intent: baseResult.intent,
        entities,
        match_details: matchDetails,
        limitations
      };
    } catch (error) {
      console.error('[RegexService] 分析錯誤:', error);
      
      // 錯誤情況下返回安全的默認值
      return {
        intent: 'unknown',
        entities: {},
        match_details: {
          triggered_patterns: [],
          keyword_matches: [],
          ambiguous_terms: [],
          pattern_strength: 0
        },
        limitations: {
          context_blind: true,
          temporal_blind: true,
          mood_blind: true
        }
      };
    }
  }

  /**
   * 計算匹配細節
   * @param {string} text - 用戶輸入
   * @param {Object} baseResult - IntentRuleEngine 的基礎結果
   * @returns {MatchDetails} 匹配細節
   */
  static calculateMatchDetails(text, baseResult) {
    const normalizedText = text.toLowerCase();
    
    // 定義各意圖的關鍵詞模式（基於實際的 intent-rules.yaml）
    const intentPatterns = {
      'record_course': {
        keywords: ['課', '課程', '上課', '新增', '記錄', '安排', '預約', '學習'],
        patterns: ['.*課$', '.*課程$', '.*班$', '.*教學$', '記錄.*課'],
        ambiguous: ['課'] // '課' 單字容易歧義
      },
      'query_schedule': {
        keywords: ['查', '查詢', '查看', '怎麼樣', '如何', '看看', '顯示'],
        patterns: ['查.*課', '.*怎麼樣', '.*如何.*', '查看.*'],
        ambiguous: []
      },
      'query_course': {
        keywords: ['查', '查詢', '查看', '怎麼樣', '如何', '看看'],
        patterns: ['查.*課', '.*怎麼樣', '.*如何.*'],
        ambiguous: []
      },
      'modify_course': {
        keywords: ['修改', '改', '更新', '變更', '調整'],
        patterns: ['修改.*', '更新.*', '改.*', '調整.*'],
        ambiguous: ['改'] // '改' 可能指改時間或改內容
      },
      'cancel_course': {
        keywords: ['取消', '刪除', '移除', '不要', '不上'],
        patterns: ['取消.*課', '刪除.*課', '不要.*課'],
        ambiguous: []
      }
    };

    const intentPattern = intentPatterns[baseResult.intent] || {
      keywords: [],
      patterns: [],
      ambiguous: []
    };

    // 計算關鍵詞匹配
    const keywordMatches = intentPattern.keywords.filter(keyword => 
      normalizedText.includes(keyword)
    );

    // 計算模式匹配
    const triggeredPatterns = intentPattern.patterns.filter(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(normalizedText);
    });

    // 識別歧義詞
    const ambiguousTerms = intentPattern.ambiguous.filter(term => 
      normalizedText.includes(term)
    );

    // 計算模式強度 (0-1)
    let patternStrength = 0;
    if (baseResult.confidence > 0) {
      // 基礎強度來自 IntentRuleEngine 的信心分數
      patternStrength = Math.min(baseResult.confidence, 1.0);
      
      // 根據匹配情況調整
      if (keywordMatches.length > 1) patternStrength += 0.1;
      if (triggeredPatterns.length > 0) patternStrength += 0.1;
      if (ambiguousTerms.length > 0) patternStrength -= 0.2;
      
      // 確保在 0-1 範圍內
      patternStrength = Math.max(0, Math.min(1, patternStrength));
    }

    return {
      triggered_patterns: triggeredPatterns,
      keyword_matches: keywordMatches,
      ambiguous_terms: ambiguousTerms,
      pattern_strength: patternStrength
    };
  }

  /**
   * 分析 Regex 方法的限制性
   * @param {string} text - 用戶輸入
   * @returns {RegexLimitations} 限制性分析
   */
  static analyzeLimitations(text) {
    const normalizedText = text.toLowerCase();
    
    // 檢測時間線索
    const temporalClues = ['上次', '昨天', '之前', '剛才', '前天', '上週', '上個月'];
    const hasTemporalClues = temporalClues.some(clue => normalizedText.includes(clue));
    
    // 檢測語氣標記
    const moodMarkers = ['怎麼樣', '如何', '嗎', '嘛', '呢', '吧', '不是'];
    const hasMoodMarkers = moodMarkers.some(marker => normalizedText.includes(marker));
    
    // 檢測上下文依賴（代詞、指代詞）
    const contextMarkers = ['這個', '那個', '它', '他', '她', '這樣', '那樣'];
    const hasContextDependency = contextMarkers.some(marker => normalizedText.includes(marker));

    return {
      context_blind: hasContextDependency,     // 有上下文依賴時為 true
      temporal_blind: hasTemporalClues,       // 有時間線索時為 true（Regex 無法理解）
      mood_blind: hasMoodMarkers             // 有語氣標記時為 true（Regex 無法理解）
    };
  }

  /**
   * 基礎實體提取
   * @param {string} text - 用戶輸入
   * @param {string} intent - 識別的意圖
   * @returns {Object} 基礎實體
   */
  static extractBasicEntities(text, intent) {
    const entities = {};
    
    // 簡單的實體識別（基於關鍵詞匹配）
    const courseNamePatterns = [
      /數學|英文|科學|音樂|美術|體育|國文|社會|自然/,
      /.*課$/,
      /.*班$/
    ];
    
    for (const pattern of courseNamePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.course_name = match[0];
        break;
      }
    }
    
    // 學生名稱識別（簡單版）
    const studentNamePattern = /(小明|小華|小美|Rumi|Amy|Tom|[一-龥]{2,3})/;
    const studentMatch = text.match(studentNamePattern);
    if (studentMatch) {
      entities.student_name = studentMatch[0];
    }

    return entities;
  }
}

module.exports = RegexService;