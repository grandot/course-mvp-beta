/**
 * Slot State Manager
 * 負責管理用戶的對話狀態，包括記憶體快取和持久化
 * 
 * 功能:
 * - 用戶狀態的獲取和更新
 * - 記憶體快取系統 (LRU)
 * - 狀態持久化到 Firestore
 * - 狀態過期檢查
 */

const DataService = require('../services/dataService');

class SlotStateManager {
  constructor() {
    // SlotStateManager 使用靜態 DataService 方法
    this.cache = new Map(); // 記憶體快取 {userId: {state, timestamp, accessCount}}
    this.maxCacheSize = 1000; // 最大快取條目數
    this.cacheTimeout = 5 * 60 * 1000; // 5分鐘快取過期時間
    this.stateTimeout = 30 * 60 * 1000; // 30分鐘狀態過期時間
    
    // 統計資訊
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      stateCreations: 0,
      stateUpdates: 0
    };
  }

  /**
   * 獲取用戶當前狀態
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 用戶狀態物件
   */
  async getUserState(userId) {
    try {
      // 1. 檢查記憶體快取
      const cached = this.getCachedState(userId);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`[SlotStateManager] 快取命中 - 用戶: ${userId}`);
        return cached;
      }

      this.stats.cacheMisses++;
      console.log(`[SlotStateManager] 快取未命中，從資料庫載入 - 用戶: ${userId}`);

      // 2. 從資料庫載入
      const state = await DataService.getDocumentById('user_slot_states', userId);
      
      // 3. 如果用戶不存在或狀態過期，創建新狀態
      if (!state || this.isStateExpired(state)) {
        const newState = this.createInitialState(userId);
        await this.updateUserState(userId, newState);
        return newState;
      }

      // 4. 更新快取
      this.setCachedState(userId, state);
      
      return state;
    } catch (error) {
      console.error(`[SlotStateManager] 獲取用戶狀態失敗 - 用戶: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 更新用戶狀態
   * @param {string} userId - 用戶ID
   * @param {Object} newState - 新的狀態物件
   * @returns {Promise<Object>} 更新後的狀態
   */
  async updateUserState(userId, newState) {
    try {
      // 1. 更新時間戳
      newState.updated_at = new Date().toISOString();
      
      // 2. 檢查文檔是否存在，決定使用 create 或 update
      try {
        const existingState = await DataService.getDocumentById('user_slot_states', userId);
        if (existingState) {
          await DataService.updateDocument('user_slot_states', userId, newState);
        } else {
          await DataService.createDocument('user_slot_states', { id: userId, ...newState });
        }
      } catch (error) {
        // 如果獲取失敗，嘗試創建新文檔
        await DataService.createDocument('user_slot_states', { id: userId, ...newState });
      }
      
      // 3. 更新快取
      this.setCachedState(userId, newState);
      
      this.stats.stateUpdates++;
      console.log(`[SlotStateManager] 狀態更新成功 - 用戶: ${userId}`);
      
      return newState;
    } catch (error) {
      console.error(`[SlotStateManager] 更新用戶狀態失敗 - 用戶: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 創建初始狀態
   * @param {string} userId - 用戶ID
   * @returns {Object} 初始狀態物件
   */
  createInitialState(userId) {
    this.stats.stateCreations++;
    console.log(`[SlotStateManager] 創建初始狀態 - 用戶: ${userId}`);
    
    return {
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active_task: null,
      settings: {
        language: 'zh-TW',
        timeout_minutes: 30,
        auto_reminder: true
      }
    };
  }

  /**
   * 檢查狀態是否過期
   * @param {Object} state - 狀態物件
   * @returns {boolean} 是否過期
   */
  isStateExpired(state) {
    if (!state.updated_at) {
      return true;
    }

    const lastUpdate = new Date(state.updated_at).getTime();
    const now = Date.now();
    const expired = (now - lastUpdate) > this.stateTimeout;
    
    if (expired) {
      console.log(`[SlotStateManager] 狀態已過期 - 用戶: ${state.user_id}, 上次更新: ${state.updated_at}`);
    }
    
    return expired;
  }

  /**
   * 從快取獲取狀態
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 快取的狀態或null
   */
  getCachedState(userId) {
    const cached = this.cache.get(userId);
    if (!cached) {
      return null;
    }

    // 檢查快取是否過期
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(userId);
      return null;
    }

    // 更新存取次數和時間戳 (用於LRU)
    cached.accessCount++;
    cached.timestamp = Date.now();
    
    return cached.state;
  }

  /**
   * 設定快取狀態
   * @param {string} userId - 用戶ID
   * @param {Object} state - 狀態物件
   */
  setCachedState(userId, state) {
    // 如果快取已滿，移除最少使用的項目
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastUsed();
    }

    this.cache.set(userId, {
      state: { ...state }, // 深拷貝避免意外修改
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * 清除最少使用的快取項目 (LRU策略)
   */
  evictLeastUsed() {
    let leastUsedKey = null;
    let leastAccessCount = Infinity;
    let oldestTimestamp = Infinity;

    for (const [key, value] of this.cache.entries()) {
      // 優先移除存取次數最少的，如果相同則移除最舊的
      if (value.accessCount < leastAccessCount || 
          (value.accessCount === leastAccessCount && value.timestamp < oldestTimestamp)) {
        leastAccessCount = value.accessCount;
        oldestTimestamp = value.timestamp;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      console.log(`[SlotStateManager] LRU 清除快取項目: ${leastUsedKey}`);
    }
  }

  /**
   * 清除指定用戶的快取
   * @param {string} userId - 用戶ID
   */
  clearUserCache(userId) {
    const deleted = this.cache.delete(userId);
    if (deleted) {
      console.log(`[SlotStateManager] 清除用戶快取: ${userId}`);
    }
  }

  /**
   * 清除所有快取
   */
  clearAllCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[SlotStateManager] 清除所有快取 (${size} 項目)`);
  }

  /**
   * 獲取快取統計資訊
   * @returns {Object} 統計資訊
   */
  getCacheStats() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0 
      ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * 估算記憶體使用量 (粗略計算)
   * @returns {number} 估算的記憶體使用量 (bytes)
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache.entries()) {
      // 粗略估算: key + JSON字串化的state
      totalSize += key.length * 2; // Unicode字符佔2字節
      totalSize += JSON.stringify(value.state).length * 2;
      totalSize += 16; // timestamp + accessCount的大致大小
    }
    return totalSize;
  }

  /**
   * 批量清理過期狀態 (定期清理任務)
   * @returns {Promise<number>} 清理的數量
   */
  async cleanupExpiredStates() {
    try {
      const collection = 'user_slot_states';
      const cutoffTime = new Date(Date.now() - this.stateTimeout).toISOString();
      
      // 查詢過期的狀態
      const query = await DataService.queryDocuments(collection, [
        { field: 'updated_at', operator: '<', value: cutoffTime }
      ]);

      let cleanedCount = 0;
      for (const doc of query) {
        await DataService.deleteDocument(collection, doc.user_id);
        this.clearUserCache(doc.user_id);
        cleanedCount++;
      }

      if (cleanedCount > 0) {
        console.log(`[SlotStateManager] 清理了 ${cleanedCount} 個過期狀態`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[SlotStateManager] 清理過期狀態失敗:', error);
      throw error;
    }
  }

  /**
   * 設定快取參數
   * @param {Object} options - 設定選項
   */
  configureCacheSettings(options = {}) {
    if (options.maxCacheSize !== undefined) {
      this.maxCacheSize = options.maxCacheSize;
    }
    if (options.cacheTimeout !== undefined) {
      this.cacheTimeout = options.cacheTimeout;
    }
    if (options.stateTimeout !== undefined) {
      this.stateTimeout = options.stateTimeout;
    }
    
    console.log(`[SlotStateManager] 快取設定更新:`, {
      maxCacheSize: this.maxCacheSize,
      cacheTimeout: this.cacheTimeout,
      stateTimeout: this.stateTimeout
    });
  }
}

module.exports = SlotStateManager;