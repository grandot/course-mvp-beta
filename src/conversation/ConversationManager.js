/**
 * 對話管理器 (ConversationManager)
 * 使用 Redis 儲存對話狀態，支援多輪對話功能
 *
 * 主要功能：
 * - 對話狀態管理（30分鐘 TTL）
 * - 操作性意圖上下文追蹤
 * - Quick Reply 按鈕處理
 * - 優雅降級處理（Redis 不可用時）
 */

const { getRedisService } = require('../services/redisService');

class ConversationManager {
  constructor() {
    this.redisService = getRedisService();
    // 對話記憶 TTL（秒）：可由環境變數覆寫，預設 5 分鐘（300 秒）
    try {
      const envTtl = parseInt(process.env.CONVERSATION_TTL_SECONDS, 10);
      this.defaultTTL = Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 300;
    } catch (_) {
      this.defaultTTL = 300;
    }
    this.maxHistoryLength = 5; // 保留最近5輪對話
    this.isRedisAvailable = null; // 快取 Redis 可用狀態
  }

  /**
   * 檢查 Redis 可用性
   * @returns {Promise<boolean>}
   */
  async checkRedisAvailability() {
    if (this.isRedisAvailable !== null) {
      return this.isRedisAvailable;
    }

    const health = await this.redisService.healthCheck();
    this.isRedisAvailable = health.status === 'healthy';

    // 每5分鐘重新檢查一次
    setTimeout(() => {
      this.isRedisAvailable = null;
    }, 300000);

    return this.isRedisAvailable;
  }

  /**
   * 建立對話上下文鍵名
   * @param {string} userId - 用戶 ID
   * @returns {string}
   */
  getContextKey(userId) {
    return `conversation:${userId}`;
  }

  /**
   * 取得對話上下文
   * @param {string} userId - 用戶 ID
   * @returns {Promise<object|null>} 對話上下文或 null
   */
  async getContext(userId) {
    try {
      const isAvailable = await this.checkRedisAvailability();
      if (!isAvailable) {
        console.warn('⚠️ Redis 不可用，回傳空對話上下文');
        return this.createEmptyContext(userId);
      }

      const key = this.getContextKey(userId);
      const context = await this.redisService.get(key);

      if (!context) {
        return this.createEmptyContext(userId);
      }

      // 檢查上下文是否過期（雙重保險）
      const now = Date.now();
      const timeDiff = now - context.lastActivity;
      if (timeDiff > this.defaultTTL * 1000) {
        console.log(`🧹 對話上下文已過期，清理用戶: ${userId}`);
        await this.clearContext(userId);
        return this.createEmptyContext(userId);
      }

      return context;
    } catch (error) {
      console.error('❌ 取得對話上下文失敗:', error.message);
      return this.createEmptyContext(userId);
    }
  }

  /**
   * 儲存對話上下文
   * @param {string} userId - 用戶 ID
   * @param {object} context - 對話上下文
   * @returns {Promise<boolean>} 是否成功
   */
  async saveContext(userId, context) {
    try {
      const isAvailable = await this.checkRedisAvailability();
      if (!isAvailable) {
        console.warn('⚠️ Redis 不可用，對話上下文儲存失敗');
        return false;
      }

      // 更新最後活動時間
      context.lastActivity = Date.now();

      // 限制對話歷史長度
      if (context.state.history.length > this.maxHistoryLength) {
        context.state.history = context.state.history.slice(-this.maxHistoryLength);
      }

      const key = this.getContextKey(userId);
      return await this.redisService.set(key, context, this.defaultTTL);
    } catch (error) {
      console.error('❌ 儲存對話上下文失敗:', error.message);
      return false;
    }
  }

  /**
   * 清理對話上下文
   * @param {string} userId - 用戶 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async clearContext(userId) {
    try {
      const isAvailable = await this.checkRedisAvailability();
      if (!isAvailable) {
        console.warn('⚠️ Redis 不可用，對話上下文清理失敗');
        return false;
      }

      const key = this.getContextKey(userId);
      return await this.redisService.delete(key);
    } catch (error) {
      console.error('❌ 清理對話上下文失敗:', error.message);
      return false;
    }
  }

  /**
   * 建立空的對話上下文
   * @param {string} userId - 用戶 ID
   * @returns {object}
   */
  createEmptyContext(userId) {
    return {
      userId,
      lastActivity: Date.now(),
      state: {
        currentFlow: null, // null | course_creation | course_modification | content_recording
        expectingInput: [], // 可接受的輸入類型陣列
        lastActions: {}, // 各意圖的最近操作記錄
        pendingData: {}, // 待確認或處理的資料
        history: [], // 對話歷史
        mentionedEntities: {
          students: [],
          courses: [],
          dates: [],
          times: [],
        },
        // 查詢會話鎖：避免不同學生的查詢互相串台
        activeQuerySession: null, // { studentName, timeReference, startedAt }
      },
    };
  }

