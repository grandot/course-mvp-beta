/**
 * DataService - 數據處理統一入口
 * 職責：數據存取、查詢、格式化
 * 禁止：直接調用 Firebase
 * Phase 4: Firebase 實現（持久化存儲）
 */
const TimeService = require('./timeService');
const FirebaseService = require('../internal/firebaseService');

class DataService {
  // Firebase 集合名稱
  static COLLECTIONS = {
    COURSES: 'courses',
    COURSE_CONTENTS: 'course_contents',
    TOKEN_USAGE: 'token_usage'
  };


  /**
   * 生成 UUID v4
   * @returns {string} UUID v4 格式的字符串
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      // eslint-disable-next-line no-bitwise
      const r = Math.random() * 16 | 0;
      // eslint-disable-next-line no-bitwise
      const v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  }


  /**
   * 創建課程記錄
   * @param {Object} courseData - 課程數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createCourse(courseData) {
    if (!courseData) {
      throw new Error('DataService: courseData is required');
    }

    // 驗證重複課程類型一致性
    this.validateRecurrenceType(courseData);

    let timestamp;
    try {
      timestamp = TimeService.getCurrentUserTime().toISOString();
    } catch (error) {
      // 如果 TimeService 失敗，使用系統時間作為後備
      console.warn('TimeService failed, using system time:', error.message);
      timestamp = TimeService.getCurrentUserTime().toISOString();
    }

    const course = {
      student_id: courseData.student_id,
      course_name: courseData.course_name,
      schedule_time: courseData.schedule_time,
      course_date: courseData.course_date,
      
      // 保留舊的重複課程欄位以維持向後相容性
      is_recurring: courseData.is_recurring || false,
      recurrence_pattern: courseData.recurrence_pattern || null,
      
      // 新增：三個布林欄位標註重複類型
      daily_recurring: courseData.daily_recurring || false,
      weekly_recurring: courseData.weekly_recurring || false,
      monthly_recurring: courseData.monthly_recurring || false,
      
      // 新增：重複詳細資訊
      recurrence_details: courseData.recurrence_details || null,
      
      location: courseData.location || null,
      teacher: courseData.teacher || null,
      status: courseData.status || 'scheduled',
      created_at: timestamp,
      updated_at: timestamp,
    };

    // 直接使用 Firebase
    const result = await FirebaseService.createDocument(this.COLLECTIONS.COURSES, course);
    
    console.log(`📝 Course created: ${courseData.course_name} (Recurring: ${this.getRecurrenceLabel(course)})`);
    
    return {
      success: true,
      courseId: result.id,
      course: result.data,
    };
  }

  /**
   * 獲取用戶課程列表
   * @param {string} userId - 用戶ID
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 課程列表
   */
  static async getUserCourses(userId, filters = {}) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    // 直接使用 Firebase
    const queryFilters = { student_id: userId, ...filters };
    const courses = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSES, queryFilters);
    
    return this.applyFilters(courses, filters);
  }

  /**
   * 應用篩選條件到課程列表
   * @param {Array} courses - 課程列表
   * @param {Object} filters - 篩選條件
   * @returns {Array} 篩選後的課程列表
   */
  static applyFilters(courses, filters) {
    let filteredCourses = courses;

    if (filters.status) {
      filteredCourses = filteredCourses.filter((course) => course.status === filters.status);
    }

    if (filters.course_name) {
      filteredCourses = filteredCourses.filter(
        (course) => course.course_name.toLowerCase()
          .includes(filters.course_name.toLowerCase()),
      );
    }

    if (filters.date_from || filters.date_to) {
      filteredCourses = filteredCourses.filter((course) => {
        const courseDate = course.course_date;
        if (filters.date_from && courseDate < filters.date_from) return false;
        if (filters.date_to && courseDate > filters.date_to) return false;
        return true;
      });
    }

    return filteredCourses;
  }

  /**
   * 更新課程信息
   * @param {string} courseId - 課程ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  static async updateCourse(courseId, updateData) {
    if (!courseId) {
      throw new Error('DataService: courseId is required');
    }

    if (!updateData) {
      throw new Error('DataService: updateData is required');
    }

    try {
      console.log('🔧 DataService.updateCourse - Input:', { courseId, updateData });

      const updatedData = {
        ...updateData,
        updated_at: TimeService.getCurrentUserTime().toISOString(),
      };

      console.log('🔧 DataService.updateCourse - Processed data:', updatedData);

      const result = await FirebaseService.updateDocument(this.COLLECTIONS.COURSES, courseId, updatedData);

      console.log('🔧 DataService.updateCourse - Firebase result:', result);

      return {
        success: true,
        courseId: result.id,
        course: result.data,
      };
    } catch (error) {
      console.error('❌ DataService.updateCourse failed:', {
        courseId,
        updateData,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        courseId,
        details: `Database update failed for course ${courseId}: ${error.message}`
      };
    }
  }

  /**
   * 刪除課程記錄
   * @param {string} courseId - 課程ID
   * @returns {Promise<boolean>} 刪除是否成功
   */
  static async deleteCourse(courseId) {
    if (!courseId) {
      throw new Error('DataService: courseId is required');
    }

    await FirebaseService.deleteDocument(this.COLLECTIONS.COURSES, courseId);
    return true;
  }

  /**
   * 根據課程ID獲取課程記錄
   * @param {string} courseId - 課程ID
   * @returns {Promise<Object|null>} 課程記錄，如果不存在則返回null
   */
  static async getCourseById(courseId) {
    if (!courseId) {
      throw new Error('DataService: courseId is required');
    }

    try {
      console.log('🔧 DataService.getCourseById - CourseId:', courseId);

      const result = await FirebaseService.getDocument(this.COLLECTIONS.COURSES, courseId);
      
      console.log('🔧 DataService.getCourseById - Firebase result:', {
        exists: result?.exists,
        hasData: !!result?.data
      });

      if (!result || !result.exists) {
        console.log('🔧 DataService.getCourseById - Course not found');
        return null;
      }

      const course = {
        id: result.id,
        ...result.data,
      };

      console.log('🔧 DataService.getCourseById - Found course:', course.course_name);

      return course;
    } catch (error) {
      console.error('❌ DataService.getCourseById failed:', {
        courseId,
        error: error.message,
        stack: error.stack
      });
      
      throw new Error(`DataService: Failed to get course by ID: ${error.message}`);
    }
  }

  /**
   * 查詢課程記錄
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  static async queryCourses(criteria) {
    if (!criteria) {
      throw new Error('DataService: criteria is required');
    }

    try {
      console.log('🔧 DataService.queryCourses - Criteria:', criteria);
      
      const result = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSES, criteria);
      
      console.log('🔧 DataService.queryCourses - Found courses:', result?.length || 0);
      
      return result;
    } catch (error) {
      console.error('❌ DataService.queryCourses failed:', {
        criteria,
        error: error.message,
        stack: error.stack
      });
      
      throw new Error(`Course query failed: ${error.message}`);
    }
  }

  /**
   * 記錄 token 使用量
   * @param {Object} usageData - 使用量數據
   * @returns {Promise<Object>} 記錄結果
   */
  static async recordTokenUsage(usageData) {
    if (!usageData) {
      throw new Error('DataService: usageData is required');
    }

    const timestamp = TimeService.getCurrentUserTime().toISOString();

    const usage = {
      user_id: usageData.user_id,
      model: usageData.model,
      total_tokens: usageData.total_tokens,
      total_cost_twd: usageData.total_cost_twd,
      user_message: usageData.user_message,
      timestamp,
    };

    // 直接使用 Firebase
    const result = await FirebaseService.createDocument(this.COLLECTIONS.TOKEN_USAGE, usage);
    
    return {
      success: true,
      entryId: result.id,
      usage: result.data,
    };
  }

  /**
   * 記錄 token 使用量（別名方法，用於 logTokenUsage）
   * @param {Object} usageData - 使用量數據
   * @returns {Promise<Object>} 記錄結果
   */
  static async logTokenUsage(usageData) {
    return this.recordTokenUsage(usageData);
  }

  /**
   * 清空用戶所有課程記錄（批量刪除）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 刪除結果
   */
  static async clearUserCourses(userId) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    // 先獲取用戶所有課程
    const userCourses = await this.getUserCourses(userId);
    
    if (userCourses.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        message: 'No courses found for user',
      };
    }

    let deletedCount = 0;
    const errors = [];

    // 批量刪除每個課程
    for (const course of userCourses) {
      try {
        await FirebaseService.deleteDocument(this.COLLECTIONS.COURSES, course.id);
        deletedCount++;
      } catch (error) {
        errors.push({
          courseId: course.id,
          courseName: course.course_name,
          error: error.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      deletedCount,
      totalCourses: userCourses.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully deleted ${deletedCount} out of ${userCourses.length} courses`,
    };
  }

  /**
   * 創建通用文檔
   * @param {string} collection - 集合名稱
   * @param {Object} data - 文檔數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createDocument(collection, data) {
    if (!collection) {
      throw new Error('DataService: collection is required');
    }
    if (!data) {
      throw new Error('DataService: data is required');
    }

    const timestamp = TimeService.getCurrentUserTime().toISOString();
    const documentData = {
      ...data,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const result = await FirebaseService.createDocument(collection, documentData);
    return {
      success: true,
      id: result.id,
      data: result.data,
    };
  }

  /**
   * 獲取通用文檔
   * @param {string} collection - 集合名稱
   * @param {string} documentId - 文檔ID
   * @returns {Promise<Object|null>} 文檔數據
   */
  static async getDocumentById(collection, documentId) {
    if (!collection) {
      throw new Error('DataService: collection is required');
    }
    if (!documentId) {
      throw new Error('DataService: documentId is required');
    }

    return await FirebaseService.getDocument(collection, documentId);
  }

  /**
   * 更新通用文檔
   * @param {string} collection - 集合名稱
   * @param {string} documentId - 文檔ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  static async updateDocument(collection, documentId, updateData) {
    if (!collection) {
      throw new Error('DataService: collection is required');
    }
    if (!documentId) {
      throw new Error('DataService: documentId is required');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('DataService: updateData must be an object');
    }

    const timestamp = TimeService.getCurrentUserTime().toISOString();
    const enrichedUpdateData = {
      ...updateData,
      updated_at: timestamp,
    };

    const result = await FirebaseService.updateDocument(collection, documentId, enrichedUpdateData);
    return {
      success: true,
      id: result.id,
      data: result.data,
    };
  }

  /**
   * 查詢通用文檔
   * @param {string} collection - 集合名稱
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  static async queryDocuments(collection, criteria) {
    if (!collection) {
      throw new Error('DataService: collection is required');
    }
    if (!criteria) {
      throw new Error('DataService: criteria is required');
    }

    return await FirebaseService.queryDocuments(collection, criteria);
  }

  /**
   * 刪除通用文檔
   * @param {string} collection - 集合名稱
   * @param {string} documentId - 文檔ID
   * @returns {Promise<boolean>} 刪除結果
   */
  static async deleteDocument(collection, documentId) {
    if (!collection) {
      throw new Error('DataService: collection is required');
    }
    if (!documentId) {
      throw new Error('DataService: documentId is required');
    }

    await FirebaseService.deleteDocument(collection, documentId);
    return true;
  }

  /**
   * 驗證數據格式
   * @param {Object} data - 待驗證數據
   * @param {string} schema - 驗證模式
   * @returns {Promise<boolean>} 驗證結果
   */
  static async validateData(data, schema) {
    if (!data) {
      throw new Error('DataService: data is required');
    }

    if (!schema) {
      throw new Error('DataService: schema is required');
    }

    // 簡化版本驗證邏輯
    switch (schema) {
      case 'course':
        return !!(data.student_id && data.course_name && data.course_date);
      case 'token_usage':
        return !!(data.user_id && data.model && data.total_tokens);
      case 'generic_entity':
        // 通用實體驗證 - 確保基本字段存在
        return !!(data && typeof data === 'object');
      default:
        throw new Error(`DataService: Unknown schema: ${schema}`);
    }
  }

  /**
   * 驗證重複課程類型一致性
   * @param {Object} courseData - 課程數據
   * @throws {Error} 如果重複類型不一致
   */
  static validateRecurrenceType(courseData) {
    const types = [
      courseData.daily_recurring,
      courseData.weekly_recurring,
      courseData.monthly_recurring
    ].filter(Boolean);

    if (types.length > 1) {
      throw new Error('課程只能有一種重複類型');
    }

    const hasRecurrence = types.length === 1;
    const hasDetails = courseData.recurrence_details != null;

    // 如果有重複類型但沒有詳細資訊，拋出錯誤
    if (hasRecurrence && !hasDetails) {
      throw new Error('重複課程必須提供詳細資訊');
    }

    // 如果沒有重複類型但有詳細資訊，這是允許的（可能是從現有重複課程更新）
    return true;
  }

  /**
   * 獲取重複課程類型標籤
   * @param {Object} courseData - 課程數據
   * @returns {string} 重複類型標籤
   */
  static getRecurrenceLabel(courseData) {
    if (courseData.daily_recurring) return 'Daily';
    if (courseData.weekly_recurring) return 'Weekly';
    if (courseData.monthly_recurring) return 'Monthly';
    return 'None';
  }

  /**
   * 檢查課程是否為重複課程
   * @param {Object} course - 課程對象
   * @returns {boolean} 是否為重複課程
   */
  static isRecurringCourse(course) {
    return !!(course.daily_recurring || course.weekly_recurring || course.monthly_recurring);
  }

  /**
   * 查詢重複課程
   * @param {string} userId - 用戶ID
   * @param {string} recurrenceType - 重複類型 ('daily', 'weekly', 'monthly')
   * @returns {Promise<Array>} 重複課程列表
   */
  static async getRecurringCourses(userId, recurrenceType = null) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    let criteria = { student_id: userId };

    if (recurrenceType) {
      switch (recurrenceType) {
        case 'daily':
          criteria.daily_recurring = true;
          break;
        case 'weekly':
          criteria.weekly_recurring = true;
          break;
        case 'monthly':
          criteria.monthly_recurring = true;
          break;
        default:
          throw new Error(`Invalid recurrence type: ${recurrenceType}`);
      }
    } else {
      // 查詢所有重複課程
      criteria = {
        student_id: userId,
        $or: [
          { daily_recurring: true },
          { weekly_recurring: true },
          { monthly_recurring: true }
        ]
      };
    }

    return await this.queryCourses(criteria);
  }

  // ===============================
  // 課程內容管理 (Course Content)
  // ===============================

  /**
   * 創建課程內容記錄
   * @param {Object} contentData - 課程內容數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createCourseContent(contentData) {
    if (!contentData) {
      throw new Error('DataService: contentData is required');
    }

    if (!contentData.course_id) {
      throw new Error('DataService: course_id is required');
    }

    if (!contentData.student_id) {
      throw new Error('DataService: student_id is required');
    }

    const timestamp = TimeService.getCurrentUserTime().toISOString();

    const courseContent = {
      course_id: contentData.course_id,
      student_id: contentData.student_id,
      content_date: contentData.content_date || new Date().toISOString().split('T')[0],
      
      // 課程內容
      lesson_content: contentData.lesson_content || null,
      
      // 作業任務
      homework_assignments: contentData.homework_assignments || [],
      
      // 課堂媒體
      class_media: contentData.class_media || [],
      
      // 元數據
      created_at: timestamp,
      updated_at: timestamp,
      created_by: contentData.created_by || 'parent',
      source: contentData.source || 'manual',
      
      // 原始輸入
      raw_input: contentData.raw_input || null,
      
      // 狀態管理
      status: contentData.status || 'published',
      visibility: contentData.visibility || 'private'
    };

    const result = await FirebaseService.createDocument(this.COLLECTIONS.COURSE_CONTENTS, courseContent);
    
    console.log(`📝 Course content created: ${contentData.course_id}`);
    
    // 更新關聯課程的內容統計
    await this.updateCourseContentStats(contentData.course_id);
    
    return {
      success: true,
      contentId: result.id,
      content: result.data,
    };
  }

  /**
   * 根據ID獲取課程內容
   * @param {string} contentId - 內容ID
   * @returns {Promise<Object|null>} 課程內容記錄
   */
  static async getCourseContent(contentId) {
    if (!contentId) {
      throw new Error('DataService: contentId is required');
    }

    try {
      const result = await FirebaseService.getDocument(this.COLLECTIONS.COURSE_CONTENTS, contentId);
      
      if (!result || !result.exists) {
        return null;
      }

      return {
        id: result.id,
        ...result.data,
      };
    } catch (error) {
      console.error('❌ DataService.getCourseContent failed:', {
        contentId,
        error: error.message
      });
      
      throw new Error(`Failed to get course content: ${error.message}`);
    }
  }

  /**
   * 獲取特定課程的所有內容記錄
   * @param {string} courseId - 課程ID
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 內容記錄列表
   */
  static async getCourseContentsByCourse(courseId, filters = {}) {
    if (!courseId) {
      throw new Error('DataService: courseId is required');
    }

    try {
      const queryFilters = { course_id: courseId, ...filters };
      const contents = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSE_CONTENTS, queryFilters);
      
      // 按日期排序（最新的在前）
      return contents.sort((a, b) => new Date(b.content_date) - new Date(a.content_date));
    } catch (error) {
      console.error('❌ DataService.getCourseContentsByCourse failed:', {
        courseId,
        error: error.message
      });
      
      throw new Error(`Failed to get course contents: ${error.message}`);
    }
  }

  /**
   * 獲取學生的所有課程內容
   * @param {string} studentId - 學生ID
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 內容記錄列表
   */
  static async getCourseContentsByStudent(studentId, filters = {}) {
    if (!studentId) {
      throw new Error('DataService: studentId is required');
    }

    try {
      const queryFilters = { student_id: studentId, ...filters };
      const contents = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSE_CONTENTS, queryFilters);
      
      // 按日期排序（最新的在前）
      return contents.sort((a, b) => new Date(b.content_date) - new Date(a.content_date));
    } catch (error) {
      console.error('❌ DataService.getCourseContentsByStudent failed:', {
        studentId,
        error: error.message
      });
      
      throw new Error(`Failed to get student course contents: ${error.message}`);
    }
  }

  /**
   * 更新課程內容
   * @param {string} contentId - 內容ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  static async updateCourseContent(contentId, updateData) {
    if (!contentId) {
      throw new Error('DataService: contentId is required');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error('DataService: updateData is required and cannot be empty');
    }

    try {
      const updatedData = {
        ...updateData,
        updated_at: TimeService.getCurrentUserTime().toISOString(),
      };

      const result = await FirebaseService.updateDocument(this.COLLECTIONS.COURSE_CONTENTS, contentId, updatedData);

      return {
        success: true,
        contentId: result.id,
        content: result.data,
      };
    } catch (error) {
      console.error('❌ DataService.updateCourseContent failed:', {
        contentId,
        updateData,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        contentId,
        details: `Course content update failed: ${error.message}`
      };
    }
  }

  /**
   * 刪除課程內容
   * @param {string} contentId - 內容ID
   * @returns {Promise<boolean>} 刪除是否成功
   */
  static async deleteCourseContent(contentId) {
    if (!contentId) {
      throw new Error('DataService: contentId is required');
    }

    try {
      // 先獲取內容信息以便更新課程統計
      const content = await this.getCourseContent(contentId);
      
      await FirebaseService.deleteDocument(this.COLLECTIONS.COURSE_CONTENTS, contentId);
      
      // 更新關聯課程的內容統計
      if (content && content.course_id) {
        await this.updateCourseContentStats(content.course_id);
      }
      
      return true;
    } catch (error) {
      console.error('❌ DataService.deleteCourseContent failed:', {
        contentId,
        error: error.message
      });
      
      throw new Error(`Failed to delete course content: ${error.message}`);
    }
  }

  /**
   * 搜索課程內容
   * @param {Object} criteria - 搜索條件
   * @returns {Promise<Array>} 搜索結果
   */
  static async searchCourseContents(criteria) {
    if (!criteria || Object.keys(criteria).length === 0) {
      throw new Error('DataService: search criteria is required');
    }

    try {
      const contents = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSE_CONTENTS, criteria);
      
      // 按相關性和日期排序
      return contents.sort((a, b) => {
        // 首先按更新時間排序
        const timeA = new Date(a.updated_at);
        const timeB = new Date(b.updated_at);
        return timeB - timeA;
      });
    } catch (error) {
      console.error('❌ DataService.searchCourseContents failed:', {
        criteria,
        error: error.message
      });
      
      throw new Error(`Course content search failed: ${error.message}`);
    }
  }

  /**
   * 上傳課堂媒體文件
   * @param {Object} mediaData - 媒體數據
   * @returns {Promise<Object>} 上傳結果
   */
  static async uploadClassMedia(mediaData) {
    if (!mediaData) {
      throw new Error('DataService: mediaData is required');
    }

    if (!mediaData.file && !mediaData.url) {
      throw new Error('DataService: file or url is required');
    }

    const timestamp = TimeService.getCurrentUserTime().toISOString();

    const mediaRecord = {
      id: this.generateUUID(),
      type: mediaData.type || 'photo',
      url: mediaData.url,
      caption: mediaData.caption || '',
      upload_time: timestamp,
      tags: mediaData.tags || [],
      file_size: mediaData.file_size || 0,
      created_by: mediaData.created_by || 'parent'
    };

    return {
      success: true,
      media: mediaRecord
    };
  }

  /**
   * 刪除課堂媒體文件
   * @param {string} mediaId - 媒體ID
   * @returns {Promise<boolean>} 刪除是否成功
   */
  static async deleteClassMedia(mediaId) {
    if (!mediaId) {
      throw new Error('DataService: mediaId is required');
    }

    // TODO: 實現從 Firebase Storage 刪除文件的邏輯
    console.log(`Media file ${mediaId} deletion requested`);
    
    return true;
  }

  /**
   * 更新課程的內容統計
   * @param {string} courseId - 課程ID
   * @returns {Promise<void>}
   */
  static async updateCourseContentStats(courseId) {
    if (!courseId) {
      return;
    }

    try {
      // 獲取該課程的所有內容
      const contents = await this.getCourseContentsByCourse(courseId);
      
      let totalLessons = 0;
      let pendingHomework = 0;
      let completedHomework = 0;
      let totalMedia = 0;
      
      contents.forEach(content => {
        if (content.lesson_content) {
          totalLessons++;
        }
        
        if (content.homework_assignments && Array.isArray(content.homework_assignments)) {
          content.homework_assignments.forEach(hw => {
            if (hw.status === 'pending' || hw.status === 'in_progress') {
              pendingHomework++;
            } else if (hw.status === 'completed') {
              completedHomework++;
            }
          });
        }
        
        if (content.class_media && Array.isArray(content.class_media)) {
          totalMedia += content.class_media.length;
        }
      });

      // 更新課程記錄
      await this.updateCourse(courseId, {
        has_content: contents.length > 0,
        content_count: contents.length,
        last_content_update: contents.length > 0 ? contents[0].updated_at : null,
        content_summary: {
          total_lessons: totalLessons,
          pending_homework: pendingHomework,
          completed_homework: completedHomework,
          total_media: totalMedia
        }
      });
      
    } catch (error) {
      console.warn('Failed to update course content stats:', error.message);
      // 不拋出錯誤，避免影響主要操作
    }
  }

  /**
   * 驗證課程內容數據格式
   * @param {Object} contentData - 課程內容數據
   * @returns {boolean} 驗證結果
   */
  static validateCourseContentData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return false;
    }

    // 檢查必要字段
    if (!contentData.course_id || !contentData.student_id) {
      return false;
    }

    // 驗證日期格式
    if (contentData.content_date && !/^\d{4}-\d{2}-\d{2}$/.test(contentData.content_date)) {
      return false;
    }

    return true;
  }

}

module.exports = DataService;
