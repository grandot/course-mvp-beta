/**
 * TempSlotStateManager - 暫時 Slot 狀態管理器
 * 負責管理多輪對話中的暫時狀態，支援用戶分步完成信息填充
 * 
 * 主要功能：
 * 1. 創建暫存狀態
 * 2. 合併補充信息
 * 3. 檢查信息完整性
 * 4. 自動清理過期狀態
 * 5. 上下文檢測
 */

/**
 * LRU Cache 實現，用於暫存狀態管理
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // 將訪問的項目移到最前面
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 刪除最久未使用的項目（Map 的第一個項目）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * TempSlotStateManager - 暫時狀態管理器
 */
class TempSlotStateManager {
  constructor() {
    // 使用 LRU Cache 存儲暫存狀態，最多100個用戶的暫存狀態
    this.stateCache = new LRUCache(100);
    
    // 30分鐘過期時間
    this.expirationTime = 30 * 60 * 1000; // 30分鐘
    
    // 定期清理過期狀態（每5分鐘檢查一次）
    this.startCleanupTimer();
  }

  /**
   * 創建暫存狀態
   * @param {string} userId - 用戶ID
   * @param {Object} validSlots - 已驗證的正確 slots
   * @param {Array} problems - 檢測到的問題列表
   * @param {Object} template - Slot 模板
   * @returns {Object} 暫存狀態對象
   */
  async createTempState(userId, validSlots, problems, template) {
    const tempId = this.generateTempId(userId);
    const tempState = {
      tempId,
      userId,
      validSlots: { ...validSlots },
      problems: [...problems],
      template,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expirationTime),
      status: 'pending_completion',
      retryCount: 0
    };

    // 存儲到緩存中
    this.stateCache.set(userId, tempState);
    
