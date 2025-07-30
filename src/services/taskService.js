/**
 * TaskService - 任務執行協調層（重構為Scenario Layer架構）
 * 職責：協調單一場景模板的業務邏輯執行
 * 架構變更：從直接處理業務邏輯改為委託給場景模板
 * 設計原則：
 * - 啟動時載入單一場景，不支持動態切換
 * - 純協調邏輯，所有業務邏輯委託給場景模板
 * - 保持向後兼容的介面
 */

const ScenarioManager = require('../scenario/ScenarioManager');

class TaskService {
  constructor() {
    // ⚡ 性能優化：使用預加載的當前場景實例
    try {
      this.scenarioTemplate = ScenarioManager.getCurrentScenario();
      const scenarioType = this.scenarioTemplate.getScenarioName();
      // 🎯 優化：簡化初始化日誌，一行即可
      console.log(`✅ [TaskService] Initialized: ${scenarioType} (${this.scenarioTemplate.getEntityType()})`);
    } catch (error) {
      console.error(`❌ [TaskService] Initialization failed: ${error.message}`);
      throw new Error(`TaskService initialization failed: ${error.message}`);
    }
  }

  /**
   * 統一任務執行入口 - 委託給場景模板
   * @param {string} intent - 用戶意圖
   * @param {Object} entities - 實體信息（使用新契約：entities.timeInfo）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async executeIntent(intent, entities, userId) {
    // 🎯 優化：簡化參數日誌，只在 debug 模式顯示詳細信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [TaskService] ${intent} - User: ${userId}`);
    }

    if (!intent || !userId) {
      return {
        success: false,
        error: 'Missing required parameters',
        message: '缺少必要的參數信息',
      };
    }

    try {
      // 🎯 優化：直接委託，無需逐步記錄日誌
      switch (intent) {
        case 'record_course':
          return await this.scenarioTemplate.createEntity(entities, userId);

        case 'create_recurring_course':
          return await this.scenarioTemplate.createRecurringEntity(entities, userId);

        case 'modify_course':
          return await this.scenarioTemplate.modifyEntity(entities, userId);

        case 'modify_recurring_course':
          return await this.scenarioTemplate.modifyRecurringEntity(entities, userId);

        case 'cancel_course':
          return await this.scenarioTemplate.cancelEntity(entities, userId);

        case 'stop_recurring_course':
          return await this.scenarioTemplate.stopRecurringEntity(entities, userId);

        case 'query_schedule': {
          const options = this._calculateDateRange(entities);
          return await this.scenarioTemplate.queryEntities(userId, options);
        }

        case 'clear_schedule':
          return await this.scenarioTemplate.clearAllEntities(entities, userId);

        case 'set_reminder':
          return {
            success: false,
            error: 'Feature not implemented',
            message: '此功能將在後續版本中實現',
          };

        // ===============================
        // 課程內容管理意圖 (Course Content)
        // ===============================

        case 'record_lesson_content':
          return await this.recordLessonContent(entities, userId);

        case 'record_homework':
          return await this.recordHomework(entities, userId);

        case 'upload_class_photo':
          return await this.uploadClassPhoto(entities, userId);

        case 'query_course_content':
          return await this.queryCourseContent(entities, userId);

        case 'modify_course_content':
          return await this.modifyCourseContent(entities, userId);

        default:
          return {
            success: false,
            error: 'Unknown intent',
            message: '抱歉，我無法理解您的需求，請重新描述',
          };
      }
    } catch (error) {
      // 🎯 優化：簡化錯誤日誌
      console.error(`❌ [TaskService] ${intent} failed:`, error.message);
      return {
        success: false,
        error: error.message,
        message: '處理請求時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 獲取當前場景模板信息
   * @returns {Object} 場景模板信息
   */
  getScenarioInfo() {
    if (!this.scenarioTemplate) {
      return null;
    }

    return {
      scenarioName: this.scenarioTemplate.getScenarioName(),
      entityType: this.scenarioTemplate.getEntityType(),
      entityName: this.scenarioTemplate.getEntityName(),
      config: this.scenarioTemplate.getConfig()
    };
  }

