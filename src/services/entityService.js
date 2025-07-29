/**
 * EntityService - 通用實體服務層（優化版）
 * 職責：提供統一的CRUD操作，從CourseService抽象出通用功能
 * 設計原則：
 * - 場景無關的通用操作
 * - 統一的錯誤處理和驗證
 * - 支援批量操作和複雜查詢
 * 優化特性：
 * - 緩存驗證方案以減少重複映射
 * - 策略性日誌記錄減少冗餘輸出
 * - 統一參數驗證減少重複代碼
 * 依賴：DataService, TimeService
 */
const DataService = require('./dataService');
const TimeService = require('./timeService');

// 🎯 性能優化：Schema 映射緩存
const SCHEMA_CACHE = new Map([
  ['courses', 'course'],
  ['care_sessions', 'generic_entity'],
  ['client_meetings', 'generic_entity']
]);

class EntityService {
  /**
   * 統一參數驗證 - 減少重複驗證代碼
   * @param {string} entityType - 實體類型
   * @param {Object} data - 待驗證數據（可選）
   * @param {string} entityId - 實體ID（可選）
   * @returns {void} 驗證失敗時拋出異常
   * @private
   */
  static _validateParams(entityType, data = null, entityId = null) {
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }
    
    if (data !== null && (typeof data !== 'object' || data === null)) {
      throw new Error('EntityService: data must be an object');
    }
    
