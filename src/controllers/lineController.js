/**
 * LINE Bot Controller - 請求接收層
 * 職責：接收 LINE Webhook、驗證簽名、處理文字訊息
 * 禁止：直接調用 openaiService, firebaseService, lineService
 * Phase 5: LINE Bot Integration
 * Phase 6: 增加會話上下文支持
 */
const crypto = require('crypto');
const SemanticService = require('../services/semanticService');
const TaskService = require('../services/taskService');
const TimeService = require('../services/timeService');
const lineService = require('../services/lineService');
const ConversationContext = require('../utils/conversationContext');

// 創建 SemanticService 實例
const semanticService = new SemanticService();

class LineController {
  // 靜態初始化TaskService實例
  static taskService = null;
  
  /**
   * 初始化TaskService實例（單例模式）
   */
  static initializeTaskService() {
    if (!this.taskService) {
      try {
        this.taskService = new TaskService();
        console.log('✅ [LineController] TaskService initialized successfully');
      } catch (error) {
        console.error('❌ [LineController] Failed to initialize TaskService:', error.message);
        throw error;
      }
    }
    return this.taskService;
  }
  /**
   * 健康檢查端點
   * GET /health → 200 OK
   */
  static healthCheck(req, res) {
    res.status(200).json({
      status: 'OK',
      service: 'IntentOS Course MVP',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: TimeService.getCurrentUserTime().toISOString(),
    });
  }

  /**
   * 🚨 第一性原則：檢查課程信息完整性
   * @param {string} originalText - 用戶原始輸入
   * @param {Object} entities - 提取的實體
   * @returns {Object} 完整性檢查結果
   */
  static checkCourseCompleteness(originalText, entities) {
    const problems = [];
    
    // 1. 檢查必填欄位：課程名
    if (!entities.course_name || entities.course_name.trim() === '') {
      problems.push({
        type: 'missing_required',
        field: 'course',
        message: '課程名稱'
      });
    }

    // 2. 檢查必填欄位：日期
    if (!entities.timeInfo || !entities.timeInfo.date) {
      problems.push({
        type: 'missing_required', 
        field: 'date',
        message: '上課日期'
      });
    }

    // 3. 檢查模糊時間（核心問題）
    const vagueTimePatterns = ['下午', '上午', '晚上', '早上', '中午', '傍晚'];
    const hasVagueTime = vagueTimePatterns.some(pattern => 
      originalText.includes(pattern) && !originalText.match(new RegExp(`${pattern}(一點|兩點|三點|四點|五點|六點|七點|八點|九點|十點|十一點|十二點|[0-9]+點)`))
    );
    
    if (hasVagueTime || !this.hasSpecificTime(originalText)) {
      const vagueTimeFound = vagueTimePatterns.find(pattern => originalText.includes(pattern)) || '時間';
      problems.push({
        type: 'vague_time',
        field: 'time', 
        value: vagueTimeFound,
        message: '具體上課時間'
      });
    }

    // 4. 檢查無效日期（如「後台」「前台」被誤認為日期）
    const invalidDatePatterns = ['後台', '前台', '那邊', '這裡', '不知道'];
    if (entities.timeInfo && entities.timeInfo.date && 
        invalidDatePatterns.some(pattern => originalText.includes(pattern))) {
      problems.push({
        type: 'invalid_date',
        field: 'date',
        value: invalidDatePatterns.find(pattern => originalText.includes(pattern)),
        message: '有效的上課日期'
      });
    }

    return {
      needsFollowUp: problems.length > 0,
      problems,
      problemCount: problems.length,
      validEntities: entities
    };
  }