  /**
   * 驗證場景模板是否正確初始化
   * @returns {boolean} 是否已正確初始化
   */
  isInitialized() {
    return !!this.scenarioTemplate;
  }

  /**
   * 獲取場景配置
   * @returns {Object} 場景配置
   */
  getScenarioConfig() {
    return this.scenarioTemplate ? this.scenarioTemplate.getConfig() : null;
  }

  /**
   * 驗證任務執行參數（保持向後兼容）
   * @param {string} intent - 意圖
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Object} 驗證結果 { valid, error }
   */
  validateExecutionParams(intent, entities, userId) {
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

    // 委託給場景模板進行特定驗證
    if (this.scenarioTemplate) {
      try {
        const validation = this.scenarioTemplate.validateRequiredFields(entities);
        if (!validation.isValid) {
          return {
            valid: false,
            error: `Missing required fields: ${validation.missingFields.join(', ')}`,
          };
        }
      } catch (error) {
        console.warn('[TaskService] Scenario validation failed:', error.message);
        // 不阻斷流程，讓場景模板自己處理
      }
    }

    return {
      valid: true,
    };
  }

  /**
   * 計算查詢日期範圍
   * @param {Object} entities - 實體信息（包含 timeInfo）
   * @returns {Object} 日期範圍選項 { startDate, endDate }
   */
  _calculateDateRange(entities) {
    const TimeService = require('./timeService');
    
    // 🎯 輔助函數：統一創建返回對象（包含student_name支持）
    const createResult = (startDate, endDate) => {
      const result = { startDate, endDate };
      if (entities.student_name) {
        result.student_name = entities.student_name;
        console.log(`🔧 [DEBUG] _calculateDateRange - 檢測到學生過濾: ${entities.student_name}`);
      }
      return result;
    };
    
    // 獲取當前時間作為基準
    const today = TimeService.getCurrentUserTime();
    
    // 檢查是否為週查詢（無論是否有 timeInfo）
    // 🔧 修復：優先檢查原始用戶輸入，這是最準確的來源
    let checkText = '';
    
    // 嘗試從多個來源獲取原始文本或關鍵詞（按優先級排序）
    if (entities.originalUserInput) {
      checkText = entities.originalUserInput;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用原始用戶輸入: "${checkText}"`);
    } else if (entities.course_name) {
      checkText = entities.course_name;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 course_name: "${checkText}"`);
    } else if (entities.raw_text) {
      checkText = entities.raw_text;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 raw_text: "${checkText}"`);
    } else if (entities.timeInfo && entities.timeInfo.raw) {
      checkText = entities.timeInfo.raw;
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用 timeInfo.raw: "${checkText}"`);
    }
    
    // 檢查文本中的時間範圍關鍵詞
    // 🚨 關鍵修復：最具體的匹配條件必須放在前面，避免被包含匹配
    if (checkText) {
      // 🆕 月查詢處理 - 最高優先級
      if (checkText.includes('下下月')) {
        // 返回下下月的範圍
        const nextNextMonth = new Date(today);
        nextNextMonth.setMonth(nextNextMonth.getMonth() + 2);
        const startOfMonth = TimeService.getStartOfMonth(nextNextMonth);
        const endOfMonth = TimeService.getEndOfMonth(nextNextMonth);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下下月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      } else if (checkText.includes('下月')) {
        // 返回下月的範圍
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const startOfMonth = TimeService.getStartOfMonth(nextMonth);
        const endOfMonth = TimeService.getEndOfMonth(nextMonth);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      } else if (checkText.includes('本月') || checkText.includes('這個月') || checkText.includes('這月')) {
        // 返回本月的範圍
        const startOfMonth = TimeService.getStartOfMonth(today);
        const endOfMonth = TimeService.getEndOfMonth(today);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「本月」查詢，範圍: ${TimeService.formatForStorage(startOfMonth)} 到 ${TimeService.formatForStorage(endOfMonth)}`);
        return createResult(
          TimeService.formatForStorage(startOfMonth),
          TimeService.formatForStorage(endOfMonth)
        );
      }
      // 週查詢處理 - 次要優先級
      else if (checkText.includes('下下週') || checkText.includes('下下周')) {
        // 返回下下週的範圍 - 最具體的條件放在最前面
        const nextNextWeek = new Date(today);
        nextNextWeek.setDate(nextNextWeek.getDate() + 14);
        const startOfWeek = TimeService.getStartOfWeek(nextNextWeek);
        const endOfWeek = TimeService.getEndOfWeek(nextNextWeek);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下下週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      } else if (checkText.includes('下週') || checkText.includes('下周')) {
        // 返回下週的範圍 - 放在下下週之後
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const startOfWeek = TimeService.getStartOfWeek(nextWeek);
        const endOfWeek = TimeService.getEndOfWeek(nextWeek);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「下週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      } else if (checkText.includes('這週') || checkText.includes('這周') ||
          checkText.includes('本週') || checkText.includes('本周')) {
        // 返回這週的範圍
        const startOfWeek = TimeService.getStartOfWeek(today);
        const endOfWeek = TimeService.getEndOfWeek(today);
        console.log(`🔧 [DEBUG] _calculateDateRange - 識別為「這週」查詢，範圍: ${TimeService.formatForStorage(startOfWeek)} 到 ${TimeService.formatForStorage(endOfWeek)}`);
        return createResult(
          TimeService.formatForStorage(startOfWeek),
          TimeService.formatForStorage(endOfWeek)
        );
      }
    }
    
    // 如果有具體的時間信息，使用該時間信息計算範圍
    if (entities.timeInfo && entities.timeInfo.date) {
      const targetDate = new Date(entities.timeInfo.date);
      
      // 返回指定日期的範圍（當天）
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      console.log(`🔧 [DEBUG] _calculateDateRange - 使用具體日期，範圍: ${TimeService.formatForStorage(startOfDay)} 到 ${TimeService.formatForStorage(endOfDay)}`);
      return createResult(
        TimeService.formatForStorage(startOfDay),
        TimeService.formatForStorage(endOfDay)
      );
    }
    
    // 🎯 第一性原則：添加student_name過濾支持
    const result = {};
    
    // 從entities中提取student_name（如果存在）
    if (entities.student_name) {
      result.student_name = entities.student_name;
      console.log(`🔧 [DEBUG] _calculateDateRange - 檢測到學生過濾: ${entities.student_name}`);
    }
    
    // 默認返回（可能包含student_name，不限制時間範圍，使用場景模板的默認範圍）
    console.log(`🔧 [DEBUG] _calculateDateRange - 無法識別特定時間範圍，使用預設4週範圍`);
    return result;
  }

  // ===============================
  // 課程內容業務邏輯 (Course Content Business Logic)
  // ===============================

  /**
   * 記錄課程內容
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async recordLessonContent(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      // 驗證必要參數
      if (!entities.content_entities) {
        return {
          success: false,
          error: 'Missing course content entities',
          message: '缺少課程內容信息',
        };
      }

      const { content_entities } = entities;
      
      // 查找或創建關聯的課程
      let courseId = await this.findOrCreateCourse(entities, userId);
      if (!courseId) {
        return {
          success: false,
          error: 'Failed to find or create course',
          message: '無法找到或創建關聯的課程',
        };
      }

      // 創建課程內容記錄
      const contentData = {
        course_id: courseId,
        student_id: userId,
        content_date: content_entities.content_date,
        lesson_content: content_entities.lesson_content,
        raw_input: {
          text: content_entities.raw_text,
          extraction_metadata: {
            timestamp: new Date().toISOString(),
            method: 'TaskService'
          }
        },
        created_by: 'parent',
        source: 'line_bot'
      };

      const result = await DataService.createCourseContent(contentData);
      
      if (result.success) {
        return {
          success: true,
          action: 'record_lesson_content',
          message: `✅ 已記錄「${content_entities.course_name || '課程'}」的上課內容`,
          contentId: result.contentId,
          course_name: content_entities.course_name,
          content_summary: content_entities.lesson_content?.title || '課程內容記錄'
        };
      } else {
        return {
          success: false,
          error: result.error,
          message: '記錄課程內容時發生錯誤',
        };
      }

    } catch (error) {
      console.error('❌ [TaskService] recordLessonContent failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: '記錄課程內容時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 記錄作業
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async recordHomework(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      if (!entities.content_entities) {
        return {
          success: false,
          error: 'Missing homework entities',
          message: '缺少作業信息',
        };
      }

      const { content_entities } = entities;
      
      // 查找或創建關聯的課程
      let courseId = await this.findOrCreateCourse(entities, userId);
      if (!courseId) {
        return {
          success: false,
          error: 'Failed to find or create course',
          message: '無法找到或創建關聯的課程',
        };
      }

      // 創建作業記錄
      const contentData = {
        course_id: courseId,
        student_id: userId,
        content_date: content_entities.content_date,
        homework_assignments: content_entities.homework_assignments,
        raw_input: {
          text: content_entities.raw_text,
          extraction_metadata: {
            timestamp: new Date().toISOString(),
            method: 'TaskService'
          }
        },
        created_by: 'parent',
        source: 'line_bot'
      };

      const result = await DataService.createCourseContent(contentData);
      
      if (result.success) {
        const homeworkCount = content_entities.homework_assignments?.length || 0;
        return {
          success: true,
          action: 'record_homework',
          message: `✅ 已記錄「${content_entities.course_name || '課程'}」的 ${homeworkCount} 項作業`,
          contentId: result.contentId,
          course_name: content_entities.course_name,
          homework_count: homeworkCount
        };
      } else {
        return {
          success: false,
          error: result.error,
          message: '記錄作業時發生錯誤',
        };
      }

    } catch (error) {
      console.error('❌ [TaskService] recordHomework failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: '記錄作業時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 上傳課堂照片
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async uploadClassPhoto(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      if (!entities.content_entities) {
        return {
          success: false,
          error: 'Missing media entities',
          message: '缺少媒體信息',
        };
      }

      const { content_entities } = entities;
      
      // 查找或創建關聯的課程
      let courseId = await this.findOrCreateCourse(entities, userId);
      if (!courseId) {
        return {
          success: false,
          error: 'Failed to find or create course',
          message: '無法找到或創建關聯的課程',
        };
      }

      // 創建媒體記錄
      const contentData = {
        course_id: courseId,
        student_id: userId,
        content_date: content_entities.content_date,
        class_media: content_entities.class_media,
        raw_input: {
          text: content_entities.raw_text,
          extraction_metadata: {
            timestamp: new Date().toISOString(),
            method: 'TaskService'
          }
        },
        created_by: 'parent',
        source: 'line_bot'
      };

      const result = await DataService.createCourseContent(contentData);
      
      if (result.success) {
        const mediaCount = content_entities.class_media?.length || 0;
        return {
          success: true,
          action: 'upload_class_photo',
          message: `✅ 已上傳「${content_entities.course_name || '課程'}」的 ${mediaCount} 張照片`,
          contentId: result.contentId,
          course_name: content_entities.course_name,
          media_count: mediaCount
        };
      } else {
        return {
          success: false,
          error: result.error,
          message: '上傳課堂照片時發生錯誤',
        };
      }

    } catch (error) {
      console.error('❌ [TaskService] uploadClassPhoto failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: '上傳課堂照片時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 查詢課程內容
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async queryCourseContent(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      let contents = [];
      
      if (entities.course_name) {
        // 先查找課程
        const courses = await DataService.getUserCourses(userId, {
          course_name: entities.course_name
        });
        
        if (courses.length > 0) {
          // 獲取特定課程的內容
          for (const course of courses) {
            const courseContents = await DataService.getCourseContentsByCourse(course.id);
            contents = contents.concat(courseContents);
          }
        }
      } else {
        // 查詢所有學生的課程內容
        contents = await DataService.getCourseContentsByStudent(userId);
      }

      if (contents.length === 0) {
        return {
          success: true,
          action: 'query_course_content',
          message: entities.course_name ? 
            `目前沒有「${entities.course_name}」的內容記錄` : 
            '目前沒有任何課程內容記錄',
          contents: [],
          total_count: 0
        };
      }

      // 統計信息
      let lessonCount = 0;
      let homeworkCount = 0;
      let mediaCount = 0;
      
      contents.forEach(content => {
        if (content.lesson_content) lessonCount++;
        if (content.homework_assignments?.length > 0) {
          homeworkCount += content.homework_assignments.length;
        }
        if (content.class_media?.length > 0) {
          mediaCount += content.class_media.length;
        }
      });

      return {
        success: true,
        action: 'query_course_content',
        message: entities.course_name ? 
          `找到「${entities.course_name}」的 ${contents.length} 項記錄` : 
          `找到 ${contents.length} 項課程內容記錄`,
        contents: contents.slice(0, 10), // 限制返回數量
        total_count: contents.length,
        summary: {
          lesson_records: lessonCount,
          homework_assignments: homeworkCount,
          media_files: mediaCount
        }
      };

    } catch (error) {
      console.error('❌ [TaskService] queryCourseContent failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: '查詢課程內容時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 修改課程內容
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 執行結果
   */
  async modifyCourseContent(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      // TODO: 實現課程內容修改邏輯
      // 這需要更複雜的實體識別來確定要修改的具體內容
      
      return {
        success: false,
        error: 'Feature not fully implemented',
        message: '課程內容修改功能將在後續版本中完善',
      };

    } catch (error) {
      console.error('❌ [TaskService] modifyCourseContent failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: '修改課程內容時發生錯誤，請稍後再試',
      };
    }
  }

  /**
   * 查找或創建關聯的課程
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<string|null>} 課程ID
   */
  async findOrCreateCourse(entities, userId) {
    const DataService = require('./dataService');
    
    try {
      const courseName = entities.content_entities?.course_name || entities.course_name;
      
      if (!courseName) {
        console.warn('[TaskService] No course name provided for content record');
        return null;
      }

      // 先嘗試查找現有課程
      const existingCourses = await DataService.getUserCourses(userId, {
        course_name: courseName
      });

      if (existingCourses.length > 0) {
        // 返回最新的課程ID
        return existingCourses[0].id;
      }

      // 如果沒有找到，創建新課程
      const courseData = {
        student_id: userId,
        course_name: courseName,
        schedule_time: 'TBD',
        course_date: entities.content_entities?.content_date || new Date().toISOString().split('T')[0],
        status: 'scheduled',
        created_by: 'system_for_content'
      };

      const createResult = await DataService.createCourse(courseData);
      
      if (createResult.success) {
        console.log(`📝 [TaskService] Created course for content: ${courseName}`);
        return createResult.courseId;
      }

      return null;

    } catch (error) {
      console.error('❌ [TaskService] findOrCreateCourse failed:', error.message);
      return null;
    }
  }

  /**
   * 靜態工廠方法 - 創建TaskService實例
   * @param {string} scenarioType - 場景類型（可選，默認從環境變數讀取）
   * @returns {TaskService} TaskService實例
   */
  static createInstance(scenarioType = null) {
    // 暫時設置環境變數（如果提供了參數）
    const originalScenarioType = process.env.SCENARIO_TYPE;
    if (scenarioType) {
      process.env.SCENARIO_TYPE = scenarioType;
    }

    try {
      const instance = new TaskService();
      return instance;
    } finally {
      // 恢復原始環境變數
      if (scenarioType && originalScenarioType !== undefined) {
        process.env.SCENARIO_TYPE = originalScenarioType;
      }
    }
  }
}

module.exports = TaskService;