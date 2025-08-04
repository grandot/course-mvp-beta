/**
 * SlotTemplateManager 單元測試
 */

const SlotTemplateManager = require('../../src/slot-template/slotTemplateManager');
const SlotStateManager = require('../../src/slot-template/slotStateManager');
const SlotMerger = require('../../src/slot-template/slotMerger');
const SlotValidator = require('../../src/slot-template/slotValidator');
const { getTemplateLoader } = require('../../src/slot-template/templateLoader');
const ScenarioManager = require('../../src/scenario/ScenarioManager');

jest.mock('../../src/slot-template/slotStateManager');
jest.mock('../../src/slot-template/slotMerger');
jest.mock('../../src/slot-template/slotValidator');
jest.mock('../../src/slot-template/templateLoader');

describe('SlotTemplateManager', () => {
  let manager;
  let mockStateManager;
  let mockMerger;
  let mockValidator;
  let mockTemplateLoader;

  beforeAll(async () => {
    // 🎯 初始化 ScenarioManager 以支持 TaskService
    await ScenarioManager.initialize();
  });

  afterAll(async () => {
    // 🎯 清理 ScenarioManager 緩存
    ScenarioManager.clearCache();
  });

  beforeEach(() => {
    // 創建 mock 實例
    mockStateManager = {
      getUserState: jest.fn(),
      updateUserState: jest.fn(),
      getCacheStats: jest.fn().mockReturnValue({ cacheSize: 10, hitRate: 0.8 })
    };
    
    mockMerger = {
      merge: jest.fn(),
      getStats: jest.fn().mockReturnValue({ mergeOperations: 5, conflictDetections: 1 }),
      resetStats: jest.fn()
    };
    
    mockValidator = {
      validate: jest.fn(),
      getStats: jest.fn().mockReturnValue({ validationCalls: 3, validationErrors: 0 }),
      resetStats: jest.fn()
    };
    
    mockTemplateLoader = {
      ensureInitialized: jest.fn().mockResolvedValue(),
      getTemplateByIntent: jest.fn(),
      getStats: jest.fn().mockResolvedValue({ total_templates: 1 })
    };

    // 設定 mock 構造函數
    SlotStateManager.mockImplementation(() => mockStateManager);
    SlotMerger.mockImplementation(() => mockMerger);
    SlotValidator.mockImplementation(() => mockValidator);
    getTemplateLoader.mockReturnValue(mockTemplateLoader);

    manager = new SlotTemplateManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processSemanticResult', () => {
    const mockUserId = 'test-user-123';
    const mockSemanticResult = {
      intent: 'record_course',
      entities: {
        course_name: '鋼琴課',
        location: '音樂教室',
        timeInfo: {
          date: '2025-08-01',
          time: '14:00'
        }
      },
      confidence: 0.9,
      method: 'semantic_service'
    };

    const mockCurrentState = {
      user_id: mockUserId,
      active_task: null,
      settings: {
        language: 'zh-TW'
      }
    };

    const mockMergedState = {
      user_id: mockUserId,
      active_task: {
        intent: 'record_course',
        slot_state: {
          course: '鋼琴課',
          location: '音樂教室',
          date: '2025-08-01',
          time: '14:00'
        }
      }
    };

    const mockValidationResult = {
      isValid: true,
      isComplete: false,
      completionScore: 0.7,
      missingSlots: [
        {
          slot: 'student',
          type: 'required',
          description: '學生姓名',
          priority: 'high'
        }
      ],
      validationErrors: []
    };

    beforeEach(() => {
      mockStateManager.getUserState.mockResolvedValue(mockCurrentState);
      mockMerger.merge.mockResolvedValue(mockMergedState);
      mockValidator.validate.mockResolvedValue(mockValidationResult);
      mockStateManager.updateUserState.mockResolvedValue(mockMergedState);
    });

    it('應該能夠成功處理語意結果', async () => {
      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(mockUserId);
      expect(result.intent).toBe('record_course');
      expect(result.userState).toEqual(mockMergedState);
      expect(result.validation).toEqual(mockValidationResult);
      expect(result.nextActions).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('應該正確轉換語意結果為 Slot 格式', async () => {
      await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(mockMerger.merge).toHaveBeenCalledWith(
        mockCurrentState,
        expect.objectContaining({
          intent: 'record_course',
          slot_state: {
            course: '鋼琴課',
            location: '音樂教室',
            date: '2025-08-01',
            time: '14:00'
          },
          confidence: 0.9,
          extraction_details: expect.objectContaining({
            method: 'semantic_service',
            processed_entities: mockSemanticResult.entities
          })
        })
      );
    });

    it('應該根據驗證結果確定下一步行動', async () => {
      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.nextActions.type).toBe('collect_missing_slots');
      expect(result.nextActions.canExecuteTask).toBe(false);
      expect(result.nextActions.actions).toHaveLength(1);
      expect(result.nextActions.actions[0].slot).toBe('student');
    });

    it('當任務完成且有效時應該標記可執行', async () => {
      const completeValidationResult = {
        ...mockValidationResult,
        isComplete: true,
        missingSlots: []
      };
      mockValidator.validate.mockResolvedValue(completeValidationResult);
      
      // 🎯 修復：確保 merged state 有 active_task
      const completeMergedState = {
        ...mockMergedState,
        active_task: {
          intent: 'record_course',
          slot_state: {
            course: '鋼琴課',
            location: '音樂教室',
            date: '2025-08-01',
            time: '14:00'
          }
        }
      };
      mockMerger.merge.mockResolvedValue(completeMergedState);
      mockStateManager.updateUserState.mockResolvedValue(completeMergedState);

      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.nextActions.type).toBe('execute_task');
      expect(result.nextActions.canExecuteTask).toBe(true);
      expect(result.nextActions.priority).toBe('high');
    });

    it('應該處理驗證錯誤情況', async () => {
      const errorValidationResult = {
        isValid: false,
        isComplete: false,
        completionScore: 0.3,
        missingSlots: [],
        validationErrors: [
          {
            slot: 'date',
            errors: [
              { code: 'INVALID_DATE', message: '日期格式不正確' }
            ]
          }
        ]
      };
      mockValidator.validate.mockResolvedValue(errorValidationResult);

      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.nextActions.type).toBe('fix_validation_errors');
      expect(result.nextActions.priority).toBe('high');
      expect(result.nextActions.actions[0].slot).toBe('date');
    });

    it('應該處理組件執行失敗的情況', async () => {
      const error = new Error('State manager error');
      mockStateManager.getUserState.mockRejectedValue(error);

      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.success).toBe(false);
      expect(result.error).toContain('State manager error');
      expect(result.errorType).toBe('state_error');
    });

    it('應該執行重試機制', async () => {
      mockStateManager.getUserState
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(mockCurrentState);

      const result = await manager.processSemanticResult(mockUserId, mockSemanticResult);

      expect(result.success).toBe(true);
      expect(mockStateManager.getUserState).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateFollowUpQuestion', () => {
    const mockIntent = 'record_course';
    const mockTemplate = {
      question_templates: {
        student: [
          '請問是哪位學生要上課？',
          '學生的姓名是？'
        ],
        course: [
          '請問要上什麼課程？'
        ]
      },
      slots: {
        student: {
          type: 'string',
          description: '學生姓名',
          examples: ['小光', '小明'],
          aliases: ['學生', '孩子']
        },
        course: {
          type: 'string',
          description: '課程名稱',
          examples: ['鋼琴課', '英文課']
        },
        date: {
          type: 'date',
          description: '上課日期',
          validation: { format: 'YYYY-MM-DD' },
          aliases: ['日期', '時間', '哪天']
        }
      }
    };

    beforeEach(() => {
      mockTemplateLoader.getTemplateByIntent.mockResolvedValue(mockTemplate);
    });

    it('當任務完成時應該不生成問題', async () => {
      const completeValidation = {
        isComplete: true,
        isValid: true,
        missingSlots: [],
        validationErrors: []
      };

      const result = await manager.generateFollowUpQuestion(completeValidation, mockIntent);

      expect(result.hasQuestion).toBe(false);
      expect(result.questionType).toBe('completion');
    });

    it('應該優先處理驗證錯誤', async () => {
      const errorValidation = {
        isComplete: false,
        isValid: false,
        missingSlots: [
          { slot: 'student', description: '學生姓名', priority: 'high' }
        ],
        validationErrors: [
          {
            slot: 'date',
            errors: [{ message: '日期格式不正確' }]
          }
        ]
      };

      const result = await manager.generateFollowUpQuestion(errorValidation, mockIntent);

      expect(result.hasQuestion).toBe(true);
      expect(result.questionType).toBe('validation_error');
      expect(result.slot).toBe('date');
      expect(result.priority).toBe('high');
    });

    it('應該為缺失的 slot 生成問題', async () => {
      const incompleteValidation = {
        isComplete: false,
        isValid: true,
        missingSlots: [
          { slot: 'student', description: '學生姓名', priority: 'high' }
        ],
        validationErrors: [],
        completionScore: 0.6
      };

      const result = await manager.generateFollowUpQuestion(incompleteValidation, mockIntent);

      expect(result.hasQuestion).toBe(true);
      expect(result.questionType).toBe('missing_slot');
      expect(result.slot).toBe('student');
      expect(result.priority).toBe('high');
      // 增強版會從模板中選擇問題或使用預設格式
      expect(mockTemplate.question_templates.student).toContain(result.message);
      expect(result.progress).toBeDefined();
      expect(result.progress.current).toBe(0.6);
    });

    it('當模板載入失敗時應該使用預設問題', async () => {
      mockTemplateLoader.getTemplateByIntent.mockRejectedValue(new Error('Template not found'));
      
      const incompleteValidation = {
        isComplete: false,
        isValid: true,
        missingSlots: [
          { slot: 'student', description: '學生姓名', priority: 'high' }
        ],
        validationErrors: []
      };

      const result = await manager.generateFollowUpQuestion(incompleteValidation, mockIntent);

      expect(result.hasQuestion).toBe(true);
      expect(result.message).toBe('請提供學生姓名。');
    });

    it('應該根據上下文優先級排序問題', async () => {
      const multipleSlotValidation = {
        isComplete: false,
        isValid: true,
        missingSlots: [
          { slot: 'location', description: '上課地點', priority: 'medium' },
          { slot: 'student', description: '學生姓名', priority: 'high' },
          { slot: 'teacher', description: '授課老師', priority: 'low' }
        ],
        validationErrors: [],
        completionScore: 0.4
      };

      const context = {
        recentlyMentioned: ['location'], // location 最近被提及
        userState: { settings: { language: 'zh-TW' } }
      };

      const result = await manager.generateFollowUpQuestion(multipleSlotValidation, mockIntent, context);

      // 應該優先詢問學生姓名（high priority），但上下文提及的 location 也會被考慮
      expect(result.hasQuestion).toBe(true);
      expect(result.slot).toBe('student'); // 因為 high priority 權重更高
      expect(result.suggestions).toBeDefined();
      expect(result.progress.remaining).toBe(3);
    });

    it('應該生成上下文感知的錯誤訊息', async () => {
      const errorValidation = {
        isComplete: false,
        isValid: false,
        missingSlots: [],
        validationErrors: [
          {
            slot: 'date',
            errors: [{ code: 'INVALID_DATE_FORMAT', message: '日期格式不正確' }]
          }
        ]
      };

      const result = await manager.generateFollowUpQuestion(errorValidation, mockIntent);

      expect(result.hasQuestion).toBe(true);
      expect(result.questionType).toBe('validation_error');
      expect(result.message).toContain('您可以輸入如');
      expect(result.suggestions).toEqual(['2025-08-01', '明天', '下週五', '8月15日']);
    });

    it('應該為不同 slot 生成智能建議', async () => {
      const context = {
        recentStudents: ['小明', '小華', 'Amy'],
        frequentCourses: ['鋼琴課', '英文課'],
        preferredTimes: ['14:00', '15:00']
      };

      // 測試學生建議
      const suggestions = await manager.generateSlotSuggestions(
        { slot: 'student' }, 
        context, 
        { examples: ['小光'] }
      );

      expect(suggestions).toContain('小明');
      expect(suggestions).toContain('小華');
      expect(suggestions).toContain('Amy');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('應該生成輸入提示', () => {
      const dateSlotConfig = {
        type: 'date',
        validation: { format: 'YYYY-MM-DD' },
        aliases: ['日期', '時間', '哪天']
      };

      const hints = manager.generateInputHints('date', dateSlotConfig);

      expect(hints).toContain('格式：YYYY-MM-DD 或 "明天"、"下週三"');
      expect(hints).toContain('也可以說：日期、時間');
    });

    it('應該檢查 slot 依賴關係', () => {
      const missingSlots = [
        { slot: 'date' },
        { slot: 'time' },
        { slot: 'reminder' }
      ];

      // reminder 依賴於 date 和 time
      expect(manager.hasDependencies('reminder', missingSlots)).toBe(true);
      
      // course 沒有依賴
      expect(manager.hasDependencies('course', missingSlots)).toBe(false);
    });
  });

  describe('convertSemanticToSlotFormat', () => {
    it('應該正確轉換語意結果', () => {
      const semanticResult = {
        intent: 'record_course',
        entities: {
          course_name: '鋼琴課',
          location: '音樂教室',
          teacher: '王老師',
          timeInfo: {
            date: '2025-08-01',
            time: '14:00'
          },
          confirmation: '確認'
        },
        confidence: 0.9,
        method: 'rule_engine'
      };

      const result = manager.convertSemanticToSlotFormat(semanticResult);

      expect(result).toEqual({
        intent: 'record_course',
        slot_state: {
          course: '鋼琴課',
          location: '音樂教室',
          teacher: '王老師',
          date: '2025-08-01',
          time: '14:00',
          confirmation: '確認'
        },
        confidence: 0.9,
        extraction_details: {
          raw_text: '',
          method: 'rule_engine',
          processed_entities: semanticResult.entities,
          timestamp: expect.any(String)
        }
      });
    });

    it('應該處理部分實體缺失的情況', () => {
      const semanticResult = {
        intent: 'modify_course',
        entities: {
          course_name: '英文課'
        },
        confidence: 0.7
      };

      const result = manager.convertSemanticToSlotFormat(semanticResult);

      expect(result.slot_state).toEqual({
        course: '英文課'
      });
    });
  });

  describe('統計和監控', () => {
    it('應該正確記錄統計資訊', async () => {
      const mockSemanticResult = {
        intent: 'record_course',
        entities: { course_name: '測試課程' },
        confidence: 0.8
      };

      mockStateManager.getUserState.mockResolvedValue({ user_id: 'test' });
      mockMerger.merge.mockResolvedValue({ user_id: 'test' });
      mockValidator.validate.mockResolvedValue({ isValid: true, isComplete: true });
      mockStateManager.updateUserState.mockResolvedValue({ user_id: 'test' });

      await manager.processSemanticResult('test-user', mockSemanticResult);

      const stats = manager.getStats();
      expect(stats.processSemanticCalls).toBe(1);
      expect(stats.successfulProcesses).toBe(1);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('應該能夠重置統計資訊', () => {
      manager.resetStats();

      const stats = manager.getStats();
      expect(stats.processSemanticCalls).toBe(0);
      expect(stats.successfulProcesses).toBe(0);
      expect(stats.failedProcesses).toBe(0);
      expect(mockMerger.resetStats).toHaveBeenCalled();
      expect(mockValidator.resetStats).toHaveBeenCalled();
    });
  });

  describe('健康檢查', () => {
    it('應該返回健康狀態', async () => {
      const health = await manager.healthCheck();

      expect(health.overall).toBe('healthy');
      expect(health.components.templateLoader.status).toBe('healthy');
      expect(health.components.stateManager.status).toBe('healthy');
      expect(health.components.merger.status).toBe('healthy');
      expect(health.components.validator.status).toBe('healthy');
    });

    it('當模板載入器失敗時應該返回降級狀態', async () => {
      mockTemplateLoader.ensureInitialized.mockRejectedValue(new Error('Template error'));

      const health = await manager.healthCheck();

      expect(health.overall).toBe('degraded');
      expect(health.components.templateLoader.status).toBe('unhealthy');
    });
  });

  describe('重試機制', () => {
    it('應該能夠設定重試配置', () => {
      const newConfig = {
        maxRetries: 5,
        retryDelay: 2000
      };

      manager.setRetryConfig(newConfig);

      expect(manager.retryConfig.maxRetries).toBe(5);
      expect(manager.retryConfig.retryDelay).toBe(2000);
      expect(manager.retryConfig.exponentialBackoff).toBe(true); // 保持原有設定
    });
  });

  describe('錯誤分類', () => {
    it('應該正確分類不同類型的錯誤', () => {
      expect(manager.categorizeError(new Error('Template not found'))).toBe('template_error');
      expect(manager.categorizeError(new Error('Validation failed'))).toBe('validation_error');
      expect(manager.categorizeError(new Error('State error'))).toBe('state_error');
      expect(manager.categorizeError(new Error('Merge conflict'))).toBe('merge_error');
      expect(manager.categorizeError(new Error('Unknown issue'))).toBe('unknown_error');
    });
  });
});