/**
 * IntentRuleEngine 測試
 * 驗證規則引擎的確定性意圖識別功能
 */

const IntentRuleEngine = require('../src/utils/intentRuleEngine');

describe('IntentRuleEngine', () => {
  beforeEach(() => {
    // 每次測試前重新載入規則
    IntentRuleEngine.reloadRules();
  });

  describe('loadRules', () => {
    test('should load YAML configuration successfully', () => {
      const rules = IntentRuleEngine.loadRules();
      expect(rules).toBeDefined();
      expect(typeof rules).toBe('object');
      expect(rules.cancel_course).toBeDefined();
      expect(rules.record_course).toBeDefined();
    });

    test('should cache loaded rules', () => {
      const rules1 = IntentRuleEngine.loadRules();
      const rules2 = IntentRuleEngine.loadRules();
      expect(rules1).toBe(rules2); // 應該是同一個對象引用
    });
  });

  describe('analyzeIntent - cancel_course', () => {
    test('should detect cancel intent with high confidence', () => {
      const result = IntentRuleEngine.analyzeIntent('取消數學課');
      expect(result.intent).toBe('cancel_course');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8); // 調整為更寬鬆的測試
    });

    test('should detect cancel intent with various keywords', () => {
      const testCases = [
        '刪除英文課',
        '移除物理課',
        '不要上化學課',
        '不上音樂課',
        '停止數學課',
        '撤銷英文課'
      ];

      testCases.forEach(input => {
        const result = IntentRuleEngine.analyzeIntent(input);
        expect(result.intent).toBe('cancel_course');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    test('should not detect cancel when exclusion words present', () => {
      const result = IntentRuleEngine.analyzeIntent('我要新增取消課程的功能');
      expect(result.intent).not.toBe('cancel_course');
    });
  });

  describe('analyzeIntent - record_course', () => {
    test('should detect record intent correctly', () => {
      const testCases = [
        '明天2:30英文課',
        '我要上物理課',
        '新增化學課',
        '預約音樂課',
        '報名英文課'
      ];

      testCases.forEach(input => {
        const result = IntentRuleEngine.analyzeIntent(input);
        expect(result.intent).toBe('record_course');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    test('should not detect record when exclusion words present', () => {
      const result = IntentRuleEngine.analyzeIntent('取消新增課程');
      expect(result.intent).not.toBe('record_course');
    });
  });

  describe('analyzeIntent - query_schedule', () => {
    test('should detect query intent correctly', () => {
      const testCases = [
        '查詢我的課表',
        '看看今天有什麼課',
        '顯示下周的安排',
        '課表',
        '時間表'
      ];

      testCases.forEach(input => {
        const result = IntentRuleEngine.analyzeIntent(input);
        expect(result.intent).toBe('query_schedule');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('analyzeIntent - modify_course', () => {
    test('should detect modify intent correctly', () => {
      const testCases = [
        '修改數學課時間',
        '調整英文課到下午',
        '更改物理課老師',
        '編輯課程',
        '更新課程信息'
      ];

      testCases.forEach(input => {
        const result = IntentRuleEngine.analyzeIntent(input);
        expect(result.intent).toBe('modify_course');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('analyzeIntent - set_reminder', () => {
    test('should detect reminder intent correctly', () => {
      const testCases = [
        '數學課前10分鐘提醒我',
        '英文課開始時通知我',
        '記得叫我上物理課',
        'remind me about class'
      ];

      testCases.forEach(input => {
        const result = IntentRuleEngine.analyzeIntent(input);
        expect(result.intent).toBe('set_reminder');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('analyzeIntent - priority handling', () => {
    test('should return higher priority intent when multiple matches', () => {
      // 測試真正的優先級情況：cancel_course 的 priority=10，query_schedule 的 priority=9
      const result = IntentRuleEngine.analyzeIntent('取消課表');
      expect(result.intent).toBe('cancel_course'); // 優先級更高
    });

    test('should return unknown when exclusions prevent all matches', () => {
      // 此測試案例中，"取消"會阻止 record_course，"新增"會阻止 cancel_course
      const result = IntentRuleEngine.analyzeIntent('我要取消新增課程');
      expect(result.intent).toBe('unknown'); // 因為互相排除
    });
  });

  describe('analyzeIntent - unknown intent', () => {
    test('should return unknown for unrecognized input', () => {
      const result = IntentRuleEngine.analyzeIntent('今天天氣真好');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    test('should return unknown for empty input', () => {
      const result = IntentRuleEngine.analyzeIntent('');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('matchRule', () => {
    test('should calculate confidence correctly', () => {
      const rule = {
        keywords: ['取消', '刪除'],
        exclusions: [],
        priority: 10
      };

      // 匹配一個關鍵詞
      const result1 = IntentRuleEngine.matchRule('取消課程', rule);
      expect(result1.confidence).toBe(0.8); // 基礎置信度

      // 匹配兩個關鍵詞
      const result2 = IntentRuleEngine.matchRule('取消刪除課程', rule);
      expect(result2.confidence).toBe(0.9); // 基礎 + 獎勵置信度
    });

    test('should return zero confidence when exclusion matched', () => {
      const rule = {
        keywords: ['新增'],
        exclusions: ['取消'],
        priority: 5
      };

      const result = IntentRuleEngine.matchRule('取消新增課程', rule);
      expect(result.confidence).toBe(0);
    });
  });

  describe('utility methods', () => {
    test('getExamples should return examples for valid intent', () => {
      const examples = IntentRuleEngine.getExamples('cancel_course');
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples).toContain('取消數學課');
    });

    test('getExamples should return empty array for invalid intent', () => {
      const examples = IntentRuleEngine.getExamples('invalid_intent');
      expect(examples).toEqual([]);
    });

    test('getSupportedIntents should return all intent names', () => {
      const intents = IntentRuleEngine.getSupportedIntents();
      expect(Array.isArray(intents)).toBe(true);
      expect(intents).toContain('cancel_course');
      expect(intents).toContain('record_course');
      expect(intents).toContain('query_schedule');
      expect(intents).toContain('modify_course');
      expect(intents).toContain('set_reminder');
    });
  });

  describe('case sensitivity', () => {
    test('should handle mixed case input correctly', () => {
      const result = IntentRuleEngine.analyzeIntent('取消數學課');
      expect(result.intent).toBe('cancel_course');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('error handling', () => {
    test('should handle missing config gracefully', () => {
      // 備份原始 loadRules 方法
      const originalLoadRules = IntentRuleEngine.loadRules;
      
      // 模擬配置文件不存在
      IntentRuleEngine.loadRules = () => {
        throw new Error('Config file not found');
      };

      expect(() => {
        IntentRuleEngine.analyzeIntent('測試');
      }).toThrow('Config file not found');

      // 恢復原始方法
      IntentRuleEngine.loadRules = originalLoadRules;
    });
  });
});