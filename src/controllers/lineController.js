/**
 * LINE Bot Controller - 請求接收層
 * 職責：接收 LINE Webhook、驗證簽名、處理文字訊息
 * 禁止：直接調用 openaiService, firebaseService, lineService
 * Phase 5: LINE Bot Integration
 */
const crypto = require('crypto');
const semanticService = require('../services/semanticService');
const TaskService = require('../services/taskService');
const TimeService = require('../services/timeService');
const lineService = require('../services/lineService');

class LineController {
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

    // Debug logging
    console.log('Signature verification debug:');
    console.log('- Received signature:', signature);
    console.log('- Body type:', typeof body);
    console.log('- Body length:', body ? body.length : 'null');
    console.log('- Body content (first 100 chars):', body ? body.substring(0, 100) : 'null');

    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    const expectedSignature = hash; // LINE 不使用 sha256= 前綴
    console.log('- Expected signature:', expectedSignature);

    // 檢查長度是否相同，避免 timingSafeEqual 錯誤
    if (signature.length !== expectedSignature.length) {
      console.error('Signature length mismatch:', signature.length, 'vs', expectedSignature.length);
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    console.log('- Signature valid:', isValid);
    return isValid;
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
      // 語義分析
      const analysis = await semanticService.analyzeMessage(userMessage, userId);

      if (!analysis.success) {
        return {
          success: false,
          error: 'Semantic analysis failed',
          details: analysis.error,
        };
      }

      const { intent, entities, confidence } = analysis;

      console.log(`Intent: ${intent}, Confidence: ${confidence}`);

      // ✅ 使用 TaskService 統一處理所有業務邏輯
      const result = await TaskService.executeIntent(intent, entities, userId);

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

        if (result.success === false) {
          replyMessage = result.message || '處理時發生錯誤，請稍後再試';
        } else {
          switch (intent) {
            case 'query_schedule': {
              // TaskService.handleQuerySchedule 返回 { success: true, courses: [...] }
              const courses = result.courses || [];
              replyMessage = lineService.formatCourseResponse(courses, intent);
              break;
            }
            case 'record_course':
              replyMessage = result.success ? '✅ 課程已成功新增！' : (result.message || '新增課程失敗');
              break;
            case 'cancel_course':
              replyMessage = result.success ? '✅ 課程已成功取消！' : (result.message || '取消課程失敗');
              break;
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
      return {
        success: false,
        error: error.message,
        message: '處理訊息時發生錯誤，請稍後再試',
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
