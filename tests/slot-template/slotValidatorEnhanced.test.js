/**
 * SlotValidator Enhanced 測試套件 - Multi-Turn Dialog Enhancement
 * 涵蓋必填欄位驗證增強功能
 */

const SlotValidator = require('../../src/slot-template/slotValidator');

describe('SlotValidator Enhanced (Multi-Turn Dialog)', () => {
  let validator;

  beforeEach(() => {
    validator = new SlotValidator();
  });

  describe('validateWithProblemDetection', () => {
    test('應該檢測缺失必填欄位', () => {
      const slotState = {
        course: '大提琴課'
        // 缺少 date 和 time
      };
      const template = {
        completion_rules: {
          minimum_required: ['course', 'date', 'time']
        }
      };

      const problems = validator.validateWithProblemDetection(slotState, template);

      expect(problems).toHaveLength(2);
      expect(problems[0]).toMatchObject({
        type: 'missing_required',
        field: 'date',
        severity: 'high'
      });
      expect(problems[1]).toMatchObject({
        type: 'missing_required',
        field: 'time',
        severity: 'high'
      });
    });

    test('空值應該被視為缺失', () => {
      const slotState = {
        course: '大提琴課',
        date: '',
        time: null
      };
      const template = {
        completion_rules: {
          minimum_required: ['course', 'date', 'time']
        }
      };

      const problems = validator.validateWithProblemDetection(slotState, template);

      expect(problems).toHaveLength(2);
      expect(problems.map(p => p.field)).toContain('date');
      expect(problems.map(p => p.field)).toContain('time');
    });
  });

  describe('validateDateQuality', () => {
    test('應該檢測無效日期模式', () => {
      const rules = {
        invalid_patterns: ['後台', '前台', '不知道']
      };

      const problems1 = validator.validateDateQuality('後台', rules);
      expect(problems1).toHaveLength(1);
      expect(problems1[0]).toMatchObject({
        type: 'invalid_date',
        field: 'date',
        value: '後台',
        severity: 'high'
      });

      const problems2 = validator.validateDateQuality('明天', rules);
      expect(problems2).toHaveLength(0);
    });

    test('只報告第一個匹配的無效模式', () => {
      const rules = {
        invalid_patterns: ['後台', '前台']
      };

      const problems = validator.validateDateQuality('後台前台混合', rules);
      expect(problems).toHaveLength(1); // 只報告第一個匹配的
      expect(problems[0].message).toContain('後台');
    });
  });

  describe('validateTimeQuality', () => {
    test('應該檢測模糊時間', () => {
      const rules = {
        vague_patterns: ['下午', '晚上', '早上'],
        require_specific: true
      };

      const problems1 = validator.validateTimeQuality('下午', rules);
      expect(problems1).toHaveLength(1);
      expect(problems1[0]).toMatchObject({
        type: 'vague_time',
        field: 'time',
        value: '下午',
        severity: 'medium'
      });

      const problems2 = validator.validateTimeQuality('15:00', rules);
      expect(problems2).toHaveLength(0);
    });

    test('不要求具體時間時不檢測模糊', () => {
      const rules = {
        vague_patterns: ['下午', '晚上'],
        require_specific: false
      };

      const problems = validator.validateTimeQuality('下午', rules);
      expect(problems).toHaveLength(0);
    });
  });

  describe('validateCourseQuality', () => {
    test('應該檢測日期時間混雜提取', () => {
      const rules = {
        mixed_extraction_patterns: {
          date_time_mixed: '.*[明後今昨]天.*[0-9]+點.*課$|.*[明後今昨]天.*[下晚早中]午.*課$'
        }
      };

      const problems1 = validator.validateCourseQuality('明天下午8點大提琴課', rules);
      expect(problems1).toHaveLength(1);
      expect(problems1[0]).toMatchObject({
        type: 'mixed_extraction',
        field: 'course',
        mixedType: 'date_time_mixed',
        severity: 'high'
      });

      const problems2 = validator.validateCourseQuality('大提琴課', rules);
      expect(problems2).toHaveLength(0);
    });

    test('應該檢測日期混雜提取', () => {
      const rules = {
        mixed_extraction_patterns: {
          date_mixed: '.*[明後今昨]天.*課$'
        }
      };

      const problems = validator.validateCourseQuality('明天大提琴課', rules);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({
        type: 'mixed_extraction',
        mixedType: 'date_mixed'
      });
    });

    test('應該檢測時間混雜提取', () => {
      const rules = {
        mixed_extraction_patterns: {
          time_mixed: '.*[0-9]+點.*課$|.*[下晚早中]午.*課$'
        }
      };

      const problems1 = validator.validateCourseQuality('下午大提琴課', rules);
      expect(problems1).toHaveLength(1);
      expect(problems1[0]).toMatchObject({
        type: 'mixed_extraction',
        mixedType: 'time_mixed'
      });

      const problems2 = validator.validateCourseQuality('8點大提琴課', rules);
      expect(problems2).toHaveLength(1);
      expect(problems2[0]).toMatchObject({
        type: 'mixed_extraction',
        mixedType: 'time_mixed'
      });
    });

    test('優先報告複合混雜', () => {
      const rules = {
        mixed_extraction_patterns: {
          date_time_mixed: '.*[明後今昨]天.*[0-9]+點.*課$',
          date_mixed: '.*[明後今昨]天.*課$',
          time_mixed: '.*[0-9]+點.*課$'
        }
      };

      const problems = validator.validateCourseQuality('明天8點大提琴課', rules);
      expect(problems).toHaveLength(1);
      expect(problems[0].mixedType).toBe('date_time_mixed'); // 優先報告複合混雜
    });
  });

  describe('validateFieldQuality', () => {
    test('應該整合檢查所有欄位品質', () => {
      const slotState = {
        course: '明天下午大提琴課', // 混雜提取
        date: '後台',              // 無效日期
        time: '下午'               // 模糊時間
      };
      const template = {
        completion_rules: {
          validation_rules: {
            date: {
              invalid_patterns: ['後台', '前台']
            },
            time: {
              vague_patterns: ['下午', '晚上'],
              require_specific: true
            },
            course: {
              mixed_extraction_patterns: {
                date_time_mixed: '.*[明後今昨]天.*[下晚早中]午.*課$'
              }
            }
          }
        }
      };

      const problems = validator.validateFieldQuality(slotState, template);

      expect(problems).toHaveLength(3);
      expect(problems.map(p => p.type)).toContain('invalid_date');
      expect(problems.map(p => p.type)).toContain('vague_time');
      expect(problems.map(p => p.type)).toContain('mixed_extraction');
    });

    test('沒有驗證規則時不應該報告問題', () => {
      const slotState = {
        course: '明天大提琴課',
        date: '後台',
        time: '下午'
      };
      const template = {
        completion_rules: {}
      };

      const problems = validator.validateFieldQuality(slotState, template);
      expect(problems).toHaveLength(0);
    });
  });

  describe('isCompleteWithDynamicRules', () => {
    test('應該基於動態必填欄位檢查完成度', () => {
      const template = {
        completion_rules: {
          minimum_required: ['course', 'date', 'time'],
          future_required: ['student']
        }
      };

      // 完整狀態
      const completeState = {
        course: '大提琴課',
        date: '明天',
        time: '15:00'
      };
      expect(validator.isCompleteWithDynamicRules(completeState, template)).toBe(true);

      // 不完整狀態
      const incompleteState = {
        course: '大提琴課',
        date: '明天'
        // 缺少 time
      };
      expect(validator.isCompleteWithDynamicRules(incompleteState, template)).toBe(false);
    });

    test('沒有完成規則時應該返回 false', () => {
      const template = {};
      const state = { course: '大提琴課' };
      
      expect(validator.isCompleteWithDynamicRules(state, template)).toBe(false);
    });
  });

  describe('邊界情況處理', () => {
    test('空的 slotState 應該正常處理', () => {
      const slotState = {};
      const template = {
        completion_rules: {
          minimum_required: ['course', 'date', 'time']
        }
      };

      const problems = validator.validateWithProblemDetection(slotState, template);
      expect(problems).toHaveLength(3); // 所有必填欄位都缺失
    });

    test('空的 template 應該正常處理', () => {
      const slotState = { course: '大提琴課' };
      const template = {};

      const problems = validator.validateWithProblemDetection(slotState, template);
      expect(problems).toHaveLength(0); // 沒有驗證規則，沒有問題
    });

    test('驗證空值和 null 值', () => {
      const emptyProblems = validator.validateDateQuality('', { invalid_patterns: ['後台'] });
      expect(emptyProblems).toHaveLength(0);

      const nullProblems = validator.validateTimeQuality(null, { vague_patterns: ['下午'] });
      expect(nullProblems).toHaveLength(0);

      const undefinedProblems = validator.validateCourseQuality(undefined, { mixed_extraction_patterns: {} });
      expect(undefinedProblems).toHaveLength(0);
    });
  });
});