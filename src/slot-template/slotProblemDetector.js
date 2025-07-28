/**
 * Slot Problem Detector - 多輪對話增強補丁
 * 負責檢測 slot 填充中的各種問題類型，包括混雜提取問題
 * 
 * 主要功能：
 * 1. 檢測無效日期格式
 * 2. 檢測模糊時間表達
 * 3. 檢測缺失必填欄位
 * 4. 🚨 檢測混雜提取問題（新增）
 * 5. 智能分離混雜的 slot 內容
 */

const TimeService = require('../services/timeService');

/**
 * 問題類型定義
 */
const PROBLEM_TYPES = {
  INVALID_DATE: {
    code: 'invalid_date',
    severity: 'high',
    examples: ['後台', '昨天的明天', '不知道', '前台', '那邊', '這裡']
  },
  VAGUE_TIME: {
    code: 'vague_time', 
    severity: 'medium',
    examples: ['下午', '晚上', '早上', '中午', '傍晚']
  },
  MISSING_REQUIRED: {
    code: 'missing_required',
    severity: 'high',
    fields: ['course', 'date', 'time'] // 未來可加入 'student'
  },
  MIXED_EXTRACTION: {  // 🚨 新增問題類型
    code: 'mixed_extraction',
    severity: 'high',
    description: '課程名稱包含時間、日期或角色信息，需要智能分離',
    patterns: {
      timeInCourse: /.*[0-9]+點.*課$|.*[下晚早中]午.*課$/,
      dateInCourse: /.*[明後今]天.*課$|.*昨天.*課$/,
      mixedContent: /.*[明後今昨]天.*[0-9]+點.*課$|.*[明後今昨]天.*[下晚早中]午.*課$/,
      timeOnly: /^[下晚早中]午.*課$/,
      dateOnly: /^[明後今昨]天.*課$/
    }
  },
  FORMAT_ERROR: {
    code: 'format_error',
    severity: 'medium'
  },
  AMBIGUOUS_VALUE: {
    code: 'ambiguous_value',
    severity: 'medium'
  }
};

/**
 * SlotProblemDetector - 智能問題檢測器
 */
class SlotProblemDetector {
  constructor() {
    this.timeService = new TimeService();
  }

  /**
   * 檢測 slot 填充中的各種問題
   * @param {Object} slotState - 當前 slot 狀態
   * @param {Object} template - Slot 模板定義
   * @returns {Object} 檢測結果包含各類問題
   */
  detectProblems(slotState, template) {
    const problems = {
      invalidDate: [],      // 無效日期格式
      vagueTime: [],        // 模糊時間表達
      missingRequired: [],  // 缺失必填欄位
      formatErrors: [],     // 格式錯誤
      ambiguousValues: [],  // 歧義值
      mixedExtraction: []   // 🚨 混雜提取問題
    };

    // 檢測混雜提取問題 (優先處理)
    const mixedProblems = this.detectMixedExtraction(slotState);
    if (mixedProblems.length > 0) {
      problems.mixedExtraction = mixedProblems;
    }

    // 檢測日期問題
    if (slotState.date) {
      const dateProblems = this.detectDateProblems(slotState.date);
      problems.invalidDate = dateProblems;
    }

    // 檢測時間問題
    if (slotState.time) {
      const timeProblems = this.detectTimeProblems(slotState.time);
      problems.vagueTime = timeProblems;
    }

    // 檢測必填欄位缺失
    if (template && template.completion_rules) {
      const missingProblems = this.detectMissingRequired(slotState, template.completion_rules);
      problems.missingRequired = missingProblems;
    }

    return problems;
  }

