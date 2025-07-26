/**
 * ConversationContext - 會話上下文管理器
 * 職責：管理用戶會話狀態，支持上下文感知的語義分析
 * 功能：存儲最近操作、實體回溯、自動過期清理
 */

class ConversationContext {
  // 內存存儲會話狀態 (生產環境可考慮 Redis)
  static contexts = new Map();
  
  // 會話過期時間 (5分鐘)
  static CONTEXT_EXPIRE_TIME = 5 * 60 * 1000;

  /**
   * 更新用戶會話上下文
   * @param {string} userId - 用戶ID
   * @param {string} action - 執行的動作類型
   * @param {Object} entities - 提取的實體信息
   * @param {Object} result - 執行結果
   */
  static updateContext(userId, action, entities, result = null) {
    if (!userId) {
      console.warn('ConversationContext: userId is required');
      return;
    }

    const now = Date.now();
    const context = {
      userId,
      lastAction: action,
      lastIntent: action,
      lastCourse: entities.course_name || entities.courseName,
      lastTime: entities.timeInfo?.schedule_time,
      lastDate: entities.timeInfo?.course_date,
      lastLocation: entities.location,
      lastTeacher: entities.teacher,
      executionResult: result,
      timestamp: now,
      expiresAt: now + this.CONTEXT_EXPIRE_TIME,
    };

    this.contexts.set(userId, context);
    
    console.log(`🔧 [DEBUG] 更新會話上下文 - UserId: ${userId}, Action: ${action}, Course: ${context.lastCourse}`);
    
    // 定期清理過期上下文
    this.clearExpired();
  }

  /**
   * 獲取用戶會話上下文
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 會話上下文或null
   */
  static getContext(userId) {
    if (!userId) {
      return null;
    }

    const context = this.contexts.get(userId);
    
    if (!context) {
      return null;
    }

    // 檢查是否過期
    if (Date.now() > context.expiresAt) {
      this.contexts.delete(userId);
      console.log(`🔧 [DEBUG] 會話上下文已過期 - UserId: ${userId}`);
      return null;
    }

    console.log(`🔧 [DEBUG] 獲取會話上下文 - UserId: ${userId}, LastCourse: ${context.lastCourse}`);
    return context;
  }

  /**
   * 檢查是否有有效的會話上下文
   * @param {string} userId - 用戶ID  
   * @returns {boolean} 是否有有效上下文
   */
  static hasValidContext(userId) {
    const context = this.getContext(userId);
    return context !== null;
  }

  /**
   * 清除用戶會話上下文
   * @param {string} userId - 用戶ID
   */
  static clearContext(userId) {
    if (!userId) {
      return;
    }

    const deleted = this.contexts.delete(userId);
    if (deleted) {
      console.log(`🔧 [DEBUG] 清除會話上下文 - UserId: ${userId}`);
    }
  }

  /**
   * 清理所有過期的會話上下文
   */
  static clearExpired() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [userId, context] of this.contexts.entries()) {
      if (now > context.expiresAt) {
        this.contexts.delete(userId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`🔧 [DEBUG] 清理過期會話上下文 - 數量: ${expiredCount}`);
    }
  }

  /**
   * 獲取所有活躍會話統計
   * @returns {Object} 會話統計信息
   */
  static getStats() {
    this.clearExpired();
    
    return {
      activeContexts: this.contexts.size,
      totalMemoryUsage: JSON.stringify([...this.contexts.values()]).length,
      oldestContext: this.contexts.size > 0 ? 
        Math.min(...[...this.contexts.values()].map(c => c.timestamp)) : null,
    };
  }

  /**
   * 檢查輸入是否為糾錯意圖
   * @param {string} text - 用戶輸入文本
   * @returns {boolean} 是否為糾錯意圖
   */
  static isCorrectionIntent(text) {
    if (!text) return false;

    const correctionKeywords = [
      '不對', '錯了', '錯誤', '不是', '改正', '糾正',
      '不對的', '錯了的', '不正確', '有誤', '弄錯',
    ];

    const correctionPatterns = [
      /^不對/, 
      /^錯了/, 
      /^不是/, 
      /不對.*改成/, 
      /錯了.*改成/,
      /不是.*應該/,
    ];

    // 檢查關鍵詞
    const hasKeyword = correctionKeywords.some(keyword => text.includes(keyword));
    
    // 檢查模式
    const hasPattern = correctionPatterns.some(pattern => pattern.test(text));

    return hasKeyword || hasPattern;
  }

  /**
   * 從上下文解析實體（用於糾錯場景）
   * @param {string} userId - 用戶ID
   * @param {string} currentText - 當前輸入文本
   * @returns {Object} 解析的實體信息
   */
  static resolveEntitiesFromContext(userId, currentText) {
    const context = this.getContext(userId);
    
    if (!context) {
      console.log(`🔧 [DEBUG] 無會話上下文可用於實體解析 - UserId: ${userId}`);
      return null;
    }

    // 構建解析結果：課程名稱來自上下文，其他信息從當前輸入解析
    const resolvedEntities = {
      course_name: context.lastCourse,
      courseName: context.lastCourse, // 向後兼容
      location: null, // 需要從當前輸入重新解析
      teacher: null,  // 需要從當前輸入重新解析
      confirmation: null,
      fromContext: true, // 標記來源
      contextSource: {
        lastAction: context.lastAction,
        timestamp: context.timestamp,
      },
    };

    console.log(`🔧 [DEBUG] 從上下文解析實體 - Course: ${resolvedEntities.course_name}, 來源: ${context.lastAction}`);
    
    return resolvedEntities;
  }

  /**
   * 重置所有會話上下文（主要用於測試）
   */
  static reset() {
    this.contexts.clear();
    console.log('🔧 [DEBUG] 重置所有會話上下文');
  }
}

module.exports = ConversationContext;