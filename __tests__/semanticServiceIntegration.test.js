/**
 * SemanticService 集成測試
 * 驗證核心功能是否正常工作（無 mock）
 */

const SemanticService = require('../src/services/semanticService');
const DataService = require('../src/services/dataService');

describe('SemanticService Integration Tests', () => {
  beforeEach(() => {
    DataService.clearStorage();
    // 設置測試環境變數
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('analyzeMessage - Core Functionality', () => {
    test('should analyze high confidence intent with rule engine', async () => {
      const text = '取消明天的數學課';
      const userId = 'user123';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('rule_engine');
      expect(result.intent).toBe('cancel_course');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.entities).toBeDefined();
      expect(result.entities.course_name).toBe('數學');
      expect(result.entities.timeInfo).toBeDefined();
      expect(result.entities.timeInfo.raw).toBeDefined();
    });

    test('should handle course creation intent', async () => {
      const text = '明天下午2點在A教室上王老師的數學課';
      const userId = 'user456';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(result.entities.course_name).toBe('數學');
      expect(result.entities.location).toBe('A教室');
      expect(result.entities.teacher).toBe('王');
      expect(result.entities.timeInfo).toBeDefined();
    });

    test('should handle schedule query intent', async () => {
      const text = '查詢我的課表';
      const userId = 'user789';

      const result = await SemanticService.analyzeMessage(text, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('query_schedule');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('extractCourseEntities - Core Functionality', () => {
    test('should extract course name correctly', async () => {
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

    test('should extract complex entities', async () => {
      const entities = await SemanticService.extractCourseEntities(
        '明天下午在B教室上李教授的物理課',
        'user123'
      );

      expect(entities.course_name).toBe('物理');
      expect(entities.location).toBe('B教室');
      expect(entities.teacher).toBe('李');
    });
  });

  describe('extractTimeInfo - Core Functionality', () => {
    test('should extract time and date information', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('明天下午3點');

      expect(timeInfo.time).toBeDefined();
      expect(timeInfo.date).toBe('明天');
      expect(timeInfo.parsed_time).toBeInstanceOf(Date);
    });

    test('should handle time parsing gracefully', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('無效的時間');

      expect(timeInfo.time).toBeNull();
      expect(timeInfo.date).toBeNull();
      expect(timeInfo.parsed_time).toBeNull();
    });
  });

  describe('identifyIntent - Core Functionality', () => {
    test('should identify various intents correctly', async () => {
      const testCases = [
        { text: '取消課程', expected: 'cancel_course' },
        { text: '新增數學課', expected: 'record_course' },
        { text: '查詢課表', expected: 'query_schedule' },
        { text: '修改時間', expected: 'modify_course' },
        { text: '提醒我上課', expected: 'set_reminder' },
        { text: '隨便的文字', expected: 'unknown' },
      ];

      for (const testCase of testCases) {
        const intent = await SemanticService.identifyIntent(testCase.text);
        expect(intent).toBe(testCase.expected);
      }
    });
  });

  describe('validateAnalysis - Core Functionality', () => {
    test('should validate correct analysis results', async () => {
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

    test('should reject invalid analysis results', async () => {
      const invalidResults = [
        null,
        {},
        { success: true }, // 缺少必要字段
        { success: true, intent: 'invalid_intent', confidence: 0.8 },
        { success: true, intent: 'record_course', confidence: 1.5 },
      ];

      for (const invalidResult of invalidResults) {
        const isValid = await SemanticService.validateAnalysis(invalidResult);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Token Usage Tracking', () => {
    test('should not log tokens for rule engine usage', async () => {
      const text = '取消課程'; // 高信心度，使用規則引擎
      const userId = 'user123';

      await SemanticService.analyzeMessage(text, userId);

      // 規則引擎不應記錄 token
      const tokenEntries = Array.from(DataService.tokenUsage.values());
      expect(tokenEntries).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid parameters gracefully', async () => {
      await expect(SemanticService.analyzeMessage('', 'user123'))
        .rejects.toThrow('text must be a non-empty string');

      await expect(SemanticService.analyzeMessage('valid text', ''))
        .rejects.toThrow('userId is required');
    });

    test('should handle empty inputs gracefully', async () => {
      const entities = await SemanticService.extractCourseEntities('', 'user123');
      expect(entities.course_name).toBeNull();

      const timeInfo = await SemanticService.extractTimeInfo('');
      expect(timeInfo.time).toBeNull();

      const intent = await SemanticService.identifyIntent('');
      expect(intent).toBe('unknown');
    });
  });

  describe('Integration with Other Services', () => {
    test('should work with DataService for logging', async () => {
      // 這個測試驗證服務間的集成是否正常
      const initialTokenCount = Array.from(DataService.tokenUsage.values()).length;
      
      // 執行一些操作
      await SemanticService.analyzeMessage('取消課程', 'user123');
      
      // 驗證 DataService 仍然可以正常工作
      const finalTokenCount = Array.from(DataService.tokenUsage.values()).length;
      expect(finalTokenCount).toBe(initialTokenCount); // 規則引擎不記錄 token
    });

    test('should integrate with TimeService for parsing', async () => {
      const timeInfo = await SemanticService.extractTimeInfo('明天下午3點');
      
      // 驗證 TimeService 集成正常
      expect(timeInfo.parsed_time).toBeInstanceOf(Date);
      expect(timeInfo.parsed_time.getHours()).toBe(15); // 下午3點 = 15:00
    });
  });
});