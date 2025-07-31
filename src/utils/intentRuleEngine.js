/**
 * IntentRuleEngine - 意圖規則引擎
 * 職責：基於 YAML 配置的確定性意圖識別
 * 特點：不調用 OpenAI，純規則匹配
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class IntentRuleEngine {
  static rules = null;

  /**
   * 載入意圖規則配置
   * @returns {Object} 規則配置對象
   */
  static loadRules() {
    if (this.rules) {
      return this.rules;
    }

    try {
      const configPath = path.join(__dirname, '../../config/intent-rules.yaml');
      const yamlContent = fs.readFileSync(configPath, 'utf8');
      this.rules = yaml.load(yamlContent);
      return this.rules;
    } catch (error) {
      throw new Error(`Failed to load intent rules: ${error.message}`);
    }
  }

  /**
   * 分析用戶輸入的意圖
   * @param {string} text - 用戶輸入文本
   * @returns {Object} 意圖分析結果 {intent, confidence}
   */
  static analyzeIntent(text) {
    const rules = this.loadRules();
    const normalizedText = text.toLowerCase().trim();

    let bestMatch = {
      intent: 'unknown',
      confidence: 0,
      priority: 0,
    };

    // 遍歷所有意圖規則
    const ruleEntries = Object.entries(rules);
    ruleEntries.forEach(([intentName, rule]) => {
      // 🎯 修復：傳遞 intent_name 給 matchRule
      const ruleWithIntent = { ...rule, intent_name: intentName };
      const matchResult = this.matchRule(normalizedText, ruleWithIntent);

      // 如果找到更好的匹配（優先級更高或置信度更高）
      if (matchResult.confidence > 0 && (
        matchResult.priority > bestMatch.priority
        || (matchResult.priority === bestMatch.priority
          && matchResult.confidence > bestMatch.confidence)
      )) {
        bestMatch = {
          intent: intentName,
          confidence: matchResult.confidence,
          priority: matchResult.priority,
        };
      }
    });

    return {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
    };
  }

  /**
   * 匹配單個規則
   * @param {string} text - 標準化後的文本
   * @param {Object} rule - 規則配置
   * @returns {Object} 匹配結果 {confidence, priority}
   */
  static matchRule(text, rule) {
    // 🎯 混合策略：OpenAI 優先 + 基礎關鍵詞 Fallback
    // 大部分情況交由 OpenAI，但保留核心意圖的基礎識別能力
    
    const { keywords = [], exclusions = [], priority = 1, intent_name, required_keywords = [] } = rule;
    
    // 🎯 檢查必需關鍵詞（Phase 3: 重複課程強制要求）
    if (required_keywords.length > 0) {
      const hasAnyRequiredKeyword = required_keywords.some(requiredKeyword => 
        text.includes(requiredKeyword)
      );
      
      if (!hasAnyRequiredKeyword) {
        console.log(`[IntentRuleEngine] 缺少必需關鍵詞，跳過 ${intent_name}: "${text}"`);
        return { confidence: 0, priority };
      }
    }
    
    // 檢查排除詞（如果有排除詞且匹配，直接排除）
    if (exclusions.length > 0 && exclusions.some(exclusion => text.includes(exclusion))) {
      console.log(`[IntentRuleEngine] 排除詞匹配，跳過 ${intent_name}: "${text}"`);
      return { confidence: 0, priority };
    }
    
    // 🎯 第一性原則修復：恢復完整正則邏輯 - Regex優先架構
    let matchScore = 0;
    let maxScore = 0;

    // 計算關鍵詞匹配度
    const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
    if (matchedKeywords.length > 0) {
      matchScore += matchedKeywords.length;
    }
    maxScore += keywords.length > 0 ? keywords.length : 0;

    // 計算正則模式匹配度
    const matchedPatterns = patterns.filter((pattern) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
      } catch (error) {
        console.warn(`Invalid regex pattern: ${pattern}`);
        return false;
      }
    });

    if (matchedPatterns.length > 0) {
      matchScore += matchedPatterns.length * 2; // 模式匹配權重更高
    }
    // maxScore += patterns.length * 2; // 暫時註解，未來可能用於標準化

    // 如果沒有任何匹配
    if (matchScore === 0) {
      return { confidence: 0, priority };
    }

    // 計算最終置信度 - 保持向後兼容
    const baseConfidence = 0.8;
    let confidence = baseConfidence;

    // 關鍵詞匹配加分
    if (matchedKeywords.length > 1) {
      confidence = Math.min(confidence + ((matchedKeywords.length - 1) * 0.1), 1.0);
    }

    // 模式匹配加分（較少，因為是新功能）
    if (matchedPatterns.length > 0) {
      confidence = Math.min(confidence + (matchedPatterns.length * 0.05), 1.0);
    }

    return { confidence, priority };
  }

  /**
   * 獲取意圖的示例
   * @param {string} intent - 意圖名稱
   * @returns {Array} 示例列表
   */
  static getExamples(intent) {
    const rules = this.loadRules();
    return rules[intent]?.examples || [];
  }

  /**
   * 獲取所有支援的意圖
   * @returns {Array} 意圖列表
   */
  static getSupportedIntents() {
    const rules = this.loadRules();
    return Object.keys(rules);
  }

  /**
   * 重新載入規則（用於測試或動態配置更新）
   */
  static reloadRules() {
    this.rules = null;
    return this.loadRules();
  }
}

module.exports = IntentRuleEngine;
