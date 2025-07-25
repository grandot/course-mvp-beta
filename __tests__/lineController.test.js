/**
 * LINE Controller 測試套件
 * Phase 5: LINE Bot Integration Tests
 */
const LineController = require('../src/controllers/lineController');
const semanticService = require('../src/services/semanticService');
const courseService = require('../src/services/courseService');
const crypto = require('crypto');

// Mock 服務
jest.mock('../src/services/semanticService');
jest.mock('../src/services/courseService');

describe('LineController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 設定測試環境變數
    process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
  });

  afterEach(() => {
    delete process.env.LINE_CHANNEL_SECRET;
  });

  describe('healthCheck', () => {
    test('should return 200 OK with service info', () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      LineController.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OK',
          service: 'IntentOS Course MVP',
          version: '1.0.0',
        })
      );
    });
  });

  describe('verifySignature', () => {
    test('should verify valid signature correctly', () => {
      const body = '{"test": "data"}';
      const secret = 'test-secret';
      
      // 生成正確的簽名
      const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
      const signature = `sha256=${hash}`;
      
      // 設定環境變數
      process.env.LINE_CHANNEL_SECRET = secret;
      
      const result = LineController.verifySignature(signature, body);
      expect(result).toBe(true);
    });

    test('should reject invalid signature', () => {
      const body = '{"test": "data"}';
      const invalidSignature = 'sha256=invalid-hash';
      
      const result = LineController.verifySignature(invalidSignature, body);
      expect(result).toBe(false);
    });

    test('should reject when missing signature', () => {
      const body = '{"test": "data"}';
      
      const result = LineController.verifySignature(null, body);
      expect(result).toBe(false);
    });

    test('should reject when missing channel secret', () => {
      delete process.env.LINE_CHANNEL_SECRET;
      const body = '{"test": "data"}';
      const signature = 'sha256=some-hash';
      
      const result = LineController.verifySignature(signature, body);
      expect(result).toBe(false);
    });
  });

  describe('handleTextMessage', () => {
    const mockEvent = {
      message: { text: '明天2點數學課' },
      source: { userId: 'test-user-123' }
    };

    test('should handle record_course intent successfully', async () => {
      // Mock 語義分析返回
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.85,
        entities: {
          courseName: '數學',
          timeInfo: {
            display: '明天2點',
            date: '2025-07-26'
          },
          location: null,
          teacher: null
        }
      });

      // Mock 課程創建返回
      courseService.createCourse.mockResolvedValue({
        success: true,
        courseId: 'course-123',
        message: '課程創建成功'
      });

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(semanticService.analyzeMessage).toHaveBeenCalledWith('明天2點數學課', 'test-user-123');
      expect(courseService.createCourse).toHaveBeenCalledWith({
        student_id: 'test-user-123',
        course_name: '數學',
        schedule_time: '明天2點',
        course_date: '2025-07-26',
        location: null,
        teacher: null
      });
    });

    test('should handle cancel_course intent successfully', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'cancel_course',
        confidence: 0.9,
        entities: {
          courseName: '數學'
        }
      });

      courseService.getCoursesByUser.mockResolvedValue([
        { id: 'course-123', course_name: '數學' }
      ]);

      courseService.cancelCourse.mockResolvedValue({
        success: true,
        message: '課程已取消'
      });

      const cancelEvent = {
        message: { text: '取消數學課' },
        source: { userId: 'test-user-123' }
      };

      const result = await LineController.handleTextMessage(cancelEvent);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('cancel_course');
      expect(courseService.getCoursesByUser).toHaveBeenCalledWith('test-user-123', {
        course_name: '數學',
        status: 'scheduled'
      });
      expect(courseService.cancelCourse).toHaveBeenCalledWith('course-123');
    });

    test('should handle query_schedule intent', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'query_schedule',
        confidence: 0.9,
        entities: {}
      });

      courseService.getCoursesByUser.mockResolvedValue([
        { id: 'course-1', course_name: '數學' },
        { id: 'course-2', course_name: '英文' }
      ]);

      const queryEvent = {
        message: { text: '查詢我的課表' },
        source: { userId: 'test-user-123' }
      };

      const result = await LineController.handleTextMessage(queryEvent);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('query_schedule');
      expect(courseService.getCoursesByUser).toHaveBeenCalledWith('test-user-123', {
        status: 'scheduled'
      });
    });

    test('should handle missing required information for record_course', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.8,
        entities: {
          courseName: '數學'
          // 缺少 timeInfo
        }
      });

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(true);
      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Missing required course information');
    });

    test('should handle unknown intent', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'unknown_intent',
        confidence: 0.6,
        entities: {}
      });

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(true);
      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Unknown intent');
    });

    test('should handle semantic analysis failure', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: false,
        error: 'Analysis failed'
      });

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Semantic analysis failed');
    });

    test('should handle service errors gracefully', async () => {
      semanticService.analyzeMessage.mockRejectedValue(new Error('Service error'));

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service error');
    });
  });

  describe('webhook', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {
          events: [
            {
              type: 'message',
              message: { type: 'text', text: '測試訊息' },
              source: { userId: 'test-user' }
            }
          ]
        },
        get: jest.fn()
      };

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    test('should process valid webhook request', async () => {
      // 生成有效簽名
      const body = JSON.stringify(req.body);
      const hash = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      const signature = `sha256=${hash}`;
      
      req.get.mockReturnValue(signature);

      // Mock handleTextMessage
      jest.spyOn(LineController, 'handleTextMessage').mockResolvedValue({
        success: true,
        intent: 'test_intent'
      });

      await LineController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 1,
        results: [{ success: true, intent: 'test_intent' }]
      });
    });

    test('should reject invalid signature', async () => {
      req.get.mockReturnValue('invalid-signature');

      await LineController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    test('should ignore non-text message events', async () => {
      req.body.events = [
        {
          type: 'message',
          message: { type: 'image' },
          source: { userId: 'test-user' }
        }
      ];

      const body = JSON.stringify(req.body);
      const hash = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      const signature = `sha256=${hash}`;
      
      req.get.mockReturnValue(signature);

      await LineController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 1,
        results: [{ success: true, message: 'Event ignored' }]
      });
    });

    test('should handle webhook processing errors', async () => {
      const body = JSON.stringify(req.body);
      const hash = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      const signature = `sha256=${hash}`;
      
      req.get.mockReturnValue(signature);

      // Mock handleTextMessage 拋出錯誤
      jest.spyOn(LineController, 'handleTextMessage').mockRejectedValue(new Error('Processing error'));

      await LineController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
    });
  });
});