/**
 * HumanPromptGenerator 測試套件
 * 涵蓋多問題提示、單一問題提示、混雜提取提示等功能
 */

const HumanPromptGenerator = require('../../src/slot-template/humanPromptGenerator');

describe('HumanPromptGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new HumanPromptGenerator();
  });

  describe('多問題提示生成', () => {
    test('應該生成多問題提示訊息', () => {
      const problems = [
        { type: 'invalid_date', value: '後台', field: 'date' },
        { type: 'vague_time', value: '下午', field: 'time' }
      ];
      const validSlots = { course: '大提琴課' };

      const result = generator.generateMultiProblemPrompt(problems, validSlots);

      expect(result.type).toBe('multi_problem');
      expect(result.problemCount).toBe(2);
      expect(result.message).toContain('我需要一些更清楚的資訊才能幫您安排課程');
      expect(result.message).toContain('日期資訊不清楚（「後台」無法識別為有效日期）');
      expect(result.message).toContain('時間需要更具體（「下午」請提供確切時間）');
      expect(result.message).toContain('請重新完整輸入課程資訊');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.examples).toBeInstanceOf(Array);
    });

    test('應該包含適當的建議', () => {
      const problems = [
        { type: 'invalid_date', field: 'date' },
        { type: 'vague_time', field: 'time' }
      ];

      const result = generator.generateMultiProblemPrompt(problems);

      expect(result.suggestions).toContain('請使用「明天」、「後天」或具體日期如「7月30日」');
      expect(result.suggestions).toContain('請提供具體時間，如「下午3點」、「19:30」');
    });
  });

  describe('單一問題提示生成', () => {
    test('應該生成單一問題提示訊息', () => {
      const problem = { type: 'missing_time', field: 'time' };
      const validSlots = { course: '大提琴課', student: '小美', date: '明天' };

      const result = generator.generateSingleProblemPrompt(problem, validSlots);

      expect(result.type).toBe('single_problem');
      expect(result.problemType).toBe('missing_time');
      expect(result.message).toContain('✅ 已記錄：');
      expect(result.message).toContain('大提琴課、小美、明天');
      expect(result.message).toContain('🕐 還需要確認：上課時間');
      expect(result.message).toContain('例如可以回覆：');
      expect(result.examples).toContain('下午3點');
      expect(result.examples).toContain('晚上7點半');
    });

    test('缺失日期問題應該提供日期範例', () => {
      const problem = { type: 'missing_date', field: 'date' };
      const validSlots = { course: '大提琴課' };

      const result = generator.generateSingleProblemPrompt(problem, validSlots);

      expect(result.problemType).toBe('missing_date');
      expect(result.examples).toContain('明天');
      expect(result.examples).toContain('後天');
      expect(result.examples).toContain('7月30日');
    });

    test('沒有有效信息時不應該顯示確認部分', () => {
      const problem = { type: 'missing_course', field: 'course' };
      const validSlots = {};

      const result = generator.generateSingleProblemPrompt(problem, validSlots);

      expect(result.message).not.toContain('✅ 已記錄：');
      expect(result.message).toContain('🕐 還需要確認：');
    });
  });

  describe('混雜提取提示生成', () => {
    test('應該生成混雜提取分離提示', () => {
      const separationResult = {
        pureCourse: '大提琴課',
        extractedDate: '明天',
        extractedTime: '下午'
      };

      const result = generator.generateMixedExtractionPrompt(separationResult, false);

      expect(result.type).toBe('mixed_extraction');
      expect(result.message).toContain('我已智能分離您的輸入內容：');
      expect(result.message).toContain('• 日期：明天');
      expect(result.message).toContain('• 時間：下午');
      expect(result.message).toContain('• 課程：大提琴課');
      expect(result.separationResult).toEqual(separationResult);
      expect(result.isComplete).toBe(false);
    });

    test('完整信息時應該顯示完成提示', () => {
      const separationResult = {
        pureCourse: '大提琴課',
        extractedDate: '明天',
        extractedTime: '下午'
      };

      const result = generator.generateMixedExtractionPrompt(separationResult, true);

      expect(result.message).toContain('信息已完整，正在為您安排課程...');
      expect(result.isComplete).toBe(true);
    });
  });

  describe('輔助方法測試', () => {
    test('confirmValidInfo 應該正確格式化有效信息', () => {
      const validSlots = {
        course: '大提琴課',
        student: '小美',
        date: '明天',
        time: '15:00'
      };

      const result = generator.confirmValidInfo(validSlots);

      expect(result).toContain('大提琴課');
      expect(result).toContain('小美');
      expect(result).toContain('明天');
      expect(result).toContain('下午3點'); // 15:00 應該被格式化為下午3點
    });

    test('confirmValidInfo 應該忽略空值', () => {
      const validSlots = {
        course: '大提琴課',
        student: '',
        date: null,
        time: undefined
      };

      const result = generator.confirmValidInfo(validSlots);

      expect(result).toBe('大提琴課');
    });

    test('askMissingInfo 應該返回正確的詢問信息', () => {
      expect(generator.askMissingInfo({ type: 'missing_time' })).toBe('上課時間');
      expect(generator.askMissingInfo({ type: 'missing_date' })).toBe('上課日期');
      expect(generator.askMissingInfo({ type: 'missing_course' })).toBe('課程名稱');
      expect(generator.askMissingInfo({ type: 'missing_student' })).toBe('學生姓名');
    });

    test('getSpecificExamples 應該返回對應的範例', () => {
      const timeExamples = generator.getSpecificExamples('missing_time');
      expect(timeExamples).toContain('下午3點');
      expect(timeExamples).toContain('晚上7點半');

      const dateExamples = generator.getSpecificExamples('missing_date');
      expect(dateExamples).toContain('明天');
      expect(dateExamples).toContain('後天');

      const courseExamples = generator.getSpecificExamples('missing_course');
      expect(courseExamples).toContain('大提琴課');
      expect(courseExamples).toContain('小提琴課');
    });

    test('buildProblemDescriptions 應該構建問題描述', () => {
      const problems = [
        { type: 'invalid_date', value: '後台', field: 'date' },
        { type: 'vague_time', value: '下午', field: 'time' },
        { type: 'missing_required', field: 'course' }
      ];

      const descriptions = generator.buildProblemDescriptions(problems);

      expect(descriptions).toHaveLength(3);
      expect(descriptions[0]).toContain('日期資訊不清楚（「後台」無法識別為有效日期）');
      expect(descriptions[1]).toContain('時間需要更具體（「下午」請提供確切時間）');
      expect(descriptions[2]).toContain('缺少課程資訊');
    });

    test('generateSuggestions 應該生成不重複的建議', () => {
      const problems = [
        { type: 'invalid_date' },
        { type: 'invalid_date' }, // 重複問題
        { type: 'vague_time' }
      ];

      const suggestions = generator.generateSuggestions(problems);

      expect(suggestions).toHaveLength(2); // 應該去重
      expect(suggestions).toContain('請使用「明天」、「後天」或具體日期如「7月30日」');
      expect(suggestions).toContain('請提供具體時間，如「下午3點」、「19:30」');
    });
  });

  describe('時間日期格式化', () => {
    test('formatDisplayTime 應該正確格式化時間', () => {
      expect(generator.formatDisplayTime('15:00')).toBe('下午3點');
      expect(generator.formatDisplayTime('09:30')).toBe('上午9點30分');
      expect(generator.formatDisplayTime('12:00')).toBe('下午12點');
      expect(generator.formatDisplayTime('00:00')).toBe('上午12點');
      expect(generator.formatDisplayTime('下午3點')).toBe('下午3點'); // 已格式化的保持不變
    });

    test('formatDisplayDate 應該正確格式化日期', () => {
      expect(generator.formatDisplayDate('明天')).toBe('明天');
      expect(generator.formatDisplayDate('2025-07-30')).toBe('7月30日');
      expect(generator.formatDisplayDate('2025-01-05')).toBe('1月5日');
    });
  });

  describe('範例生成', () => {
    test('generateExample 應該返回隨機範例', () => {
      const example = generator.generateExample('complete_course');
      expect(generator.examples.complete_course).toContain(example);
      
      const timeExample = generator.generateExample('time_examples');  
      expect(generator.examples.time_examples).toContain(timeExample);
    });

    test('不存在的範例類型應該返回默認範例', () => {
      const example = generator.generateExample('nonexistent');
      expect(generator.examples.complete_course).toContain(example);
    });
  });

  describe('邊界情況處理', () => {
    test('空問題列表應該正常處理', () => {
      const result = generator.generateMultiProblemPrompt([]);
      expect(result.type).toBe('multi_problem');
      expect(result.problemCount).toBe(0);
      expect(result.message).toContain('我需要一些更清楚的資訊才能幫您安排課程');
    });

    test('未知問題類型應該使用默認描述', () => {
      const problems = [{ type: 'unknown_problem', message: '自定義錯誤訊息' }];
      const descriptions = generator.buildProblemDescriptions(problems);
      expect(descriptions[0]).toBe('自定義錯誤訊息');
    });

    test('沒有message的未知問題類型應該有默認處理', () => {
      const problems = [{ type: 'unknown_problem' }];
      const descriptions = generator.buildProblemDescriptions(problems);
      expect(descriptions[0]).toBe('未知問題：unknown_problem');
    });
  });
});