  /**
   * 檢測是否為補充信息（用於多輪對話）
   * @param {string} userMessage - 用戶當前輸入
   * @param {Object} entities - 當前提取的實體
   * @param {Object} conversationContext - 會話上下文
   * @returns {boolean} 是否為補充信息
   */
  static detectSupplementInfo(userMessage, entities, conversationContext) {
    // 檢查條件1：上一次操作需要追問且還未完成
    if (!conversationContext.lastCourse) {
      console.log(`🔧 [DEBUG] 補充信息檢測失敗 - 無上次課程上下文`);
      return false;
    }

    // 檢查條件2：當前輸入缺少課程名稱但有其他信息（時間、地點等）
    const hasNoCourse = !entities.course_name || entities.course_name === null;
    const hasTimeInfo = entities.timeInfo && entities.timeInfo.display;
    const hasLocation = entities.location;

    // 🚨 改進的檢測邏輯：更嚴格的條件判斷
    // 檢查條件3：當前輸入主要是時間表達（補充時間信息）
    const isMainlyTimeExpression = /^(早上|上午|下午|晚上|中午)\d{1,2}點?$/.test(userMessage.trim()) ||
                                  /^\d{1,2}點?$/.test(userMessage.trim()) ||
                                  /^\d{1,2}:\d{2}$/.test(userMessage.trim());

    // 🚨 新增：檢查是否為完整的日期+時間表達（不應視為補充）
    const isCompleteDateTime = /^(明天|後天|今天)(早上|上午|下午|晚上|中午)\d{1,2}點?$/.test(userMessage.trim()) ||
                              /^(明天|後天|今天)\d{1,2}點?$/.test(userMessage.trim()) ||
                              /^(明天|後天|今天)\d{1,2}:\d{2}$/.test(userMessage.trim());

    // 🚨 新增：檢查是否包含新的課程相關關鍵詞（不應視為補充）
    const hasNewCourseKeywords = /課$|課程|上課|訓練|教學|學習/.test(userMessage);

    // 如果是完整的日期時間表達或包含課程關鍵詞，不視為補充信息
    if (isCompleteDateTime || hasNewCourseKeywords) {
      console.log(`🔧 [DEBUG] 補充信息檢測 - 檢測為新課程請求，非補充信息`);
      console.log(`🔧 [DEBUG] - 完整日期時間: ${isCompleteDateTime}, 有課程關鍵詞: ${hasNewCourseKeywords}`);
      return false;
    }

    const hasSupplementaryInfo = hasTimeInfo || hasLocation;

    console.log(`🔧 [DEBUG] 補充信息檢測 - 缺課程名: ${hasNoCourse}, 有補充信息: ${hasSupplementaryInfo}, 主要是時間: ${isMainlyTimeExpression}`);

    // 更嚴格的條件：必須缺少課程名稱 AND (有補充信息 OR 純時間表達)
    return hasNoCourse && (hasSupplementaryInfo || isMainlyTimeExpression);
  }

  /**
   * 合併會話上下文與補充信息
   * @param {Object} conversationContext - 會話上下文
   * @param {Object} supplementEntities - 補充的實體信息
   * @returns {Object} 合併後的實體信息
   */
  static mergeContextWithSupplement(conversationContext, supplementEntities) {
    // 從上下文恢復課程信息
    const mergedEntities = {
      course_name: conversationContext.lastCourse || supplementEntities.course_name,
      location: supplementEntities.location || conversationContext.lastLocation,
      teacher: supplementEntities.teacher || conversationContext.lastTeacher,
      student: supplementEntities.student,
      confirmation: supplementEntities.confirmation,
      timeInfo: supplementEntities.timeInfo, // 使用新提供的時間信息
    };

    // 如果上下文有時間但補充信息沒有，使用上下文的時間
    if (!supplementEntities.timeInfo && conversationContext.lastTime) {
      mergedEntities.timeInfo = {
        display: conversationContext.lastTime,
        date: conversationContext.lastDate,
        raw: conversationContext.lastDate,
        timestamp: new Date(conversationContext.lastDate).getTime()
      };
    }

    return mergedEntities;
  }

