/**
 * 確認操作任務處理器
 * 處理 Quick Reply 按鈕的「確認」操作
 * 實際執行被確認的操作（如覆蓋時間衝突的課程）
 */

const { getConversationManager } = require('../conversation/ConversationManager');

/**
 * 處理確認操作
 * @param {object} slots - 從上下文繼承的實體
 * @param {string} userId - 用戶 ID
 * @param {object} event - LINE 事件物件
 * @returns {Promise<object>} 處理結果
 */
async function handle_confirm_action_task(slots, userId, event) {
  console.log('✅ 執行確認操作任務:', { slots, userId });
  
  try {
    const conversationManager = getConversationManager();
    
    // 取得最近的操作上下文
    const context = await conversationManager.getContext(userId);
    if (!context || !context.state.lastActions) {
      return {
        success: false,
        message: '❓ 沒有找到需要確認的操作。請重新輸入您的需求。'
      };
    }
    
    // 找出最近的操作
    const lastActionKeys = Object.keys(context.state.lastActions);
    if (lastActionKeys.length === 0) {
      return {
        success: false,
        message: '❓ 沒有找到需要確認的操作。'
      };
    }
    
    // 取得最新的操作（按時間戳排序）
    const lastAction = Object.values(context.state.lastActions)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const { intent, slots: originalSlots, result: originalResult } = lastAction;
    
    console.log('📝 確認操作詳情:', {
      intent,
      originalSlots,
      needsOverride: originalResult && !originalResult.success
    });
    
    // 如果原操作失敗（如時間衝突），需要加上覆蓋標記重新執行
    if (originalResult && !originalResult.success && originalResult.message && originalResult.message.includes('衝突')) {
      console.log('⚠️ 偵測到時間衝突，執行覆蓋操作');
      
      // 根據意圖類型重新執行（加上覆蓋標記）
      try {
        const taskHandler = require(`.${intent === 'add_course' ? '/handle_add_course_task' : `/handle_${intent}_task`}`);
        
        // 加上覆蓋標記
        const overrideSlots = {
          ...originalSlots,
          ...slots, // 合併從上下文繼承的 slots
          forceOverride: true // 標記強制覆蓋
        };
        
        const result = await taskHandler(overrideSlots, userId, event);
        
        // 清理對話狀態
        await conversationManager.clearExpectedInput(userId);
        
        // 返回執行結果
        if (result.success) {
          return {
            success: true,
            message: `✅ 已成功覆蓋並${intent === 'add_course' ? '新增' : '更新'}課程！\n\n${result.message}`,
            quickReply: [
              { label: '📅 查詢課表', text: '查詢今天課表' },
              { label: '📝 記錄內容', text: '記錄課程內容' }
            ]
          };
        } else {
          return result;
        }
        
      } catch (error) {
        console.error('❌ 執行覆蓋操作失敗:', error);
        return {
          success: false,
          message: '❌ 執行操作時發生錯誤，請稍後再試。'
        };
      }
    }
    
    // 如果原操作已成功，只是單純確認
    await conversationManager.clearExpectedInput(userId);
    
    // 根據操作類型回傳確認訊息
    const confirmMessages = {
      add_course: `✅ 課程安排已確認！\n📚 ${originalSlots.studentName}的${originalSlots.courseName}`,
      record_content: `✅ 課程內容已確認記錄！\n📝 ${originalSlots.content || '內容已儲存'}`,
      set_reminder: `✅ 提醒已確認設定！\n⏰ 將在課前${originalSlots.reminderTime || 30}分鐘提醒`,
      cancel_course: `✅ 課程已確認取消！\n🗑️ ${originalSlots.courseName || '課程'}已移除`,
      query_schedule: `✅ 查詢完成！`
    };
    
    return {
      success: true,
      message: confirmMessages[intent] || `✅ 已確認執行操作！`,
      quickReply: [
        { label: '📅 查詢課表', text: '查詢今天課表' },
        { label: '📅 新增課程', text: '新增課程' },
        { label: '📝 記錄內容', text: '記錄課程內容' }
      ]
    };
    
  } catch (error) {
    console.error('❌ 處理確認操作失敗:', error);
    return {
      success: false,
      message: '❌ 確認操作時發生錯誤，請稍後再試。'
    };
  }
}

module.exports = handle_confirm_action_task;