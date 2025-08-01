/**
 * SemanticController 與 SemanticNormalizer 集成單元測試
 * 使用Mock避免外部依賴，快速驗證集成邏輯
 */

const SemanticController = require('../src/services/semanticController');

// Mock SemanticService 避免實際OpenAI調用
jest.mock('../src/services/semanticService', () => {
  const mockImplementation = jest.fn().mockImplementation(() => ({
    analyzeByOpenAI: jest.fn().mockResolvedValue({
      intent: 'record_course',
      entities: {
        '課程名稱': '數學',
        '學生姓名': '小明',
        '時間': '下午2點',
        'confirmation': '是'
      },
      evidence: {
        temporal_clues: [],
        mood_indicators: [],
        action_verbs: ['記錄'],
        question_markers: []
      },
      reasoning_chain: {
        step1: '識別到記錄意圖',
        step2: '找到課程名稱',
        step3: '確認學生信息',
        confidence_source: '高信心度'
      },
      confidence: {
        overall: 0.9,
        intent_certainty: 0.9,
        context_understanding: 0.85
      }
    }),
    analyzeByRegex: jest.fn().mockResolvedValue({
      intent: 'record_course',
      entities: {
        course_name: '數學',
        student_name: '小明'
      },
      match_details: {
        triggered_patterns: ['.*課$'],
        keyword_matches: ['課', '記錄'],
        ambiguous_terms: [],
        pattern_strength: 0.8
      },
      limitations: {
        context_blind: false,
        temporal_blind: false,
        mood_blind: false
      }
    })
  }));
  
  // 添加靜態方法
  mockImplementation.debugLog = jest.fn();
  
  return mockImplementation;
});

