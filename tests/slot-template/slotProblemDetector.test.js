/**
 * SlotProblemDetector 測試套件
 * 涵蓋多問題檢測、單一問題檢測、混雜提取檢測等功能
 */

const SlotProblemDetector = require('../../src/slot-template/slotProblemDetector');

describe('SlotProblemDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SlotProblemDetector();
  });

  describe('混雜提取問題檢測 🚨', () => {
    test('應該檢測複雜混雜提取 - 明天下午8點大提琴課', () => {
      const slotState = {
        course: '明天下午8點大提琴課'
      };
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };

      const problems = detector.detectProblems(slotState, template);
      
      expect(problems.mixedExtraction).toHaveLength(1);
      expect(problems.mixedExtraction[0]).toMatchObject({
        type: 'mixed_extraction',
        field: 'course',
        value: '明天下午8點大提琴課',
        mixedType: 'date_time_mixed',
        severity: 'high'
      });
    });

    test('應該檢測時間混雜提取 - 下午小提琴課', () => {
      const slotState = {
        course: '下午小提琴課'
      };

      const problems = detector.detectProblems(slotState, {});
      
      expect(problems.mixedExtraction).toHaveLength(1);
      expect(problems.mixedExtraction[0]).toMatchObject({
        type: 'mixed_extraction',
        field: 'course',
        value: '下午小提琴課',
        mixedType: 'time_mixed'
      });
    });

    test('應該檢測日期混雜提取 - 明天大提琴課', () => {
      const slotState = {
        course: '明天大提琴課'
      };

      const problems = detector.detectProblems(slotState, {});
      
      expect(problems.mixedExtraction).toHaveLength(1);
      expect(problems.mixedExtraction[0]).toMatchObject({
        type: 'mixed_extraction',
        field: 'course',
        value: '明天大提琴課',
        mixedType: 'date_mixed'
      });
    });

    test('純課程名稱不應觸發混雜提取檢測', () => {
      const slotState = {
        course: '大提琴課'
      };

      const problems = detector.detectProblems(slotState, {});
      
      expect(problems.mixedExtraction).toHaveLength(0);
    });
  });

  describe('智能分離功能測試', () => {
    test('應該正確分離複雜混雜內容 - 明天下午8點大提琴課', () => {
      const slotState = {
        course: '明天下午8點大提琴課'
      };

      const separated = detector.separateMixedSlots(slotState);
      
      expect(separated.course).toBe('大提琴課');
      expect(separated.date).toBe('明天');
      expect(separated.time).toBe('下午');
    });

    test('應該正確分離學生+時間+課程 - 明天下午小美鋼琴課', () => {
      const slotState = {
        course: '明天下午小美鋼琴課'
      };

      const separated = detector.separateMixedSlots(slotState);
      
      expect(separated.course).toBe('鋼琴課');
      expect(separated.date).toBe('明天');
      expect(separated.time).toBe('下午');
      expect(separated.student).toBe('小美');
    });

    test('應該正確分離時間混雜 - 下午小提琴課', () => {
      const slotState = {
        course: '下午小提琴課'
      };

      const separated = detector.separateMixedSlots(slotState);
      
      expect(separated.course).toBe('小提琴課');
      expect(separated.time).toBe('下午');
      expect(separated.date).toBeUndefined();
    });

    test('不覆蓋已存在的字段', () => {
      const slotState = {
        course: '明天下午大提琴課',
        date: '2025-07-30', // 已存在的日期不被覆蓋
        time: '15:00'       // 已存在的時間不被覆蓋
      };

      const separated = detector.separateMixedSlots(slotState);
      
      expect(separated.course).toBe('大提琴課');
      expect(separated.date).toBe('2025-07-30'); // 保持原值
      expect(separated.time).toBe('15:00');       // 保持原值
    });
  });

  describe('多問題檢測', () => {
    test('應該檢測多重問題 - 後台下午小美大提琴課', () => {
      const slotState = {
        course: '小美大提琴課',
        date: '後台',    // 無效日期
        time: '下午'     // 模糊時間
      };
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };

      const problems = detector.detectProblems(slotState, template);
      const problemCount = detector.countProblems(problems);
      
      expect(problemCount).toBe(2);
      expect(problems.invalidDate).toHaveLength(1);
      expect(problems.vagueTime).toHaveLength(1);
      expect(problems.invalidDate[0].value).toBe('後台');
      expect(problems.vagueTime[0].value).toBe('下午');
    });

    test('應該檢測無效日期格式', () => {
      const slotState = {
        date: '前台'
      };

      const problems = detector.detectProblems(slotState, {});
      
      expect(problems.invalidDate).toHaveLength(1);
      expect(problems.invalidDate[0]).toMatchObject({
        type: 'invalid_date',
        field: 'date',
        value: '前台',
        severity: 'high'
      });
    });
  });

  describe('單一問題檢測', () => {
    test('應該檢測單一模糊時間問題 - 明天小美大提琴課', () => {
      const slotState = {
        course: '大提琴課',
        student: '小美',
        date: '明天'
        // 缺少時間
      };
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };

      const problems = detector.detectProblems(slotState, template);
      const problemCount = detector.countProblems(problems);
      
      expect(problemCount).toBe(1);
      expect(problems.missingRequired).toHaveLength(1);
      expect(problems.missingRequired[0].field).toBe('time');
    });

    test('應該檢測模糊時間', () => {
      const slotState = {
        time: '晚上'
      };

      const problems = detector.detectProblems(slotState, {});
      
      expect(problems.vagueTime).toHaveLength(1);
      expect(problems.vagueTime[0]).toMatchObject({
        type: 'vague_time',
        field: 'time',
        value: '晚上',
        severity: 'medium'
      });
    });
  });

  describe('完整信息檢測', () => {
    test('完整信息不應產生問題', () => {
      const slotState = {
        course: '大提琴課',
        date: '明天',
        time: '15:00'
      };
      const template = { completion_rules: { minimum_required: ['course', 'date', 'time'] } };

      const problems = detector.detectProblems(slotState, template);
      const problemCount = detector.countProblems(problems);
      
      expect(problemCount).toBe(0);
    });
  });

  describe('輔助方法測試', () => {
    test('countProblems 應該正確計算問題總數', () => {
      const problems = {
        invalidDate: [{ type: 'invalid_date' }],
        vagueTime: [{ type: 'vague_time' }],
        mixedExtraction: [{ type: 'mixed_extraction' }],
        missingRequired: [],
        formatErrors: [],
        ambiguousValues: []
      };

      const count = detector.countProblems(problems);
      expect(count).toBe(3);
    });

    test('getAllProblems 應該返回統一格式的問題列表', () => {
      const problems = {
        invalidDate: [{ type: 'invalid_date', field: 'date' }],
        vagueTime: [{ type: 'vague_time', field: 'time' }]
      };

      const allProblems = detector.getAllProblems(problems);
      
      expect(allProblems).toHaveLength(2);
      expect(allProblems[0]).toMatchObject({
        type: 'invalid_date',
        field: 'date',
        category: 'invalidDate'
      });
      expect(allProblems[1]).toMatchObject({
        type: 'vague_time',
        field: 'time',
        category: 'vagueTime'
      });
    });

    test('isMixedExtraction 應該正確識別混雜提取', () => {
      expect(detector.isMixedExtraction('明天下午8點大提琴課')).toBe(true);
      expect(detector.isMixedExtraction('下午小提琴課')).toBe(true);
      expect(detector.isMixedExtraction('明天大提琴課')).toBe(true);
      expect(detector.isMixedExtraction('大提琴課')).toBe(false);
      expect(detector.isMixedExtraction('')).toBe(false);
      expect(detector.isMixedExtraction(null)).toBe(false);
    });
  });

  describe('智能語義分離測試', () => {
    test('intelligentSlotSeparation 應該正確分離各種格式', () => {
      // 測試日期+時間+課程
      let result = detector.intelligentSlotSeparation('明天下午8點大提琴課');
      expect(result.pureCourse).toBe('大提琴課');
      expect(result.extractedDate).toBe('明天');
      expect(result.extractedTime).toBe('下午');

      // 測試僅時間+課程
      result = detector.intelligentSlotSeparation('下午小提琴課');
      expect(result.pureCourse).toBe('小提琴課');
      expect(result.extractedDate).toBeNull();
      expect(result.extractedTime).toBe('下午');

      // 測試僅日期+課程
      result = detector.intelligentSlotSeparation('明天鋼琴課');
      expect(result.pureCourse).toBe('鋼琴課');
      expect(result.extractedDate).toBe('明天');
      expect(result.extractedTime).toBeNull();
    });

    test('應該提取學生姓名', () => {
      const result = detector.intelligentSlotSeparation('小美大提琴課');
      expect(result.pureCourse).toBe('大提琴課');
      expect(result.extractedStudent).toBe('小美');
    });

    test('不應該誤識別課程名稱為學生', () => {
      const result = detector.intelligentSlotSeparation('大提琴課');
      expect(result.pureCourse).toBe('大提琴課');
      expect(result.extractedStudent).toBeNull();
    });
  });
});