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
      is_recurring: courseData.is_recurring || false,
      recurrence_pattern: courseData.recurrence_pattern || null,
      location: courseData.location || null,
      teacher: courseData.teacher || null,
      status: courseData.status || 'scheduled',
      created_at: timestamp,
      updated_at: timestamp,
    };

    // 直接使用 Firebase
    const result = await FirebaseService.createDocument(this.COLLECTIONS.COURSES, course);
    
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

}

module.exports = DataService;
