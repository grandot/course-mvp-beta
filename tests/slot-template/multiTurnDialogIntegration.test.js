/**
 * Multi-Turn Dialog Enhancement 端到端整合測試
 * 驗證完整的多輪對話增強功能
 */

const SlotTemplateManager = require('../../src/slot-template/slotTemplateManager');
const SlotProblemDetector = require('../../src/slot-template/slotProblemDetector');
const TempSlotStateManager = require('../../src/slot-template/tempSlotStateManager');
const HumanPromptGenerator = require('../../src/slot-template/humanPromptGenerator');
const ScenarioManager = require('../../src/scenario/ScenarioManager');

// Mock 依賴
jest.mock('../../src/slot-template/templateLoader', () => ({
  getTemplateLoader: () => ({
    getTemplate: jest.fn().mockResolvedValue({
      template_id: 'course_management',
      completion_rules: {
        minimum_required: ['course', 'date', 'time'],
        validation_rules: {
          date: {
            invalid_patterns: ['後台', '前台']
          },
          time: {
            vague_patterns: ['下午', '晚上'],
            require_specific: true
          },
          course: {
            mixed_extraction_patterns: {
              date_time_mixed: '.*[明後今昨]天.*[下晚早中]午.*課$'
            }
          }
        }
      }
    })
  })
}));

jest.mock('../../src/slot-template/slotStateManager', () => {
  return class MockSlotStateManager {
    async getUserState() { return {}; }
    async updateUserState() { return {}; }
  };
});

jest.mock('../../src/slot-template/slotMerger', () => {
  return class MockSlotMerger {
    async merge(currentState, newState) {
      return { ...currentState, ...newState };
    }
  };
});

jest.mock('../../src/slot-template/slotValidator', () => {
  return class MockSlotValidator {
    async validate() {
      return { isComplete: true, isValid: true };
    }
  };
});

jest.mock('../../src/slot-template/taskTrigger', () => {
  return class MockTaskTrigger {
    async execute() {
      return { success: true };
    }
  };
});

