/**
 * LineController E2E Atomic Tests
 * 測試 Step 4 的 Controller 重構
 */

const LineController = require('../src/controllers/lineController');

// Mock dependencies
jest.mock('../src/services/semanticService');
jest.mock('../src/services/taskService');
jest.mock('../src/services/lineService');

const semanticService = require('../src/services/semanticService');
const TaskService = require('../src/services/taskService');
const lineService = require('../src/services/lineService');

describe('LineController E2E Atomic Tests - Step 4 Controller Refactor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTextMessage with TaskService integration', () => {
    test('should handle record_course end-to-end with new contract', async () => {
      const event = {
        message: { text: '明天晚上十點半法語課' },
        source: { userId: 'test-user-123' },
        replyToken: 'reply-token-123'
      };

      // Mock SemanticService returning new contract format
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        method: 'rule_engine',
        intent: 'record_course',
        confidence: 0.9,
        entities: {
          course_name: '法語',
          location: null,
          teacher: null,
          timeInfo: {
            display: '07/26 10:30 PM',
            date: '2025-07-26',
            raw: '2025-07-26T22:30:00.000Z',
            timestamp: 1722026200000
          }
        }
      });

      // Mock TaskService successful execution
      TaskService.executeIntent.mockResolvedValue({
        success: true,
        id: 'course-789',
        message: '法語課程已成功建立'
      });

      // Mock LINE service reply
      lineService.replyMessage.mockResolvedValue({
        success: true,
        messageId: 'line-msg-123'
      });

      const result = await LineController.handleTextMessage(event);

      // Verify semantic analysis was called
      expect(semanticService.analyzeMessage).toHaveBeenCalledWith(
        '明天晚上十點半法語課',
        'test-user-123'
      );

      // Verify TaskService was called with correct parameters
      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'record_course',
        {
          course_name: '法語',
          location: null,
          teacher: null,
          timeInfo: {
            display: '07/26 10:30 PM',
            date: '2025-07-26',
            raw: '2025-07-26T22:30:00.000Z',
            timestamp: 1722026200000
          }
        },
        'test-user-123'
      );

      // Verify reply was sent
      expect(lineService.replyMessage).toHaveBeenCalledWith(
        'reply-token-123',
        '✅ 課程已成功新增！'
      );

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(result.confidence).toBe(0.9);
      expect(result.result).toEqual({
        success: true,
        id: 'course-789',
        message: '法語課程已成功建立'
      });
    });

    test('should handle cancel_course end-to-end', async () => {
      const event = {
        message: { text: '取消數學課' },
        source: { userId: 'test-user-456' },
        replyToken: 'reply-token-456'
      };

      // Mock semantic analysis
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'cancel_course',
        confidence: 0.95,
        entities: {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: null
        }
      });

      // Mock TaskService successful cancellation
      TaskService.executeIntent.mockResolvedValue({
        success: true,
        message: '數學課程已成功取消'
      });

      // Mock LINE service reply
      lineService.replyMessage.mockResolvedValue({
        success: true
      });

      const result = await LineController.handleTextMessage(event);

      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'cancel_course',
        {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: null
        },
        'test-user-456'
      );

      expect(lineService.replyMessage).toHaveBeenCalledWith(
        'reply-token-456',
        '✅ 課程已成功取消！'
      );

      expect(result.success).toBe(true);
      expect(result.intent).toBe('cancel_course');
    });

    test('should handle query_schedule end-to-end', async () => {
      const event = {
        message: { text: '查看課表' },
        source: { userId: 'test-user-789' },
        replyToken: 'reply-token-789'
      };

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

      // Mock semantic analysis
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'query_schedule',
        confidence: 0.9,
        entities: {
          course_name: null,
          location: null,
          teacher: null,
          timeInfo: null
        }
      });

      // Mock TaskService query result
      TaskService.executeIntent.mockResolvedValue({
        success: true,
        courses: mockCourses,
        count: 2
      });

      // Mock LINE service formatting
      lineService.formatCourseResponse.mockReturnValue('📅 您的課表：\n數學 - 07/26 2:30 PM\n英文 - 07/27 10:00 AM');
      lineService.replyMessage.mockResolvedValue({
        success: true
      });

      const result = await LineController.handleTextMessage(event);

      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'query_schedule',
        {
          course_name: null,
          location: null,
          teacher: null,
          timeInfo: null
        },
        'test-user-789'
      );

      expect(lineService.formatCourseResponse).toHaveBeenCalledWith(
        mockCourses,
        'query_schedule'
      );

      expect(result.success).toBe(true);
      expect(result.intent).toBe('query_schedule');
    });

    test('should handle TaskService errors correctly', async () => {
      const event = {
        message: { text: '明天2點數學課' },
        source: { userId: 'test-user-error' },
        replyToken: 'reply-token-error'
      };

      // Mock semantic analysis success
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.8,
        entities: {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: {
            display: '07/26 2:00 PM',
            date: '2025-07-26',
            raw: '2025-07-26T14:00:00.000Z'
          }
        }
      });

      // Mock TaskService error
      TaskService.executeIntent.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
        message: '創建課程時發生錯誤，請稍後再試'
      });

      // Mock LINE service reply
      lineService.replyMessage.mockResolvedValue({
        success: true
      });

      const result = await LineController.handleTextMessage(event);

      expect(lineService.replyMessage).toHaveBeenCalledWith(
        'reply-token-error',
        '創建課程時發生錯誤，請稍後再試'
      );

      expect(result.success).toBe(true); // Controller 成功處理了錯誤
      expect(result.result.success).toBe(false); // TaskService 返回錯誤
    });

    test('should handle semantic analysis errors', async () => {
      const event = {
        message: { text: '無法識別的訊息' },
        source: { userId: 'test-user-semantic-error' },
        replyToken: 'reply-token-semantic-error'
      };

      // Mock semantic analysis failure
      semanticService.analyzeMessage.mockResolvedValue({
        success: false,
        error: 'Analysis failed',
        intent: 'unknown',
        confidence: 0.0
      });

      const result = await LineController.handleTextMessage(event);

      // TaskService should not be called
      expect(TaskService.executeIntent).not.toHaveBeenCalled();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Semantic analysis failed');
    });

    test('should handle events without replyToken', async () => {
      const event = {
        message: { text: '測試無回覆' },
        source: { userId: 'test-user-no-reply' }
        // No replyToken
      };

      // Mock semantic analysis
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.8,
        entities: {
          course_name: '物理',
          timeInfo: {
            display: '07/26 3:00 PM',
            date: '2025-07-26',
            raw: '2025-07-26T15:00:00.000Z'
          }
        }
      });

      // Mock TaskService success
      TaskService.executeIntent.mockResolvedValue({
        success: true,
        id: 'course-999'
      });

      const result = await LineController.handleTextMessage(event);

      // TaskService should still be called
      expect(TaskService.executeIntent).toHaveBeenCalled();

      // But no reply should be sent
      expect(lineService.replyMessage).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      // Should not have reply property
      expect(result.reply).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      const event = {
        message: { text: '測試異常錯誤' },
        source: { userId: 'test-user-exception' },
        replyToken: 'reply-token-exception'
      };

      // Mock semantic analysis throwing error
      semanticService.analyzeMessage.mockRejectedValue(new Error('Unexpected error'));

      const result = await LineController.handleTextMessage(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(result.message).toBe('處理訊息時發生錯誤，請稍後再試');
    });
  });
});