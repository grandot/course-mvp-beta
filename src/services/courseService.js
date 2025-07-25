/**
 * CourseService - 課程業務邏輯統一入口
 * 職責：課程相關業務邏輯處理
 * 依賴：DataService, TimeService
 */
const DataService = require('./dataService');
const TimeService = require('./timeService');

class CourseService {
  /**
   * 創建課程
   * @param {string} studentId - 學生ID
   * @param {string} courseName - 課程名稱
   * @param {string} scheduleTime - 排課時間描述
   * @param {Date} courseDate - 課程日期
   * @param {Object} options - 其他選項
   * @returns {Promise<Object>} 創建結果
   */
  static async createCourse(studentId, courseName, scheduleTime, courseDate, options = {}) {
    if (!studentId) {
      throw new Error('CourseService: studentId is required');
    }

    if (!courseName) {
      throw new Error('CourseService: courseName is required');
    }

    if (!courseDate) {
      throw new Error('CourseService: courseDate is required');
    }

    // 格式化課程日期為 YYYY-MM-DD
    const formattedDate = courseDate instanceof Date
      ? courseDate.toISOString().split('T')[0]
      : courseDate;

    const courseData = {
      student_id: studentId,
      course_name: courseName,
      schedule_time: scheduleTime || 'TBD',
      course_date: formattedDate,
      is_recurring: options.is_recurring || false,
      recurrence_pattern: options.recurrence_pattern || null,
      location: options.location || null,
      teacher: options.teacher || null,
      status: options.status || 'scheduled',
    };

    // 驗證數據格式
    const isValid = await DataService.validateData(courseData, 'course');
    if (!isValid) {
      throw new Error('CourseService: Invalid course data');
    }

    return DataService.createCourse(courseData);
  }

  /**
   * 獲取用戶課程列表
   * @param {string} studentId - 學生ID
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 課程列表
   */
  static async getCoursesByUser(studentId, filters = {}) {
    if (!studentId) {
      throw new Error('CourseService: studentId is required');
    }

    return DataService.getUserCourses(studentId, filters);
  }

  /**
   * 更新課程
   * @param {string} courseId - 課程ID
   * @param {Object} updateData - 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  static async updateCourse(courseId, updateData) {
    if (!courseId) {
      throw new Error('CourseService: courseId is required');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error('CourseService: updateData is required and cannot be empty');
    }

    // 如果更新課程日期，格式化為 YYYY-MM-DD
    const processedData = { ...updateData };
    if (processedData.courseDate) {
      processedData.course_date = processedData.courseDate instanceof Date
        ? processedData.courseDate.toISOString().split('T')[0]
        : processedData.courseDate;
      delete processedData.courseDate; // 移除原始鍵名
    }

    return DataService.updateCourse(courseId, processedData);
  }

  /**
   * 修改課程（高級更新方法，支持業務邏輯）
   * @param {string} courseId - 課程ID
   * @param {Object} updateData - 更新數據
   * @param {Object} options - 選項配置
   * @returns {Promise<Object>} 修改結果
   */
  static async modifyCourse(courseId, updateData, options = {}) {
    if (!courseId) {
      throw new Error('CourseService: courseId is required');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error('CourseService: updateData is required and cannot be empty');
    }

    const { originalCourse, userId } = options;

    // 記錄修改前的狀態
    const modificationLog = {
      courseId,
      userId,
      timestamp: TimeService.getCurrentUserTime().toISOString(),
      operationType: 'MODIFY_COURSE',
      originalData: originalCourse,
      updateData,
    };

    try {
      // 處理日期格式化
      const processedData = { ...updateData };
      if (processedData.course_date) {
        const formattedDate = processedData.course_date instanceof Date
          ? processedData.course_date.toISOString().split('T')[0]
          : processedData.course_date;
        processedData.course_date = formattedDate;
      }

      // 檢查時間衝突（如果修改了時間）
      if (processedData.schedule_time && processedData.course_date && originalCourse) {
        const conflicts = await this.checkTimeConflicts(
          userId || originalCourse.student_id,
          processedData.course_date,
          processedData.schedule_time,
        );

        // 排除當前課程本身
        const otherConflicts = conflicts.filter(c => c.id !== courseId);
        if (otherConflicts.length > 0) {
          return {
            success: false,
            error: 'Time conflict detected',
            message: `修改失敗：${processedData.course_date} ${processedData.schedule_time} 時間已有其他課程安排`,
            conflicts: otherConflicts,
          };
        }
      }

      // 執行更新
      const updateResult = await DataService.updateCourse(courseId, processedData);

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error,
          message: '修改課程時發生錯誤',
          modificationLog,
        };
      }

      // 獲取更新後的課程信息
      const updatedCourse = await DataService.getCourseById(courseId);

      // 構建修改成功訊息
      const changedFields = [];
      if (processedData.schedule_time) changedFields.push('時間');
      if (processedData.course_date) changedFields.push('日期');
      if (processedData.location) changedFields.push('地點');
      if (processedData.teacher) changedFields.push('老師');

