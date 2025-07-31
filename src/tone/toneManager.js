/**
 * UnifiedToneManager - 統一溫暖活潑語氣控制引擎
 * 🎯 第一性原則重構：移除過度設計，專注用戶體驗一致性
 * 
 * 核心原則：
 * - 始終使用溫暖活潑的語氣風格
 * - 確保每次互動的一致性
 * - 讓用戶感覺在與同一個熟悉的助理對話
 */

const { UnifiedFewShotManager } = require('./fewShotExamples');

/**
 * 統一語氣配置 - 固定溫暖活潑風格
 */
const UNIFIED_TONE_CONFIG = {
  tonePrompt: `你是一位親切溫暖且略帶活潑的課程助理，協助家長管理孩子的課程。

語氣特點：
- 溫暖親切：使用「喔」、「～」等親暱詞彙，讓對話有溫度
- 適度活潑：適當表達興奮和支持，但不過於誇張  
- 友善支持：主動提供幫助，讓家長感受到關懷
- 專業可靠：在溫暖的基礎上保持專業性

請始終保持這種一致的語氣風格，讓家長感覺在與熟悉的朋友對話。`,
  
  style: 'warm_cheerful',
  emoji: true,
  
  // 統一的語氣元素
  toneElements: {
    confirmationWords: ['太好了', '很棒', '完成啦', '搞定'],
    friendlyParticles: ['喔', '～', '呢', '啦'],
    supportiveEmojis: ['😊', '🎹', '✨', '🌟', '💫'],
    encouragingPhrases: ['幫你記下', '已為你安排', '一起來', '沒問題']
  }
};

/**
 * UnifiedToneManager - 統一語氣控制管理器
 * 🎯 第一性原則：固定溫暖活潑風格，確保用戶體驗一致性
 */
class UnifiedToneManager {
  constructor() {
    // 固定使用統一語氣配置
    this.config = UNIFIED_TONE_CONFIG;
    
    // 整合統一 Few-shot 範例管理器
    this.fewShotManager = new UnifiedFewShotManager();
    
    // 簡化統計資訊
    this.stats = {
      promptGenerations: 0,
      messageEnhancements: 0
    };
    
    console.log(`[UnifiedToneManager] 初始化完成 - 固定溫暖活潑語氣風格`);
  }

  /**
   * 生成統一的 GPT System Prompt
   * 🎯 固定溫暖活潑語氣，根據上下文微調
   * @param {Object} context - 對話上下文
   * @returns {string} System prompt
   */
  generateSystemPrompt(context = {}) {
    this.stats.promptGenerations++;
    
    let systemPrompt = this.config.tonePrompt;
    
    // 根據上下文添加具體指導（保持溫暖活潑語氣）
    if (context.isFollowUp) {
      systemPrompt += '\n\n這是延續的對話，請保持溫暖親切的語氣，並自然銜接前面的內容。';
    }
    
    if (context.hasErrors) {
      systemPrompt += '\n\n用戶輸入有問題，請用溫和友善的方式引導，不要讓用戶感到困擾。';
    }
    
    if (context.taskType === 'record_course') {
      systemPrompt += '\n\n協助用戶記錄課程時，請用親切的語氣確認信息，讓家長感受到關懷。';
    }
    
    console.log(`[UnifiedToneManager] 生成統一 System Prompt - 溫暖活潑風格`);
    
    return systemPrompt;
  }

  /**
   * 獲取統一風格的 Few-shot 範例
   * 🎯 始終返回溫暖活潑風格的範例
   * @param {string} scenario - 場景類型
   * @param {Object} context - 對話上下文
   * @param {number} maxExamples - 最大範例數量
   * @returns {Array} Few-shot 範例陣列
   */
  getFewShotExamples(scenario = 'general', context = {}, maxExamples = 3) {
    // 統一使用溫暖活潑風格的範例
    return this.fewShotManager.getExamples(scenario, maxExamples);
  }

  /**
   * 增強訊息語氣 - 確保溫暖活潑風格
   * 🎯 核心功能：統一應用溫暖活潑語氣
   * @param {string} baseMessage - 基礎訊息
   * @param {Object} context - 對話上下文
   * @returns {string} 語氣增強後的訊息
   */
  enhanceMessage(baseMessage, context = {}) {
    this.stats.messageEnhancements++;
    
    let enhancedMessage = baseMessage;
    const { toneElements } = this.config;
    
    // 應用溫暖活潑語氣元素
    if (context.isSuccess) {
      // 成功場景：使用確認詞和慶祝emoji
      const confirmWord = this.getRandomElement(toneElements.confirmationWords);
      const emoji = this.getRandomElement(toneElements.supportiveEmojis);
      enhancedMessage = `${confirmWord}！${emoji} ${enhancedMessage}`;
    }
    
    // 添加親暱語尾詞（如果訊息較短）
    if (enhancedMessage.length < 50 && !enhancedMessage.includes('？')) {
      const particle = this.getRandomElement(toneElements.friendlyParticles);
      enhancedMessage = enhancedMessage.replace(/。$|$/, particle);
    }
    
    // 確保有適當的emoji（但不過度）
    if (!this.hasEmoji(enhancedMessage) && enhancedMessage.length > 15) {
      const emoji = this.getRandomElement(toneElements.supportiveEmojis.slice(0, 2)); // 只用基礎emoji
      enhancedMessage += ` ${emoji}`;
    }
    
    console.log(`[UnifiedToneManager] 訊息語氣增強完成`);
    return enhancedMessage;
  }
  
  /**
   * 檢查文字是否包含emoji
   */
  hasEmoji(text) {
    return /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text);
  }
  
  /**
   * 隨機選擇陣列元素
   */
  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 為 OpenAI API 格式化完整的 Few-shot 訊息
   * 🎯 統一格式化，固定溫暖活潑風格
   * @param {string} scenario - 場景類型
   * @param {Object} context - 對話上下文
   * @param {string} userMessage - 用戶訊息
   * @returns {Array} OpenAI messages 格式
   */
  formatForOpenAI(scenario, context, userMessage) {
    const systemPrompt = this.generateSystemPrompt(context);
    const examples = this.getFewShotExamples(scenario, context, 3);
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // 添加統一風格的 Few-shot 範例
    examples.forEach(example => {
      messages.push({ role: 'user', content: example.user });
      messages.push({ role: 'assistant', content: example.bot });
    });
    
    // 添加當前用戶訊息
    messages.push({ role: 'user', content: userMessage });
    
    return messages;
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      style: 'warm_cheerful', // 固定風格
      fewShotStats: this.fewShotManager.getStats()
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      promptGenerations: 0,
      messageEnhancements: 0
    };
    console.log('[UnifiedToneManager] 統計資訊已重置');
  }
}

// 向後兼容：保留舊的類名作為別名
const ToneManager = UnifiedToneManager;

module.exports = {
  UnifiedToneManager,
  ToneManager // 向後兼容
};