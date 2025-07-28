/**
 * Slot Merger
 * 負責合併新舊 slot 狀態，處理衝突和意圖變更
 * 
 * 功能:
 * - 基礎 slot 值合併邏輯
 * - 衝突檢測和處理
 * - 意圖變更處理
 * - 對話歷史追蹤
 */

const { v4: uuidv4 } = require('uuid');

class SlotMerger {
  constructor() {
    this.conflictStrategies = {
      OVERWRITE: 'overwrite',      // 新值覆蓋舊值
      CONFIRM: 'confirm',          // 要求用戶確認
      MERGE: 'merge',              // 嘗試合併（用於陣列或物件）
      KEEP_EXISTING: 'keep_existing' // 保留現有值
    };
    
    this.defaultStrategy = this.conflictStrategies.OVERWRITE;
    
    // 統計資訊
    this.stats = {
      mergeOperations: 0,
      conflictDetections: 0,
      intentChanges: 0,
      newTaskCreations: 0
    };
  }

  /**
   * 合併新舊 slot 狀態
   * @param {Object} currentState - 當前用戶狀態
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Promise<Object>} 合併後的狀態
   */
  async merge(currentState, semanticResult) {
    this.stats.mergeOperations++;
    
    try {
      const { intent, slot_state: newSlots, extraction_details } = semanticResult;
      
      console.log(`[SlotMerger] 開始合併 - 意圖: ${intent}, 新 slots: ${Object.keys(newSlots).length} 個`);

      // 1. 檢查是否為新任務
      if (!currentState.active_task || this.isNewTask(currentState, intent)) {
        return this.createNewTask(currentState, semanticResult);
      }

      // 2. 檢查意圖是否匹配
      if (currentState.active_task.intent !== intent) {
        return this.handleIntentChange(currentState, semanticResult);
      }

      // 3. 合併 slot 值
      const mergeResult = await this.mergeSlots(
        currentState.active_task.slot_state,
        newSlots,
        extraction_details
      );

      // 4. 更新任務狀態
      const updatedTask = {
        ...currentState.active_task,
        slot_state: mergeResult.mergedSlots,
        updated_at: new Date().toISOString(),
        history: [
          ...currentState.active_task.history,
          {
            timestamp: new Date().toISOString(),
            user_input: extraction_details?.raw_text || '',
            extracted_slots: newSlots,
            conflicts: mergeResult.conflicts,
            merge_strategy: mergeResult.strategy
          }
        ]
      };

      const updatedState = {
        ...currentState,
        active_task: updatedTask,
        updated_at: new Date().toISOString()
      };

      console.log(`[SlotMerger] 合併完成 - 衝突: ${mergeResult.conflicts.length} 個`);
      
      return updatedState;

    } catch (error) {
      console.error('[SlotMerger] 合併過程發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 檢查是否為新任務
   * @param {Object} currentState - 當前狀態
   * @param {string} intent - 新意圖
   * @returns {boolean} 是否為新任務
   */
  isNewTask(currentState, intent) {
    if (!currentState.active_task) {
      return true;
    }

    // 檢查任務是否已完成
    if (currentState.active_task.status === 'complete') {
      return true;
    }

    // 檢查任務是否已過期 (超過設定時間無更新)
    if (this.isTaskExpired(currentState.active_task)) {
      return true;
    }

    return false;
  }

  /**
   * 檢查任務是否過期
   * @param {Object} activeTask - 活動任務
   * @returns {boolean} 是否過期
   */
  isTaskExpired(activeTask) {
    if (!activeTask.updated_at) {
      return true;
    }

    const lastUpdate = new Date(activeTask.updated_at).getTime();
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30分鐘

    return (now - lastUpdate) > timeout;
  }

  /**
   * 創建新任務
   * @param {Object} currentState - 當前狀態
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Object} 新的狀態
   */
  createNewTask(currentState, semanticResult) {
    this.stats.newTaskCreations++;
    
    const { intent, slot_state: newSlots, extraction_details } = semanticResult;
    const taskId = `task_${Date.now()}_${uuidv4().substr(0, 8)}`;
    
    console.log(`[SlotMerger] 創建新任務 - 任務ID: ${taskId}, 意圖: ${intent}`);

    const newTask = {
      task_id: taskId,
      intent: intent,
      template_id: this.getTemplateIdForIntent(intent),
      status: 'incomplete',
      slot_state: { ...newSlots },
      completion_score: 0,
      missing_slots: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      history: [
        {
          timestamp: new Date().toISOString(),
          user_input: extraction_details?.raw_text || '',
          extracted_slots: newSlots,
          conflicts: [],
          merge_strategy: 'new_task'
        }
      ]
    };

    return {
      ...currentState,
      active_task: newTask,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * 處理意圖變更
   * @param {Object} currentState - 當前狀態
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Object} 新的狀態
   */
  handleIntentChange(currentState, semanticResult) {
    this.stats.intentChanges++;
    
    const { intent } = semanticResult;
    
    console.log(`[SlotMerger] 處理意圖變更 - 從 ${currentState.active_task.intent} 到 ${intent}`);

    // 對於意圖變更，創建新任務
    // 在實際應用中，可能需要更複雜的邏輯來決定是否保留某些 slot 值
    return this.createNewTask(currentState, semanticResult);
  }

  /**
   * 合併具體的 slot 值
   * @param {Object} currentSlots - 當前 slot 狀態
   * @param {Object} newSlots - 新提取的 slots
   * @param {Object} extractionDetails - 提取詳情
   * @returns {Object} 合併結果
   */
  async mergeSlots(currentSlots, newSlots, extractionDetails) {
    const mergedSlots = { ...currentSlots };
    const conflicts = [];
    const strategy = this.defaultStrategy;

    for (const [slotName, newValue] of Object.entries(newSlots)) {
      if (newValue === null || newValue === undefined) {
        continue; // 跳過空值
      }

      const currentValue = currentSlots[slotName];
      const mergeResult = this.mergeSingleSlot(
        slotName, 
        currentValue, 
        newValue, 
        extractionDetails
      );

      mergedSlots[slotName] = mergeResult.value;

      if (mergeResult.conflict) {
        conflicts.push(mergeResult.conflict);
        this.stats.conflictDetections++;
      }
    }

    return {
      mergedSlots,
      conflicts,
      strategy
    };
  }

  /**
   * 合併單個 slot 值
   * @param {string} slotName - Slot 名稱
   * @param {*} currentValue - 當前值
   * @param {*} newValue - 新值
   * @param {Object} extractionDetails - 提取詳情
   * @returns {Object} 合併結果
   */
  mergeSingleSlot(slotName, currentValue, newValue, extractionDetails) {
    // 如果當前值為空，直接使用新值
    if (currentValue === null || currentValue === undefined || currentValue === '') {
      return {
        value: newValue,
        conflict: null
      };
    }

    // 如果值相同，無需處理
    if (this.isValueEqual(currentValue, newValue)) {
      return {
        value: currentValue,
        conflict: null
      };
    }

    // 發生衝突
    const conflict = {
      slot: slotName,
      current_value: currentValue,
      new_value: newValue,
      confidence: extractionDetails?.processed_entities?.[slotName]?.confidence || 0,
      timestamp: new Date().toISOString(),
      resolution_strategy: this.defaultStrategy
    };

    // 根據策略處理衝突
    const resolvedValue = this.resolveConflict(conflict);

    return {
      value: resolvedValue,
      conflict: conflict
    };
  }

  /**
   * 比較兩個值是否相等
   * @param {*} value1 - 值1
   * @param {*} value2 - 值2
   * @returns {boolean} 是否相等
   */
  isValueEqual(value1, value2) {
    // 處理不同類型的比較
    if (typeof value1 !== typeof value2) {
      return false;
    }

    if (typeof value1 === 'object') {
      return JSON.stringify(value1) === JSON.stringify(value2);
    }

    // 對於字串，可能需要標準化比較
    if (typeof value1 === 'string') {
      return value1.trim().toLowerCase() === value2.trim().toLowerCase();
    }

    return value1 === value2;
  }

  /**
   * 解決衝突
   * @param {Object} conflict - 衝突物件
   * @returns {*} 解決後的值
   */
  resolveConflict(conflict) {
    switch (conflict.resolution_strategy) {
      case this.conflictStrategies.OVERWRITE:
        console.log(`[SlotMerger] 衝突解決 - ${conflict.slot}: 使用新值 ${conflict.new_value}`);
        return conflict.new_value;
      
      case this.conflictStrategies.KEEP_EXISTING:
        console.log(`[SlotMerger] 衝突解決 - ${conflict.slot}: 保留現有值 ${conflict.current_value}`);
        return conflict.current_value;
      
      case this.conflictStrategies.MERGE:
        // 對於陣列或物件類型的合併
        if (Array.isArray(conflict.current_value) && Array.isArray(conflict.new_value)) {
          const merged = [...new Set([...conflict.current_value, ...conflict.new_value])];
          console.log(`[SlotMerger] 衝突解決 - ${conflict.slot}: 合併陣列`);
          return merged;
        }
        // 如果無法合併，使用新值
        return conflict.new_value;
      
      case this.conflictStrategies.CONFIRM:
        // 在實際應用中，這裡需要實作用戶確認邏輯
        // 現在暫時使用新值
        console.log(`[SlotMerger] 衝突解決 - ${conflict.slot}: 需要用戶確認，暫用新值`);
        return conflict.new_value;
      
      default:
        return conflict.new_value;
    }
  }

  /**
   * 根據意圖獲取模板ID
   * @param {string} intent - 意圖
   * @returns {string} 模板ID
   */
  getTemplateIdForIntent(intent) {
    // 簡化的映射邏輯，實際應用中可能需要從配置讀取
    const intentToTemplate = {
      'record_course': 'course_management',
      'modify_course': 'course_management',
      'query_course': 'course_management',
      'cancel_course': 'course_management'
    };

    return intentToTemplate[intent] || 'course_management';
  }

  /**
   * 設定衝突解決策略
   * @param {string} strategy - 策略名稱
   */
  setConflictStrategy(strategy) {
    if (Object.values(this.conflictStrategies).includes(strategy)) {
      this.defaultStrategy = strategy;
      console.log(`[SlotMerger] 衝突策略更新為: ${strategy}`);
    } else {
      throw new Error(`不支援的衝突策略: ${strategy}`);
    }
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      conflictRate: this.stats.mergeOperations > 0 
        ? this.stats.conflictDetections / this.stats.mergeOperations 
        : 0
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      mergeOperations: 0,
      conflictDetections: 0,
      intentChanges: 0,
      newTaskCreations: 0
    };
    console.log('[SlotMerger] 統計資訊已重置');
  }

  /**
   * 清理過期的衝突記錄
   * @param {Object} userState - 用戶狀態
   * @param {number} maxAgeHours - 最大保留時間（小時）
   * @returns {Object} 清理後的狀態
   */
  cleanupExpiredConflicts(userState, maxAgeHours = 24) {
    if (!userState.active_task || !userState.active_task.history) {
      return userState;
    }

    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    const cleanedHistory = userState.active_task.history.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime > cutoffTime;
    });

    if (cleanedHistory.length !== userState.active_task.history.length) {
      const removedCount = userState.active_task.history.length - cleanedHistory.length;
      console.log(`[SlotMerger] 清理了 ${removedCount} 個過期的歷史記錄`);
      
      return {
        ...userState,
        active_task: {
          ...userState.active_task,
          history: cleanedHistory
        },
        updated_at: new Date().toISOString()
      };
    }

    return userState;
  }
}

module.exports = SlotMerger;