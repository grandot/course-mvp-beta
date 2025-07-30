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
  
  // 🚀 課程數據緩存 - 提高 Quick Reply 按鈕生成性能
  static courseCache = new Map();
  static CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分鐘
  
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

    // 2. 🎯 第一性原則：區分"沒有時間"和"模糊時間"
    const hasValidTimeInEntities = entities.timeInfo && entities.timeInfo.display && entities.timeInfo.date;
    
    // 3. 檢查模糊時間（有時間詞但不具體）
    const vagueTimePatterns = ['下午', '上午', '晚上', '早上', '中午', '傍晚'];
    const hasVagueTime = vagueTimePatterns.some(pattern => 
      originalText.includes(pattern) && !originalText.match(new RegExp(`${pattern}(一點|兩點|三點|四點|五點|六點|七點|八點|九點|十點|十一點|十二點|[0-9]+點)`))
    );
    
    // 4. 🎯 智能時間檢查：區分三種情況
    if (hasVagueTime) {
      // 情況1：有模糊時間詞（如"下午"）但不具體
      const vagueTimeFound = vagueTimePatterns.find(pattern => originalText.includes(pattern));
      problems.push({
        type: 'vague_time',
        field: 'time', 
        value: vagueTimeFound,
        message: '具體上課時間'
      });
    } else if (!hasValidTimeInEntities && !this.hasSpecificTime(originalText)) {
      // 情況2：完全沒有時間信息（如"鋼琴課"）- 友好詢問
      problems.push({
        type: 'missing_time',
        field: 'time', 
        message: '上課時間'
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
   * 🎯 第一性原則：簡化補充信息檢測 - 統一狀態管理
   * 只檢查是否處於 'record_course_pending' 狀態
   * @param {string} userMessage - 用戶當前輸入
   * @param {Object} entities - 當前提取的實體
   * @param {Object} conversationContext - 會話上下文
   * @returns {boolean} 是否為補充信息
   */
  static detectSupplementInfo(userMessage, entities, conversationContext) {
    // 🎯 簡化條件：只檢查一個條件 - 是否處於等待補充狀態
    const isPendingState = conversationContext && conversationContext.lastAction === 'record_course_pending';
    
    if (!isPendingState) {
      console.log(`🔧 [DEBUG] 非補充信息 - 狀態: ${conversationContext?.lastAction || 'null'}`);
      return false;
    }

    // 🎯 統一邏輯：處於 pending 狀態時，任何輸入都是補充信息
    // 除非是明顯的新課程請求（包含課程關鍵詞）
    const hasNewCourseKeywords = /課$|課程|上課|訓練|教學|學習|新增|安排|預約/.test(userMessage);
    
    if (hasNewCourseKeywords) {
      console.log(`🔧 [DEBUG] 檢測為新課程請求 - 有課程關鍵詞: ${userMessage}`);
      return false;
    }

    console.log(`🔧 [DEBUG] 確認為補充信息 - pending狀態下的補充輸入: ${userMessage}`);
    return true;
  }

  /**
   * 🎯 第一性原則：簡化合併邏輯 - 統一處理單一和多個問題
   * @param {Object} conversationContext - 會話上下文
   * @param {Object} supplementEntities - 補充的實體信息
   * @returns {Object} 合併後的實體信息
   */
  static mergeContextWithSupplement(conversationContext, supplementEntities) {
    console.log(`🔧 [DEBUG] 開始合併補充信息`);
    console.log(`🔧 [DEBUG] - 補充實體:`, supplementEntities);

    // 🎯 簡化：從上下文恢復暫存的信息（統一格式）
    const savedEntities = {
      course_name: conversationContext.lastCourse,
      location: conversationContext.lastLocation,
      teacher: conversationContext.lastTeacher,
      student: conversationContext.lastStudent,
      timeInfo: conversationContext.lastTimeInfo
    };

    console.log(`🔧 [DEBUG] - 暫存實體:`, savedEntities);

    // 🎯 統一合併策略：智能更新 - 有新值就用新值，沒有就保留舊值
    const mergedEntities = {
      course_name: supplementEntities.course_name || savedEntities.course_name,
      location: supplementEntities.location || savedEntities.location,
      teacher: supplementEntities.teacher || savedEntities.teacher,
      student: supplementEntities.student || savedEntities.student,
      timeInfo: supplementEntities.timeInfo || savedEntities.timeInfo,
      confirmation: supplementEntities.confirmation
    };

    console.log(`🔧 [DEBUG] 合併完成:`, mergedEntities);
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
    
    // 🎯 第一性原則：統一處理 - 不管幾個問題都用相同邏輯
    let replyMessage;
    let awaitingSupplementFor;
    
    if (problemCount === 1) {
      replyMessage = this.generateSingleProblemPrompt(validEntities, problems[0]);
      awaitingSupplementFor = problems[0].field;
    } else {
      replyMessage = this.generateMultiProblemPrompt(problems);
      awaitingSupplementFor = 'multiple';
    }
    
    // 🚨 統一狀態保存：不管單一還是多個問題，都使用相同的暫存機制
    ConversationContext.updateContext(userId, 'record_course_pending', {
      course_name: validEntities.course_name,
      location: validEntities.location,
      teacher: validEntities.teacher,
      student: validEntities.student,
      timeInfo: validEntities.timeInfo
    }, {
      pendingProblems: problems,
      awaitingSupplementFor,
      status: 'awaiting_supplement'
    });
    
    console.log(`🔧 [DEBUG] 統一追問處理 - 已保存暫存狀態 - UserId: ${userId}`);
    console.log(`🔧 [DEBUG] 問題數量: ${problemCount}, 等待補充: ${awaitingSupplementFor}`);
    console.log(`🔧 [DEBUG] 暫存信息:`, validEntities);

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
      case 'missing_time':
        // 🎯 友好詢問時間 - 針對純課程名輸入（如"鋼琴課"）
        questionPart = `🕐 請問什麼時候上${validEntities.course_name || '課'}？`;
        examples = `例如可以回覆：明天下午3點、星期二晚上7點、12/25 上午10點`;
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
      // 🎯 檢查是否為 Quick Reply 按鈕點擊
      if (userMessage.startsWith('course:')) {
        return await this.handleQuickReplyButtonClick(userMessage, userId, replyToken);
      }

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
        // 🎯 處理純時間輸入拒絕情況
        if (analysis.method === 'rejected_pure_time') {
          console.log(`🔧 [DEBUG] 檢測到純時間輸入，發送拒絕消息: ${analysis.message}`);
          
          if (event.replyToken) {
            const replyResult = await lineService.replyMessage(event.replyToken, analysis.message);
            console.log('Pure time input rejection reply result:', replyResult);
          }
          
          return {
            success: true, // 成功處理了拒絕情況
            intent: analysis.intent,
            confidence: analysis.confidence,
            result: {
              success: false,
              type: 'pure_time_input_rejected',
              message: analysis.message
            }
          };
        }
        
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
      const isPendingState = conversationContext && conversationContext.lastAction === 'record_course_pending';
      
      // 🚨 修復：無論當前 intent 是什麼，如果處於等待補充狀態，都要檢查是否為補充信息
      if (isPendingState) {
        const isSupplementInfo = this.detectSupplementInfo(userMessage, entities, conversationContext);
        if (isSupplementInfo) {
          console.log(`🔧 [DEBUG] 檢測到補充信息，正在合併上下文`);
          entities = this.mergeContextWithSupplement(conversationContext, entities);
          console.log(`🔧 [DEBUG] 合併後實體:`, entities);
          
          // 🚨 重要：強制設置 intent 為 record_course，確保後續邏輯正確執行
          intent = 'record_course';
          console.log(`🔧 [DEBUG] 強制設置 intent 為 record_course 以處理補充信息`);
        }
      }
      // 正常的多輪對話檢查（針對已完成但需要修正的情況）
      else if (intent === 'record_course' && conversationContext && conversationContext.lastAction === 'record_course') {
        const isSupplementInfo = this.detectSupplementInfo(userMessage, entities, conversationContext);
        if (isSupplementInfo) {
          console.log(`🔧 [DEBUG] 檢測到修正信息，正在合併上下文`);
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
      
      // 🔧 修復：將原始用戶輸入添加到 entities，供 _calculateDateRange 使用
      entities.originalUserInput = userMessage;
      
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
                  
                  // 🎯 Multi-student: 如果有學生信息，優先顯示
                  if (result.course.student_name) {
                    details.push(`👶 學生: ${result.course.student_name}`);
                  }
                  
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
                
                // 🚀 清除課程緩存，確保 Quick Reply 按鈕顯示最新課程
                this.clearUserCoursesCache(userId);
                
                replyMessage = successMessage + debugInfo;
              } else {
                replyMessage = (result.message || '新增課程失敗') + debugInfo;
              }
              break;
            case 'cancel_course':
              if (result.success) {
                // 🚀 清除課程緩存，確保 Quick Reply 按鈕顯示最新課程
                this.clearUserCoursesCache(userId);
                
                // 構建詳細的取消成功消息
                let successMessage = '✅ 課程已成功取消！';
                
                // 如果有被取消的課程信息，添加詳細信息
                if (result.cancelledCourse) {
                  const details = [];
                  
                  // 🎯 Multi-student: 如果有學生信息，優先顯示
                  if (result.cancelledCourse.student_name) {
                    details.push(`👶 學生: ${result.cancelledCourse.student_name}`);
                  }
                  
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
                // 🚀 清除課程緩存，確保 Quick Reply 按鈕顯示最新課程
                this.clearUserCoursesCache(userId);
                
                // 修改成功
                let successMessage = result.message;

                // 如果有更新的課程信息，添加詳細信息
                if (result.updatedCourse && result.originalCourse) {
                  const details = [];
                  
                  // 🎯 Multi-student: 如果有學生信息，優先顯示
                  if (result.updatedCourse.student_name || result.originalCourse.student_name) {
                    const studentName = result.updatedCourse.student_name || result.originalCourse.student_name;
                    details.push(`👶 學生: ${studentName}`);
                  }
                  
                  details.push(`📚 課程：${result.updatedCourse.course_name || result.originalCourse.course_name}`);
                  
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
            case 'create_recurring_course': {
              if (result.success) {
                // 使用 TaskService 返回的完整消息
                replyMessage = result.message + debugInfo;
              } else {
                replyMessage = (result.message || '創建重複課程失敗') + debugInfo;
              }
              break;
            }
            case 'modify_recurring_course': {
              if (result.success) {
                replyMessage = result.message + debugInfo;
              } else {
                replyMessage = (result.message || '修改重複課程失敗') + debugInfo;
              }
              break;
            }
            case 'stop_recurring_course': {
              if (result.success) {
                replyMessage = result.message + debugInfo;
              } else {
                replyMessage = (result.message || '停止重複課程失敗') + debugInfo;
              }
              break;
            }
            // ===============================
            // 課程內容管理意圖處理 (Course Content)
            // ===============================
            case 'record_lesson_content': {
              if (result.success) {
                // 成功記錄後詢問是否有照片
                const baseMessage = result.message;
                
                // 生成 Quick Reply 按鈕詢問是否有照片
                const photoQuickReply = {
                  items: [
                    {
                      type: "action",
                      action: {
                        type: "message",
                        label: "📸 上傳照片",
                        text: "上傳課堂照片"
                      }
                    },
                    {
                      type: "action", 
                      action: {
                        type: "message",
                        label: "✅ 沒有照片",
                        text: "沒有照片"
                      }
                    }
                  ]
                };

                // 發送帶 Quick Reply 的消息
                const messageWithQuickReply = {
                  type: 'text',
                  text: `${baseMessage}\n\n📸 需要上傳課堂照片嗎？`,
                  quickReply: photoQuickReply
                };

                const replyResult = await lineService.replyMessage(event.replyToken, messageWithQuickReply);
                console.log('Course content reply with photo option result:', replyResult);

                return {
                  success: true,
                  intent,
                  confidence,
                  result,
                  reply: replyResult,
                  photoOptionSent: true
                };
              } else {
                replyMessage = (result.message || '記錄課程內容失敗') + debugInfo;
              }
              break;
            }
            case 'record_homework': {
              if (result.success) {
                // 成功記錄後詢問是否有照片
                const baseMessage = result.message;
                
                // 生成 Quick Reply 按鈕詢問是否有照片
                const photoQuickReply = {
                  items: [
                    {
                      type: "action",
                      action: {
                        type: "message",
                        label: "📸 上傳照片",
                        text: "上傳作業照片"
                      }
                    },
                    {
                      type: "action",
                      action: {
                        type: "message", 
                        label: "✅ 沒有照片",
                        text: "沒有照片"
                      }
                    }
                  ]
                };

                // 發送帶 Quick Reply 的消息
                const messageWithQuickReply = {
                  type: 'text',
                  text: `${baseMessage}\n\n📸 需要上傳作業相關照片嗎？`,
                  quickReply: photoQuickReply
                };

                const replyResult = await lineService.replyMessage(event.replyToken, messageWithQuickReply);
                console.log('Homework reply with photo option result:', replyResult);

                return {
                  success: true,
                  intent,
                  confidence,
                  result,
                  reply: replyResult,
                  photoOptionSent: true
                };
              } else {
                replyMessage = (result.message || '記錄作業失敗') + debugInfo;
              }
              break;
            }
            case 'upload_class_photo': {
              if (result.success) {
                replyMessage = result.message + debugInfo;
              } else {
                replyMessage = (result.message || '上傳課堂照片失敗') + debugInfo;
              }
              break;
            }
            case 'query_course_content': {
              if (result.success) {
                // 格式化課程內容查詢結果
                let contentMessage = result.message;
                
                if (result.contents && result.contents.length > 0) {
                  contentMessage += '\n\n📋 最近記錄：';
                  result.contents.slice(0, 3).forEach((content, index) => {
                    contentMessage += `\n${index + 1}. `;
                    if (content.lesson_content) {
                      contentMessage += `📖 ${content.lesson_content.title || '課程內容'}`;
                    }
                    if (content.homework_assignments?.length > 0) {
                      contentMessage += ` 📝 ${content.homework_assignments.length}項作業`;
                    }
                    if (content.class_media?.length > 0) {
                      contentMessage += ` 📸 ${content.class_media.length}張照片`;
                    }
                    if (content.content_date) {
                      contentMessage += ` (${content.content_date})`;
                    }
                  });
                  
                  if (result.summary) {
                    contentMessage += `\n\n📊 統計：課程記錄${result.summary.lesson_records}筆、作業${result.summary.homework_assignments}項、照片${result.summary.media_files}張`;
                  }
                }
                
                replyMessage = contentMessage + debugInfo;
              } else {
                replyMessage = (result.message || '查詢課程內容失敗') + debugInfo;
              }
              break;
            }
            case 'modify_course_content': {
              if (result.success) {
                replyMessage = result.message + debugInfo;
              } else {
                replyMessage = (result.message || '修改課程內容失敗') + debugInfo;
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
        if (event.type === 'message') {
          let result;
          
          if (event.message.type === 'text') {
            // eslint-disable-next-line no-await-in-loop
            result = await LineController.handleTextMessage(event);
          } else if (event.message.type === 'image') {
            // eslint-disable-next-line no-await-in-loop
            result = await LineController.handleImageMessage(event);
          } else {
            console.log(`Unsupported message type: ${event.message.type}`);
            result = {
              success: true,
              message: 'Message type not supported',
            };
          }
          
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

  /**
   * 處理圖片消息 - 使用Quick Reply選擇課程
   * @param {Object} event - LINE事件對象
   * @returns {Promise<Object>} 處理結果
   */
  static async handleImageMessage(event) {
    const { message, source, replyToken } = event;
    const { userId } = source;

    console.log(`Received image message from ${userId}: ${message.id}`);
    console.log(`Reply token: ${replyToken}`);

    try {
      // 下載並上傳圖片
      const imageContent = await lineService.getMessageContent(message.id);
      
      if (!imageContent || !imageContent.success) {
        console.error('Failed to download image content');
        const errorReply = '抱歉，無法下載您的圖片，請稍後再試';
        await lineService.replyMessage(replyToken, errorReply);
        return { success: false, error: 'Failed to download image', replyToken };
      }

      const uploadResult = await this.uploadImageToStorage(imageContent.data, {
        userId,
        messageId: message.id,
        timestamp: new Date().toISOString()
      });

      if (!uploadResult.success) {
        console.error('Failed to upload image to storage');
        const errorReply = '抱歉，圖片上傳失敗，請稍後再試';
        await lineService.replyMessage(replyToken, errorReply);
        return { success: false, error: 'Failed to upload image', replyToken };
      }

      // 🎯 簡化：清除任何舊的待處理狀態，專注於當前圖片處理
      // 根據用戶反饋：內容丟失沒關係，使用簡單的Occam's razor原則
      ConversationContext.clearContext(userId);

      // 🎯 核心邏輯：生成課程選擇按鈕
      const quickReply = await this.buildCourseSelectionButtons(userId);
      
      // 暫存圖片信息，等待用戶選擇課程
      ConversationContext.setPendingImageContext(userId, {
        uploadResult,
        messageId: message.id,
        timestamp: new Date().toISOString(),
        expiresAt: Date.now() + 30000 // 30秒超時
      });

      // 發送帶Quick Reply的回覆
      const replyMessage = {
        type: 'text',
        text: '📸 收到課堂照片！這是哪門課的照片？',
        quickReply
      };

      await lineService.replyMessage(replyToken, replyMessage);

      // 🎯 簡化：移除冗余的setTimeout，getPendingImageContext已有自動過期清理機制

      return {
        success: true,
        action: 'waiting_for_course_selection',
        replyToken,
        userId,
        mediaId: uploadResult.mediaId,
        message: 'Waiting for course selection'
      };

    } catch (error) {
      console.error('Error handling image message:', error);
      
      try {
        const errorReply = '抱歉，處理您的圖片時發生錯誤，請稍後再試';
        await lineService.replyMessage(replyToken, errorReply);
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }

      return {
        success: false,
        error: error.message,
        replyToken,
        userId,
      };
    }
  }


  /**
   * 上傳圖片到存儲服務
   * @param {Buffer} imageData - 圖片數據
   * @param {Object} metadata - 元數據
   * @returns {Promise<Object>} 上傳結果
   */
  static async uploadImageToStorage(imageData, metadata) {
    try {
      const DataService = require('../services/dataService');
      
      // 生成唯一的文件名
      const fileExtension = 'jpg'; // LINE 圖片通常是 JPEG 格式
      const fileName = `course_photo_${metadata.userId}_${Date.now()}.${fileExtension}`;
      
      // 這裡應該上傳到 Firebase Storage 或其他雲存儲服務
      // TODO: 實現實際的文件上傳邏輯
      
      // 暫時模擬上傳結果
      const mockUploadResult = {
        success: true,
        mediaId: DataService.generateUUID(),
        url: `https://storage.example.com/course-photos/${fileName}`,
        fileName,
        fileSize: imageData.length,
        uploadTime: new Date().toISOString()
      };

      console.log(`📸 Image uploaded: ${fileName} (${imageData.length} bytes)`);
      
      return mockUploadResult;

    } catch (error) {
      console.error('Error uploading image to storage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取用戶課程緩存
   * @param {string} userId - 用戶ID
   * @returns {Object|null} 緩存的課程數據
   */
  static getCachedUserCourses(userId) {
    const cacheKey = `courses_${userId}`;
    const cached = this.courseCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      console.log(`💾 [Cache] 使用緩存的課程數據: ${userId}`);
      return cached.data;
    }
    
    // 過期清理
    if (cached) {
      this.courseCache.delete(cacheKey);
      console.log(`🗑️ [Cache] 清除過期的課程緩存: ${userId}`);
    }
    
    return null;
  }

  /**
   * 設置用戶課程緩存
   * @param {string} userId - 用戶ID
   * @param {Array} courses - 課程數據
   */
  static setCachedUserCourses(userId, courses) {
    const cacheKey = `courses_${userId}`;
    this.courseCache.set(cacheKey, {
      data: courses,
      expires: Date.now() + this.CACHE_EXPIRE_TIME,
      timestamp: Date.now()
    });
    
    console.log(`💾 [Cache] 緩存課程數據: ${userId} (${courses.length} 項)`);
    
    // 定期清理過期緩存
    this.cleanExpiredCache();
  }

  /**
   * 清理過期的緩存項目
   */
  static cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, value] of this.courseCache.entries()) {
      if (now >= value.expires) {
        this.courseCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🗑️ [Cache] 清理過期緩存項目: ${cleanedCount} 個`);
    }
  }

  /**
   * 清除特定用戶的課程緩存（在課程發生變化時使用）
   * @param {string} userId - 用戶ID
   */
  static clearUserCoursesCache(userId) {
    const cacheKey = `courses_${userId}`;
    const existed = this.courseCache.delete(cacheKey);
    
    if (existed) {
      console.log(`🗑️ [Cache] 手動清除用戶課程緩存: ${userId}`);
    }
  }

  /**
   * 生成課程選擇按鈕（包含角色信息和緩存）
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} Quick Reply按鈕配置
   */
  static async buildCourseSelectionButtons(userId) {
    try {
      // 🚀 嘗試從緩存獲取課程數據
      let recentCourses = this.getCachedUserCourses(userId);
      
      if (!recentCourses) {
        // 緩存未命中，從數據庫查詢
        const DataService = require('../services/dataService');
        console.log(`🔍 [Cache] 緩存未命中，查詢數據庫: ${userId}`);
        
        recentCourses = await DataService.getUserCourses(userId, { 
          status: 'scheduled' 
        });
        
        // 將結果存入緩存
        this.setCachedUserCourses(userId, recentCourses);
      }
      
      // 提取唯一課程名稱和對應的學生信息
      const courseMap = new Map();
      recentCourses.forEach(course => {
        const key = course.course_name;
        if (!courseMap.has(key)) {
          courseMap.set(key, []);
        }
        courseMap.get(key).push({
          student_id: course.student_id,
          student_name: course.student_name || this.extractStudentName(course.student_id)
        });
      });
      
      // 生成按鈕
      const buttons = [];
      let buttonCount = 0;
      const maxButtons = 10; // LINE Quick Reply最多11個按鈕，留一個給"其他課程"
      
      for (const [courseName, students] of courseMap) {
        if (buttonCount >= maxButtons) break;
        
        if (students.length === 1) {
          // 單一學生：顯示學生名稱+課程
          const student = students[0];
          const buttonText = student.student_name ? 
            `${student.student_name}的${courseName}` : 
            courseName;
          
          buttons.push({
            type: "action",
            action: {
              type: "message",
              label: buttonText,
              text: `course:${courseName}:${student.student_id}`
            }
          });
          buttonCount++;
        } else {
          // 多個學生：為每個學生生成按鈕
          for (const student of students) {
            if (buttonCount >= maxButtons) break;
            
            const buttonText = student.student_name ? 
              `${student.student_name}的${courseName}` : 
              `${courseName}(${student.student_id})`;
            
            buttons.push({
              type: "action", 
              action: {
                type: "message",
                label: buttonText,
                text: `course:${courseName}:${student.student_id}`
              }
            });
            buttonCount++;
          }
        }
      }
      
      // 添加"其他課程"按鈕
      buttons.push({
        type: "action",
        action: {
          type: "message", 
          label: "其他課程",
          text: "course:other"
        }
      });
      
      return {
        items: buttons.slice(0, 11) // LINE限制最多11個按鈕
      };
      
    } catch (error) {
      console.error('Error building course selection buttons:', error);
      
      // 返回默認按鈕
      return {
        items: [
          {
            type: "action",
            action: {
              type: "message",
              label: "數學課", 
              text: "course:數學課"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "英文課",
              text: "course:英文課"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "其他課程",
              text: "course:other"
            }
          }
        ]
      };
    }
  }

  /**
   * 處理 Quick Reply 按鈕點擊
   * @param {string} buttonMessage - 按鈕發送的訊息
   * @param {string} userId - 用戶ID
   * @param {string} replyToken - 回覆令牌
   * @returns {Promise<Object>} 處理結果
   */
  static async handleQuickReplyButtonClick(buttonMessage, userId, replyToken) {
    console.log(`📱 [QuickReply] 收到按鈕點擊: ${buttonMessage}`);

    try {
      // 解析按鈕消息格式
      if (buttonMessage.startsWith('course:')) {
        const parts = buttonMessage.split(':');
        
        if (parts.length >= 2) {
          const courseAction = parts[1];
          const studentId = parts[2] || null;
          
          if (courseAction === 'other') {
            // 處理"其他課程"按鈕
            return await this.handleOtherCourseSelection(userId, replyToken);
          } else {
            // 處理特定課程選擇
            return await this.handleCourseSelection(courseAction, studentId, userId, replyToken);
          }
        }
      }
      
      // 處理其他按鈕類型
      if (buttonMessage === '上傳課堂照片' || buttonMessage === '上傳作業照片') {
        // 設置等待照片上傳的狀態
        ConversationContext.updateContext(userId, 'waiting_for_photo', {
          photo_type: buttonMessage.includes('作業') ? 'homework' : 'lesson'
        });
        
        const replyMessage = '📸 請上傳您的照片';
        await lineService.replyMessage(replyToken, replyMessage);
        
        return {
          success: true,
          action: 'waiting_for_photo',
          message: '等待用戶上傳照片'
        };
      }
      
      if (buttonMessage === '沒有照片') {
        // 清除任何等待狀態，完成流程
        ConversationContext.clearContext(userId);
        
        const replyMessage = '✅ 記錄完成！';
        await lineService.replyMessage(replyToken, replyMessage);
        
        return {
          success: true,
          action: 'completed_without_photo',
          message: '流程完成'
        };
      }
      
      // 未知的按鈕類型
      console.warn(`⚠️ [QuickReply] 未知的按鈕消息格式: ${buttonMessage}`);
      const replyMessage = '抱歉，無法識別您的選擇，請重新操作';
      await lineService.replyMessage(replyToken, replyMessage);
      
      return {
        success: false,
        error: 'Unknown button format',
        message: '未知的按鈕格式'
      };

    } catch (error) {
      console.error('❌ [QuickReply] 處理按鈕點擊失敗:', error);
      
      try {
        const errorReply = '抱歉，處理您的選擇時發生錯誤，請稍後再試';
        await lineService.replyMessage(replyToken, errorReply);
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
      
      return {
        success: false,
        error: error.message,
        message: '處理按鈕點擊失敗'
      };
    }
  }

  /**
   * 處理"其他課程"選擇
   * @param {string} userId - 用戶ID
   * @param {string} replyToken - 回覆令牌
   * @returns {Promise<Object>} 處理結果
   */
  static async handleOtherCourseSelection(userId, replyToken) {
    // 清除待處理的圖片上下文，因為用戶選擇了其他課程
    ConversationContext.clearPendingImageContext(userId);
    
    const replyMessage = '🆕 請直接輸入課程名稱，例如："物理課"、"小明的鋼琴課"';
    await lineService.replyMessage(replyToken, replyMessage);
    
    return {
      success: true,
      action: 'other_course_prompt',
      message: '提示用戶輸入課程名稱'
    };
  }

  /**
   * 處理特定課程選擇
   * @param {string} courseName - 課程名稱
   * @param {string} studentId - 學生ID（可選）
   * @param {string} userId - 用戶ID
   * @param {string} replyToken - 回覆令牌
   * @returns {Promise<Object>} 處理結果
   */
  static async handleCourseSelection(courseName, studentId, userId, replyToken) {
    try {
      // 獲取待處理的圖片上下文
      const pendingImageContext = ConversationContext.getPendingImageContext(userId);
      
      if (!pendingImageContext) {
        // 沒有待處理的圖片，提示錯誤
        const replyMessage = '⚠️ 沒有找到待處理的照片，請重新上傳照片';
        await lineService.replyMessage(replyToken, replyMessage);
        
        return {
          success: false,
          error: 'No pending image context',
          message: '沒有待處理的照片'
        };
      }

      // 執行課程內容保存
      const taskService = this.initializeTaskService();
      
      const entities = {
        content_entities: {
          course_name: courseName,
          student_id: studentId,
          content_date: new Date().toISOString().split('T')[0],
          class_media: [{
            id: pendingImageContext.uploadResult.mediaId,
            type: 'photo',
            url: pendingImageContext.uploadResult.url,
            caption: `${courseName}課程照片`,
            upload_time: pendingImageContext.timestamp,
            tags: ['課程照片'],
            file_size: pendingImageContext.uploadResult.fileSize || 0
          }],
          raw_text: `${courseName}課程照片上傳`
        }
      };

      const result = await taskService.executeIntent('upload_class_photo', entities, userId);
      
      // 清除待處理的圖片上下文
      ConversationContext.clearPendingImageContext(userId);
      
      if (result.success) {
        const successMessage = `✅ 已保存「${courseName}」的課程照片！`;
        await lineService.replyMessage(replyToken, successMessage);
        
        return {
          success: true,
          action: 'photo_saved',
          courseName,
          studentId,
          message: successMessage
        };
      } else {
        const errorMessage = result.message || '保存課程照片失敗，請稍後再試';
        await lineService.replyMessage(replyToken, errorMessage);
        
        return {
          success: false,
          error: result.error,
          message: errorMessage
        };
      }

    } catch (error) {
      console.error('❌ [QuickReply] 處理課程選擇失敗:', error);
      
      // 清除待處理的圖片上下文
      ConversationContext.clearPendingImageContext(userId);
      
      try {
        const errorReply = '抱歉，保存課程照片時發生錯誤，請稍後再試';
        await lineService.replyMessage(replyToken, errorReply);
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
      
      return {
        success: false,
        error: error.message,
        message: '處理課程選擇失敗'
      };
    }
  }

  /**
   * 從用戶ID提取學生名稱（簡化版）
   * @param {string} studentId - 學生ID
   * @returns {string|null} 學生名稱
   */
  static extractStudentName(studentId) {
    // 這裡可以實現更複雜的學生名稱解析邏輯
    // 暫時返回null，讓系統使用課程名稱
    return null;
  }
}

module.exports = LineController;
