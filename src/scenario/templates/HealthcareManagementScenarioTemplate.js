/**
 * HealthcareManagementScenarioTemplate - 長照系統場景具體實現
 * 職責：實現長照服務管理的具體業務邏輯
 * 繼承：ScenarioTemplate抽象基類
 * 依賴：EntityService, TimeService
 */

const ScenarioTemplate = require('../ScenarioTemplate');
const EntityService = require('../../services/entityService');
const TimeService = require('../../services/timeService');

class HealthcareManagementScenarioTemplate extends ScenarioTemplate {
  /**
   * 創建照護服務
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID（照護者ID）
   * @returns {Promise<Object>} 創建結果
   */
  async createEntity(entities, userId) {
    this.log('info', 'Creating healthcare service', { userId, entities });

    try {
      const { client_name, care_type, timeInfo, caregiver, location, notes } = entities;

      // 驗證必要欄位
      const validation = this.validateRequiredFields(entities);
      if (!validation.isValid) {
        if (validation.missingFields.includes('client_name')) {
          return this.createErrorResponse(
            'Missing client name',
            this.formatConfigMessage('create_missing_name')
          );
        }
        if (validation.missingFields.includes('timeInfo')) {
          return this.createErrorResponse(
            'Missing time information',
            this.formatConfigMessage('create_missing_time')
          );
        }
      }

      // 推斷照護類型（如果未提供）
      const inferredCareType = care_type || this.inferCareType(entities);
      if (!inferredCareType) {
        return this.createErrorResponse(
          'Missing care type',
          '請指定照護類型，例如：「復健治療」、「生活照護」等'
        );
      }

      // 驗證時間格式
      if (timeInfo && !TimeService.validateTimeInfo(timeInfo)) {
        return this.createErrorResponse(
          'Invalid time information',
          this.formatConfigMessage('create_invalid_time')
        );
      }

      // 檢查照護者時間衝突（長照特有邏輯）
      if (this.config.validation_rules?.time_conflict_check && timeInfo) {
        const conflicts = await this.checkCaregiverConflicts(
          userId, 
          timeInfo.date, 
          timeInfo.display,
          caregiver
        );
        
        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict',
            this.formatConfigMessage('create_time_conflict')
          );
        }
      }

      // 構建照護服務數據
      const serviceData = this.buildCareServiceData(
        userId, 
        client_name, 
        inferredCareType, 
        timeInfo, 
        caregiver, 
        location, 
        notes
      );
      
      // 使用EntityService創建服務
      const result = await EntityService.createEntity(this.entityType, serviceData);
      
