/**
 * TaskService - 任務執行協調層
 * 職責：協調各種意圖的業務邏輯執行
 * 禁止：直接調用底層實現，必須通過統一服務層
 * Phase 5: 原子化重構 Step 3
 */

const dataService = require('./dataService');
const TimeService = require('./timeService');
const CourseService = require('./courseService');

class TaskService {
  /**
   * 統一任務執行入口
   * @param {string} intent - 用戶意圖
   * @param {Object} entities - 實體信息（使用新契約：entities.timeInfo）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async executeIntent(intent, entities, userId) {
    console.log(`🔧 [DEBUG] TaskService.executeIntent - Intent: ${intent}, UserId: ${userId}`); // [REMOVE_ON_PROD]
    console.log(`🔧 [DEBUG] TaskService.executeIntent - Entities:`, entities); // [REMOVE_ON_PROD]

    if (!intent || !userId) {
      console.log(`🔧 [DEBUG] TaskService.executeIntent - 參數驗證失敗`); // [REMOVE_ON_PROD]
      return {
        success: false,
        error: 'Missing required parameters',
        message: '缺少必要的參數信息',
      };
    }

    try {
      console.log(`🔧 [DEBUG] TaskService.executeIntent - 開始處理 ${intent}`); // [REMOVE_ON_PROD]
      
      switch (intent) {
        case 'record_course':
          console.log(`🔧 [DEBUG] TaskService - 開始處理新增課程`); // [REMOVE_ON_PROD]
          return this.handleRecordCourse(entities, userId);

        case 'cancel_course':
          console.log(`🔧 [DEBUG] TaskService - 開始處理取消課程`); // [REMOVE_ON_PROD]
          return this.handleCancelCourse(entities, userId);

        case 'query_schedule':
          console.log(`🔧 [DEBUG] TaskService - 開始處理查詢課表`); // [REMOVE_ON_PROD]
          return this.handleQuerySchedule(userId);

        case 'clear_schedule':
          console.log(`🔧 [DEBUG] TaskService - 開始處理清空課表`); // [REMOVE_ON_PROD]
          return this.handleClearSchedule(entities, userId);

        case 'modify_course':
          console.log(`🔧 [DEBUG] TaskService - 開始處理修改課程`); // [REMOVE_ON_PROD]
          return this.handleModifyCourse(entities, userId);

        case 'set_reminder':
          return {
            success: false,
            error: 'Feature not implemented',
            message: '此功能將在後續版本中實現',
          };

        default:
          return {
            success: false,
            error: 'Unknown intent',
            message: '抱歉，我無法理解您的需求，請重新描述',
          };
      }
    } catch (error) {
      console.error(`❌ [ERROR] TaskService.executeIntent - 執行失敗:`, error); // 保留
      return {
        success: false,
        error: error.message,
        message: '處理請求時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 處理課程記錄
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async handleRecordCourse(entities, userId) {
    // 改進驗證邏輯：更友好的錯誤處理
    const missingInfo = [];

    if (!entities.course_name) {
      missingInfo.push('課程名稱');
    }

    if (!entities.timeInfo) {
      missingInfo.push('時間信息');
    }

    // 如果缺少課程名稱，提供更具體的建議
    if (!entities.course_name) {
      return {
        success: false,
        error: 'Missing course name',
        message: '請告訴我課程名稱，例如：「數學課」、「英文課」等',
      };
    }

    // 如果缺少時間信息，允許創建課程但提醒用戶補充
    if (!entities.timeInfo) {
      return {
        success: false,
        error: 'Missing time information',
        message: '請提供上課時間，例如：「明天下午2點」、「週三晚上7點」等',
      };
    }

    // 驗證時間信息格式（允許部分字段為空）
    if (entities.timeInfo && !TimeService.validateTimeInfo(entities.timeInfo)) {
      return {
        success: false,
        error: 'Invalid time information format',
        message: '時間格式不正確，請重新輸入時間信息',
      };
    }

    try {
      // 使用 dataService 統一處理數據存儲，時間已經格式化
      const result = await dataService.createCourse({
        student_id: userId,
        course_name: entities.course_name,
        schedule_time: entities.timeInfo.display,
        course_date: entities.timeInfo.date,
        location: entities.location,
        teacher: entities.teacher,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '創建課程時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 處理課程取消
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async handleCancelCourse(entities, userId) {
    if (!entities.course_name) {
      return {
        success: false,
        error: 'Missing course name',
        message: '請指定要取消的課程名稱',
      };
    }

    try {
      // 查找要取消的課程
      const courses = await dataService.getUserCourses(userId, {
        course_name: entities.course_name,
        status: 'scheduled',
      });

      if (courses.length === 0) {
        return {
          success: false,
          error: 'Course not found',
          message: `找不到要取消的「${entities.course_name}」課程`,
        };
      }

      // 取消第一個找到的課程
      const result = await dataService.updateCourse(courses[0].id, {
        status: 'cancelled',
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '取消課程時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 處理課表查詢
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async handleQuerySchedule(userId) {
    try {
      const courses = await dataService.getUserCourses(userId, {
        status: 'scheduled',
      });

      return {
        success: true,
        courses,
        count: courses.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '查詢課表時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 處理清空課表（高風險操作，需要二步確認）
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async handleClearSchedule(entities, userId) {
    try {
      // 檢查是否是確認操作
      const isConfirmation = entities.confirmation === '確認清空' || entities.confirmed === true;

      if (!isConfirmation) {
        // 第一步：檢查用戶課程數量並要求確認
        const courses = await dataService.getUserCourses(userId);
        
        if (courses.length === 0) {
          return {
            success: true,
            action: 'clear_schedule_check',
            message: '您目前沒有任何課程安排需要清空。',
            courseCount: 0,
          };
        }

        // 存儲確認狀態（設置5分鐘過期）
        await this.setClearConfirmationPending(userId);

        return {
          success: false,
          action: 'clear_schedule_confirmation_required',
          requiresConfirmation: true,
          message: `⚠️ 警告：此操作將刪除您的所有 ${courses.length} 門課程，且無法恢復！\n\n如果確定要清空課表，請回覆「確認清空」。`,
          courseCount: courses.length,
          expiresIn: '5分鐘',
        };
      }

      // 第二步：執行清空操作
      const canConfirm = await this.checkClearConfirmationPending(userId);
      if (!canConfirm) {
        return {
          success: false,
          action: 'clear_schedule_expired',
          message: '確認操作已過期，請重新發起清空課表請求。',
        };
      }

      // 調用 CourseService 執行清空
      const result = await CourseService.clearAllCourses(userId, { confirmed: true });

      // 清理確認狀態
      await this.clearClearConfirmationPending(userId);

      return {
        success: result.success,
        action: 'clear_schedule_executed',
        message: result.message,
        deletedCount: result.deletedCount,
        operationDetails: result.operationDetails,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '清空課表時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 設置清空確認待處理狀態
   * @param {string} userId - 用戶ID
   */
  static async setClearConfirmationPending(userId) {
    const currentTime = TimeService.getCurrentUserTime();
    const expiryTime = TimeService.addMinutes(currentTime, 5); // 5分鐘後過期
    
    const confirmationData = {
      user_id: userId,
      action: 'clear_schedule',
      timestamp: currentTime.toISOString(),
      expires_at: expiryTime.toISOString(),
    };
    
    // 使用統一數據服務存儲確認狀態
    await dataService.createDocument('pending_confirmations', confirmationData);
  }

