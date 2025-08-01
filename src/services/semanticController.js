/**
 * SemanticController - 語意決策控制器
 * 職責：整合 AI 與 Regex 的判斷結果，進行證據驅動決策
 * 核心創新：分析「為什麼」這樣判斷，而非只看「分數高低」
 */

const SemanticService = require('./semanticService');

class SemanticController {
  constructor() {
    this.semanticService = new SemanticService();
  }

  /**
   * 語意分析路由 - 主入口方法
   * @param {string} userText - 用戶輸入文本
   * @param {Array} conversationHistory - 對話歷史 (可選)
   * @param {Object} config - 配置選項 (可選)
   * @returns {Promise<SemanticDecisionResult>} 最終決策結果
   */
  async route(userText, conversationHistory = [], config = {}) {
    const startTime = Date.now();
    const finalConfig = {
      debug: false,
      ai_confidence_threshold: 0.6,
      regex_strength_threshold: 0.5,
      fallback_threshold: 0.6,
      ...config
    };

    SemanticService.debugLog(`🎯 [SemanticController] 開始路由分析: "${userText}"`);

    try {
      // 並行分析：同時執行 AI 和 Regex 分析
      const [aiResult, regexResult] = await Promise.all([
        this.semanticService.analyzeByOpenAI(userText, conversationHistory),
        this.semanticService.analyzeByRegex(userText)
      ]);

      SemanticService.debugLog(`🤖 [SemanticController] AI 分析結果:`, aiResult);
      SemanticService.debugLog(`🔧 [SemanticController] Regex 分析結果:`, regexResult);

      // 證據驅動決策
      const decision = this.decideByEvidence(
        aiResult, 
        regexResult, 
        userText, 
        finalConfig.debug
      );

      // 添加執行時間
      decision.execution_time = `${Date.now() - startTime}ms`;

      SemanticService.debugLog(`✅ [SemanticController] 最終決策:`, decision);
      return decision;

    } catch (error) {
      SemanticService.debugLog(`❌ [SemanticController] 路由錯誤:`, error);
      
      // 錯誤情況下的安全回退
      return {
        final_intent: 'unknown',
        source: 'fallback',
        reason: `系統錯誤: ${error.message}`,
        confidence: 0.0,
        suggestion: '系統暫時無法處理您的請求，請稍後再試或提供更詳細的描述。',
        execution_time: `${Date.now() - startTime}ms`,
        ...(finalConfig.debug && {
          debug_info: {
            error: error.message,
            stack: error.stack,
            decision_path: ['系統錯誤-進入Fallback']
          }
        })
      };
    }
  }

