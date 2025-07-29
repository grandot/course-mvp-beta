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
  constructor(config) {
    super(config);
    console.log('✅✅✅ CourseManagementScenarioTemplate constructor is called! ✅✅✅');
  }

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

      // 格式化新時間用於顯示
      let newTimeDisplay = null;
      
      if (updatedCourse.data) {
        // EntityService 返回的格式: { exists: true, id: string, data: {...} }
        const courseData = updatedCourse.data;
        
        if (courseData.timeInfo && courseData.timeInfo.display) {
          newTimeDisplay = courseData.timeInfo.display;
        } else if (courseData.schedule_time) {
          newTimeDisplay = courseData.schedule_time;
        } else {
          // 從 updateData 中獲取時間信息作為後備方案
          if (timeInfo && timeInfo.display) {
            newTimeDisplay = timeInfo.display;
          }
        }
      } else if (updatedCourse.timeInfo && updatedCourse.timeInfo.display) {
        newTimeDisplay = updatedCourse.timeInfo.display;
      } else if (updatedCourse.schedule_time) {
        newTimeDisplay = TimeService.formatForDisplay(updatedCourse.schedule_time);
      }
      
      // 確保有一個有效的顯示值
      if (!newTimeDisplay && timeInfo && timeInfo.display) {
        newTimeDisplay = timeInfo.display;
      }

      return this.createSuccessResponse(
        this.formatConfigMessage('modify_success', {
          course_name,
          modified_fields: modifiedFields.join('、'),
          new_time: newTimeDisplay
        }),
        {
          modifiedFields,
          originalCourse: courseToModify,
          updatedCourse
        }
      );

    } catch (error) {
      this.log('error', 'Failed to modify course', { 
        error: error.message, 
        stack: error.stack,
        entities,
        userId 
      });
      return this.createErrorResponse(
        `Modify error: ${error.message}`,
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
   * 查詢課表（支援重複課程動態計算）
   * @param {string} userId - 用戶ID
   * @param {Object} options - 查詢選項
   * @returns {Promise<Object>} 查詢結果
   */
  async queryEntities(userId, options = {}) {
    this.log('info', 'Querying course entities with recurring support', { userId, options });

    try {
      // 引入重複課程計算器
      const RecurringCourseCalculator = require('../../utils/recurringCourseCalculator');
      
      // 設定查詢範圍（預設4週）
      const today = TimeService.getCurrentUserTime();
      const startDate = options.startDate || TimeService.formatForStorage(today);
      const endDate = options.endDate || TimeService.formatForStorage(
        new Date(today.getTime() + (4 * 7 * 24 * 60 * 60 * 1000)) // 4週後
      );

      // 同時查詢一般課程和重複課程
      const [regularCourses, recurringCourses] = await Promise.all([
        // 一般課程
        EntityService.queryEntities(this.entityType, {
          student_id: userId,
          status: 'scheduled',
          is_recurring: false
        }),
        // 重複課程（只查模板）
        EntityService.queryEntities(this.entityType, {
          student_id: userId,
          status: 'scheduled',
          is_recurring: true
        })
      ]);

      this.log('info', 'Raw query results', { 
        regularCount: regularCourses.length,
        recurringTemplateCount: recurringCourses.length 
      });

      // 計算重複課程的具體實例
      let recurringInstances = [];
      for (const recurringCourse of recurringCourses) {
        try {
          const instances = RecurringCourseCalculator.calculateFutureOccurrences(
            recurringCourse, 
            startDate, 
            endDate,
            options.maxRecurringInstances || 20
          );
          recurringInstances = recurringInstances.concat(instances);
        } catch (error) {
          this.log('warn', `Failed to calculate recurring instances for course ${recurringCourse.id}`, {
            error: error.message,
            courseId: recurringCourse.id,
            courseName: recurringCourse.course_name
          });
        }
      }

      // 過濾在指定日期範圍內的一般課程
      const filteredRegularCourses = regularCourses.filter(course => {
        if (!course.course_date) return true; // 沒有日期的課程保留
        return course.course_date >= startDate && course.course_date <= endDate;
      });

      // 合併並排序所有課程
      const allCourses = [...filteredRegularCourses, ...recurringInstances];
      
      // 按日期和時間排序
      allCourses.sort((a, b) => {
        const dateA = a.course_date || a.date || '9999-12-31';
        const dateB = b.course_date || b.date || '9999-12-31';
        
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        
        // 相同日期時按時間排序
        const timeA = a.schedule_time || '';
        const timeB = b.schedule_time || '';
        return timeA.localeCompare(timeB);
      });

      // 組合統計信息
      const stats = {
        totalCourses: allCourses.length,
        regularCourses: filteredRegularCourses.length,
        recurringInstances: recurringInstances.length,
        recurringTemplates: recurringCourses.length,
        queryRange: { startDate, endDate }
      };

      this.log('info', 'Courses queried successfully', stats);

      // 格式化課程顯示
      const formattedCourses = allCourses.map(course => this.formatCourseForDisplay(course));

      return this.createSuccessResponse(
        allCourses.length === 0 
          ? this.formatConfigMessage('query_empty') 
          : this.formatQueryResultMessage(stats),
        { 
          courses: formattedCourses,
          ...stats
        }
      );

    } catch (error) {
      this.log('error', 'Failed to query courses', { 
        error: error.message, 
        stack: error.stack,
        userId 
      });
      return this.createErrorResponse(
        'Query error',
        this.formatConfigMessage('query_error')
      );
    }
  }

  /**
   * 創建重複課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 創建結果
   */
  async createRecurringEntity(entities, userId) {
    this.log('info', 'Creating recurring course entity', { userId, entities });

    try {
      const { course_name, timeInfo, location, teacher, recurrence_pattern } = entities;

      // 驗證必要欄位
      const validation = this.validateRequiredFields(entities);
      if (!validation.isValid) {
        if (validation.missingFields.includes('course_name')) {
          return this.createErrorResponse(
            'Missing course name',
            '請提供課程名稱，例如：「數學課每週一下午2點」'
          );
        }
        if (validation.missingFields.includes('timeInfo')) {
          return this.createErrorResponse(
            'Missing time information',
            '請提供時間信息，例如：「數學課每週一下午2點」'
          );
        }
      }

      // 驗證重複模式
      if (!recurrence_pattern) {
        return this.createErrorResponse(
          'Missing recurrence pattern',
          '請指定重複頻率，例如：「每週」、「每天」或「每月」'
        );
      }

      // 驗證時間格式
      if (timeInfo && !TimeService.validateTimeInfo(timeInfo)) {
        return this.createErrorResponse(
          'Invalid time information',
          '時間格式無效，請重新輸入正確的時間'
        );
      }

      // 智能判斷起始日期
      const startDate = this.determineRecurringStartDate(timeInfo, recurrence_pattern);
      
      // 檢查時間衝突（檢查第一次上課時間）
      if (this.config.validation_rules?.time_conflict_check && timeInfo) {
        const conflicts = await EntityService.checkTimeConflicts(
          this.entityType, 
          userId, 
          startDate, 
          timeInfo.display
        );
        
        if (conflicts.length > 0) {
          return this.createErrorResponse(
            'Time conflict',
            `在 ${TimeService.formatForDisplay(startDate)} ${timeInfo.display} 已有其他課程安排`
          );
        }
      }

      // 構建重複課程數據
      const recurringCourseData = this.buildRecurringCourseData(
        userId, 
        course_name, 
        timeInfo, 
        location, 
        teacher, 
        recurrence_pattern,
        startDate
      );
      
      // 使用EntityService創建重複課程模板
      const result = await EntityService.createEntity(this.entityType, recurringCourseData);
      
      if (!result.success) {
        return this.createErrorResponse(
          'Create recurring course failed',
          '創建重複課程失敗，請稍後再試',
          { details: result.error }
        );
      }

      this.log('info', 'Recurring course created successfully', { 
        courseId: result.data?.id,
        recurrencePattern: recurrence_pattern,
        startDate
      });

      const recurrenceDescription = this.formatRecurrenceDescription(recurrence_pattern);
      return this.createSuccessResponse(
        `✅ 重複課程「${course_name}」已創建！\n🔄 ${recurrenceDescription}\n🕒 時間：${timeInfo.display}\n📅 開始日期：${TimeService.formatForDisplay(startDate)}`,
        { 
          course: result.data,
          recurrence_pattern,
          start_date: startDate,
          recurrence_description: recurrenceDescription
        }
      );

    } catch (error) {
      this.log('error', 'Failed to create recurring course', { error: error.message });
      return this.createErrorResponse(
        'Create recurring course error',
        '創建重複課程時發生錯誤，請稍後再試'
      );
    }
  }

  /**
   * 修改重複課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   */
  async modifyRecurringEntity(entities, userId) {
    this.log('info', 'Modifying recurring course entity', { userId, entities });

    try {
      const { course_name, timeInfo, location, teacher, recurrence_pattern, modification_scope } = entities;
      
      // 驗證必要的課程名稱
      if (!course_name) {
        return this.createErrorResponse(
          'Missing course name',
          '請指定要修改的重複課程名稱'
        );
      }

      // 查找重複課程模板
      const recurringCourses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        course_name,
        is_recurring: true,
        status: 'scheduled'
      });

      if (recurringCourses.length === 0) {
        return this.createErrorResponse(
          'Recurring course not found',
          `找不到名稱為「${course_name}」的重複課程`
        );
      }

      const courseToModify = recurringCourses[0];

      // 詢問修改範圍（如果未指定）
      if (!modification_scope) {
        return {
          success: false,
          action: 'modification_scope_required',
          requiresUserChoice: true,
          message: `請選擇修改範圍：\n1. 修改整個重複課程安排\n2. 只修改單次課程\n3. 修改重複模式或頻率\n\n請回覆：「修改整個安排」、「只修改單次」或「修改重複模式」`,
          courseId: courseToModify.id,
          courseName: course_name
        };
      }

      // 根據修改範圍執行不同操作
      switch (modification_scope) {
        case 'all_future':
        case 'entire_series':
          return await this.modifyEntireRecurringSeries(courseToModify, entities, userId);
          
        case 'single_instance':
          return await this.modifySingleRecurringInstance(courseToModify, entities, userId);
          
        case 'recurrence_pattern':
          return await this.modifyRecurrencePattern(courseToModify, entities, userId);
          
        default:
          return this.createErrorResponse(
            'Invalid modification scope',
            '無效的修改範圍，請重新選擇'
          );
      }

    } catch (error) {
      this.log('error', 'Failed to modify recurring course', { 
        error: error.message, 
        entities,
        userId 
      });
      return this.createErrorResponse(
        'Modify recurring course error',
        '修改重複課程時發生錯誤，請稍後再試'
      );
    }
  }

  /**
   * 停止重複課程
   * @param {Object} entities - 從語義分析提取的實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 停止結果
   */
  async stopRecurringEntity(entities, userId) {
    this.log('info', 'Stopping recurring course entity', { userId, entities });

    try {
      const { course_name } = entities;
      
      if (!course_name) {
        return this.createErrorResponse(
          'Missing course name',
          '請指定要停止的重複課程名稱'
        );
      }

      // 查找要停止的重複課程
      const recurringCourses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        course_name,
        is_recurring: true,
        status: 'scheduled'
      });

      if (recurringCourses.length === 0) {
        return this.createErrorResponse(
          'Recurring course not found',
          `找不到名稱為「${course_name}」的重複課程`
        );
      }

      const courseToStop = recurringCourses[0];

      // 檢查是否有未來的課程實例
      const RecurringCourseCalculator = require('../../utils/recurringCourseCalculator');
      const today = TimeService.getCurrentUserTime();
      const futureInstances = RecurringCourseCalculator.calculateFutureOccurrences(
        courseToStop,
        TimeService.formatForStorage(today),
        TimeService.formatForStorage(new Date(today.getTime() + (4 * 7 * 24 * 60 * 60 * 1000))), // 4週後
        10 // 限制10個實例用於統計
      );

      // 執行停止操作：將 is_recurring 設為 false
      const stopData = {
        is_recurring: false,
        status: 'stopped',
        stopped_at: TimeService.formatForStorage(today),
        stop_reason: 'user_requested'
      };

      const result = await EntityService.updateEntity(this.entityType, courseToStop.id, stopData);

      if (!result.success) {
        return this.createErrorResponse(
          'Stop recurring course failed',
          '停止重複課程失敗，請稍後再試',
          { details: result.error }
        );
      }

      this.log('info', 'Recurring course stopped successfully', { 
        courseId: courseToStop.id,
        futureInstancesAffected: futureInstances.length
      });

      const recurrenceDescription = this.formatRecurrenceDescription(courseToStop.recurrence_pattern);
      return this.createSuccessResponse(
        `✅ 重複課程「${course_name}」已停止\n🔄 原設定：${recurrenceDescription}\n📊 影響的未來課程：約 ${futureInstances.length} 堂\n⏰ 停止時間：${TimeService.formatForDisplay(today)}`,
        { 
          stoppedCourse: courseToStop,
          futureInstancesAffected: futureInstances.length,
          stopTime: today
        }
      );

    } catch (error) {
      this.log('error', 'Failed to stop recurring course', { error: error.message });
      return this.createErrorResponse(
        'Stop recurring course error',
        '停止重複課程時發生錯誤，請稍後再試'
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
   * 格式化課程用於顯示（統一處理一般課程和重複課程）
   * @param {Object} course - 課程對象
   * @returns {Object} 格式化後的課程對象
   * @private
   */
  formatCourseForDisplay(course) {
    return {
      id: course.id,
      course_name: course.course_name,
      schedule_time: course.schedule_time,
      course_date: course.course_date || course.date,
      location: course.location,
      teacher: course.teacher,
      status: course.status,
      recurring_label: course.recurring_label || '',
      is_recurring_instance: course.is_recurring_instance || false,
      original_course_id: course.original_course_id || null,
      display_text: this.formatCourseDisplay(course)
    };
  }

  /**
   * 格式化查詢結果訊息
   * @param {Object} stats - 統計信息
   * @returns {string} 格式化的訊息
   * @private
   */
  formatQueryResultMessage(stats) {
    const { totalCourses, regularCourses, recurringInstances, recurringTemplates } = stats;
    
    let message = `找到 ${totalCourses} 堂課程`;
    
    if (recurringInstances > 0) {
      message += `（包含 ${regularCourses} 堂一般課程，${recurringInstances} 堂重複課程實例）`;
    }
    
    if (recurringTemplates > 0) {
      message += `\n🔄 重複課程模板: ${recurringTemplates} 個`;
    }
    
    return message;
  }

  /**
   * 構建重複課程數據
   * @param {string} userId - 用戶ID
   * @param {string} courseName - 課程名稱
   * @param {Object} timeInfo - 時間信息
   * @param {string} location - 地點
   * @param {string} teacher - 老師
   * @param {string} recurrencePattern - 重複模式
   * @param {string} startDate - 起始日期
   * @returns {Object} 重複課程數據
   * @private
   */
  buildRecurringCourseData(userId, courseName, timeInfo, location, teacher, recurrencePattern, startDate) {
    const defaults = this.config.course_specific?.defaults || {};
    
    // 解析重複模式並設置布林欄位
    const recurrenceInfo = this.parseRecurrencePattern(recurrencePattern, timeInfo);
    
    return {
      student_id: userId,
      course_name: courseName,
      schedule_time: timeInfo?.display || 'TBD',
      course_date: startDate,
      location: location || defaults.location || null,
      teacher: teacher || defaults.teacher || null,
      status: defaults.status || 'scheduled',
      is_recurring: true,
      recurrence_pattern: recurrencePattern,
      start_date: startDate,
      
      // 必要的布林欄位
      daily_recurring: recurrenceInfo.daily_recurring,
      weekly_recurring: recurrenceInfo.weekly_recurring,
      monthly_recurring: recurrenceInfo.monthly_recurring,
      
      // 重複詳細資訊
      recurrence_details: recurrenceInfo.recurrence_details,
      
      created_at: TimeService.formatForStorage(TimeService.getCurrentUserTime())
    };
  }

  /**
   * 解析重複模式並生成布林欄位和詳細資訊
   * @param {string} recurrencePattern - 重複模式（如 "每週"）
   * @param {Object} timeInfo - 時間信息
   * @returns {Object} 解析結果
   * @private
   */
  parseRecurrencePattern(recurrencePattern, timeInfo) {
    const result = {
      daily_recurring: false,
      weekly_recurring: false,
      monthly_recurring: false,
      recurrence_details: {}
    };

    if (!recurrencePattern) {
      return result;
    }

    const pattern = recurrencePattern.toLowerCase();

    if (pattern.includes('每天') || pattern.includes('每日')) {
      result.daily_recurring = true;
      result.recurrence_details = {
        type: 'daily',
        time_of_day: this.extractTimeOfDay(timeInfo)
      };
    } else if (pattern.includes('每週') || pattern.includes('每周')) {
      result.weekly_recurring = true;
      result.recurrence_details = {
        type: 'weekly',
        days_of_week: this.extractDaysOfWeek(recurrencePattern, timeInfo),
        time_of_day: this.extractTimeOfDay(timeInfo)
      };
    } else if (pattern.includes('每月')) {
      result.monthly_recurring = true;
      result.recurrence_details = {
        type: 'monthly',
        day_of_month: this.extractDayOfMonth(recurrencePattern, timeInfo),
        time_of_day: this.extractTimeOfDay(timeInfo)
      };
    }

    return result;
  }

  /**
   * 從時間信息中提取時間部分
   * @param {Object} timeInfo - 時間信息
   * @returns {string} 時間字符串
   * @private
   */
  extractTimeOfDay(timeInfo) {
    if (!timeInfo || !timeInfo.raw) {
      return '00:00';
    }
    
    const date = new Date(timeInfo.raw);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * 從重複模式中提取星期幾
   * @param {string} recurrencePattern - 重複模式
   * @param {Object} timeInfo - 時間信息
   * @returns {Array} 星期幾數組 (0=週日, 1=週一, ..., 6=週六)
   * @private
   */
  extractDaysOfWeek(recurrencePattern, timeInfo) {
    // 從模式中檢測星期幾
    const dayMap = {
      '週一': 1, '周一': 1, '一': 1,
      '週二': 2, '周二': 2, '二': 2,
      '週三': 3, '周三': 3, '三': 3,
      '週四': 4, '周四': 4, '四': 4,
      '週五': 5, '周五': 5, '五': 5,
      '週六': 6, '周六': 6, '六': 6,
      '週日': 0, '周日': 0, '日': 0
    };

    for (const [dayName, dayNum] of Object.entries(dayMap)) {
      if (recurrencePattern.includes(dayName)) {
        return [dayNum];
      }
    }

    // 如果沒有明確指定，從 timeInfo 的日期推斷
    if (timeInfo && timeInfo.raw) {
      const date = new Date(timeInfo.raw);
      return [date.getDay()];
    }

    // 預設週一
    return [1];
  }

  /**
   * 從重複模式中提取月份的第幾天
   * @param {string} recurrencePattern - 重複模式
   * @param {Object} timeInfo - 時間信息
   * @returns {number} 月份的第幾天
   * @private
   */
  extractDayOfMonth(recurrencePattern, timeInfo) {
    // 從模式中找數字
    const match = recurrencePattern.match(/(\d+)號/);
    if (match) {
      return parseInt(match[1]);
    }

    // 從 timeInfo 的日期推斷
    if (timeInfo && timeInfo.raw) {
      const date = new Date(timeInfo.raw);
      return date.getDate();
    }

    // 預設1號
    return 1;
  }

  /**
   * 智能判斷重複課程的起始日期
   * @param {Object} timeInfo - 時間信息
   * @param {string} recurrencePattern - 重複模式
   * @returns {string} 起始日期 (YYYY-MM-DD)
   * @private
   */
  determineRecurringStartDate(timeInfo, recurrencePattern) {
    const today = TimeService.getCurrentUserTime();
    
    // 如果有指定日期，使用指定的日期
    if (timeInfo && timeInfo.date) {
      return timeInfo.date;
    }

    // 根據重複模式智能判斷起始日期
    switch (recurrencePattern) {
      case 'daily':
      case '每天':
        // 每天重複，從明天開始
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return TimeService.formatForStorage(tomorrow);
        
      case 'weekly':
      case '每週':
        // 每週重複，從下週同一天開始
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return TimeService.formatForStorage(nextWeek);
        
      case 'monthly':
      case '每月':
        // 每月重複，從下個月同一天開始
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return TimeService.formatForStorage(nextMonth);
        
      default:
        // 預設從明天開始
        const defaultStart = new Date(today);
        defaultStart.setDate(defaultStart.getDate() + 1);
        return TimeService.formatForStorage(defaultStart);
    }
  }

  /**
   * 格式化重複模式描述
   * @param {string} recurrencePattern - 重複模式
   * @returns {string} 重複模式的友好描述
   * @private
   */
  formatRecurrenceDescription(recurrencePattern) {
    const descriptions = {
      'daily': '每天重複',
      '每天': '每天重複',
      'weekly': '每週重複',
      '每週': '每週重複',
      'monthly': '每月重複',
      '每月': '每月重複'
    };
    
    return descriptions[recurrencePattern] || `${recurrencePattern} 重複`;
  }

  /**
   * 修改整個重複課程系列
   * @param {Object} courseTemplate - 重複課程模板
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   * @private
   */
  async modifyEntireRecurringSeries(courseTemplate, entities, userId) {
    const { timeInfo, location, teacher, recurrence_pattern } = entities;
    const updateData = {};
    const modifiedFields = [];

    // 處理時間修改
    if (timeInfo && TimeService.validateTimeInfo(timeInfo)) {
      updateData.schedule_time = timeInfo.display;
      if (timeInfo.date) {
        updateData.course_date = timeInfo.date;
        updateData.start_date = timeInfo.date;
      }
      modifiedFields.push('時間');
    }

    // 處理其他欄位
    if (location) {
      updateData.location = location;
      modifiedFields.push('地點');
    }

    if (teacher) {
      updateData.teacher = teacher;
      modifiedFields.push('老師');
    }

    if (recurrence_pattern) {
      updateData.recurrence_pattern = recurrence_pattern;
      modifiedFields.push('重複模式');
    }

    if (modifiedFields.length === 0) {
      return this.createErrorResponse(
        'No modification fields',
        '沒有指定要修改的內容'
      );
    }

    // 執行更新
    const result = await EntityService.updateEntity(this.entityType, courseTemplate.id, updateData);

    if (!result.success) {
      return this.createErrorResponse(
        'Update failed',
        '修改重複課程失敗，請稍後再試',
        { details: result.error }
      );
    }

    this.log('info', 'Entire recurring series modified', { 
      courseId: courseTemplate.id, 
      modifiedFields 
    });

    const recurrenceDescription = this.formatRecurrenceDescription(
      recurrence_pattern || courseTemplate.recurrence_pattern
    );

    return this.createSuccessResponse(
      `✅ 重複課程「${courseTemplate.course_name}」整體安排已修改\n🔄 ${recurrenceDescription}\n📝 修改內容：${modifiedFields.join('、')}\n🕒 新時間：${updateData.schedule_time || courseTemplate.schedule_time}`,
      {
        modifiedFields,
        originalCourse: courseTemplate,
        updateData
      }
    );
  }

  /**
   * 修改單次重複課程實例
   * @param {Object} courseTemplate - 重複課程模板
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   * @private
   */
  async modifySingleRecurringInstance(courseTemplate, entities, userId) {
    // 創建一個例外課程記錄，覆蓋特定日期的重複課程
    const { timeInfo, location, teacher, target_date } = entities;

    if (!target_date && (!timeInfo || !timeInfo.date)) {
      return this.createErrorResponse(
        'Missing target date',
        '請指定要修改的具體日期，例如：「修改7月30日的數學課時間」'
      );
    }

    const targetDate = target_date || timeInfo.date;

    // 創建例外記錄
    const exceptionData = {
      student_id: userId,
      course_name: courseTemplate.course_name,
      schedule_time: timeInfo?.display || courseTemplate.schedule_time,
      course_date: targetDate,
      location: location || courseTemplate.location,
      teacher: teacher || courseTemplate.teacher,
      status: 'scheduled',
      is_recurring: false,
      is_recurring_exception: true,
      original_recurring_course_id: courseTemplate.id,
      exception_reason: 'user_modification'
    };

    const result = await EntityService.createEntity(this.entityType, exceptionData);

    if (!result.success) {
      return this.createErrorResponse(
        'Create exception failed',
        '創建課程例外記錄失敗，請稍後再試',
        { details: result.error }
      );
    }

    this.log('info', 'Single recurring instance exception created', { 
      originalCourseId: courseTemplate.id,
      exceptionId: result.data?.id,
      targetDate
    });

    return this.createSuccessResponse(
      `✅ 已為「${courseTemplate.course_name}」創建 ${TimeService.formatForDisplay(targetDate)} 的特殊安排\n🕒 修改後時間：${exceptionData.schedule_time}\n📝 其他重複課程保持原設定不變`,
      {
        exceptionCourse: result.data,
        originalCourse: courseTemplate,
        targetDate
      }
    );
  }

  /**
   * 修改重複模式
   * @param {Object} courseTemplate - 重複課程模板
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 修改結果
   * @private
   */
  async modifyRecurrencePattern(courseTemplate, entities, userId) {
    const { recurrence_pattern } = entities;

    if (!recurrence_pattern) {
      return this.createErrorResponse(
        'Missing recurrence pattern',
        '請指定新的重複模式，例如：「改成每週」、「改成每天」'
      );
    }

    const updateData = {
      recurrence_pattern: recurrence_pattern,
      // 重新設定起始日期
      start_date: this.determineRecurringStartDate(entities.timeInfo, recurrence_pattern)
    };

    const result = await EntityService.updateEntity(this.entityType, courseTemplate.id, updateData);

    if (!result.success) {
      return this.createErrorResponse(
        'Update recurrence pattern failed',
        '修改重複模式失敗，請稍後再試',
        { details: result.error }
      );
    }

    this.log('info', 'Recurrence pattern modified', { 
      courseId: courseTemplate.id,
      oldPattern: courseTemplate.recurrence_pattern,
      newPattern: recurrence_pattern
    });

    const oldDescription = this.formatRecurrenceDescription(courseTemplate.recurrence_pattern);
    const newDescription = this.formatRecurrenceDescription(recurrence_pattern);

    return this.createSuccessResponse(
      `✅ 重複課程「${courseTemplate.course_name}」的重複模式已修改\n🔄 原設定：${oldDescription}\n🔄 新設定：${newDescription}\n📅 新起始日期：${TimeService.formatForDisplay(updateData.start_date)}`,
      {
        originalPattern: courseTemplate.recurrence_pattern,
        newPattern: recurrence_pattern,
        newStartDate: updateData.start_date
      }
    );
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