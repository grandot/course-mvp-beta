/**
 * SemanticService Contract Tests
 * 測試 Step 2 的數據契約重構
 */

const semanticService = require('../src/services/semanticService');
const TimeService = require('../src/services/timeService');

// Mock dependencies
jest.mock('../src/utils/intentRuleEngine');
jest.mock('../src/internal/openaiService');
jest.mock('../src/services/dataService');

const IntentRuleEngine = require('../src/utils/intentRuleEngine');
const OpenAIService = require('../src/internal/openaiService');
const DataService = require('../src/services/dataService');

describe('SemanticService Contract Tests - Step 2 Output Contract Refactor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeMessage output contract', () => {
    test('should return entities with integrated timeInfo structure', async () => {
      // Mock 規則引擎返回高信心度結果
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      // Mock OpenAI 實體提取
      OpenAIService.extractCourseName.mockReturnValue('數學');

      // Mock TimeService.parseTimeString 返回有效時間
      jest.spyOn(TimeService, 'parseTimeString').mockResolvedValue(
        new Date('2025-07-26T14:30:00.000Z')
      );

      // Mock OpenAI 輔助方法
      OpenAIService.extractTime.mockReturnValue('2點');
      OpenAIService.extractDate.mockReturnValue('明天');

      const result = await semanticService.analyzeMessage('明天2點數學課', 'test-user');

      // 驗證基本結構
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('entities');
      expect(result.entities).toHaveProperty('course_name');
      expect(result.entities).toHaveProperty('timeInfo');

      // 驗證 timeInfo 契約
      if (result.entities.timeInfo) {
        expect(TimeService.validateTimeInfo(result.entities.timeInfo)).toBe(true);
        expect(result.entities.timeInfo).toHaveProperty('display');
        expect(result.entities.timeInfo).toHaveProperty('date');
        expect(result.entities.timeInfo).toHaveProperty('raw');
        expect(result.entities.timeInfo).toHaveProperty('timestamp');
      }
    });

    test('should handle null timeInfo gracefully', async () => {
      // Mock 規則引擎返回高信心度結果
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'query_schedule',
        confidence: 0.9
      });

      // Mock OpenAI 實體提取
      OpenAIService.extractCourseName.mockReturnValue(null);

      // Mock 沒有時間信息的情況
      OpenAIService.extractTime.mockReturnValue(null);
      OpenAIService.extractDate.mockReturnValue(null);

      const result = await semanticService.analyzeMessage('查看課表', 'test-user');

      expect(result.success).toBe(true);
      expect(result.entities).toHaveProperty('timeInfo', null);
      expect(TimeService.validateTimeInfo(result.entities.timeInfo)).toBe(true);
    });

    test('should integrate timeInfo from OpenAI flow', async () => {
      // Mock 規則引擎返回低信心度
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'unknown',
        confidence: 0.3
      });

      // Mock OpenAI 返回成功結果
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: true,
        analysis: {
          intent: 'record_course',
          confidence: 0.85,
          entities: {
            course_name: '法語',
            location: null,
            teacher: null
          },
          reasoning: 'User wants to record a French class'
        },
        usage: { total_tokens: 150 },
        model: 'gpt-3.5-turbo'
      });

      // Mock token usage logging
      DataService.logTokenUsage.mockResolvedValue({ success: true });

      // Mock OpenAI 計算成本
      OpenAIService.calculateCost.mockReturnValue(0.05);

      // Mock TimeService.parseTimeString 返回有效時間
      jest.spyOn(TimeService, 'parseTimeString').mockResolvedValue(
        new Date('2025-07-26T22:30:00.000Z')
      );

      // Mock OpenAI 輔助方法
      OpenAIService.extractTime.mockReturnValue('晚上十點半');
      OpenAIService.extractDate.mockReturnValue('明天');

      const result = await semanticService.analyzeMessage('明天晚上十點半法語課', 'test-user');

      expect(result.success).toBe(true);
      expect(result.method).toBe('openai');
      expect(result.entities).toHaveProperty('course_name', '法語');
      expect(result.entities).toHaveProperty('timeInfo');

      if (result.entities.timeInfo) {
        expect(TimeService.validateTimeInfo(result.entities.timeInfo)).toBe(true);
        expect(result.entities.timeInfo.display).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
        expect(result.entities.timeInfo.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    test('should integrate timeInfo from rule engine fallback', async () => {
      // Mock 規則引擎返回低信心度
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.5
      });

      // Mock OpenAI 失敗
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: false,
        error: 'API error',
        usage: { total_tokens: 0 }
      });

      // Mock OpenAI 實體提取
      OpenAIService.extractCourseName.mockReturnValue('物理');

      // Mock TimeService.parseTimeString 返回有效時間
      jest.spyOn(TimeService, 'parseTimeString').mockResolvedValue(
        new Date('2025-07-27T08:00:00.000Z')
      );

      // Mock OpenAI 輔助方法
      OpenAIService.extractTime.mockReturnValue('上午八點');
      OpenAIService.extractDate.mockReturnValue('後天');

      const result = await semanticService.analyzeMessage('後天上午八點物理課', 'test-user');

      expect(result.success).toBe(true);
      expect(result.method).toBe('rule_engine_fallback');
      expect(result.entities).toHaveProperty('course_name', '物理');
      expect(result.entities).toHaveProperty('timeInfo');

      if (result.entities.timeInfo) {
        expect(TimeService.validateTimeInfo(result.entities.timeInfo)).toBe(true);
      }
    });

    test('should handle error cases with correct entities structure', async () => {
      // Mock 拋出錯誤
      IntentRuleEngine.analyzeIntent.mockImplementation(() => {
        throw new Error('Mock analysis error');
      });

      const result = await semanticService.analyzeMessage('測試錯誤', 'test-user');

      expect(result.success).toBe(false);
      expect(result.entities).toHaveProperty('course_name', null);
      expect(result.entities).toHaveProperty('location', null);
      expect(result.entities).toHaveProperty('teacher', null);
      expect(result.entities).toHaveProperty('timeInfo', null);
    });
  });

  describe('backward compatibility tests', () => {
    test('should not break existing functionality', async () => {
      // Mock 規則引擎返回高信心度結果
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'cancel_course',
        confidence: 0.95
      });

      // Mock OpenAI 實體提取
      OpenAIService.extractCourseName.mockReturnValue('英文');

      // Mock 沒有時間信息（取消課程不需要時間）
      OpenAIService.extractTime.mockReturnValue(null);
      OpenAIService.extractDate.mockReturnValue(null);

      const result = await semanticService.analyzeMessage('取消英文課', 'test-user');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('cancel_course');
      expect(result.entities.course_name).toBe('英文');
      expect(result.entities.timeInfo).toBe(null);
    });
  });
});