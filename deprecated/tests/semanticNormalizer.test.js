/**
 * SemanticNormalizer 單元測試
 * 測試語意標準化器的所有核心功能
 */

const { SemanticNormalizer, getInstance } = require('../src/services/semanticNormalizer');

describe('SemanticNormalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = getInstance();
  });

  describe('Intent 標準化', () => {
    test('應該正確映射中文Intent到英文標準格式', () => {
      const testCases = [
        { input: '清空課表', expected: 'clear_schedule' },
        { input: '記錄課程', expected: 'record_course' },
        { input: '修改課程', expected: 'modify_course' },
        { input: '查詢課表', expected: 'query_schedule' },
        { input: '取消課程', expected: 'cancel_course' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = normalizer.normalizeIntent(input);
        expect(result.mapped_intent).toBe(expected);
        expect(result.original_intent).toBe(input);
        expect(result.mapping_source).toBe('direct');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    test('應該處理Fallback模式匹配', () => {
      const testCases = [
        { input: 'record something', expected_pattern: 'record_course' },
        { input: 'modify something', expected_pattern: 'modify_course' },
        { input: 'query today', expected_pattern: 'query_schedule' }
      ];

      testCases.forEach(({ input, expected_pattern }) => {
        const result = normalizer.normalizeIntent(input);
        expect(result.mapped_intent).toBe(expected_pattern);
        expect(result.mapping_source).toBe('fallback');
        expect(result.confidence).toBe(0.7);
      });
    });

    test('應該識別已經標準化的Intent', () => {
      const standardIntents = [
        'record_course',
        'modify_course', 
        'query_schedule',
        'clear_schedule'
      ];

      standardIntents.forEach(intent => {
        const result = normalizer.normalizeIntent(intent);
        expect(result.mapped_intent).toBe(intent);
        expect(result.mapping_source).toBe('direct');
        expect(result.confidence).toBe(1.0);
      });
    });

    test('應該處理無效或未知Intent', () => {
      const invalidInputs = [
        null,
        undefined,
        '',
        '完全未知的意圖',
        123,
        {}
      ];

      invalidInputs.forEach(input => {
        const result = normalizer.normalizeIntent(input);
        expect(result.mapped_intent).toBe('unknown');
        expect(['fallback', 'none']).toContain(result.mapping_source);
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('Entity 標準化', () => {
    test('應該正確映射Entity鍵名', () => {
      const testEntities = {
        '課程名稱': '數學',
        '學生姓名': '小明',
        '老師': '王老師',
        '地點': '教室A',
        '時間': '下午2點'
      };

      const result = normalizer.normalizeEntities(testEntities);
      
      expect(result.mapped_entities).toEqual({
        'course_name': '數學',
        'student_name': '小明', 
        'teacher': '王老師',
        'location': '教室A',
        'time': '下午2點'
      });

      expect(result.key_mappings).toEqual({
        '課程名稱': 'course_name',
        '學生姓名': 'student_name',
        '老師': 'teacher',
        '地點': 'location',
        '時間': 'time'
      });
    });

    test('應該正確映射Entity值', () => {
      const testEntities = {
        course_name: '數學',
        confirmation: '是',
        performance: '很好',
        time_phrase: '今天',
        location: '線上'
      };

      const result = normalizer.normalizeEntities(testEntities);
      
      expect(result.mapped_entities.confirmation).toBe(true);
      expect(result.mapped_entities.performance).toBe('excellent');
      expect(result.mapped_entities.time_phrase).toBe('today');
      expect(result.mapped_entities.location).toBe('線上');
    });

    test('應該處理嵌套對象', () => {
      const testEntities = {
        'timeInfo': {
          '日期': '2025-08-01',
          '時間': '14:00'
        },
        'content_entities': {
          '內容': '學習加法',
          '作業': '習作第10頁'
        }
      };

      const result = normalizer.normalizeEntities(testEntities);
      
      expect(result.mapped_entities).toEqual({
        'timeInfo': {
          'date': '2025-08-01',
          'time': '14:00'
        },
        'content_entities': {
          'content': '學習加法',
          'homework': '習作第10頁'
        }
      });
    });

    test('應該處理數組值', () => {
      const testEntities = {
        photos: ['photo1.jpg', 'photo2.jpg'],
        student_names: ['小明', '小華']
      };

      const result = normalizer.normalizeEntities(testEntities);
      
      expect(result.mapped_entities.photos).toEqual(['photo1.jpg', 'photo2.jpg']);
      expect(result.mapped_entities.student_names).toEqual(['小明', '小華']);
    });

    test('應該記錄未映射的鍵名', () => {
      const testEntities = {
        'unknown_key': 'some_value',
        'course_name': '數學',
        'another_unknown': 'another_value'
      };

      const result = normalizer.normalizeEntities(testEntities);
      
      expect(result.unmapped_keys).toContain('unknown_key');
      expect(result.unmapped_keys).toContain('another_unknown');
      expect(result.unmapped_keys).not.toContain('course_name');
    });
  });

  describe('統一標準化入口', () => {
    test('應該成功標準化完整的分析結果', () => {
      const mockAIResult = {
        intent: '記錄課程',
        entities: {
          '課程名稱': '數學',
          '學生姓名': '小明',
          'confirmation': '是'
        },
        confidence: { overall: 0.95 }
      };

      const result = normalizer.normalize(mockAIResult);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.intent.mapped_intent).toBe('record_course');
      expect(result.entities.mapped_entities).toEqual({
        'course_name': '數學',
        'student_name': '小明',
        'confirmation': true
      });
      expect(result.debug_info.normalizer_version).toBe('1.0.0');
      expect(result.debug_info.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    test('應該處理部分映射失敗的情況', () => {
      const mockResult = {
        intent: '未知意圖',
        entities: {
          'course_name': '數學',
          'unknown_key': 'unknown_value'
        }
      };

      const result = normalizer.normalize(mockResult);
      
      expect(result.success).toBe(false); // 因為有未映射的鍵和低confidence的intent
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.intent.mapped_intent).toBe('unknown');
      expect(result.entities.unmapped_keys).toContain('unknown_key');
    });

    test('應該處理無效輸入', () => {
      const invalidInputs = [null, undefined, 123, []];

      invalidInputs.forEach(input => {
        const result = normalizer.normalize(input);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.intent.mapped_intent).toBe('unknown');
      });
      
      // 字符串是有效輸入，但可能沒有intent和entities字段
      const stringResult = normalizer.normalize('string');
      expect(stringResult.success).toBe(false); // 因為缺少intent字段
    });
  });

  describe('配置選項', () => {
    test('應該支持strict_mode配置', () => {
      const testIntent = '未知意圖';
      
      // 非嚴格模式
      const normalResult = normalizer.normalizeIntent(testIntent, { strict_mode: false });
      expect(normalResult.mapped_intent).toBe('unknown');
      
      // 嚴格模式下也應該正常工作（但可能有不同行為）
      const strictResult = normalizer.normalizeIntent(testIntent, { strict_mode: true });
      expect(strictResult.mapped_intent).toBe('unknown');
    });

    test('應該支持fallback_enabled配置', () => {
      const testIntent = 'record something';
      
      // 啟用fallback
      const withFallback = normalizer.normalizeIntent(testIntent, { fallback_enabled: true });
      expect(withFallback.mapping_source).toBe('fallback');
      
      // 禁用fallback
      const withoutFallback = normalizer.normalizeIntent(testIntent, { fallback_enabled: false });
      expect(withoutFallback.mapping_source).toBe('none');
      expect(withoutFallback.mapped_intent).toBe('unknown');
    });
  });

  describe('工具方法', () => {
    test('getSupportedIntents應該返回所有支持的Intent', () => {
      const supportedIntents = normalizer.getSupportedIntents();
      
      expect(Array.isArray(supportedIntents)).toBe(true);
      expect(supportedIntents).toContain('record_course');
      expect(supportedIntents).toContain('modify_course');
      expect(supportedIntents).toContain('query_schedule');
      expect(supportedIntents).toContain('clear_schedule');
    });

    test('getSupportedEntityKeys應該返回所有支持的Entity鍵', () => {
      const supportedKeys = normalizer.getSupportedEntityKeys();
      
      expect(Array.isArray(supportedKeys)).toBe(true);
      // 注意：這個測試可能需要根據實際的mapping文件調整
    });

    test('getMappingStats應該返回映射統計信息', () => {
      const stats = normalizer.getMappingStats();
      
      expect(typeof stats).toBe('object');
      expect(typeof stats.intent_mappings).toBe('number');
      expect(typeof stats.fallback_patterns).toBe('number');
      expect(typeof stats.entity_key_mappings).toBe('number');
      expect(stats.intent_mappings).toBeGreaterThan(0);
    });

    test('reloadMappingData應該重新加載映射數據', () => {
      // 這個測試主要確保方法可以調用而不報錯
      expect(() => {
        normalizer.reloadMappingData();
      }).not.toThrow();
    });
  });

  describe('邊界情況和錯誤處理', () => {
    test('應該處理空字符串和空白字符', () => {
      const emptyInputs = ['', '   ', '\t', '\n'];
      
      emptyInputs.forEach(input => {
        const intentResult = normalizer.normalizeIntent(input);
        expect(intentResult.mapped_intent).toBe('unknown');
        
        const entityResult = normalizer.normalizeEntities({ key: input });
        expect(typeof entityResult.mapped_entities).toBe('object');
      });
    });

    test('應該處理循環引用對象', () => {
      const circularObj = { key: 'value' };
      circularObj.self = circularObj;
      
      // 這應該不會導致無限循環或崩潰
      expect(() => {
        normalizer.normalizeEntities(circularObj);
      }).not.toThrow();
    });

    test('應該處理超大對象', () => {
      const largeEntities = {};
      for (let i = 0; i < 100; i++) {
        largeEntities[`key_${i}`] = `value_${i}`;
      }
      
      const result = normalizer.normalizeEntities(largeEntities);
      expect(typeof result.mapped_entities).toBe('object');
      expect(Object.keys(result.mapped_entities)).toHaveLength(100);
    });
  });

  describe('性能測試', () => {
    test('標準化操作應該在合理時間內完成', () => {
      const testData = {
        intent: '記錄課程',
        entities: {
          '課程名稱': '數學',
          '學生姓名': '小明',
          '老師': '王老師',
          '時間': '下午2點',
          'timeInfo': {
            '日期': '2025-08-01',
            '時間': '14:00'
          }
        }
      };

      const startTime = Date.now();
      const result = normalizer.normalize(testData);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // 應該在100ms內完成
    });

    test('批量標準化應該有良好性能', () => {
      const batchSize = 50;
      const testIntents = ['記錄課程', '修改課程', '查詢課表', '清空課表', '取消課程'];
      
      const startTime = Date.now();
      
      for (let i = 0; i < batchSize; i++) {
        const intent = testIntents[i % testIntents.length];
        normalizer.normalizeIntent(intent);
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / batchSize;
      
      expect(avgTime).toBeLessThan(10); // 平均每次應該在10ms內完成
    });
  });
});