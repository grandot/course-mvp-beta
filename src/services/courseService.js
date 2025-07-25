/**
 * CourseService - 課程業務邏輯統一入口
 * 職責：課程相關業務邏輯處理
 * 依賴：DataService, TimeService
 */
const DataService = require('./dataService');

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
}

module.exports = CourseService;
