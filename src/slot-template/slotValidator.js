/**
 * Slot Validator
 * 負責驗證 slot 狀態和檢查完成度
 * 
 * 功能:
 * - 驗證核心邏輯
 * - 完成度檢查機制
 * - 進階驗證功能
 * - 跨 slot 關聯驗證
 */

const { getTemplateLoader } = require('./templateLoader');

class SlotValidator {
  constructor() {
    this.templateLoader = getTemplateLoader();
    
    // 驗證規則配置
    this.validationRules = {
      string: {
        min_length: 1,
        max_length: 1000,
        trim: true
      },
      number: {
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      },
      date: {
        format: /^\d{4}-\d{2}-\d{2}$/,
        future_only: false
      },
      time: {
        format: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        range: ['00:00', '23:59']
      },
      object: {
        required_fields: []
      }
    };

    // 統計資訊
    this.stats = {
      validationCalls: 0,
      validationErrors: 0,
      completionChecks: 0,
      incompleteSlots: 0
    };
  }

  /**
   * 驗證 slot 狀態和完成度
   * @param {Object} userState - 用戶狀態
   * @param {string} intent - 當前意圖
   * @returns {Promise<Object>} 驗證結果
   */
  async validate(userState, intent) {
    this.stats.validationCalls++;
    
    try {
      console.log(`[SlotValidator] 開始驗證 - 意圖: ${intent}`);

      // 1. 載入對應的模板
      const template = await this.templateLoader.getTemplateByIntent(intent);
      
      if (!userState.active_task) {
        throw new Error('沒有活動任務需要驗證');
      }

      const { slot_state } = userState.active_task;

      // 2. 驗證個別 slot 值
      const slotValidations = await this.validateIndividualSlots(slot_state, template);
      
      // 3. 檢查完成度
      const completionResult = this.checkCompletion(slot_state, template);
      
      // 4. 進階驗證 (跨 slot 關聯)
      const advancedValidations = this.performAdvancedValidations(slot_state, template);
      
      // 5. 計算完成度評分
      const completionScore = this.calculateCompletionScore(slot_state, template);

      // 6. 整合驗證結果
      const allValidationErrors = [
        ...slotValidations.filter(v => !v.isValid),
        ...advancedValidations.filter(v => !v.isValid)
      ];

      const result = {
        isValid: allValidationErrors.length === 0,
        isComplete: completionResult.isComplete,
        slotState: slot_state,
        missingSlots: completionResult.missingSlots,
        completionScore,
        templateId: template.template_id,
        validationErrors: allValidationErrors,
        recommendations: this.generateRecommendations(completionResult, allValidationErrors),
        timestamp: new Date().toISOString()
      };

      if (!result.isValid) {
        this.stats.validationErrors++;
      }

      if (!result.isComplete) {
        this.stats.incompleteSlots += completionResult.missingSlots.length;
      }

      this.stats.completionChecks++;

      console.log(`[SlotValidator] 驗證完成 - 有效: ${result.isValid}, 完整: ${result.isComplete}, 評分: ${result.completionScore}`);
      
      return result;

    } catch (error) {
      console.error(`[SlotValidator] 驗證過程發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 驗證個別 slot 值
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板定義
   * @returns {Promise<Array>} 驗證結果陣列
   */
  async validateIndividualSlots(slotState, template) {
    const validations = [];

    for (const [slotName, slotConfig] of Object.entries(template.slots)) {
      const value = slotState[slotName];
      const validation = this.validateSingleSlot(slotName, value, slotConfig);
      validations.push(validation);
    }

    return validations;
  }

  /**
   * 驗證單個 slot 值
   * @param {string} slotName - Slot 名稱
   * @param {*} value - Slot 值
   * @param {Object} slotConfig - Slot 配置
   * @returns {Object} 驗證結果
   */
  validateSingleSlot(slotName, value, slotConfig) {
    const validation = {
      slot: slotName,
      value: value,
      isValid: true,
      errors: [],
      warnings: []
    };

    // 檢查必填項
    if (slotConfig.required && this.isEmpty(value)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'REQUIRED_FIELD',
        message: `${slotConfig.description || slotName} 為必填項目`
      });
      return validation;
    }

    // 如果值為空且非必填，跳過其他驗證
    if (this.isEmpty(value)) {
      return validation;
    }

    // 根據類型進行驗證
    switch (slotConfig.type) {
      case 'string':
        this.validateStringType(value, slotConfig, validation);
        break;
      case 'number':
        this.validateNumberType(value, slotConfig, validation);
        break;
      case 'date':
        this.validateDateType(value, slotConfig, validation);
        break;
      case 'time':
        this.validateTimeType(value, slotConfig, validation);
        break;
      case 'object':
        this.validateObjectType(value, slotConfig, validation);
        break;
      default:
        validation.warnings.push({
          code: 'UNKNOWN_TYPE',
          message: `未知的資料類型: ${slotConfig.type}`
        });
    }

    return validation;
  }

  /**
   * 驗證字串類型
   */
  validateStringType(value, slotConfig, validation) {
    if (typeof value !== 'string') {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_TYPE',
        message: '必須為字串類型'
      });
      return;
    }

    const config = { ...this.validationRules.string, ...slotConfig.validation };
    
    if (config.trim) {
      value = value.trim();
    }

    if (config.min_length && value.length < config.min_length) {
      validation.isValid = false;
      validation.errors.push({
        code: 'MIN_LENGTH',
        message: `長度不得少於 ${config.min_length} 字元`
      });
    }

    if (config.max_length && value.length > config.max_length) {
      validation.isValid = false;
      validation.errors.push({
        code: 'MAX_LENGTH',
        message: `長度不得超過 ${config.max_length} 字元`
      });
    }

    if (config.pattern && !new RegExp(config.pattern).test(value)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'PATTERN_MISMATCH',
        message: '格式不符合要求'
      });
    }
  }

  /**
   * 驗證數字類型
   */
  validateNumberType(value, slotConfig, validation) {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_NUMBER',
        message: '必須為有效的數字'
      });
      return;
    }

    const config = { ...this.validationRules.number, ...slotConfig.validation };

    if (config.min !== undefined && numValue < config.min) {
      validation.isValid = false;
      validation.errors.push({
        code: 'MIN_VALUE',
        message: `數值不得小於 ${config.min}`
      });
    }

    if (config.max !== undefined && numValue > config.max) {
      validation.isValid = false;
      validation.errors.push({
        code: 'MAX_VALUE',
        message: `數值不得大於 ${config.max}`
      });
    }
  }

  /**
   * 驗證日期類型
   */
  validateDateType(value, slotConfig, validation) {
    const config = { ...this.validationRules.date, ...slotConfig.validation };
    
    if (!config.format.test(value)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_DATE_FORMAT',
        message: '日期格式必須為 YYYY-MM-DD'
      });
      return;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_DATE',
        message: '無效的日期'
      });
      return;
    }

    if (config.future_only && date <= new Date()) {
      validation.isValid = false;
      validation.errors.push({
        code: 'DATE_MUST_BE_FUTURE',
        message: '日期必須為未來時間'
      });
    }
  }

  /**
   * 驗證時間類型
   */
  validateTimeType(value, slotConfig, validation) {
    const config = { ...this.validationRules.time, ...slotConfig.validation };
    
    if (!config.format.test(value)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_TIME_FORMAT',
        message: '時間格式必須為 HH:mm'
      });
      return;
    }

    if (config.range) {
      const [minTime, maxTime] = config.range;
      if (value < minTime || value > maxTime) {
        validation.isValid = false;
        validation.errors.push({
          code: 'TIME_OUT_OF_RANGE',
          message: `時間必須在 ${minTime} 到 ${maxTime} 之間`
        });
      }
    }
  }

  /**
   * 驗證物件類型
   */
  validateObjectType(value, slotConfig, validation) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      validation.isValid = false;
      validation.errors.push({
        code: 'INVALID_OBJECT',
        message: '必須為物件類型'
      });
      return;
    }

    const config = { ...this.validationRules.object, ...slotConfig.validation };
    
    if (config.required_fields && config.required_fields.length > 0) {
      for (const field of config.required_fields) {
        if (!(field in value) || this.isEmpty(value[field])) {
          validation.isValid = false;
          validation.errors.push({
            code: 'MISSING_REQUIRED_FIELD',
            message: `缺少必填欄位: ${field}`
          });
        }
      }
    }
  }

  /**
   * 檢查任務完成度
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板定義
   * @returns {Object} 完成度檢查結果
   */
  checkCompletion(slotState, template) {
    const { completion_rules } = template;
    const missingSlots = [];

    // 檢查必填 slots
    for (const slotName of completion_rules.minimum_required) {
      const value = slotState[slotName];
      if (this.isEmpty(value)) {
        missingSlots.push({
          slot: slotName,
          type: 'required',
          description: template.slots[slotName]?.description || slotName,
          priority: 'high'
        });
      }
    }

    // 檢查條件必填 slots
    if (completion_rules.conditional_required) {
      for (const [condition, conditionalSlots] of Object.entries(completion_rules.conditional_required)) {
        if (this.evaluateCondition(condition, slotState)) {
          for (const slotName of conditionalSlots) {
            const value = this.getNestedValue(slotState, slotName);
            if (this.isEmpty(value)) {
              missingSlots.push({
                slot: slotName,
                type: 'conditional',
                condition: condition,
                description: template.slots[slotName.split('.')[0]]?.description || slotName,
                priority: 'medium'
              });
            }
          }
        }
      }
    }

    return {
      isComplete: missingSlots.length === 0,
      missingSlots: this.prioritizeMissingSlots(missingSlots)
    };
  }

  /**
   * 執行進階驗證
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板定義
   * @returns {Array} 進階驗證結果
   */
  performAdvancedValidations(slotState, template) {
    const validations = [];

    // 檢查日期時間一致性
    if (slotState.date && slotState.time) {
      const validation = this.validateDateTimeConsistency(slotState.date, slotState.time);
      if (validation) {
        validations.push(validation);
      }
    }

    // 檢查重複設定邏輯性
    if (slotState.repeat && slotState.date) {
      const validation = this.validateRepeatLogic(slotState.repeat, slotState.date);
      if (validation) {
        validations.push(validation);
      }
    }

    return validations;
  }

  /**
   * 驗證日期時間一致性
   */
  validateDateTimeConsistency(date, time) {
    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const now = new Date();
      
      if (dateTime <= now) {
        return {
          slot: 'date_time',
          isValid: false,
          errors: [{
            code: 'DATETIME_IN_PAST',
            message: '課程時間不能安排在過去'
          }]
        };
      }
    } catch (error) {
      return {
        slot: 'date_time',
        isValid: false,
        errors: [{
          code: 'INVALID_DATETIME',
          message: '日期時間組合無效'
        }]
      };
    }

    return null;
  }

  /**
   * 驗證重複邏輯
   */
  validateRepeatLogic(repeat, date) {
    if (!repeat || !repeat.pattern) {
      return null;
    }

    // 檢查重複模式的合理性
    if (repeat.pattern === 'daily' && repeat.frequency > 7) {
      return {
        slot: 'repeat',
        isValid: false,
        errors: [{
          code: 'INVALID_REPEAT_FREQUENCY',
          message: '每日重複的頻率不應超過7天'
        }]
      };
    }

    return null;
  }

  /**
   * 計算完成度評分
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板定義
   * @returns {number} 完成度評分 (0-1)
   */
  calculateCompletionScore(slotState, template) {
    const allSlots = Object.keys(template.slots);
    const requiredSlots = template.completion_rules.minimum_required;
    const optionalSlots = allSlots.filter(slot => !requiredSlots.includes(slot));

    let score = 0;
    let totalWeight = 0;

    // 必填項權重較高
    const requiredWeight = 0.8;
    const optionalWeight = 0.2;

    // 計算必填項得分
    if (requiredSlots.length > 0) {
      const filledRequired = requiredSlots.filter(slot => !this.isEmpty(slotState[slot]));
      score += (filledRequired.length / requiredSlots.length) * requiredWeight;
      totalWeight += requiredWeight;
    }

    // 計算選填項得分
    if (optionalSlots.length > 0) {
      const filledOptional = optionalSlots.filter(slot => !this.isEmpty(slotState[slot]));
      score += (filledOptional.length / optionalSlots.length) * optionalWeight;
      totalWeight += optionalWeight;
    }

    return totalWeight > 0 ? Math.round((score / totalWeight) * 100) / 100 : 0;
  }

  /**
   * 生成建議
   * @param {Object} completionResult - 完成度結果
   * @param {Array} validationErrors - 驗證錯誤
   * @returns {Array} 建議列表
   */
  generateRecommendations(completionResult, validationErrors) {
    const recommendations = [];

    // 基於缺失 slots 的建議
    if (completionResult.missingSlots.length > 0) {
      const nextSlot = completionResult.missingSlots[0];
      recommendations.push({
        type: 'missing_slot',
        priority: nextSlot.priority,
        message: `請提供 ${nextSlot.description}`,
        slot: nextSlot.slot,
        action: 'provide_value'
      });
    }

    // 基於驗證錯誤的建議
    for (const error of validationErrors) {
      if (error.errors.length > 0) {
        recommendations.push({
          type: 'validation_error',
          priority: 'high',
          message: `${error.slot}: ${error.errors[0].message}`,
          slot: error.slot,
          action: 'fix_value'
        });
      }
    }

    return recommendations;
  }

  /**
   * 排序缺失的 slots 優先級
   * @param {Array} missingSlots - 缺失的 slots
   * @returns {Array} 排序後的 slots
   */
  prioritizeMissingSlots(missingSlots) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return missingSlots.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // 相同優先級按類型排序：required > conditional
      if (a.type !== b.type) {
        return a.type === 'required' ? -1 : 1;
      }
      
      return 0;
    });
  }

  /**
   * 檢查值是否為空
   * @param {*} value - 要檢查的值
   * @returns {boolean} 是否為空
   */
  isEmpty(value) {
    return value === null || 
           value === undefined || 
           value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  }

  /**
   * 評估條件表達式
   * @param {string} condition - 條件表達式
   * @param {Object} slotState - Slot 狀態
   * @returns {boolean} 條件是否成立
   */
  evaluateCondition(condition, slotState) {
    // 簡單的條件評估，實際應用中可能需要更複雜的表達式解析
    const parts = condition.split('=');
    if (parts.length === 2) {
      const [field, expectedValue] = parts.map(p => p.trim());
      const actualValue = this.getNestedValue(slotState, field);
      return actualValue === expectedValue;
    }
    return false;
  }

  /**
   * 獲取嵌套物件的值
   * @param {Object} obj - 物件
   * @param {string} path - 路徑 (如 'repeat.pattern')
   * @returns {*} 值
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      errorRate: this.stats.validationCalls > 0 
        ? this.stats.validationErrors / this.stats.validationCalls 
        : 0,
      averageIncompleteSlots: this.stats.completionChecks > 0
        ? this.stats.incompleteSlots / this.stats.completionChecks
        : 0
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      validationCalls: 0,
      validationErrors: 0,
      completionChecks: 0,
      incompleteSlots: 0
    };
    console.log('[SlotValidator] 統計資訊已重置');
  }

  // 🚨 Multi-Turn Dialog Enhancement - 新增方法

  /**
   * 🚨 帶問題檢測的驗證 (任務 5.2.1)
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板配置
   * @returns {Array} 問題列表
   */
  validateWithProblemDetection(slotState, template) {
    const problems = [];
    
    // 檢查必填欄位 (任務 5.2.2)
    if (template.completion_rules && template.completion_rules.minimum_required) {
      for (const required of template.completion_rules.minimum_required) {
        if (!slotState[required] || slotState[required] === null || slotState[required] === '') {
          problems.push({
            type: 'missing_required',
            field: required,
            severity: 'high',
            message: `缺少必填欄位「${required}」`
          });
        }
      }
    }
    
    // 檢查欄位品質 (任務 5.2.3)
    problems.push(...this.validateFieldQuality(slotState, template));
    
    return problems;
  }

  /**
   * 🚨 欄位品質驗證 (任務 5.2.3)
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板配置
   * @returns {Array} 品質問題列表
   */
  validateFieldQuality(slotState, template) {
    const problems = [];
    const validationRules = template.completion_rules?.validation_rules || {};
    
    // 檢查日期品質
    if (slotState.date && validationRules.date) {
      const dateProblems = this.validateDateQuality(slotState.date, validationRules.date);
      problems.push(...dateProblems);
    }
    
    // 檢查時間品質
    if (slotState.time && validationRules.time) {
      const timeProblems = this.validateTimeQuality(slotState.time, validationRules.time);
      problems.push(...timeProblems);
    }
    
    // 檢查課程名稱混雜提取
    if (slotState.course && validationRules.course) {
      const courseProblems = this.validateCourseQuality(slotState.course, validationRules.course);
      problems.push(...courseProblems);
    }
    
    return problems;
  }

  /**
   * 驗證日期品質
   * @param {string} dateValue - 日期值
   * @param {Object} rules - 驗證規則
   * @returns {Array} 日期問題列表
   */
  validateDateQuality(dateValue, rules) {
    const problems = [];
    
    if (!dateValue) return problems;
    
    // 檢查無效日期模式
    if (rules.invalid_patterns) {
      for (const pattern of rules.invalid_patterns) {
        if (dateValue.includes(pattern)) {
          problems.push({
            type: 'invalid_date',
            field: 'date',
            value: dateValue,
            severity: 'high',
            message: `日期「${dateValue}」包含無效模式「${pattern}」`
          });
          break; // 只報告第一個匹配的無效模式
        }
      }
    }
    
    return problems;
  }

  /**
   * 驗證時間品質
   * @param {string} timeValue - 時間值
   * @param {Object} rules - 驗證規則
   * @returns {Array} 時間問題列表
   */
  validateTimeQuality(timeValue, rules) {
    const problems = [];
    
    if (!timeValue) return problems;
    
    // 檢查模糊時間
    if (rules.vague_patterns && rules.require_specific) {
      for (const pattern of rules.vague_patterns) {
        if (timeValue.includes(pattern)) {
          problems.push({
            type: 'vague_time',
            field: 'time',
            value: timeValue,
            severity: 'medium',
            message: `時間「${timeValue}」過於模糊，需要具體時間`
          });
          break; // 只報告第一個匹配的模糊模式
        }
      }
    }
    
    return problems;
  }

  /**
   * 驗證課程品質（檢測混雜提取）
   * @param {string} courseValue - 課程值
   * @param {Object} rules - 驗證規則
   * @returns {Array} 課程問題列表
   */
  validateCourseQuality(courseValue, rules) {
    const problems = [];
    
    if (!courseValue || !rules.mixed_extraction_patterns) return problems;
    
    // 檢查混雜提取模式
    const patterns = rules.mixed_extraction_patterns;
    
    if (patterns.date_time_mixed) {
      const regex = new RegExp(patterns.date_time_mixed);
      if (regex.test(courseValue)) {
        problems.push({
          type: 'mixed_extraction',
          field: 'course',
          value: courseValue,
          mixedType: 'date_time_mixed',
          severity: 'high',
          message: '課程名稱包含日期和時間信息需要分離'
        });
        return problems; // 優先報告複合混雜
      }
    }
    
    if (patterns.date_mixed) {
      const regex = new RegExp(patterns.date_mixed);
      if (regex.test(courseValue)) {
        problems.push({
          type: 'mixed_extraction',
          field: 'course',
          value: courseValue,
          mixedType: 'date_mixed',
          severity: 'high',
          message: '課程名稱包含日期信息需要分離'
        });
        return problems;
      }
    }
    
    if (patterns.time_mixed) {
      const regex = new RegExp(patterns.time_mixed);
      if (regex.test(courseValue)) {
        problems.push({
          type: 'mixed_extraction',
          field: 'course',
          value: courseValue,
          mixedType: 'time_mixed',
          severity: 'high',
          message: '課程名稱包含時間信息需要分離'
        });
      }
    }
    
    return problems;
  }

  /**
   * 檢查是否符合完成條件（考慮動態必填欄位）
   * @param {Object} slotState - Slot 狀態
   * @param {Object} template - 模板配置
   * @returns {boolean} 是否完成
   */
  isCompleteWithDynamicRules(slotState, template) {
    if (!template.completion_rules) return false;
    
    const { minimum_required, future_required } = template.completion_rules;
    
    // 檢查當前必填欄位
    if (minimum_required) {
      for (const field of minimum_required) {
        if (!slotState[field] || slotState[field] === null || slotState[field] === '') {
          return false;
        }
      }
    }
    
    // 未來版本可以加入 future_required 檢查
    // 目前 future_required 字段暫不做強制要求
    
    return true;
  }
}

module.exports = SlotValidator;