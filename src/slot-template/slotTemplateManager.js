/**
 * Slot Template Manager
 * 主控制器，協調所有 Phase 2 完成的核心組件
 * 
 * 功能:
 * - 主要流程協調
 * - 對話管理功能
 * - 整合現有系統
 * - 錯誤處理和恢復
 * - 效能監控埋點
 */

const SlotStateManager = require('./slotStateManager');
const SlotMerger = require('./slotMerger');
const SlotValidator = require('./slotValidator');
const TaskTrigger = require('./taskTrigger');
const { getTemplateLoader } = require('./templateLoader');
// 🚨 Multi-Turn Dialog Enhancement - 新增組件
const SlotProblemDetector = require('./slotProblemDetector');
const TempSlotStateManager = require('./tempSlotStateManager');
const HumanPromptGenerator = require('./humanPromptGenerator');

class SlotTemplateManager {
  constructor() {
    this.slotStateManager = new SlotStateManager();
    this.slotMerger = new SlotMerger();
    this.slotValidator = new SlotValidator();
    this.taskTrigger = new TaskTrigger();
    this.templateLoader = getTemplateLoader();
    
    // 🚨 Multi-Turn Dialog Enhancement - 新增組件
    this.problemDetector = new SlotProblemDetector();
    this.tempStateManager = new TempSlotStateManager();
    this.promptGenerator = new HumanPromptGenerator();
    
    // 效能監控統計
    this.stats = {
      processSemanticCalls: 0,
      successfulProcesses: 0,
      failedProcesses: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      componentErrors: {
        stateManager: 0,
        merger: 0,
        validator: 0,
        templateLoader: 0
      }
    };
    
    // 錯誤重試配置
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // 1秒
      exponentialBackoff: true
    };
  }

  /**
   * 處理語意分析結果的主要流程協調
   * @param {string} userId - 用戶ID
   * @param {Object} semanticResult - SemanticService 分析結果
   * @returns {Promise<Object>} 處理結果
   */
  async processSemanticResult(userId, semanticResult) {
    const startTime = Date.now();
    this.stats.processSemanticCalls++;
    
    console.log(`[SlotTemplateManager] 開始處理語意結果 - 用戶: ${userId}, 意圖: ${semanticResult.intent}`);
    
    try {
      // Step 1: 獲取用戶當前狀態
      const currentState = await this.executeWithRetry(
        () => this.slotStateManager.getUserState(userId),
        'stateManager'
      );
      
      // Step 2: 將語意結果轉換為 slot 狀態格式
      const processedSemanticResult = this.convertSemanticToSlotFormat(semanticResult);
      
      // Step 3: 合併新舊 slot 狀態
      const mergedState = await this.executeWithRetry(
        () => this.slotMerger.merge(currentState, processedSemanticResult),
        'merger'
      );
      
      // Step 4: 驗證合併後的狀態
      const validationResult = await this.executeWithRetry(
        () => this.slotValidator.validate(mergedState, processedSemanticResult.intent),
        'validator'
      );
      
      // Step 5: 更新用戶狀態
      const updatedState = await this.executeWithRetry(
        () => this.slotStateManager.updateUserState(userId, mergedState),
        'stateManager'
      );
      
      // Step 6: 檢查是否需要執行任務
      let taskExecutionResult = null;
      if (validationResult.isComplete && validationResult.isValid) {
        console.log(`[SlotTemplateManager] 任務完成度達標，觸發執行 - 用戶: ${userId}`);
        try {
          taskExecutionResult = await this.taskTrigger.execute(userId, updatedState);
          console.log(`[SlotTemplateManager] 任務執行完成 - 用戶: ${userId}, 成功: ${taskExecutionResult.success}`);
        } catch (error) {
          console.error(`[SlotTemplateManager] 任務執行失敗 - 用戶: ${userId}`, error);
          taskExecutionResult = {
            success: false,
            error: error.message,
            type: 'task_execution_error'
          };
        }
      }

      // Step 7: 生成處理結果
      const result = {
        success: true,
        userId,
        intent: processedSemanticResult.intent,
        userState: updatedState,
        validation: validationResult,
        nextActions: this.determineNextActions(validationResult, taskExecutionResult),
        taskExecution: taskExecutionResult,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      // 記錄成功統計
      this.recordProcessingStats(startTime, true);
      
      console.log(`[SlotTemplateManager] 處理完成 - 用戶: ${userId}, 完成度: ${validationResult.completionScore}, 是否完整: ${validationResult.isComplete}`);
      
      return result;
      
    } catch (error) {
      // 記錄失敗統計
      this.recordProcessingStats(startTime, false);
      
      console.error(`[SlotTemplateManager] 處理失敗 - 用戶: ${userId}`, error);
      
      return {
        success: false,
        userId,
        intent: semanticResult.intent,
        error: error.message,
        errorType: this.categorizeError(error),
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 將 SemanticService 的結果轉換為 Slot 格式
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Object} 轉換後的結果
   */
  convertSemanticToSlotFormat(semanticResult) {
    const { intent, entities, confidence } = semanticResult;
    
    // 將 entities 轉換為 slot_state 格式
    const slotState = {};
    
    if (entities) {
      // 映射標準欄位
      if (entities.course_name) slotState.course = entities.course_name;
      if (entities.location) slotState.location = entities.location;
      if (entities.teacher) slotState.teacher = entities.teacher;
      
      // 處理時間信息
      if (entities.timeInfo) {
        if (entities.timeInfo.date) slotState.date = entities.timeInfo.date;
        if (entities.timeInfo.time) slotState.time = entities.timeInfo.time;
      }
      
      // 處理確認信息
      if (entities.confirmation) slotState.confirmation = entities.confirmation;
    }
    
    return {
      intent,
      slot_state: slotState,
      confidence,
      extraction_details: {
        raw_text: semanticResult.context?.raw_text || '',
        method: semanticResult.method || 'semantic_service',
        processed_entities: entities,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 確定下一步行動
   * @param {Object} validationResult - 驗證結果
   * @param {Object} taskExecutionResult - 任務執行結果 (可選)
   * @returns {Object} 下一步行動指引
   */
  determineNextActions(validationResult, taskExecutionResult = null) {
    const actions = {
      type: null,
      priority: 'medium',
      actions: [],
      canExecuteTask: false
    };
    
    if (validationResult.isComplete && validationResult.isValid) {
      if (taskExecutionResult) {
        // 任務已執行，回報結果
        if (taskExecutionResult.success) {
          actions.type = 'task_completed';
          actions.priority = 'high';
          actions.canExecuteTask = false;
          actions.actions.push({
            action: 'task_execution_success',
            description: '任務已成功完成',
            executionId: taskExecutionResult.executionId
          });
        } else {
          actions.type = 'task_execution_failed';
          actions.priority = 'high';
          actions.canExecuteTask = false;
          actions.actions.push({
            action: 'handle_execution_error',
            description: '任務執行失敗，需要處理錯誤',
            error: taskExecutionResult.error
          });
        }
      } else {
        // 任務可以執行但尚未執行 (此情況不應該發生)
        actions.type = 'execute_task';
        actions.priority = 'high';
        actions.canExecuteTask = true;
        actions.actions.push({
          action: 'trigger_task_execution',
          description: '所有必要資訊已收集完成，可以執行任務'
        });
      }
    } else if (!validationResult.isValid) {
      // 需要修正錯誤
      actions.type = 'fix_validation_errors';
      actions.priority = 'high';
      actions.actions = validationResult.validationErrors.map(error => ({
        action: 'fix_slot_value',
        slot: error.slot,
        description: error.errors[0]?.message || '需要修正此欄位'
      }));
    } else if (!validationResult.isComplete) {
      // 需要收集更多資訊
      actions.type = 'collect_missing_slots';
      actions.priority = 'medium';
      actions.actions = validationResult.missingSlots.slice(0, 1).map(missing => ({
        action: 'ask_for_slot',
        slot: missing.slot,
        priority: missing.priority,
        description: missing.description
      }));
    }
    
    return actions;
  }

  /**
   * 生成追問問題 - 增強版對話管理功能
   * @param {Object} validationResult - 驗證結果
   * @param {string} intent - 當前意圖
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 問題生成結果
   */
  async generateFollowUpQuestion(validationResult, intent, context = {}) {
    try {
      // 如果任務已完成，不需要追問
      if (validationResult.isComplete && validationResult.isValid) {
        return {
          hasQuestion: false,
          message: '資訊收集完成，準備執行任務。',
          questionType: 'completion',
          completionScore: validationResult.completionScore
        };
      }
      
      // 優先處理驗證錯誤
      if (!validationResult.isValid && validationResult.validationErrors.length > 0) {
        const firstError = validationResult.validationErrors[0];
        const contextAwareMessage = await this.generateContextAwareErrorMessage(firstError, context, intent);
        
        return {
          hasQuestion: true,
          message: contextAwareMessage,
          questionType: 'validation_error',
          slot: firstError.slot,
          priority: 'high',
          suggestions: await this.generateErrorSuggestions(firstError, intent)
        };
      }
      
      // 處理缺失的 slots - 使用智能優先級排序
      if (!validationResult.isComplete && validationResult.missingSlots.length > 0) {
        const prioritizedSlots = this.prioritizeQuestionsByContext(validationResult.missingSlots, context, intent);
        const nextSlot = prioritizedSlots[0];
        
        const contextAwareQuestion = await this.generateContextAwareSlotQuestion(nextSlot, intent, context);
        
        return {
          hasQuestion: true,
          message: contextAwareQuestion.question,
          questionType: 'missing_slot',
          slot: nextSlot.slot,
          priority: nextSlot.priority,
          suggestions: contextAwareQuestion.suggestions,
          progress: {
            current: validationResult.completionScore,
            remaining: prioritizedSlots.length,
            nextSteps: prioritizedSlots.slice(1, 3).map(s => s.slot) // 顯示接下來的2個步驟
          }
        };
      }
      
      // 沒有需要追問的問題
      return {
        hasQuestion: false,
        message: '資訊收集完成。',
        questionType: 'completion'
      };
      
    } catch (error) {
      console.error('[SlotTemplateManager] 生成追問問題失敗:', error);
      return {
        hasQuestion: true,
        message: '請問還有其他需要補充的資訊嗎？',
        questionType: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * 根據上下文排序問題優先級
   * @param {Array} missingSlots - 缺失的 slots
   * @param {Object} context - 對話上下文
   * @param {string} intent - 當前意圖
   * @returns {Array} 排序後的 slots
   */
  prioritizeQuestionsByContext(missingSlots, context, intent) {
    const priorityWeights = {
      high: 100,
      medium: 50,
      low: 25
    };

    const intentBasedPriority = {
      'record_course': ['student', 'course', 'date', 'time', 'location', 'teacher'],
      'modify_course': ['course', 'date', 'time', 'location', 'teacher', 'student'],
      'cancel_course': ['course', 'date', 'student']
    };

    return missingSlots.sort((a, b) => {
      // 1. 基本優先級權重
      let scoreA = priorityWeights[a.priority] || 0;
      let scoreB = priorityWeights[b.priority] || 0;

      // 2. 意圖相關的優先級調整
      const intentPriority = intentBasedPriority[intent] || [];
      const intentIndexA = intentPriority.indexOf(a.slot);
      const intentIndexB = intentPriority.indexOf(b.slot);
      
      if (intentIndexA !== -1) scoreA += (intentPriority.length - intentIndexA) * 10;
      if (intentIndexB !== -1) scoreB += (intentPriority.length - intentIndexB) * 10;

      // 3. 上下文相關調整
      if (context.recentlyMentioned && context.recentlyMentioned.includes(a.slot)) scoreA += 20;
      if (context.recentlyMentioned && context.recentlyMentioned.includes(b.slot)) scoreB += 20;

      // 4. 依賴關係調整（某些 slot 需要其他 slot 先完成）
      if (this.hasDependencies(a.slot, missingSlots)) scoreA -= 15;
      if (this.hasDependencies(b.slot, missingSlots)) scoreB -= 15;

      return scoreB - scoreA;
    });
  }

  /**
   * 檢查 slot 是否有依賴關係
   * @param {string} slot - slot 名稱
   * @param {Array} allMissingSlots - 所有缺失的 slots
   * @returns {boolean} 是否有依賴
   */
  hasDependencies(slot, allMissingSlots) {
    const dependencies = {
      'reminder': ['date', 'time'], // 提醒需要先有日期和時間
      'repeat': ['date', 'time'],   // 重複需要先有日期和時間
      'note': ['course']            // 備註通常需要先有課程
    };

    const requiredDeps = dependencies[slot] || [];
    return requiredDeps.some(dep => 
      allMissingSlots.some(missing => missing.slot === dep)
    );
  }

  /**
   * 生成上下文感知的 slot 問題
   * @param {Object} missingSlot - 缺失的 slot
   * @param {string} intent - 當前意圖
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 問題和建議
   */
  async generateContextAwareSlotQuestion(missingSlot, intent, context = {}) {
    try {
      const template = await this.templateLoader.getTemplateByIntent(intent);
      const slotConfig = template.slots[missingSlot.slot];
      
      // 基本問題生成
      let question = await this.generateSlotQuestion(missingSlot, intent);
      
      // 上下文感知增強
      if (context.userState && context.userState.settings) {
        const settings = context.userState.settings;
        
        // 根據用戶設定調整問題語調
        if (settings.language === 'zh-TW') {
          question = this.adjustQuestionForTraditionalChinese(question, missingSlot.slot);
        }
      }

      // 生成智能建議
      const suggestions = await this.generateSlotSuggestions(missingSlot, context, slotConfig);
      
      // 添加進度提示
      if (context.totalSteps && context.currentStep) {
        question += ` (步驟 ${context.currentStep}/${context.totalSteps})`;
      }

      return {
        question,
        suggestions,
        examples: slotConfig?.examples || [],
        inputHints: this.generateInputHints(missingSlot.slot, slotConfig)
      };
      
    } catch (error) {
      console.warn('[SlotTemplateManager] 生成上下文感知問題失敗，使用預設問題:', error.message);
      return {
        question: `請提供${missingSlot.description}。`,
        suggestions: [],
        examples: [],
        inputHints: []
      };
    }
  }

  /**
   * 為 slot 生成智能建議
   * @param {Object} missingSlot - 缺失的 slot
   * @param {Object} context - 上下文
   * @param {Object} slotConfig - slot 配置
   * @returns {Promise<Array>} 建議列表
   */
  async generateSlotSuggestions(missingSlot, context, slotConfig) {
    const suggestions = [];
    
    try {
      switch (missingSlot.slot) {
        case 'student':
          // 基於歷史記錄建議學生名稱
          if (context.recentStudents) {
            suggestions.push(...context.recentStudents.slice(0, 3));
          }
          break;
          
        case 'course':
          // 基於用戶常用課程建議
          if (context.frequentCourses) {
            suggestions.push(...context.frequentCourses.slice(0, 4));
          }
          break;
          
        case 'time':
          // 基於常用時間建議
          if (context.preferredTimes) {
            suggestions.push(...context.preferredTimes);
          } else {
            suggestions.push('14:00', '15:00', '16:00', '19:00');
          }
          break;
          
        case 'location':
          // 基於歷史地點建議
          if (context.recentLocations) {
            suggestions.push(...context.recentLocations.slice(0, 3));
          }
          break;
          
        case 'teacher':
          // 基於課程類型建議老師
          if (context.courseTeachers && context.currentCourse) {
            const relatedTeachers = context.courseTeachers[context.currentCourse] || [];
            suggestions.push(...relatedTeachers.slice(0, 3));
          }
          break;
      }
      
      // 添加配置中的範例
      if (slotConfig?.examples) {
        suggestions.push(...slotConfig.examples.slice(0, 2));
      }
      
    } catch (error) {
      console.warn('[SlotTemplateManager] 生成建議失敗:', error.message);
    }
    
    // 去重並限制數量
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * 生成輸入提示
   * @param {string} slotName - slot 名稱
   * @param {Object} slotConfig - slot 配置
   * @returns {Array} 輸入提示
   */
  generateInputHints(slotName, slotConfig) {
    const hints = [];
    
    if (slotConfig?.validation) {
      const validation = slotConfig.validation;
      
      switch (slotConfig.type) {
        case 'date':
          hints.push('格式：YYYY-MM-DD 或 "明天"、"下週三"');
          break;
        case 'time':
          hints.push('格式：HH:mm 或 "下午兩點"、"晚上七點半"');
          break;
        case 'string':
          if (validation.max_length) {
            hints.push(`長度不超過 ${validation.max_length} 字元`);
          }
          break;
      }
    }
    
    // 添加別名提示
    if (slotConfig?.aliases && slotConfig.aliases.length > 0) {
      hints.push(`也可以說：${slotConfig.aliases.slice(0, 2).join('、')}`);
    }
    
    return hints;
  }

  /**
   * 為繁體中文調整問題語調
   * @param {string} question - 原問題
   * @param {string} slotName - slot 名稱
   * @returns {string} 調整後的問題
   */
  adjustQuestionForTraditionalChinese(question, slotName) {
    // 繁體中文語調調整規則
    const adjustments = {
      'student': ['請問哪位小朋友要上課呢？', '請提供學生姓名。'],
      'course': ['想要學什麼課程呢？', '請提供課程名稱。'],
      'date': ['想要安排在哪一天呢？', '請提供上課日期。'],
      'time': ['幾點開始上課呢？', '請提供上課時間。'],
      'location': ['要在哪裡上課呢？', '請提供上課地點。'],
      'teacher': ['哪位老師來教課呢？', '請提供授課老師。']
    };
    
    const options = adjustments[slotName];
    if (options) {
      // 隨機選擇更親切的表達方式
      return Math.random() > 0.5 ? options[0] : options[1];
    }
    
    return question;
  }

  /**
   * 生成上下文感知的錯誤訊息
   * @param {Object} validationError - 驗證錯誤
   * @param {Object} context - 上下文
   * @param {string} intent - 意圖
   * @returns {Promise<string>} 上下文感知的錯誤訊息
   */
  async generateContextAwareErrorMessage(validationError, context, intent) {
    const basicMessage = this.generateErrorMessage(validationError);
    
    // 根據錯誤類型提供更具體的指導
    if (validationError.errors && validationError.errors.length > 0) {
      const error = validationError.errors[0];
      
      switch (error.code) {
        case 'INVALID_DATE_FORMAT':
          return `${basicMessage} 您可以輸入如 "2025-08-01"、"明天" 或 "下週三" 這樣的格式。`;
        case 'INVALID_TIME_FORMAT':
          return `${basicMessage} 您可以輸入如 "14:00"、"下午兩點" 或 "晚上七點半" 這樣的格式。`;
        case 'DATETIME_IN_PAST':
          return `${basicMessage} 請選擇今天之後的日期和時間。`;
        default:
          return basicMessage;
      }
    }
    
    return basicMessage;
  }

  /**
   * 為錯誤生成修正建議
   * @param {Object} validationError - 驗證錯誤
   * @param {string} intent - 意圖
   * @returns {Promise<Array>} 修正建議
   */
  async generateErrorSuggestions(validationError, intent) {
    const suggestions = [];
    
    if (validationError.errors && validationError.errors.length > 0) {
      const error = validationError.errors[0];
      
      switch (error.code) {
        case 'INVALID_DATE_FORMAT':
          suggestions.push('2025-08-01', '明天', '下週五', '8月15日');
          break;
        case 'INVALID_TIME_FORMAT':
          suggestions.push('14:00', '下午兩點', '晚上七點半', '19:30');
          break;
        case 'DATETIME_IN_PAST':
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          suggestions.push(
            tomorrow.toISOString().split('T')[0],
            '明天',
            '下週一',
            '下個月'
          );
          break;
      }
    }
    
    return suggestions.slice(0, 4);
  }

  /**
   * 生成特定 slot 的問題
   * @param {Object} missingSlot - 缺失的 slot 資訊
   * @param {string} intent - 當前意圖
   * @returns {Promise<string>} 生成的問題
   */
  async generateSlotQuestion(missingSlot, intent) {
    try {
      // 載入對應的模板
      const template = await this.templateLoader.getTemplateByIntent(intent);
      
      // 獲取問題模板
      const questionTemplates = template.question_templates[missingSlot.slot];
      if (questionTemplates && questionTemplates.length > 0) {
        // 隨機選擇一個問題模板
        const randomIndex = Math.floor(Math.random() * questionTemplates.length);
        return questionTemplates[randomIndex];
      }
      
      // 回退到預設問題
      return `請提供${missingSlot.description}。`;
      
    } catch (error) {
      console.warn('[SlotTemplateManager] 生成問題模板失敗，使用預設問題:', error.message);
      return `請提供${missingSlot.description}。`;
    }
  }

  /**
   * 生成錯誤訊息
   * @param {Object} validationError - 驗證錯誤
   * @returns {string} 錯誤訊息
   */
  generateErrorMessage(validationError) {
    if (validationError.errors && validationError.errors.length > 0) {
      const error = validationError.errors[0];
      return `${validationError.slot}有問題：${error.message}`;
    }
    return `${validationError.slot}的格式不正確，請重新輸入。`;
  }

  /**
   * 帶重試機制的執行方法
   * @param {Function} operation - 要執行的操作
   * @param {string} componentName - 組件名稱
   * @returns {Promise<*>} 執行結果
   */
  async executeWithRetry(operation, componentName) {
    let lastError;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.stats.componentErrors[componentName]++;
        
        if (attempt < this.retryConfig.maxRetries - 1) {
          const delay = this.retryConfig.exponentialBackoff 
            ? this.retryConfig.retryDelay * Math.pow(2, attempt)
            : this.retryConfig.retryDelay;
          
          console.warn(`[SlotTemplateManager] ${componentName} 執行失敗，${delay}ms 後重試 (嘗試 ${attempt + 1}/${this.retryConfig.maxRetries}):`, error.message);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`${componentName} 執行失敗，已達最大重試次數: ${lastError.message}`);
  }

  /**
   * 睡眠函數
   * @param {number} ms - 睡眠毫秒數
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 記錄處理統計
   * @param {number} startTime - 開始時間
   * @param {boolean} success - 是否成功
   */
  recordProcessingStats(startTime, success) {
    const processingTime = Date.now() - startTime;
    
    if (success) {
      this.stats.successfulProcesses++;
    } else {
      this.stats.failedProcesses++;
    }
    
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.processSemanticCalls;
  }

  /**
   * 分類錯誤類型
   * @param {Error} error - 錯誤對象
   * @returns {string} 錯誤類型
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('template') || message.includes('模板')) {
      return 'template_error';
    } else if (message.includes('validation') || message.includes('驗證')) {
      return 'validation_error';
    } else if (message.includes('state') || message.includes('狀態')) {
      return 'state_error';
    } else if (message.includes('merge') || message.includes('合併')) {
      return 'merge_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    const totalProcesses = this.stats.processSemanticCalls;
    const successRate = totalProcesses > 0 ? this.stats.successfulProcesses / totalProcesses : 0;
    
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      componentStats: {
        stateManager: this.slotStateManager.getCacheStats(),
        merger: this.slotMerger.getStats(),
        validator: this.slotValidator.getStats()
      }
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      processSemanticCalls: 0,
      successfulProcesses: 0,
      failedProcesses: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      componentErrors: {
        stateManager: 0,
        merger: 0,
        validator: 0,
        templateLoader: 0
      }
    };
    
    // 重置子組件統計
    this.slotMerger.resetStats();
    this.slotValidator.resetStats();
    
    console.log('[SlotTemplateManager] 統計資訊已重置');
  }

  /**
   * 健康檢查
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };
    
    try {
      // 檢查模板載入器
      await this.templateLoader.ensureInitialized();
      const templateStats = await this.templateLoader.getStats();
      health.components.templateLoader = {
        status: 'healthy',
        templates_loaded: templateStats.total_templates
      };
    } catch (error) {
      health.components.templateLoader = {
        status: 'unhealthy',
        error: error.message
      };
      health.overall = 'degraded';
    }
    
    // 檢查其他組件
    health.components.stateManager = {
      status: 'healthy',
      cache_size: this.slotStateManager.getCacheStats().cacheSize
    };
    
    health.components.merger = {
      status: 'healthy',
      operations: this.slotMerger.getStats().mergeOperations
    };
    
    health.components.validator = {
      status: 'healthy',
      validations: this.slotValidator.getStats().validationCalls
    };
    
    return health;
  }

  /**
   * 設定重試配置
   * @param {Object} config - 重試配置
   */
  setRetryConfig(config) {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log('[SlotTemplateManager] 重試配置已更新:', this.retryConfig);
  }

  // 🚨 Multi-Turn Dialog Enhancement - 新增方法

  /**
   * 🚨 帶問題檢測的語意處理 (任務 4.1.1)
   * @param {string} userId - 用戶ID
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Promise<Object>} 處理結果
   */
  async processWithProblemDetection(userId, semanticResult) {
    console.log(`[SlotTemplateManager] 開始帶問題檢測的語意處理 - 用戶: ${userId}`);
    
    try {
      // Step 1: 檢查是否為補充信息
      const tempState = await this.tempStateManager.detectSupplementIntent(userId, semanticResult.text);
      
      if (tempState) {
        console.log(`[SlotTemplateManager] 檢測到補充信息 - 用戶: ${userId}, 暫存ID: ${tempState.tempId}`);
        return await this.handleSupplementInfo(userId, tempState, semanticResult);
      }
      
      // Step 2: 正常 slot 處理
      const slotResult = await this.processSemanticResult(userId, semanticResult);
      
      // Step 3: 問題檢測
      const template = await this.templateLoader.getTemplateByIntent(semanticResult.intent);
      const problems = this.problemDetector.detectProblems(slotResult.userState, template);
      
      // Step 4: 根據問題數量決定處理策略
      return await this.handleProblemsStrategy(userId, slotResult, problems);
      
    } catch (error) {
      console.error(`[SlotTemplateManager] 問題檢測處理失敗 - 用戶: ${userId}`, error);
      // 降級到原始處理邏輯
      return await this.processSemanticResult(userId, semanticResult);
    }
  }

  /**
   * 🚨 問題處理策略 (任務 4.1.2)
   * @param {string} userId - 用戶ID
   * @param {Object} slotResult - Slot 處理結果
   * @param {Object} problems - 檢測到的問題
   * @returns {Promise<Object>} 處理結果
   */
  async handleProblemsStrategy(userId, slotResult, problems) {
    const problemCount = this.problemDetector.countProblems(problems);
    console.log(`[SlotTemplateManager] 檢測到 ${problemCount} 個問題 - 用戶: ${userId}`);
    
    // 🚨 檢查是否有混雜提取問題，優先處理 (任務 4.1.3)
    const mixedProblem = problems.mixedExtraction && problems.mixedExtraction.length > 0 ? problems.mixedExtraction[0] : null;
    if (mixedProblem) {
      console.log(`[SlotTemplateManager] 檢測到混雜提取問題，開始智能分離 - 用戶: ${userId}`);
      const separatedSlots = this.problemDetector.separateMixedSlots(slotResult.userState);
      
      // 重新處理分離後的 slots
      const newSemanticResult = {
        ...slotResult.semantic_result,
        entities: separatedSlots
      };
      
      // 遞迴處理分離後的結果
      return await this.processWithProblemDetection(userId, newSemanticResult);
    }
    
    if (problemCount === 0) {
      // 完整信息，直接執行任務
      console.log(`[SlotTemplateManager] 信息完整，執行任務 - 用戶: ${userId}`);
      return {
        ...slotResult,
        type: 'task_completed',
        requiresExecution: true
      };
    } else if (problemCount === 1) {
      // 單一問題，創建暫存狀態
      console.log(`[SlotTemplateManager] 單一問題，創建暫存狀態 - 用戶: ${userId}`);
      return await this.createTempStateAndPrompt(userId, slotResult, problems);
    } else {
      // 多問題，要求重新輸入
      console.log(`[SlotTemplateManager] 多問題，要求重新輸入 - 用戶: ${userId}`);
      return await this.generateMultiProblemPrompt(problems, slotResult.userState);
    }
  }

  /**
   * 🚨 處理補充信息 (任務 4.2.1)
   * @param {string} userId - 用戶ID
   * @param {Object} tempState - 暫存狀態
   * @param {Object} semanticResult - 語意分析結果
   * @returns {Promise<Object>} 處理結果
   */
  async handleSupplementInfo(userId, tempState, semanticResult) {
    console.log(`[SlotTemplateManager] 處理補充信息 - 用戶: ${userId}, 暫存ID: ${tempState.tempId}`);
    
    try {
      // 合併新信息到暫存狀態 (任務 4.2.2)
      const mergedState = await this.tempStateManager.mergeSupplementInfo(
        tempState.tempId, 
        semanticResult.entities || {}
      );
      
      // 重新檢查問題
      const remainingProblems = this.problemDetector.detectProblems(
        mergedState.validSlots, 
        tempState.template
      );
      
      if (this.problemDetector.countProblems(remainingProblems) === 0) {
        // 信息完整，執行任務並清理暫存 (任務 4.2.3)
        console.log(`[SlotTemplateManager] 補充信息完整，執行任務 - 用戶: ${userId}`);
        
        const result = {
          type: 'task_completed',
          slot_state: mergedState.validSlots,
          requiresExecution: true,
          tempStateCleared: true
        };
        
        // 清理暫存狀態
        await this.tempStateManager.clearTempState(tempState.tempId);
        
        return result;
      } else {
        // 仍有問題，繼續等待補充
        console.log(`[SlotTemplateManager] 仍有問題，繼續等待補充 - 用戶: ${userId}`);
        const singleProblem = this.problemDetector.getAllProblems(remainingProblems)[0];
        return this.promptGenerator.generateSingleProblemPrompt(singleProblem, mergedState.validSlots);
      }
      
    } catch (error) {
      console.error(`[SlotTemplateManager] 補充信息處理失敗 - 用戶: ${userId}`, error);
      return {
        type: 'error',
        message: '處理補充信息時發生錯誤，請重新輸入完整的課程信息'
      };
    }
  }

  /**
   * 🚨 創建暫存狀態並生成提示 (任務 4.1.4)
   * @param {string} userId - 用戶ID
   * @param {Object} slotResult - Slot 處理結果
   * @param {Object} problems - 檢測到的問題
   * @returns {Promise<Object>} 處理結果
   */
  async createTempStateAndPrompt(userId, slotResult, problems) {
    try {
      const template = await this.templateLoader.getTemplateByIntent(slotResult.intent || 'record_course');
      const allProblems = this.problemDetector.getAllProblems(problems);
      
      // 創建暫存狀態
      const tempState = await this.tempStateManager.createTempState(
        userId,
        slotResult.userState,
        allProblems,
        template
      );
      
      // 生成單一問題提示
      const singleProblem = allProblems[0]; // 因為已確認只有一個問題
      const promptResult = this.promptGenerator.generateSingleProblemPrompt(singleProblem, slotResult.userState);
      
      return {
        ...promptResult,
        tempState: tempState,
        requiresExecution: false
      };
      
    } catch (error) {
      console.error(`[SlotTemplateManager] 創建暫存狀態失敗 - 用戶: ${userId}`, error);
      // 降級處理：直接要求重新輸入
      return this.promptGenerator.generateMultiProblemPrompt(
        this.problemDetector.getAllProblems(problems),
        slotResult.userState
      );
    }
  }

  /**
   * 🚨 生成多問題提示 (任務 4.1.5)
   * @param {Object} problems - 檢測到的問題
   * @param {Object} slotState - 當前 slot 狀態
   * @returns {Object} 處理結果
   */
  async generateMultiProblemPrompt(problems, slotState) {
    const allProblems = this.problemDetector.getAllProblems(problems);
    const promptResult = this.promptGenerator.generateMultiProblemPrompt(allProblems, slotState);
    
    return {
      ...promptResult,
      requiresExecution: false,
      recorded: false
    };
  }
}

module.exports = SlotTemplateManager;