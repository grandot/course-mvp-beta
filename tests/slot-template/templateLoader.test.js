/**
 * TemplateLoader 單元測試
 */

const { TemplateLoader, getTemplateLoader } = require('../../src/slot-template/templateLoader');
const path = require('path');

describe('TemplateLoader', () => {
  let templateLoader;

  beforeEach(() => {
    templateLoader = new TemplateLoader();
  });

  describe('初始化', () => {
    test('應該能夠成功初始化並載入模板', async () => {
      await templateLoader.initialize();
      
      expect(templateLoader.initialized).toBe(true);
      expect(templateLoader.templates.size).toBeGreaterThan(0);
    });

    test('重複初始化不應該重複載入', async () => {
      await templateLoader.initialize();
      const firstSize = templateLoader.templates.size;
      
      await templateLoader.initialize();
      const secondSize = templateLoader.templates.size;
      
      expect(firstSize).toBe(secondSize);
    });
  });

  describe('模板載入', () => {
    beforeEach(async () => {
      await templateLoader.initialize();
    });

    test('應該能夠根據 template_id 獲取模板', async () => {
      const template = await templateLoader.getTemplate('course_management');
      
      expect(template).toBeDefined();
      expect(template.template_id).toBe('course_management');
      expect(template.template_name).toBe('課程管理');
      expect(template.slots).toBeDefined();
      expect(template.completion_rules).toBeDefined();
    });

    test('獲取不存在的模板應該拋出錯誤', async () => {
      await expect(templateLoader.getTemplate('non_existent'))
        .rejects.toThrow('找不到模板: non_existent');
    });

    test('應該能夠根據 intent 獲取模板', async () => {
      const template = await templateLoader.getTemplateByIntent('record_course');
      
      expect(template).toBeDefined();
      expect(template.intents).toContain('record_course');
    });

    test('獲取不支援的 intent 應該拋出錯誤', async () => {
      await expect(templateLoader.getTemplateByIntent('unsupported_intent'))
        .rejects.toThrow('找不到支援 intent \'unsupported_intent\' 的模板');
    });
  });

  describe('模板驗證', () => {
    test('應該驗證有效的模板', async () => {
      await templateLoader.initialize();
      
      const validTemplate = {
        template_id: 'test_template',
        template_name: '測試模板',
        version: '1.0.0',
        slots: {
          test_slot: {
            type: 'string',
            required: true,
            description: '測試欄位'
          }
        },
        completion_rules: {
          minimum_required: ['test_slot']
        },
        intents: ['test_intent']
      };

      expect(() => templateLoader.validateTemplate(validTemplate)).not.toThrow();
    });

    test('應該拒絕無效的模板', async () => {
      await templateLoader.initialize();
      
      const invalidTemplate = {
        template_id: 'invalid_template',
        // 缺少必要欄位
      };

      expect(() => templateLoader.validateTemplate(invalidTemplate)).toThrow();
    });

    test('應該驗證業務邏輯規則', async () => {
      await templateLoader.initialize();
      
      const templateWithInvalidRules = {
        template_id: 'test_template',
        template_name: '測試模板',
        version: '1.0.0',
        slots: {
          existing_slot: {
            type: 'string',
            required: true,
            description: '存在的欄位'
          }
        },
        completion_rules: {
          minimum_required: ['non_existent_slot'] // 引用不存在的 slot
        },
        intents: ['test_intent']
      };

      expect(() => templateLoader.validateTemplate(templateWithInvalidRules))
        .toThrow('必填 slot \'non_existent_slot\' 在模板中未定義');
    });
  });

  describe('統計和覆蓋率', () => {
    beforeEach(async () => {
      await templateLoader.initialize();
    });

    test('應該提供正確的統計資訊', async () => {
      const stats = await templateLoader.getStats();
      
      expect(stats.total_templates).toBeGreaterThan(0);
      expect(stats.templates).toBeInstanceOf(Array);
      expect(stats.intents_coverage).toBeInstanceOf(Array);
      
      if (stats.templates.length > 0) {
        const firstTemplate = stats.templates[0];
        expect(firstTemplate.id).toBeDefined();
        expect(firstTemplate.name).toBeDefined();
        expect(firstTemplate.version).toBeDefined();
        expect(typeof firstTemplate.slots_count).toBe('number');
      }
    });

    test('應該正確計算覆蓋率', async () => {
      const existingIntents = ['record_course', 'modify_course', 'unknown_intent'];
      const coverage = await templateLoader.validateCoverage(existingIntents);
      
      expect(coverage.covered).toBeInstanceOf(Array);
      expect(coverage.uncovered).toBeInstanceOf(Array);
      expect(coverage.orphaned).toBeInstanceOf(Array);
      expect(typeof coverage.coverage_rate).toBe('number');
      expect(coverage.coverage_rate).toBeGreaterThanOrEqual(0);
      expect(coverage.coverage_rate).toBeLessThanOrEqual(1);
    });
  });

  describe('單例模式', () => {
    test('getTemplateLoader 應該返回同一個實例', () => {
      const instance1 = getTemplateLoader();
      const instance2 = getTemplateLoader();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('課程管理模板驗證', () => {
    beforeEach(async () => {
      await templateLoader.initialize();
    });

    test('課程管理模板應該包含所有必要的 slots', async () => {
      const template = await templateLoader.getTemplate('course_management');
      
      // 驗證核心 slots
      expect(template.slots.student).toBeDefined();
      expect(template.slots.course).toBeDefined();
      expect(template.slots.date).toBeDefined();
      expect(template.slots.time).toBeDefined();
      expect(template.slots.location).toBeDefined();
      expect(template.slots.teacher).toBeDefined();
      expect(template.slots.reminder).toBeDefined();
      expect(template.slots.repeat).toBeDefined();
      expect(template.slots.note).toBeDefined();
      
      // 驗證必填欄位
      expect(template.completion_rules.minimum_required).toContain('student');
      expect(template.completion_rules.minimum_required).toContain('course');
      expect(template.completion_rules.minimum_required).toContain('date');
      expect(template.completion_rules.minimum_required).toContain('time');
      
      // 驗證支援的 intents
      expect(template.intents).toContain('record_course');
      expect(template.intents).toContain('modify_course');
    });

    test('課程管理模板的 slots 應該有正確的型別', async () => {
      const template = await templateLoader.getTemplate('course_management');
      
      expect(template.slots.student.type).toBe('string');
      expect(template.slots.course.type).toBe('string');
      expect(template.slots.date.type).toBe('date');
      expect(template.slots.time.type).toBe('time');
      expect(template.slots.location.type).toBe('string');
      expect(template.slots.teacher.type).toBe('string');
      expect(template.slots.reminder.type).toBe('object');
      expect(template.slots.repeat.type).toBe('object');
      expect(template.slots.note.type).toBe('string');
    });

    test('課程管理模板應該有問題模板', async () => {
      const template = await templateLoader.getTemplate('course_management');
      
      expect(template.question_templates).toBeDefined();
      expect(template.question_templates.student).toBeInstanceOf(Array);
      expect(template.question_templates.course).toBeInstanceOf(Array);
      expect(template.question_templates.date).toBeInstanceOf(Array);
      expect(template.question_templates.time).toBeInstanceOf(Array);
    });
  });
});