/**
 * LINE Bot Controller - 請求接收層
 * 職責：接收 LINE Webhook、驗證簽名、處理文字訊息
 * 禁止：直接調用 openaiService, firebaseService, lineService
 * Phase 5: LINE Bot Integration
 * Phase 6: 增加會話上下文支持
 */
const crypto = require('crypto');
const semanticService = require('../services/semanticService');
const TaskService = require('../services/taskService');
const TimeService = require('../services/timeService');
const lineService = require('../services/lineService');
const ConversationContext = require('../utils/conversationContext');

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
   * 驗證 LINE 簽名
   * @param {string} signature - X-Line-Signature header 值
   * @param {string} body - 請求 body 原始字符串
   * @returns {boolean} 簽名是否有效
   */
  static verifySignature(signature, body) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

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

      // 計算預期簽名
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(bodyToVerify)
        .digest('base64');

      const expectedSignature = hash;
      console.log('- Expected signature length:', expectedSignature.length);

      // 檢查簽名長度是否在合理範圍內 (44-45字符都可接受)
      if (signature.length < 44 || signature.length > 45) {
        console.error('Signature length out of range:', signature.length, 'expected 44-45');
        return false;
      }

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
      
      // 語義分析 - 傳遞會話上下文
      const analysis = await semanticService.analyzeMessage(userMessage, userId, conversationContext || {});

      if (!analysis.success) {
        return {
          success: false,
          error: 'Semantic analysis failed',
          details: analysis.error,
        };
      }

      const { intent, entities, confidence } = analysis;

      console.log(`🔧 [DEBUG] 語義分析完成 - Intent: ${intent}, Confidence: ${confidence}`);
      console.log(`🔧 [DEBUG] 提取實體:`, entities);

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
