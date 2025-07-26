/**
 * CourseManagementScenarioTemplate - 課程管理場景具體實現
 * 職責：實現課程管理的具體業務邏輯
 * 繼承：ScenarioTemplate抽象基類
 * 依賴：EntityService, TimeService
 */

const ScenarioTemplate = require('../ScenarioTemplate');
const EntityService = require('../../services/entityService');
const TimeService = require('../../services/timeService');

class CourseManagementScenarioTemplate extends ScenarioTemplate {
  /**
   * 創建課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 創建結果
   */
  async createEntity(entities, userId) {
    this.log('info', 'Creating course entity', { userId, entities });

    try {
      const { course_name, timeInfo, location, teacher } = entities;

      // 驗證必要欄位
      const validation = this.validateRequiredFields(entities);
      if (!validation.isValid) {
        if (validation.missingFields.includes('course_name')) {
          return this.createErrorResponse(
            'Missing course name',
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

      // 驗證時間格式
      if (timeInfo && !TimeService.validateTimeInfo(timeInfo)) {
        return this.createErrorResponse(
          'Invalid time information',
          this.formatConfigMessage('create_invalid_time')
        );
      }

      // 檢查時間衝突（如果配置要求）
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

      // 構建課程數據
      const courseData = this.buildCourseData(userId, course_name, timeInfo, location, teacher);
      
      // 使用EntityService創建課程
      const result = await EntityService.createEntity(this.entityType, courseData);
      
      if (!result.success) {
        return this.createErrorResponse(
          'Create failed',
          this.formatConfigMessage('create_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Course created successfully', { courseId: result.data?.id });

      return this.createSuccessResponse(
        this.formatConfigMessage('create_success', { course_name }),
        { course: result.data }
      );

    } catch (error) {
      this.log('error', 'Failed to create course', { error: error.message });
      return this.createErrorResponse(
        'Create error',
        this.formatConfigMessage('create_error')
      );
    }
  }

  /**
   * 修改課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   */
  async modifyEntity(entities, userId) {
    this.log('info', 'Modifying course entity', { userId, entities });

    try {
      const { course_name, timeInfo, location, teacher } = entities;
      
      // 驗證必要的課程名稱
      if (!course_name) {
        return this.createErrorResponse(
          'Missing course name',
          this.formatConfigMessage('modify_missing_name')
        );
      }

      // 查找要修改的課程
      const existingCourses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        course_name,
        status: 'scheduled'
      });

      if (existingCourses.length === 0) {
        return this.createErrorResponse(
          'Course not found',
          this.formatConfigMessage('modify_not_found', { course_name })
        );
      }

      // 如果有多個同名課程，修改最近的一個
      const courseToModify = existingCourses[0];

      // 構建更新數據
      const { updateData, modifiedFields } = this.buildUpdateData(timeInfo, location, teacher);

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
          courseToModify.id // 排除當前課程
        );

        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict detected',
            this.formatConfigMessage('modify_time_conflict', {
              course_date: timeInfo.date,
              schedule_time: timeInfo.display
            })
          );
        }
      }

      // 執行更新
      const result = await EntityService.updateEntity(this.entityType, courseToModify.id, updateData);

      if (!result.success) {
        return this.createErrorResponse(
          'Update failed',
          this.formatConfigMessage('modify_error'),
          { details: result.error }
        );
      }

      // 獲取更新後的課程信息
      const updatedCourse = await EntityService.getEntityById(this.entityType, courseToModify.id);

      this.log('info', 'Course modified successfully', { 
        courseId: courseToModify.id, 
        modifiedFields 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('modify_success', {
          course_name,
          modified_fields: modifiedFields.join('、')
        }),
        {
          modifiedFields,
          originalCourse: courseToModify,
          updatedCourse
        }
      );

    } catch (error) {
      this.log('error', 'Failed to modify course', { error: error.message });
      return this.createErrorResponse(
        'Modify error',
        this.formatConfigMessage('modify_error')
      );
    }
  }

  /**
   * 取消課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelEntity(entities, userId) {
    this.log('info', 'Cancelling course entity', { userId, entities });

    try {
      const { course_name } = entities;
      
      if (!course_name) {
        return this.createErrorResponse(
          'Missing course name',
          this.formatConfigMessage('cancel_missing_name')
        );
      }

      // 查找要取消的課程
      const courses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        course_name,
        status: 'scheduled'
      });

      if (courses.length === 0) {
        return this.createErrorResponse(
          'Course not found',
          this.formatConfigMessage('cancel_not_found', { course_name })
        );
      }

      const courseToCancel = courses[0];

      // 執行取消（軟刪除：更新狀態為cancelled）
      const updateData = this.config.business_rules?.cancel?.soft_delete 
        ? { status: 'cancelled' }
        : null;

      let result;
      if (updateData) {
        // 軟刪除：更新狀態
        result = await EntityService.updateEntity(this.entityType, courseToCancel.id, updateData);
      } else {
        // 硬刪除：直接刪除記錄
        result = { success: await EntityService.deleteEntity(this.entityType, courseToCancel.id) };
      }

      if (!result.success) {
        return this.createErrorResponse(
          'Cancel failed',
          this.formatConfigMessage('cancel_error'),
          { details: result.error }
        );
      }

      this.log('info', 'Course cancelled successfully', { 
        courseId: courseToCancel.id,
        softDelete: !!updateData
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('cancel_success', { course_name }),
        { cancelledCourse: courseToCancel }
      );

    } catch (error) {
      this.log('error', 'Failed to cancel course', { error: error.message });
      return this.createErrorResponse(
        'Cancel error',
        this.formatConfigMessage('cancel_error')
      );
    }
  }

  /**
   * 查詢課表
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 查詢結果
   */
  async queryEntities(userId) {
    this.log('info', 'Querying course entities', { userId });

    try {
      const courses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        status: 'scheduled'
      });