  /**
   * 檢查清空確認待處理狀態
   * @param {string} userId - 用戶ID
   * @returns {Promise<boolean>} 是否可以確認
   */
  static async checkClearConfirmationPending(userId) {
    try {
      const confirmations = await dataService.queryDocuments('pending_confirmations', {
        user_id: userId,
        action: 'clear_schedule',
      });

      if (confirmations.length === 0) {
        return false;
      }

      const confirmation = confirmations[0];
      const now = TimeService.getCurrentUserTime();
      const expiresAt = TimeService.parseDateTime(confirmation.expires_at);

      return now < expiresAt;
    } catch (error) {
      console.error('Error checking confirmation pending:', error);
      return false;
    }
  }

  /**
   * 清理清空確認待處理狀態
   * @param {string} userId - 用戶ID
   */
  static async clearClearConfirmationPending(userId) {
    try {
      const confirmations = await dataService.queryDocuments('pending_confirmations', {
        user_id: userId,
        action: 'clear_schedule',
      });

      for (const confirmation of confirmations) {
        await dataService.deleteDocument('pending_confirmations', confirmation.id);
      }
    } catch (error) {
      console.error('Error clearing confirmation pending:', error);
    }
  }

  /**
   * 處理課程修改
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async handleModifyCourse(entities, userId) {
    try {
      // 驗證必要參數：課程名稱是必須的，用於識別要修改的課程
      if (!entities.course_name) {
        return {
          success: false,
          error: 'Missing course name',
          message: '請指定要修改的課程名稱，例如：「修改數學課時間」',
        };
      }

      // 查找用戶的該課程
      const existingCourses = await dataService.getUserCourses(userId, {
        course_name: entities.course_name,
        status: 'scheduled',
      });

      if (existingCourses.length === 0) {
        return {
          success: false,
          error: 'Course not found',
          message: `找不到「${entities.course_name}」課程，請確認課程名稱是否正確`,
        };
      }

      // 如果有多個同名課程，修改最近的一個
      const courseToModify = existingCourses[0];

      // 構建修改數據，只包含提供的字段
      const updateData = {};
      let hasUpdates = false;

      // 處理時間信息修改
      if (entities.timeInfo) {
        if (TimeService.validateTimeInfo(entities.timeInfo)) {
          updateData.schedule_time = entities.timeInfo.display;
          updateData.course_date = entities.timeInfo.date;
          hasUpdates = true;
        } else {
          return {
            success: false,
            error: 'Invalid time information',
            message: '時間格式不正確，請重新輸入時間信息',
          };
        }
      }

      // 處理其他可修改字段
      if (entities.location) {
        updateData.location = entities.location;
        hasUpdates = true;
      }

      if (entities.teacher) {
        updateData.teacher = entities.teacher;
        hasUpdates = true;
      }

      // 如果沒有任何要修改的內容
      if (!hasUpdates) {
        return {
          success: false,
          error: 'No update fields provided',
          message: '請指定要修改的內容，例如：「修改數學課時間到下午3點」',
        };
      }

      // 調用 CourseService 執行修改
      const result = await CourseService.modifyCourse(courseToModify.id, updateData, {
        originalCourse: courseToModify,
        userId,
      });

      return {
        success: result.success,
        action: 'modify_course',
        message: result.message,
        modifiedFields: Object.keys(updateData),
        originalCourse: {
          name: courseToModify.course_name,
          originalTime: courseToModify.schedule_time,
          originalDate: courseToModify.course_date,
        },
        updatedCourse: result.updatedCourse,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '修改課程時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 驗證任務執行參數
   * @param {string} intent - 意圖
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Object} 驗證結果
   */
  static validateExecutionParams(intent, entities, userId) {
    if (!intent) {
      return {
        valid: false,
        error: 'Intent is required',
      };
    }

    if (!userId) {
      return {
        valid: false,
        error: 'User ID is required',
      };
    }

    if (!entities || typeof entities !== 'object') {
      return {
        valid: false,
        error: 'Entities must be an object',
      };
    }

    // 針對不同意圖進行特定驗證
    switch (intent) {
      case 'record_course':
        if (!entities.course_name) {
          return {
            valid: false,
            error: 'Course name is required for recording course',
          };
        }
        if (!entities.timeInfo) {
          return {
            valid: false,
            error: 'Time information is required for recording course',
          };
        }
        break;

      case 'cancel_course':
        if (!entities.course_name) {
          return {
            valid: false,
            error: 'Course name is required for cancelling course',
          };
        }
        break;

      case 'query_schedule':
        // 查詢課表不需要額外驗證
        break;

      default:
        return {
          valid: false,
          error: `Unknown intent: ${intent}`,
        };
    }

    return {
      valid: true,
    };
  }
}

module.exports = TaskService;
