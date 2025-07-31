/**
 * HumanPromptGenerator - 人性化提示訊息生成器
 * 負責根據問題類型生成友善、清晰的用戶提示訊息
 * 
 * 主要功能：
 * 1. 生成多問題提示訊息
 * 2. 生成單一問題提示訊息
 * 3. 提供具體範例和建議
 * 4. 上下文感知提示
 * 
 * v2.0 更新：整合 ConfigManager 統一配置管理
 */

const { getConfigManager } = require('../config/configManager');

// 🎯 第一性原則：統一配置管理，移除硬編碼
// 保留舊版配置作為預設值，確保向後兼容
const LEGACY_PROMPT_TEMPLATES = {
  MULTI_PROBLEM: {
    prefix: "我需要一些更清楚的資訊才能幫您安排課程：",
    format: "• {problem_description}",
    footer: "請重新完整輸入課程資訊，例如：「{example}」"
  },
  
  SINGLE_PROBLEM: {
    confirmation: "✅ 已記錄：{confirmed_info}",
    question: "🕐 還需要確認：{missing_info}",
    example: "例如可以回覆：{example}"
  },

  MIXED_EXTRACTION: {
    prefix: "我已智能分離您的輸入內容：",
    separated_info: "• {field_name}：{value}",
    completion: "信息已完整，正在為您安排課程..."
  }
};

const LEGACY_PROBLEM_DESCRIPTIONS = {
  invalid_date: "日期資訊不清楚（「{value}」無法識別為有效日期）",
  vague_time: "時間需要更具體（「{value}」請提供確切時間）",
  missing_required: "缺少{field_name}資訊",
  missing_time: "需要確認上課時間",
  missing_date: "需要確認上課日期",
  missing_course: "需要確認課程名稱",
  missing_student: "需要確認學生姓名",
  format_error: "格式不正確（「{value}」請檢查格式）",
  mixed_extraction: "已智能分離混雜內容"
};

const LEGACY_FIELD_NAMES = {
  course: "課程",
  date: "日期", 
  time: "時間",
  student: "學生",
  teacher: "老師",
  location: "地點"
};

const LEGACY_EXAMPLE_TEMPLATES = {
  complete_course: [
    "明天下午3點小美大提琴課",
    "7月30日晚上7點鋼琴課",
    "後天上午10點小提琴課"
  ],
  time_examples: [
    "下午3點",
    "晚上7點半",
    "19:30",
    "上午10點"
  ],
  date_examples: [
    "明天",
    "後天", 
    "7月30日",
    "2025-07-30"
  ],
  course_examples: [
    "大提琴課",
    "小提琴課",
    "鋼琴課"
  ]
};

/**
 * HumanPromptGenerator - 人性化提示生成器
 */
class HumanPromptGenerator {
  constructor() {
    // 🎯 整合 ConfigManager 統一配置管理
    this.configManager = getConfigManager();
    
    // 加載配置，支援運行時更新
    this.loadConfigurations();
    
    // 設置配置變更監聽
    this.setupConfigListener();
    
    console.log('[HumanPromptGenerator] v2.0 初始化完成 - 使用 ConfigManager');
  }
  
  /**
   * 加載配置（支援 ConfigManager 和舊版兼容）
   */
  loadConfigurations() {
    try {
      // 嘗試從 ConfigManager 加載配置
      const config = this.configManager.get('slotTemplateConfig');
      
      if (config && Object.keys(config).length > 0) {
        // 使用新的配置系統
        this.templates = this.mapConfigToTemplates(config.promptTemplates);
        this.descriptions = this.mapConfigToDescriptions(config.problemDescriptions);
        this.fieldNames = config.fieldNames || LEGACY_FIELD_NAMES;
        this.examples = this.mapConfigToExamples(config.examples);
        
        console.log('[HumanPromptGenerator] 使用 ConfigManager 配置');
      } else {
        // 降級到舊版配置
        this.templates = LEGACY_PROMPT_TEMPLATES;
        this.descriptions = LEGACY_PROBLEM_DESCRIPTIONS;
        this.fieldNames = LEGACY_FIELD_NAMES;
        this.examples = LEGACY_EXAMPLE_TEMPLATES;
        
        console.log('[HumanPromptGenerator] 使用舊版兼容配置');
      }
    } catch (error) {
      console.warn('[HumanPromptGenerator] 配置加載失敗，使用舊版配置:', error);
      
      // 錯誤處理：使用舊版配置
      this.templates = LEGACY_PROMPT_TEMPLATES;
      this.descriptions = LEGACY_PROBLEM_DESCRIPTIONS;
      this.fieldNames = LEGACY_FIELD_NAMES;
      this.examples = LEGACY_EXAMPLE_TEMPLATES;
    }
  }
  
