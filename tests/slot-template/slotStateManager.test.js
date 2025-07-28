/**
 * SlotStateManager 單元測試
 * 測試用戶狀態管理、快取機制和持久化功能
 */

const SlotStateManager = require('../../src/slot-template/slotStateManager');
const DataService = require('../../src/services/dataService');

// Mock DataService
jest.mock('../../src/services/dataService');

describe('SlotStateManager', () => {
  let slotStateManager;
  let mockDataService;

  beforeEach(() => {
    // 重置 mock
    jest.clearAllMocks();
    
    // 創建 mock DataService 實例
    mockDataService = {
      getDocument: jest.fn(),
      setDocument: jest.fn(),
      deleteDocument: jest.fn(),
      queryDocuments: jest.fn()
    };
    
    // 替換 DataService 的實作
    DataService.mockImplementation(() => mockDataService);
    
    slotStateManager = new SlotStateManager();
  });

  describe('getUserState', () => {
    const userId = 'test-user-123';

    test('應該從快取返回狀態', async () => {
      // 準備快取數據
      const cachedState = {
        user_id: userId,
        created_at: '2025-07-28T10:00:00Z',
        updated_at: '2025-07-28T10:00:00Z',
        active_task: null,
        settings: { language: 'zh-TW' }
      };
      
      slotStateManager.setCachedState(userId, cachedState);

      // 執行測試
      const result = await slotStateManager.getUserState(userId);

      // 驗證結果
      expect(result).toEqual(cachedState);
      expect(mockDataService.getDocument).not.toHaveBeenCalled();
      expect(slotStateManager.stats.cacheHits).toBe(1);
    });

    test('應該從資料庫載入狀態並快取', async () => {
      // 準備資料庫數據
      const dbState = {
        user_id: userId,
        created_at: '2025-07-28T10:00:00Z',
        updated_at: new Date().toISOString(),
        active_task: { intent: 'record_course' },
        settings: { language: 'zh-TW' }
      };
      
      mockDataService.getDocument.mockResolvedValue(dbState);

      // 執行測試
      const result = await slotStateManager.getUserState(userId);

      // 驗證結果
      expect(result).toEqual(dbState);
      expect(mockDataService.getDocument).toHaveBeenCalledWith('user_slot_states', userId);
      expect(slotStateManager.stats.cacheMisses).toBe(1);
      
      // 驗證快取
      const cached = slotStateManager.getCachedState(userId);
      expect(cached).toEqual(dbState);
    });

    test('應該為新用戶創建初始狀態', async () => {
      mockDataService.getDocument.mockResolvedValue(null);
      mockDataService.setDocument.mockResolvedValue();

      // 執行測試
      const result = await slotStateManager.getUserState(userId);

      // 驗證結果
      expect(result.user_id).toBe(userId);
      expect(result.active_task).toBeNull();
      expect(result.settings.language).toBe('zh-TW');
      expect(mockDataService.setDocument).toHaveBeenCalled();
      expect(slotStateManager.stats.stateCreations).toBe(1);
    });

    test('應該為過期狀態創建新狀態', async () => {
      // 準備過期狀態 (2小時前)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const expiredState = {
        user_id: userId,
        created_at: '2025-07-28T08:00:00Z',
        updated_at: twoHoursAgo, // 2小時前，遠早於30分鐘的過期時間
        active_task: null,
        settings: { language: 'zh-TW' }
      };
      
      mockDataService.getDocument.mockResolvedValue(expiredState);
      mockDataService.setDocument.mockResolvedValue();

      // 執行測試
      const result = await slotStateManager.getUserState(userId);

      // 驗證創建了新狀態 (檢查新狀態的時間戳應該是現在)
      expect(new Date(result.created_at).getTime()).toBeGreaterThan(Date.now() - 1000); // 最近1秒內創建
      expect(result.user_id).toBe(userId);
      expect(result.active_task).toBeNull(); // 新狀態應該重置任務
      expect(mockDataService.setDocument).toHaveBeenCalled();
    });
  });

  describe('updateUserState', () => {
    const userId = 'test-user-123';
    const newState = {
      user_id: userId,
      created_at: '2025-07-28T10:00:00Z',
      active_task: { intent: 'record_course' },
      settings: { language: 'zh-TW' }
    };

    test('應該成功更新狀態', async () => {
      mockDataService.setDocument.mockResolvedValue();

      // 執行測試
      const result = await slotStateManager.updateUserState(userId, newState);

      // 驗證結果
      expect(result.updated_at).toBeDefined();
      expect(new Date(result.updated_at).getTime()).toBeGreaterThan(Date.now() - 1000); // 最近1秒內更新
      expect(mockDataService.setDocument).toHaveBeenCalledWith('user_slot_states', userId, result);
      expect(slotStateManager.stats.stateUpdates).toBe(1);
      
      // 驗證快取更新
      const cached = slotStateManager.getCachedState(userId);
      expect(cached).toEqual(result);
    });

    test('應該處理更新失敗的情況', async () => {
      const error = new Error('Database error');
      mockDataService.setDocument.mockRejectedValue(error);

      // 執行測試並驗證錯誤
      await expect(slotStateManager.updateUserState(userId, newState)).rejects.toThrow('Database error');
    });
  });

  describe('createInitialState', () => {
    const userId = 'test-user-123';

    test('應該創建正確的初始狀態', () => {
      const result = slotStateManager.createInitialState(userId);

      expect(result.user_id).toBe(userId);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.active_task).toBeNull();
      expect(result.settings).toEqual({
        language: 'zh-TW',
        timeout_minutes: 30,
        auto_reminder: true
      });
      expect(slotStateManager.stats.stateCreations).toBe(1);
    });
  });

  describe('isStateExpired', () => {
    test('應該判斷未過期的狀態', () => {
      const state = {
        updated_at: new Date().toISOString()
      };

      const result = slotStateManager.isStateExpired(state);
      expect(result).toBe(false);
    });

    test('應該判斷過期的狀態', () => {
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1小時前
      const state = {
        updated_at: oldTime
      };

      const result = slotStateManager.isStateExpired(state);
      expect(result).toBe(true);
    });

    test('應該判斷沒有時間戳的狀態為過期', () => {
      const state = {};

      const result = slotStateManager.isStateExpired(state);
      expect(result).toBe(true);
    });
  });

  describe('快取機制', () => {
    test('應該正確設定和獲取快取', () => {
      const userId = 'test-user-123';
      const state = { user_id: userId, data: 'test' };

      // 設定快取
      slotStateManager.setCachedState(userId, state);
      
      // 獲取快取
      const cached = slotStateManager.getCachedState(userId);
      expect(cached).toEqual(state);
    });

    test('應該在快取過期時返回null', () => {
      const userId = 'test-user-123';
      const state = { user_id: userId, data: 'test' };

      // 設定短暫的快取過期時間
      slotStateManager.configureCacheSettings({ cacheTimeout: 1 });
      slotStateManager.setCachedState(userId, state);

      // 等待快取過期
      setTimeout(() => {
        const cached = slotStateManager.getCachedState(userId);
        expect(cached).toBeNull();
      }, 10);
    });

    test('應該在快取滿時清理最少使用的項目', () => {
      // 設定小的快取大小
      slotStateManager.configureCacheSettings({ maxCacheSize: 2 });

      // 添加快取項目
      slotStateManager.setCachedState('user1', { id: 'user1' });
      slotStateManager.setCachedState('user2', { id: 'user2' });
      
      // 存取 user1 增加其存取次數
      slotStateManager.getCachedState('user1');
      
      // 添加第三個項目，應該清理 user2
      slotStateManager.setCachedState('user3', { id: 'user3' });

      expect(slotStateManager.getCachedState('user1')).toBeTruthy();
      expect(slotStateManager.getCachedState('user2')).toBeNull();
      expect(slotStateManager.getCachedState('user3')).toBeTruthy();
    });
  });

  describe('統計和監控', () => {
    test('應該正確計算快取命中率', () => {
      // 模擬一些快取命中和未命中
      slotStateManager.stats.cacheHits = 8;
      slotStateManager.stats.cacheMisses = 2;

      const stats = slotStateManager.getCacheStats();
      expect(stats.hitRate).toBe(0.8);
    });

    test('應該提供完整的統計資訊', () => {
      const stats = slotStateManager.getCacheStats();
      
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('stateCreations');
      expect(stats).toHaveProperty('stateUpdates');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('memoryUsage');
    });
  });

  describe('cleanupExpiredStates', () => {
    test('應該清理過期狀態', async () => {
      const expiredStates = [
        { user_id: 'user1', updated_at: '2025-07-28T08:00:00Z' },
        { user_id: 'user2', updated_at: '2025-07-28T08:30:00Z' }
      ];

      mockDataService.queryDocuments.mockResolvedValue(expiredStates);
      mockDataService.deleteDocument.mockResolvedValue();

      const cleanedCount = await slotStateManager.cleanupExpiredStates();

      expect(cleanedCount).toBe(2);
      expect(mockDataService.deleteDocument).toHaveBeenCalledTimes(2);
      expect(mockDataService.deleteDocument).toHaveBeenCalledWith('user_slot_states', 'user1');
      expect(mockDataService.deleteDocument).toHaveBeenCalledWith('user_slot_states', 'user2');
    });
  });

  describe('configureCacheSettings', () => {
    test('應該正確更新快取設定', () => {
      const newSettings = {
        maxCacheSize: 500,
        cacheTimeout: 10 * 60 * 1000,
        stateTimeout: 60 * 60 * 1000
      };

      slotStateManager.configureCacheSettings(newSettings);

      expect(slotStateManager.maxCacheSize).toBe(500);
      expect(slotStateManager.cacheTimeout).toBe(10 * 60 * 1000);
      expect(slotStateManager.stateTimeout).toBe(60 * 60 * 1000);
    });
  });
});