  /**
   * 🚨 檢測混雜提取問題
   * @param {Object} slotState 
   * @returns {Array} 混雜提取問題列表
   */
  detectMixedExtraction(slotState) {
    const problems = [];
    
    if (!slotState.course) {
      return problems;
    }

    const course = slotState.course;
    const patterns = PROBLEM_TYPES.MIXED_EXTRACTION.patterns;

    // 檢測各種混雜模式
    if (patterns.mixedContent.test(course)) {
      problems.push({
        type: 'mixed_extraction',
        field: 'course',
        value: course,
        mixedType: 'date_time_mixed',
        message: '課程名稱包含日期和時間信息需要分離',
        severity: 'high'
      });
    } else if (patterns.dateInCourse.test(course)) {
      problems.push({
        type: 'mixed_extraction',
        field: 'course',
        value: course,
        mixedType: 'date_mixed',
        message: '課程名稱包含日期信息需要分離',
        severity: 'high'
      });
    } else if (patterns.timeInCourse.test(course)) {
      problems.push({
        type: 'mixed_extraction',
        field: 'course',
        value: course,
        mixedType: 'time_mixed',
        message: '課程名稱包含時間信息需要分離',
        severity: 'high'
      });
    }

    return problems;
  }

  /**
   * 檢測日期問題
   * @param {string} dateValue 
   * @returns {Array} 日期問題列表
   */
  detectDateProblems(dateValue) {
    const problems = [];
    
    if (!dateValue) {
      return problems;
    }

    // 檢查是否為無效日期格式
    const invalidPatterns = PROBLEM_TYPES.INVALID_DATE.examples;
    if (invalidPatterns.includes(dateValue)) {
      problems.push({
        type: 'invalid_date',
        field: 'date',
        value: dateValue,
        message: `「${dateValue}」不是有效的日期格式`,
        severity: 'high'
      });
    }

    return problems;
  }

  /**
   * 檢測時間問題
   * @param {string} timeValue 
   * @returns {Array} 時間問題列表
   */
  detectTimeProblems(timeValue) {
    const problems = [];
    
    if (!timeValue) {
      return problems;
    }

    // 檢查是否為模糊時間
    const vagueTimePatterns = PROBLEM_TYPES.VAGUE_TIME.examples;
    const isVague = vagueTimePatterns.some(pattern => timeValue.includes(pattern));
    
    if (isVague) {
      problems.push({
        type: 'vague_time',
        field: 'time',
        value: timeValue,
        message: `時間「${timeValue}」過於模糊，需要提供具體時間`,
        severity: 'medium'
      });
    }

    // 檢查時間格式
    const timePattern = /^([0-9]{1,2}):([0-9]{2})$|^([0-9]{1,2})點([0-9]{0,2})分?$/;
    if (!timePattern.test(timeValue) && !isVague) {
      problems.push({
        type: 'format_error',
        field: 'time',
        value: timeValue,
        message: `時間格式不正確「${timeValue}」`,
        severity: 'medium'
      });
    }

    return problems;
  }

  /**
   * 檢測必填欄位缺失
   * @param {Object} slotState 
   * @param {Object} completionRules 
   * @returns {Array} 缺失欄位問題列表
   */
  detectMissingRequired(slotState, completionRules) {
    const problems = [];
    
    if (!completionRules.minimum_required) {
      return problems;
    }

    for (const requiredField of completionRules.minimum_required) {
      if (!slotState[requiredField] || slotState[requiredField] === null || slotState[requiredField] === '') {
        problems.push({
          type: 'missing_required',
          field: requiredField,
          message: `缺少必填欄位「${requiredField}」`,
          severity: 'high'
        });
      }
    }

    return problems;
  }

  /**
   * 🚨 智能分離混雜的 slot 內容
   * @param {Object} slotState - 當前 slot 狀態
   * @returns {Object} 分離後的 slot 狀態
   */
  separateMixedSlots(slotState) {
    const separated = { ...slotState };
    
    // 檢查課程名稱是否包含時間/日期/角色信息
    if (separated.course && this.isMixedExtraction(separated.course)) {
      const separationResult = this.intelligentSlotSeparation(separated.course);
      
      // 合併分離結果
      if (separationResult.pureCourse) {
        separated.course = separationResult.pureCourse;
      }
      if (separationResult.extractedDate && !separated.date) {
        separated.date = separationResult.extractedDate;
      }
      if (separationResult.extractedTime && !separated.time) {
        separated.time = separationResult.extractedTime;
      }
      if (separationResult.extractedStudent && !separated.student) {
        separated.student = separationResult.extractedStudent;
      }
    }
    
    return separated;
  }