  /**
   * 記錄用戶訊息到對話歷史
   * @param {string} userId - 用戶 ID
   * @param {string} message - 用戶訊息
   * @param {string} intent - 識別的意圖
   * @param {object} slots - 提取的實體
   * @returns {Promise<boolean>} 是否成功
   */
  async recordUserMessage(userId, message, intent, slots = {}) {
    try {
      const context = await this.getContext(userId);

      const userRecord = {
        role: 'user',
        message,
        intent,
        slots,
        timestamp: Date.now(),
      };

      context.state.history.push(userRecord);

      // 更新提及的實體
      this.updateMentionedEntities(context, slots);

      return await this.saveContext(userId, context);
    } catch (error) {
      console.error('❌ 記錄用戶訊息失敗:', error.message);
      return false;
    }
  }

  /**
   * 記錄機器人回應到對話歷史
   * @param {string} userId - 用戶 ID
   * @param {string} message - 機器人訊息
   * @param {object} options - 選項（如 quickReply）
   * @returns {Promise<boolean>} 是否成功
   */
  async recordBotResponse(userId, message, options = {}) {
    try {
      const context = await this.getContext(userId);

      const botRecord = {
        role: 'assistant',
        message,
        timestamp: Date.now(),
        ...options, // quickReply, actions 等
      };

      context.state.history.push(botRecord);

      return await this.saveContext(userId, context);
    } catch (error) {
      console.error('❌ 記錄機器人回應失敗:', error.message);
      return false;
    }
  }

  /**
   * 記錄任務執行結果到對話上下文
   * @param {string} userId - 用戶 ID
   * @param {string} intent - 意圖名稱
   * @param {object} slots - 實體資料
   * @param {object} result - 任務執行結果
   * @returns {Promise<boolean>} 是否成功
   */
  async recordTaskResult(userId, intent, slots, result) {
    try {
      const context = await this.getContext(userId);

      // 記錄最近的操作
      context.state.lastActions[intent] = {
        intent,
        slots,
        result,
        timestamp: Date.now(),
      };

      // 如果任務成功，設定期待的輸入類型
      if (result.success) {
        // 讀取型查詢不應進入期待輸入狀態
        const isReadOnly = ['query_schedule', 'query_course_content'].includes(intent);
        if (!isReadOnly) {
          context.state.expectingInput = ['confirmation', 'modification'];

          // 根據意圖設定對話流程
          switch (intent) {
            case 'add_course':
              context.state.currentFlow = 'course_creation';
              break;
            case 'record_content':
              context.state.currentFlow = 'content_recording';
              break;
            default:
              context.state.currentFlow = null;
          }
        }
      }

      return await this.saveContext(userId, context);
    } catch (error) {
      console.error('❌ 記錄任務結果失敗:', error.message);
      return false;
    }
  }

  /**
   * 設定期待輸入狀態（用於缺失資訊補充）
   * @param {string} userId - 用戶 ID
   * @param {string} currentFlow - 當前對話流程
   * @param {Array<string>} inputTypes - 期待的輸入類型
   * @param {object} pendingSlots - 待補充的 slots 資料
   * @returns {Promise<boolean>} 是否成功
   */
  async setExpectedInput(userId, currentFlow, inputTypes, pendingSlots = {}) {
    try {
      const context = await this.getContext(userId);

      context.state.currentFlow = currentFlow;
      context.state.expectingInput = inputTypes;
      context.state.pendingData = {
        ...context.state.pendingData,
        slots: pendingSlots,
        timestamp: Date.now(),
      };

      return await this.saveContext(userId, context);
    } catch (error) {
      console.error('❌ 設定期待輸入失敗:', error.message);
      return false;
    }
  }

  /**
   * 取得最近的操作上下文
   * @param {string} userId - 用戶 ID
   * @param {string} intentType - 意圖類型（選填）
   * @returns {Promise<object|null>} 最近的操作上下文
   */
  async getLastAction(userId, intentType = null) {
    try {
      const context = await this.getContext(userId);

      if (!context.state.lastActions || Object.keys(context.state.lastActions).length === 0) {
        return null;
      }

      if (intentType && context.state.lastActions[intentType]) {
        return context.state.lastActions[intentType];
      }

      // 回傳最近的操作（按時間戳排序）
      const actions = Object.values(context.state.lastActions);
      return actions.reduce((latest, current) => (current.timestamp > latest.timestamp ? current : latest));
    } catch (error) {
      console.error('❌ 取得最近操作失敗:', error.message);
      return null;
    }
  }

  /**
   * 檢查是否期待特定類型的輸入
   * @param {string} userId - 用戶 ID
   * @param {string} inputType - 輸入類型
   * @returns {Promise<boolean>} 是否期待此輸入
   */
  async isExpectingInput(userId, inputType) {
    try {
      const context = await this.getContext(userId);
      return context.state.expectingInput.includes(inputType);
    } catch (error) {
      console.error('❌ 檢查期待輸入失敗:', error.message);
      return false;
    }
  }

