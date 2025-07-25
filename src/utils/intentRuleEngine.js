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
      const matchResult = this.matchRule(normalizedText, rule);

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
    const { keywords = [], exclusions = [], patterns = [], priority = 1 } = rule;

    // 檢查排除詞
    if (exclusions.some((exclusion) => text.includes(exclusion))) {
      return { confidence: 0, priority };
    }

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
    maxScore += patterns.length * 2;

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