  /**
   * 證據驅動決策邏輯 - 核心演算法
   * @param {AIAnalysisResult} ai - AI 分析結果
   * @param {RegexAnalysisResult} regex - Regex 分析結果
   * @param {string} text - 原始用戶輸入
   * @param {boolean} debug - 是否開啟 Debug 模式
   * @returns {SemanticDecisionResult} 決策結果
   */
  decideByEvidence(ai, regex, text, debug = false) {
    const decisionPath = [];
    
    // === Fallback 檢測 ===
    decisionPath.push('開始證據驅動決策分析');
    
    const aiInvalid = !ai || ai.confidence.overall < 0.6;
    const regexInvalid = !regex.match_details || regex.match_details.pattern_strength < 0.5;
    
    if (aiInvalid && regexInvalid) {
      decisionPath.push('進入Fallback-雙重失效');
      return this.buildResult(
        'fallback', 
        'unknown', 
        'FALLBACK', 
        'AI與Regex均無法提供足夠證據',
        ai, 
        regex, 
        decisionPath, 
        debug,
        0.0,
        '請明確說明您想查詢哪一堂課的記錄？或者提供更多課程細節？'
      );
    }

    // === P1: 語氣衝突檢測 ===
    decisionPath.push('P1檢查-語氣與意圖衝突');
    if (ai.evidence && ai.evidence.question_markers.length > 0 && 
        regex.intent && regex.intent.includes('record_')) {
      decisionPath.push('P1命中-疑問語氣與新增意圖衝突');
      return this.buildResult(
        'ai', 
        ai.intent, 
        'P1', 
        '疑問語氣與新增意圖衝突，AI勝出',
        ai, 
        regex, 
        decisionPath, 
        debug,
        ai.confidence.overall
      );
    }
    decisionPath.push('P1未命中');

    // === P2: 時間線索權重 ===
    decisionPath.push('P2檢查-時間線索存在');
    if (ai.evidence && ai.evidence.temporal_clues.length > 0 && 
        regex.limitations && regex.limitations.temporal_blind) {
      decisionPath.push('P2命中-含時間線索，Regex無法理解');
      return this.buildResult(
        'ai', 
        ai.intent, 
        'P2', 
        '含時間線索，Regex無法理解時序',
        ai, 
        regex, 
        decisionPath, 
        debug,
        ai.confidence.overall
      );
    }
    decisionPath.push('P2未命中');

    // === P3: AI推理鏈完整性檢查 ===
    decisionPath.push('P3檢查-AI推理鏈質量');
    const reasoningSteps = ai.reasoning_chain ? Object.keys(ai.reasoning_chain).length - 1 : 0;
    if (reasoningSteps >= 3 && ai.confidence.overall > 0.8) {
      decisionPath.push('P3命中-AI推理鏈完整且高信心');
      return this.buildResult(
        'ai', 
        ai.intent, 
        'P3', 
        `AI推理鏈完整(${reasoningSteps}步)且信心度高`,
        ai, 
        regex, 
        decisionPath, 
        debug,
        ai.confidence.overall
      );
    }
    decisionPath.push('P3未命中');

    // === P4: Regex強匹配優勢 ===
    decisionPath.push('P4檢查-Regex強匹配');
    if (regex.match_details && regex.match_details.pattern_strength > 0.9 && 
        ai.confidence.overall < 0.7 &&
        regex.match_details.ambiguous_terms.length === 0) {
      decisionPath.push('P4命中-Regex強匹配且無歧義');
      return this.buildResult(
        'regex', 
        regex.intent, 
        'P4', 
        'Regex強匹配且無歧義詞',
        ai, 
        regex, 
        decisionPath, 
        debug,
        regex.match_details.pattern_strength
      );
    }
    decisionPath.push('P4未命中');

    // === P5: 默認AI保守策略 ===
    decisionPath.push('P5默認-AI保守策略');
    return this.buildResult(
      'ai', 
      ai.intent, 
      'P5', 
      '默認AI策略，避免Regex硬規則誤判',
      ai, 
      regex, 
      decisionPath, 
      debug,
      ai.confidence.overall
    );
  }

  /**
   * 構建決策結果
   * @param {string} source - 決策來源 (ai/regex/fallback)
   * @param {string} intent - 最終意圖
   * @param {string} rule - 使用的規則 (P1-P5/FALLBACK)
   * @param {string} reason - 決策理由
   * @param {AIAnalysisResult} ai - AI 分析結果
   * @param {RegexAnalysisResult} regex - Regex 分析結果
   * @param {Array} decisionPath - 決策路徑
   * @param {boolean} debug - 是否開啟 Debug
   * @param {number} confidence - 信心分數
   * @param {string} suggestion - 建議 (Fallback 時使用)
   * @returns {SemanticDecisionResult} 構建的結果
   */
  buildResult(source, intent, rule, reason, ai, regex, decisionPath, debug, confidence, suggestion = null) {
    const result = {
      final_intent: intent,
      source,
      reason,
      used_rule: rule,
      confidence
    };

    // 添加實體信息
    if (source === 'ai' && ai.entities) {
      result.entities = ai.entities;
    } else if (source === 'regex' && regex.entities) {
      result.entities = regex.entities;
    }

    // Fallback 特殊處理
    if (source === 'fallback' && suggestion) {
      result.suggestion = suggestion;
    }

    // Debug 信息
    if (debug) {
      result.debug_info = {
        ai_analysis: ai,
        regex_analysis: regex,
        decision_path: decisionPath,
        reasoning_details: {
          ai_evidence_count: ai.evidence ? Object.values(ai.evidence).flat().length : 0,
          regex_match_strength: regex.match_details ? regex.match_details.pattern_strength : 0,
          ai_reasoning_steps: ai.reasoning_chain ? Object.keys(ai.reasoning_chain).length - 1 : 0
        }
      };
    }

    return result;
  }

  /**
   * 靜態方法：直接路由分析（便捷方法）
   * @param {string} userText - 用戶輸入
   * @param {Array} conversationHistory - 對話歷史
   * @param {Object} config - 配置
   * @returns {Promise<SemanticDecisionResult>} 決策結果
   */
  static async analyze(userText, conversationHistory = [], config = {}) {
    const controller = new SemanticController();
    return controller.route(userText, conversationHistory, config);
  }
}

module.exports = SemanticController;