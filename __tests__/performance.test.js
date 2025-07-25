/**
 * Performance Tests
 * 測試 Step 6 的邏輯清理和性能優化
 */

const SemanticService = require('../src/services/semanticService');

// Mock dependencies
jest.mock('../src/utils/intentRuleEngine');
jest.mock('../src/internal/openaiService');
jest.mock('../src/services/dataService');

const IntentRuleEngine = require('../src/utils/intentRuleEngine');
const OpenAIService = require('../src/internal/openaiService');

describe('Performance Tests - Step 6 Logic Cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Time extraction efficiency', () => {
    test('should call time extraction only once per analyze request', async () => {
      // Mock 規則引擎返回高信心度
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      // Mock OpenAI 實體提取和時間解析方法
      OpenAIService.extractCourseName.mockReturnValue('數學');
      OpenAIService.extractTime.mockReturnValue('2點');
      OpenAIService.extractDate.mockReturnValue('明天');
      
      // 創建 spy 來監控 TimeService 調用
      const TimeService = require('../src/services/timeService');
      const parseTimeStringSpy = jest.spyOn(TimeService, 'parseTimeString')
        .mockResolvedValue(new Date('2025-07-26T14:00:00.000Z'));
      const createTimeInfoSpy = jest.spyOn(TimeService, 'createTimeInfo')
        .mockReturnValue({
          display: '07/26 2:00 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:00:00.000Z',
          timestamp: 1721998800000
        });

      await SemanticService.analyzeMessage('明天2點數學課', 'test-user');

      // 驗證時間解析只被調用一次
      expect(parseTimeStringSpy).toHaveBeenCalledTimes(1);
      expect(createTimeInfoSpy).toHaveBeenCalledTimes(1);

      parseTimeStringSpy.mockRestore();
      createTimeInfoSpy.mockRestore();
    });

    test('should call entity extraction only once per analyze request', async () => {
      // Mock 規則引擎返回高信心度
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      // 創建 spy 來監控實體提取調用
      const extractCourseNameSpy = jest.spyOn(OpenAIService, 'extractCourseName')
        .mockReturnValue('數學');
      const extractTimeSpy = jest.spyOn(OpenAIService, 'extractTime')
        .mockReturnValue('2點');
      const extractDateSpy = jest.spyOn(OpenAIService, 'extractDate')
        .mockReturnValue('明天');

      // Mock TimeService
      const TimeService = require('../src/services/timeService');
      jest.spyOn(TimeService, 'parseTimeString')
        .mockResolvedValue(new Date('2025-07-26T14:00:00.000Z'));
      jest.spyOn(TimeService, 'createTimeInfo')
        .mockReturnValue({
          display: '07/26 2:00 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:00:00.000Z'
        });

      await SemanticService.analyzeMessage('明天2點數學課', 'test-user');

      // 驗證實體提取只被調用一次
      expect(extractCourseNameSpy).toHaveBeenCalledTimes(1);
      expect(extractTimeSpy).toHaveBeenCalledTimes(1);
      expect(extractDateSpy).toHaveBeenCalledTimes(1);
    });

    test('should reuse extracted entities in OpenAI fallback path', async () => {
      // Mock 規則引擎返回低信心度
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'unknown',
        confidence: 0.3
      });

      // Mock OpenAI 失敗
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: false,
        error: 'API error',
        usage: { total_tokens: 0 }
      });

      // 創建 spy 來監控實體提取是否被重複調用
      const extractCourseNameSpy = jest.spyOn(OpenAIService, 'extractCourseName')
        .mockReturnValue('物理');

      // Mock TimeService
      const TimeService = require('../src/services/timeService');
      jest.spyOn(TimeService, 'parseTimeString')
        .mockResolvedValue(null);
      jest.spyOn(TimeService, 'createTimeInfo')
        .mockReturnValue(null);

      await SemanticService.analyzeMessage('物理課', 'test-user');

      // 驗證實體提取只被調用一次（在統一提取階段）
      expect(extractCourseNameSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Method efficiency', () => {
    test('processTimeInfo should handle errors gracefully', async () => {
      // Mock 規則引擎
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      // Mock extractTimeInfo 拋出錯誤
      const extractTimeInfoSpy = jest.spyOn(SemanticService, 'extractTimeInfo')
        .mockRejectedValue(new Error('Time parsing error'));

      // Mock 其他必要方法
      OpenAIService.extractCourseName.mockReturnValue('數學');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await SemanticService.analyzeMessage('明天數學課', 'test-user');

      // 驗證錯誤被捕獲，不會中斷整個分析流程
      expect(result.success).toBe(true);
      expect(result.entities.timeInfo).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Time processing failed:', 'Time parsing error');

      extractTimeInfoSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('should maintain performance with multiple requests', async () => {
      // Mock 規則引擎
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      // Mock dependencies
      OpenAIService.extractCourseName.mockReturnValue('數學');
      OpenAIService.extractTime.mockReturnValue('2點');
      OpenAIService.extractDate.mockReturnValue('明天');

      const TimeService = require('../src/services/timeService');
      jest.spyOn(TimeService, 'parseTimeString')
        .mockResolvedValue(new Date('2025-07-26T14:00:00.000Z'));
      jest.spyOn(TimeService, 'createTimeInfo')
        .mockReturnValue({
          display: '07/26 2:00 PM',
          date: '2025-07-26',
          raw: '2025-07-26T14:00:00.000Z'
        });

      const startTime = Date.now();

      // 並發執行多個請求
      const promises = Array.from({ length: 10 }, (_, i) => 
        SemanticService.analyzeMessage(`明天2點數學課 ${i}`, `test-user-${i}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 驗證所有請求都成功
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.intent).toBe('record_course');
      });

      // 驗證性能（10個請求應該在合理時間內完成）
      expect(totalTime).toBeLessThan(1000); // 1秒內完成
      
      console.log(`Processed ${results.length} requests in ${totalTime}ms`);
      console.log(`Average time per request: ${totalTime / results.length}ms`);
    });
  });

  describe('Code duplication elimination', () => {
    test('should use unified processTimeInfo method', async () => {
      // 驗證新的 processTimeInfo 方法存在
      expect(typeof SemanticService.processTimeInfo).toBe('function');
    });

    test('should maintain consistent time format across all paths', async () => {
      const TimeService = require('../src/services/timeService');
      const expectedTimeInfo = {
        display: '07/26 2:00 PM',
        date: '2025-07-26',
        raw: '2025-07-26T14:00:00.000Z',
        timestamp: 1721998800000
      };

      // Mock TimeService
      jest.spyOn(TimeService, 'parseTimeString')
        .mockResolvedValue(new Date('2025-07-26T14:00:00.000Z'));
      jest.spyOn(TimeService, 'createTimeInfo')
        .mockReturnValue(expectedTimeInfo);

      // Mock OpenAI methods
      OpenAIService.extractCourseName.mockReturnValue('數學');
      OpenAIService.extractTime.mockReturnValue('2點');
      OpenAIService.extractDate.mockReturnValue('明天');

      // 測試規則引擎路徑
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.9
      });

      const ruleResult = await SemanticService.analyzeMessage('明天2點數學課', 'test-user');
      expect(ruleResult.entities.timeInfo).toEqual(expectedTimeInfo);

      // 測試 OpenAI 成功路徑
      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'unknown',
        confidence: 0.3
      });

      OpenAIService.analyzeIntent.mockResolvedValue({
        success: true,
        analysis: {
          intent: 'record_course',
          confidence: 0.85,
          entities: {
            course_name: '數學',
            location: null,
            teacher: null
          },
          reasoning: 'User wants to record a course'
        },
        usage: { total_tokens: 150 },
        model: 'gpt-3.5-turbo'
      });

      const openaiResult = await SemanticService.analyzeMessage('明天2點數學課', 'test-user');
      expect(openaiResult.entities.timeInfo).toEqual(expectedTimeInfo);

      // 測試 OpenAI 回退路徑
      OpenAIService.analyzeIntent.mockResolvedValue({
        success: false,
        error: 'API error',
        usage: { total_tokens: 0 }
      });

      IntentRuleEngine.analyzeIntent.mockReturnValue({
        intent: 'record_course',
        confidence: 0.5
      });

      const fallbackResult = await SemanticService.analyzeMessage('明天2點數學課', 'test-user');
      expect(fallbackResult.entities.timeInfo).toEqual(expectedTimeInfo);
    });
  });
});