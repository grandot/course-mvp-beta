/**
 * TempSlotStateManager 測試套件
 * 涵蓋暫存狀態管理、補充信息合併、過期處理等功能
 */

const TempSlotStateManager = require('../../src/slot-template/tempSlotStateManager');

describe('TempSlotStateManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TempSlotStateManager();
  });

  afterEach(() => {
    // 清理所有暫存狀態
    manager.clearAllStates();
  });

  describe('暫存狀態創建', () => {
    test('應該創建暫存狀態', async () => {
      const userId = 'user123';
      const validSlots = { course: '大提琴課', student: '小美' };
      const problems = [{ type: 'missing_time', field: 'time' }];
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };

      const tempState = await manager.createTempState(userId, validSlots, problems, template);

      expect(tempState).toMatchObject({
        userId,
        validSlots,
        problems,
        template,
        status: 'pending_completion',
        retryCount: 0
      });
      expect(tempState.tempId).toContain('temp_user123_');
      expect(tempState.createdAt).toBeInstanceOf(Date);
      expect(tempState.expiresAt).toBeInstanceOf(Date);
    });

    test('暫存狀態應該在30分鐘後過期', async () => {
      const userId = 'user123';
      const tempState = await manager.createTempState(userId, {}, [], {});
      
      const expirationTime = tempState.expiresAt.getTime() - tempState.createdAt.getTime();
      expect(expirationTime).toBe(30 * 60 * 1000); // 30分鐘
    });
  });

  describe('補充信息合併', () => {
    test('應該正確合併補充信息', async () => {
      const userId = 'user123';
      const initialSlots = { course: '大提琴課', student: '小美' };
      const tempState = await manager.createTempState(userId, initialSlots, [], {});

      const newSlots = { time: '15:00', date: '明天' };
      const mergedState = await manager.mergeSupplementInfo(tempState.tempId, newSlots);

      expect(mergedState.validSlots).toEqual({
        course: '大提琴課',
        student: '小美',
        time: '15:00',
        date: '明天'
      });
      expect(mergedState.retryCount).toBe(1);
    });

    test('不應該覆蓋已存在的字段', async () => {
      const userId = 'user123';
      const initialSlots = { course: '大提琴課', time: '14:00' };
      const tempState = await manager.createTempState(userId, initialSlots, [], {});

      const newSlots = { time: '15:00', date: '明天' }; // 嘗試覆蓋時間
      const mergedState = await manager.mergeSupplementInfo(tempState.tempId, newSlots);

      expect(mergedState.validSlots).toEqual({
        course: '大提琴課',
        time: '15:00', // 新值會覆蓋舊值
        date: '明天'
      });
    });

    test('應該忽略空值和null值', async () => {
      const userId = 'user123';
      const initialSlots = { course: '大提琴課' };
      const tempState = await manager.createTempState(userId, initialSlots, [], {});

      const newSlots = { time: '', date: null, student: '小美' };
      const mergedState = await manager.mergeSupplementInfo(tempState.tempId, newSlots);

      expect(mergedState.validSlots).toEqual({
        course: '大提琴課',
        student: '小美'
      });
      expect(mergedState.validSlots.time).toBeUndefined();
      expect(mergedState.validSlots.date).toBeUndefined();
    });

    test('應該拋出錯誤當暫存狀態不存在', async () => {
      const invalidTempId = 'temp_user123_invalid';
      
      await expect(manager.mergeSupplementInfo(invalidTempId, { time: '15:00' }))
        .rejects.toThrow('暫存狀態不存在或已過期');
    });
  });

  describe('完整性檢查', () => {
    test('應該正確檢查信息完整性', async () => {
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };
      
      // 不完整的狀態
      const incompleteState = {
        validSlots: { course: '大提琴課', date: '明天' }, // 缺少時間
        template
      };
      expect(manager.isComplete(incompleteState)).toBe(false);

      // 完整的狀態
      const completeState = {
        validSlots: { course: '大提琴課', date: '明天', time: '15:00' },
        template
      };
      expect(manager.isComplete(completeState)).toBe(true);
    });

    test('空值字段應該被視為不完整', () => {
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };
      const state = {
        validSlots: { course: '大提琴課', date: '', time: null },
        template
      };
      
      expect(manager.isComplete(state)).toBe(false);
    });
  });

  describe('補充意圖檢測', () => {
    test('應該檢測時間補充意圖', async () => {
      const userId = 'user123';
      await manager.createTempState(userId, {}, [{ type: 'missing_time' }], {});

      const timeInputs = ['15:00', '3點', '下午3點', '3點30分'];
      
      for (const input of timeInputs) {
        const result = await manager.detectSupplementIntent(userId, input);
        expect(result).not.toBeNull();
        expect(result.userId).toBe(userId);
      }
    });

    test('應該檢測日期補充意圖', async () => {
      const userId = 'user123';
      await manager.createTempState(userId, {}, [{ type: 'missing_date' }], {});

      const dateInputs = ['明天', '後天', '2025-07-30', '7月30日'];
      
      for (const input of dateInputs) {
        const result = await manager.detectSupplementIntent(userId, input);
        expect(result).not.toBeNull();
        expect(result.userId).toBe(userId);
      }
    });

    test('應該檢測簡短補充回答', async () => {
      const userId = 'user123';
      await manager.createTempState(userId, {}, [{ type: 'missing_info' }], {});

      const shortInputs = ['小美', '是的', '好的'];
      
      for (const input of shortInputs) {
        const result = await manager.detectSupplementIntent(userId, input);
        expect(result).not.toBeNull();
      }
    });

    test('不應該將課程輸入誤認為補充意圖', async () => {
      const userId = 'user123';
      await manager.createTempState(userId, {}, [{ type: 'missing_time' }], {});

      const courseInputs = ['明天下午大提琴課', '小美鋼琴課教學'];
      
      for (const input of courseInputs) {
        const result = await manager.detectSupplementIntent(userId, input);
        expect(result).toBeNull(); // 不應該被識別為補充意圖
      }
    });

    test('沒有暫存狀態時應該返回null', async () => {
      const result = await manager.detectSupplementIntent('nonexistent_user', '15:00');
      expect(result).toBeNull();
    });
  });

  describe('狀態清理', () => {
    test('應該清理指定的暫存狀態', async () => {
      const userId = 'user123';
      const tempState = await manager.createTempState(userId, {}, [], {});
      
      const cleared = await manager.clearTempState(tempState.tempId);
      expect(cleared).toBe(true);
      
      const retrievedState = manager.getTempState(userId);
      expect(retrievedState).toBeNull();
    });

    test('清理不存在的狀態應該返回false', async () => {
      const cleared = await manager.clearTempState('temp_nonexistent_123');
      expect(cleared).toBe(false);
    });
  });

  describe('過期處理', () => {
    test('過期狀態不應該被檢測為補充意圖', async () => {
      const userId = 'user123';
      const tempState = await manager.createTempState(userId, {}, [], {});
      
      // 手動設置為已過期
      tempState.expiresAt = new Date(Date.now() - 1000);
      
      const result = await manager.detectSupplementIntent(userId, '15:00');
      expect(result).toBeNull();
    });

    test('合併過期狀態應該拋出錯誤', async () => {
      const userId = 'user123';
      const tempState = await manager.createTempState(userId, {}, [], {});
      
      // 手動設置為已過期
      tempState.expiresAt = new Date(Date.now() - 1000);
      
      await expect(manager.mergeSupplementInfo(tempState.tempId, { time: '15:00' }))
        .rejects.toThrow('暫存狀態已過期');
    });
  });

  describe('LRU 緩存功能', () => {
    test('LRU緩存應該限制最大容量', async () => {
      // 創建一個小容量的管理器來測試
      const smallManager = new TempSlotStateManager();
      smallManager.stateCache.maxSize = 2; // 設置最大容量為2

      // 創建3個暫存狀態
      await smallManager.createTempState('user1', {}, [], {});
      await smallManager.createTempState('user2', {}, [], {});
      await smallManager.createTempState('user3', {}, [], {}); // 這應該會驅逐 user1

      expect(smallManager.getTempState('user1')).toBeNull(); // 最久的應該被驅逐
      expect(smallManager.getTempState('user2')).not.toBeNull();
      expect(smallManager.getTempState('user3')).not.toBeNull();

      smallManager.clearAllStates();
    });
  });

  describe('輔助方法', () => {
    test('應該正確生成和解析暫存ID', () => {
      const userId = 'user123';
      const tempId = manager.generateTempId(userId);
      
      expect(tempId).toMatch(/^temp_user123_\d+_[a-z0-9]{6}$/);
      
      const extractedUserId = manager.extractUserIdFromTempId(tempId);
      expect(extractedUserId).toBe(userId);
    });

    test('應該返回統計信息', async () => {
      await manager.createTempState('user1', {}, [], {});
      await manager.createTempState('user2', {}, [], {});
      
      const stats = manager.getStats();
      expect(stats.activeStates).toBe(2);
      expect(stats.maxCapacity).toBe(100);
      expect(stats.expirationMinutes).toBe(30);
    });
  });
});