  /**
   * 檢查是否包含具體時間
   * @param {string} text - 文本
   * @returns {boolean} 是否有具體時間
   */
  static hasSpecificTime(text) {
    // 檢查具體時間格式：下午3點、晚上7點半、19:30、下午兩點等
    const specificTimePatterns = [
      /[下上晚早中][午]?[0-9]+點/,  // 下午3點
      /[下上晚早中][午]?(一點|兩點|三點|四點|五點|六點|七點|八點|九點|十點|十一點|十二點)/,  // 下午兩點
      /[0-9]+點半?/,                // 3點、3點半
      /[0-9]{1,2}:[0-9]{2}/,        // 15:30
      /[0-9]{1,2}點[0-9]+分?/,      // 3點30分
      /(一點|兩點|三點|四點|五點|六點|七點|八點|九點|十點|十一點|十二點)/  // 兩點
    ];
    
    return specificTimePatterns.some(pattern => pattern.test(text));
  }

  /**
   * 🚨 處理需要追問的情況
   * @param {string} userId - 用戶ID
   * @param {Object} completenessCheck - 完整性檢查結果
   * @param {string} replyToken - LINE回覆Token
   * @returns {Object} 處理結果
   */
  static async handleFollowUpRequired(userId, completenessCheck, replyToken) {
    const { problems, problemCount, validEntities } = completenessCheck;
    
    let replyMessage;
    
    if (problemCount === 1) {
      // 單一問題：暫存有效信息，追問缺失部分
      replyMessage = this.generateSingleProblemPrompt(validEntities, problems[0]);
      
      // TODO: 實作暫存機制（現階段先用簡單的回應）
      console.log(`🔧 [DEBUG] 單一問題處理 - 暫存信息:`, validEntities);
      
    } else {
      // 多個問題：要求重新輸入
      replyMessage = this.generateMultiProblemPrompt(problems);
    }

    // 發送回覆
    if (replyToken) {
      const replyResult = await lineService.replyMessage(replyToken, replyMessage);
      console.log('Follow-up reply result:', replyResult);
    }

    return {
      success: true,
      type: problemCount === 1 ? 'single_problem_followup' : 'multi_problem_followup',
      problems,
      message: replyMessage,
      needsFollowUp: true
    };
  }

  /**
   * 生成單一問題追問訊息
   * @param {Object} validEntities - 有效的實體信息
   * @param {Object} problem - 問題描述
   * @returns {string} 追問訊息
   */
  static generateSingleProblemPrompt(validEntities, problem) {
    const confirmedInfo = [];
    
    // 確認已收集的信息
    if (validEntities.course_name) {
      confirmedInfo.push(`📚 課程：${validEntities.course_name}`);
    }
    if (validEntities.student) {
      confirmedInfo.push(`👤 學生：${validEntities.student}`);
    }
    if (validEntities.location) {
      confirmedInfo.push(`📍 地點：${validEntities.location}`);
    }
    if (validEntities.timeInfo && validEntities.timeInfo.date && problem.type !== 'invalid_date') {
      confirmedInfo.push(`📅 日期：${validEntities.timeInfo.date}`);
    }

    const confirmationPart = confirmedInfo.length > 0 
      ? `✅ 已記錄：\n${confirmedInfo.join('\n')}\n\n` 
      : '';

    // 根據問題類型生成具體詢問
    let questionPart;
    let examples;

    switch (problem.type) {
      case 'vague_time':
        questionPart = `🕐 還需要確認具體的上課時間`;
        examples = `例如可以回覆：下午3點、晚上7點半、19:30`;
        break;
      case 'missing_required':
        questionPart = `❓ 還需要確認${problem.message}`;
        examples = problem.field === 'date' 
          ? `例如可以回覆：明天、星期三、12/25`
          : `例如可以回覆：下午3點、晚上7點半`;
        break;
      case 'invalid_date':
        questionPart = `📅 「${problem.value}」不是有效的日期，請提供正確的上課日期`;
        examples = `例如可以回覆：明天、星期三、12/25`;
        break;
      default:
        questionPart = `❓ 還需要確認${problem.message}`;
        examples = `請提供更具體的信息`;
    }

    return `${confirmationPart}${questionPart}\n\n${examples}`;
  }

