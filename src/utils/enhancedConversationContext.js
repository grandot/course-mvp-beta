/**
 * EnhancedConversationContext - 增強版會話上下文管理器
 * Phase 4 實現 - 擴展觸發範圍 + 用戶習慣學習
 * 
 * 功能擴展：
 * - 觸發意圖從 3 個擴展到 12 個
 * - 用戶習慣學習機制
 * - 高頻課程和學生識別
 * - 會話級元數據管理
 * - 智能預測和補全
 */

const ConversationContext = require('./conversationContext');

class EnhancedConversationContext extends ConversationContext {
  
  // 擴展的觸發意圖列表 (從 3 個到 12 個)
  static EXPANDED_TRIGGER_INTENTS = [
    // 原有的課程管理意圖
    'record_course',
    'modify_course', 
    'cancel_course',
    
    // 新增：課程管理意圖
    'add_course',
    'query_course',
    'create_recurring_course',
    'stop_recurring_course',
    
    // 新增：內容記錄意圖
    'record_lesson_content',
    'record_homework',
    'upload_class_photo',
    'modify_course_content',
    
    // 新增：查詢場景意圖 (部分情況需要上下文)
    'query_schedule',
    'query_course_content',
    
    // 新增：提醒設置意圖
    'set_reminder',
    'modify_reminder'
  ];

  // 用戶習慣學習權重配置
  static LEARNING_WEIGHTS = {
    FREQUENCY_THRESHOLD: 3,        // 高頻課程閾值
    STUDENT_PREFERENCE_WEIGHT: 0.6, // 學生偏好權重
    TIME_DECAY_FACTOR: 0.9,        // 時間衰減因子
    PATTERN_CONFIDENCE_MIN: 0.7    // 模式置信度最小值
  };

  /**
   * 增強版上下文更新 - 支持學習機制
   * @param {string} userId 用戶ID
   * @param {string} action 執行的動作類型
   * @param {Object} entities 提取的實體信息
   * @param {Object} result 執行結果
   */
  static updateContext(userId, action, entities, result = null) {
    if (!userId) {
      console.warn('EnhancedConversationContext: userId is required');
      return;
    }

    // 檢查是否應該觸發上下文更新
    if (!this.shouldTriggerContextUpdate(action, entities)) {
      console.log(`🔧 [DEBUG] 跳過上下文更新 - 意圖: ${action}`);
      return;
    }

    const now = Date.now();
    
    // 獲取現有上下文進行增強
    const existingContext = this.contexts.get(userId) || {};
    
    // 構建增強的上下文數據
    const enhancedContext = {
      ...existingContext,
      userId,
      lastAction: action,
      lastIntent: action,
      lastCourse: entities.course_name || entities.courseName,
      lastTime: entities.timeInfo?.display || entities.timeInfo?.schedule_time,
      lastDate: entities.timeInfo?.date || entities.timeInfo?.course_date,
      lastLocation: entities.location,
      lastTeacher: entities.teacher,
      lastStudent: entities.student,
      lastTimeInfo: entities.timeInfo ? {
        display: entities.timeInfo.display,
        date: entities.timeInfo.date,
        raw: entities.timeInfo.raw,
        timestamp: entities.timeInfo.timestamp
      } : null,
      executionResult: result,
      timestamp: now,
      expiresAt: now + this.CONTEXT_EXPIRE_TIME,
      
      // 🆕 新增：增強數據結構
      recentCourses: this.updateRecentCourses(existingContext.recentCourses || [], entities),
      recentStudents: this.updateRecentStudents(existingContext.recentStudents || [], entities),
      userPreferences: this.updateUserPreferences(existingContext.userPreferences || {}, entities, action),
      sessionMetadata: {
        ...existingContext.sessionMetadata,
        lastUpdateTime: now,
        totalInteractions: (existingContext.sessionMetadata?.totalInteractions || 0) + 1,
        intentHistory: this.updateIntentHistory(existingContext.sessionMetadata?.intentHistory || [], action)
      }
    };

    // 🆕 應用用戶習慣學習
    this.learnUserPatterns(enhancedContext);

    this.contexts.set(userId, enhancedContext);
    
    console.log(`🔧 [DEBUG] 更新增強會話上下文 - UserId: ${userId}, Action: ${action}, Course: ${enhancedContext.lastCourse}`);
    console.log(`🔧 [DEBUG] 學習數據: 最近課程=${enhancedContext.recentCourses.length}, 最近學生=${enhancedContext.recentStudents.length}`);
    
    // 定期清理過期上下文
    this.clearExpired();
  }

