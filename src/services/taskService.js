/**
 * TaskService - 任務執行協調層
 * 職責：協調各種意圖的業務邏輯執行
 * 禁止：直接調用底層實現，必須通過統一服務層
 * Phase 5: 原子化重構 Step 3
 */

const dataService = require('./dataService');
const TimeService = require('./timeService');

class TaskService {
  /**
   * 統一任務執行入口
   * @param {string} intent - 用戶意圖
   * @param {Object} entities - 實體信息（使用新契約：entities.timeInfo）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  static async executeIntent(intent, entities, userId) {
    if (!intent || !userId) {
      return {
        success: false,
        error: 'Missing required parameters',
        message: '缺少必要的參數信息',
      };
    }

    try {
      switch (intent) {
        case 'record_course':
          return this.handleRecordCourse(entities, userId);

        case 'cancel_course':
          return this.handleCancelCourse(entities, userId);

        case 'query_schedule':
          return this.handleQuerySchedule(userId);

        case 'modify_course':
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