  /**
   * 清除期待的輸入狀態
   * @param {string} userId - 用戶 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async clearExpectedInput(userId) {
    try {
      const context = await this.getContext(userId);
      context.state.expectingInput = [];
      context.state.currentFlow = null;
      return await this.saveContext(userId, context);
    } catch (error) {
      console.error('❌ 清除期待輸入失敗:', error.message);
      return false;
    }
  }

  /**
   * 更新提及的實體
   * @param {object} context - 對話上下文
   * @param {object} slots - 實體資料
   */
  updateMentionedEntities(context, slots) {
    const entities = context.state.mentionedEntities;

    if (slots.studentName && !entities.students.includes(slots.studentName)) {
      entities.students.push(slots.studentName);
    }

    if (slots.courseName && !entities.courses.includes(slots.courseName)) {
      entities.courses.push(slots.courseName);
    }

    if (slots.courseDate && !entities.dates.includes(slots.courseDate)) {
      entities.dates.push(slots.courseDate);
    }

    if (slots.scheduleTime && !entities.times.includes(slots.scheduleTime)) {
      entities.times.push(slots.scheduleTime);
    }

    // 限制陣列長度，保留最近的實體
    const maxEntityCount = 10;
    Object.keys(entities).forEach((key) => {
      if (entities[key].length > maxEntityCount) {
        entities[key] = entities[key].slice(-maxEntityCount);
      }
    });
  }

  /**
   * 取得查詢會話 TTL（ms）
   * 測試用戶（U_test_ 開頭）自動為 0，避免用例污染
   */
  getQuerySessionTtlMs(userId) {
    try {
      if (userId && String(userId).startsWith('U_test_')) return 0;
      const raw = process.env.QUERY_SESSION_TTL_MS;
      const n = raw ? parseInt(raw, 10) : 60000;
      return Number.isFinite(n) ? n : 60000;
    } catch (_) {
      return 60000;
    }
  }

  /**
   * 讀取有效的查詢會話（若過期則回 null）
   */
  async getActiveQuerySession(userId) {
    const context = await this.getContext(userId);
    const session = context.state.activeQuerySession;
    if (!session) return null;
    const ttl = this.getQuerySessionTtlMs(userId);
    if (ttl <= 0) return null;
    const alive = Date.now() - (session.startedAt || 0) <= ttl;
    if (!alive) {
      context.state.activeQuerySession = null;
      await this.saveContext(userId, context);
      return null;
    }
    return session;
  }

  /**
   * 設定/更新查詢會話
   */
  async setActiveQuerySession(userId, { studentName = null, timeReference = null }) {
    const context = await this.getContext(userId);
    context.state.activeQuerySession = {
      studentName: studentName || null,
      timeReference: timeReference || null,
      startedAt: Date.now(),
    };
    await this.saveContext(userId, context);
    return true;
  }

  /**
   * 清除查詢會話
   */
  async clearActiveQuerySession(userId) {
    const context = await this.getContext(userId);
    context.state.activeQuerySession = null;
    return this.saveContext(userId, context);
  }

  /**
   * 取得健康狀態
   * @returns {Promise<object>} 健康狀態資訊
   */
  async healthCheck() {
    const redisHealth = await this.redisService.healthCheck();

    return {
      status: redisHealth.status === 'healthy' ? 'healthy' : 'degraded',
      redis: redisHealth,
      features: {
        multiTurnDialogue: redisHealth.status === 'healthy',
        quickReply: redisHealth.status === 'healthy',
        contextAware: redisHealth.status === 'healthy',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 批量清理過期的對話上下文（維護任務）
   * @returns {Promise<number>} 清理的數量
   */
  async cleanupExpiredContexts() {
    try {
      const isAvailable = await this.checkRedisAvailability();
      if (!isAvailable) {
        console.warn('⚠️ Redis 不可用，無法執行清理任務');
        return 0;
      }

      const pattern = 'conversation:*';
      const keys = await this.redisService.scan(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redisService.getTTL(key);
        if (ttl === -2) { // 鍵不存在
          cleanedCount++;
        } else if (ttl === -1) { // 永不過期的鍵，手動檢查
          const context = await this.redisService.get(key);
          if (context && Date.now() - context.lastActivity > this.defaultTTL * 1000) {
            await this.redisService.delete(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 清理過期對話上下文：${cleanedCount} 個`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('❌ 清理過期對話上下文失敗:', error.message);
      return 0;
    }
  }
}

// 建立單例實例
let conversationManager = null;

/**
 * 取得對話管理器實例（單例模式）
 * @returns {ConversationManager}
 */
function getConversationManager() {
  if (!conversationManager) {
    conversationManager = new ConversationManager();
  }
  return conversationManager;
}

module.exports = {
  ConversationManager,
  getConversationManager,
};