    return tempState;
  }

  /**
   * 合併補充信息到暫存狀態
   * @param {string} tempId - 暫存狀態ID
   * @param {Object} newSlots - 新的 slot 信息
   * @returns {Object} 合併後的狀態
   */
  async mergeSupplementInfo(tempId, newSlots) {
    const userId = this.extractUserIdFromTempId(tempId);
    const tempState = this.stateCache.get(userId);
    
    if (!tempState || tempState.tempId !== tempId) {
      throw new Error(`暫存狀態不存在或已過期: ${tempId}`);
    }

    // 檢查是否過期
    if (new Date() > tempState.expiresAt) {
      this.stateCache.delete(userId);
      throw new Error(`暫存狀態已過期: ${tempId}`);
    }

    // 合併新的 slot 信息
    const mergedSlots = { ...tempState.validSlots };
    
    // 只合併有效的新信息（非空值）
    Object.entries(newSlots).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        mergedSlots[key] = value;
      }
    });

    // 更新暫存狀態
    tempState.validSlots = mergedSlots;
    tempState.retryCount += 1;
    
    // 更新緩存
    this.stateCache.set(userId, tempState);
    
    return tempState;
  }

  /**
   * 檢查暫存狀態是否完整
   * @param {Object} tempState - 暫存狀態
   * @param {Object} template - Slot 模板
   * @returns {boolean} 是否完整
   */
  isComplete(tempState, template = null) {
    const templateToUse = template || tempState.template;
    
    if (!templateToUse || !templateToUse.completion_rules) {
      return false;
    }

    const requiredFields = templateToUse.completion_rules.minimum_required || [];
    const slots = tempState.validSlots;

    // 檢查所有必填欄位是否都已填充
    for (const field of requiredFields) {
      if (!slots[field] || slots[field] === null || slots[field] === '') {
        return false;
      }
    }

    return true;
  }

  /**
   * 清理暫存狀態
   * @param {string} tempId - 暫存狀態ID
   * @returns {boolean} 是否成功清理
   */
  async clearTempState(tempId) {
    const userId = this.extractUserIdFromTempId(tempId);
    return this.stateCache.delete(userId);
  }

  /**
   * 檢測用戶是否在補充信息
   * @param {string} userId - 用戶ID
   * @param {string} userInput - 用戶輸入
   * @returns {Object|null} 暫存狀態或 null
   */
  async detectSupplementIntent(userId, userInput) {
    const tempState = this.getTempState(userId);
    if (!tempState) {
      return null;
    }

    // 檢查是否過期
    if (new Date() > tempState.expiresAt) {
      this.stateCache.delete(userId);
      return null;
    }

    // 分析用戶輸入是否為補充信息
    const isSupplementing = await this.analyzeSupplementPattern(userInput, tempState.problems);
    
    return isSupplementing ? tempState : null;
  }

  /**
   * 分析補充信息模式
   * @param {string} userInput - 用戶輸入
   * @param {Array} problems - 問題列表
   * @returns {boolean} 是否為補充信息
   */
  async analyzeSupplementPattern(userInput, problems) {
    if (!userInput || !problems || problems.length === 0) {
      return false;
    }

    const input = userInput.trim().toLowerCase();
    
    // 檢查是否包含時間補充模式
    const timePatterns = [
      /^[0-9]{1,2}[:點][0-9]{0,2}分?$/,  // 15:30, 3點, 3點30分
      /^[下晚早中]午[0-9]{1,2}[:點][0-9]{0,2}分?$/, // 下午3點
      /^[0-9]{1,2}[:點][0-9]{0,2}分?$/ // 純時間
    ];

    // 檢查是否包含日期補充模式
    const datePatterns = [
      /^[明後今昨]天$/,
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
      /^[0-9]{1,2}月[0-9]{1,2}[日號]$/
    ];

    // 檢查是否為簡短的補充回答（長度小於10且不包含"課"字）
    const isShortSupplement = input.length <= 10 && !input.includes('課');
    
    // 檢查是否匹配補充模式
    const isTimeInput = timePatterns.some(pattern => pattern.test(input));
    const isDateInput = datePatterns.some(pattern => pattern.test(input));
    
    return isTimeInput || isDateInput || isShortSupplement;
  }

  /**
   * 獲取暫存狀態
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 暫存狀態
   */
  getTempState(userId) {
    return this.stateCache.get(userId);
  }

  /**
   * 生成暫存ID
   * @param {string} userId - 用戶ID
   * @returns {string} 暫存ID
   */
  generateTempId(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `temp_${userId}_${timestamp}_${random}`;
  }

  /**
   * 從暫存ID提取用戶ID
   * @param {string} tempId - 暫存ID
   * @returns {string} 用戶ID
   */
  extractUserIdFromTempId(tempId) {
    const parts = tempId.split('_');
    return parts.length >= 3 ? parts[1] : null;
  }

  /**
   * 啟動自動清理定時器
   */
  startCleanupTimer() {
    // 每5分鐘檢查一次過期狀態
    setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);
  }

  /**
   * 清理過期狀態
   */
  cleanupExpiredStates() {
    const now = new Date();
    const expiredKeys = [];

    // 檢查所有緩存中的狀態
    for (const [userId, tempState] of this.stateCache.cache.entries()) {
      if (now > tempState.expiresAt) {
        expiredKeys.push(userId);
      }
    }

    // 刪除過期狀態
    expiredKeys.forEach(key => {
      this.stateCache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 個過期的暫存狀態`);
    }
  }

  /**
   * 獲取緩存統計信息
   * @returns {Object} 統計信息
   */
  getStats() {
    return {
      activeStates: this.stateCache.size(),
      maxCapacity: this.stateCache.maxSize,
      expirationMinutes: this.expirationTime / (60 * 1000)
    };
  }

  /**
   * 清理所有暫存狀態（主要用於測試）
   */
  clearAllStates() {
    this.stateCache.clear();
  }
}

module.exports = TempSlotStateManager;