      if (!result.success) {
        return this.createErrorResponse(
          'Create failed',
          this.formatConfigMessage('create_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Care service created successfully', { 
        serviceId: result.data?.id,
        clientName: client_name,
        careType: inferredCareType
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('create_success', { 
          client_name, 
          care_type: inferredCareType 
        }),
        { service: result.data }
      );

    } catch (error) {
      this.log('error', 'Failed to create care service', { error: error.message });
      return this.createErrorResponse(
        'Create error',
        this.formatConfigMessage('create_error')
      );
    }
  }

  /**
   * 修改照護服務
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   */
  async modifyEntity(entities, userId) {
    this.log('info', 'Modifying care service', { userId, entities });

    try {
      const { client_name, timeInfo, caregiver, location, notes } = entities;
      
      if (!client_name) {
        return this.createErrorResponse(
          'Missing client name',
          this.formatConfigMessage('modify_missing_name')
        );
      }

      // 查找要修改的照護服務
      const existingServices = await EntityService.queryEntities(this.entityType, {
        caregiver_id: userId,
        client_name,
        status: 'scheduled'
      });

      if (existingServices.length === 0) {
        return this.createErrorResponse(
          'Service not found',
          this.formatConfigMessage('modify_not_found', { client_name })
        );
      }

      const serviceToModify = existingServices[0];

      // 構建更新數據
      const { updateData, modifiedFields } = this.buildCareUpdateData(
        timeInfo, caregiver, location, notes
      );

      if (modifiedFields.length === 0) {
        return this.createErrorResponse(
          'No update fields provided',
          this.formatConfigMessage('modify_no_fields')
        );
      }

      // 檢查照護者衝突（如果修改了時間或照護者）
      if (timeInfo && this.config.validation_rules?.time_conflict_check) {
        if (!TimeService.validateTimeInfo(timeInfo)) {
          return this.createErrorResponse(
            'Invalid time information',
            this.formatConfigMessage('modify_invalid_time')
          );
        }

        const conflicts = await this.checkCaregiverConflicts(
          userId,
          timeInfo.date,
          timeInfo.display,
          updateData.caregiver || serviceToModify.caregiver,
          serviceToModify.id
        );

        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict detected',
            this.formatConfigMessage('modify_time_conflict', {
              service_date: timeInfo.date,
              service_time: timeInfo.display
            })
          );
        }
      }

      // 執行更新
      const result = await EntityService.updateEntity(this.entityType, serviceToModify.id, updateData);

      if (!result.success) {
        return this.createErrorResponse(
          'Update failed',
          this.formatConfigMessage('modify_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Care service modified successfully', { 
        serviceId: serviceToModify.id, 
        modifiedFields 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('modify_success', {
          client_name,
          care_type: serviceToModify.care_type
        }),
        {
          modifiedFields,
          originalService: serviceToModify,
          updatedService: result.data
        }
      );

    } catch (error) {
      this.log('error', 'Failed to modify care service', { error: error.message });
      return this.createErrorResponse(
        'Modify error',
        this.formatConfigMessage('modify_error')
      );
    }
  }

  /**
   * 取消照護服務
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelEntity(entities, userId) {
    this.log('info', 'Cancelling care service', { userId, entities });

    try {
      const { client_name } = entities;
      
      if (!client_name) {
        return this.createErrorResponse(
          'Missing client name',
          this.formatConfigMessage('cancel_missing_name')
        );
      }

      // 查找要取消的照護服務
      const services = await EntityService.queryEntities(this.entityType, {
        caregiver_id: userId,
        client_name,
        status: 'scheduled'
      });

      if (services.length === 0) {
        return this.createErrorResponse(
          'Service not found',
          this.formatConfigMessage('cancel_not_found', { client_name })
        );
      }

      const serviceToCancel = services[0];

      // 執行取消（軟刪除，因為長照記錄很重要）
      const result = await EntityService.updateEntity(this.entityType, serviceToCancel.id, {
        status: 'cancelled',
        cancelled_at: TimeService.getCurrentUserTime().toISOString(),
        cancelled_reason: 'User requested cancellation'
      });

      if (!result.success) {
        return this.createErrorResponse(
          'Cancel failed',
          this.formatConfigMessage('cancel_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Care service cancelled successfully', { 
        serviceId: serviceToCancel.id,
        clientName: client_name
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('cancel_success', { 
          client_name,
          care_type: serviceToCancel.care_type 
        }),
        { cancelledService: serviceToCancel }
      );

    } catch (error) {
      this.log('error', 'Failed to cancel care service', { error: error.message });
      return this.createErrorResponse(
        'Cancel error',
        this.formatConfigMessage('cancel_error')
      );
    }
  }

  /**
   * 查詢照護服務
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 查詢結果
   */
  async queryEntities(userId) {
    this.log('info', 'Querying care services', { userId });

    try {
      const services = await EntityService.queryEntities(this.entityType, {
        caregiver_id: userId,
        status: 'scheduled'
      });

      this.log('info', 'Care services queried successfully', { count: services.length });

      return this.createSuccessResponse(
        services.length === 0 ? this.formatConfigMessage('query_empty') : null,
        { 
          services,
          count: services.length
        }
      );

    } catch (error) {
      this.log('error', 'Failed to query care services', { error: error.message });
      return this.createErrorResponse(
        'Query error',
        this.formatConfigMessage('query_error')
      );
    }
  }

  /**
   * 清空照護服務（受限制，因為涉及重要記錄）
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 清空結果
   */
  async clearAllEntities(entities, userId) {
    this.log('info', 'Clearing all care services', { userId, entities });

    try {
      const { confirmation } = entities;
      const isConfirmation = confirmation === '確認清空' || confirmation === '確認';

      if (!isConfirmation) {
        const services = await EntityService.queryEntities(this.entityType, {
          caregiver_id: userId
        });
        
        if (services.length === 0) {
          return this.createSuccessResponse(
            this.formatConfigMessage('clear_empty'),
            { 
              action: 'clear_check',
              serviceCount: 0
            }
          );
        }

        return {
          success: false,
          action: 'clear_confirmation_required',
          requiresConfirmation: true,
          message: this.formatConfigMessage('clear_warning', { count: services.length }),
          serviceCount: services.length,
          expiresIn: '5分鐘'
        };
      }

      // 長照系統：只標記為已清空，不實際刪除重要記錄
      const services = await EntityService.queryEntities(this.entityType, {
        caregiver_id: userId,
        status: 'scheduled'
      });

      let processedCount = 0;
      for (const service of services) {
        try {
          await EntityService.updateEntity(this.entityType, service.id, {
            status: 'archived',
            archived_at: TimeService.getCurrentUserTime().toISOString(),
            archived_reason: 'Bulk archive by user'
          });
          processedCount++;
        } catch (error) {
          this.log('error', 'Failed to archive service', { 
            serviceId: service.id, 
            error: error.message 
          });
        }
      }

      this.log('info', 'Care services archived', { 
        totalCount: services.length,
        processedCount 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('clear_success', { count: processedCount }),
        {
          action: 'clear_executed',
          archivedCount: processedCount,
          totalCount: services.length
        }
      );

    } catch (error) {
      this.log('error', 'Failed to clear care services', { error: error.message });
      return this.createErrorResponse(
        'Clear error',
        this.formatConfigMessage('clear_error')
      );
    }
  }

  // ==================== 長照特有的私有方法 ====================

  /**
   * 推斷照護類型
   * @param {Object} entities - 實體信息
   * @returns {string|null} 推斷的照護類型
   * @private
   */
  inferCareType(entities) {
    const { course_name } = entities; // 可能從課程名稱推斷
    
    const careTypeMapping = {
      '復健': '復健治療',
      '物理治療': '復健治療',
      '陪伴': '陪伴服務',
      '照護': '生活照護',
      '醫療': '醫療協助',
      '家事': '家事協助'
    };

    if (course_name) {
      for (const [keyword, careType] of Object.entries(careTypeMapping)) {
        if (course_name.includes(keyword)) {
          return careType;
        }
      }
    }

    return this.config.healthcare_specific?.defaults?.care_type || null;
  }

  /**
   * 檢查照護者時間衝突
   * @param {string} userId - 用戶ID
   * @param {string} date - 日期
   * @param {string} time - 時間
   * @param {string} caregiver - 照護者
   * @param {string} excludeId - 要排除的服務ID
   * @returns {Promise<Array>} 衝突列表
   * @private
   */
  async checkCaregiverConflicts(userId, date, time, caregiver, excludeId = null) {
    const criteria = {
      caregiver_id: userId,
      service_date: date,
      service_time: time,
      status: 'scheduled'
    };

    // 如果指定了照護者，也要檢查該照護者的衝突
    if (caregiver) {
      criteria.caregiver = caregiver;
    }

    const conflicts = await EntityService.queryEntities(this.entityType, criteria);
    return excludeId ? conflicts.filter(s => s.id !== excludeId) : conflicts;
  }

  /**
   * 構建照護服務數據
   * @private
   */
  buildCareServiceData(userId, clientName, careType, timeInfo, caregiver, location, notes) {
    const defaults = this.config.healthcare_specific?.defaults || {};
    
    return {
      caregiver_id: userId,
      client_name: clientName,
      care_type: careType,
      service_time: timeInfo?.display || 'TBD',
      service_date: timeInfo?.date || null,
      caregiver: caregiver || defaults.caregiver || null,
      location: location || defaults.location || '居家',
      notes: notes || null,
      status: defaults.status || 'scheduled',
      urgency: defaults.urgency || 'normal'
    };
  }

  /**
   * 構建照護更新數據
   * @private
   */
  buildCareUpdateData(timeInfo, caregiver, location, notes) {
    const updateData = {};
    const modifiedFields = [];
    const allowedFields = this.config.business_rules?.modify?.allowed_fields || [];

    if (timeInfo && TimeService.validateTimeInfo(timeInfo)) {
      if (allowedFields.includes('service_time')) {
        updateData.service_time = timeInfo.display;
        modifiedFields.push('時間');
      }
      if (allowedFields.includes('service_date')) {
        updateData.service_date = timeInfo.date;
        if (!modifiedFields.includes('時間')) {
          modifiedFields.push('日期');
        }
      }
    }

    if (caregiver && allowedFields.includes('caregiver')) {
      updateData.caregiver = caregiver;
      modifiedFields.push('照護者');
    }

    if (location && allowedFields.includes('location')) {
      updateData.location = location;
      modifiedFields.push('地點');
    }

    if (notes && allowedFields.includes('notes')) {
      updateData.notes = notes;
      modifiedFields.push('備註');
    }

    return { updateData, modifiedFields };
  }
}

module.exports = HealthcareManagementScenarioTemplate;