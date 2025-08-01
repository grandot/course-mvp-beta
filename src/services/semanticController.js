/**
 * SemanticController - 語義分析唯一入口
 * 實現 P1-P5 證據驅動決策機制
 * 
 * 職責：
 * - 統一語義分析入口點
 * - 實現 AI + Regex 雙重分析
 * - P1-P5 優先級證據驅動決策
 * - Fallback 機制處理
 */

const EnhancedSemanticService = require('./enhancedSemanticService');
const IntentRuleEngine = require('../utils/intentRuleEngine');

class SemanticController {
  constructor() {
    this.enhancedSemanticService = new EnhancedSemanticService();
  }

  /**
   * 語義分析統一入口 - P1-P5 證據驅動決策
   * @param {string} text 用戶輸入文本
   * @param {Object} context 對話上下文
   * @returns {Promise<Object>} 標準化語義分析結果
   */
  async analyze(text, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 [SemanticController] 開始語義分析: "${text}"`);
      
      // 優先執行快速 Regex 分析
      const regexAnalysis = this.performRegexAnalysis(text);
      
      // 如果 Regex 高信心度匹配，跳過 AI 分析提升性能
      let aiAnalysis;
      if (regexAnalysis.success && regexAnalysis.confidence > 0.9) {
        console.log(`⚡ [SemanticController] Regex 高信心度匹配，跳過 AI 分析`);
        aiAnalysis = { success: false, intent: 'unknown', entities: {}, confidence: 0 };
      } else {
        aiAnalysis = await this.performAIAnalysis(text, context);
      }
      
      // P1-P5 證據驅動決策
      const decision = this.decideByEvidence(aiAnalysis, regexAnalysis, text);
      
      // 構建最終結果
      const result = {
        final_intent: decision.intent,
        entities: decision.entities || {},
        confidence: decision.confidence,
        source: decision.source,
        reason: decision.reason,
        used_rule: decision.used_rule,
        execution_time: Date.now() - startTime,
        debug_info: {
          ai_analysis: aiAnalysis,
          regex_analysis: regexAnalysis,
          decision_path: decision.decision_path || []
        }
      };
      
      console.log(`✅ [SemanticController] 決策完成: ${result.final_intent} (${result.used_rule})`);
      return result;
      
    } catch (error) {
      console.error(`❌ [SemanticController] 分析失敗:`, error.message);
      
      // Fallback 機制
      return {
        final_intent: 'unknown',
        entities: {},
        confidence: 0,
        source: 'fallback',
        reason: '語義分析服務發生錯誤',
        used_rule: 'FALLBACK',
        execution_time: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * 執行 AI 語義分析
   * @param {string} text 用戶輸入
   * @param {Object} context 上下文
   * @returns {Promise<Object>} AI 分析結果
   */
  async performAIAnalysis(text, context) {
    try {
      const result = await this.enhancedSemanticService.analyzeMessage(text, context.userId || 'unknown', context);
      
      return {
        success: result.success || false,
        intent: result.intent || 'unknown',
        entities: result.entities || {},
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        method: result.method,
        // 真實證據提取（基於 EnhancedSemanticService 實際返回）
        evidence: {
          temporal_clues: this.extractTemporalClues(text),
          mood_indicators: this.extractMoodIndicators(text),
          question_markers: this.extractQuestionMarkers(text)
        },
        // 只有真實推理鏈才計入，不硬編碼假數據
        reasoning_chain: result.reasoning || {}
      };
    } catch (error) {
      console.warn(`⚠️ [SemanticController] AI 分析失敗:`, error.message);
      return {
        success: false,
        intent: 'unknown',
        entities: {},
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * 執行 Regex 語義分析
   * @param {string} text 用戶輸入
   * @returns {Object} Regex 分析結果
   */
  performRegexAnalysis(text) {
    try {
      const result = IntentRuleEngine.analyzeIntent(text);
      
      return {
        success: result.intent !== 'unknown' && result.confidence > 0,
        intent: result.intent || 'unknown',
        entities: {}, // IntentRuleEngine 不提供 entities
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        // 真實匹配詳情
        match_details: {
          triggered_patterns: [], // IntentRuleEngine 不提供此信息
          pattern_strength: result.confidence || 0,
          ambiguous_terms: this.detectAmbiguousTerms(text)
        },
        limitations: {
          context_blind: true,
          temporal_blind: this.extractTemporalClues(text).length === 0,
          mood_blind: true
        }
      };
    } catch (error) {
      console.warn(`⚠️ [SemanticController] Regex 分析失敗:`, error.message);
      return {
        success: false,
        intent: 'unknown',
        entities: {},
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * P1-P5 證據驅動決策邏輯
   * @param {Object} ai AI 分析結果
   * @param {Object} regex Regex 分析結果
   * @param {string} text 原始文本
   * @returns {Object} 決策結果
   */
  decideByEvidence(ai, regex, text) {
    const decisionPath = [];
    
    // Fallback 檢測
    if ((!ai.success || ai.confidence < 0.6) && (!regex.success || regex.confidence < 0.5)) {
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0,
        source: 'fallback',
        reason: 'AI與Regex均無法提供足夠證據',
        used_rule: 'FALLBACK',
        decision_path: ['進入Fallback']
      };
    }

    // P1: 語氣與意圖衝突檢測
    decisionPath.push('P1檢查-語氣衝突');
    if (ai.evidence && ai.evidence.question_markers.length > 0 && 
        regex.success && regex.intent.includes('add_')) {
      decisionPath.push('P1命中-疑問語氣與新增衝突');
      return {
        intent: ai.intent,
        entities: ai.entities,
        confidence: ai.confidence,
        source: 'ai',
        reason: '疑問語氣與新增意圖衝突',
        used_rule: 'P1',
        decision_path: decisionPath
      };
    }
    decisionPath.push('P1未命中');

    // P2: 時間線索存在
    decisionPath.push('P2檢查-時間線索');
    if (ai.evidence && ai.evidence.temporal_clues.length > 0 && 
        regex.limitations && regex.limitations.temporal_blind) {
      decisionPath.push('P2命中-含時間線索');
      return {
        intent: ai.intent,
        entities: ai.entities,
        confidence: ai.confidence,
        source: 'ai',
        reason: '含時間線索，Regex無法理解',
        used_rule: 'P2',
        decision_path: decisionPath
      };
    }
    decisionPath.push('P2未命中');

    // P3: AI 高信心度 (簡化邏輯，不依賴假推理鏈)
    decisionPath.push('P3檢查-AI高信心度');
    if (ai.success && ai.confidence > 0.85) {
      decisionPath.push('P3命中-AI高信心度');
      return {
        intent: ai.intent,
        entities: ai.entities,
        confidence: ai.confidence,
        source: 'ai',
        reason: 'AI高信心度分析',
        used_rule: 'P3',
        decision_path: decisionPath
      };
    }
    decisionPath.push('P3未命中');

    // P4: Regex強匹配 (修復邏輯矛盾)
    decisionPath.push('P4檢查-Regex強匹配');
    if (regex.success && 
        regex.confidence > 0.9 && 
        this.isValidRegexMatch(text, regex.intent)) {
      decisionPath.push('P4命中-Regex強匹配');
      return {
        intent: regex.intent,
        entities: regex.entities,
        confidence: regex.confidence,
        source: 'regex',
        reason: 'Regex強匹配無歧義',
        used_rule: 'P4',
        decision_path: decisionPath
      };
    }
    decisionPath.push('P4未命中');

    // P5: 默認AI保守策略
    decisionPath.push('P5默認-AI保守策略');
    return {
      intent: ai.success ? ai.intent : 'unknown',
      entities: ai.success ? ai.entities : {},
      confidence: ai.success ? ai.confidence : 0,
      source: 'ai',
      reason: '默認AI避免誤判',
      used_rule: 'P5',
      decision_path: decisionPath
    };
  }

  // 輔助方法 - 提取時間線索 (改進準確性)
  extractTemporalClues(text) {
    const temporalPatterns = [
      /(?:^|[^不是])上次/,
      /(?:^|[^不是])昨天/,
      /(?:^|[^不是])之前/,
      /(?:^|[^不是])剛才/,
      /(?:^|[^不是])最近/,
      /(?:^|[^不是])上週/,
      /(?:^|[^不是])上個月/,
      /(?:^|[^不是])前天/
    ];
    return temporalPatterns.filter(pattern => pattern.test(text)).map(pattern => 
      text.match(pattern)?.[0]?.replace(/^[^不是]*/, '') || ''
    ).filter(match => match);
  }

  // 輔助方法 - 提取語氣指標
  extractMoodIndicators(text) {
    const moodWords = ['怎麼樣', '如何', '好不好', '對吧', '吧'];
    return moodWords.filter(word => text.includes(word));
  }

  // 輔助方法 - 提取疑問標記
  extractQuestionMarkers(text) {
    const questionWords = ['嗎', '？', '怎麼樣', '如何', '什麼時候', '哪個'];
    return questionWords.filter(word => text.includes(word));
  }

  // 輔助方法 - 檢測真正的歧義詞
  detectAmbiguousTerms(text) {
    const ambiguousWords = ['那個', '這個', '東西', '事情'];
    return ambiguousWords.filter(word => text.includes(word));
  }

  // 輔助方法 - 驗證 Regex 匹配的有效性
  isValidRegexMatch(text, intent) {
    // 特殊處理："清空課表" 中的 "課" 不是歧義詞
    if (intent === 'clear_schedule' && text.includes('清空') && text.includes('課表')) {
      return true;
    }
    
    // 其他意圖的歧義檢查
    const realAmbiguousTerms = this.detectAmbiguousTerms(text);
    return realAmbiguousTerms.length === 0;
  }

  // 輔助方法 - 檢查是否含時間線索
  hasTemporalClues(text) {
    return this.extractTemporalClues(text).length > 0;
  }
}

module.exports = SemanticController;