describe('SemanticController + SemanticNormalizer 單元測試', () => {
  let controller;

  beforeEach(() => {
    controller = new SemanticController();
    jest.clearAllMocks();
  });

  describe('Entity標準化集成', () => {
    test('buildResult應該自動標準化中文Entity鍵名', () => {
      const mockAI = {
        intent: 'record_course',
        entities: {
          '課程名稱': '數學',
          '學生姓名': '小明',
          '時間': '下午2點',
          'confirmation': '是'
        },
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.9 }
      };

      const mockRegex = {
        intent: 'record_course',
        entities: {},
        match_details: { pattern_strength: 0.3 }
      };

      const result = controller.buildResult(
        'ai',
        'record_course',
        'P3',
        '測試標準化',
        mockAI,
        mockRegex,
        ['測試'],
        false, // 非debug模式
        0.9
      );

      expect(result).toHaveProperty('final_intent', 'record_course');
      expect(result).toHaveProperty('entities');
      
      // 驗證Entity鍵名已標準化
      expect(result.entities).toHaveProperty('course_name', '數學');
      expect(result.entities).toHaveProperty('student_name', '小明');
      expect(result.entities).toHaveProperty('time', '下午2點');
      expect(result.entities).toHaveProperty('confirmation', true); // 值也被標準化
      
      // 驗證中文鍵名已被移除
      expect(result.entities).not.toHaveProperty('課程名稱');
      expect(result.entities).not.toHaveProperty('學生姓名');
      expect(result.entities).not.toHaveProperty('時間');
    });

    test('Debug模式應該記錄標準化詳細信息', () => {
      const mockAI = {
        intent: 'modify_course',
        entities: {
          '課程名稱': '英文',
          '老師': '王老師',
          'location': '教室A'
        },
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.85 }
      };

      const mockRegex = {
        intent: 'modify_course',
        entities: {},
        match_details: { pattern_strength: 0.2 }
      };

      const result = controller.buildResult(
        'ai',
        'modify_course',
        'P3',
        '測試Debug模式',
        mockAI,
        mockRegex,
        ['測試Debug'],
        true, // Debug模式
        0.85
      );

      expect(result).toHaveProperty('debug_info');
      expect(result.debug_info).toHaveProperty('entity_normalization');
      
      const normInfo = result.debug_info.entity_normalization;
      expect(normInfo).toHaveProperty('applied', true);
      expect(normInfo).toHaveProperty('key_mappings');
      expect(normInfo).toHaveProperty('original_entities');
      
      // 驗證映射記錄
      expect(normInfo.key_mappings).toHaveProperty('課程名稱', 'course_name');
      expect(normInfo.key_mappings).toHaveProperty('老師', 'teacher');
      expect(normInfo.original_entities).toEqual(mockAI.entities);
    });

    test('標準化失敗時應該有Fallback保護', () => {
      // 創建可能導致標準化錯誤的數據
      const circularRef = {};
      circularRef.self = circularRef;
      
      const mockAI = {
        intent: 'cancel_course',
        entities: {
          '課程名稱': '物理',
          'problematic_data': circularRef
        },
        confidence: { overall: 0.8 }
      };

      const mockRegex = {
        intent: 'cancel_course',
        entities: {},
        match_details: { pattern_strength: 0.1 }
      };

      // 這個調用不應該崩潰
      const result = controller.buildResult(
        'ai',
        'cancel_course',
        'P3',
        '測試錯誤處理',
        mockAI,
        mockRegex,
        ['測試錯誤'],
        true, // Debug模式
        0.8
      );

      expect(result).toHaveProperty('final_intent', 'cancel_course');
      expect(result).toHaveProperty('entities');
      
      // 即使標準化失敗，也應該有entities
      expect(result.entities).toBeTruthy();
    });

    test('Regex來源的Entity也應該被標準化', () => {
      const mockAI = {
        intent: 'query_schedule',
        entities: {},
        confidence: { overall: 0.3 }
      };

      const mockRegex = {
        intent: 'query_schedule',
        entities: {
          '學生姓名': '小華',
          'date': '明天',
          '時間短語': '下午'
        },
        match_details: { pattern_strength: 0.95 }
      };

      const result = controller.buildResult(
        'regex', // 使用Regex來源
        'query_schedule',
        'P4',
        'Regex強匹配',
        mockAI,
        mockRegex,
        ['P4測試'],
        false,
        0.95
      );

      expect(result).toHaveProperty('entities');
      expect(result.entities).toHaveProperty('student_name', '小華');
      expect(result.entities).toHaveProperty('date', '明天');
      expect(result.entities).toHaveProperty('time_phrase', 'afternoon'); // 值也被標準化
      
      // 中文鍵名應該被移除
      expect(result.entities).not.toHaveProperty('學生姓名');
      expect(result.entities).not.toHaveProperty('時間短語');
    });
  });

  describe('向後兼容性', () => {
    test('輸出格式應該保持完全向後兼容', () => {
      const mockAI = {
        intent: 'clear_schedule',
        entities: { 'confirmation': '確認' },
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.95 }
      };

      const mockRegex = {
        intent: 'clear_schedule',
        entities: {},
        match_details: { pattern_strength: 0.1 }
      };

      const result = controller.buildResult(
        'ai',
        'clear_schedule',
        'P3',
        '測試兼容性',
        mockAI,
        mockRegex,
        ['兼容性測試'],
        false,
        0.95
      );

      // 驗證所有必要的字段都存在
      expect(result).toHaveProperty('final_intent', 'clear_schedule');
      expect(result).toHaveProperty('source', 'ai');
      expect(result).toHaveProperty('reason', '測試兼容性');
      expect(result).toHaveProperty('used_rule', 'P3');
      expect(result).toHaveProperty('confidence', 0.95);
      expect(result).toHaveProperty('entities');
      
      // entities應該被標準化
      expect(result.entities).toHaveProperty('confirmation', true);
    });

    test('非Debug模式下不應該暴露標準化詳細信息', () => {
      const mockAI = {
        intent: 'set_reminder',
        entities: { '提醒時間': '10分鐘前' },
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.8 }
      };

      const mockRegex = {
        intent: 'set_reminder',
        entities: {},
        match_details: { pattern_strength: 0.2 }
      };

      const result = controller.buildResult(
        'ai',
        'set_reminder',
        'P3',
        '非Debug測試',
        mockAI,
        mockRegex,
        ['非Debug'],
        false, // 非Debug模式
        0.8
      );

      // 非Debug模式下不應該有debug_info
      expect(result.debug_info).toBeUndefined();
    });
  });

  describe('邊界情況處理', () => {
    test('空entities不應該進行標準化處理', () => {
      const mockAI = {
        intent: 'unknown',
        entities: {}, // 空對象
        confidence: { overall: 0.5 }
      };

      const mockRegex = {
        intent: 'unknown',
        entities: {},
        match_details: { pattern_strength: 0.1 }
      };

      const result = controller.buildResult(
        'fallback',
        'unknown',
        'FALLBACK',
        'Fallback測試',
        mockAI,
        mockRegex,
        ['Fallback'],
        true, // Debug模式
        0.1,
        '請提供更多信息'
      );

      expect(result).toHaveProperty('final_intent', 'unknown');
      expect(result).toHaveProperty('suggestion', '請提供更多信息');
      expect(result.entities).toBeUndefined(); // 空對象不應該處理
    });

    test('null entities不應該崩潰', () => {
      const mockAI = {
        intent: 'record_homework',
        entities: null, // null值
        confidence: { overall: 0.7 }
      };

      const mockRegex = {
        intent: 'record_homework',
        entities: null,
        match_details: { pattern_strength: 0.6 }
      };

      const result = controller.buildResult(
        'ai',
        'record_homework',
        'P3',
        'Null測試',
        mockAI,
        mockRegex,
        ['Null測試'],
        false,
        0.7
      );

      expect(result).toHaveProperty('final_intent', 'record_homework');
      expect(result.entities).toBeUndefined();
    });

    test('缺少entities字段不應該崩潰', () => {
      const mockAI = {
        intent: 'upload_class_photo',
        // 沒有entities字段
        confidence: { overall: 0.85 }
      };

      const mockRegex = {
        intent: 'upload_class_photo',
        // 沒有entities字段
        match_details: { pattern_strength: 0.4 }
      };

      const result = controller.buildResult(
        'ai',
        'upload_class_photo',
        'P3',
        '缺少entities測試',
        mockAI,
        mockRegex,
        ['缺少entities'],
        false,
        0.85
      );

      expect(result).toHaveProperty('final_intent', 'upload_class_photo');
      expect(result.entities).toBeUndefined();
    });
  });

  describe('性能和穩定性', () => {
    test('標準化處理應該很快完成', () => {
      const mockAI = {
        intent: 'modify_recurring_course',
        entities: {
          '課程名稱': '游泳',
          '學生姓名': '小李',
          '老師': '張教練',
          '地點': '游泳池',
          '時間': '每週三下午',
          'confirmation': '是',
          'performance': '很好'
        },
        confidence: { overall: 0.88 }
      };

      const mockRegex = {
        intent: 'modify_recurring_course',
        entities: {},
        match_details: { pattern_strength: 0.2 }
      };

      const startTime = Date.now();
      
      const result = controller.buildResult(
        'ai',
        'modify_recurring_course',
        'P3',
        '性能測試',
        mockAI,
        mockRegex,
        ['性能測試'],
        true, // Debug模式
        0.88
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 標準化處理應該在50ms內完成
      expect(processingTime).toBeLessThan(50);
      
      // 結果應該正確
      expect(result).toHaveProperty('final_intent', 'modify_recurring_course');
      expect(result.entities).toHaveProperty('course_name', '游泳');
      expect(result.entities).toHaveProperty('student_name', '小李');
      expect(result.entities).toHaveProperty('teacher', '張教練');
      expect(result.entities).toHaveProperty('location', '游泳池');
      expect(result.entities).toHaveProperty('time', '每週三下午');
      expect(result.entities).toHaveProperty('confirmation', true);
      expect(result.entities).toHaveProperty('performance', 'excellent');
    });
  });
});