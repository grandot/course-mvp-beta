/**
 * 重新輸入任務處理器
 * 處理用戶想要重新開始輸入的請求
 * 清除當前對話狀態並引導用戶重新開始
 */

const { getConversationManager } = require('../conversation/ConversationManager');

/**
 * 處理重新輸入請求
 * @param {object} slots - 提取的實體
 * @param {string} userId - 用戶 ID
 * @returns {Promise<object>} 處理結果
 */
async function handle_restart_input_task(slots, userId) {
  console.log('🔄 執行重新輸入任務:', { slots, userId });
  
  try {
    const conversationManager = getConversationManager();
    
    // 取得當前對話上下文（用於日誌記錄）
    const context = await conversationManager.getContext(userId);
    const currentFlow = context.state.currentFlow;
    const lastActions = Object.keys(context.state.lastActions);
    
    console.log('🔄 重新開始前狀態:', {
      currentFlow,
      lastActions,
      expectingInput: context.state.expectingInput
    });
    
    // 清除所有對話狀態
    await conversationManager.clearContext(userId);
    
    // 提供友善的重新開始引導
    const welcomeMessage = `🔄 好的！讓我們重新開始。\n\n我可以幫您：\n• 📅 新增課程安排\n• 📋 查詢課表\n• 📝 記錄課程內容\n• ⏰ 設定課程提醒\n• 🗑️ 取消課程\n\n請告訴我您想做什麼！`;
    
    const quickReplyOptions = [
      { label: '新增課程', text: '我要新增課程' },
      { label: '查詢課表', text: '查詢今天課表' },
      { label: '記錄內容', text: '記錄課程內容' },
      { label: '設定提醒', text: '設定課程提醒' }
    ];
    
    return {
      success: true,
      message: welcomeMessage,
      quickReply: quickReplyOptions
    };
    
  } catch (error) {
    console.error('❌ 處理重新輸入失敗:', error);
    
    // 即使發生錯誤，也要嘗試清除對話狀態
    try {
      const conversationManager = getConversationManager();
      await conversationManager.clearContext(userId);
    } catch (clearError) {
      console.error('❌ 清除對話狀態失敗:', clearError);
    }
    
    return {
      success: true,
      message: '🔄 已重新開始。請告訴我您想做什麼，例如新增課程、查詢課表或記錄內容。',
      quickReply: [
        { label: '新增課程', text: '我要新增課程' },
        { label: '查詢課表', text: '查詢課表' },
        { label: '記錄內容', text: '記錄課程內容' }
      ]
    };
  }
}

module.exports = handle_restart_input_task;