  /**
   * 映射配置到模板格式
   */
  mapConfigToTemplates(promptTemplates) {
    if (!promptTemplates) return LEGACY_PROMPT_TEMPLATES;
    
    return {
      MULTI_PROBLEM: {
        prefix: promptTemplates.multiProblem?.prefix || LEGACY_PROMPT_TEMPLATES.MULTI_PROBLEM.prefix,
        format: promptTemplates.multiProblem?.format || LEGACY_PROMPT_TEMPLATES.MULTI_PROBLEM.format,
        footer: promptTemplates.multiProblem?.footer || LEGACY_PROMPT_TEMPLATES.MULTI_PROBLEM.footer
      },
      SINGLE_PROBLEM: {
        confirmation: promptTemplates.singleProblem?.confirmation || LEGACY_PROMPT_TEMPLATES.SINGLE_PROBLEM.confirmation,
        question: promptTemplates.singleProblem?.question || LEGACY_PROMPT_TEMPLATES.SINGLE_PROBLEM.question,
        example: promptTemplates.singleProblem?.example || LEGACY_PROMPT_TEMPLATES.SINGLE_PROBLEM.example
      },
      MIXED_EXTRACTION: {
        prefix: promptTemplates.mixedExtraction?.prefix || LEGACY_PROMPT_TEMPLATES.MIXED_EXTRACTION.prefix,
        separated_info: promptTemplates.mixedExtraction?.separatedInfo || LEGACY_PROMPT_TEMPLATES.MIXED_EXTRACTION.separated_info,
        completion: promptTemplates.mixedExtraction?.completion || LEGACY_PROMPT_TEMPLATES.MIXED_EXTRACTION.completion
      }
    };
  }
  
  /**
   * 映射配置到問題描述格式
   */
  mapConfigToDescriptions(problemDescriptions) {
    if (!problemDescriptions) return LEGACY_PROBLEM_DESCRIPTIONS;
    
    return {
      invalid_date: problemDescriptions.invalidDate || LEGACY_PROBLEM_DESCRIPTIONS.invalid_date,
      vague_time: problemDescriptions.vagueTime || LEGACY_PROBLEM_DESCRIPTIONS.vague_time,
      missing_required: problemDescriptions.missingRequired || LEGACY_PROBLEM_DESCRIPTIONS.missing_required,
      missing_time: problemDescriptions.missingTime || LEGACY_PROBLEM_DESCRIPTIONS.missing_time,
      missing_date: problemDescriptions.missingDate || LEGACY_PROBLEM_DESCRIPTIONS.missing_date,
      missing_course: problemDescriptions.missingCourse || LEGACY_PROBLEM_DESCRIPTIONS.missing_course,
      missing_student: problemDescriptions.missingStudent || LEGACY_PROBLEM_DESCRIPTIONS.missing_student,
      format_error: problemDescriptions.formatError || LEGACY_PROBLEM_DESCRIPTIONS.format_error,
      mixed_extraction: problemDescriptions.mixedExtraction || LEGACY_PROBLEM_DESCRIPTIONS.mixed_extraction
    };
  }
  
  /**
   * 映射配置到範例格式
   */
  mapConfigToExamples(examples) {
    if (!examples) return LEGACY_EXAMPLE_TEMPLATES;
    
    return {
      complete_course: examples.completeCourse || LEGACY_EXAMPLE_TEMPLATES.complete_course,
      time_examples: examples.timeExamples || LEGACY_EXAMPLE_TEMPLATES.time_examples,
      date_examples: examples.dateExamples || LEGACY_EXAMPLE_TEMPLATES.date_examples,
      course_examples: examples.courseExamples || LEGACY_EXAMPLE_TEMPLATES.course_examples
    };
  }
  
  /**
   * 設置配置變更監聽器
   */
  setupConfigListener() {
    this.configManager.addListener('slotTemplateConfig', (keyPath, newValue, configName) => {
      if (keyPath === '__reload__') {
        console.log('[HumanPromptGenerator] 配置重載，更新模板');
        this.loadConfigurations();
      }
    });
  }

