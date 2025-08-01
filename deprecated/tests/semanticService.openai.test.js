/**
 * SemanticService OpenAI 增強功能測試
 */

const SemanticService = require('../src/services/semanticService');
const OpenAIService = require('../src/internal/openaiService');

// Mock OpenAI Service
jest.mock('../src/internal/openaiService');

describe('SemanticService OpenAI Enhanced', () => {
  let semanticService;

  beforeEach(() => {
    semanticService = new SemanticService();
    jest.clearAllMocks();
  });

  describe('analyzeByOpenAI', () => {
    test('應該正確分析並返回證據驅動結果', async () => {
      // Mock OpenAI response
      const mockResponse = {
        content: JSON.stringify({
          intent: 'query_schedule',
          entities: { 
            student_name: 'Rumi',
            course_name: '科學實驗'
          },
          evidence: {
            temporal_clues: ['上次'],
            mood_indicators: ['怎麼樣'],
            action_verbs: ['上得'],
            question_markers: ['怎麼樣']
          },
          reasoning_chain: {
            step1: '識別到時間詞"上次"，表示回顧過去',
            step2: '識別到疑問語氣"怎麼樣"，表示詢問狀態',
            step3: '結合語境，判定為查詢意圖',
            confidence_source: '基於步驟1-3的邏輯鏈'
          },
          confidence: {
            overall: 0.92,
            intent_certainty: 0.95,
            context_understanding: 0.88
          }
        })
      };

      OpenAIService.complete.mockResolvedValue(mockResponse);

      const result = await semanticService.analyzeByOpenAI('上次Rumi的課怎麼樣');

      expect(result.intent).toBe('query_schedule');
      expect(result.evidence.temporal_clues).toContain('上次');
      expect(result.evidence.question_markers).toContain('怎麼樣');
      expect(result.confidence.overall).toBe(0.92);
      expect(result.reasoning_chain.step1).toContain('時間詞');
    });

    test('應該處理 JSON 解析錯誤', async () => {
      // Mock 無效 JSON 回應
      OpenAIService.complete.mockResolvedValue({
        content: '這不是有效的JSON格式'
      });

      const result = await semanticService.analyzeByOpenAI('測試錯誤');

      expect(result.intent).toBe('unknown');
      expect(result.confidence.overall).toBe(0.2);
      expect(result.reasoning_chain.confidence_source).toContain('JSON解析失敗');
    });

    test('應該處理 OpenAI API 錯誤', async () => {
      // Mock API 錯誤
      OpenAIService.complete.mockRejectedValue(new Error('API Error'));

      const result = await semanticService.analyzeByOpenAI('測試API錯誤');

      expect(result.intent).toBe('unknown');
      expect(result.confidence.overall).toBe(0.1);
      expect(result.reasoning_chain.confidence_source).toContain('分析失敗');
    });

    test('應該處理對話歷史', async () => {
      const conversationHistory = [
        { role: 'user', content: '之前的對話' },
        { role: 'assistant', content: '之前的回應' }
      ];

      const mockResponse = {
        content: JSON.stringify({
          intent: 'record_course',
          entities: {},
          evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
          reasoning_chain: { confidence_source: '基於對話歷史分析' },
          confidence: { overall: 0.8, intent_certainty: 0.8, context_understanding: 0.8 }
        })
      };

      OpenAIService.complete.mockResolvedValue(mockResponse);

      await semanticService.analyzeByOpenAI('今天數學課', conversationHistory);

      // 檢查是否調用了 OpenAI 並包含對話歷史
      expect(OpenAIService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('對話歷史')
        })
      );
    });

    test('應該驗證信心分數範圍', async () => {
      const mockResponse = {
        content: JSON.stringify({
          intent: 'record_course',
          entities: {},
          evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
          reasoning_chain: { confidence_source: '測試' },
          confidence: {
            overall: 1.5,           // 超出範圍
            intent_certainty: -0.1, // 超出範圍
            context_understanding: 0.5
          }
        })
      };

      OpenAIService.complete.mockResolvedValue(mockResponse);

      const result = await semanticService.analyzeByOpenAI('測試信心分數');

      // 信心分數應該被限制在 0-1 範圍內
      expect(result.confidence.overall).toBe(1);      // 限制為 1
      expect(result.confidence.intent_certainty).toBe(0); // 限制為 0
      expect(result.confidence.context_understanding).toBe(0.5);
    });
  });

  describe('buildEvidenceDrivenPrompt', () => {
    test('應該構建包含規則的完整 prompt', () => {
      const prompt = semanticService.buildEvidenceDrivenPrompt('上次Rumi的課怎麼樣', []);

      expect(prompt).toContain('上次Rumi的課怎麼樣');
      expect(prompt).toContain('evidence');
      expect(prompt).toContain('reasoning_chain');
      expect(prompt).toContain('上次/昨天/之前');
      expect(prompt).toContain('疑問語氣通常不是新增意圖');
    });

    test('應該包含對話歷史', () => {
      const history = [{ role: 'user', content: '測試' }];
      const prompt = semanticService.buildEvidenceDrivenPrompt('測試輸入', history);

      expect(prompt).toContain('對話歷史');
      expect(prompt).toContain('測試');
    });
  });
});