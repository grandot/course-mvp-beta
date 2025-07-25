/**
 * CourseService 測試
 * 驗證課程業務邏輯操作
 */

const CourseService = require('../src/services/courseService');
const DataService = require('../src/services/dataService');

describe('CourseService', () => {
  // 每個測試前清空存儲
  beforeEach(() => {
    DataService.clearStorage();
  });

  describe('createCourse', () => {
    test('should create course with minimum required data', async () => {
      const result = await CourseService.createCourse(
        'user123',
        '數學課',
        '下午2點',
        new Date('2025-07-25')
      );

      expect(result.success).toBe(true);
      expect(result.courseId).toBeDefined();
      expect(result.course).toMatchObject({
        student_id: 'user123',
        course_name: '數學課',
        schedule_time: '下午2點',
        course_date: '2025-07-25',
        status: 'scheduled',
      });

      // 驗證 UUID v4 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(result.courseId).toMatch(uuidRegex);
    });

    test('should create course with all optional fields', async () => {
      const options = {
        is_recurring: true,
        recurrence_pattern: 'weekly',
        location: '教室A',
        teacher: '王老師',
        status: 'confirmed',
      };

      const result = await CourseService.createCourse(
        'user123',
        '英文課',
        '上午10點',
        '2025-07-26',
        options
      );

      expect(result.success).toBe(true);
      expect(result.course.is_recurring).toBe(true);
      expect(result.course.recurrence_pattern).toBe('weekly');
      expect(result.course.location).toBe('教室A');
      expect(result.course.teacher).toBe('王老師');
      expect(result.course.status).toBe('confirmed');
    });

    test('should handle Date object for courseDate', async () => {
      const courseDate = new Date('2025-07-25T14:30:00');
      
      const result = await CourseService.createCourse(
        'user123',
        '物理課',
        '下午2點半',
        courseDate
      );

      expect(result.course.course_date).toBe('2025-07-25');
    });

    test('should handle string for courseDate', async () => {
      const result = await CourseService.createCourse(
        'user123',
        '化學課',
        '上午9點',
        '2025-07-27'
      );

      expect(result.course.course_date).toBe('2025-07-27');
    });

    test('should throw error for missing required fields', async () => {
      await expect(CourseService.createCourse(null, '數學課', '下午2點', '2025-07-25'))
        .rejects.toThrow('studentId is required');

      await expect(CourseService.createCourse('user123', null, '下午2點', '2025-07-25'))
        .rejects.toThrow('courseName is required');

      await expect(CourseService.createCourse('user123', '數學課', '下午2點', null))
        .rejects.toThrow('courseDate is required');
    });

    test('should use default schedule time when not provided', async () => {
      const result = await CourseService.createCourse(
        'user123',
        '數學課',
        null,
        '2025-07-25'
      );

      expect(result.course.schedule_time).toBe('TBD');
    });
  });

  describe('getCoursesByUser', () => {
    beforeEach(async () => {
      // 建立測試數據
      await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      await CourseService.createCourse('user123', '英文課', '上午10點', '2025-07-26', { status: 'completed' });
      await CourseService.createCourse('user456', '物理課', '下午3點', '2025-07-25');
    });

    test('should return all courses for user', async () => {
      const courses = await CourseService.getCoursesByUser('user123');
      
      expect(courses).toHaveLength(2);
      expect(courses.every((c) => c.student_id === 'user123')).toBe(true);
    });

    test('should return filtered courses', async () => {
      const scheduledCourses = await CourseService.getCoursesByUser('user123', { status: 'scheduled' });
      const completedCourses = await CourseService.getCoursesByUser('user123', { status: 'completed' });
      
      expect(scheduledCourses).toHaveLength(1);
      expect(scheduledCourses[0].course_name).toBe('數學課');
      expect(completedCourses).toHaveLength(1);
      expect(completedCourses[0].course_name).toBe('英文課');
    });

    test('should return empty array for non-existent user', async () => {
      const courses = await CourseService.getCoursesByUser('nonexistent');
      
      expect(courses).toHaveLength(0);
    });

    test('should throw error when studentId is missing', async () => {
      await expect(CourseService.getCoursesByUser(null))
        .rejects.toThrow('studentId is required');
    });
  });

  describe('updateCourse', () => {
    let courseId;

    beforeEach(async () => {
      const result = await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      courseId = result.courseId;
    });

    test('should update course successfully', async () => {
      const updateData = {
        course_name: '進階數學課',
        teacher: '李老師',
        location: '教室B',
      };

      const result = await CourseService.updateCourse(courseId, updateData);

      expect(result.success).toBe(true);
      expect(result.course.course_name).toBe('進階數學課');
      expect(result.course.teacher).toBe('李老師');
      expect(result.course.location).toBe('教室B');
    });

    test('should handle courseDate field mapping', async () => {
      const updateData = {
        courseDate: new Date('2025-07-28'),
      };

      const result = await CourseService.updateCourse(courseId, updateData);

      expect(result.course.course_date).toBe('2025-07-28');
      expect(result.course.courseDate).toBeUndefined(); // 原始鍵名應被移除
    });

    test('should throw error for missing parameters', async () => {
      await expect(CourseService.updateCourse(null, { course_name: '新名稱' }))
        .rejects.toThrow('courseId is required');

      await expect(CourseService.updateCourse(courseId, null))
        .rejects.toThrow('updateData is required');

      await expect(CourseService.updateCourse(courseId, {}))
        .rejects.toThrow('updateData is required and cannot be empty');
    });
  });

  describe('cancelCourse', () => {
    let courseId;

    beforeEach(async () => {
      const result = await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      courseId = result.courseId;
    });

    test('should cancel course successfully', async () => {
      const result = await CourseService.cancelCourse(courseId);

      expect(result.success).toBe(true);
      expect(result.course.status).toBe('cancelled');
    });

    test('should throw error when courseId is missing', async () => {
      await expect(CourseService.cancelCourse(null))
        .rejects.toThrow('courseId is required');
    });
  });

  describe('deleteCourse', () => {
    let courseId;

    beforeEach(async () => {
      const result = await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      courseId = result.courseId;
    });

    test('should delete course successfully', async () => {
      const result = await CourseService.deleteCourse(courseId);

      expect(result).toBe(true);

      // 驗證課程已被刪除
      const courses = await CourseService.getCoursesByUser('user123');
      expect(courses).toHaveLength(0);
    });

    test('should throw error when courseId is missing', async () => {
      await expect(CourseService.deleteCourse(null))
        .rejects.toThrow('courseId is required');
    });
  });

  describe('queryCourses', () => {
    beforeEach(async () => {
      await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      await CourseService.createCourse('user456', '英文課', '上午10點', '2025-07-26', { status: 'completed' });
    });

    test('should query courses by criteria', async () => {
      const results = await CourseService.queryCourses({ student_id: 'user123' });
      
      expect(results).toHaveLength(1);
      expect(results[0].student_id).toBe('user123');
    });

    test('should throw error when criteria is missing', async () => {
      await expect(CourseService.queryCourses(null))
        .rejects.toThrow('criteria is required');
    });
  });

  describe('checkTimeConflicts', () => {
    beforeEach(async () => {
      await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      await CourseService.createCourse('user123', '英文課', '上午10點', '2025-07-25');
    });

    test('should detect time conflicts', async () => {
      const conflicts = await CourseService.checkTimeConflicts(
        'user123',
        new Date('2025-07-25'),
        '下午2點'
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].course_name).toBe('數學課');
    });

    test('should return empty array when no conflicts', async () => {
      const conflicts = await CourseService.checkTimeConflicts(
        'user123',
        new Date('2025-07-25'),
        '晚上8點'
      );

      expect(conflicts).toHaveLength(0);
    });

    test('should handle string date format', async () => {
      const conflicts = await CourseService.checkTimeConflicts(
        'user123',
        '2025-07-25',
        '上午10點'
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].course_name).toBe('英文課');
    });

    test('should ignore cancelled courses in conflict check', async () => {
      // 取消其中一個課程
      const courses = await CourseService.getCoursesByUser('user123');
      const mathCourse = courses.find((c) => c.course_name === '數學課');
      await CourseService.cancelCourse(mathCourse.id);

      const conflicts = await CourseService.checkTimeConflicts(
        'user123',
        '2025-07-25',
        '下午2點'
      );

      expect(conflicts).toHaveLength(0); // 已取消的課程不應算作衝突
    });

    test('should throw error for missing required parameters', async () => {
      await expect(CourseService.checkTimeConflicts(null, '2025-07-25', '下午2點'))
        .rejects.toThrow('studentId and newCourseDate are required');

      await expect(CourseService.checkTimeConflicts('user123', null, '下午2點'))
        .rejects.toThrow('studentId and newCourseDate are required');
    });
  });

  describe('getCourseStats', () => {
    beforeEach(async () => {
      await CourseService.createCourse('user123', '數學課', '下午2點', '2025-07-25');
      await CourseService.createCourse('user123', '英文課', '上午10點', '2025-07-26', { status: 'completed' });
      await CourseService.createCourse('user123', '物理課', '下午3點', '2025-07-27', { is_recurring: true });
      
      // 取消一個課程
      const courses = await CourseService.getCoursesByUser('user123');
      const mathCourse = courses.find((c) => c.course_name === '數學課');
      await CourseService.cancelCourse(mathCourse.id);
    });

    test('should return correct course statistics', async () => {
      const stats = await CourseService.getCourseStats('user123');

      expect(stats).toEqual({
        total: 3,
        scheduled: 1, // 物理課
        completed: 1, // 英文課
        cancelled: 1, // 數學課（已取消）
        recurring: 1, // 物理課
      });
    });

    test('should return zero stats for user with no courses', async () => {
      const stats = await CourseService.getCourseStats('nonexistent');

      expect(stats).toEqual({
        total: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
        recurring: 0,
      });
    });

    test('should throw error when studentId is missing', async () => {
      await expect(CourseService.getCourseStats(null))
        .rejects.toThrow('studentId is required');
    });
  });
});