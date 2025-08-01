/**
 * SemanticController 測試 - 語意決策控制器測試
 */

const SemanticController = require('../src/services/semanticController');
const SemanticService = require('../src/services/semanticService');

// Mock SemanticService
jest.mock('../src/services/semanticService');

describe('SemanticController', () => {
  let controller;
  let mockSemanticService;

  beforeEach(() => {
    controller = new SemanticController();
    mockSemanticService = controller.semanticService;
    jest.clearAllMocks();
  });

  describe('route', () => {
    test('應該處理 P1 規則：語氣衝突檢測', async () => {
      // Mock AI 返回疑問語氣
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'query_schedule',
        entities: { student_name: 'Rumi' },
        evidence: {
          temporal_clues: ['上次'],
          mood_indicators: ['怎麼樣'],
          action_verbs: [],
          question_markers: ['怎麼樣']
        },
        reasoning_chain: {
          step1: '識別疑問語氣',
          confidence_source: '基於語氣分析'
        },
        confidence: {
          overall: 0.9,
          intent_certainty: 0.9,
          context_understanding: 0.8
        }
      });

      // Mock Regex 返回新增意圖
      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'record_course',
        entities: { course_name: '課' },
        match_details: {
          triggered_patterns: ['.*課$'],
          keyword_matches: ['課'],
          ambiguous_terms: ['課'],
          pattern_strength: 0.7
        },
        limitations: {
          context_blind: false,
          temporal_blind: true,
          mood_blind: true
        }
      });

      const result = await controller.route('上次Rumi的課怎麼樣');

      expect(result.final_intent).toBe('query_schedule');
      expect(result.source).toBe('ai');
      expect(result.used_rule).toBe('P1');
      expect(result.reason).toContain('疑問語氣與新增意圖衝突');
    });

    test('應該處理 P2 規則：時間線索權重', async () => {
      // Mock AI 返回時間線索
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'query_schedule',
        entities: {},
        evidence: {
          temporal_clues: ['昨天'],
          mood_indicators: [],
          action_verbs: [],
          question_markers: []
        },
        reasoning_chain: {
          step1: '識別時間線索',
          confidence_source: '基於時間分析'
        },
        confidence: {
          overall: 0.8,
          intent_certainty: 0.8,
          context_understanding: 0.7
        }
      });

      // Mock Regex 返回時間盲區
      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'record_course',
        entities: {},
        match_details: {
          triggered_patterns: [],
          keyword_matches: ['課'],
          ambiguous_terms: [],
          pattern_strength: 0.6
        },
        limitations: {
          context_blind: false,
          temporal_blind: true,  // 重點：時間盲區
          mood_blind: false
        }
      });

      const result = await controller.route('昨天的數學課');

      expect(result.final_intent).toBe('query_schedule');
      expect(result.source).toBe('ai');
      expect(result.used_rule).toBe('P2');
      expect(result.reason).toContain('時間線索');
    });

    test('應該處理 P3 規則：AI推理鏈完整', async () => {
      // Mock AI 返回完整推理鏈
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'record_course',
        entities: {},
        evidence: {
          temporal_clues: [],
          mood_indicators: [],
          action_verbs: ['上'],
          question_markers: []
        },
        reasoning_chain: {
          step1: '識別動作詞',
          step2: '分析語境',
          step3: '判定為記錄意圖',
          confidence_source: '基於三步推理'
        },
        confidence: {
          overall: 0.85,  // > 0.8
          intent_certainty: 0.9,
          context_understanding: 0.8
        }
      });

      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'record_course',
        entities: {},
        match_details: {
          triggered_patterns: [],
          keyword_matches: [],
          ambiguous_terms: [],
          pattern_strength: 0.5
        },
        limitations: {
          context_blind: false,
          temporal_blind: false,
          mood_blind: false
        }
      });

      const result = await controller.route('今天數學課很精彩');

      expect(result.final_intent).toBe('record_course');
      expect(result.source).toBe('ai');
      expect(result.used_rule).toBe('P3');
      expect(result.reason).toContain('推理鏈完整');
    });

    test('應該處理 P4 規則：Regex強匹配', async () => {
      // Mock AI 返回低信心
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'unknown',
        entities: {},
        evidence: {
          temporal_clues: [],
          mood_indicators: [],
          action_verbs: [],
          question_markers: []
        },
        reasoning_chain: {
          confidence_source: '信心不足'
        },
        confidence: {
          overall: 0.6,  // < 0.7
          intent_certainty: 0.6,
          context_understanding: 0.5
        }
      });

      // Mock Regex 返回強匹配
      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'query_schedule',
        entities: {},
        match_details: {
          triggered_patterns: ['查.*課'],
          keyword_matches: ['查', '課'],
          ambiguous_terms: [],  // 無歧義詞
          pattern_strength: 0.95  // > 0.9
        },
        limitations: {
          context_blind: false,
          temporal_blind: false,
          mood_blind: false
        }
      });

      const result = await controller.route('查看課程記錄');

      expect(result.final_intent).toBe('query_schedule');
      expect(result.source).toBe('regex');
      expect(result.used_rule).toBe('P4');
      expect(result.reason).toContain('強匹配且無歧義');
    });

    test('應該處理 P5 規則：默認AI策略', async () => {
      // Mock 一般情況，不符合前面規則
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'modify_course',
        entities: {},
        evidence: {
          temporal_clues: [],
          mood_indicators: [],
          action_verbs: ['修改'],
          question_markers: []
        },
        reasoning_chain: {
          step1: '識別修改詞',
          confidence_source: '基於關鍵詞'
        },
        confidence: {
          overall: 0.75,
          intent_certainty: 0.8,
          context_understanding: 0.7
        }
      });

      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'modify_course',
        entities: {},
        match_details: {
          triggered_patterns: [],
          keyword_matches: ['修改'],
          ambiguous_terms: [],
          pattern_strength: 0.8  // < 0.9
        },
        limitations: {
          context_blind: false,
          temporal_blind: false,
          mood_blind: false
        }
      });

      const result = await controller.route('修改課程時間');

      expect(result.final_intent).toBe('modify_course');
      expect(result.source).toBe('ai');
      expect(result.used_rule).toBe('P5');
      expect(result.reason).toContain('默認AI策略');
    });

    test('應該處理 Fallback 情況', async () => {
      // Mock AI 低信心
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'unknown',
        entities: {},
        evidence: {
          temporal_clues: [],
          mood_indicators: [],
          action_verbs: [],
          question_markers: []
        },
        reasoning_chain: {
          confidence_source: '無法理解'
        },
        confidence: {
          overall: 0.3,  // < 0.6
          intent_certainty: 0.3,
          context_understanding: 0.2
        }
      });

      // Mock Regex 弱匹配
      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'unknown',
        entities: {},
        match_details: {
          triggered_patterns: [],
          keyword_matches: [],
          ambiguous_terms: [],
          pattern_strength: 0.2  // < 0.5
        },
        limitations: {
          context_blind: true,
          temporal_blind: true,
          mood_blind: true
        }
      });

      const result = await controller.route('嗯...那個...課程');

      expect(result.final_intent).toBe('unknown');
      expect(result.source).toBe('fallback');
      expect(result.used_rule).toBe('FALLBACK');
      expect(result.suggestion).toContain('請明確說明');
    });

    test('應該處理系統錯誤', async () => {
      // Mock 系統錯誤
      mockSemanticService.analyzeByOpenAI.mockRejectedValue(new Error('API Error'));
      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'unknown',
        entities: {},
        match_details: { pattern_strength: 0.1 },
        limitations: {}
      });

      const result = await controller.route('測試錯誤');

      expect(result.final_intent).toBe('unknown');
      expect(result.source).toBe('fallback');
      expect(result.reason).toContain('系統錯誤');
    });

    test('應該支援 Debug 模式', async () => {
      mockSemanticService.analyzeByOpenAI.mockResolvedValue({
        intent: 'record_course',
        entities: {},
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { confidence_source: '測試' },
        confidence: { overall: 0.8, intent_certainty: 0.8, context_understanding: 0.7 }
      });

      mockSemanticService.analyzeByRegex.mockResolvedValue({
        intent: 'record_course',
        entities: {},
        match_details: { pattern_strength: 0.7 },
        limitations: {}
      });

      const result = await controller.route('測試', [], { debug: true });

      expect(result.debug_info).toBeDefined();
      expect(result.debug_info.ai_analysis).toBeDefined();
      expect(result.debug_info.regex_analysis).toBeDefined();
      expect(result.debug_info.decision_path).toBeInstanceOf(Array);
    });
  });

  describe('靜態方法', () => {
    test('SemanticController.analyze 應該正常工作', async () => {
      // Mock
      SemanticService.mockImplementation(() => ({
        analyzeByOpenAI: jest.fn().mockResolvedValue({
          intent: 'record_course',
          entities: {},
          evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
          reasoning_chain: { confidence_source: '靜態測試' },
          confidence: { overall: 0.8, intent_certainty: 0.8, context_understanding: 0.7 }
        }),
        analyzeByRegex: jest.fn().mockResolvedValue({
          intent: 'record_course',
          entities: {},
          match_details: { pattern_strength: 0.6 },
          limitations: {}
        })
      }));

      const result = await SemanticController.analyze('測試靜態方法');

      expect(result.final_intent).toBe('record_course');
      expect(result.source).toBe('ai');
    });
  });
});