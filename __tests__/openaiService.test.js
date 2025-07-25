/**
 * OpenAIService 測試
 * 使用 mock 避免真實 OpenAI API 調用
 */

const OpenAIService = require('../src/internal/openaiService');

// Mock 環境變數
const originalEnv = process.env;

describe('OpenAIService', () => {
  beforeEach(() => {
    // 重置環境變數
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key',
      OPENAI_MODEL: 'gpt-3.5-turbo',
    };
  });

  afterEach(() => {
    // 恢復原始環境變數
    process.env = originalEnv;
  });

  describe('complete', () => {
    test('should complete with valid prompt', async () => {
      const result = await OpenAIService.complete({
        prompt: '測試提示',
        max_tokens: 100,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.usage.total_tokens).toBeGreaterThan(0);
      expect(result.model).toBe('gpt-3.5-turbo');
    });

    test('should use environment variables for model', async () => {
      process.env.OPENAI_MODEL = 'gpt-4';
      
      const result = await OpenAIService.complete({
        prompt: '測試提示',
      });

      expect(result.model).toBe('gpt-4');
    });

    test('should throw error when prompt is missing', async () => {
      await expect(OpenAIService.complete({}))
        .rejects.toThrow('prompt is required');
    });

    test('should throw error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      
      await expect(OpenAIService.complete({ prompt: '測試' }))
        .rejects.toThrow('OPENAI_API_KEY environment variable is required');
    });

    test('should handle optional parameters', async () => {
      const result = await OpenAIService.complete({
        prompt: '測試提示',
        model: 'gpt-4',
        max_tokens: 200,
        temperature: 0.5,
      });

      expect(result.success).toBe(true);
      expect(result.model).toBe('gpt-4');
    });
  });

  describe('analyzeIntent', () => {
    test('should analyze intent for course cancellation', async () => {
      const text = '取消明天的數學課';
      const userId = 'user123';

      const result = await OpenAIService.analyzeIntent(text, userId);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.intent).toBe('cancel_course');
      expect(result.analysis.confidence).toBeGreaterThan(0.5);
      expect(result.usage).toBeDefined();
      expect(result.usage.total_tokens).toBeGreaterThan(0);
    });

    test('should analyze intent for course booking', async () => {
      const text = '明天下午2點安排英文課';
      const userId = 'user456';

      const result = await OpenAIService.analyzeIntent(text, userId);

      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('record_course');
      expect(result.analysis.entities).toBeDefined();
      expect(result.analysis.entities.course_name).toBe('英文');
    });

    test('should analyze intent for schedule query', async () => {
      const text = '查詢我的課表';
      const userId = 'user789';

      const result = await OpenAIService.analyzeIntent(text, userId);

      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('query_schedule');
      expect(result.analysis.confidence).toBeGreaterThan(0.8);
    });

    test('should handle reminder intent', async () => {
      const text = '物理課前10分鐘提醒我';
      const userId = 'user101';

      const result = await OpenAIService.analyzeIntent(text, userId);

      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('set_reminder');
    });

    test('should throw error when text is missing', async () => {
      await expect(OpenAIService.analyzeIntent('', 'user123'))
        .rejects.toThrow('text is required for intent analysis');
    });

    test('should handle unknown intent', async () => {
      const text = '今天天氣真好';
      const userId = 'user123';

      const result = await OpenAIService.analyzeIntent(text, userId);

      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('unknown');
      expect(result.analysis.confidence).toBeLessThan(0.8);
    });
  });

  describe('mockOpenAICall', () => {
    test('should simulate API call structure', async () => {
      const requestBody = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '系統提示' },
          { role: 'user', content: '用戶輸入' },
        ],
        max_tokens: 150,
      };

      const response = await OpenAIService.mockOpenAICall(requestBody);

      expect(response.id).toMatch(/^chatcmpl-mock-/);
      expect(response.object).toBe('chat.completion');
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe('assistant');
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    test('should handle intent analysis requests', async () => {
      const requestBody = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '系統提示' },
          { role: 'user', content: '分析以下用戶輸入，識別課程管理相關的意圖：\n\n用戶輸入: "取消數學課"' },
        ],
        max_tokens: 200,
      };

      const response = await OpenAIService.mockOpenAICall(requestBody);
      const content = JSON.parse(response.choices[0].message.content);

      expect(content.intent).toBe('cancel_course');
      expect(content.confidence).toBeGreaterThan(0.5);
      expect(content.entities).toBeDefined();
    });
  });

  describe('entity extraction helpers', () => {
    test('extractCourseName should identify course names', () => {
      expect(OpenAIService.extractCourseName('數學課')).toBe('數學');
      expect(OpenAIService.extractCourseName('英文班')).toBe('英文');
      expect(OpenAIService.extractCourseName('物理')).toBe('物理');
      expect(OpenAIService.extractCourseName('隨便的文字')).toBeNull();
    });

    test('extractTime should identify time expressions', () => {
      expect(OpenAIService.extractTime('14:30')).toBe('14:30');
      expect(OpenAIService.extractTime('下午3點')).toBe('下午3點');
      expect(OpenAIService.extractTime('晚上')).toBe('晚上');
      expect(OpenAIService.extractTime('沒有時間')).toBeNull();
    });

    test('extractDate should identify date expressions', () => {
      expect(OpenAIService.extractDate('明天')).toBe('明天');
      expect(OpenAIService.extractDate('2025-07-25')).toBe('2025-07-25');
      expect(OpenAIService.extractDate('週一')).toBe('週一');
      expect(OpenAIService.extractDate('7月25日')).toBe('7月25日');
      expect(OpenAIService.extractDate('沒有日期')).toBeNull();
    });
  });

  describe('calculateCost', () => {
    test('should calculate cost for GPT-3.5-turbo', () => {
      const cost = OpenAIService.calculateCost(1000, 'gpt-3.5-turbo');
      
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    test('should calculate cost for GPT-4', () => {
      const cost = OpenAIService.calculateCost(1000, 'gpt-4');
      
      expect(cost).toBeGreaterThan(0);
      // GPT-4 應該比 GPT-3.5-turbo 更昂貴
      const gpt35Cost = OpenAIService.calculateCost(1000, 'gpt-3.5-turbo');
      expect(cost).toBeGreaterThan(gpt35Cost);
    });

    test('should default to GPT-3.5-turbo pricing for unknown models', () => {
      const unknownModelCost = OpenAIService.calculateCost(1000, 'unknown-model');
      const gpt35Cost = OpenAIService.calculateCost(1000, 'gpt-3.5-turbo');
      
      expect(unknownModelCost).toBe(gpt35Cost);
    });

    test('should return zero cost for zero tokens', () => {
      const cost = OpenAIService.calculateCost(0, 'gpt-3.5-turbo');
      
      expect(cost).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle API errors gracefully', async () => {
      // 模擬 API 錯誤（透過移除 API key）
      delete process.env.OPENAI_API_KEY;

      await expect(OpenAIService.complete({ prompt: '測試' }))
        .rejects.toThrow('OPENAI_API_KEY environment variable is required');
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete workflow for course management', async () => {
      const testScenarios = [
        {
          input: '取消明天的數學課',
          expectedIntent: 'cancel_course',
          expectedCourse: '數學',
        },
        {
          input: '下週一下午2點安排英文課',
          expectedIntent: 'record_course',
          expectedCourse: '英文',
        },
        {
          input: '查詢我的課表',
          expectedIntent: 'query_schedule',
        },
        {
          input: '修改物理課的時間',
          expectedIntent: 'modify_course',
          expectedCourse: '物理',
        },
      ];

      for (const scenario of testScenarios) {
        const result = await OpenAIService.analyzeIntent(scenario.input, 'test-user');
        
        expect(result.success).toBe(true);
        expect(result.analysis.intent).toBe(scenario.expectedIntent);
        
        if (scenario.expectedCourse) {
          expect(result.analysis.entities.course_name).toBe(scenario.expectedCourse);
        }
        
        expect(result.usage.total_tokens).toBeGreaterThan(0);
      }
    });
  });
});