/**
 * TaskTrigger 整合測試
 * 測試已完成的任務執行功能
 */

const TaskTrigger = require('../../src/slot-template/taskTrigger');

// Mock dependencies
jest.mock('../../src/services/taskService');
jest.mock('../../src/slot-template/slotStateManager');

const TaskService = require('../../src/services/taskService');
const SlotStateManager = require('../../src/slot-template/slotStateManager');

describe('TaskTrigger 已完成功能測試', () => {
  let taskTrigger;
  let mockTaskService;
  let mockSlotStateManager;

  beforeEach(() => {
    // 清除所有 mock
    jest.clearAllMocks();
    
    // 設置 TaskService mock
    mockTaskService = {
      executeIntent: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      getScenarioInfo: jest.fn().mockReturnValue({ scenario: 'course_management' })
    };
    TaskService.mockImplementation(() => mockTaskService);
    
    // 設置 SlotStateManager mock
    mockSlotStateManager = {
      getUserState: jest.fn(),
      updateUserState: jest.fn(),
      getCacheStats: jest.fn().mockReturnValue({ hitRate: 0.85, size: 10 })
    };
    SlotStateManager.mockImplementation(() => mockSlotStateManager);
    
    taskTrigger = new TaskTrigger();
  });

  describe('1. 基本初始化測試', () => {
    test('應該正確初始化 TaskTrigger', () => {
      expect(taskTrigger.taskService).toBeDefined();
      expect(taskTrigger.slotStateManager).toBeDefined();
      expect(taskTrigger.stats).toBeDefined();
      expect(taskTrigger.executionHistory).toEqual([]);
      expect(taskTrigger.maxHistorySize).toBe(100);
    });

    test('統計資訊應該初始化為零值', () => {
      const stats = taskTrigger.getStats();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
    });
  });

  describe('2. convertSlotsToEntities 格式轉換測試', () => {
    test('應該正確轉換基本 slot 資料為 entities 格式', () => {
      const slotState = {
        student: '小明',
        course: '鋼琴課',
        date: '2025-08-01',
        time: '14:00',
        teacher: '王老師',
        location: '音樂教室',
        note: '記得帶譜'
      };

      const entities = taskTrigger.convertSlotsToEntities(slotState);

      expect(entities.student_name).toBe('小明');
      expect(entities.course_name).toBe('鋼琴課');
      expect(entities.teacher).toBe('王老師');
      expect(entities.location).toBe('音樂教室');
      expect(entities.note).toBe('記得帶譜');
      expect(entities.timeInfo.date).toBe('2025-08-01');
      expect(entities.timeInfo.time).toBe('14:00');
      expect(entities.timeInfo.start).toBe('2025-08-01T14:00:00Z');
      expect(entities.timeInfo.end).toBe('2025-08-01T15:00:00Z');
    });

    test('應該正確處理重複課程設定', () => {
      const slotState = {
        student: '小華',
        course: '數學課',
        date: '2025-08-01',
        time: '10:00',
        repeat: {
          pattern: 'weekly',
          frequency: 1,
          end_condition: { type: 'date', value: '2025-12-31' }
        }
      };

      const entities = taskTrigger.convertSlotsToEntities(slotState);

      expect(entities.timeInfo.recurring).toEqual({
        pattern: 'weekly',
        frequency: 1,
        end_condition: { type: 'date', value: '2025-12-31' }
      });
    });

    test('應該正確處理提醒設定', () => {
      const slotState = {
        student: '小李',
        course: '英文課',
        date: '2025-08-01',
        time: '16:00',
        reminder: {
          minutes_before: 30,
          enabled: true,
          custom_message: '準備上課囉！'
        }
      };

      const entities = taskTrigger.convertSlotsToEntities(slotState);

      expect(entities.reminder).toEqual({
        minutes_before: 30,
        enabled: true,
        custom_message: '準備上課囉！'
      });
    });
  });

  describe('3. calculateEndTime 時間計算測試', () => {
    test('應該正確計算課程結束時間', () => {
      expect(taskTrigger.calculateEndTime('14:00', 60)).toBe('15:00');
      expect(taskTrigger.calculateEndTime('09:30', 90)).toBe('11:00');
      expect(taskTrigger.calculateEndTime('22:30', 60)).toBe('23:30');
    });

    test('應該處理跨日的時間計算', () => {
      expect(taskTrigger.calculateEndTime('23:30', 60)).toBe('00:30');
    });
  });

  describe('4. execute 主要執行流程測試', () => {
    const mockUserState = {
      user_id: 'test_user_123',
      active_task: {
        task_id: 'task_001',
        intent: 'record_course',
        template_id: 'course_management',
        status: 'complete',
        slot_state: {
          student: '測試學生',
          course: '測試課程',
          date: '2025-08-01',
          time: '14:00',
          teacher: '測試老師',
          location: '測試教室'
        },
        completion_score: 1.0
      }
    };

    test('應該成功執行完整任務流程', async () => {
      // 設置 mock 回應
      mockTaskService.executeIntent.mockResolvedValue({
        success: true,
        message: '課程已成功記錄',
        data: { courseId: 'course_123' }
      });

      mockSlotStateManager.getUserState.mockResolvedValue({
        ...mockUserState,
        updated_at: new Date().toISOString()
      });

      mockSlotStateManager.updateUserState.mockResolvedValue(true);

      const result = await taskTrigger.execute('test_user_123', mockUserState);

      // 驗證結果
      expect(result.success).toBe(true);
      expect(result.type).toBe('task_execution_success');
      expect(result.task_completed).toBe(true);
      expect(result.active_task_cleared).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);

      // 驗證 TaskService 被正確調用
      expect(mockTaskService.executeIntent).toHaveBeenCalledWith(
        'record_course',
        expect.objectContaining({
          student_name: '測試學生',
          course_name: '測試課程',
          teacher: '測試老師',
          location: '測試教室'
        }),
        'test_user_123'
      );

      // 驗證狀態被更新
      expect(mockSlotStateManager.updateUserState).toHaveBeenCalledWith(
        'test_user_123',
        expect.objectContaining({
          active_task: null,
          last_completed_task: expect.objectContaining({
            status: 'completed',
            execution_id: expect.any(String)
          })
        })
      );
    });

    test('應該處理 TaskService 執行失敗', async () => {
      mockTaskService.executeIntent.mockResolvedValue({
        success: false,
        message: '課程衝突，無法安排',
        error: 'time_conflict'
      });

      const result = await taskTrigger.execute('test_user_123', mockUserState);

      expect(result.success).toBe(false);
      expect(result.type).toBe('task_execution_failed');
      expect(result.task_completed).toBe(false);
      expect(result.taskResult.error).toBe('time_conflict');
    });

    test('應該處理執行異常並進行狀態回滾', async () => {
      mockTaskService.executeIntent.mockRejectedValue(
        new Error('TaskService 連接失敗')
      );

      mockSlotStateManager.getUserState.mockResolvedValue(mockUserState);
      mockSlotStateManager.updateUserState.mockResolvedValue(true);

      const result = await taskTrigger.execute('test_user_123', mockUserState);

      expect(result.success).toBe(false);
      expect(result.type).toBe('task_execution_error');
      expect(result.errorType).toBe('taskservice_error');
      expect(result.rollback_attempted).toBe(true);

      // 驗證狀態回滾被調用
      expect(mockSlotStateManager.updateUserState).toHaveBeenCalledWith(
        'test_user_123',
        expect.objectContaining({
          active_task: expect.objectContaining({
            status: 'execution_failed',
            execution_error: expect.objectContaining({
              message: 'TaskService 連接失敗',
              retry_count: 1
            })
          })
        })
      );
    });

    test('應該拒絕沒有活躍任務的執行請求', async () => {
      const stateWithoutTask = {
        user_id: 'test_user_123',
        active_task: null
      };

      await expect(
        taskTrigger.execute('test_user_123', stateWithoutTask)
      ).rejects.toThrow('沒有活躍的任務可以執行');
    });
  });

  describe('5. 統計和歷史記錄測試', () => {
    test('應該正確記錄成功執行的統計', async () => {
      mockTaskService.executeIntent.mockResolvedValue({
        success: true,
        message: '執行成功'
      });

      mockSlotStateManager.getUserState.mockResolvedValue({
        user_id: 'test_user',
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      mockSlotStateManager.updateUserState.mockResolvedValue(true);

      await taskTrigger.execute('test_user', {
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      const stats = taskTrigger.getStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.executionsByIntent.record_course.total).toBe(1);
      expect(stats.executionsByIntent.record_course.successful).toBe(1);
    });

    test('應該正確記錄失敗執行的統計', async () => {
      mockTaskService.executeIntent.mockRejectedValue(
        new Error('執行失敗')
      );

      mockSlotStateManager.getUserState.mockResolvedValue({
        user_id: 'test_user',
        active_task: {
          intent: 'cancel_course',
          slot_state: { student: '測試' }
        }
      });

      mockSlotStateManager.updateUserState.mockResolvedValue(true);

      await taskTrigger.execute('test_user', {
        active_task: {
          intent: 'cancel_course',
          slot_state: { student: '測試' }
        }
      });

      const stats = taskTrigger.getStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successRate).toBe(0);
      expect(stats.executionsByIntent.cancel_course.failed).toBe(1);
    });

    test('應該維護執行歷史記錄', async () => {
      mockTaskService.executeIntent.mockResolvedValue({
        success: true,
        message: '執行成功'
      });

      mockSlotStateManager.getUserState.mockResolvedValue({
        user_id: 'test_user',
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      mockSlotStateManager.updateUserState.mockResolvedValue(true);

      await taskTrigger.execute('test_user', {
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      const history = taskTrigger.getExecutionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].userId).toBe('test_user');
      expect(history[0].intent).toBe('record_course');
      expect(history[0].status).toBe('completed');
      expect(history[0].executionId).toBeDefined();
    });
  });

  describe('6. 錯誤分類測試', () => {
    test('應該正確分類不同類型的錯誤', () => {
      expect(taskTrigger.categorizeError(new Error('TaskService 連接失敗')))
        .toBe('taskservice_error');
      
      expect(taskTrigger.categorizeError(new Error('entities 轉換錯誤')))
        .toBe('entities_conversion_error');
      
      expect(taskTrigger.categorizeError(new Error('狀態管理失敗')))
        .toBe('state_management_error');
      
      expect(taskTrigger.categorizeError(new Error('驗證失敗')))
        .toBe('validation_error');
      
      expect(taskTrigger.categorizeError(new Error('請求超時')))
        .toBe('timeout_error');
      
      expect(taskTrigger.categorizeError(new Error('未知錯誤')))
        .toBe('unknown_error');
    });
  });

  describe('7. 健康檢查測試', () => {
    test('應該回報健康狀態', async () => {
      const health = await taskTrigger.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.taskService.status).toBe('healthy');
      expect(health.taskService.scenario).toEqual({ scenario: 'course_management' });
      expect(health.slotStateManager.status).toBe('healthy');
      expect(health.slotStateManager.cacheStats).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    test('應該檢測到 TaskService 未初始化的問題', async () => {
      mockTaskService.isInitialized.mockReturnValue(false);

      const health = await taskTrigger.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.taskService.status).toBe('unhealthy');
      expect(health.taskService.error).toBe('TaskService not properly initialized');
    });
  });

  describe('8. 工具方法測試', () => {
    test('應該生成唯一的執行ID', () => {
      const id1 = taskTrigger.generateExecutionId();
      const id2 = taskTrigger.generateExecutionId();

      expect(id1).toMatch(/^exec_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^exec_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('應該能重置統計資訊', () => {
      // 先添加一些統計
      taskTrigger.stats.totalExecutions = 5;
      taskTrigger.stats.successfulExecutions = 3;

      taskTrigger.resetStats();

      const stats = taskTrigger.getStats();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
    });

    test('應該能清除執行歷史', () => {
      // 添加一些執行歷史
      taskTrigger.addExecutionHistory({
        executionId: 'test_exec_1',
        userId: 'user1',
        intent: 'test_intent',
        status: 'completed'
      });

      expect(taskTrigger.getExecutionHistory()).toHaveLength(1);

      taskTrigger.clearExecutionHistory();

      expect(taskTrigger.getExecutionHistory()).toHaveLength(0);
    });

    test('應該限制執行歷史記錄大小', () => {
      // 添加超過最大限制的記錄
      for (let i = 0; i < 105; i++) {
        taskTrigger.addExecutionHistory({
          executionId: `exec_${i}`,
          userId: 'test_user',
          intent: 'test_intent',
          status: 'completed'
        });
      }

      expect(taskTrigger.executionHistory.length).toBe(100);
      expect(taskTrigger.getExecutionHistory(200).length).toBe(100);
    });
  });

  describe('9. 邊界條件測試', () => {
    test('應該處理空的 slot_state', () => {
      const entities = taskTrigger.convertSlotsToEntities({});
      expect(Object.keys(entities)).toHaveLength(0);
    });

    test('應該處理只有部分時間資訊的情況', () => {
      const entities1 = taskTrigger.convertSlotsToEntities({
        date: '2025-08-01'
      });
      expect(entities1.timeInfo.date).toBe('2025-08-01');
      expect(entities1.timeInfo.start).toBeUndefined();

      const entities2 = taskTrigger.convertSlotsToEntities({
        time: '14:00'
      });
      expect(entities2.timeInfo.time).toBe('14:00');
      expect(entities2.timeInfo.start).toBeUndefined();
    });

    test('應該處理狀態更新失敗的情況', async () => {
      mockTaskService.executeIntent.mockResolvedValue({
        success: true,
        message: '執行成功'
      });

      mockSlotStateManager.getUserState.mockResolvedValue({
        user_id: 'test_user',
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      // 第一次調用失敗 (在 markTaskCompleted 中)
      // 第二次調用也失敗 (在 rollbackTaskState 中)
      mockSlotStateManager.updateUserState.mockRejectedValue(
        new Error('資料庫連接失敗')
      );

      // TaskTrigger.execute 實際上會捕獲異常並返回錯誤結果，而不是拋出異常
      const result = await taskTrigger.execute('test_user', {
        active_task: {
          intent: 'record_course',
          slot_state: { student: '測試' }
        }
      });

      // 驗證返回的錯誤結果
      expect(result.success).toBe(false);
      expect(result.type).toBe('task_execution_error');
      expect(result.error).toBe('無法更新任務狀態: 資料庫連接失敗');
      expect(result.rollback_attempted).toBe(true);
    });
  });
});