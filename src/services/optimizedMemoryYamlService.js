/**
 * OptimizedMemoryYamlService - 優化版 Memory.yaml 服務
 * Phase 5 性能優化實現 - LRU 快取策略
 * 
 * 性能優化特點：
 * - LRU (Least Recently Used) 快取策略
 * - 配置化快取大小和 TTL
 * - 批量更新機制減少 I/O
 * - 記憶體使用監控
 * - 異步寫入優化
 */

const MemoryYamlService = require('./memoryYamlService');
const fs = require('fs').promises;
const path = require('path');

class OptimizedMemoryYamlService extends MemoryYamlService {
  constructor(config = {}) {
    super(config);
    
    // LRU 快取配置
    this.lruCacheSize = config.lruCacheSize || 100;  // 最多快取 100 個用戶
    this.cacheTTL = config.cacheTTL || 300000;       // 5 分鐘 TTL
    this.maxMemoryUsage = config.maxMemoryUsage || 50 * 1024 * 1024; // 50MB
    
    // LRU 快取實現
    this.lruCache = new Map();
    this.cacheAccessOrder = [];
    
    // 批量更新配置
    this.batchUpdateEnabled = config.batchUpdateEnabled !== false;
    this.batchUpdateInterval = config.batchUpdateInterval || 5000; // 5 秒
    this.pendingUpdates = new Map();
    this.batchUpdateTimer = null;
    
    // 性能監控
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      batchUpdates: 0,
      memoryUsage: 0,
      lastOptimization: Date.now()
    };
    
    // 啟動批量更新機制
    if (this.batchUpdateEnabled) {
      this.startBatchUpdateTimer();
    }
    