      const successMessage = changedFields.length > 0
        ? `✅ 成功修改「${originalCourse?.course_name || '課程'}」的${changedFields.join('、')}`
        : '✅ 課程修改完成';

      return {
        success: true,
        action: 'modify_course',
        courseId,
        message: successMessage,
        modifiedFields: Object.keys(processedData),
        updatedCourse,
        modificationLog: {
          ...modificationLog,
          result: 'success',
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '修改課程時發生錯誤，請稍後再試',
        modificationLog: {
          ...modificationLog,
          result: 'error',
          errorDetails: error.message,
        },
      };
    }
  }

  /**
   * 取消課程
   * @param {string} courseId - 課程ID
   * @returns {Promise<Object>} 取消結果
   */
  static async cancelCourse(courseId) {
    if (!courseId) {
      throw new Error('CourseService: courseId is required');
    }

    return DataService.updateCourse(courseId, { status: 'cancelled' });
  }

  /**
   * 刪除課程
   * @param {string} courseId - 課程ID
   * @returns {Promise<boolean>} 刪除結果
   */
  static async deleteCourse(courseId) {
    if (!courseId) {
      throw new Error('CourseService: courseId is required');
    }

    return DataService.deleteCourse(courseId);
  }

  /**
   * 查詢課程
   * @param {Object} criteria - 查詢條件
   * @returns {Promise<Array>} 查詢結果
   */
  static async queryCourses(criteria) {
    if (!criteria) {
      throw new Error('CourseService: criteria is required');
    }

    return DataService.queryCourses(criteria);
  }

  /**
   * 檢查課程時間衝突
   * @param {string} studentId - 學生ID
   * @param {Date} newCourseDate - 新課程日期
   * @param {string} newScheduleTime - 新課程時間
   * @returns {Promise<Array>} 衝突的課程列表
   */
  static async checkTimeConflicts(studentId, newCourseDate, newScheduleTime) {
    if (!studentId || !newCourseDate) {
      throw new Error('CourseService: studentId and newCourseDate are required');
    }

    const formattedDate = newCourseDate instanceof Date
      ? newCourseDate.toISOString().split('T')[0]
      : newCourseDate;

    // 獲取同一天的課程
    const sameDayCourses = await DataService.queryCourses({
      student_id: studentId,
      date_range: {
        start: formattedDate,
        end: formattedDate,
      },
    });

    // 簡化版本：如果有同名課程且時間描述相同，視為衝突
    const conflicts = sameDayCourses.filter(
      (course) => course.schedule_time === newScheduleTime
        && course.status !== 'cancelled',
    );

    return conflicts;
  }

  /**
   * 獲取課程統計
   * @param {string} studentId - 學生ID
   * @returns {Promise<Object>} 統計數據
   */
  static async getCourseStats(studentId) {
    if (!studentId) {
      throw new Error('CourseService: studentId is required');
    }

    const allCourses = await DataService.getUserCourses(studentId);

    const stats = {
      total: allCourses.length,
      scheduled: allCourses.filter((c) => c.status === 'scheduled').length,
      completed: allCourses.filter((c) => c.status === 'completed').length,
      cancelled: allCourses.filter((c) => c.status === 'cancelled').length,
      recurring: allCourses.filter((c) => c.is_recurring).length,
    };

    return stats;
  }

  /**
   * 清空用戶所有課程（高風險操作）
   * @param {string} studentId - 學生ID
   * @param {Object} options - 選項配置
   * @returns {Promise<Object>} 清空結果
   */
  static async clearAllCourses(studentId, options = {}) {
    if (!studentId) {
      throw new Error('CourseService: studentId is required');
    }

    // 安全檢查：確認參數
    if (!options.confirmed) {
      throw new Error('CourseService: This is a high-risk operation that requires explicit confirmation');
    }

    // 獲取當前課程統計，用於操作前記錄
    const statsBefore = await this.getCourseStats(studentId);
    
    if (statsBefore.total === 0) {
      return {
        success: true,
        action: 'clear_all_courses',
        studentId,
        deletedCount: 0,
        message: '用戶沒有任何課程需要清空',
        statsBefore,
        statsAfter: statsBefore,
      };
    }

    // 執行批量刪除
    const result = await DataService.clearUserCourses(studentId);
    
    // 獲取操作後統計
    const statsAfter = await this.getCourseStats(studentId);

    return {
      success: result.success,
      action: 'clear_all_courses',
      studentId,
      deletedCount: result.deletedCount,
      totalCourses: result.totalCourses,
      errors: result.errors,
      message: result.success 
        ? `✅ 成功清空課表！共刪除 ${result.deletedCount} 門課程`
        : `⚠️ 清空課表部分失敗：成功刪除 ${result.deletedCount}/${result.totalCourses} 門課程`,
      statsBefore,
      statsAfter,
      operationDetails: {
        timestamp: TimeService.getCurrentUserTime().toISOString(),
        operationType: 'CLEAR_ALL_COURSES',
        affectedRecords: result.deletedCount,
      },
    };
  }
}

module.exports = CourseService;
