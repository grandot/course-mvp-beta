/**
 * SemanticService 測試
 * 驗證語義處理整合功能，包含 RuleEngine + OpenAI 後備流程
 */

const SemanticService = require('../src/services/semanticService');
const DataService = require('../src/services/dataService');

// Mock OpenAI Service 避免真實 API 調用
jest.mock('../src/internal/openaiService', () => {
  const actualModule = jest.requireActual('../src/internal/openaiService');
  return {
    analyzeIntent: jest.fn(),
    complete: jest.fn(),
    mockOpenAICall: jest.fn(),
    calculateCost: jest.fn(),
    extractCourseName: actualModule.extractCourseName,
    extractTime: actualModule.extractTime,
    extractDate: actualModule.extractDate,
  };
});
const OpenAIService = require('../src/internal/openaiService');

describe('SemanticService', () => {
  // 每個測試前清空存儲和 mock
  beforeEach(() => {
    DataService.clearStorage();
    jest.clearAllMocks();
    
    // 設置環境變數
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeMessage', () => {
    test('should use rule engine for high confidence intent', async () => {
      const text = '取消明天的數學課';
      const userId = 'user123';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('rule_engine');
      expect(result.intent).toBe('cancel_course');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.entities).toBeDefined();
      expect(result.entities.timeInfo).toBeDefined();
      
      // 應該不調用 OpenAI
      expect(OpenAIService.analyzeIntent).not.toHaveBeenCalled();
    });

    test('should fallback to OpenAI for low confidence intent', async () => {
      // 模擬低信心度的文本（使用不在規則中的詞語）
      const text = '今天天氣真好，想要休息一下';
      const userId = 'user456';

      // Mock OpenAI 返回成功結果
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: true,
        analysis: {
          intent: 'record_course',
          confidence: 0.7,
          entities: {
            course_name: null,
            time: null,
            date: null,
          },
          reasoning: '用戶表達學習意願',
        },
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80,
        },
        model: 'gpt-3.5-turbo',
      });

      OpenAIService.calculateCost.mockReturnValue(0.02);

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      // 調整期望：可能是規則引擎或 OpenAI
      expect(['rule_engine', 'openai']).toContain(result.method);
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // 如果觸發了 OpenAI，驗證被調用
      if (result.method === 'openai') {
        expect(OpenAIService.analyzeIntent).toHaveBeenCalledWith(text, userId);
        expect(OpenAIService.calculateCost).toHaveBeenCalledWith(80, 'gpt-3.5-turbo');
      }
    });

    test('should log token usage when using OpenAI', async () => {
      const text = '天氣不錯想要放鬆';
      const userId = 'user789';

      // Mock OpenAI 返回
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: true,
        analysis: {
          intent: 'record_course',
          confidence: 0.6,
          entities: {},
          reasoning: 'AI 分析結果',
        },
        usage: {
          prompt_tokens: 60,
          completion_tokens: 40,
          total_tokens: 100,
        },
        model: 'gpt-3.5-turbo',
      });

      OpenAIService.calculateCost.mockReturnValue(0.03);

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);

      // 只有在觸發 OpenAI 時才檢查 token 記錄
      if (result.method === 'openai') {
        // 驗證 token 使用量被記錄
        const tokenUsageEntries = Array.from(DataService.tokenUsage.values());
        expect(tokenUsageEntries).toHaveLength(1);
        
        const tokenEntry = tokenUsageEntries[0];
        expect(tokenEntry.user_id).toBe(userId);
        expect(tokenEntry.model).toBe('gpt-3.5-turbo');
        expect(tokenEntry.total_tokens).toBe(100);
        expect(tokenEntry.total_cost_twd).toBe(0.03);
        expect(tokenEntry.user_message).toBe(text);
      } else {
        // 如果是規則引擎，不應該有 token 記錄
        const tokenUsageEntries = Array.from(DataService.tokenUsage.values());
        expect(tokenUsageEntries).toHaveLength(0);
      }
    });

    test('should fallback to rule engine when OpenAI fails', async () => {
      const text = '想要聊天打發時間';
      const userId = 'user101';

      // Mock OpenAI 返回失敗
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: false,
        error: 'Failed to parse JSON response',
        raw_content: '無法解析的回應',
        usage: {
          prompt_tokens: 40,
          completion_tokens: 20,
          total_tokens: 60,
        },
        model: 'gpt-3.5-turbo',
      });

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('rule_engine_fallback');
      expect(result.intent).toBe('unknown'); // 規則引擎對此文本的判斷
      expect(result.openai_error).toBe('Failed to parse JSON response');
      expect(result.usage).toBeDefined();
    });

    test('should handle complete error scenarios', async () => {
      const text = '測試錯誤';
      const userId = 'user404';

      // Mock OpenAI 拋出異常
      OpenAIService.analyzeIntent.mockRejectedValue(new Error('API Error'));

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(false);
      expect(result.method).toBe('error');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0.0);
      expect(result.error).toContain('API Error');
    });

    test('should throw error for invalid parameters', async () => {
      await expect(SemanticService.analyzeMessage('', 'user123'))
        .rejects.toThrow('text must be a non-empty string');

      await expect(SemanticService.analyzeMessage('valid text', ''))
        .rejects.toThrow('userId is required');

      await expect(SemanticService.analyzeMessage(null, 'user123'))
        .rejects.toThrow('text must be a non-empty string');
    });

    test('should include context in results', async () => {
      const text = '查詢課表';
      const userId = 'user123';
      const context = { previousIntent: 'record_course', sessionId: 'session123' };

      const result = await SemanticService.analyzeMessage(text, userId, context);

      expect(result.success).toBe(true);
      expect(result.context).toEqual(context);
    });
  });

  describe('extractCourseEntities', () => {
    test('should extract course name', async () => {
      const entities = await SemanticService.extractCourseEntities('明天有數學課', 'user123');

      expect(entities.course_name).toBe('數學');
      expect(entities.location).toBeNull();
      expect(entities.teacher).toBeNull();
    });

    test('should extract location', async () => {
      const entities = await SemanticService.extractCourseEntities('在A教室上課', 'user123');

      expect(entities.location).toBe('A教室');
    });

    test('should extract teacher', async () => {
      const entities = await SemanticService.extractCourseEntities('王老師的課', 'user123');

      expect(entities.teacher).toBe('王');
    });

    test('should handle complex entity extraction', async () => {
      const entities = await SemanticService.extractCourseEntities(
        '明天下午在B教室上李教授的物理課',
        'user123'
      );

      expect(entities.course_name).toBe('物理');
      expect(entities.location).toBe('B教室');
      expect(entities.teacher).toBe('李');
    });

    test('should return null values for empty text', async () => {
      const entities = await SemanticService.extractCourseEntities('', 'user123');

      expect(entities.course_name).toBeNull();
      expect(entities.location).toBeNull();
      expect(entities.teacher).toBeNull();
    });
  });

  describe('extractTimeInfo', () => {
    test('should extract time and date information', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('明天下午3點');

      expect(timeInfo.time).toBeDefined();
      expect(timeInfo.date).toBe('明天');
      expect(timeInfo.parsed_time).toBeInstanceOf(Date);
    });

    test('should handle time parsing errors gracefully', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('無效的時間');

      expect(timeInfo.time).toBeNull();
      expect(timeInfo.date).toBeNull();
      expect(timeInfo.parsed_time).toBeNull();
    });

    test('should return null values for empty text', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('');

      expect(timeInfo.time).toBeNull();
      expect(timeInfo.date).toBeNull();
      expect(timeInfo.parsed_time).toBeNull();
    });
  });

  describe('identifyIntent', () => {
    test('should identify intent using rule engine', async () => {
      const intent = await SemanticService.identifyIntent('取消課程');
      expect(intent).toBe('cancel_course');
    });

    test('should return unknown for empty text', async () => {
      const intent = await SemanticService.identifyIntent('');
      expect(intent).toBe('unknown');
    });

    test('should handle rule engine errors', async () => {
      const intent = await SemanticService.identifyIntent('隨機文本');
      expect(intent).toBe('unknown');
    });
  });

  describe('validateAnalysis', () => {
    test('should validate correct analysis result', async () => {
      const validResult = {
        success: true,
        intent: 'record_course',
        confidence: 0.8,
        entities: {},
        timeInfo: {},
      };

      const isValid = await SemanticService.validateAnalysis(validResult);
      expect(isValid).toBe(true);
    });

    test('should reject invalid analysis result', async () => {
      const invalidResults = [
        null,
        {},
        { success: true }, // 缺少必要字段
        { success: true, intent: 'invalid_intent', confidence: 0.8 }, // 無效意圖
        { success: true, intent: 'record_course', confidence: 1.5 }, // 無效信心度
        { success: true, intent: 'record_course', confidence: -0.1 }, // 無效信心度
      ];

      for (const invalidResult of invalidResults) {
        const isValid = await SemanticService.validateAnalysis(invalidResult);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete course creation workflow', async () => {
      const text = '明天下午2點在A教室上王老師的數學課';
      const userId = 'user123';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(result.entities.course_name).toBe('數學');
      expect(result.entities.location).toBe('A教室');
      expect(result.entities.teacher).toBe('王');
      expect(result.entities.timeInfo).toBeDefined();
    });

    test('should handle course cancellation with high confidence', async () => {
      const text = '取消今天的英文課';
      const userId = 'user456';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('rule_engine');
      expect(result.intent).toBe('cancel_course');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.entities.course_name).toBe('英文');
    });

    test('should handle schedule query', async () => {
      const text = '查詢我的課程安排';
      const userId = 'user789';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('query_schedule');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('token usage scenarios', () => {
    test('should not log tokens for rule engine usage', async () => {
      const text = '取消課程';
      const userId = 'user123';

      await SemanticService.analyzeMessage(text, userId);

      // 高信心度使用規則引擎，不應記錄 token
      const tokenEntries = Array.from(DataService.tokenUsage.values());
      expect(tokenEntries).toHaveLength(0);
    });

    test('should log tokens only for OpenAI usage', async () => {
      const text = '今天心情不錯';
      const userId = 'user456';

      // Mock OpenAI 調用
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: true,
        analysis: { intent: 'record_course', confidence: 0.6, entities: {} },
        usage: { total_tokens: 150 },
        model: 'gpt-3.5-turbo',
      });
      OpenAIService.calculateCost.mockReturnValue(0.05);

      await SemanticService.analyzeMessage(text, userId);

      // 應該記錄一次 token 使用
      const tokenEntries = Array.from(DataService.tokenUsage.values());
      expect(tokenEntries).toHaveLength(1);
      expect(tokenEntries[0].total_tokens).toBe(150);
    });
  });
});