  /**
   * 生成多問題重新輸入訊息
   * @param {Array} problems - 問題列表
   * @returns {string} 重新輸入訊息
   */
  static generateMultiProblemPrompt(problems) {
    const problemDescriptions = problems.map(problem => {
      switch (problem.type) {
        case 'invalid_date':
          return `• 日期資訊不清楚（「${problem.value}」無法識別為有效日期）`;
        case 'vague_time':
          return `• 時間需要更具體（「${problem.value}」請提供確切時間）`;
        case 'missing_required':
          return `• 缺少${problem.message}資訊`;
        default:
          return `• ${problem.message}需要補充`;
      }
    }).join('\n');

    return `我需要一些更清楚的資訊才能幫您安排課程：\n\n${problemDescriptions}\n\n請重新完整輸入課程資訊，例如：「明天下午3點小美鋼琴課」`;
  }

  /**
   * 驗證 LINE 簽名
   * @param {string} signature - X-Line-Signature header 值
   * @param {string} body - 請求 body 原始字符串
   * @returns {boolean} 簽名是否有效
   */
  static verifySignature(signature, body) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    
    // 測試模式：如果簽名是 'test'，直接通過驗證（僅限非生產環境）
    if (signature === 'test' && process.env.NODE_ENV !== 'production') {
      console.log('🔧 [DEBUG] 測試模式：跳過簽名驗證');
      return true;
    }

    if (!channelSecret) {
      console.error('LINE_CHANNEL_SECRET not configured');
      return false;
    }

    if (!signature) {
      console.error('Missing signature header');
      return false;
    }

