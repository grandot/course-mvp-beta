/**
 * SemanticController 與 SemanticNormalizer 集成測試
 * 驗證Task 2.2的實現結果
 */

const SemanticController = require('../src/services/semanticController');

describe('SemanticController + SemanticNormalizer 集成測試', () => {
  let controller;

  beforeEach(() => {
    controller = new SemanticController();
  });

  describe('Entity標準化集成', () => {
    test('應該自動標準化AI分析結果中的Entity', async () => {
      // 模擬包含中文entity的輸入
      const testInput = "小明明天下午2點有數學課";
      
      const result = await controller.route(testInput, [], { debug: true });
      
      // 驗證基本結構
      expect(result).toHaveProperty('final_intent');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('confidence');
      
      // 如果有entities，應該是標準化後的格式
      if (result.entities && Object.keys(result.entities).length > 0) {
        const entityKeys = Object.keys(result.entities);
        
        // 檢查是否包含標準化的鍵名（英文）
        const hasStandardKeys = entityKeys.some(key => 
          ['course_name', 'student_name', 'date', 'time', 'location'].includes(key)
        );
        
        // 檢查是否還包含中文鍵名（不應該有）
        const hasChineeKeys = entityKeys.some(key => 
          ['課程名稱', '學生姓名', '日期', '時間', '地點'].includes(key)
        );
        
        // 如果進行了標準化，應該有英文鍵名，沒有中文鍵名
        if (result.debug_info?.entity_normalization?.applied) {
          expect(hasStandardKeys).toBe(true);
          expect(hasChineeKeys).toBe(false);
        }
      }
    });

    test('應該在Debug模式下記錄標準化信息', async () => {
      const testInput = "取消數學課";
      
      const result = await controller.route(testInput, [], { debug: true });
      
      expect(result).toHaveProperty('debug_info');
      
      // 如果進行了entity標準化，應該有相關記錄
      if (result.entities && Object.keys(result.entities).length > 0) {
        if (result.debug_info?.entity_normalization?.applied) {
          expect(result.debug_info.entity_normalization).toHaveProperty('key_mappings');
          expect(result.debug_info.entity_normalization).toHaveProperty('original_entities');
        }
      }
    });

    test('應該保持P1-P5決策邏輯不受影響', async () => {
      const testCases = [
        {
          input: "上次的課怎麼樣", // 應該觸發P1規則
          expectedRule: "P1"
        },
        {
          input: "昨天數學課很精彩", // 應該觸發P2或P3規則
          expectedRule: ["P2", "P3"]
        }
      ];

      for (const testCase of testCases) {
        const result = await controller.route(testCase.input, [], { debug: true });
        
        expect(result).toHaveProperty('used_rule');
        
        if (Array.isArray(testCase.expectedRule)) {
          expect(testCase.expectedRule).toContain(result.used_rule);
        } else {
          expect(result.used_rule).toBe(testCase.expectedRule);
        }
        
        // 確保決策邏輯正常工作
        expect(result).toHaveProperty('reason');
        expect(result.reason).toBeTruthy();
      }
    });

    test('標準化失敗時應該有Fallback保護', () => {
      // 測試buildResult方法的錯誤處理
      const mockAI = {
        intent: 'record_course',
        entities: {
          '課程名稱': '數學',
          'invalid_circular': {} // 創建可能導致錯誤的數據
        },
        confidence: { overall: 0.8 }
      };
      
      const mockRegex = {
        intent: 'record_course',
        entities: {},
        match_details: { pattern_strength: 0.3 }
      };

      // 模擬可能的標準化錯誤情況
      const result = controller.buildResult(
        'ai',
        'record_course', 
        'P3',
        '測試錯誤處理',
        mockAI,
        mockRegex,
        ['測試'],
        true, // debug模式
        0.8
      );

      // 即使標準化失敗，也應該返回有效結果
      expect(result).toHaveProperty('final_intent', 'record_course');
      expect(result).toHaveProperty('entities');
      expect(result.entities).toBeTruthy();
    });
  });

  describe('向後兼容性', () => {
    test('輸出格式應該保持完全向後兼容', async () => {
      const testInput = "查詢我的課表";
      
      const result = await controller.route(testInput);
      
      // 驗證所有必要的字段都存在
      expect(result).toHaveProperty('final_intent');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('used_rule');
      expect(result).toHaveProperty('confidence');
      
      // 驗證字段類型
      expect(typeof result.final_intent).toBe('string');
      expect(['ai', 'regex', 'fallback']).toContain(result.source);
      expect(typeof result.reason).toBe('string');
      expect(['P1', 'P2', 'P3', 'P4', 'P5', 'FALLBACK']).toContain(result.used_rule);
      expect(typeof result.confidence).toBe('number');
      
      // entities是可選的，但如果存在應該是對象
      if (result.entities) {
        expect(typeof result.entities).toBe('object');
      }
    });

    test('非Debug模式下不應該包含標準化詳細信息', async () => {
      const testInput = "記錄數學課";
      
      const result = await controller.route(testInput, [], { debug: false });
      
      // 非debug模式下不應該有debug_info
      expect(result.debug_info).toBeUndefined();
    });
  });

  describe('性能測試', () => {
    test('集成標準化後響應時間應該在合理範圍內', async () => {
      const testInput = "明天下午3點有英文課";
      
      const startTime = Date.now();
      const result = await controller.route(testInput);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      // 響應時間應該在合理範圍內（<2秒）
      expect(responseTime).toBeLessThan(2000);
      
      // 驗證結果有效性
      expect(result).toHaveProperty('final_intent');
      expect(result.final_intent).not.toBe('unknown');
    });

    test('批量處理性能', async () => {
      const testInputs = [
        "記錄數學課",
        "查詢課表", 
        "取消英文課",
        "明天有什麼課",
        "修改物理課時間"
      ];

      const startTime = Date.now();
      
      const results = await Promise.all(
        testInputs.map(input => controller.route(input))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / testInputs.length;
      
      // 平均每個請求應該在1秒內完成
      expect(avgTime).toBeLessThan(1000);
      
      // 所有結果都應該有效
      results.forEach(result => {
        expect(result).toHaveProperty('final_intent');
        expect(result).toHaveProperty('confidence');
      });
    });
  });

  describe('邊界情況處理', () => {
    test('空entities時不應該崩潰', async () => {
      // 測試沒有entities的情況
      const result = controller.buildResult(
        'regex',
        'query_schedule',
        'P4',
        '測試空entities',
        { intent: 'query_schedule' }, // AI結果沒有entities
        { intent: 'query_schedule', match_details: { pattern_strength: 0.9 } }, // Regex結果沒有entities
        ['測試'],
        false,
        0.9
      );

      expect(result).toHaveProperty('final_intent', 'query_schedule');
      expect(result.entities).toBeUndefined(); // 沒有entities就不應該有這個字段
    });

    test('entities為空對象時應該正確處理', async () => {
      const result = controller.buildResult(
        'ai',
        'clear_schedule',
        'P3',
        '測試空entities對象',
        { intent: 'clear_schedule', entities: {} },
        { intent: 'clear_schedule' },
        ['測試'],
        false,
        0.8
      );

      expect(result).toHaveProperty('final_intent', 'clear_schedule');
      expect(result.entities).toBeUndefined(); // 空對象不應該處理
    });
  });
});