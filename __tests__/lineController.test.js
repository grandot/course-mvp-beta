/**
 * LINE Controller 測試套件
 * Phase 5: LINE Bot Integration Tests
 */
const LineController = require('../src/controllers/lineController');
const semanticService = require('../src/services/semanticService');
const TaskService = require('../src/services/taskService');
const crypto = require('crypto');

// Mock 服務
jest.mock('../src/services/semanticService');
jest.mock('../src/services/taskService');

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
      
      // 生成正確的簽名 - LINE 不使用 sha256= 前綴
      const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');
      
      // 設定環境變數
      process.env.LINE_CHANNEL_SECRET = secret;
      
      const result = LineController.verifySignature(signature, body);
      expect(result).toBe(true);
    });

    test('should reject invalid signature', () => {
      const body = '{"test": "data"}';
      const invalidSignature = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ==';
      
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
      const signature = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ==';
      
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
      // Mock 語義分析返回（新契約格式）
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.85,
        entities: {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: {  // ✅ 正確的契約結構
            display: '07/26 2:00 PM',
            date: '2025-07-26',
            raw: '2025-07-26T14:00:00.000Z',
            timestamp: 1721998800000
          }
        }
      });

      // Mock TaskService 執行返回
      TaskService.executeIntent.mockResolvedValue({
        success: true,
        id: 'course-123',
        message: '課程創建成功'
      });

      const result = await LineController.handleTextMessage(mockEvent);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(semanticService.analyzeMessage).toHaveBeenCalledWith('明天2點數學課', 'test-user-123');
      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'record_course',
        {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: {
            display: '07/26 2:00 PM',
            date: '2025-07-26',
            raw: '2025-07-26T14:00:00.000Z',
            timestamp: 1721998800000
          }
        },
        'test-user-123'
      );
    });

    test('should handle cancel_course intent successfully', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'cancel_course',
        confidence: 0.9,
        entities: {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: null
        }
      });

      TaskService.executeIntent.mockResolvedValue({
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
      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'cancel_course',
        {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: null
        },
        'test-user-123'
      );
    });

    test('should handle query_schedule intent', async () => {
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

      TaskService.executeIntent.mockResolvedValue({
        success: true,
        courses: [
          { id: 'course-1', course_name: '數學' },
          { id: 'course-2', course_name: '英文' }
        ],
        count: 2
      });

      const queryEvent = {
        message: { text: '查詢我的課表' },
        source: { userId: 'test-user-123' }
      };

      const result = await LineController.handleTextMessage(queryEvent);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('query_schedule');
      expect(TaskService.executeIntent).toHaveBeenCalledWith(
        'query_schedule',
        {
          course_name: null,
          location: null,
          teacher: null,
          timeInfo: null
        },
        'test-user-123'
      );
    });

    test('should handle missing required information for record_course', async () => {
      semanticService.analyzeMessage.mockResolvedValue({
        success: true,
        intent: 'record_course',
        confidence: 0.8,
        entities: {
          course_name: '數學',
          location: null,
          teacher: null,
          timeInfo: null  // 缺少時間信息
        }
      });

      TaskService.executeIntent.mockResolvedValue({
        success: false,
        error: 'Missing required course information',
        message: '請提供課程名稱和時間信息'
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
        entities: {
          course_name: null,
          location: null,
          teacher: null,
          timeInfo: null
        }
      });

      TaskService.executeIntent.mockResolvedValue({
        success: false,
        error: 'Unknown intent',
        message: '抱歉，我無法理解您的需求，請重新描述'
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
      const bodyObject = {
        events: [
          {
            type: 'message',
            message: { type: 'text', text: '測試訊息' },
            source: { userId: 'test-user' }
          }
        ]
      };
      
      req = {
        body: Buffer.from(JSON.stringify(bodyObject)), // 模擬原始 Buffer
        get: jest.fn()
      };

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    test('should process valid webhook request', async () => {
      // 生成有效簽名 - 使用原始 Buffer 字符串，不含 sha256= 前綴
      const body = req.body.toString();
      const signature = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      
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
      req.get.mockReturnValue('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ==');

      await LineController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    test('should ignore non-text message events', async () => {
      const bodyObject = {
        events: [
          {
            type: 'message',
            message: { type: 'image' },
            source: { userId: 'test-user' }
          }
        ]
      };

      req.body = Buffer.from(JSON.stringify(bodyObject));
      const body = req.body.toString();
      const signature = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      
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
      const body = req.body.toString();
      const signature = crypto.createHmac('sha256', 'test-channel-secret').update(body).digest('base64');
      
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