    if (entityId !== null && !entityId) {
      throw new Error('EntityService: entityId is required when provided');
    }
  }

  /**
   * 獲取實體驗證方案 - 使用緩存避免重複映射
   * @param {string} entityType - 實體類型
   * @returns {string} 驗證方案名稱
   * @private
   */
  static _getValidationSchema(entityType) {
    return SCHEMA_CACHE.get(entityType) || 'generic_entity';
  }

  /**
   * 策略性日誌記錄 - 只在關鍵節點記錄
   * @param {string} level - 日誌級別 (debug|info|error)
   * @param {string} operation - 操作類型
   * @param {string} entityType - 實體類型
   * @param {string} message - 消息
   * @param {Object} data - 額外數據（可選）
   * @private
   */
  static _log(level, operation, entityType, message, data = null) {
    const prefix = {
      debug: '🔧',
      info: '✅', 
      error: '❌'
    }[level] || '📝';
    
    const baseMessage = `${prefix} [EntityService] ${operation} ${entityType}: ${message}`;
    
    if (level === 'error') {
      console.error(baseMessage, data || '');
    } else if (level === 'info') {
      console.log(baseMessage);
    }
    // debug 級別在生產環境中靜默，減少日誌噪音
  }
  /**
   * 創建實體
   * @param {string} entityType - 實體類型（資料庫集合名稱）
   * @param {Object} entityData - 實體數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createEntity(entityType, entityData) {
    // 🎯 優化：統一參數驗證，減少重複代碼
    this._validateParams(entityType, entityData);

    try {
      // 添加系統欄位
      const currentTime = TimeService.getCurrentUserTime().toISOString();
      const enrichedData = {
        ...entityData,
        created_at: currentTime,
        updated_at: currentTime
      };

      // 🎯 優化：使用緩存的驗證方案，避免 switch 語句
      const schema = this._getValidationSchema(entityType);
      const isValid = await DataService.validateData(enrichedData, schema);
      if (!isValid) {
        throw new Error('EntityService: Invalid entity data format');
      }

      // 委託給DataService執行創建
      const result = await DataService.createDocument(entityType, enrichedData);
      
      // 🎯 優化：策略性日誌記錄，只記錄成功信息
      this._log('info', 'create', entityType, 'Success');
      return result;

    } catch (error) {
      this._log('error', 'create', entityType, 'Failed', error.message);
      throw new Error(`EntityService: Failed to create ${entityType}: ${error.message}`);
    }
  }

  /**
   * 更新實體
   * @param {string} entityType - 實體類型
   * @param {string} entityId - 實體ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  static async updateEntity(entityType, entityId, updateData) {
    // 🎯 優化：統一參數驗證
    this._validateParams(entityType, updateData, entityId);
    
    if (Object.keys(updateData).length === 0) {
      throw new Error('EntityService: updateData must be a non-empty object');
    }

    try {
      // 添加更新時間戳
      const enrichedUpdateData = {
        ...updateData,
        updated_at: TimeService.getCurrentUserTime().toISOString()
      };

      // 委託給DataService執行更新
      const result = await DataService.updateDocument(entityType, entityId, enrichedUpdateData);
      
      // 🎯 優化：策略性日誌記錄
      this._log('info', 'update', entityType, `ID ${entityId} - Success`);
      return result;

    } catch (error) {
      this._log('error', 'update', entityType, `ID ${entityId} - Failed`, error.message);
      throw new Error(`EntityService: Failed to update ${entityType}: ${error.message}`);
    }
  }

  /**
   * 查詢實體
   * @param {string} entityType - 實體類型
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  static async queryEntities(entityType, criteria = {}) {
    // 🎯 優化：統一參數驗證
    this._validateParams(entityType);

    try {
      // 委託給DataService執行查詢
      const results = await DataService.queryDocuments(entityType, criteria);
      
      // 🎯 優化：只在找到記錄時記錄日誌，減少噪音
      if (results.length > 0) {
        this._log('info', 'query', entityType, `Found ${results.length} records`);
      }
      return results;

    } catch (error) {
      this._log('error', 'query', entityType, 'Failed', error.message);
      throw new Error(`EntityService: Failed to query ${entityType}: ${error.message}`);
    }
  }

  /**
   * 刪除單個實體
   * @param {string} entityType - 實體類型
   * @param {string} entityId - 實體ID
   * @returns {Promise<boolean>} 刪除結果
   */
  static async deleteEntity(entityType, entityId) {
    // 🎯 優化：統一參數驗證
    this._validateParams(entityType, null, entityId);

    try {
      // 委託給DataService執行刪除
      const result = await DataService.deleteDocument(entityType, entityId);
      
      // 🎯 優化：策略性日誌記錄
      this._log('info', 'delete', entityType, `ID ${entityId} - Success`);
      return result;

    } catch (error) {
      this._log('error', 'delete', entityType, `ID ${entityId} - Failed`, error.message);
      throw new Error(`EntityService: Failed to delete ${entityType}: ${error.message}`);
    }
  }

  /**
   * 批量刪除用戶的所有實體
   * @param {string} entityType - 實體類型
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 批量刪除結果
   */
  static async clearUserEntities(entityType, userId) {
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }

    if (!userId) {
      throw new Error('EntityService: userId is required');
    }

    try {
      // 查詢用戶的所有實體
      const entities = await this.queryEntities(entityType, { 
        student_id: userId  // 保持與現有資料庫欄位兼容
      });

      if (entities.length === 0) {
        this._log('info', 'clear', entityType, `No records found for user ${userId}`);
        return {
          success: true,
          totalCount: 0,
          deletedCount: 0,
          errors: []
        };
      }

      // 🎯 優化：批量操作只在數量較大時記錄日誌
      if (entities.length > 5) {
        this._log('info', 'clear', entityType, `Processing ${entities.length} records for user ${userId}`);
      }

      // 批量刪除
      const deletePromises = entities.map(entity => 
        this.deleteEntity(entityType, entity.id).catch(error => ({
          error: true,
          entityId: entity.id,
          message: error.message
        }))
      );

      const results = await Promise.allSettled(deletePromises);
      
      // 統計結果
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value !== false && !r.value.error
      ).length;
      
      const errors = results
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
        .map(r => r.status === 'rejected' ? r.reason : r.value);

      const clearResult = {
        success: successCount === entities.length,
        totalCount: entities.length,
        deletedCount: successCount,
        errors
      };

      // 🎯 優化：策略性日誌記錄清理結果
      this._log('info', 'clear', entityType, `Completed: ${clearResult.deletedCount}/${clearResult.totalCount} deleted`);
      return clearResult;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to clear ${entityType} for user ${userId}:`, error.message);
      throw new Error(`EntityService: Failed to clear ${entityType}: ${error.message}`);
    }
  }

  /**
   * 獲取用戶實體統計
   * @param {string} entityType - 實體類型
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 統計數據
   */
  static async getUserEntityStats(entityType, userId) {
    if (!entityType || !userId) {
      throw new Error('EntityService: entityType and userId are required');
    }

    try {
      const allEntities = await this.queryEntities(entityType, { student_id: userId });

      const stats = {
        total: allEntities.length,
        by_status: {}
      };

      // 按狀態分組統計
      allEntities.forEach(entity => {
        const status = entity.status || 'unknown';
        stats.by_status[status] = (stats.by_status[status] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to get stats for ${entityType}:`, error.message);
      throw error;
    }
  }

  /**
   * 檢查時間衝突（通用邏輯）
   * @param {string} entityType - 實體類型
   * @param {string} userId - 用戶ID
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @param {string} time - 時間描述
   * @param {string} excludeId - 要排除的實體ID（用於修改時檢查）
   * @returns {Promise<Array>} 衝突的實體列表
   */
  static async checkTimeConflicts(entityType, userId, date, time, excludeId = null) {
    if (!entityType || !userId || !date || !time) {
      throw new Error('EntityService: entityType, userId, date, and time are required');
    }

    try {
      // 並行查詢一般課程和重複課程
      const [regularConflicts, recurringCourses] = await Promise.all([
        // 查詢同一天同一時間的一般課程
        this.queryEntities(entityType, {
          student_id: userId,
          course_date: date,
          schedule_time: time,
          status: 'scheduled',
          is_recurring: false
        }),
        // 查詢所有用戶的重複課程模板
        this.queryEntities(entityType, {
          student_id: userId,
          status: 'scheduled',
          is_recurring: true
        })
      ]);

      // 檢查重複課程在指定日期的衝突
      const RecurringCourseCalculator = require('../utils/RecurringCourseCalculator');
      const recurringConflicts = RecurringCourseCalculator.checkDateConflicts(
        userId, 
        date, 
        time, 
        recurringCourses
      );

      // 合併所有衝突
      let allConflicts = [...regularConflicts];
      
      // 轉換重複課程衝突格式以保持一致性
      for (const recurringConflict of recurringConflicts) {
        allConflicts.push({
          id: recurringConflict.course_id,
          course_name: recurringConflict.course_name,
          course_date: recurringConflict.date,
          schedule_time: recurringConflict.time,
          conflict_type: 'recurring',
          conflict_source: 'recurring_pattern'
        });
      }

      // 排除指定的實體（用於修改場景）
      const filteredConflicts = excludeId 
        ? allConflicts.filter(entity => entity.id !== excludeId)
        : allConflicts;

      // 日誌記錄
      if (filteredConflicts.length > 0) {
        const regularCount = filteredConflicts.filter(c => c.conflict_type !== 'recurring').length;
        const recurringCount = filteredConflicts.filter(c => c.conflict_type === 'recurring').length;
        this._log('warn', 'conflict', entityType, 
          `Found ${filteredConflicts.length} conflicts on ${date} at ${time} (${regularCount} regular, ${recurringCount} recurring)`);
      }
      
      return filteredConflicts;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to check time conflicts:`, error.message);
      throw error;
    }
  }

  /**
   * 按條件查詢實體（支援複雜條件）
   * @param {string} entityType - 實體類型
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  static async queryEntitiesWithFilters(entityType, criteria) {
    try {
      // 處理特殊查詢條件
      const processedCriteria = this.processCriteria(criteria);
      
      return await this.queryEntities(entityType, processedCriteria);

    } catch (error) {
      console.error(`❌ [EntityService] Failed to query with filters:`, error.message);
      throw error;
    }
  }

  /**
   * 處理查詢條件（私有方法）
   * @param {Object} criteria - 原始查詢條件
   * @returns {Object} 處理後的查詢條件
   * @private
   */
  static processCriteria(criteria) {
    const processed = { ...criteria };

    // 處理日期範圍查詢
    if (processed.date_range) {
      const { start, end } = processed.date_range;
      // 這裡可以根據DataService的查詢能力進一步處理
      // 暫時保持原樣，由DataService處理
      processed.course_date = processed.date_range;
      delete processed.date_range;
    }

    return processed;
  }

  /**
   * 驗證實體數據格式
   * @param {string} entityType - 實體類型
   * @param {Object} entityData - 實體數據
   * @returns {Object} 驗證結果 { isValid, errors }
   */
  static async validateEntityData(entityType, entityData) {
    if (!entityType || !entityData) {
      return {
        isValid: false,
        errors: ['entityType and entityData are required']
      };
    }

    try {
      // 基本類型驗證
      if (typeof entityData !== 'object') {
        return {
          isValid: false,
          errors: ['entityData must be an object']
        };
      }

      // 🎯 優化：使用緩存的驗證方案
      const schema = this._getValidationSchema(entityType) || 'entity';
      const isValid = await DataService.validateData(entityData, schema);
      
      return {
        isValid,
        errors: isValid ? [] : ['Data validation failed']
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * 獲取實體詳細信息
   * @param {string} entityType - 實體類型
   * @param {string} entityId - 實體ID
   * @returns {Promise<Object|null>} 實體詳細信息
   */
  static async getEntityById(entityType, entityId) {
    if (!entityType || !entityId) {
      throw new Error('EntityService: entityType and entityId are required');
    }

    try {
      // 使用DataService獲取單個文檔
      return await DataService.getDocumentById(entityType, entityId);

    } catch (error) {
      console.error(`❌ [EntityService] Failed to get ${entityType} by ID:`, error.message);
      throw error;
    }
  }
}

module.exports = EntityService;