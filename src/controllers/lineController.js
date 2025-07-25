/**
 * LINE Bot Controller - 請求接收層
 * 職責：接收 LINE Webhook、驗證簽名、處理文字訊息
 * 禁止：直接調用 openaiService, firebaseService, lineService
 * Phase 5: LINE Bot Integration
 */
const crypto = require('crypto');
const semanticService = require('../services/semanticService');
const courseService = require('../services/courseService');
const TimeService = require('../services/timeService');

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

    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    const expectedSignature = `sha256=${hash}`;

    // 檢查長度是否相同，避免 timingSafeEqual 錯誤
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * 處理文字訊息事件
   * @param {Object} event - LINE 文字訊息事件
   * @returns {Promise<Object>} 處理結果
   */
  static async handleTextMessage(event) {
    const { message, source } = event;
    const { userId } = source;
    const userMessage = message.text;

    console.log(`Received message from ${userId}: ${userMessage}`);

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

      // 根據意圖調用相應的課程服務
      let result;

      switch (intent) {
        case 'record_course':
          if (entities.courseName && entities.timeInfo) {
            result = await courseService.createCourse({
              student_id: userId,
              course_name: entities.courseName,
              schedule_time: entities.timeInfo.display,
              course_date: entities.timeInfo.date,
              location: entities.location,
              teacher: entities.teacher,
            });
          } else {
            result = {
              success: false,
              error: 'Missing required course information',
              message: '請提供課程名稱和時間信息',
            };
          }
          break;

        case 'cancel_course':
          if (entities.courseName) {
            const courses = await courseService.getCoursesByUser(userId, {
              course_name: entities.courseName,
              status: 'scheduled',
            });

            if (courses.length > 0) {
              result = await courseService.cancelCourse(courses[0].id);
            } else {
              result = {
                success: false,
                error: 'Course not found',
                message: `找不到要取消的「${entities.courseName}」課程`,
              };
            }
          } else {
            result = {
              success: false,
              error: 'Missing course name',
              message: '請指定要取消的課程名稱',
            };
          }
          break;

        case 'query_schedule':
          result = await courseService.getCoursesByUser(userId, {
            status: 'scheduled',
          });
          break;

        case 'modify_course':
        case 'set_reminder':
          result = {
            success: false,
            error: 'Feature not implemented',
            message: '此功能將在後續版本中實現',
          };
          break;

        default:
          result = {
            success: false,
            error: 'Unknown intent',
            message: '抱歉，我無法理解您的需求，請重新描述',
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
    try {
      // 獲取原始 body 用於簽名驗證
      const signature = req.get('X-Line-Signature');
      const body = JSON.stringify(req.body);

      // 驗證簽名
      if (!LineController.verifySignature(signature, body)) {
        console.error('Invalid signature');
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 處理事件
      const { events } = req.body;
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
