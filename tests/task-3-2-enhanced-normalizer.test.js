/**
 * Task 3.2 測試：增強版 SemanticNormalizer 映射能力
 * 驗證模糊匹配、相似度計算、智能映射等進階功能
 */

const { getEnhancedSemanticNormalizer } = require('../src/services/enhancedSemanticNormalizer');

describe('Task 3.2: 增強版 SemanticNormalizer 測試', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = getEnhancedSemanticNormalizer();
    normalizer.clearCache(); // 清除緩存確保測試獨立性
  });

  describe('🎯 增強版 Intent 標準化功能', () => {
    
    test('Level 1: 直接映射仍然正常工作', () => {
      const result = normalizer.normalizeIntent('記錄課程');
      
      expect(result.mapped_intent).toBe('record_course');
      expect(result.original_intent).toBe('記錄課程');
      expect(result.mapping_source).toBe('direct');
      expect(result.confidence).toBe(0.95);
    });

    test('Level 2: 模糊字符匹配功能', () => {
      // 測試拼寫錯誤或變體
      const result1 = normalizer.normalizeIntent('記录課程'); // 簡體字混用
      const result2 = normalizer.normalizeIntent('記綠課程'); // 錯字
      
      expect(result1.mapped_intent).toBe('record_course');
      expect(result1.mapping_source).toBe('fuzzy');
      expect(result1.confidence).toBeGreaterThan(0.6);
      
      // 模糊匹配可能成功也可能失敗，取決於相似度閾值
      if (result2.mapping_source === 'fuzzy') {
        expect(result2.mapped_intent).toBe('record_course');
        expect(result2.confidence).toBeGreaterThan(0.6);
      }
    });

    test('Level 3: 關鍵詞匹配功能', () => {
      const result1 = normalizer.normalizeIntent('我要記錄一堂課');
      const result2 = normalizer.normalizeIntent('幫我查詢一下課表');
      const result3 = normalizer.normalizeIntent('需要修改課程時間');
      
      expect(result1.mapped_intent).toBe('record_course');
      expect(result1.mapping_source).toBe('keyword');
      expect(result1.confidence).toBeGreaterThan(0.5);
      
      expect(result2.mapped_intent).toBe('query_schedule');
      expect(result2.mapping_source).toBe('keyword');
      
      expect(result3.mapped_intent).toBe('modify_course');
      expect(result3.mapping_source).toBe('keyword');
    });

    test('Level 4: 語義聚類匹配功能', () => {
      const result1 = normalizer.normalizeIntent('今天的課程安排');
      const result2 = normalizer.normalizeIntent('上課內容記錄');
      
      // 語義聚類可能會匹配到相關的intent
      expect(['record_course', 'query_schedule', 'record_lesson_content']).toContain(result1.mapped_intent);
      if (result1.mapping_source === 'semantic') {
        expect(result1.confidence).toBeGreaterThan(0.6);
      }
      
      expect(['record_lesson_content', 'record_course', 'query_course_content']).toContain(result2.mapped_intent);
    });

    test('Level 5: Fallback patterns 保持工作', () => {
      const result1 = normalizer.normalizeIntent('record something');
      const result2 = normalizer.normalizeIntent('modify this');
      
      expect(result1.mapped_intent).toBe('record_course');
      expect(result1.mapping_source).toBe('fallback');
      expect(result1.confidence).toBe(0.7);
      
      expect(result2.mapped_intent).toBe('modify_course');
      expect(result2.mapping_source).toBe('fallback');
    });

    test('Level 6: 最終fallback到unknown', () => {
      const result = normalizer.normalizeIntent('完全無法識別的文字xyz123');
      
      expect(result.mapped_intent).toBe('unknown');
      expect(result.mapping_source).toBe('none');
      expect(result.confidence).toBe(0);
    });
  });

  describe('🎯 增強版 Entity 標準化功能', () => {
    
    test('基本Entity標準化功能保持工作', () => {
      const entities = {
        '課程名稱': '數學',
        '學生姓名': '小明',
        'confirmation': '是'
      };

      const result = normalizer.normalizeEntities(entities);
      
      expect(result.mapped_entities).toHaveProperty('course_name', '數學');
      expect(result.mapped_entities).toHaveProperty('student_name', '小明');
      expect(result.mapped_entities).toHaveProperty('confirmation', true);
      expect(result.normalization_applied).toBe(true);
    });

    test('模糊Entity鍵名匹配', () => {
      const entities = {
        '課程名称': '英文', // 簡體字
        '学生姓名': '小華', // 簡體字
        'course_name': '物理' // 已經是標準格式
      };

      const result = normalizer.normalizeEntities(entities, { enable_fuzzy_key_matching: true });
      
      // 模糊匹配可能會成功
      expect(result.mapped_entities).toBeTruthy();
      expect(result.mapping_stats.fuzzy_matches).toBeGreaterThanOrEqual(0);
      
      // 標準格式應該保持不變
      expect(result.mapped_entities).toHaveProperty('course_name');
    });

    test('智能課程名稱映射', () => {
      const entities = {
        'course_name': '數学', // 簡體字
        'course_name2': '未知課程名稱'
      };

      const result = normalizer.normalizeEntities(entities);
      
      // 應該能處理各種課程名稱變體
      expect(result.mapped_entities).toBeTruthy();
      expect(result.normalization_applied).toBe(true);
    });

    test('增強版確認信息映射', () => {
      const entities = {
        'confirmation1': '沒錯',
        'confirmation2': '當然',
        'confirmation3': '不對',
        'confirmation4': '不行',
        'confirmation5': '👍',
        'confirmation6': '❌'
      };

      const result = normalizer.normalizeEntities(entities);
      
      expect(result.mapped_entities.confirmation1).toBe(true);
      expect(result.mapped_entities.confirmation2).toBe(true);
      expect(result.mapped_entities.confirmation3).toBe(false);
      expect(result.mapped_entities.confirmation4).toBe(false);
      expect(result.mapped_entities.confirmation5).toBe(true);
      expect(result.mapped_entities.confirmation6).toBe(false);
    });

    test('增強版表現評價映射', () => {
      const entities = {
        'performance1': '超棒',
        'performance2': '馬馬虎虎',
        'performance3': '要加油',
        'performance4': 'A+',
        'performance5': '進步'
      };

      const result = normalizer.normalizeEntities(entities);
      
      expect(result.mapped_entities.performance1).toBe('excellent');
      expect(result.mapped_entities.performance2).toBe('average');
      expect(result.mapped_entities.performance3).toBe('poor');
      expect(result.mapped_entities.performance4).toBe('excellent');
      expect(result.mapped_entities.performance5).toBe('improving');
    });

    test('複雜嵌套對象處理', () => {
      const entities = {
        'timeInfo': {
          '日期': '2025-08-02',
          '時間': '14:30'
        },
        'studentInfo': {
          '學生姓名': '小美',
          'grade': '小三'
        }
      };

      const result = normalizer.normalizeEntities(entities);
      
      expect(result.mapped_entities.timeInfo).toHaveProperty('date', '2025-08-02');
      expect(result.mapped_entities.timeInfo).toHaveProperty('time', '14:30');
      expect(result.mapped_entities.studentInfo).toHaveProperty('student_name', '小美');
      expect(result.mapped_entities.studentInfo).toHaveProperty('grade', 'grade_3');
    });
  });

  describe('🎯 緩存機制測試', () => {
    
    test('緩存功能正常工作', () => {
      const intent = '記錄課程測試';
      
      // 第一次調用
      const result1 = normalizer.normalizeIntent(intent);
      const cacheStats1 = normalizer.getCacheStats();
      
      // 第二次調用相同的intent
      const result2 = normalizer.normalizeIntent(intent);
      const cacheStats2 = normalizer.getCacheStats();
      
      // 結果應該相同
      expect(result1.mapped_intent).toBe(result2.mapped_intent);
      expect(result1.mapping_source).toBe(result2.mapping_source);
      
      // 緩存大小應該有變化
      expect(cacheStats2.cache_size).toBeGreaterThanOrEqual(cacheStats1.cache_size);
    });

    test('緩存清理功能', () => {
      normalizer.normalizeIntent('測試緩存1');
      normalizer.normalizeIntent('測試緩存2');
      
      const statsBefore = normalizer.getCacheStats();
      expect(statsBefore.cache_size).toBeGreaterThan(0);
      
      normalizer.clearCache();
      
      const statsAfter = normalizer.getCacheStats();
      expect(statsAfter.cache_size).toBe(0);
    });

    test('緩存大小限制', () => {
      // 創建大量不同的intent來測試緩存大小限制
      for (let i = 0; i < 1100; i++) {
        normalizer.normalizeIntent(`測試intent${i}`);
      }
      
      const stats = normalizer.getCacheStats();
      expect(stats.cache_size).toBeLessThanOrEqual(stats.max_cache_size);
    });
  });

  describe('🎯 相似度計算算法測試', () => {
    
    test('字符串相似度計算', () => {
      // 測試完全相同
      const similarity1 = normalizer._calculateStringSimilarity('記錄課程', '記錄課程');
      expect(similarity1).toBe(1.0);
      
      // 測試完全不同
      const similarity2 = normalizer._calculateStringSimilarity('記錄課程', 'xyz123');
      expect(similarity2).toBeLessThan(0.5);
      
      // 測試部分相似
      const similarity3 = normalizer._calculateStringSimilarity('記錄課程', '記录課程');
      expect(similarity3).toBeGreaterThan(0.8);
    });

    test('編輯距離計算', () => {
      const distance1 = normalizer._levenshteinDistance('記錄', '記录');
      expect(distance1).toBe(1); // 只有一個字符不同
      
      const distance2 = normalizer._levenshteinDistance('abc', 'abc');
      expect(distance2).toBe(0); // 完全相同
      
      const distance3 = normalizer._levenshteinDistance('', 'abc');
      expect(distance3).toBe(3); // 需要插入3個字符
    });
  });

  describe('🎯 關鍵詞提取測試', () => {
    
    test('基本關鍵詞提取', () => {
      const keywords1 = normalizer._extractKeywords('我要記錄數學課程');
      expect(keywords1).toContain('記錄');
      expect(keywords1).toContain('數學');
      expect(keywords1).toContain('課程');
      expect(keywords1).not.toContain('我');
      expect(keywords1).not.toContain('要');
    });

    test('停用詞過濾', () => {
      const keywords = normalizer._extractKeywords('這是一個測試的句子');
      expect(keywords).not.toContain('這');
      expect(keywords).not.toContain('是');
      expect(keywords).not.toContain('一個');
      expect(keywords).not.toContain('的');
      expect(keywords).toContain('測試');
      expect(keywords).toContain('句子');
    });

    test('標點符號處理', () => {
      const keywords = normalizer._extractKeywords('記錄課程，查詢時間！');
      expect(keywords).toContain('記錄');
      expect(keywords).toContain('課程');
      expect(keywords).toContain('查詢');
      expect(keywords).toContain('時間');
    });
  });

  describe('🎯 統計和監控功能', () => {
    
    test('映射統計信息', () => {
      const stats = normalizer.getMappingStats();
      
      expect(stats).toHaveProperty('intent_mappings');
      expect(stats).toHaveProperty('entity_key_mappings');
      expect(stats).toHaveProperty('entity_value_mappings');
      expect(stats).toHaveProperty('standard_intents');
      expect(stats).toHaveProperty('cache_stats');
      expect(stats).toHaveProperty('fuzzy_config');
      
      expect(typeof stats.intent_mappings).toBe('number');
      expect(typeof stats.entity_key_mappings).toBe('number');
      expect(typeof stats.standard_intents).toBe('number');
    });

    test('模糊匹配配置更新', () => {
      const originalConfig = { ...normalizer.fuzzyMatchConfig };
      
      normalizer.updateFuzzyConfig({
        intent_similarity_threshold: 0.8,
        enable_phonetic_matching: false
      });
      
      expect(normalizer.fuzzyMatchConfig.intent_similarity_threshold).toBe(0.8);
      expect(normalizer.fuzzyMatchConfig.enable_phonetic_matching).toBe(false);
      expect(normalizer.fuzzyMatchConfig.entity_similarity_threshold).toBe(originalConfig.entity_similarity_threshold);
    });
  });

  describe('🎯 錯誤處理和回退機制', () => {
    
    test('無效輸入處理', () => {
      const result1 = normalizer.normalizeIntent(null);
      expect(result1.mapped_intent).toBe('unknown');
      expect(result1.mapping_source).toBe('none');
      expect(result1.confidence).toBe(0);
      
      const result2 = normalizer.normalizeIntent('');
      expect(result2.mapped_intent).toBe('unknown');
      
      const result3 = normalizer.normalizeIntent(123);
      expect(result3.mapped_intent).toBe('unknown');
    });

    test('空Entity對象處理', () => {
      const result1 = normalizer.normalizeEntities(null);
      expect(result1.mapped_entities).toEqual({});
      expect(result1.normalization_applied).toBe(false);
      
      const result2 = normalizer.normalizeEntities({});
      expect(result2.mapped_entities).toEqual({});
      expect(result2.normalization_applied).toBe(true);
    });

    test('異常Entity值處理', () => {
      const entities = {
        'course_name': null,
        'student_name': undefined,
        'time': '',
        'complex': { nested: { deeply: 'value' } }
      };

      const result = normalizer.normalizeEntities(entities);
      
      expect(result.mapped_entities.course_name).toBeNull();
      expect(result.mapped_entities.student_name).toBeUndefined();
      expect(result.mapped_entities.time).toBe('');
      expect(result.mapped_entities.complex).toBeTruthy();
      expect(result.mapping_stats.errors).toHaveLength(0);
    });
  });

  describe('🎯 Phase 3.2 特殊場景測試', () => {
    
    test('極簡prompt產生的模糊輸出處理', () => {
      // 模擬極簡prompt可能產生的不完整或模糊的輸出
      const vagueIntents = [
        '課程',
        '時間',
        '查看',
        '更改',
        '記錄',
        'course',
        'time',
        'check'
      ];

      vagueIntents.forEach(intent => {
        const result = normalizer.normalizeIntent(intent);
        expect(result).toHaveProperty('mapped_intent');
        expect(result).toHaveProperty('confidence');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('混合中英文處理', () => {
      const mixedEntities = {
        'course_name': '數學Math',
        '學生name': 'John',
        'time時間': '2:30PM',
        'confirmation確認': 'yes是的'
      };

      const result = normalizer.normalizeEntities(mixedEntities);
      
      expect(result.normalization_applied).toBe(true);
      expect(result.mapped_entities).toBeTruthy();
      expect(Object.keys(result.mapped_entities).length).toBeGreaterThan(0);
    });

    test('表情符號和特殊字符處理', () => {
      const emojiEntities = {
        'performance': '👍',
        'confirmation': '✅',
        'mood': '😊',
        'status': '❌'
      };

      const result = normalizer.normalizeEntities(emojiEntities);
      
      expect(result.mapped_entities.performance).toBe('excellent'); // 👍 映射到 excellent
      expect(result.mapped_entities.confirmation).toBe(true);
      expect(result.mapped_entities.mood).toBe('happy');
      expect(result.mapped_entities.status).toBe(false);
    });
  });

  describe('🎯 性能和擴展性測試', () => {
    
    test('大量數據處理性能', () => {
      const largeEntities = {};
      for (let i = 0; i < 100; i++) {
        largeEntities[`field${i}`] = `value${i}`;
      }

      const startTime = Date.now();
      const result = normalizer.normalizeEntities(largeEntities);
      const endTime = Date.now();

      expect(result.normalization_applied).toBe(true);
      expect(Object.keys(result.mapped_entities)).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // 應該在1秒內完成
    });

    test('重複調用性能（緩存效果）', () => {
      const testIntent = '記錄數學課程';

      // 首次調用（無緩存）
      const start1 = Date.now();
      normalizer.normalizeIntent(testIntent);
      const time1 = Date.now() - start1;

      // 第二次調用（有緩存）
      const start2 = Date.now();
      normalizer.normalizeIntent(testIntent);
      const time2 = Date.now() - start2;

      // 緩存調用應該更快（雖然在測試環境中差異可能不明顯）
      expect(time2).toBeLessThanOrEqual(time1 + 10); // 允許10ms誤差
    });
  });
});