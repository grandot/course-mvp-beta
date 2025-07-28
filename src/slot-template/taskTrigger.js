/**
 * TaskTrigger - 任務執行觸發器
 * 
 * 職責:
 * - 當 slot_state 達到完成條件時，自動觸發對應的業務邏輯執行
 * - 將 slot 格式轉換為 TaskService 期望的 entities 格式
 * - 處理任務執行結果和狀態管理
 * - 提供執行歷史記錄和錯誤處理
 */

const TaskService = require('../services/taskService');
const SlotStateManager = require('./slotStateManager');

class TaskTrigger {
  constructor() {
    this.taskService = new TaskService();
    this.slotStateManager = new SlotStateManager();
    
    // 執行統計
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      executionsByIntent: {}
    };
    
    // 執行歷史 (最多保留 100 條記錄)
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 執行完整的任務
   * @param {string} userId - 用戶ID
   * @param {Object} userState - 用戶完整狀態
   * @returns {Promise<Object>} 執行結果
   */
  async execute(userId, userState) {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();
    
    console.log(`[TaskTrigger] 開始執行任務 - 用戶: ${userId}, 執行ID: ${executionId}`);
    
    if (!userState.active_task) {
      throw new Error('沒有活躍的任務可以執行');
    }
    
    const { active_task } = userState;
    const { intent, slot_state } = active_task;
    
    try {
      // Step 1: 轉換為 TaskService 期望的格式
      console.log(`[TaskTrigger] 轉換 slot 格式為 entities 格式 - 意圖: ${intent}`);
      const entities = this.convertSlotsToEntities(slot_state);
      
      // Step 2: 執行任務
      console.log(`[TaskTrigger] 調用 TaskService.executeIntent`);
      const taskResult = await this.taskService.executeIntent(intent, entities, userId);
      
      // Step 3: 更新任務狀態
      const finalResult = await this.handleExecutionResult(
        userId, 
        active_task, 
        taskResult, 
        executionId,
        startTime
      );
      
      // Step 4: 記錄執行統計
      this.recordExecutionStats(intent, startTime, true);
      
      console.log(`[TaskTrigger] 任務執行完成 - 用戶: ${userId}, 成功: ${taskResult.success}`);
      
      return finalResult;
      
    } catch (error) {
      // 錯誤處理
      console.error(`[TaskTrigger] 任務執行失敗 - 用戶: ${userId}`, error);
      
      const errorResult = await this.handleExecutionError(
        userId, 
        active_task, 
        error, 
        executionId,
        startTime
      );
      
      // 記錄失敗統計
      this.recordExecutionStats(intent, startTime, false);
      
      return errorResult;
    }
  }

  /**
   * 轉換 slot 格式為 TaskService 期望的 entities 格式
   * @param {Object} slotState - slot 狀態對象
   * @returns {Object} entities 格式的對象
   */
  convertSlotsToEntities(slotState) {
    console.log(`[TaskTrigger] 轉換前的 slot_state:`, slotState);
    
    const entities = {};
    
    // 基本欄位映射
    if (slotState.course) entities.course_name = slotState.course;
    if (slotState.student) entities.student_name = slotState.student;
    if (slotState.teacher) entities.teacher = slotState.teacher;
    if (slotState.location) entities.location = slotState.location;
    
    // 時間信息處理
    if (slotState.date || slotState.time) {
      entities.timeInfo = {};
      
      if (slotState.date) entities.timeInfo.date = slotState.date;
      if (slotState.time) entities.timeInfo.time = slotState.time;
      
      // 創建 ISO 時間字符串 (TaskService 期望的格式)
      if (slotState.date && slotState.time) {
        entities.timeInfo.start = `${slotState.date}T${slotState.time}:00Z`;
        
        // 假設課程時長為1小時 (可以從模板配置中讀取)
        const endTime = this.calculateEndTime(slotState.time, 60);
        entities.timeInfo.end = `${slotState.date}T${endTime}:00Z`;
      }
      
      // 重複設定
      if (slotState.repeat) {
        entities.timeInfo.recurring = slotState.repeat;
      }
    }
    
    // 提醒設定
    if (slotState.reminder) {
      entities.reminder = slotState.reminder;
    }
    
    // 備註
    if (slotState.note) {
      entities.note = slotState.note;
    }
    
    // 確認信息 (用於特殊操作)
    if (slotState.confirmation) {
      entities.confirmation = slotState.confirmation;
    }
    
    console.log(`[TaskTrigger] 轉換後的 entities:`, entities);
    
    return entities;
  }