  /**
   * 判斷是否應該觸發上下文更新
   * @param {string} action 意圖
   * @param {Object} entities 實體
   * @returns {boolean} 是否觸發
   */
  static shouldTriggerContextUpdate(action, entities) {
    // 1. 檢查意圖是否在觸發列表中
    if (!this.EXPANDED_TRIGGER_INTENTS.includes(action)) {
      return false;
    }

    // 2. 特殊情況：查詢意圖需要包含具體實體才觸發
    const queryIntents = ['query_schedule', 'query_course_content'];
    if (queryIntents.includes(action)) {
      return !!(entities?.student || entities?.courseName || entities?.course_name || entities?.teacher);
    }

    // 3. 其他意圖：有課程名稱或學生名稱就觸發
    return !!(entities?.course_name || entities?.courseName || entities?.student);
  }

  /**
   * 更新最近課程列表
   * @param {Array} recentCourses 現有最近課程
   * @param {Object} entities 實體數據
   * @returns {Array} 更新後的最近課程
   */
  static updateRecentCourses(recentCourses, entities) {
    const courseName = entities.course_name || entities.courseName;
    if (!courseName) return recentCourses;

    const now = Date.now();
    
    // 移除現有的相同課程
    const filtered = recentCourses.filter(course => course.name !== courseName);
    
    // 添加到列表前端
    const updated = [{
      name: courseName,
      student: entities.student,
      teacher: entities.teacher,
      lastMentioned: now,
      frequency: (recentCourses.find(c => c.name === courseName)?.frequency || 0) + 1
    }, ...filtered];

    // 保持最多 10 個最近課程
    return updated.slice(0, 10);
  }

  /**
   * 更新最近學生列表
   * @param {Array} recentStudents 現有最近學生
   * @param {Object} entities 實體數據
   * @returns {Array} 更新後的最近學生
   */
  static updateRecentStudents(recentStudents, entities) {
    const studentName = entities.student;
    if (!studentName) return recentStudents;

    const now = Date.now();
    
    // 移除現有的相同學生
    const filtered = recentStudents.filter(student => student.name !== studentName);
    
    // 添加到列表前端
    const updated = [{
      name: studentName,
      lastMentioned: now,
      frequency: (recentStudents.find(s => s.name === studentName)?.frequency || 0) + 1,
      associatedCourses: this.updateAssociatedCourses(
        recentStudents.find(s => s.name === studentName)?.associatedCourses || [],
        entities.course_name || entities.courseName
      )
    }, ...filtered];

    // 保持最多 5 個最近學生
    return updated.slice(0, 5);
  }