    console.log('🚀 OptimizedMemoryYamlService 初始化完成');
    console.log(`   LRU 快取大小: ${this.lruCacheSize}`);
    console.log(`   快取 TTL: ${this.cacheTTL}ms`);
    console.log(`   批量更新: ${this.batchUpdateEnabled ? '啟用' : '停用'}`);
    console.log(`   最大記憶體: ${(this.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
  }

  /**
   * 優化版獲取用戶記憶 - 使用 LRU 快取
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} 用戶記憶數據
   */
  async getUserMemory(userId) {
    const startTime = Date.now();
    
    try {
      // 1. 檢查 LRU 快取
      const cached = this.getLRUCache(userId);
      if (cached) {
        this.performanceStats.cacheHits++;
        console.log(`🎯 LRU 快取命中: ${userId} (${Date.now() - startTime}ms)`);
        return cached.memory;
      }
      
      // 2. 快取未命中，從檔案讀取
      this.performanceStats.cacheMisses++;
      const memory = await this.loadYamlFile(userId);
      
      // 3. 更新 LRU 快取
      this.setLRUCache(userId, memory);
      
      console.log(`💾 從檔案讀取並快取: ${userId} (${Date.now() - startTime}ms)`);
      return memory;
      
    } catch (error) {
      console.error(`❌ 優化版獲取用戶記憶失敗:`, error.message);
      // 降級到父類方法
      return await super.getUserMemory(userId);
    }
  }

  /**
   * 優化版更新用戶記憶 - 使用批量更新
   * @param {string} userId 用戶ID
   * @param {Object} updateData 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  async updateUserMemory(userId, updateData) {
    const startTime = Date.now();
    
    try {
      // 1. 從快取獲取最新記憶
      let memory = this.getLRUCache(userId)?.memory;
      if (!memory) {
        memory = await this.loadYamlFile(userId);
      }
      
      // 2. 應用更新（使用父類方法）
      const updatedMemory = await this.processMemoryUpdate(memory, updateData);
      
      // 3. 更新 LRU 快取
      this.setLRUCache(userId, updatedMemory);
      
      // 4. 批量更新或立即寫入
      if (this.batchUpdateEnabled) {
        this.scheduleBatchUpdate(userId, updatedMemory);
        console.log(`📦 已排程批量更新: ${userId} (${Date.now() - startTime}ms)`);
        
        return {
          success: true,
          recordCount: this.getTotalRecords(updatedMemory),
          method: 'batch_update',
          responseTime: Date.now() - startTime
        };
      } else {
        await this.saveYamlFile(userId, updatedMemory);
        console.log(`💾 立即寫入完成: ${userId} (${Date.now() - startTime}ms)`);
        
        return {
          success: true,
          recordCount: this.getTotalRecords(updatedMemory),
          method: 'immediate_update',
          responseTime: Date.now() - startTime
        };
      }
      
    } catch (error) {
      console.error(`❌ 優化版更新用戶記憶失敗:`, error.message);
      // 降級到父類方法
      return await super.updateUserMemory(userId, updateData);
    }
  }

  /**
   * 處理記憶更新（內部方法）
   * @param {Object} memory 現有記憶
   * @param {Object} updateData 更新數據
   * @returns {Promise<Object>} 更新後記憶
   */
  async processMemoryUpdate(memory, updateData) {
    const { student, courseName, schedule, teacher, location, notes } = updateData;
    
    if (!student || !courseName) {
      throw new Error('學生名稱和課程名稱為必填項目');
    }
    
    // 確保記憶結構存在
    if (!memory.students) {
      memory.students = {};
    }
    
    if (!memory.students[student]) {
      memory.students[student] = {
        preferences: {},
        courses: []
      };
    }
    
    // 查找現有課程記錄
    const existingCourseIndex = memory.students[student].courses.findIndex(
      course => course.courseName === courseName
    );
    
    const courseData = {
      courseName,
      schedule: schedule || {},
      teacher,
      location,
      notes,
      lastUpdated: new Date().toISOString(),
      frequency: 1
    };
    
    if (existingCourseIndex >= 0) {
      // 更新現有記錄
      const existingCourse = memory.students[student].courses[existingCourseIndex];
      courseData.frequency = (existingCourse.frequency || 0) + 1;
      memory.students[student].courses[existingCourseIndex] = {
        ...existingCourse,
        ...courseData
      };
      console.log(`🔄 更新現有課程記錄: ${student} - ${courseName} (頻率: ${courseData.frequency})`);
    } else {
      // 新增記錄
      memory.students[student].courses.push(courseData);
      console.log(`➕ 新增課程記錄: ${student} - ${courseName}`);
    }
    
    // 維護記錄數量限制
    if (memory.students[student].courses.length > this.maxRecords) {
      memory.students[student].courses = memory.students[student].courses
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .slice(0, this.maxRecords);
    }
    
    return memory;
  }

  /**
   * LRU 快取獲取
   * @param {string} userId 用戶ID
   * @returns {Object|null} 快取項目
   */
  getLRUCache(userId) {
    const item = this.lruCache.get(userId);
    if (!item) return null;
    
    // 檢查 TTL
    if (Date.now() - item.cacheTimestamp > this.cacheTTL) {
      this.lruCache.delete(userId);
      this.removeFromAccessOrder(userId);
      return null;
    }
    
    // 更新訪問順序
    this.updateAccessOrder(userId);
    return item;
  }

  /**
   * LRU 快取設置
   * @param {string} userId 用戶ID
   * @param {Object} memory 記憶數據
   */
  setLRUCache(userId, memory) {
    // 檢查快取大小限制
    if (this.lruCache.size >= this.lruCacheSize && !this.lruCache.has(userId)) {
      this.evictLRU();
    }
    
    const item = {
      memory,
      cacheTimestamp: Date.now(),
      memorySize: this.estimateMemorySize(memory)
    };
    
    this.lruCache.set(userId, item);
    this.updateAccessOrder(userId);
    this.updateMemoryUsage();
    
    // 檢查記憶體使用量
    if (this.performanceStats.memoryUsage > this.maxMemoryUsage) {
      this.optimizeMemoryUsage();
    }
  }

  /**
   * 更新訪問順序
   * @param {string} userId 用戶ID
   */
  updateAccessOrder(userId) {
    // 移除舊的位置
    this.removeFromAccessOrder(userId);
    // 添加到最前面（最近使用）
    this.cacheAccessOrder.unshift(userId);
  }

  /**
   * 從訪問順序中移除
   * @param {string} userId 用戶ID
   */
  removeFromAccessOrder(userId) {
    const index = this.cacheAccessOrder.indexOf(userId);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
  }

  /**
   * 驅逐最少使用的快取項目
   */
  evictLRU() {
    if (this.cacheAccessOrder.length === 0) return;
    
    const lruUserId = this.cacheAccessOrder.pop();
    this.lruCache.delete(lruUserId);
    
    console.log(`🗑️ LRU 驅逐: ${lruUserId}`);
  }

  /**
   * 優化記憶體使用
   */
  optimizeMemoryUsage() {
    console.log('🧹 開始記憶體優化...');
    
    // 驅逐過期快取項目
    const now = Date.now();
    for (const [userId, item] of this.lruCache.entries()) {
      if (now - item.cacheTimestamp > this.cacheTTL) {
        this.lruCache.delete(userId);
        this.removeFromAccessOrder(userId);
      }
    }
    
    // 如果仍然超過限制，驅逐最少使用的項目
    while (this.performanceStats.memoryUsage > this.maxMemoryUsage && this.lruCache.size > 0) {
      this.evictLRU();
      this.updateMemoryUsage();
    }
    
    this.performanceStats.lastOptimization = Date.now();
    console.log(`🧹 記憶體優化完成: ${(this.performanceStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 排程批量更新
   * @param {string} userId 用戶ID
   * @param {Object} memory 記憶數據
   */
  scheduleBatchUpdate(userId, memory) {
    this.pendingUpdates.set(userId, {
      memory,
      timestamp: Date.now()
    });
    
    // 重新啟動計時器
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    this.startBatchUpdateTimer();
  }

  /**
   * 啟動批量更新計時器
   */
  startBatchUpdateTimer() {
    this.batchUpdateTimer = setTimeout(async () => {
      await this.executeBatchUpdates();
    }, this.batchUpdateInterval);
  }

  /**
   * 執行批量更新
   */
  async executeBatchUpdates() {
    if (this.pendingUpdates.size === 0) return;
    
    const startTime = Date.now();
    const updateCount = this.pendingUpdates.size;
    
    console.log(`📦 開始執行批量更新: ${updateCount} 個用戶`);
    
    const updatePromises = [];
    for (const [userId, updateInfo] of this.pendingUpdates.entries()) {
      updatePromises.push(
        this.saveYamlFile(userId, updateInfo.memory)
          .catch(error => {
            console.error(`❌ 批量更新失敗: ${userId}`, error.message);
          })
      );
    }
    
    try {
      await Promise.all(updatePromises);
      this.performanceStats.batchUpdates++;
      
      console.log(`✅ 批量更新完成: ${updateCount} 個用戶 (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      console.error('❌ 批量更新異常:', error.message);
    } finally {
      this.pendingUpdates.clear();
      this.batchUpdateTimer = null;
    }
  }

  /**
   * 估算記憶體大小
   * @param {Object} memory 記憶數據
   * @returns {number} 估算大小（bytes）
   */
  estimateMemorySize(memory) {
    try {
      return JSON.stringify(memory).length * 2; // 粗略估算（UTF-16）
    } catch (error) {
      return 1024; // 預設 1KB
    }
  }

  /**
   * 更新記憶體使用統計
   */
  updateMemoryUsage() {
    let totalSize = 0;
    for (const item of this.lruCache.values()) {
      totalSize += item.memorySize || 0;
    }
    this.performanceStats.memoryUsage = totalSize;
  }

  /**
   * 獲取性能統計
   * @returns {Object} 性能統計數據
   */
  getPerformanceStats() {
    const now = Date.now();
    const hitRate = this.performanceStats.cacheHits + this.performanceStats.cacheMisses > 0 
      ? (this.performanceStats.cacheHits / (this.performanceStats.cacheHits + this.performanceStats.cacheMisses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.performanceStats,
      cacheSize: this.lruCache.size,
      maxCacheSize: this.lruCacheSize,
      hitRate: `${hitRate}%`,
      memoryUsageMB: (this.performanceStats.memoryUsage / 1024 / 1024).toFixed(2),
      maxMemoryMB: (this.maxMemoryUsage / 1024 / 1024).toFixed(1),
      pendingBatchUpdates: this.pendingUpdates.size,
      timeSinceLastOptimization: now - this.performanceStats.lastOptimization
    };
  }

  /**
   * 獲取服務統計（擴展父類方法）
   * @returns {Object} 服務統計
   */
  getServiceStats() {
    const baseStats = super.getServiceStats();
    const performanceStats = this.getPerformanceStats();
    
    return {
      ...baseStats,
      optimization: {
        lruCacheEnabled: true,
        batchUpdateEnabled: this.batchUpdateEnabled,
        performance: performanceStats
      }
    };
  }

  /**
   * 強制執行所有待處理的批量更新
   */
  async flushPendingUpdates() {
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
      this.batchUpdateTimer = null;
    }
    
    if (this.pendingUpdates.size > 0) {
      await this.executeBatchUpdates();
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    console.log('🧹 清理 OptimizedMemoryYamlService 資源...');
    
    // 強制執行待處理更新
    await this.flushPendingUpdates();
    
    // 清理計時器
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    // 清理快取
    this.lruCache.clear();
    this.cacheAccessOrder.length = 0;
    this.pendingUpdates.clear();
    
    console.log('✅ OptimizedMemoryYamlService 清理完成');
  }
}

module.exports = OptimizedMemoryYamlService;