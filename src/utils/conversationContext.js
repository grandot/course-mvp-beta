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
   * 更新用戶會話上下文 - 智能合併版本
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
    
    // 🎯 第一性原則：獲取現有上下文，智能合併而不是覆蓋
    const existingContext = this.contexts.get(userId) || {};
    
    // 🎯 智能合併策略
    const context = {
      // 保留現有上下文的重要信息
      ...existingContext,
      
      // 更新基本信息
      userId,
      lastAction: action,
      lastIntent: action,
      timestamp: now,
      expiresAt: now + this.CONTEXT_EXPIRE_TIME,
      
      // 🎯 智能課程名稱處理
      lastCourse: this.mergeCourseName(existingContext.lastCourse, entities.course_name || entities.courseName),
      
      // 🎯 智能時間信息處理
      lastTime: entities.timeInfo?.display || entities.timeInfo?.schedule_time || existingContext.lastTime,
      lastDate: entities.timeInfo?.date || entities.timeInfo?.course_date || existingContext.lastDate,
      lastLocation: entities.location || existingContext.lastLocation,
      lastTeacher: entities.teacher || existingContext.lastTeacher,
      lastStudent: entities.student || existingContext.lastStudent,
      
      // 🎯 智能 timeInfo 處理
      lastTimeInfo: entities.timeInfo ? {
        display: entities.timeInfo.display,
        date: entities.timeInfo.date,
        raw: entities.timeInfo.raw,
        timestamp: entities.timeInfo.timestamp
      } : existingContext.lastTimeInfo,
      
      // 🎯 智能執行結果處理
      executionResult: result || existingContext.executionResult,
      
      // 🎯 新增：會話狀態追蹤
      sessionState: this.determineSessionState(action, existingContext.sessionState),
      
      // 🎯 新增：操作歷史
      actionHistory: this.updateActionHistory(existingContext.actionHistory || [], action, now),
    };

    this.contexts.set(userId, context);
    
    console.log(`🔧 [DEBUG] 智能更新會話上下文 - UserId: ${userId}, Action: ${action}, Course: ${context.lastCourse}`);
    console.log(`🔧 [DEBUG] 會話狀態: ${context.sessionState}, 操作歷史: ${context.actionHistory.length} 項`);
    
    // 定期清理過期上下文
    this.clearExpired();
  }

  /**
   * 🎯 智能合併課程名稱
   * @param {string} existingCourse - 現有課程名稱
   * @param {string} newCourse - 新課程名稱
   * @returns {string} 合併後的課程名稱
   */
  static mergeCourseName(existingCourse, newCourse) {
    // 如果新課程名稱存在且與現有不同，優先使用新的
    if (newCourse && newCourse !== existingCourse) {
      console.log(`🔧 [DEBUG] 課程名稱更新: ${existingCourse} -> ${newCourse}`);
      return newCourse;
    }
    
    // 否則保留現有的
    return existingCourse;
  }

  /**
   * 🎯 確定會話狀態
   * @param {string} action - 當前動作
   * @param {string} existingState - 現有狀態
   * @returns {string} 新的會話狀態
   */
  static determineSessionState(action, existingState) {
    const stateMap = {
      'record_lesson_content': 'content_recorded',
      'waiting_for_photo': 'awaiting_photo',
      'photo_uploaded': 'photo_uploaded',
      'course_selected': 'course_confirmed',
      'cancel_course': 'cancelling',
      'completed': 'completed'
    };
    
    return stateMap[action] || existingState || 'idle';
  }

  /**
   * 🎯 更新操作歷史
   * @param {Array} history - 現有歷史
   * @param {string} action - 新動作
   * @param {number} timestamp - 時間戳
   * @returns {Array} 更新後的歷史
   */
  static updateActionHistory(history, action, timestamp) {
    const newEntry = { action, timestamp };
    const updated = [newEntry, ...history];
    
    // 只保留最近 10 個操作
    return updated.slice(0, 10);
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
   * 檢查是否有等待後續資訊的上下文
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 如果是pending狀態，返回上下文，否則返回null
   */
  static getPendingContext(userId) {
    const context = this.getContext(userId);
    if (context && context.lastAction && context.lastAction.endsWith('_pending')) {
      console.log(`🔧 [DEBUG] 檢測到等待補充的上下文 - UserId: ${userId}, Action: ${context.lastAction}`);
      return context;
    }
    return null;
  }

  /**
   * 設置待處理圖片上下文
   * @param {string} userId - 用戶ID
   * @param {Object} imageContext - 圖片上下文信息
   */
  static setPendingImageContext(userId, imageContext) {
    if (!userId) {
      console.warn('ConversationContext: userId is required');
      return;
    }

    const pendingKey = `pending_image_${userId}`;
    this.contexts.set(pendingKey, {
      userId,
      type: 'pending_image',
      ...imageContext,
      timestamp: Date.now()
    });

    console.log(`📸 [ConversationContext] 設置待處理圖片上下文: ${userId}`);
  }

  /**
   * 獲取待處理圖片上下文
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 圖片上下文信息
   */
  static getPendingImageContext(userId) {
    if (!userId) return null;

    const pendingKey = `pending_image_${userId}`;
    const context = this.contexts.get(pendingKey);
    
    if (context && context.expiresAt > Date.now()) {
      return context;
    }
    
    // 過期自動清理
    if (context) {
      this.contexts.delete(pendingKey);
      console.log(`📸 [ConversationContext] 自動清理過期圖片上下文: ${userId}`);
    }
    
    return null;
  }

  /**
   * 清除待處理圖片上下文
   * @param {string} userId - 用戶ID
   */
  static clearPendingImageContext(userId) {
    if (!userId) return;

    const pendingKey = `pending_image_${userId}`;
    const existed = this.contexts.has(pendingKey);
    this.contexts.delete(pendingKey);
    
    if (existed) {
      console.log(`📸 [ConversationContext] 清除待處理圖片上下文: ${userId}`);
    }
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