  /**
   * 生成多問題提示訊息
   * @param {Array} problems - 問題列表
   * @param {Object} validSlots - 有效的 slot 資訊
   * @returns {Object} 提示訊息對象
   */
  generateMultiProblemPrompt(problems, validSlots = {}) {
    const problemDescriptions = this.buildProblemDescriptions(problems);
    const example = this.generateExample('complete_course');
    
    const message = [
      this.templates.MULTI_PROBLEM.prefix,
      problemDescriptions.map(desc => this.templates.MULTI_PROBLEM.format.replace('{problem_description}', desc)).join('\n'),
      '',
      this.templates.MULTI_PROBLEM.footer.replace('{example}', example)
    ].join('\n');

    return {
      type: 'multi_problem',
      message,
      problemCount: problems.length,
      suggestions: this.generateSuggestions(problems),
      examples: this.getExamples(problems)
    };
  }

  /**
   * 生成單一問題提示訊息
   * @param {Object} problem - 單一問題
   * @param {Object} validSlots - 有效的 slot 資訊
   * @returns {Object} 提示訊息對象
   */
  generateSingleProblemPrompt(problem, validSlots = {}) {
    const confirmation = this.confirmValidInfo(validSlots);
    const question = this.askMissingInfo(problem);
    const examples = this.getSpecificExamples(problem.type || problem.field);

    const messageParts = [];
    
    if (confirmation) {
      messageParts.push(this.templates.SINGLE_PROBLEM.confirmation.replace('{confirmed_info}', confirmation));
    }
    
    messageParts.push(this.templates.SINGLE_PROBLEM.question.replace('{missing_info}', question));
    
    if (examples.length > 0) {
      const exampleText = examples.slice(0, 3).join('、');
      messageParts.push(this.templates.SINGLE_PROBLEM.example.replace('{example}', exampleText));
    }

    return {
      type: 'single_problem',
      message: messageParts.join('\n'),
      confirmation: confirmation,
      question: question,
      examples: examples,
      problemType: problem.type || problem.field
    };
  }

  /**
   * 生成混雜提取分離提示訊息
   * @param {Object} separationResult - 分離結果
   * @param {boolean} isComplete - 是否完整
   * @returns {Object} 提示訊息對象
   */
  generateMixedExtractionPrompt(separationResult, isComplete = false) {
    const messageParts = [this.templates.MIXED_EXTRACTION.prefix];
    
    // 顯示分離出的各個欄位
    Object.entries(separationResult).forEach(([field, value]) => {
      if (value && field !== 'pureCourse') {
        // 映射特殊的欄位名稱
        let fieldName;
        if (field === 'extractedDate') {
          fieldName = '日期';
        } else if (field === 'extractedTime') {
          fieldName = '時間';
        } else if (field === 'extractedStudent') {
          fieldName = '學生';
        } else {
          fieldName = this.fieldNames[field] || field;
        }
        
        const fieldInfo = this.templates.MIXED_EXTRACTION.separated_info
          .replace('{field_name}', fieldName)
          .replace('{value}', value);
        messageParts.push(fieldInfo);
      }
    });

    // 課程名稱特殊處理
    if (separationResult.pureCourse) {
      const courseInfo = this.templates.MIXED_EXTRACTION.separated_info
        .replace('{field_name}', '課程')
        .replace('{value}', separationResult.pureCourse);
      messageParts.push(courseInfo);
    }

    if (isComplete) {
      messageParts.push('');
      messageParts.push(this.templates.MIXED_EXTRACTION.completion);
    }

    return {
      type: 'mixed_extraction',
      message: messageParts.join('\n'),
      separationResult,
      isComplete
    };
  }

  /**
   * 構建問題描述列表
   * @param {Array} problems - 問題列表
   * @returns {Array} 問題描述字符串數組
   */
  buildProblemDescriptions(problems) {
    const descriptions = [];
    
    problems.forEach(problem => {
      const template = this.descriptions[problem.type];
      if (template) {
        let description = template;
        
        // 替換占位符
        if (problem.value) {
          description = description.replace('{value}', problem.value);
        }
        if (problem.field) {
          const fieldName = this.fieldNames[problem.field] || problem.field;
          description = description.replace('{field_name}', fieldName);
        }
        
        descriptions.push(description);
      } else {
        // 默認描述
        descriptions.push(problem.message || `未知問題：${problem.type}`);
      }
    });
    
    return descriptions;
  }

