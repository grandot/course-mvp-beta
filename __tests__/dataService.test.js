/**
 * DataService 測試
 * 驗證記憶體版本的 CRUD 操作
 */

const DataService = require('../src/services/dataService');

describe('DataService', () => {
  // 每個測試前清空存儲
  beforeEach(() => {
    DataService.clearStorage();
  });

  describe('generateUUID', () => {
    test('should generate valid UUID v4 format', () => {
      const uuid = DataService.generateUUID();
      
      // UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(uuid).toMatch(uuidRegex);
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = DataService.generateUUID();
      const uuid2 = DataService.generateUUID();
      
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('createCourse', () => {
    test('should create course with valid data', async () => {
      const courseData = {
        student_id: 'user123',
        course_name: '數學課',
        schedule_time: '下午2點',
        course_date: '2025-07-25',
      };

      const result = await DataService.createCourse(courseData);

      expect(result.success).toBe(true);
      expect(result.courseId).toBeDefined();
      expect(result.course).toMatchObject({
        id: result.courseId,
        student_id: 'user123',
        course_name: '數學課',
        schedule_time: '下午2點',
        course_date: '2025-07-25',
        status: 'scheduled',
      });
      expect(result.course.created_at).toBeDefined();
      expect(result.course.updated_at).toBeDefined();
    });

    test('should create course with optional fields', async () => {
      const courseData = {
        student_id: 'user123',
        course_name: '英文課',
        schedule_time: '上午10點',
        course_date: '2025-07-26',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        location: '教室A',
        teacher: '王老師',
        status: 'scheduled',
      };

      const result = await DataService.createCourse(courseData);

      expect(result.success).toBe(true);
      expect(result.course.is_recurring).toBe(true);
      expect(result.course.recurrence_pattern).toBe('weekly');
      expect(result.course.location).toBe('教室A');
      expect(result.course.teacher).toBe('王老師');
    });

    test('should throw error when courseData is null or undefined', async () => {
      await expect(DataService.createCourse(null)).rejects.toThrow('courseData is required');
      await expect(DataService.createCourse(undefined)).rejects.toThrow('courseData is required');
    });
  });

  describe('getUserCourses', () => {
    beforeEach(async () => {
      // 建立測試數據
      await DataService.createCourse({
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
        status: 'scheduled',
      });
      await DataService.createCourse({
        student_id: 'user123',
        course_name: '英文課',
        course_date: '2025-07-26',
        status: 'completed',
      });
      await DataService.createCourse({
        student_id: 'user456',
        course_name: '物理課',
        course_date: '2025-07-25',
        status: 'scheduled',
      });
    });

    test('should return user courses without filters', async () => {
      const courses = await DataService.getUserCourses('user123');
      
      expect(courses).toHaveLength(2);
      expect(courses.every((c) => c.student_id === 'user123')).toBe(true);
    });

    test('should filter courses by status', async () => {
      const scheduledCourses = await DataService.getUserCourses('user123', { status: 'scheduled' });
      const completedCourses = await DataService.getUserCourses('user123', { status: 'completed' });
      
      expect(scheduledCourses).toHaveLength(1);
      expect(scheduledCourses[0].course_name).toBe('數學課');
      expect(completedCourses).toHaveLength(1);
      expect(completedCourses[0].course_name).toBe('英文課');
    });

    test('should filter courses by course name', async () => {
      const mathCourses = await DataService.getUserCourses('user123', { course_name: '數學' });
      
      expect(mathCourses).toHaveLength(1);
      expect(mathCourses[0].course_name).toBe('數學課');
    });

    test('should return empty array for non-existent user', async () => {
      const courses = await DataService.getUserCourses('nonexistent');
      
      expect(courses).toHaveLength(0);
    });

    test('should throw error when userId is null or undefined', async () => {
      await expect(DataService.getUserCourses(null)).rejects.toThrow('userId is required');
      await expect(DataService.getUserCourses(undefined)).rejects.toThrow('userId is required');
    });
  });

  describe('updateCourse', () => {
    let courseId;

    beforeEach(async () => {
      const result = await DataService.createCourse({
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
        status: 'scheduled',
      });
      courseId = result.courseId;
    });

    test('should update course successfully', async () => {
      const updateData = {
        course_name: '進階數學課',
        status: 'completed',
        teacher: '李老師',
      };

      const result = await DataService.updateCourse(courseId, updateData);

      expect(result.success).toBe(true);
      expect(result.course.course_name).toBe('進階數學課');
      expect(result.course.status).toBe('completed');
      expect(result.course.teacher).toBe('李老師');
      expect(result.course.updated_at).toBeDefined();
    });

    test('should throw error for non-existent course', async () => {
      await expect(DataService.updateCourse('nonexistent', { status: 'completed' }))
        .rejects.toThrow('Course with id nonexistent not found');
    });

    test('should throw error when courseId or updateData is missing', async () => {
      await expect(DataService.updateCourse(null, { status: 'completed' }))
        .rejects.toThrow('courseId is required');
      await expect(DataService.updateCourse(courseId, null))
        .rejects.toThrow('updateData is required');
    });
  });

  describe('deleteCourse', () => {
    let courseId;

    beforeEach(async () => {
      const result = await DataService.createCourse({
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
      });
      courseId = result.courseId;
    });

    test('should delete course successfully', async () => {
      const result = await DataService.deleteCourse(courseId);
      
      expect(result).toBe(true);
      
      // 驗證課程已被刪除
      const courses = await DataService.getUserCourses('user123');
      expect(courses).toHaveLength(0);
    });

    test('should throw error for non-existent course', async () => {
      await expect(DataService.deleteCourse('nonexistent'))
        .rejects.toThrow('Course with id nonexistent not found');
    });

    test('should throw error when courseId is missing', async () => {
      await expect(DataService.deleteCourse(null))
        .rejects.toThrow('courseId is required');
    });
  });

  describe('queryCourses', () => {
    beforeEach(async () => {
      await DataService.createCourse({
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
        status: 'scheduled',
      });
      await DataService.createCourse({
        student_id: 'user456',
        course_name: '英文課',
        course_date: '2025-07-26',
        status: 'completed',
      });
    });

    test('should query by student_id', async () => {
      const results = await DataService.queryCourses({ student_id: 'user123' });
      
      expect(results).toHaveLength(1);
      expect(results[0].student_id).toBe('user123');
    });

    test('should query by multiple criteria', async () => {
      const results = await DataService.queryCourses({
        status: 'scheduled',
        course_name: '數學',
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].course_name).toBe('數學課');
      expect(results[0].status).toBe('scheduled');
    });

    test('should throw error when criteria is missing', async () => {
      await expect(DataService.queryCourses(null))
        .rejects.toThrow('criteria is required');
    });
  });

  describe('recordTokenUsage', () => {
    test('should record token usage successfully', async () => {
      const usageData = {
        user_id: 'user123',
        model: 'gpt-3.5-turbo',
        total_tokens: 150,
        total_cost_twd: 0.05,
        user_message: '測試訊息',
      };

      const result = await DataService.recordTokenUsage(usageData);

      expect(result.success).toBe(true);
      expect(result.entryId).toBeDefined();
      expect(result.usage).toMatchObject({
        id: result.entryId,
        user_id: 'user123',
        model: 'gpt-3.5-turbo',
        total_tokens: 150,
      });
      expect(result.usage.timestamp).toBeDefined();
    });

    test('should throw error when usageData is missing', async () => {
      await expect(DataService.recordTokenUsage(null))
        .rejects.toThrow('usageData is required');
    });
  });

  describe('validateData', () => {
    test('should validate course data correctly', async () => {
      const validCourse = {
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
      };

      const invalidCourse = {
        student_id: 'user123',
        // 缺少 course_name 和 course_date
      };

      expect(await DataService.validateData(validCourse, 'course')).toBe(true);
      expect(await DataService.validateData(invalidCourse, 'course')).toBe(false);
    });

    test('should validate token usage data correctly', async () => {
      const validUsage = {
        user_id: 'user123',
        model: 'gpt-3.5-turbo',
        total_tokens: 150,
      };

      const invalidUsage = {
        user_id: 'user123',
        // 缺少 model 和 total_tokens
      };

      expect(await DataService.validateData(validUsage, 'token_usage')).toBe(true);
      expect(await DataService.validateData(invalidUsage, 'token_usage')).toBe(false);
    });

    test('should throw error for unknown schema', async () => {
      await expect(DataService.validateData({}, 'unknown'))
        .rejects.toThrow('Unknown schema: unknown');
    });

    test('should throw error when data or schema is missing', async () => {
      await expect(DataService.validateData(null, 'course'))
        .rejects.toThrow('data is required');
      await expect(DataService.validateData({}, null))
        .rejects.toThrow('schema is required');
    });
  });

  describe('clearStorage', () => {
    test('should clear all storage', async () => {
      // 創建一些數據
      await DataService.createCourse({
        student_id: 'user123',
        course_name: '數學課',
        course_date: '2025-07-25',
      });
      await DataService.recordTokenUsage({
        user_id: 'user123',
        model: 'gpt-3.5-turbo',
        total_tokens: 150,
      });

      // 清空存儲
      DataService.clearStorage();

      // 驗證存儲已清空
      const courses = await DataService.getUserCourses('user123');
      expect(courses).toHaveLength(0);
    });
  });
});