  /**
   * 檢查是否為混雜提取
   * @param {string} courseValue 
   * @returns {boolean}
   */
  isMixedExtraction(courseValue) {
    if (!courseValue) return false;
    
    const patterns = PROBLEM_TYPES.MIXED_EXTRACTION.patterns;
    return patterns.mixedContent.test(courseValue) || 
           patterns.dateInCourse.test(courseValue) || 
           patterns.timeInCourse.test(courseValue);
  }

  /**
   * 🚨 智能語義分離核心邏輯
   * @param {string} mixedCourse - 混雜的課程內容
   * @returns {Object} 分離結果
   */
  intelligentSlotSeparation(mixedCourse) {
    const result = {
      pureCourse: mixedCourse,
      extractedDate: null,
      extractedTime: null,
      extractedStudent: null
    };

    let workingText = mixedCourse;

    // 1. 先提取日期信息
    const dateMatches = workingText.match(/([明後今昨]天)/);
    if (dateMatches) {
      result.extractedDate = dateMatches[1];
      workingText = workingText.replace(dateMatches[1], '').trim();
    }

    // 2. 提取時間信息 - 處理複合時間（如"下午8點"）
    // 先處理具體時間 + 模糊時間的組合
    const compositeTimeMatches = workingText.match(/([下晚早中]午)([0-9]+點[0-9]*分?)/);
    if (compositeTimeMatches) {
      // 對於複合時間，優先保留模糊時間部分（更符合一般表達習慣）
      result.extractedTime = compositeTimeMatches[1]; // 例如："下午"
      workingText = workingText.replace(compositeTimeMatches[0], '').trim();
    } else {
      // 處理單純的具體時間
      const specificTimeMatches = workingText.match(/([0-9]+點[0-9]*分?)/);
      if (specificTimeMatches) {
        result.extractedTime = specificTimeMatches[1];
        workingText = workingText.replace(specificTimeMatches[1], '').trim();
      } else {
        // 處理單純的模糊時間
        const vagueTimeMatches = workingText.match(/([下晚早中]午)/);
        if (vagueTimeMatches) {
          result.extractedTime = vagueTimeMatches[1];
          workingText = workingText.replace(vagueTimeMatches[1], '').trim();
        }
      }
    }

    // 3. 提取學生姓名（只處理明確的姓名+課程組合）
    // 僅處理學生姓名為2字符且後跟明確課程名稱的情況
    const studentMatches = workingText.match(/^([^\s\d]{2})([^\s]{2,}課)$/);
    if (studentMatches && studentMatches[1] && studentMatches[2]) {
      const potentialStudent = studentMatches[1];
      const coursePart = studentMatches[2];
      
      // 限制條件：
      // 1. 學生姓名正好2字符
      // 2. 課程部分至少3字符（如"大提琴課"）
      // 3. 課程不能是常見的樂器前綴（防止把"大提"當作學生名）
      const isValidStudentName = potentialStudent.length === 2;
      const isValidCourse = coursePart.length >= 3;
      const isNotInstrumentPrefix不是樂器前綴 = !['大提', '小提', '鋼琴', '古箏', '二胡'].includes(potentialStudent);
      
      // 只有明確符合人名特徵才提取
      if (isValidStudentName && isValidCourse && isNotInstrumentPrefix不是樂器前綴) {
        result.extractedStudent = potentialStudent;
        result.pureCourse = coursePart;
      } else {
        result.pureCourse = workingText;
      }
    } else {
      result.pureCourse = workingText;
    }

    return result;
  }

  /**
   * 計算問題總數
   * @param {Object} problems 
   * @returns {number}
   */
  countProblems(problems) {
    let count = 0;
    
    // 計算所有問題類型的總數
    Object.values(problems).forEach(problemList => {
      if (Array.isArray(problemList)) {
        count += problemList.length;
      }
    });

    return count;
  }

  /**
   * 獲取所有問題的統一格式
   * @param {Object} problems 
   * @returns {Array} 統一格式的問題列表
   */
  getAllProblems(problems) {
    const allProblems = [];
    
    Object.entries(problems).forEach(([category, problemList]) => {
      if (Array.isArray(problemList)) {
        problemList.forEach(problem => {
          allProblems.push({
            ...problem,
            category
          });
        });
      }
    });

    return allProblems;
  }
}

module.exports = SlotProblemDetector;