  /**
   * 確認已收集的有效信息
   * @param {Object} validSlots - 有效的 slot 資訊
   * @returns {string} 確認信息字符串
   */
  confirmValidInfo(validSlots) {
    const confirmedItems = [];
    
    Object.entries(validSlots).forEach(([field, value]) => {
      if (value && value !== '' && value !== null) {
        const fieldName = this.fieldNames[field] || field;
        // 對日期進行友善顯示
        let displayValue = value;
        if (field === 'date' && ['明天', '後天', '今天'].includes(value)) {
          displayValue = value;
        } else if (field === 'time' && value.includes(':')) {
          // 將24小時制轉換為更友善的格式
          const [hour, minute] = value.split(':');
          const hourNum = parseInt(hour);
          if (hourNum >= 12) {
            displayValue = `下午${hourNum > 12 ? hourNum - 12 : hourNum}點${minute !== '00' ? minute + '分' : ''}`;
          } else {
            displayValue = `上午${hourNum}點${minute !== '00' ? minute + '分' : ''}`;
          }
        }
        confirmedItems.push(displayValue);
      }
    });
    
    return confirmedItems.join('、');
  }

  /**
   * 詢問缺失信息
   * @param {Object} problem - 問題對象
   * @returns {string} 詢問信息字符串
   */
  askMissingInfo(problem) {
    const problemType = problem.type || problem.field;
    
    switch (problemType) {
      case 'missing_time':
      case 'vague_time':
        return '上課時間';
      case 'missing_date':
      case 'invalid_date':
        return '上課日期';
      case 'missing_course':
        return '課程名稱';
      case 'missing_student':
        return '學生姓名';
      default:
        const fieldName = this.fieldNames[problem.field] || problem.field;
        return fieldName;
    }
  }

  /**
   * 獲取特定問題類型的範例
   * @param {string} problemType - 問題類型
   * @returns {Array} 範例數組
   */
  getSpecificExamples(problemType) {
    switch (problemType) {
      case 'missing_time':
      case 'vague_time':
      case 'time':
        return [...this.examples.time_examples];
      case 'missing_date':
      case 'invalid_date':
      case 'date':
        return [...this.examples.date_examples];
      case 'missing_course':
      case 'course':
        return [...this.examples.course_examples];
      default:
        return [];
    }
  }

  /**
   * 生成建議
   * @param {Array} problems - 問題列表
   * @returns {Array} 建議數組
   */
  generateSuggestions(problems) {
    const suggestions = [];
    
    problems.forEach(problem => {
      switch (problem.type) {
        case 'invalid_date':
          suggestions.push('請使用「明天」、「後天」或具體日期如「7月30日」');
          break;
        case 'vague_time':
          suggestions.push('請提供具體時間，如「下午3點」、「19:30」');
          break;
        case 'missing_required':
          suggestions.push(`請包含${this.fieldNames[problem.field]}信息`);
          break;
      }
    });
    
    return [...new Set(suggestions)]; // 去重
  }

  /**
   * 獲取問題相關範例
   * @param {Array} problems - 問題列表  
   * @returns {Array} 範例數組
   */
  getExamples(problems) {
    // 總是返回完整課程範例
    return [...this.examples.complete_course];
  }

  /**
   * 生成隨機範例
   * @param {string} type - 範例類型
   * @returns {string} 隨機範例
   */
  generateExample(type) {
    const examples = this.examples[type] || this.examples.complete_course;
    const randomIndex = Math.floor(Math.random() * examples.length);
    return examples[randomIndex];
  }

  /**
   * 格式化顯示時間
   * @param {string} timeValue - 時間值
   * @returns {string} 格式化後的時間
   */
  formatDisplayTime(timeValue) {
    if (!timeValue) return timeValue;
    
    // 處理 HH:MM 格式
    if (timeValue.includes(':')) {
      const [hour, minute] = timeValue.split(':');
      const hourNum = parseInt(hour);
      const period = hourNum >= 12 ? '下午' : '上午';
      const displayHour = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
      return `${period}${displayHour}點${minute !== '00' ? minute + '分' : ''}`;
    }
    
    return timeValue;
  }

  /**
   * 格式化顯示日期
   * @param {string} dateValue - 日期值  
   * @returns {string} 格式化後的日期
   */
  formatDisplayDate(dateValue) {
    if (!dateValue) return dateValue;
    
    // 相對日期直接返回
    if (['今天', '明天', '後天', '昨天', '前天'].includes(dateValue)) {
      return dateValue;
    }
    
    // ISO 日期格式轉換
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateValue.split('-');
      return `${parseInt(month)}月${parseInt(day)}日`;
    }
    
    return dateValue;
  }
}

module.exports = HumanPromptGenerator;