describe('Multi-Turn Dialog Enhancement Integration', () => {
  let manager;
  const userId = 'test_user_123';

  beforeAll(async () => {
    // 🎯 初始化 ScenarioManager 以支持 TaskService
    await ScenarioManager.initialize();
  });

  afterAll(async () => {
    // 🎯 清理 ScenarioManager 緩存
    ScenarioManager.clearCache();
  });

  beforeEach(() => {
    manager = new SlotTemplateManager();
  });

  afterEach(() => {
    // 清理暫存狀態
    manager.tempStateManager.clearAllStates();
  });

  describe('任務 6.1.1: 多問題處理端到端測試', () => {
    test('多問題處理 - 不記錄要求重新輸入', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '小美大提琴課',
          date: '後台',    // 無效日期
          time: '下午'     // 模糊時間
        },
        success: true,
        text: '後台下午小美大提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('multi_problem');
      expect(result.recorded).toBe(false);
      expect(result.requiresExecution).toBe(false);
      expect(result.message).toContain('我需要一些更清楚的資訊才能幫您安排課程');
      expect(result.problemCount).toBeGreaterThan(1);
    });
  });

  describe('任務 6.1.2: 單一問題暫存測試', () => {
    test('單一問題處理 - 暫存並詢問', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '大提琴課',
          student: '小美',
          date: '明天'
          // 缺少 time
        },
        success: true,
        text: '明天小美大提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('single_problem');
      expect(result.tempState).toBeDefined();
      expect(result.requiresExecution).toBe(false);
      expect(result.message).toContain('已記錄');
      expect(result.message).toContain('還需要確認');
      expect(result.tempState.validSlots.course).toBe('大提琴課');
      expect(result.tempState.validSlots.student).toBe('小美');
      expect(result.tempState.validSlots.date).toBe('明天');
    });
  });

  describe('任務 6.1.3: 補充信息合併測試', () => {
    test('補充信息處理 - 合併並完成', async () => {
      // 第一步：創建暫存狀態
      const firstInput = {
        intent: 'record_course',
        entities: {
          course: '大提琴課',
          student: '小美',
          date: '明天'
        },
        success: true,
        text: '明天小美大提琴課'
      };

      const firstResult = await manager.processWithProblemDetection(userId, firstInput);
      expect(firstResult.type).toBe('single_problem');

      // 第二步：補充時間信息
      const supplementInput = {
        intent: 'record_course',
        entities: {
          time: '15:00'
        },
        success: true,
        text: '下午3點'
      };

      const finalResult = await manager.processWithProblemDetection(userId, supplementInput);

      expect(finalResult.type).toBe('task_completed');
      expect(finalResult.requiresExecution).toBe(true);
      expect(finalResult.tempStateCleared).toBe(true);
      expect(finalResult.slot_state.course).toBe('大提琴課');
      expect(finalResult.slot_state.student).toBe('小美');
      expect(finalResult.slot_state.date).toBe('明天');
      expect(finalResult.slot_state.time).toBe('15:00');
    });
  });

  describe('任務 6.1.4: 混雜提取檢測與自動分離測試', () => {
    test('混雜提取問題檢測與自動分離', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '明天下午大提琴課' // 混雜提取
        },
        success: true,
        text: '明天下午大提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      // 系統應該自動分離並重新處理
      // 由於缺少具體時間，應該產生單一問題提示
      expect(result.type).toBe('single_problem');
      expect(result.tempState).toBeDefined();
      expect(result.tempState.validSlots.course).toBe('大提琴課'); // 分離後的純課程名
      expect(result.tempState.validSlots.date).toBe('明天');        // 分離出的日期
      expect(result.tempState.validSlots.time).toBe('下午');        // 分離出的模糊時間
    });
  });

  describe('任務 6.1.5: 時間混雜提取檢測測試', () => {
    test('時間混雜提取檢測', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '下午小提琴課', // 時間混雜
          date: '明天'
        },
        success: true,
        text: '明天下午小提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('single_problem'); // 模糊時間需要確認
      expect(result.tempState.validSlots.course).toBe('小提琴課'); // 分離出純課程名
      expect(result.tempState.validSlots.time).toBe('下午');        // 保留模糊時間待確認
      expect(result.tempState.validSlots.date).toBe('明天');
      expect(result.message).toContain('還需要確認');
    });
  });

  describe('任務 6.1.6: 複雜混雜提取多重分離測試', () => {
    test('複雜混雜提取 - 多重分離', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '明天下午小美鋼琴課' // 包含日期、時間、學生、課程
        },
        success: true,
        text: '明天下午小美鋼琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('single_problem'); // 時間模糊需要確認
      expect(result.tempState.validSlots.course).toBe('鋼琴課');  // 純課程名
      expect(result.tempState.validSlots.student).toBe('小美');   // 分離出的學生
      expect(result.tempState.validSlots.date).toBe('明天');      // 分離出的日期
      expect(result.tempState.validSlots.time).toBe('下午');      // 模糊時間待確認
      expect(result.message).toContain('還需要確認上課時間');
    });
  });

  describe('完整信息處理測試', () => {
    test('完整信息應該直接完成任務', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '大提琴課',
          student: '小美',
          date: '明天',
          time: '15:00'
        },
        success: true,
        text: '明天下午3點小美大提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('task_completed');
      expect(result.requiresExecution).toBe(true);
      expect(result.slot_state).toEqual({
        course: '大提琴課',
        student: '小美',
        date: '明天',
        time: '15:00'
      });
    });
  });

  describe('錯誤處理和降級測試', () => {
    test('處理失敗時應該降級到原始邏輯', async () => {
      // 模擬處理失敗
      const originalProcessSemanticResult = manager.processSemanticResult;
      manager.tempStateManager.detectSupplementIntent = jest.fn().mockRejectedValue(new Error('Test error'));
      manager.processSemanticResult = jest.fn().mockResolvedValue({
        type: 'fallback_result',
        slot_state: { course: '大提琴課' }
      });

      const semanticResult = {
        intent: 'record_course',
        entities: { course: '大提琴課' },
        success: true,
        text: '大提琴課'
      };

      const result = await manager.processWithProblemDetection(userId, semanticResult);

      expect(result.type).toBe('fallback_result');
      expect(manager.processSemanticResult).toHaveBeenCalled();

      // 恢復原始方法
      manager.processSemanticResult = originalProcessSemanticResult;
    });
  });

  describe('暫存狀態生命週期測試', () => {
    test('暫存狀態應該正確創建和清理', async () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course: '大提琴課',
          date: '明天'
          // 缺少 time
        },
        success: true,
        text: '明天大提琴課'
      };

      // 創建暫存狀態
      const result1 = await manager.processWithProblemDetection(userId, semanticResult);
      expect(result1.tempState).toBeDefined();
      
      const tempId = result1.tempState.tempId;
      const tempState = manager.tempStateManager.getTempState(userId);
      expect(tempState).not.toBeNull();
      expect(tempState.tempId).toBe(tempId);

      // 補充信息並完成
      const supplementResult = {
        intent: 'record_course',
        entities: { time: '15:00' },
        success: true,
        text: '下午3點'
      };

      const result2 = await manager.processWithProblemDetection(userId, supplementResult);
      expect(result2.type).toBe('task_completed');
      expect(result2.tempStateCleared).toBe(true);

      // 暫存狀態應該被清理
      const clearedState = manager.tempStateManager.getTempState(userId);
      expect(clearedState).toBeNull();
    });
  });
});