  /**
   * 更新關聯課程
   * @param {Array} associatedCourses 現有關聯課程
   * @param {string} courseName 課程名稱
   * @returns {Array} 更新後的關聯課程
   */
  static updateAssociatedCourses(associatedCourses, courseName) {
    if (!courseName) return associatedCourses;
    
    const existing = associatedCourses.find(c => c.name === courseName);
    if (existing) {
      existing.count++;
      existing.lastMentioned = Date.now();
    } else {
      associatedCourses.push({
        name: courseName,
        count: 1,
        lastMentioned: Date.now()
      });
    }
    
    // 按次數排序，保持最多 5 個
    return associatedCourses
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * 更新用戶偏好設定
   * @param {Object} userPreferences 現有偏好
   * @param {Object} entities 實體數據
   * @param {string} action 意圖
   * @returns {Object} 更新後的偏好
   */
  static updateUserPreferences(userPreferences, entities, action) {
    const preferences = { ...userPreferences };
    
    // 默認學生學習
    if (entities.student) {
      preferences.defaultStudent = this.updateDefaultStudent(preferences.defaultStudent, entities.student);
    }
    
    // 高頻課程統計
    if (entities.course_name || entities.courseName) {
      preferences.frequentCourses = this.updateFrequencyStats(
        preferences.frequentCourses || {},
        entities.course_name || entities.courseName
      );
    }
    
    // 時間偏好學習
    if (entities.timeInfo) {
      preferences.timePatterns = this.updateTimePatterns(
        preferences.timePatterns || [],
        entities.timeInfo
      );
    }
    
    // 意圖使用模式
    preferences.intentPatterns = this.updateIntentPatterns(
      preferences.intentPatterns || {},
      action
    );
    
    return preferences;
  }

  /**
   * 更新意圖歷史
   * @param {Array} intentHistory 意圖歷史
   * @param {string} action 當前意圖
   * @returns {Array} 更新後的意圖歷史
   */
  static updateIntentHistory(intentHistory, action) {
    const updated = [{ intent: action, timestamp: Date.now() }, ...intentHistory];
    return updated.slice(0, 20); // 保持最近 20 個意圖
  }

  /**
   * 🆕 用戶習慣學習機制
   * @param {Object} context 會話上下文
   */
  static learnUserPatterns(context) {
    try {
      // 1. 學習默認學生偏好
      context.userPreferences.defaultStudent = this.learnDefaultStudent(context);
      
      // 2. 識別高頻課程模式
      context.userPreferences.dominantCourses = this.findDominantCourses(context);
      
      // 3. 學習時間使用模式
      context.userPreferences.timePreferences = this.learnTimePreferences(context);
      
      // 4. 計算模式置信度
      context.userPreferences.patternConfidence = this.calculatePatternConfidence(context);
      
      console.log(`🧠 [學習] 用戶模式更新完成 - 默認學生: ${context.userPreferences.defaultStudent?.name}, 置信度: ${context.userPreferences.patternConfidence}`);
      
    } catch (error) {
      console.warn(`⚠️ 用戶習慣學習失敗:`, error.message);
    }
  }

  /**
   * 學習默認學生
   * @param {Object} context 會話上下文
   * @returns {Object|null} 默認學生信息
   */
  static learnDefaultStudent(context) {
    const recentStudents = context.recentStudents || [];
    if (recentStudents.length === 0) return null;
    
    // 找出頻率最高的學生
    const topStudent = recentStudents.reduce((max, student) => 
      student.frequency > (max?.frequency || 0) ? student : max
    );
    
    // 檢查是否達到置信度閾值
    const totalMentions = recentStudents.reduce((sum, s) => sum + s.frequency, 0);
    const confidence = topStudent.frequency / totalMentions;
    
    if (confidence >= this.LEARNING_WEIGHTS.STUDENT_PREFERENCE_WEIGHT) {
      return {
        name: topStudent.name,
        confidence,
        lastUsed: topStudent.lastMentioned,
        totalMentions: topStudent.frequency
      };
    }
    
    return null;
  }

  /**
   * 找出主導課程
   * @param {Object} context 會話上下文
   * @returns {Array} 主導課程列表
   */
  static findDominantCourses(context) {
    const recentCourses = context.recentCourses || [];
    if (recentCourses.length === 0) return [];
    
    return recentCourses
      .filter(course => course.frequency >= this.LEARNING_WEIGHTS.FREQUENCY_THRESHOLD)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map(course => ({
        name: course.name,
        frequency: course.frequency,
        confidence: course.frequency / Math.max(...recentCourses.map(c => c.frequency)),
        student: course.student,
        teacher: course.teacher
      }));
  }

  /**
   * 學習時間偏好模式
   * @param {Object} context 會話上下文
   * @returns {Object} 時間偏好信息
   */
  static learnTimePreferences(context) {
    const timePatterns = context.userPreferences?.timePatterns || [];
    if (timePatterns.length < 3) return null;
    
    // 分析常用時間段
    const timeSlots = {};
    timePatterns.forEach(pattern => {
      if (pattern.time) {
        const hour = parseInt(pattern.time.split(':')[0]);
        const slot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        timeSlots[slot] = (timeSlots[slot] || 0) + 1;
      }
    });
    
    const preferredSlot = Object.entries(timeSlots)
      .sort(([,a], [,b]) => b - a)[0];
    
    return preferredSlot ? {
      preferredTimeSlot: preferredSlot[0],
      confidence: preferredSlot[1] / timePatterns.length,
      totalPatterns: timePatterns.length
    } : null;
  }

  /**
   * 計算整體模式置信度
   * @param {Object} context 會話上下文
   * @returns {number} 置信度 (0-1)
   */
  static calculatePatternConfidence(context) {
    let confidence = 0;
    let factors = 0;
    
    // 默認學生置信度
    if (context.userPreferences?.defaultStudent?.confidence) {
      confidence += context.userPreferences.defaultStudent.confidence;
      factors++;
    }
    
    // 主導課程置信度
    const dominantCourses = context.userPreferences?.dominantCourses || [];
    if (dominantCourses.length > 0) {
      const avgCourseConfidence = dominantCourses.reduce((sum, c) => sum + c.confidence, 0) / dominantCourses.length;
      confidence += avgCourseConfidence;
      factors++;
    }
    
    // 時間偏好置信度
    if (context.userPreferences?.timePreferences?.confidence) {
      confidence += context.userPreferences.timePreferences.confidence;
      factors++;
    }
    
    return factors > 0 ? confidence / factors : 0;
  }

  /**
   * 更新頻率統計
   * @param {Object} frequentCourses 現有頻率統計
   * @param {string} courseName 課程名稱
   * @returns {Object} 更新後的頻率統計
   */
  static updateFrequencyStats(frequentCourses, courseName) {
    const stats = { ...frequentCourses };
    stats[courseName] = (stats[courseName] || 0) + 1;
    return stats;
  }

  /**
   * 更新時間模式
   * @param {Array} timePatterns 時間模式
   * @param {Object} timeInfo 時間信息
   * @returns {Array} 更新後的時間模式
   */
  static updateTimePatterns(timePatterns, timeInfo) {
    const pattern = {
      time: timeInfo.display || timeInfo.schedule_time,
      date: timeInfo.date,
      timestamp: Date.now()
    };
    
    const updated = [pattern, ...timePatterns];
    return updated.slice(0, 50); // 保持最近 50 個時間模式
  }

  /**
   * 更新意圖模式統計
   * @param {Object} intentPatterns 意圖模式
   * @param {string} action 意圖
   * @returns {Object} 更新後的意圖模式
   */
  static updateIntentPatterns(intentPatterns, action) {
    const patterns = { ...intentPatterns };
    patterns[action] = (patterns[action] || 0) + 1;
    return patterns;
  }

  /**
   * 更新默認學生設定
   * @param {Object} defaultStudent 現有默認學生
   * @param {string} studentName 學生名稱
   * @returns {Object} 更新後的默認學生
   */
  static updateDefaultStudent(defaultStudent, studentName) {
    if (!defaultStudent || defaultStudent.name !== studentName) {
      return {
        name: studentName,
        count: 1,
        lastUsed: Date.now()
      };
    }
    
    return {
      ...defaultStudent,
      count: defaultStudent.count + 1,
      lastUsed: Date.now()
    };
  }

  /**
   * 🆕 智能預測下一步操作
   * @param {string} userId 用戶ID
   * @param {string} currentIntent 當前意圖
   * @returns {Object|null} 預測結果
   */
  static predictNextAction(userId, currentIntent) {
    const context = this.getContext(userId);
    if (!context || !context.sessionMetadata?.intentHistory) return null;
    
    const history = context.sessionMetadata.intentHistory;
    if (history.length < 2) return null;
    
    // 🔧 修復：反轉歷史順序，因為我們存儲的是最新的在前面
    const reversedHistory = [...history].reverse();
    
    // 尋找意圖序列模式
    const patterns = {};
    for (let i = 0; i < reversedHistory.length - 1; i++) {
      const current = reversedHistory[i].intent;
      const next = reversedHistory[i + 1].intent;
      const key = `${current}->${next}`;
      patterns[key] = (patterns[key] || 0) + 1;
    }
    
    console.log(`🔮 [預測] 分析模式 - 歷史長度: ${reversedHistory.length}, 找到模式: ${Object.keys(patterns).length}`);
    console.log(`🔮 [預測] 模式統計:`, patterns);
    
    // 找出最可能的下一步
    const currentPattern = `${currentIntent}->`;
    const possibleNext = Object.entries(patterns)
      .filter(([pattern]) => pattern.startsWith(currentPattern))
      .sort(([,a], [,b]) => b - a)[0];
    
    console.log(`🔮 [預測] 查找模式: ${currentPattern}, 找到: ${possibleNext ? possibleNext[0] : '無'}`);
    
    if (possibleNext && possibleNext[1] >= 2) {
      const nextIntent = possibleNext[0].split('->')[1];
      return {
        predictedIntent: nextIntent,
        confidence: possibleNext[1] / reversedHistory.length,
        basedOnPatterns: possibleNext[1]
      };
    }
    
    return null;
  }

  /**
   * 🆕 獲取增強的上下文統計
   * @returns {Object} 增強統計信息
   */
  static getEnhancedStats() {
    this.clearExpired();
    
    const basicStats = this.getStats();
    let totalTriggerIntents = 0;
    let totalLearningData = 0;
    let contextsWithLearning = 0;
    
    for (const context of this.contexts.values()) {
      if (this.EXPANDED_TRIGGER_INTENTS.includes(context.lastIntent)) {
        totalTriggerIntents++;
      }
      
      if (context.userPreferences && Object.keys(context.userPreferences).length > 0) {
        contextsWithLearning++;
        totalLearningData += Object.keys(context.userPreferences).length;
      }
    }
    
    return {
      ...basicStats,
      expandedTriggerIntents: this.EXPANDED_TRIGGER_INTENTS.length,
      contextsWithTriggerIntents: totalTriggerIntents,
      contextsWithLearning,
      averageLearningDataPerContext: contextsWithLearning > 0 ? totalLearningData / contextsWithLearning : 0
    };
  }
}

module.exports = EnhancedConversationContext;