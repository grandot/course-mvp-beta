/**
 * EntityService - 通用實體服務層
 * 職責：提供統一的CRUD操作，從CourseService抽象出通用功能
 * 設計原則：
 * - 場景無關的通用操作
 * - 統一的錯誤處理和驗證
 * - 支援批量操作和複雜查詢
 * 依賴：DataService, TimeService
 */
const DataService = require('./dataService');
const TimeService = require('./timeService');

class EntityService {
  /**
   * 創建實體
   * @param {string} entityType - 實體類型（資料庫集合名稱）
   * @param {Object} entityData - 實體數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createEntity(entityType, entityData) {
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }

    if (!entityData || typeof entityData !== 'object') {
      throw new Error('EntityService: entityData must be an object');
    }

    console.log(`🔧 [EntityService] Creating ${entityType}:`, JSON.stringify(entityData, null, 2));

    try {
      // 添加系統欄位
      const enrichedData = {
        ...entityData,
        created_at: TimeService.getCurrentUserTime().toISOString(),
        updated_at: TimeService.getCurrentUserTime().toISOString()
      };

      // 驗證數據格式 - 根據實體類型進行驗證
      let schema;
      switch (entityType) {
        case 'courses':
          schema = 'course';
          break;
        case 'care_sessions':
        case 'client_meetings':
          schema = 'generic_entity';
          break;
        default:
          schema = 'generic_entity';
      }
      
      const isValid = await DataService.validateData(enrichedData, schema);
      if (!isValid) {
        throw new Error('EntityService: Invalid entity data format');
      }

      // 委託給DataService執行創建
      const result = await DataService.createDocument(entityType, enrichedData);
      
      console.log(`✅ [EntityService] Successfully created ${entityType}:`, result.success);
      return result;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to create ${entityType}:`, error.message);
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
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }

    if (!entityId) {
      throw new Error('EntityService: entityId is required');
    }

    if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
      throw new Error('EntityService: updateData must be a non-empty object');
    }

    console.log(`🔧 [EntityService] Updating ${entityType} ${entityId}:`, JSON.stringify(updateData, null, 2));

    try {
      // 添加更新時間戳
      const enrichedUpdateData = {
        ...updateData,
        updated_at: TimeService.getCurrentUserTime().toISOString()
      };

      // 委託給DataService執行更新
      const result = await DataService.updateDocument(entityType, entityId, enrichedUpdateData);
      
      console.log(`✅ [EntityService] Successfully updated ${entityType} ${entityId}:`, result.success);
      return result;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to update ${entityType} ${entityId}:`, error.message);
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
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }

    console.log(`🔧 [EntityService] Querying ${entityType} with criteria:`, JSON.stringify(criteria, null, 2));

    try {
      // 委託給DataService執行查詢
      const results = await DataService.queryDocuments(entityType, criteria);
      
      console.log(`✅ [EntityService] Successfully queried ${entityType}, found ${results.length} records`);
      return results;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to query ${entityType}:`, error.message);
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
    if (!entityType || typeof entityType !== 'string') {
      throw new Error('EntityService: entityType must be a non-empty string');
    }

    if (!entityId) {
      throw new Error('EntityService: entityId is required');
    }

    console.log(`🔧 [EntityService] Deleting ${entityType} ${entityId}`);

    try {
      // 委託給DataService執行刪除
      const result = await DataService.deleteDocument(entityType, entityId);
      
      console.log(`✅ [EntityService] Successfully deleted ${entityType} ${entityId}`);
      return result;

    } catch (error) {
      console.error(`❌ [EntityService] Failed to delete ${entityType} ${entityId}:`, error.message);
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

    console.log(`🔧 [EntityService] Clearing all ${entityType} for user ${userId}`);

    try {
      // 查詢用戶的所有實體
      const entities = await this.queryEntities(entityType, { 
        student_id: userId  // 保持與現有資料庫欄位兼容
      });

      if (entities.length === 0) {
        console.log(`✅ [EntityService] No ${entityType} found for user ${userId}`);
        return {
          success: true,
          totalCount: 0,
          deletedCount: 0,
          errors: []
        };
      }

      console.log(`🔧 [EntityService] Found ${entities.length} ${entityType} to delete for user ${userId}`);

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

      console.log(`✅ [EntityService] Clear ${entityType} completed:`, clearResult);
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

    console.log(`🔧 [EntityService] Checking time conflicts for ${entityType}: ${date} ${time} (exclude: ${excludeId})`);

    try {
      // 查詢同一天同一時間的實體
      const conflicts = await this.queryEntities(entityType, {
        student_id: userId,
        course_date: date,        // 保持與現有資料庫欄位兼容
        schedule_time: time,      // 保持與現有資料庫欄位兼容
        status: 'scheduled'
      });

      // 排除指定的實體（用於修改場景）
      const filteredConflicts = excludeId 
        ? conflicts.filter(entity => entity.id !== excludeId)
        : conflicts;

      console.log(`✅ [EntityService] Found ${filteredConflicts.length} time conflicts`);
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

      // 使用DataService的驗證邏輯
      const isValid = await DataService.validateData(entityData, 'entity');
      
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