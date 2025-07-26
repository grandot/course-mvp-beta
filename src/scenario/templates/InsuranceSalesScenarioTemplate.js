/**
 * InsuranceSalesScenarioTemplate - 保險業務員成交管理場景具體實現
 * 職責：實現保險業務會議管理的具體業務邏輯
 * 繼承：ScenarioTemplate抽象基類
 * 依賴：EntityService, TimeService
 */

const ScenarioTemplate = require('../ScenarioTemplate');
const EntityService = require('../../services/entityService');
const TimeService = require('../../services/timeService');

class InsuranceSalesScenarioTemplate extends ScenarioTemplate {
  /**
   * 創建客戶會議
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID（業務員ID）
   * @returns {Promise<Object>} 創建結果
   */
  async createEntity(entities, userId) {
    this.log('info', 'Creating client meeting', { userId, entities });

    try {
      const { client_name, meeting_type, timeInfo, product_type, location, notes, expected_value } = entities;

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

      // 推斷會議類型（如果未提供）
      const inferredMeetingType = meeting_type || this.inferMeetingType(entities);
      if (!inferredMeetingType) {
        return this.createErrorResponse(
          'Missing meeting type',
          '請指定會議類型，例如：「初次拜訪」、「產品介紹」等'
        );
      }

      // 驗證時間格式
      if (timeInfo && !TimeService.validateTimeInfo(timeInfo)) {
        return this.createErrorResponse(
          'Invalid time information',
          this.formatConfigMessage('create_invalid_time')
        );
      }

      // 驗證預期成交金額（如果提供）
      if (expected_value && !this.validateExpectedValue(expected_value)) {
        return this.createErrorResponse(
          'Invalid expected value',
          '預期成交金額格式不正確，請輸入數字'
        );
      }

      // 檢查業務員時間衝突
      if (this.config.validation_rules?.time_conflict_check && timeInfo) {
        const conflicts = await EntityService.checkTimeConflicts(
          this.entityType, 
          userId, 
          timeInfo.date, 
          timeInfo.display
        );
        
        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict',
            this.formatConfigMessage('create_time_conflict')
          );
        }
      }

      // 構建會議數據
      const meetingData = this.buildMeetingData(
        userId, 
        client_name, 
        inferredMeetingType, 
        timeInfo, 
        product_type, 
        location, 
        notes,
        expected_value
      );
      
      // 使用EntityService創建會議
      const result = await EntityService.createEntity(this.entityType, meetingData);
      
