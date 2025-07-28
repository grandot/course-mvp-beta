/**
 * SlotMerger 單元測試
 * 測試 slot 合併邏輯、衝突處理和意圖變更
 */

const SlotMerger = require('../../src/slot-template/slotMerger');

describe('SlotMerger', () => {
  let slotMerger;

  beforeEach(() => {
    slotMerger = new SlotMerger();
  });

  describe('merge', () => {
    test('應該為新用戶創建新任務', async () => {
      const currentState = {
        user_id: 'test-user-123',
        active_task: null,
        settings: { language: 'zh-TW' }
      };

      const semanticResult = {
        intent: 'record_course',
        slot_state: {
          student: '小光',
          course: '鋼琴課',
          date: '2025-08-01',
          time: '14:00'
        },
        extraction_details: {
          raw_text: '明天小光要上鋼琴課',
          processed_entities: {
            student: { value: '小光', confidence: 0.98 }
          }
        }
      };

      const result = await slotMerger.merge(currentState, semanticResult);

      expect(result.active_task).toBeDefined();
      expect(result.active_task.intent).toBe('record_course');
      expect(result.active_task.slot_state.student).toBe('小光');
      expect(result.active_task.history).toHaveLength(1);
      expect(slotMerger.stats.newTaskCreations).toBe(1);
    });

    test('應該合併現有任務的新 slots', async () => {
      const currentState = {
        user_id: 'test-user-123',
        active_task: {
          task_id: 'existing-task',
          intent: 'record_course',
          slot_state: {
            student: '小光',
            course: '鋼琴課',
            date: '2025-08-01',
            time: null,
            location: null
          },
          history: [
            {
              timestamp: '2025-07-28T10:00:00Z',
              user_input: '小光要上鋼琴課',
              extracted_slots: { student: '小光', course: '鋼琴課' }
            }
          ],
          updated_at: new Date().toISOString()
        }
      };

      const semanticResult = {
        intent: 'record_course',
        slot_state: {
          time: '14:00',
          location: '板橋教室'
        },
        extraction_details: {
          raw_text: '下午兩點在板橋教室',
          processed_entities: {
            time: { value: '14:00', confidence: 0.95 },
            location: { value: '板橋教室', confidence: 0.90 }
          }
        }
      };

      const result = await slotMerger.merge(currentState, semanticResult);

      expect(result.active_task.slot_state.time).toBe('14:00');
      expect(result.active_task.slot_state.location).toBe('板橋教室');
      expect(result.active_task.slot_state.student).toBe('小光'); // 保留原有值
      expect(result.active_task.history).toHaveLength(2);
    });

    test('應該處理意圖變更', async () => {
      const currentState = {
        user_id: 'test-user-123',
        active_task: {
          task_id: 'existing-task',
          intent: 'record_course',
          slot_state: { student: '小光', course: '鋼琴課' },
          history: [],
          updated_at: new Date().toISOString()
        }
      };

      const semanticResult = {
        intent: 'modify_course',
        slot_state: {
          student: '小光',
          course: '小提琴課'
        },
        extraction_details: {
          raw_text: '改成小提琴課'
        }
      };

      const result = await slotMerger.merge(currentState, semanticResult);

      expect(result.active_task.intent).toBe('modify_course');
      expect(result.active_task.task_id).not.toBe('existing-task'); // 新任務ID
      expect(slotMerger.stats.intentChanges).toBe(1);
    });
  });

  describe('isNewTask', () => {
    test('應該判斷空任務為新任務', () => {
      const currentState = { active_task: null };
      const result = slotMerger.isNewTask(currentState, 'record_course');
      expect(result).toBe(true);
    });

    test('應該判斷已完成任務為新任務', () => {
      const currentState = {
        active_task: {
          status: 'complete',
          updated_at: new Date().toISOString()
        }
      };
      const result = slotMerger.isNewTask(currentState, 'record_course');
      expect(result).toBe(true);
    });

    test('應該判斷過期任務為新任務', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const currentState = {
        active_task: {
          status: 'incomplete',
          updated_at: oneHourAgo
        }
      };
      const result = slotMerger.isNewTask(currentState, 'record_course');
      expect(result).toBe(true);
    });

    test('應該判斷活躍任務不為新任務', () => {
      const currentState = {
        active_task: {
          status: 'incomplete',
          updated_at: new Date().toISOString()
        }
      };
      const result = slotMerger.isNewTask(currentState, 'record_course');
      expect(result).toBe(false);
    });
  });

  describe('mergeSingleSlot', () => {
    test('應該填充空值', () => {
      const result = slotMerger.mergeSingleSlot('student', null, '小光', {});
      expect(result.value).toBe('小光');
      expect(result.conflict).toBeNull();
    });

    test('應該保留相同值', () => {
      const result = slotMerger.mergeSingleSlot('student', '小光', '小光', {});
      expect(result.value).toBe('小光');
      expect(result.conflict).toBeNull();
    });

    test('應該檢測衝突', () => {
      const result = slotMerger.mergeSingleSlot('student', '小光', '小明', {
        processed_entities: {
          student: { confidence: 0.8 }
        }
      });
      
      expect(result.value).toBe('小明'); // 預設策略：使用新值
      expect(result.conflict).toBeDefined();
      expect(result.conflict.slot).toBe('student');
      expect(result.conflict.current_value).toBe('小光');
      expect(result.conflict.new_value).toBe('小明');
    });

    test('應該處理大小寫不敏感的字串比較', () => {
      const result = slotMerger.mergeSingleSlot('location', '板橋教室', '板橋教室', {});
      expect(result.value).toBe('板橋教室');
      expect(result.conflict).toBeNull();
    });
  });

  describe('isValueEqual', () => {
    test('應該正確比較字串', () => {
      expect(slotMerger.isValueEqual('test', 'test')).toBe(true);
      expect(slotMerger.isValueEqual('Test', 'test')).toBe(true); // 大小寫不敏感
      expect(slotMerger.isValueEqual(' test ', 'test')).toBe(true); // 去除空白
      expect(slotMerger.isValueEqual('test1', 'test2')).toBe(false);
    });

    test('應該正確比較數字', () => {
      expect(slotMerger.isValueEqual(123, 123)).toBe(true);
      expect(slotMerger.isValueEqual(123, 456)).toBe(false);
    });

    test('應該正確比較物件', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const obj3 = { a: 1, b: 3 };
      
      expect(slotMerger.isValueEqual(obj1, obj2)).toBe(true);
      expect(slotMerger.isValueEqual(obj1, obj3)).toBe(false);
    });

    test('應該正確比較不同類型', () => {
      expect(slotMerger.isValueEqual('123', 123)).toBe(false);
      expect(slotMerger.isValueEqual(null, undefined)).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    test('應該使用 OVERWRITE 策略', () => {
      const conflict = {
        slot: 'student',
        current_value: '小光',
        new_value: '小明',
        resolution_strategy: 'overwrite'
      };
      
      const result = slotMerger.resolveConflict(conflict);
      expect(result).toBe('小明');
    });

    test('應該使用 KEEP_EXISTING 策略', () => {
      const conflict = {
        slot: 'student',
        current_value: '小光',
        new_value: '小明',
        resolution_strategy: 'keep_existing'
      };
      
      const result = slotMerger.resolveConflict(conflict);
      expect(result).toBe('小光');
    });

    test('應該使用 MERGE 策略合併陣列', () => {
      const conflict = {
        slot: 'tags',
        current_value: ['tag1', 'tag2'],
        new_value: ['tag2', 'tag3'],
        resolution_strategy: 'merge'
      };
      
      const result = slotMerger.resolveConflict(conflict);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('createNewTask', () => {
    test('應該創建完整的新任務', () => {
      const currentState = {
        user_id: 'test-user-123',
        active_task: null
      };

      const semanticResult = {
        intent: 'record_course',
        slot_state: { student: '小光', course: '鋼琴課' },
        extraction_details: { raw_text: '小光要上鋼琴課' }
      };

      const result = slotMerger.createNewTask(currentState, semanticResult);

      expect(result.active_task.task_id).toBeDefined();
      expect(result.active_task.intent).toBe('record_course');
      expect(result.active_task.template_id).toBe('course_management');
      expect(result.active_task.status).toBe('incomplete');
      expect(result.active_task.slot_state.student).toBe('小光');
      expect(result.active_task.history).toHaveLength(1);
      expect(result.active_task.created_at).toBeDefined();
    });
  });

  describe('統計和配置', () => {
    test('應該正確記錄統計資訊', async () => {
      const currentState = {
        user_id: 'test-user-123',
        active_task: {
          intent: 'record_course',
          slot_state: { student: '小光' },
          history: [],
          updated_at: new Date().toISOString()
        }
      };

      const semanticResult = {
        intent: 'record_course',
        slot_state: { student: '小明' }, // 衝突
        extraction_details: { raw_text: '改成小明' }
      };

      await slotMerger.merge(currentState, semanticResult);

      const stats = slotMerger.getStats();
      expect(stats.mergeOperations).toBe(1);
      expect(stats.conflictDetections).toBe(1);
      expect(stats.conflictRate).toBe(1);
    });

    test('應該能設定衝突策略', () => {
      slotMerger.setConflictStrategy('keep_existing');
      expect(slotMerger.defaultStrategy).toBe('keep_existing');

      expect(() => {
        slotMerger.setConflictStrategy('invalid_strategy');
      }).toThrow('不支援的衝突策略');
    });

    test('應該能重置統計資訊', () => {
      slotMerger.stats.mergeOperations = 10;
      slotMerger.resetStats();
      expect(slotMerger.stats.mergeOperations).toBe(0);
    });
  });

  describe('cleanupExpiredConflicts', () => {
    test('應該清理過期的歷史記錄', () => {
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25小時前
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1小時前

      const userState = {
        user_id: 'test-user-123',
        active_task: {
          history: [
            { timestamp: oneDayAgo, user_input: 'old input' }, // 應該被清理
            { timestamp: oneHourAgo, user_input: 'recent input' } // 應該保留
          ]
        }
      };

      const result = slotMerger.cleanupExpiredConflicts(userState, 24);
      
      expect(result.active_task.history).toHaveLength(1);
      expect(result.active_task.history[0].user_input).toBe('recent input');
    });

    test('應該處理沒有歷史記錄的情況', () => {
      const userState = {
        user_id: 'test-user-123',
        active_task: null
      };

      const result = slotMerger.cleanupExpiredConflicts(userState);
      expect(result).toEqual(userState);
    });
  });

  describe('getTemplateIdForIntent', () => {
    test('應該正確映射意圖到模板ID', () => {
      expect(slotMerger.getTemplateIdForIntent('record_course')).toBe('course_management');
      expect(slotMerger.getTemplateIdForIntent('modify_course')).toBe('course_management');
      expect(slotMerger.getTemplateIdForIntent('unknown_intent')).toBe('course_management'); // 預設值
    });
  });
});