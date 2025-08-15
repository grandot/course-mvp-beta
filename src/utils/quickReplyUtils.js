/**
 * QuickReply 消息包裹工具
 * 處理 QuickReply 按鈕點擊後的消息格式轉換
 */

/**
 * QuickReply 包裹符號
 */
const QUICKREPLY_BRACKETS = {
  START: '【',
  END: '】',
};

/**
 * 檢查消息是否為 QuickReply 包裹格式
 * @param {string} message - 用戶消息
 * @returns {boolean} 是否為 QuickReply 包裹格式
 */
function isQuickReplyWrapped(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  return message.startsWith(QUICKREPLY_BRACKETS.START)
         && message.endsWith(QUICKREPLY_BRACKETS.END);
}

/**
 * 將 QuickReply 文字包裹為特殊格式
 * @param {string} text - QuickReply 原始文字
 * @returns {string} 包裹後的文字
 */
function wrapQuickReplyText(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // 避免重複包裹
  if (isQuickReplyWrapped(text)) {
    return text;
  }

  return `${QUICKREPLY_BRACKETS.START}${text}${QUICKREPLY_BRACKETS.END}`;
}

/**
 * 從包裹格式中提取原始 QuickReply 文字
 * @param {string} wrappedText - 包裹後的文字
 * @returns {string} 原始文字
 */
function unwrapQuickReplyText(wrappedText) {
  if (!wrappedText || typeof wrappedText !== 'string') {
    return wrappedText;
  }

  // 如果不是包裹格式，直接返回
  if (!isQuickReplyWrapped(wrappedText)) {
    return wrappedText;
  }

  // 移除包裹符號
  return wrappedText.slice(
    QUICKREPLY_BRACKETS.START.length,
    -QUICKREPLY_BRACKETS.END.length,
  ).trim();
}

/**
 * 檢查消息是否可能來自 QuickReply 按鈕點擊
 * 使用啟發式方法判斷：
 * 1. 短消息（通常 QuickReply 標籤較短）
 * 2. 包含常見的 QuickReply 關鍵詞
 * @param {string} message - 用戶消息
 * @returns {boolean} 是否可能來自 QuickReply
 */
function isPotentialQuickReplyMessage(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  // 已經是包裹格式，不需要處理
  if (isQuickReplyWrapped(message)) {
    return false;
  }

  const trimmedMessage = message.trim();

  // 精準的 QuickReply 選項列表（基於實際 webhook.js 中的 QuickReply 按鈕）
  const exactQuickReplyOptions = [
    // 確認操作
    '確認', '確認刪除',

    // 取消操作
    '取消', '取消操作',

    // 課程操作
    '修改', '刪除', '新增', '查詢', '記錄',

    // 簡單回應
    '是', '否', '好', '不要',

    // 時間相關
    '今天', '明天', '昨天',

    // 重複課程操作
    '只取消今天', '取消之後全部', '刪除整個重複',

    // 常見功能按鈕
    '新增課程', '查詢課表', '記錄內容', '設定提醒',
  ];

  // 只有完全匹配已知 QuickReply 選項才包裝
  return exactQuickReplyOptions.includes(trimmedMessage);
}

/**
 * 處理 QuickReply 消息的主函數
 * 如果消息可能來自 QuickReply，則包裹它
 * @param {string} message - 原始消息
 * @returns {object} 處理結果 { processedMessage, wasWrapped, originalMessage }
 */
function processQuickReplyMessage(message) {
  const result = {
    processedMessage: message,
    wasWrapped: false,
    originalMessage: message,
  };

  // 檢查是否需要包裹
  if (isPotentialQuickReplyMessage(message)) {
    result.processedMessage = wrapQuickReplyText(message);
    result.wasWrapped = true;
  }

  return result;
}

/**
 * 獲取用於後端處理的純淨消息（移除包裹符號）
 * @param {string} message - 可能包裹的消息
 * @returns {string} 用於處理的純淨消息
 */
function getCleanMessageForProcessing(message) {
  return unwrapQuickReplyText(message);
}

/**
 * 記錄 QuickReply 處理信息（用於調試）
 * @param {string} originalMessage - 原始消息
 * @param {string} processedMessage - 處理後消息
 * @param {boolean} wasWrapped - 是否被包裹
 */
function logQuickReplyProcessing(originalMessage, processedMessage, wasWrapped) {
  if (wasWrapped) {
    console.log('🔘 QuickReply 消息包裹:', {
      original: originalMessage,
      processed: processedMessage,
    });
  }
}

module.exports = {
  // 主要功能
  wrapQuickReplyText,
  unwrapQuickReplyText,
  processQuickReplyMessage,
  getCleanMessageForProcessing,

  // 檢查功能
  isQuickReplyWrapped,
  isPotentialQuickReplyMessage,

  // 工具功能
  logQuickReplyProcessing,

  // 常量
  QUICKREPLY_BRACKETS,
};
