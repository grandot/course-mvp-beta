/**
 * Phase 2 集成驗證測試
 * 驗證 SemanticController + SemanticNormalizer 集成後的完整功能
 */

const SemanticController = require('../src/services/semanticController');

describe('Phase 2 集成驗證測試', () => {
  
  describe('關鍵場景端到端測試', () => {
    test('场景1: 中文Entity標準化流程', () => {
      // 直接測試buildResult方法的標準化邏輯
      const controller = new SemanticController();
      
      const mockAI = {
        intent: 'record_course',
        entities: {
          '課程名稱': '數學',
          '學生姓名': '小明',
          '老師': '王老師',
          'confirmation': '是',
          'performance': '很好'
        },
        evidence: {
          temporal_clues: [],
          mood_indicators: [],
          action_verbs: ['記錄'],
          question_markers: []
        },
        reasoning_chain: {
          step1: '識別記錄意圖',
          step2: '提取課程信息',
          step3: '確認學生身份',
          confidence_source: '高信心度分析'
        },
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
        'AI推理鏈完整且信心度高',
        mockAI,
        mockRegex,
        ['P3規則命中'],
        true, // debug模式
        0.9
      );

      // 驗證基本結構
      expect(result).toHaveProperty('final_intent', 'record_course');
      expect(result).toHaveProperty('source', 'ai');
      expect(result).toHaveProperty('used_rule', 'P3');
      expect(result).toHaveProperty('entities');

      // 驗證Entity標準化
      expect(result.entities).toHaveProperty('course_name', '數學');
      expect(result.entities).toHaveProperty('student_name', '小明');
      expect(result.entities).toHaveProperty('teacher', '王老師');
      expect(result.entities).toHaveProperty('confirmation', true); // 值標準化
      expect(result.entities).toHaveProperty('performance', 'excellent'); // 值標準化

      // 驗證中文鍵名已移除
      expect(result.entities).not.toHaveProperty('課程名稱');
      expect(result.entities).not.toHaveProperty('學生姓名');
      expect(result.entities).not.toHaveProperty('老師');

      // 驗證debug信息
      expect(result.debug_info).toHaveProperty('entity_normalization');
      expect(result.debug_info.entity_normalization.applied).toBe(true);
      expect(result.debug_info.entity_normalization.key_mappings).toHaveProperty('課程名稱', 'course_name');
    });

    test('场景2: P1-P5決策邏輯完整性', () => {
      const controller = new SemanticController();
      
      // 測試P1規則不受標準化影響
      const mockAI_P1 = {
        intent: 'query_course_content',
        entities: { '課程名稱': '英文' },
        evidence: {
          temporal_clues: ['上次'],
          mood_indicators: ['怎麼樣'],
          action_verbs: [],
          question_markers: ['嗎']
        },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.8 }
      };

      const mockRegex_P1 = {
        intent: 'record_course', // 故意設置不同intent
        entities: {},
        match_details: { pattern_strength: 0.7 }
      };

      const result = controller.buildResult(
        'ai', // 根據P1規則，應該選擇AI
        'query_course_content',
        'P1',
        '疑問語氣與新增意圖衝突，AI勝出',
        mockAI_P1,
        mockRegex_P1,
        ['P1規則命中'],
        false,
        0.8
      );

      expect(result.final_intent).toBe('query_course_content');
      expect(result.used_rule).toBe('P1');
      expect(result.entities).toHaveProperty('course_name', '英文');
    });

    test('场景3: 錯誤處理和Fallback機制', () => {
      const controller = new SemanticController();
      
      // 測試異常entity不會導致崩潰
      const problematicEntity = {};
      problematicEntity.circular = problematicEntity; // 循環引用

      const mockAI = {
        intent: 'cancel_course',
        entities: {
          '課程名稱': '物理',
          'problematic': problematicEntity
        },
        confidence: { overall: 0.7 }
      };

      const mockRegex = {
        intent: 'cancel_course',
        entities: {},
        match_details: { pattern_strength: 0.2 }
      };

      const result = controller.buildResult(
        'ai',
        'cancel_course',
        'P3',
        '錯誤處理測試',
        mockAI,
        mockRegex,
        ['錯誤處理'],
        true,
        0.7
      );

      // 應該能正常返回結果，不崩潰
      expect(result).toHaveProperty('final_intent', 'cancel_course');
      expect(result).toHaveProperty('entities');
      expect(result.entities).toBeTruthy();
    });

    test('场景4: 多種數據類型Entity處理', () => {
      const controller = new SemanticController();
      
      const mockAI = {
        intent: 'modify_course',
        entities: {
          '課程名稱': '科學實驗',
          'timeInfo': {
            '日期': '2025-08-02',
            '時間': '14:30'
          },
          'photos': ['photo1.jpg', 'photo2.jpg'],
          'confirmation': '確認',
          'performance': '進步'
        },
        confidence: { overall: 0.85 }
      };

      const mockRegex = {
        intent: 'modify_course',
        entities: {},
        match_details: { pattern_strength: 0.1 }
      };

      const result = controller.buildResult(
        'ai',
        'modify_course',
        'P3',
        '複雜數據類型測試',
        mockAI,
        mockRegex,
        ['複雜數據測試'],
        false,
        0.85
      );

      expect(result).toHaveProperty('final_intent', 'modify_course');
      expect(result.entities).toHaveProperty('course_name', '科學實驗');
      
      // 驗證嵌套對象標準化
      expect(result.entities.timeInfo).toHaveProperty('date', '2025-08-02');
      expect(result.entities.timeInfo).toHaveProperty('time', '14:30');
      
      // 驗證數組保持不變
      expect(result.entities.photos).toEqual(['photo1.jpg', 'photo2.jpg']);
      
      // 驗證值標準化
      expect(result.entities.confirmation).toBe(true);
      expect(result.entities.performance).toBe('good');
    });
  });

  describe('向後兼容性驗證', () => {
    test('輸出格式100%向後兼容', () => {
      const controller = new SemanticController();
      
      const mockAI = {
        intent: 'query_schedule',
        entities: { '學生姓名': '小華' },
        evidence: { temporal_clues: [], mood_indicators: [], action_verbs: [], question_markers: [] },
        reasoning_chain: { step1: 'test', confidence_source: 'test' },
        confidence: { overall: 0.8 }
      };

      const mockRegex = {
        intent: 'query_schedule',
        entities: {},
        match_details: { pattern_strength: 0.6 }
      };

      const result = controller.buildResult(
        'ai',
        'query_schedule',
        'P3',
        '兼容性測試',
        mockAI,
        mockRegex,
        ['兼容性'],
        false,
        0.8
      );

      // 驗證所有必須字段存在
      const requiredFields = ['final_intent', 'source', 'reason', 'used_rule', 'confidence'];
      requiredFields.forEach(field => {
        expect(result).toHaveProperty(field);
      });

      // 驗證字段類型
      expect(typeof result.final_intent).toBe('string');
      expect(['ai', 'regex', 'fallback']).toContain(result.source);
      expect(typeof result.reason).toBe('string');
      expect(['P1', 'P2', 'P3', 'P4', 'P5', 'FALLBACK']).toContain(result.used_rule);
      expect(typeof result.confidence).toBe('number');

      // entities是可選的，但如果存在應該是標準化的
      if (result.entities) {
        expect(typeof result.entities).toBe('object');
        expect(result.entities).toHaveProperty('student_name', '小華');
      }
    });

    test('非Debug模式不洩露內部信息', () => {
      const controller = new SemanticController();
      
      const mockAI = {
        intent: 'set_reminder',
        entities: { '提醒時間': '10分鐘前' },
        confidence: { overall: 0.75 }
      };

      const mockRegex = {
        intent: 'set_reminder',
        entities: {},
        match_details: { pattern_strength: 0.3 }
      };

      const result = controller.buildResult(
        'ai',
        'set_reminder',
        'P3',
        '隱私測試',
        mockAI,
        mockRegex,
        ['隱私'],
        false, // 非debug模式
        0.75
      );

      // 不應該暴露內部調試信息
      expect(result.debug_info).toBeUndefined();
      
      // 但entities應該正常標準化
      expect(result.entities).toBeTruthy();
    });
  });

  describe('性能驗證', () => {
    test('標準化不應顯著影響性能', () => {
      const controller = new SemanticController();
      
      const largeEntities = {};
      for (let i = 0; i < 20; i++) {
        largeEntities[`測試欄位${i}`] = `測試值${i}`;
      }
      
      const mockAI = {
        intent: 'record_lesson_content',
        entities: largeEntities,
        confidence: { overall: 0.8 }
      };

      const mockRegex = {
        intent: 'record_lesson_content',
        entities: {},
        match_details: { pattern_strength: 0.2 }
      };

      const startTime = Date.now();
      
      const result = controller.buildResult(
        'ai',
        'record_lesson_content',
        'P3',
        '性能測試',
        mockAI,
        mockRegex,
        ['性能測試'],
        true, // debug模式有更多處理
        0.8
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 即使有20個字段需要標準化，也應該在合理時間內完成
      expect(processingTime).toBeLessThan(100);
      
      expect(result).toHaveProperty('final_intent', 'record_lesson_content');
      expect(result).toHaveProperty('entities');
      expect(Object.keys(result.entities).length).toBeGreaterThan(0);
    });
  });

  describe('映射數據完整性驗證', () => {
    test('映射數據成功載入', () => {
      const { getInstance } = require('../src/services/semanticNormalizer');
      const normalizer = getInstance();
      
      const stats = normalizer.getMappingStats();
      
      expect(stats.intent_mappings).toBeGreaterThan(50);
      expect(stats.entity_key_mappings).toBeGreaterThan(30);
      expect(stats.standard_intents).toBeGreaterThan(15);
      
      // 驗證核心Intent映射存在
      const coreIntents = ['清空課表', '記錄課程', '修改課程', '查詢課表'];
      coreIntents.forEach(intent => {
        const result = normalizer.normalizeIntent(intent);
        expect(result.mapped_intent).not.toBe('unknown');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });
  });
});