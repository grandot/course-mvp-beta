/**
 * TaskService Atomic Tests
 * 測試 Step 3 新建的任務執行協調層
 */

const TaskService = require('../src/services/taskService');

// Mock dependencies
jest.mock('../src/services/dataService');
jest.mock('../src/services/timeService');

const dataService = require('../src/services/dataService');
const TimeService = require('../src/services/timeService');

describe('TaskService Atomic Tests - Step 3 Task Coordination Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeIntent', () => {
    test('should handle record_course with correct contract', async () => {
      const entities = {
        course_name: '數學',
        location: '101教室',
        teacher: '王老師',
        timeInfo: {
          display: '07/26 2:30 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:30:00.000Z',
          timestamp: 1721998200000
        }
      };

      // Mock TimeService validation
      TimeService.validateTimeInfo.mockReturnValue(true);

      // Mock dataService success response
      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'course-123',
        message: 'Course created successfully'
      });

      const result = await TaskService.executeIntent('record_course', entities, 'test-user');

      expect(result.success).toBe(true);
      expect(dataService.createCourse).toHaveBeenCalledWith({
        student_id: 'test-user',
        course_name: '數學',
        schedule_time: '07/26 2:30 PM',
        course_date: '2025-07-26',
        location: '101教室',
        teacher: '王老師'
      });
    });

    test('should reject record_course with missing course_name', async () => {
      const entities = {
        course_name: null,
        timeInfo: {
          display: '07/26 2:30 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:30:00.000Z'
        }
      };

      const result = await TaskService.executeIntent('record_course', entities, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing course name');
      expect(result.message).toBe('請告訴我課程名稱，例如：「數學課」、「英文課」等');
      expect(dataService.createCourse).not.toHaveBeenCalled();
    });

    test('should reject record_course with missing timeInfo', async () => {
      const entities = {
        course_name: '數學',
        timeInfo: null
      };

      const result = await TaskService.executeIntent('record_course', entities, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing time information');
      expect(result.message).toBe('請提供上課時間，例如：「明天下午2點」、「週三晚上7點」等');
      expect(dataService.createCourse).not.toHaveBeenCalled();
    });

    test('should reject record_course with invalid timeInfo format', async () => {
      const entities = {
        course_name: '數學',
        timeInfo: {
          display: 'invalid-format',
          date: '2025-07-26'
        }
      };

      // Mock TimeService validation failure
      TimeService.validateTimeInfo.mockReturnValue(false);

      const result = await TaskService.executeIntent('record_course', entities, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid time information format');
      expect(result.message).toBe('時間格式不正確，請重新輸入時間信息');
      expect(dataService.createCourse).not.toHaveBeenCalled();
    });

    test('should handle cancel_course correctly', async () => {
      const entities = {
        course_name: '英文',
        timeInfo: null
      };

      // Mock finding existing courses
      dataService.getUserCourses.mockResolvedValue([
        {
          id: 'course-456',
          course_name: '英文',
          status: 'scheduled'
        }
      ]);

      // Mock successful cancellation
      dataService.updateCourse.mockResolvedValue({
        success: true,
        message: 'Course cancelled successfully'
      });

      const result = await TaskService.executeIntent('cancel_course', entities, 'test-user');

      expect(result.success).toBe(true);
      expect(dataService.getUserCourses).toHaveBeenCalledWith('test-user', {
        course_name: '英文',
        status: 'scheduled'
      });
      expect(dataService.updateCourse).toHaveBeenCalledWith('course-456', {
        status: 'cancelled'
      });
    });

    test('should handle cancel_course with no matching courses', async () => {
      const entities = {
        course_name: '不存在的課程'
      };

      // Mock no courses found
      dataService.getUserCourses.mockResolvedValue([]);

      const result = await TaskService.executeIntent('cancel_course', entities, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Course not found');
      expect(result.message).toBe('找不到要取消的「不存在的課程」課程');
      expect(dataService.updateCourse).not.toHaveBeenCalled();
    });

    test('should handle query_schedule correctly', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          course_name: '數學',
          schedule_time: '07/26 2:30 PM',
          status: 'scheduled'
        },
        {
          id: 'course-2',
          course_name: '英文',
          schedule_time: '07/27 10:00 AM',
          status: 'scheduled'
        }
      ];

      dataService.getUserCourses.mockResolvedValue(mockCourses);

      const result = await TaskService.executeIntent('query_schedule', {}, 'test-user');

      expect(result.success).toBe(true);
      expect(result.courses).toBe(mockCourses);
      expect(result.count).toBe(2);
      expect(dataService.getUserCourses).toHaveBeenCalledWith('test-user', {
        status: 'scheduled'
      });
    });

    test('should handle unimplemented intents', async () => {
      const result = await TaskService.executeIntent('modify_course', {}, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Feature not implemented');
      expect(result.message).toBe('此功能將在後續版本中實現');
    });

    test('should handle unknown intents', async () => {
      const result = await TaskService.executeIntent('unknown_intent', {}, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown intent');
      expect(result.message).toBe('抱歉，我無法理解您的需求，請重新描述');
    });

    test('should handle missing parameters', async () => {
      const result = await TaskService.executeIntent(null, {}, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters');
      expect(result.message).toBe('缺少必要的參數信息');
    });

    test('should handle dataService errors gracefully', async () => {
      const entities = {
        course_name: '數學',
        timeInfo: {
          display: '07/26 2:30 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:30:00.000Z'
        }
      };

      TimeService.validateTimeInfo.mockReturnValue(true);
      dataService.createCourse.mockRejectedValue(new Error('Database connection failed'));

      const result = await TaskService.executeIntent('record_course', entities, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.message).toBe('創建課程時發生錯誤，請稍後再試');
    });
  });

  describe('validateExecutionParams', () => {
    test('should validate correct parameters', () => {
      const result = TaskService.validateExecutionParams('record_course', {
        course_name: '數學',
        timeInfo: { display: '07/26 2:30 PM' }
      }, 'test-user');

      expect(result.valid).toBe(true);
    });

    test('should reject missing intent', () => {
      const result = TaskService.validateExecutionParams(null, {}, 'test-user');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Intent is required');
    });

    test('should reject missing userId', () => {
      const result = TaskService.validateExecutionParams('record_course', {}, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should reject invalid entities', () => {
      const result = TaskService.validateExecutionParams('record_course', null, 'test-user');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Entities must be an object');
    });

    test('should validate record_course specific requirements', () => {
      const invalidResult = TaskService.validateExecutionParams('record_course', {
        course_name: null
      }, 'test-user');

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Course name is required for recording course');
    });

    test('should validate cancel_course specific requirements', () => {
      const invalidResult = TaskService.validateExecutionParams('cancel_course', {
        course_name: null
      }, 'test-user');

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Course name is required for cancelling course');
    });

    test('should validate query_schedule (no specific requirements)', () => {
      const result = TaskService.validateExecutionParams('query_schedule', {}, 'test-user');

      expect(result.valid).toBe(true);
    });

    test('should reject unknown intents', () => {
      const result = TaskService.validateExecutionParams('unknown_intent', {}, 'test-user');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown intent: unknown_intent');
    });
  });

  describe('integration tests', () => {
    test('should execute complete record_course flow', async () => {
      const entities = {
        course_name: '法語',
        location: null,
        teacher: null,
        timeInfo: {
          display: '07/26 10:30 PM',
          date: '2025-07-26',
          raw: '2025-07-26T22:30:00.000Z',
          timestamp: 1722026200000
        }
      };

      TimeService.validateTimeInfo.mockReturnValue(true);
      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'course-789',
        message: '法語課程已成功建立'
      });

      const result = await TaskService.executeIntent('record_course', entities, 'user-123');

      expect(result.success).toBe(true);
      expect(result.id).toBe('course-789');
      expect(dataService.createCourse).toHaveBeenCalledWith({
        student_id: 'user-123',
        course_name: '法語',
        schedule_time: '07/26 10:30 PM',
        course_date: '2025-07-26',
        location: null,
        teacher: null
      });
    });
  });
});