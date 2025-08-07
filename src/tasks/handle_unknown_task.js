/**
 * 處理無法識別意圖的任務 - 簡化版
 */

async function handle_unknown_task(slots, userId, messageEvent = null) {
  try {
    console.log('❓ 處理無法識別的意圖');

    const helpMessage = `😊 不太理解您的意思，試試這些功能：

• 新增課程：「小明明天上午10點英文課」
• 查詢課程：「查詢小明的課表」  
• 記錄內容：「記錄昨天數學課的內容」
• 設定提醒：「設定提醒」

💡 您也可以直接告訴我想要做什麼，我會盡力幫助您！`;

    return {
      success: true,
      message: helpMessage,
      quickReply: [
        { label: '📅 新增課程', text: '新增課程' },
        { label: '📋 查詢課表', text: '查詢課表' },
        { label: '📝 記錄內容', text: '記錄內容' },
        { label: '⏰ 設定提醒', text: '設定提醒' },
      ],
    };
  } catch (error) {
    console.error('❌ 處理unknown意圖失敗:', error);
    return {
      success: false,
      message: '😅 系統暫時無法理解您的需求，請稍後再試。',
    };
  }
}

module.exports = handle_unknown_task;
