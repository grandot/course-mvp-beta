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

        case 'query_today_courses_for_content':
          return await this.queryTodayCoursesForContent(entities, userId);

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
      // 🎯 修復：支持兩種數據結構
      let contentData = null;
      
      if (entities.content_entities) {
        // 新格式：content_entities
        contentData = entities.content_entities;
      } else if (entities.content_to_record) {
        // 舊格式：content_to_record
        contentData = {
          course_name: entities.course_name,
          lesson_content: entities.content_to_record,
          raw_text: entities.originalUserInput || entities.content_to_record,
          content_date: entities.timeInfo?.date || new Date().toISOString().split('T')[0]
        };
      } else {
        return {
          success: false,
          error: 'Missing course content entities',
          message: '缺少課程內容信息',
        };
      }
      
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
      const contentRecord = {
        course_id: courseId,
        student_id: userId,
        content_date: contentData.content_date,
        lesson_content: contentData.lesson_content,
        raw_input: {
          text: contentData.raw_text,
          extraction_metadata: {
            timestamp: new Date().toISOString(),
            method: 'TaskService'
          }
        },
        created_by: 'parent',
        source: 'line_bot'
      };

      const result = await DataService.createCourseContent(contentRecord);
      
      if (result.success) {
        return {
          success: true,
          action: 'record_lesson_content',
          message: `✅ 已記錄「${contentData.course_name || '課程'}」的上課內容`,
          contentId: result.contentId,
          course_name: contentData.course_name,
          content_summary: contentData.lesson_content || '課程內容記錄'
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
      let targetDate = null;
      
      // 🎯 解析時間信息（如：昨天、前天、上週）
      if (entities.timeInfo) {
        targetDate = entities.timeInfo.date;
      }
      
      // 🎯 檢測"上次"等模糊時間概念
      const originalInput = entities.originalUserInput || entities.raw_text || '';
      const isLastTimeQuery = originalInput.includes('上次') || originalInput.includes('上一次') || originalInput.includes('最近一次');
      
      // 查詢課程
      const queryParams = {
        course_name: entities.course_name || entities.content_entities?.course_name
      };
      
      // 🎯 處理"上次"查詢：不添加日期篩選，而是查詢所有相關課程然後排序
      if (!isLastTimeQuery && targetDate) {
        queryParams.course_date = targetDate;
      }
      
      // 🎯 添加學生名稱篩選（如果識別到）
      if (entities.student_name) {
        queryParams.student_name = entities.student_name;
        console.log(`🔧 [DEBUG] 添加學生篩選: ${entities.student_name}`);
      }
      
      const courses = await DataService.getUserCourses(userId, queryParams);
      
      if (courses.length === 0) {
        // 沒有找到課程，嘗試查詢近期課程
        const recentCourses = await DataService.getUserCourses(userId, {
          course_name: queryParams.course_name
        });
        
        // 從最近的課程中查找
        for (const course of recentCourses.slice(0, 5)) {
          if (course.notes && Array.isArray(course.notes)) {
            // 從 notes 中提取內容記錄
            for (const note of course.notes) {
              // 🎯 智能日期匹配：當精確匹配失敗時，允許 ±2 天彈性範圍
              if (targetDate && note.date) {
                const targetDateObj = new Date(targetDate + 'T00:00:00');
                const noteDateObj = new Date(note.date + 'T00:00:00');
                const daysDiff = Math.abs((targetDateObj - noteDateObj) / (1000 * 60 * 60 * 24));
                
                // 超過2天差距則跳過
                if (daysDiff > 2) continue;
                
                // 記錄日期差異用於後續排序和提示
                note._dateDiff = daysDiff;
                note._isExactMatch = daysDiff === 0;
              }
              
              contents.push({
                course_id: course.id,
                course_name: course.course_name,
                content_date: note.date || course.course_date,
                content: note.content || note,
                raw_text: note.raw_text,
                created_at: note.created_at,
                student_name: entities.student_name || course.student_name,
                date_difference: note._dateDiff || 0,
                is_exact_date_match: note._isExactMatch !== false
              });
            }
          }
        }
      } else {
        // 從找到的課程中提取內容
        for (const course of courses) {
          if (course.notes && Array.isArray(course.notes)) {
            for (const note of course.notes) {
              // 🎯 智能日期匹配：即使在精確課程匹配中，也應用彈性日期匹配
              let shouldInclude = true;
              let dateDiff = 0;
              let isExactMatch = true;
              
              if (targetDate && note.date) {
                const targetDateObj = new Date(targetDate + 'T00:00:00');
                const noteDateObj = new Date(note.date + 'T00:00:00');
                dateDiff = Math.abs((targetDateObj - noteDateObj) / (1000 * 60 * 60 * 24));
                isExactMatch = dateDiff === 0;
                
                // 超過2天差距則跳過
                if (dateDiff > 2) {
                  shouldInclude = false;
                }
              }
              
              if (shouldInclude) {
                contents.push({
                  course_id: course.id,
                  course_name: course.course_name,
                  content_date: note.date || course.course_date,
                  content: note.content || note,
                  raw_text: note.raw_text,
                  created_at: note.created_at,
                  student_name: entities.student_name || course.student_name,
                  date_difference: dateDiff,
                  is_exact_date_match: isExactMatch
                });
              }
            }
          }
        }
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

      // 🎯 智能排序：根據查詢類型決定排序策略
      if (isLastTimeQuery) {
        // "上次"查詢：按日期降序排序（最新的在前）
        contents.sort((a, b) => {
          const dateA = new Date(a.content_date || a.created_at || '1970-01-01');
          const dateB = new Date(b.content_date || b.created_at || '1970-01-01');
          return dateB - dateA; // 降序：最新的在前
        });
        console.log(`🔧 [DEBUG] "上次"查詢排序：按日期降序，最新記錄優先`);
      } else {
        // 一般查詢：精確匹配優先，然後按日期相近程度排序
        contents.sort((a, b) => {
          // 精確匹配優先
          if (a.is_exact_date_match && !b.is_exact_date_match) return -1;
          if (!a.is_exact_date_match && b.is_exact_date_match) return 1;
          
          // 然後按日期差異排序
          return (a.date_difference || 0) - (b.date_difference || 0);
        });
      }
      
      // 🎯 生成智能友好的查詢結果消息
      let message = '';
      const hasExactMatch = contents.some(c => c.is_exact_date_match);
      const hasNearMatch = contents.some(c => !c.is_exact_date_match && c.date_difference > 0);
      
      if (contents.length === 1) {
        // 單一記錄，顯示詳細內容
        const content = contents[0];
        const dateStr = content.content_date || '未知日期';
        
        // 🎯 智能日期提示
        let datePrefix = '';
        if (isLastTimeQuery) {
          datePrefix = '上次的記錄：';
        } else if (!content.is_exact_date_match && content.date_difference > 0) {
          const daysDiff = Math.round(content.date_difference);
          if (daysDiff === 1) {
            datePrefix = targetDate ? '沒找到確切日期的記錄，但找到相近的：' : '';
          } else if (daysDiff === 2) {
            datePrefix = targetDate ? '沒找到確切日期的記錄，但找到前天的：' : '';
          }
        }
        
        message = `${datePrefix}📚 ${content.course_name} (${dateStr})\n`;
        
        if (content.raw_text) {
          message += `\n💬 課程記錄：${content.raw_text}`;
        } else if (content.content) {
          message += `\n📝 內容：${JSON.stringify(content.content)}`;
        }
        
        if (content.student_name) {
          message += `\n👶 學生：${content.student_name}`;
        }
      } else {
        // 多條記錄，顯示摘要
        const exactMatchCount = contents.filter(c => c.is_exact_date_match).length;
        const nearMatchCount = contents.length - exactMatchCount;
        
        let headerMessage = entities.course_name ? 
          `找到「${entities.course_name}」的 ${contents.length} 項記錄` : 
          `找到 ${contents.length} 項課程內容記錄`;
        
        // 🎯 智能日期匹配提示
        if (targetDate && nearMatchCount > 0) {
          if (exactMatchCount === 0) {
            headerMessage += `（沒有精確匹配，以下為相近日期）`;
          } else {
            headerMessage += `（包含 ${exactMatchCount} 項精確匹配，${nearMatchCount} 項相近日期）`;
          }
        }
        
        message = headerMessage + '：\n';
          
        // 顯示最近3條記錄，按相關性排序顯示
        contents.slice(0, 3).forEach((content, index) => {
          const dateStr = content.content_date || '未知日期';
          const matchIndicator = content.is_exact_date_match ? '' : 
            (content.date_difference === 1 ? ' [相近]' : 
             content.date_difference === 2 ? ' [前天]' : ' [相近]');
          
          message += `\n${index + 1}. ${content.course_name} (${dateStr})${matchIndicator}`;
          if (content.raw_text) {
            const preview = content.raw_text.substring(0, 50);
            message += `\n   ${preview}${content.raw_text.length > 50 ? '...' : ''}`;
          }
        });
        
        if (contents.length > 3) {
          message += `\n\n...還有 ${contents.length - 3} 項記錄`;
        }
      }
      
      return {
        success: true,
        action: 'query_course_content',
        message: message,
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
  /**
   * 🎯 剃刀法則：查詢今天課程以記錄內容（最簡實現）
   * @param {Object} entities - 實體信息
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 查詢結果
   */
  async queryTodayCoursesForContent(entities, userId) {
    try {
      const TimeService = require('./timeService');
      const EntityService = require('./entityService');
      
      // 獲取今天日期
      const today = TimeService.formatForStorage(TimeService.getCurrentUserTime());
      
      // 查詢今天的課程
      const todayCourses = await EntityService.queryEntities('courses', {
        student_id: userId,
        course_date: today,
        status: 'scheduled'
      });
      
      const contentToRecord = entities.content_to_record || entities.originalUserInput || '課程內容';
      
      if (todayCourses.length === 0) {
        return {
          success: false,
          action: 'no_courses_today',
          message: `今天沒有安排課程。\n\n要記錄的內容：「${contentToRecord}」\n\n是否要新增今天的課程？`,
          requiresConfirmation: true,
          pendingContent: contentToRecord
        };
      }
      
      if (todayCourses.length === 1) {
        // 只有一堂課，直接確認記錄
        const course = todayCourses[0];
        return {
          success: false,
          action: 'confirm_single_course',
          message: `要將內容「${contentToRecord}」記錄到今天的${course.course_name}嗎？`,
          requiresConfirmation: true,
          targetCourse: course,
          pendingContent: contentToRecord
        };
      }
      
      // 多堂課，讓用戶選擇
      const courseOptions = todayCourses.map((course, index) => {
        const timeInfo = course.schedule_time ? ` (${course.schedule_time})` : '';
        return `${index + 1}. ${course.course_name}${timeInfo}`;
      }).join('\n');
      
      return {
        success: false,
        action: 'select_course_for_content',
        message: `今天有${todayCourses.length}堂課程，請選擇要記錄內容的課程：\n\n${courseOptions}\n\n要記錄的內容：「${contentToRecord}」`,
        courses: todayCourses,
        pendingContent: contentToRecord,
        requiresSelection: true
      };
      
    } catch (error) {
      console.error('❌ [TaskService] queryTodayCoursesForContent failed:', error.message);
      return {
        success: false,
        error: 'Query failed',
        message: '查詢今天課程時發生錯誤，請稍後再試'
      };
    }
  }
}

module.exports = TaskService;