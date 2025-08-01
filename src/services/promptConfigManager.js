/**
 * Prompt配置管理器
 * 支持動態切換不同複雜度的prompt，實現Token優化
 * Phase 3: 完全簡化OpenAI Prompt設計
 */

const fs = require('fs');
const path = require('path');

class PromptConfigManager {
  constructor() {
    this.config = null;
    this.currentMode = process.env.SEMANTIC_PROMPT_MODE || 'minimal';
    this.fallbackCount = 0;
    this.maxFallbacks = 3;
    this._loadConfig();
  }

  /**
   * 載入prompt配置
   * @private
   */
  _loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/prompts/semantic-minimal.json');
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`[PromptConfigManager] 配置載入成功，當前模式: ${this.currentMode}`);
    } catch (error) {
      console.error('[PromptConfigManager] 配置載入失敗:', error.message);
      this.config = this._getDefaultConfig();
    }
  }

  /**
   * 獲取默認配置（fallback）
   * @private
   */
  _getDefaultConfig() {
    return {
      minimal_prompt: {
        system_message: "你是課程管理助手，分析用戶輸入並返回JSON格式結果。",
        user_template: "分析：\"{user_input}\"\n{context}\n返回JSON：\n{\n  \"intent\": \"用戶想做什麼\",\n  \"entities\": {\n    \"course_name\": \"課程名稱\",\n    \"student_name\": \"學生姓名\",\n    \"date\": \"日期\",\n    \"time\": \"時間\"\n  }\n}"
      }
    };
  }

  /**
   * 構建指定模式的prompt
   * @param {string} userText - 用戶輸入
   * @param {Array} conversationHistory - 對話歷史
   * @param {string} mode - prompt模式 ('ultra', 'minimal', 'evidence_minimal', 'full')
   * @returns {Object} prompt配置
   */
  buildPrompt(userText, conversationHistory = [], mode = null) {
    const targetMode = mode || this.currentMode;

    switch (targetMode) {
      case 'ultra':
        return this._buildUltraMinimalPrompt(userText, conversationHistory);
      case 'minimal':
        return this._buildMinimalPrompt(userText, conversationHistory);
      case 'evidence_minimal':
        return this._buildEvidenceMinimalPrompt(userText, conversationHistory);
      case 'full':
        return this._buildFullPrompt(userText, conversationHistory);
      default:
        console.warn(`[PromptConfigManager] 未知模式 ${targetMode}，使用minimal模式`);
        return this._buildMinimalPrompt(userText, conversationHistory);
    }
  }

  /**
   * 構建Ultra極簡prompt
   * @private
   */
  _buildUltraMinimalPrompt(userText, conversationHistory) {
    const config = this.config.ultra_minimal_prompt;
    
    return {
      messages: [
        {
          role: 'system',
          content: config.system_message
        },
        {
          role: 'user', 
          content: config.user_template.replace('{user_input}', userText)
        }
      ],
      mode: 'ultra',
      estimated_tokens: config.estimated_tokens,
      fallback_mode: 'minimal'
    };
  }

  /**
   * 構建標準簡化prompt
   * @private
   */
  _buildMinimalPrompt(userText, conversationHistory) {
    const config = this.config.minimal_prompt;
    
    // 處理對話歷史
    const contextText = conversationHistory.length > 0 
      ? config.context_template.replace('{history}', JSON.stringify(conversationHistory.slice(-2)))
      : '';

    return {
      messages: [
        {
          role: 'system',
          content: config.system_message
        },
        {
          role: 'user',
          content: config.user_template
            .replace('{user_input}', userText)
            .replace('{context}', contextText)
        }
      ],
      mode: 'minimal',
      estimated_tokens: config.estimated_tokens + (contextText.length * 0.25),
      fallback_mode: 'evidence_minimal'
    };
  }

  /**
   * 構建證據簡化prompt（保留推理鏈）
   * @private
   */
  _buildEvidenceMinimalPrompt(userText, conversationHistory) {
    const config = this.config.evidence_minimal_prompt;
    
    // 處理對話歷史
    const contextText = conversationHistory.length > 0 
      ? config.context_template.replace('{history}', JSON.stringify(conversationHistory.slice(-2)))
      : '';

    return {
      messages: [
        {
          role: 'system',
          content: config.system_message
        },
        {
          role: 'user',
          content: config.user_template
            .replace('{user_input}', userText)
            .replace('{context}', contextText)
        }
      ],
      mode: 'evidence_minimal',
      estimated_tokens: config.estimated_tokens + (contextText.length * 0.25),
      fallback_mode: 'full'
    };
  }

  /**
   * 構建完整prompt（當前實現的fallback）
   * @private
   */
  _buildFullPrompt(userText, conversationHistory) {
    // 使用原有的buildEvidenceDrivenPrompt邏輯
    const SemanticService = require('./semanticService');
    const service = new SemanticService();
    const fullPromptText = service.buildEvidenceDrivenPrompt(userText, conversationHistory);

    return {
      messages: [
        {
          role: 'user',
          content: fullPromptText
        }
      ],
      mode: 'full',
      estimated_tokens: 800, // 當前full prompt的估計token數
      fallback_mode: null
    };
  }

  /**
   * 處理失敗場景，自動fallback到更複雜的prompt
   * @param {string} currentMode - 當前失敗的模式
   * @param {string} errorReason - 失敗原因
   * @returns {string} 建議的fallback模式
   */
  handleFailure(currentMode, errorReason = '') {
    this.fallbackCount++;
    
    console.warn(`[PromptConfigManager] 模式 ${currentMode} 失敗 (${errorReason})，執行fallback`);
    
    // 獲取fallback模式
    const modeConfig = this.config.prompt_modes[currentMode];
    const fallbackMode = modeConfig?.fallback_to || 'full';
    
    // 記錄fallback統計
    this._logFallbackStats(currentMode, fallbackMode, errorReason);
    
    return fallbackMode;
  }

  /**
   * 記錄fallback統計信息
   * @private
   */
  _logFallbackStats(fromMode, toMode, reason) {
    const stats = {
      timestamp: new Date().toISOString(),
      from_mode: fromMode,
      to_mode: toMode,
      reason: reason,
      fallback_count: this.fallbackCount
    };
    
    // 在實際部署中，這裡可以發送到監控系統
    console.log('[PromptConfigManager] Fallback統計:', JSON.stringify(stats));
  }

  /**
   * 獲取當前token使用統計
   * @returns {Object} token使用統計
   */
  getTokenStats() {
    return {
      current_mode: this.currentMode,
      estimated_tokens: this._getEstimatedTokens(this.currentMode),
      optimization_ratio: this._getOptimizationRatio(this.currentMode),
      fallback_count: this.fallbackCount
    };
  }

  /**
   * 獲取指定模式的估計token數
   * @private
   */
  _getEstimatedTokens(mode) {
    const modeConfigs = {
      'ultra': 120,
      'minimal': 180, 
      'evidence_minimal': 195,
      'full': 800
    };
    return modeConfigs[mode] || 180;
  }

  /**
   * 獲取優化比例
   * @private  
   */
  _getOptimizationRatio(mode) {
    const currentTokens = this._getEstimatedTokens(mode);
    const fullTokens = 800;
    return Math.round((1 - currentTokens / fullTokens) * 100);
  }

  /**
   * 設置prompt模式
   * @param {string} mode - 新的prompt模式
   */
  setMode(mode) {
    if (!this.config.prompt_modes[mode]) {
      throw new Error(`不支持的prompt模式: ${mode}`);
    }
    
    const oldMode = this.currentMode;
    this.currentMode = mode;
    this.fallbackCount = 0; // 重置fallback計數
    
    console.log(`[PromptConfigManager] 模式切換: ${oldMode} → ${mode}`);
  }

  /**
   * 重新載入配置
   * @param {string} configPath - 配置文件路徑
   */
  reloadConfig(configPath = null) {
    try {
      if (configPath) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        this._loadConfig();
      }
      console.log('[PromptConfigManager] 配置重新載入成功');
    } catch (error) {
      console.error('[PromptConfigManager] 配置重新載入失敗:', error.message);
    }
  }

  /**
   * 驗證prompt配置的有效性
   * @returns {Object} 驗證結果
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    // 檢查必要的prompt模式
    const requiredModes = ['ultra', 'minimal', 'evidence_minimal', 'full'];
    requiredModes.forEach(mode => {
      if (!this.config.prompt_modes[mode]) {
        errors.push(`缺少必要的prompt模式: ${mode}`);
      }
    });

    // 檢查prompt模板
    const promptConfigs = ['ultra_minimal_prompt', 'minimal_prompt', 'evidence_minimal_prompt'];
    promptConfigs.forEach(config => {
      if (!this.config[config] || !this.config[config].user_template) {
        errors.push(`prompt配置 ${config} 無效或缺少user_template`);
      }
    });

    // 檢查token估計
    if (this._getEstimatedTokens('minimal') >= this._getEstimatedTokens('full')) {
      warnings.push('minimal模式的token數不應該大於或等於full模式');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// 單例模式
let instance = null;

/**
 * 獲取PromptConfigManager單例
 */
function getInstance() {
  if (!instance) {
    instance = new PromptConfigManager();
  }
  return instance;
}

module.exports = {
  PromptConfigManager,
  getInstance
};