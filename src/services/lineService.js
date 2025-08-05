const axios = require('axios');

/**
 * LINE Messaging API 服務封裝
 * 處理訊息接收、回覆和推播功能
 */

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * 取得 LINE API 標頭
 */
function getLineHeaders() {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('❌ LINE_CHANNEL_ACCESS_TOKEN 環境變數未設定');
  }

  return {
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 回覆訊息
 */
async function replyMessage(replyToken, message, quickReply = null) {
  try {
    const headers = getLineHeaders();

    let messageObject;
    if (typeof message === 'string') {
      messageObject = {
        type: 'text',
        text: message,
      };
    } else {
      messageObject = message;
    }

    // 加入 Quick Reply 按鈕
    if (quickReply && quickReply.length > 0) {
      messageObject.quickReply = {
        items: quickReply.map((item) => ({
          type: 'action',
          action: {
            type: 'message',
            label: item.label,
            text: item.text || item.label,
          },
        })),
      };
    }

    const payload = {
      replyToken,
      messages: [messageObject],
    };

    const response = await axios.post(
      `${LINE_API_BASE}/message/reply`,
      payload,
      { headers },
    );

    console.log('✅ 訊息回覆成功');
    return response.data;
  } catch (error) {
    console.error('❌ 訊息回覆失敗:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 推播訊息
 */
async function pushMessage(userId, message) {
  try {
    const headers = getLineHeaders();

    let messageObject;
    if (typeof message === 'string') {
      messageObject = {
        type: 'text',
        text: message,
      };
    } else {
      messageObject = message;
    }

    const payload = {
      to: userId,
      messages: [messageObject],
    };

    const response = await axios.post(
      `${LINE_API_BASE}/message/push`,
      payload,
      { headers },
    );

    console.log('✅ 推播訊息成功');
    return response.data;
  } catch (error) {
    console.error('❌ 推播訊息失敗:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 取得使用者資料
 */
async function getUserProfile(userId) {
  try {
    const headers = getLineHeaders();

    const response = await axios.get(
      `${LINE_API_BASE}/profile/${userId}`,
      { headers },
    );

    console.log('✅ 取得使用者資料成功');
    return response.data;
  } catch (error) {
    console.error('❌ 取得使用者資料失敗:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 下載圖片內容
 */
async function getMessageContent(messageId) {
  try {
    const headers = getLineHeaders();
    
    console.log('🧪 使用中的 LINE Token 開頭:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.slice(0, 30));
    
    const url = `${LINE_API_BASE}/message/${messageId}/content`;
    console.log('🔗 請求 URL:', url);
    console.log('📋 請求 Headers:', JSON.stringify(headers, null, 2));

    const response = await axios.get(url, {
      headers,
      responseType: 'arraybuffer',
    });

    console.log('✅ 圖片內容下載成功');
    return Buffer.from(response.data);
  } catch (error) {
    console.error('❌ 圖片內容下載失敗:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 驗證 Webhook 簽名
 */
function validateSignature(body, signature) {
  if (!process.env.LINE_CHANNEL_SECRET) {
    throw new Error('❌ LINE_CHANNEL_SECRET 環境變數未設定');
  }

  const crypto = require('crypto');
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

/**
 * 創建確認按鈕訊息
 */
function createConfirmMessage(text, confirmText = '確認', cancelText = '取消') {
  return {
    type: 'template',
    altText: text,
    template: {
      type: 'confirm',
      text,
      actions: [
        {
          type: 'message',
          label: confirmText,
          text: confirmText,
        },
        {
          type: 'message',
          label: cancelText,
          text: cancelText,
        },
      ],
    },
  };
}

/**
 * 創建按鈕訊息
 */
function createButtonMessage(text, buttons) {
  return {
    type: 'template',
    altText: text,
    template: {
      type: 'buttons',
      text,
      actions: buttons.map((button) => ({
        type: 'message',
        label: button.label,
        text: button.text || button.label,
      })),
    },
  };
}

/**
 * 創建課程操作快捷按鈕
 */
function createCourseActionButtons() {
  return [
    { label: '✅ 確認', text: '確認' },
    { label: '📝 修改', text: '修改' },
    { label: '❌ 取消', text: '取消操作' },
  ];
}

/**
 * 創建查詢結果快捷按鈕
 */
function createQueryActionButtons() {
  return [
    { label: '📚 新增課程', text: '新增課程' },
    { label: '📝 記錄內容', text: '記錄課程內容' },
    { label: '⏰ 設定提醒', text: '設定提醒' },
  ];
}

/**
 * 發送提醒訊息（用於定時任務）
 */
async function sendReminder(userId, reminderData) {
  try {
    const {
      studentName, courseName, reminderNote, courseDateTime,
    } = reminderData;

    let reminderText = '⏰ 課程提醒\n\n';
    reminderText += `👦 學生：${studentName}\n`;
    reminderText += `📚 課程：${courseName}\n`;
    reminderText += `🕐 時間：${courseDateTime}\n`;

    if (reminderNote) {
      reminderText += `📌 備註：${reminderNote}\n`;
    }

    reminderText += '\n祝上課愉快！ 😊';

    await pushMessage(userId, reminderText);
    console.log('✅ 提醒訊息發送成功');
    return true;
  } catch (error) {
    console.error('❌ 提醒訊息發送失敗:', error);
    return false;
  }
}

/**
 * 格式化課程查詢結果
 */
function formatCourseList(courses, title = '課程列表') {
  if (!courses || courses.length === 0) {
    return '📅 目前沒有課程安排';
  }

  let message = `📅 ${title}\n\n`;

  courses.forEach((course, index) => {
    const timeStr = course.scheduleTime || '時間未設定';
    const dateStr = course.courseDate || '日期未設定';

    message += `${index + 1}. 📍 ${course.courseName}\n`;
    message += `   👦 ${course.studentName}\n`;
    message += `   🕐 ${dateStr} ${timeStr}\n`;

    if (course.courseRecord?.notes) {
      message += `   📝 ${course.courseRecord.notes.substring(0, 30)}...\n`;
    }

    message += '\n';
  });

  return message.trim();
}

/**
 * 測試 LINE Bot 連接
 */
async function testConnection() {
  try {
    const headers = getLineHeaders();

    // 測試 API 端點
    const response = await axios.get(
      `${LINE_API_BASE}/info`,
      { headers },
    );

    console.log('🔗 LINE Bot 連接測試成功');
    return true;
  } catch (error) {
    console.error('❌ LINE Bot 連接測試失敗:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  // 基本訊息功能
  replyMessage,
  pushMessage,
  getUserProfile,
  getMessageContent,

  // 安全驗證
  validateSignature,

  // 訊息範本
  createConfirmMessage,
  createButtonMessage,
  createCourseActionButtons,
  createQueryActionButtons,

  // 業務專用
  sendReminder,
  formatCourseList,

  // 測試連接
  testConnection,
};