  /**
   * 計算結束時間
   * @param {string} startTime - 開始時間 (HH:mm 格式)
   * @param {number} durationMinutes - 持續時間(分鐘)
   * @returns {string} 結束時間 (HH:mm 格式)
   */
  calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * 處理任務執行成功的結果
   * @param {string} userId - 用戶ID
   * @param {Object} activeTask - 活躍任務
   * @param {Object} taskResult - TaskService 執行結果
   * @param {string} executionId - 執行ID
   * @param {number} startTime - 開始時間
   * @returns {Promise<Object>} 最終結果
   */
  async handleExecutionResult(userId, activeTask, taskResult, executionId, startTime) {
    const executionTime = Date.now() - startTime;
    
    if (taskResult.success) {
      // 任務執行成功 - 標記任務完成
      await this.markTaskCompleted(userId, activeTask, taskResult, executionId);
      
      const result = {
        success: true,
        type: 'task_execution_success',
        message: taskResult.message || '任務已成功完成',
        executionId,
        executionTime,
        taskResult,
        task_completed: true,
        active_task_cleared: true,
        timestamp: new Date().toISOString()
      };
      
      // 記錄執行歷史
      this.addExecutionHistory({
        executionId,
        userId,
        intent: activeTask.intent,
        status: 'completed',
        result,
        executionTime,
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } else {
      // TaskService 回報失敗，但沒有拋出異常
      const result = {
        success: false,
        type: 'task_execution_failed',
        message: taskResult.message || '任務執行失敗',
        executionId,
        executionTime,
        taskResult,
        task_completed: false,
        error: taskResult.error,
        timestamp: new Date().toISOString()
      };
      
      // 記錄執行歷史
      this.addExecutionHistory({
        executionId,
        userId,
        intent: activeTask.intent,
        status: 'failed',
        result,
        error: taskResult.error,
        executionTime,
        timestamp: new Date().toISOString()
      });
      
      return result;
    }
  }

  /**
   * 處理任務執行錯誤
   * @param {string} userId - 用戶ID
   * @param {Object} activeTask - 活躍任務
   * @param {Error} error - 錯誤對象
   * @param {string} executionId - 執行ID
   * @param {number} startTime - 開始時間
   * @returns {Promise<Object>} 錯誤結果
   */
  async handleExecutionError(userId, activeTask, error, executionId, startTime) {
    const executionTime = Date.now() - startTime;
    
    // 嘗試狀態回滾
    try {
      await this.rollbackTaskState(userId, activeTask, error);
    } catch (rollbackError) {
      console.error(`[TaskTrigger] 狀態回滾失敗:`, rollbackError);
    }
    
    const result = {
      success: false,
      type: 'task_execution_error',
      message: '任務執行過程中發生錯誤，請稍後再試',
      executionId,
      executionTime,
      error: error.message,
      errorType: this.categorizeError(error),
      task_completed: false,
      rollback_attempted: true,
      timestamp: new Date().toISOString()
    };
    
    // 記錄執行歷史
    this.addExecutionHistory({
      executionId,
      userId,
      intent: activeTask.intent,
      status: 'error',
      result,
      error: error.message,
      executionTime,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }

  /**
   * 標記任務為已完成
   * @param {string} userId - 用戶ID
   * @param {Object} activeTask - 活躍任務
   * @param {Object} taskResult - 任務結果
   * @param {string} executionId - 執行ID
   */
  async markTaskCompleted(userId, activeTask, taskResult, executionId) {
    try {
      // 獲取當前用戶狀態
      const currentState = await this.slotStateManager.getUserState(userId);
      
      // 清除活躍任務，保留執行記錄
      const updatedState = {
        ...currentState,
        active_task: null, // 清除活躍任務
        last_completed_task: {
          ...activeTask,
          status: 'completed',
          execution_id: executionId,
          completed_at: new Date().toISOString(),
          result: taskResult
        },
        updated_at: new Date().toISOString()
      };
      
      await this.slotStateManager.updateUserState(userId, updatedState);
      
      console.log(`[TaskTrigger] 任務已標記為完成 - 用戶: ${userId}, 執行ID: ${executionId}`);
      
    } catch (error) {
      console.error(`[TaskTrigger] 標記任務完成失敗:`, error);
      throw new Error(`無法更新任務狀態: ${error.message}`);
    }
  }

  /**
   * 回滾任務狀態
   * @param {string} userId - 用戶ID
   * @param {Object} activeTask - 活躍任務
   * @param {Error} error - 執行錯誤
   */
  async rollbackTaskState(userId, activeTask, error) {
    try {
      // 獲取當前用戶狀態
      const currentState = await this.slotStateManager.getUserState(userId);
      
      if (!currentState.active_task) {
        return; // 沒有活躍任務需要回滾
      }
      
      // 將任務狀態設為錯誤，但保留資料讓用戶可以修正後重試
      const updatedTask = {
        ...currentState.active_task,
        status: 'execution_failed',
        execution_error: {
          message: error.message,
          occurred_at: new Date().toISOString(),
          retry_count: (currentState.active_task.retry_count || 0) + 1
        },
        updated_at: new Date().toISOString()
      };
      
      const updatedState = {
        ...currentState,
        active_task: updatedTask,
        updated_at: new Date().toISOString()
      };
      
      await this.slotStateManager.updateUserState(userId, updatedState);
      
      console.log(`[TaskTrigger] 任務狀態已回滾 - 用戶: ${userId}`);
      
    } catch (rollbackError) {
      console.error(`[TaskTrigger] 狀態回滾過程中發生錯誤:`, rollbackError);
      throw rollbackError;
    }
  }

  /**
   * 生成執行ID
   * @returns {string} 執行ID
   */
  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * 分類錯誤類型
   * @param {Error} error - 錯誤對象
   * @returns {string} 錯誤類型
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('taskservice') || message.includes('任務服務')) {
      return 'taskservice_error';
    } else if (message.includes('entities') || message.includes('實體')) {
      return 'entities_conversion_error';
    } else if (message.includes('state') || message.includes('狀態')) {
      return 'state_management_error';
    } else if (message.includes('validation') || message.includes('驗證')) {
      return 'validation_error';
    } else if (message.includes('timeout') || message.includes('超時')) {
      return 'timeout_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * 記錄執行統計
   * @param {string} intent - 意圖
   * @param {number} startTime - 開始時間
   * @param {boolean} success - 是否成功
   */
  recordExecutionStats(intent, startTime, success) {
    const executionTime = Date.now() - startTime;
    
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalExecutions;
    
    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }
    
    // 按意圖統計
    if (!this.stats.executionsByIntent[intent]) {
      this.stats.executionsByIntent[intent] = {
        total: 0,
        successful: 0,
        failed: 0
      };
    }
    
    this.stats.executionsByIntent[intent].total++;
    if (success) {
      this.stats.executionsByIntent[intent].successful++;
    } else {
      this.stats.executionsByIntent[intent].failed++;
    }
  }

  /**
   * 添加執行歷史記錄
   * @param {Object} record - 執行記錄
   */
  addExecutionHistory(record) {
    this.executionHistory.unshift(record);
    
    // 限制歷史記錄大小
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * 獲取執行統計
   * @returns {Object} 統計資訊
   */
  getStats() {
    const successRate = this.stats.totalExecutions > 0 
      ? this.stats.successfulExecutions / this.stats.totalExecutions 
      : 0;
    
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 獲取執行歷史
   * @param {number} limit - 限制返回數量
   * @returns {Array} 執行歷史記錄
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * 清除執行歷史
   */
  clearExecutionHistory() {
    this.executionHistory = [];
    console.log('[TaskTrigger] 執行歷史已清除');
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      executionsByIntent: {}
    };
    
    console.log('[TaskTrigger] 統計資訊已重置');
  }

  /**
   * 健康檢查
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      taskService: null,
      slotStateManager: null,
      timestamp: new Date().toISOString()
    };
    
    try {
      // 檢查 TaskService
      if (this.taskService && this.taskService.isInitialized()) {
        health.taskService = {
          status: 'healthy',
          scenario: this.taskService.getScenarioInfo()
        };
      } else {
        health.taskService = {
          status: 'unhealthy',
          error: 'TaskService not properly initialized'
        };
        health.status = 'degraded';
      }
      
      // 檢查 SlotStateManager (簡單檢查)
      health.slotStateManager = {
        status: 'healthy',
        cacheStats: this.slotStateManager.getCacheStats()
      };
      
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }
    
    return health;
  }
}

module.exports = TaskTrigger;