    try {
      // 確保 body 是 Buffer 或字符串
      let bodyToVerify;
      if (Buffer.isBuffer(body)) {
        bodyToVerify = body;
      } else if (typeof body === 'string') {
        bodyToVerify = Buffer.from(body, 'utf8');
      } else {
        bodyToVerify = Buffer.from(JSON.stringify(body), 'utf8');
      }

      // Debug logging (reduced for production)
      console.log('Signature verification debug:');
      console.log('- Received signature length:', signature.length);
      console.log('- Body length:', bodyToVerify.length);

      // 檢查簽名長度是否在合理範圍內 (44-45字符都可接受)
      if (signature.length < 44 || signature.length > 45) {
        console.error('Signature length out of range:', signature.length, 'expected 44-45');
        return false;
      }

      // 計算預期簽名
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(bodyToVerify)
        .digest('base64');

      const expectedSignature = hash;
      console.log('- Expected signature length:', expectedSignature.length);

      // 安全比較簽名 - 直接比較 base64 字符串
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      console.log('- Signature valid:', isValid);
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * 處理文字訊息事件
   * @param {Object} event - LINE 文字訊息事件
   * @returns {Promise<Object>} 處理結果
   */
  static async handleTextMessage(event) {
    const { message, source, replyToken } = event;
    const { userId } = source;
    const userMessage = message.text;

    console.log(`Received message from ${userId}: ${userMessage}`);
    console.log(`Reply token: ${replyToken}`);

    try {
      // 🔧 獲取用戶會話上下文
      const conversationContext = ConversationContext.getContext(userId);
      console.log(`🔧 [DEBUG] 會話上下文:`, conversationContext ? 
        `存在 - 上次操作: ${conversationContext.lastAction}, 課程: ${conversationContext.lastCourse}` : 
        '不存在'); // [REMOVE_ON_PROD]
      
      // 語義分析 - 使用 Slot Template System (如果啟用)
      const useSlotTemplate = false; // 🚨 暫時禁用複雜 Slot Template，使用第一性原則解決方案
      
      // 詳細調試信息
      console.log(`🔧 [DEBUG] ENABLE_SLOT_TEMPLATE 環境變數:`, process.env.ENABLE_SLOT_TEMPLATE);
      console.log(`🔧 [DEBUG] useSlotTemplate:`, useSlotTemplate);
      console.log(`🔧 [DEBUG] semanticService.analyzeMessageWithSlotTemplate 存在:`, !!semanticService.analyzeMessageWithSlotTemplate);
      console.log(`🔧 [DEBUG] 條件檢查: useSlotTemplate=${useSlotTemplate} && method存在=${!!semanticService.analyzeMessageWithSlotTemplate}`);
      
      let analysis;
      if (useSlotTemplate && semanticService.analyzeMessageWithSlotTemplate) {
        console.log(`🔧 [DEBUG] 使用 Slot Template System 分析訊息`);
        analysis = await semanticService.analyzeMessageWithSlotTemplate(
          userMessage, 
          userId, 
          conversationContext || {},
          { enableSlotTemplate: true, useEnhancedExtraction: true }
        );
      } else {
        console.log(`🔧 [DEBUG] 使用標準語義分析`);
        analysis = await SemanticService.analyzeMessage(userMessage, userId, conversationContext || {});
      }

      if (!analysis.success) {
        return {
          success: false,
          error: 'Semantic analysis failed',
          details: analysis.error,
        };
      }

      let { intent, entities, confidence } = analysis;

      console.log(`🔧 [DEBUG] 語義分析完成 - Intent: ${intent}, Confidence: ${confidence}`);
      console.log(`🔧 [DEBUG] 提取實體:`, entities);

      // 🚨 檢查多輪對話：是否為補充信息（針對之前未完成的課程記錄）
      if (intent === 'record_course' && conversationContext && conversationContext.lastAction === 'record_course') {
        const isSupplementInfo = this.detectSupplementInfo(userMessage, entities, conversationContext);
        if (isSupplementInfo) {
          console.log(`🔧 [DEBUG] 檢測到補充信息，正在合併上下文`);
          entities = this.mergeContextWithSupplement(conversationContext, entities);
          console.log(`🔧 [DEBUG] 合併後實體:`, entities);
        }
      }

      // 🚨 第一性原則：簡單的完整性檢查與追問機制
      if (intent === 'record_course') {
        const completenessCheck = this.checkCourseCompleteness(userMessage, entities);
        if (completenessCheck.needsFollowUp) {
          console.log(`🔧 [DEBUG] 需要追問 - 問題數量: ${completenessCheck.problems.length}`);
          return await this.handleFollowUpRequired(userId, completenessCheck, event.replyToken);
        }
      }

      // ✅ 使用 TaskService 統一處理所有業務邏輯
      console.log(`🔧 [DEBUG] 開始執行任務 - Intent: ${intent}, UserId: ${userId}`);
      
      // 初始化TaskService實例
      const taskService = LineController.initializeTaskService();
      const result = await taskService.executeIntent(intent, entities, userId);

      console.log('TaskService execution result:', JSON.stringify(result, null, 2));

      console.log('Final handling result:', JSON.stringify({
        success: true,
        intent,
        confidence,
        result,
      }, null, 2));

      // 發送回覆給 LINE 用戶
      if (event.replyToken) {
        let replyMessage;

        // 🔧 [DEBUG] 添加調試信息到回覆中 (開發模式)
        const debugInfo = process.env.NODE_ENV === 'development' ? 
          `\n\n🔧 [調試信息] [REMOVE_ON_PROD]\n📊 Intent: ${intent} (信心度: ${confidence})\n📋 執行結果: ${result.success ? '✅ 成功' : '❌ 失敗'}\n${result.error ? `⚠️ 錯誤: ${result.error}` : ''}` : '';

        if (result.success === false) {
          replyMessage = (result.message || '處理時發生錯誤，請稍後再試') + debugInfo;
        } else {
          switch (intent) {
            case 'query_schedule': {
              // TaskService.handleQuerySchedule 返回 { success: true, courses: [...] }
              const courses = result.courses || [];
              replyMessage = lineService.formatCourseResponse(courses, intent);
              break;
            }
            case 'record_course':
              if (result.success) {
                // 構建詳細的成功消息
                let successMessage = '✅ 課程已成功新增！';
                
                // 如果有創建的課程信息，添加詳細信息
                if (result.course) {
                  const details = [];
                  details.push(`📚 課程：${result.course.course_name}`);
                  
                  if (result.course.schedule_time) {
                    details.push(`🕒 時間：${result.course.schedule_time}`);
                  }
                  
                  if (result.course.course_date) {
                    details.push(`📅 日期：${result.course.course_date}`);
                  }
                  
                  if (result.course.location) {
                    details.push(`📍 地點：${result.course.location}`);
                  }
                  
                  if (result.course.teacher) {
                    details.push(`👨‍🏫 老師：${result.course.teacher}`);
                  }
                  
                  if (details.length > 0) {
                    successMessage += `\n\n${details.join('\n')}`;
                  }
                }
                
                // 🚨 修復關鍵問題：課程成功創建後清空會話上下文
                // 防止後續輸入被誤判為補充信息
                ConversationContext.clearContext(userId);
                console.log(`🔧 [DEBUG] 課程創建成功，已清空用戶會話上下文 - UserId: ${userId}`);
                
                replyMessage = successMessage + debugInfo;
              } else {
                replyMessage = (result.message || '新增課程失敗') + debugInfo;
              }
              break;
            case 'cancel_course':
              if (result.success) {
                // 構建詳細的取消成功消息
                let successMessage = '✅ 課程已成功取消！';
                
                // 如果有被取消的課程信息，添加詳細信息
                if (result.cancelledCourse) {
                  const details = [];
                  details.push(`📚 課程：${result.cancelledCourse.course_name}`);
                  
                  if (result.cancelledCourse.schedule_time) {
                    details.push(`🕒 時間：${result.cancelledCourse.schedule_time}`);
                  }
                  
                  if (result.cancelledCourse.course_date) {
                    details.push(`📅 日期：${result.cancelledCourse.course_date}`);
                  }
                  
                  if (details.length > 0) {
                    successMessage += `\n\n${details.join('\n')}`;
                  }
                }
                
                replyMessage = successMessage + debugInfo;
              } else {
                replyMessage = (result.message || '取消課程失敗') + debugInfo;
              }
              break;
            case 'clear_schedule': {
              // 處理清空課表的各種回應情況
              if (result.action === 'clear_schedule_confirmation_required') {
                // 需要確認的情況
                replyMessage = result.message;
              } else if (result.action === 'clear_schedule_executed') {
                // 執行完成的情況
                replyMessage = result.message;
              } else if (result.action === 'clear_schedule_check') {
                // 沒有課程需要清空
                replyMessage = result.message;
              } else if (result.action === 'clear_schedule_expired') {
                // 確認已過期
                replyMessage = result.message;
              } else {
                // 其他錯誤情況
                replyMessage = result.message || '清空課表時發生錯誤，請稍後再試';
              }
              break;
            }
            case 'modify_course': {
              // 處理修改課程的各種回應情況
              if (result.success) {
                // 修改成功
                let successMessage = result.message;

                // 如果有更新的課程信息，添加詳細信息
                if (result.updatedCourse && result.originalCourse) {
                  const details = [];
                  if (result.modifiedFields.includes('schedule_time') || result.modifiedFields.includes('course_date')) {
                    details.push(`🕒 新時間：${result.updatedCourse.schedule_time}`);
                  }
                  if (result.modifiedFields.includes('location')) {
                    details.push(`📍 新地點：${result.updatedCourse.location || '未指定'}`);
                  }
                  if (result.modifiedFields.includes('teacher')) {
                    details.push(`👨‍🏫 新老師：${result.updatedCourse.teacher || '未指定'}`);
                  }

                  if (details.length > 0) {
                    successMessage += `\n\n${details.join('\n')}`;
                  }
                }

                replyMessage = successMessage + debugInfo;
              } else {
                // 修改失敗
                let failureMessage;
                if (result.error === 'Course not found') {
                  failureMessage = result.message;
                } else if (result.error === 'Missing course name') {
                  failureMessage = result.message;
                } else if (result.error === 'No update fields provided') {
                  failureMessage = result.message;
                } else if (result.error === 'Time conflict detected') {
                  failureMessage = result.message;
                } else if (result.error === 'Invalid time information') {
                  failureMessage = result.message;
                } else if (result.error) {
                  failureMessage = result.message || '修改課程時發生錯誤，請稍後再試';
                } else {
                  failureMessage = '修改課程時發生未知錯誤，請稍後再試';
                }
                replyMessage = failureMessage + debugInfo;
              }
              break;
            }
            default:
              replyMessage = '✅ 已收到您的訊息，正在處理中...';
          }
        }

        console.log('Sending reply:', replyMessage);

        const replyResult = await lineService.replyMessage(event.replyToken, replyMessage);
        console.log('Reply result:', replyResult);

        return {
          success: true,
          intent,
          confidence,
          result,
          reply: replyResult,
        };
      }

      return {
        success: true,
        intent,
        confidence,
        result,
      };
    } catch (error) {
      console.error('Error handling text message:', error);
      console.error('Error stack:', error.stack);

      // 提供更詳細的錯誤信息，但保持與測試的兼容性
      let errorMessage = '處理訊息時發生錯誤，請稍後再試';

      if (error.message.includes('Missing required')) {
        errorMessage = '請提供完整的課程信息';
      } else if (error.message.includes('Database')) {
        errorMessage = '數據庫連接失敗，請稍後再試';
      } else if (error.message.includes('Service')) {
        errorMessage = '服務暫時不可用，請稍後再試';
      }

      return {
        success: false,
        error: error.message, // 保持原始錯誤訊息，與測試期待一致
        message: errorMessage, // 用戶友好的錯誤訊息
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }

  /**
   * LINE Webhook 端點處理器
   * POST /callback
   */
  static async webhook(req, res) {
    console.log('Webhook request received');
    console.log('- Headers:', JSON.stringify(req.headers, null, 2));
    console.log('- Body type:', typeof req.body);
    console.log('- Body is Buffer:', Buffer.isBuffer(req.body));

    try {
      // 獲取原始 body 用於簽名驗證
      const signature = req.get('X-Line-Signature');
      const body = req.body.toString(); // 原始 Buffer 轉為字符串

      console.log('Processing webhook:');
      console.log('- Signature header:', signature);
      console.log('- Body after toString():', body.substring(0, 200));

      // 驗證簽名
      if (!LineController.verifySignature(signature, body)) {
        console.error('Invalid signature - rejecting request');
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 解析 JSON 事件
      const requestBody = JSON.parse(body);
      const { events } = requestBody;
      const results = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const event of events || []) {
        if (event.type === 'message' && event.message.type === 'text') {
          // eslint-disable-next-line no-await-in-loop
          const result = await LineController.handleTextMessage(event);
          results.push(result);
        } else {
          console.log(`Ignored event type: ${event.type}`);
          results.push({
            success: true,
            message: 'Event ignored',
          });
        }
      }

      // 返回處理結果
      console.log('Webhook processing completed:', JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }, null, 2));

      return res.status(200).json({
        success: true,
        processed: results.length,
        results,
      });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

module.exports = LineController;
