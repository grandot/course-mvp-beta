/**
 * LINE Service - LINE Bot API 調用服務
 * 職責：發送回覆訊息、處理 LINE API 調用
 * 限制：僅供內部服務調用，外部應通過 LineController
 */
const https = require('https');

class LineService {
  /**
   * 發送回覆訊息給 LINE 用戶
   * @param {string} replyToken - LINE reply token
   * @param {Object|Array} messages - 要發送的訊息
   * @return {Promise<Object>} 發送結果
   */
  static async replyMessage(replyToken, messages) {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
    }

    if (!replyToken) {
      throw new Error('replyToken is required');
    }

    // 確保 messages 是陣列格式
    const messageArray = Array.isArray(messages) ? messages : [messages];

    const requestBody = {
      replyToken,
      messages: messageArray.map((msg) => {
        if (typeof msg === 'string') {
          return {
            type: 'text',
            text: msg,
          };
        }
        
        // 🚀 Quick Reply 支援：驗證和處理 Quick Reply 格式
        if (msg && typeof msg === 'object') {
          // 驗證基本消息格式
          if (!msg.type) {
            console.warn('⚠️ [LINE Service] 消息缺少 type 字段:', msg);
            msg.type = 'text'; // 默認為文字消息
          }
          
          // 🎯 Quick Reply 格式驗證
          if (msg.quickReply) {
            if (!msg.quickReply.items || !Array.isArray(msg.quickReply.items)) {
              console.error('❌ [LINE Service] Quick Reply 格式錯誤: items 必須是陣列');
              delete msg.quickReply; // 移除無效的 Quick Reply
            } else if (msg.quickReply.items.length > 13) {
              console.warn('⚠️ [LINE Service] Quick Reply 按鈕數量超過限制，截取前13個');
              msg.quickReply.items = msg.quickReply.items.slice(0, 13);
            } else {
              console.log(`📱 [LINE Service] 發送 Quick Reply，按鈕數量: ${msg.quickReply.items.length}`);
            }
          }
        }
        
        return msg;
      }),
    };

    console.log('Sending LINE reply:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.makeLineApiRequest(
        'POST',
        '/v2/bot/message/reply',
        requestBody,
        accessToken,
      );

      console.log('LINE API response:', response);

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error('LINE API error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 發送 LINE API 請求
   * @param {string} method - HTTP 方法
   * @param {string} path - API 路徑
   * @param {Object} data - 請求數據
   * @param {string} accessToken - Access Token
   * @return {Promise<Object>} API 響應
   */
  static makeLineApiRequest(method, path, data, accessToken) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);

      const options = {
        hostname: 'api.line.me',
        port: 443,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = responseData ? JSON.parse(responseData) : {};

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                statusCode: res.statusCode,
                data: response,
              });
            } else {
              reject(new Error(`LINE API error: ${res.statusCode} - ${responseData}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse LINE API response: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`LINE API request failed: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 獲取消息內容（圖片、音頻等）
   * @param {string} messageId - 消息ID
   * @returns {Promise<Object>} 消息內容
   */
  static async getMessageContent(messageId) {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
    }

    if (!messageId) {
      throw new Error('messageId is required');
    }

    try {
      const response = await this.makeLineContentRequest(
        'GET',
        `/v2/bot/message/${messageId}/content`,
        accessToken
      );

      return {
        success: true,
        data: response.data,
        contentType: response.contentType
      };
    } catch (error) {
      console.error('Failed to get message content:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 發送 LINE Content API 請求（用於下載媒體內容）
   * @param {string} method - HTTP 方法
   * @param {string} path - API 路徑
   * @param {string} accessToken - Access Token
   * @returns {Promise<Object>} API 響應
   */
  static makeLineContentRequest(method, path, accessToken) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api-data.line.me',
        port: 443,
        path,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        let contentType = res.headers['content-type'];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const buffer = Buffer.concat(chunks);
            resolve({
              statusCode: res.statusCode,
              data: buffer,
              contentType
            });
          } else {
            reject(new Error(`LINE Content API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`LINE Content API request failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * 創建帶 Quick Reply 的文字消息
   * @param {string} text - 消息文字
   * @param {Array} quickReplyItems - Quick Reply 按鈕陣列
   * @returns {Object} LINE 消息對象
   */
  static createQuickReplyMessage(text, quickReplyItems) {
    if (!text) {
      throw new Error('Message text is required');
    }

    const message = {
      type: 'text',
      text: text
    };

    if (quickReplyItems && Array.isArray(quickReplyItems) && quickReplyItems.length > 0) {
      // 限制按鈕數量
      const limitedItems = quickReplyItems.slice(0, 13);
      
      message.quickReply = {
        items: limitedItems
      };

      console.log(`📱 [LINE Service] 創建 Quick Reply 消息，按鈕數量: ${limitedItems.length}`);
    }

    return message;
  }

  /**
   * 創建 Quick Reply 按鈕
   * @param {string} label - 按鈕標籤
   * @param {string} text - 點擊後發送的文字
   * @returns {Object} Quick Reply 按鈕對象
   */
  static createQuickReplyButton(label, text) {
    if (!label || !text) {
      throw new Error('Button label and text are required');
    }

    // 確保 label 不超過 LINE API 的 20 字符限制
    const limitedLabel = label.length > 20 ? label.substring(0, 20) : label;

    return {
      type: "action",
      action: {
        type: "message",
        label: limitedLabel,
        text: text
      }
    };
  }

  /**
   * 格式化課程查詢結果為 LINE 訊息
   * @param {Array} courses - 課程陣列
   * @param {string} intent - 意圖類型
   * @return {string} 格式化的回覆訊息
   */
  static formatCourseResponse(courses, intent) {
    switch (intent) {
      case 'query_schedule': {
        if (!courses || courses.length === 0) {
          return '📅 目前沒有安排課程\n\n您可以發送「明天2點數學課」來新增課程';
        }

        let message = '📅 您的課程安排：\n\n';
        courses.forEach((course, index) => {
          // 🎯 使用正確的 display_text 而不是硬編碼格式
          if (course.display_text) {
            message += `${index + 1}. ${course.display_text}\n\n`;
          } else {
            // fallback 到舊格式
            message += `${index + 1}. ${course.course_name}\n`;
            message += `🕒 ${course.schedule_time}\n`;
            if (course.location) {
              message += `📍 ${course.location}\n`;
            }
            if (course.teacher) {
              message += `👨‍🏫 ${course.teacher}\n`;
            }
            message += '\n';
          }
        });
        return message.trim();
      }

      case 'record_course':
        return '✅ 課程已成功新增！';

      case 'cancel_course':
        return '✅ 課程已成功取消！';

      default:
        return '✅ 操作完成！';
    }
  }
}

module.exports = LineService;