      this.log('info', 'Courses queried successfully', { count: courses.length });

      return this.createSuccessResponse(
        courses.length === 0 ? this.formatConfigMessage('query_empty') : null,
        { 
          courses,
          count: courses.length
        }
      );

    } catch (error) {
      this.log('error', 'Failed to query courses', { error: error.message });
      return this.createErrorResponse(
        'Query error',
        this.formatConfigMessage('query_error')
      );
    }
  }

  /**
   * 清空課表
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 清空結果
   */
  async clearAllEntities(entities, userId) {
    this.log('info', 'Clearing all course entities', { userId, entities });

    try {
      const { confirmation } = entities;
      const isConfirmation = confirmation === '確認清空' || confirmation === '確認';

      if (!isConfirmation) {
        // 第一步：檢查課程數量並要求確認
        const courses = await EntityService.queryEntities(this.entityType, {
          student_id: userId
        });
        
        if (courses.length === 0) {
          return this.createSuccessResponse(
            this.formatConfigMessage('clear_empty'),
            { 
              action: 'clear_check',
              courseCount: 0
            }
          );
        }

        // 存儲確認狀態（可以使用會話上下文或臨時存儲）
        // 這裡簡化處理，實際應該有過期機制
        
        return {
          success: false,
          action: 'clear_confirmation_required',
          requiresConfirmation: true,
          message: this.formatConfigMessage('clear_warning', { count: courses.length }),
          courseCount: courses.length,
          expiresIn: '5分鐘'
        };
      }

      // 第二步：執行清空操作
      // TODO: 實際應該檢查確認是否在有效期內
      
      const clearResult = await EntityService.clearUserEntities(this.entityType, userId);

      this.log('info', 'Courses cleared', { 
        totalCount: clearResult.totalCount,
        deletedCount: clearResult.deletedCount 
      });

      return this.createSuccessResponse(
        this.formatConfigMessage('clear_success', { count: clearResult.deletedCount }),
        {
          action: 'clear_executed',
          deletedCount: clearResult.deletedCount,
          totalCount: clearResult.totalCount,
          errors: clearResult.errors
        }
      );

    } catch (error) {
      this.log('error', 'Failed to clear courses', { error: error.message });
      return this.createErrorResponse(
        'Clear error',
        this.formatConfigMessage('clear_error')
      );
    }
  }

  // ==================== 私有輔助方法 ====================

  /**
   * 構建課程數據
   * @param {string} userId - 用戶ID
   * @param {string} courseName - 課程名稱
   * @param {Object} timeInfo - 時間信息
   * @param {string} location - 地點
   * @param {string} teacher - 老師
   * @returns {Object} 課程數據
   * @private
   */
  buildCourseData(userId, courseName, timeInfo, location, teacher) {
    const defaults = this.config.course_specific?.defaults || {};
    
    return {
      student_id: userId,
      course_name: courseName,
      schedule_time: timeInfo?.display || 'TBD',
      course_date: timeInfo?.date || null,
      location: location || defaults.location || null,
      teacher: teacher || defaults.teacher || null,
      status: defaults.status || 'scheduled',
      is_recurring: defaults.is_recurring || false,
      recurrence_pattern: null
    };
  }

  /**
   * 構建更新數據
   * @param {Object} timeInfo - 時間信息
   * @param {string} location - 地點
   * @param {string} teacher - 老師
   * @returns {Object} { updateData, modifiedFields }
   * @private
   */
  buildUpdateData(timeInfo, location, teacher) {
    const updateData = {};
    const modifiedFields = [];
    const allowedFields = this.config.business_rules?.modify?.allowed_fields || [];

    // 處理時間信息修改
    if (timeInfo && TimeService.validateTimeInfo(timeInfo)) {
      if (allowedFields.includes('schedule_time')) {
        updateData.schedule_time = timeInfo.display;
        modifiedFields.push('時間');
      }
      if (allowedFields.includes('course_date')) {
        updateData.course_date = timeInfo.date;
        if (!modifiedFields.includes('時間')) {
          modifiedFields.push('日期');
        }
      }
    }

    // 處理其他可修改欄位
    if (location && allowedFields.includes('location')) {
      updateData.location = location;
      modifiedFields.push('地點');
    }

    if (teacher && allowedFields.includes('teacher')) {
      updateData.teacher = teacher;
      modifiedFields.push('老師');
    }

    return { updateData, modifiedFields };
  }

  /**
   * 格式化課程顯示信息
   * @param {Object} course - 課程對象
   * @returns {string} 格式化的課程信息
   * @private
   */
  formatCourseDisplay(course) {
    const template = this.config.display?.list_item_format || 
                    "🕒 {schedule_time} - 📚 {course_name}";
    
    return this.formatMessage(template, course);
  }

  /**
   * 驗證課程業務規則
   * @param {Object} courseData - 課程數據
   * @returns {Object} 驗證結果 { isValid, errors }
   * @private
   */
  validateCourseRules(courseData) {
    const errors = [];
    const rules = this.config.business_rules || {};

    // 檢查重複課程名稱規則
    if (rules.create?.allow_duplicate_names === false) {
      // 這裡可以添加檢查邏輯
    }

    // 檢查課程名稱格式
    if (this.config.validation_rules?.name_format_check) {
      if (courseData.course_name && courseData.course_name.length < 2) {
        errors.push('課程名稱至少需要2個字符');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = CourseManagementScenarioTemplate;