      if (!result.success) {
        return this.createErrorResponse(
          'Create failed',
          this.formatConfigMessage('create_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Client meeting created successfully', { 
        meetingId: result.data?.id,
        clientName: client_name,
        meetingType: inferredMeetingType
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('create_success', { 
          client_name, 
          meeting_type: inferredMeetingType 
        }),
        { meeting: result.data }
      );

    } catch (error) {
      this.log('error', 'Failed to create client meeting', { error: error.message });
      return this.createErrorResponse(
        'Create error',
        this.formatConfigMessage('create_error')
      );
    }
  }

  /**
   * 修改客戶會議
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   */
  async modifyEntity(entities, userId) {
    this.log('info', 'Modifying client meeting', { userId, entities });

    try {
      const { client_name, timeInfo, product_type, location, notes, expected_value } = entities;
      
      if (!client_name) {
        return this.createErrorResponse(
          'Missing client name',
          this.formatConfigMessage('modify_missing_name')
        );
      }

      // 查找要修改的會議
      const existingMeetings = await EntityService.queryEntities(this.entityType, {
        sales_agent_id: userId,
        client_name,
        status: 'scheduled'
      });

      if (existingMeetings.length === 0) {
        return this.createErrorResponse(
          'Meeting not found',
          this.formatConfigMessage('modify_not_found', { client_name })
        );
      }

      const meetingToModify = existingMeetings[0];

      // 構建更新數據
      const { updateData, modifiedFields } = this.buildMeetingUpdateData(
        timeInfo, product_type, location, notes, expected_value
      );

      if (modifiedFields.length === 0) {
        return this.createErrorResponse(
          'No update fields provided',
          this.formatConfigMessage('modify_no_fields')
        );
      }

      // 檢查時間衝突（如果修改了時間）
      if (timeInfo && this.config.validation_rules?.time_conflict_check) {
        if (!TimeService.validateTimeInfo(timeInfo)) {
          return this.createErrorResponse(
            'Invalid time information',
            this.formatConfigMessage('modify_invalid_time')
          );
        }

        const conflicts = await EntityService.checkTimeConflicts(
          this.entityType,
          userId,
          timeInfo.date,
          timeInfo.display,
          meetingToModify.id
        );

        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict detected',
            this.formatConfigMessage('modify_time_conflict', {
              meeting_date: timeInfo.date,
              meeting_time: timeInfo.display
            })
          );
        }
      }

      // 執行更新
      const result = await EntityService.updateEntity(this.entityType, meetingToModify.id, updateData);

      if (!result.success) {
        return this.createErrorResponse(
          'Update failed',
          this.formatConfigMessage('modify_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Client meeting modified successfully', { 
        meetingId: meetingToModify.id, 
        modifiedFields 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('modify_success', {
          client_name,
          meeting_type: meetingToModify.meeting_type
        }),
        {
          modifiedFields,
          originalMeeting: meetingToModify,
          updatedMeeting: result.data
        }
      );

    } catch (error) {
      this.log('error', 'Failed to modify client meeting', { error: error.message });
      return this.createErrorResponse(
        'Modify error',
        this.formatConfigMessage('modify_error')
      );
    }
  }

  /**
   * 取消客戶會議
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelEntity(entities, userId) {
    this.log('info', 'Cancelling client meeting', { userId, entities });

    try {
      const { client_name } = entities;
      
      if (!client_name) {
        return this.createErrorResponse(
          'Missing client name',
          this.formatConfigMessage('cancel_missing_name')
        );
      }

      // 查找要取消的會議
      const meetings = await EntityService.queryEntities(this.entityType, {
        sales_agent_id: userId,
        client_name,
        status: 'scheduled'
      });

      if (meetings.length === 0) {
        return this.createErrorResponse(
          'Meeting not found',
          this.formatConfigMessage('cancel_not_found', { client_name })
        );
      }

      const meetingToCancel = meetings[0];

      // 執行取消（軟刪除，保留客戶接觸記錄）
      const result = await EntityService.updateEntity(this.entityType, meetingToCancel.id, {
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

      this.log('info', 'Client meeting cancelled successfully', { 
        meetingId: meetingToCancel.id,
        clientName: client_name
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('cancel_success', { 
          client_name,
          meeting_type: meetingToCancel.meeting_type 
        }),
        { cancelledMeeting: meetingToCancel }
      );

    } catch (error) {
      this.log('error', 'Failed to cancel client meeting', { error: error.message });
      return this.createErrorResponse(
        'Cancel error',
        this.formatConfigMessage('cancel_error')
      );
    }
  }

  /**
   * 查詢客戶會議
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 查詢結果
   */
  async queryEntities(userId) {
    this.log('info', 'Querying client meetings', { userId });

    try {
      const meetings = await EntityService.queryEntities(this.entityType, {
        sales_agent_id: userId,
        status: 'scheduled'
      });

      // 計算業績統計（保險業務特有）
      const stats = this.calculatePerformanceStats(meetings);

      this.log('info', 'Client meetings queried successfully', { 
        count: meetings.length,
        stats 
      });

      return this.createSuccessResponse(
        meetings.length === 0 ? this.formatConfigMessage('query_empty') : null,
        { 
          meetings,
          count: meetings.length,
          performanceStats: stats
        }
      );

    } catch (error) {
      this.log('error', 'Failed to query client meetings', { error: error.message });
      return this.createErrorResponse(
        'Query error',
        this.formatConfigMessage('query_error')
      );
    }
  }

  /**
   * 清空客戶會議（保留重要業績記錄）
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 清空結果
   */
  async clearAllEntities(entities, userId) {
    this.log('info', 'Clearing all client meetings', { userId, entities });

    try {
      const { confirmation } = entities;
      const isConfirmation = confirmation === '確認清空' || confirmation === '確認';

      if (!isConfirmation) {
        const meetings = await EntityService.queryEntities(this.entityType, {
          sales_agent_id: userId
        });
        
        if (meetings.length === 0) {
          return this.createSuccessResponse(
            this.formatConfigMessage('clear_empty'),
            { 
              action: 'clear_check',
              meetingCount: 0
            }
          );
        }

        return {
          success: false,
          action: 'clear_confirmation_required',
          requiresConfirmation: true,
          message: this.formatConfigMessage('clear_warning', { count: meetings.length }),
          meetingCount: meetings.length,
          expiresIn: '5分鐘'
        };
      }

      // 保險業務：只歸檔預定的會議，保留業績記錄
      const meetings = await EntityService.queryEntities(this.entityType, {
        sales_agent_id: userId,
        status: 'scheduled'
      });

      let processedCount = 0;
      for (const meeting of meetings) {
        try {
          await EntityService.updateEntity(this.entityType, meeting.id, {
            status: 'archived',
            archived_at: TimeService.getCurrentUserTime().toISOString(),
            archived_reason: 'Bulk archive by user'
          });
          processedCount++;
        } catch (error) {
          this.log('error', 'Failed to archive meeting', { 
            meetingId: meeting.id, 
            error: error.message 
          });
        }
      }

      this.log('info', 'Client meetings archived', { 
        totalCount: meetings.length,
        processedCount 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('clear_success', { count: processedCount }),
        {
          action: 'clear_executed',
          archivedCount: processedCount,
          totalCount: meetings.length
        }
      );

    } catch (error) {
      this.log('error', 'Failed to clear client meetings', { error: error.message });
      return this.createErrorResponse(
        'Clear error',
        this.formatConfigMessage('clear_error')
      );
    }
  }

  // ==================== 保險業務特有的私有方法 ====================

  /**
   * 推斷會議類型
   * @param {Object} entities - 實體信息
   * @returns {string|null} 推斷的會議類型
   * @private
   */
  inferMeetingType(entities) {
    const { course_name } = entities; // 可能從輸入推斷
    
    const meetingTypeMapping = {
      '拜訪': '初次拜訪',
      '介紹': '產品介紹',
      '分析': '需求分析',
      '提案': '方案提案',
      '簽約': '簽約會議',
      '服務': '售後服務'
    };

    if (course_name) {
      for (const [keyword, meetingType] of Object.entries(meetingTypeMapping)) {
        if (course_name.includes(keyword)) {
          return meetingType;
        }
      }
    }

    return this.config.insurance_specific?.defaults?.meeting_type || '初次拜訪';
  }

  /**
   * 驗證預期成交金額
   * @param {any} value - 金額值
   * @returns {boolean} 是否有效
   * @private
   */
  validateExpectedValue(value) {
    if (value === null || value === undefined) {
      return true; // 可選欄位
    }

    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }

  /**
   * 計算業績統計
   * @param {Array} meetings - 會議列表
   * @returns {Object} 業績統計
   * @private
   */
  calculatePerformanceStats(meetings) {
    const stats = {
      totalMeetings: meetings.length,
      byType: {},
      byProduct: {},
      totalExpectedValue: 0,
      averageExpectedValue: 0
    };

    let totalValue = 0;
    let valueCount = 0;

    meetings.forEach(meeting => {
      // 按會議類型統計
      const type = meeting.meeting_type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // 按產品類型統計
      if (meeting.product_type) {
        const product = meeting.product_type;
        stats.byProduct[product] = (stats.byProduct[product] || 0) + 1;
      }

      // 預期成交金額統計
      if (meeting.expected_value && !isNaN(meeting.expected_value)) {
        totalValue += parseFloat(meeting.expected_value);
        valueCount++;
      }
    });

    stats.totalExpectedValue = totalValue;
    stats.averageExpectedValue = valueCount > 0 ? totalValue / valueCount : 0;

    return stats;
  }

  /**
   * 構建會議數據
   * @private
   */
  buildMeetingData(userId, clientName, meetingType, timeInfo, productType, location, notes, expectedValue) {
    const defaults = this.config.insurance_specific?.defaults || {};
    
    return {
      sales_agent_id: userId,
      client_name: clientName,
      meeting_type: meetingType,
      meeting_time: timeInfo?.display || 'TBD',
      meeting_date: timeInfo?.date || null,
      product_type: productType || null,
      location: location || defaults.location || '公司',
      notes: notes || null,
      expected_value: expectedValue ? parseFloat(expectedValue) : null,
      status: defaults.status || 'scheduled',
      priority: defaults.priority || 'normal'
    };
  }

  /**
   * 構建會議更新數據
   * @private
   */
  buildMeetingUpdateData(timeInfo, productType, location, notes, expectedValue) {
    const updateData = {};
    const modifiedFields = [];
    const allowedFields = this.config.business_rules?.modify?.allowed_fields || [];

    if (timeInfo && TimeService.validateTimeInfo(timeInfo)) {
      if (allowedFields.includes('meeting_time')) {
        updateData.meeting_time = timeInfo.display;
        modifiedFields.push('時間');
      }
      if (allowedFields.includes('meeting_date')) {
        updateData.meeting_date = timeInfo.date;
        if (!modifiedFields.includes('時間')) {
          modifiedFields.push('日期');
        }
      }
    }

    if (productType && allowedFields.includes('product_type')) {
      updateData.product_type = productType;
      modifiedFields.push('產品類型');
    }

    if (location && allowedFields.includes('location')) {
      updateData.location = location;
      modifiedFields.push('地點');
    }

    if (notes && allowedFields.includes('notes')) {
      updateData.notes = notes;
      modifiedFields.push('備註');
    }

    if (expectedValue !== undefined && allowedFields.includes('expected_value')) {
      updateData.expected_value = expectedValue ? parseFloat(expectedValue) : null;
      modifiedFields.push('預期成交金額');
    }

    return { updateData, modifiedFields };
  }
}

module.exports = InsuranceSalesScenarioTemplate;