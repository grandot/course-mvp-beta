/**
 * 取消操作任務處理器
 * 處理 Quick Reply 按鈕的「取消操作」
 * 實際執行取消剛才的操作（如刪除剛新增的課程）
 */

const { getConversationManager } = require('../conversation/ConversationManager');
const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');

/**
 * 處理取消操作
 * @param {object} slots - 從上下文繼承的實體
 * @param {string} userId - 用戶 ID
 * @param {object} event - LINE 事件物件
 * @returns {Promise<object>} 處理結果
 */
async function handle_cancel_action_task(slots, userId, event) {
  console.log('❌ 執行取消操作任務:', { slots, userId });
  
  try {
    const conversationManager = getConversationManager();
    
    // 取得最近的操作上下文
    const context = await conversationManager.getContext(userId);
    if (!context || !context.state.lastActions) {
      return {
        success: false,
        message: '❓ 沒有找到需要取消的操作。'
      };
    }
    
    // 取得最新的操作（按時間戳排序）
    const lastAction = Object.values(context.state.lastActions)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const { intent, slots: originalSlots, result: originalResult } = lastAction;
    
    console.log('📝 取消操作詳情:', {
      intent,
      originalSlots,
      wasSuccessful: originalResult?.success
    });
    
    // 如果原操作成功，需要實際撤銷操作
    if (originalResult?.success && originalResult?.data) {
      console.log('⚠️ 撤銷已成功的操作');
      
      try {
        switch (intent) {
          case 'add_course':
            // 刪除已新增的課程
            if (originalResult.data.courseId) {
              await firebaseService.deleteDocument('courses', originalResult.data.courseId);
              console.log('✅ 已從 Firebase 刪除課程:', originalResult.data.courseId);
            }
            
            if (originalResult.data.eventId && originalSlots.studentName) {
              const calendarId = await googleCalendarService.getStudentCalendarId(originalSlots.studentName);
              if (calendarId) {
                await googleCalendarService.deleteEvent(calendarId, originalResult.data.eventId);
                console.log('✅ 已從 Google Calendar 刪除事件:', originalResult.data.eventId);
              }
            }
            
            // 清理對話狀態
            await conversationManager.clearExpectedInput(userId);
            delete context.state.lastActions[intent];
            await conversationManager.saveContext(userId, context);
            
            return {
              success: true,
              message: `❌ 已取消剛才的課程安排\n\n📚 已刪除：${originalSlots.studentName}的${originalSlots.courseName}`,
              quickReply: [
                { label: '📅 新增課程', text: '新增課程' },
                { label: '📅 查詢課表', text: '查詢今天課表' }
              ]
            };
            
          case 'record_content':
            // 刪除已記錄的內容
            if (originalResult.data?.recordId) {
              await firebaseService.deleteDocument('course_contents', originalResult.data.recordId);
              console.log('✅ 已刪除課程內容記錄:', originalResult.data.recordId);
            }
            
            await conversationManager.clearExpectedInput(userId);
            delete context.state.lastActions[intent];
            await conversationManager.saveContext(userId, context);
            
            return {
              success: true,
              message: `❌ 已取消剛才的內容記錄`,
              quickReply: [
                { label: '📝 重新記錄', text: '記錄課程內容' },
                { label: '📅 查詢課表', text: '查詢今天課表' }
              ]
            };
            
          case 'set_reminder':
            // 取消已設定的提醒
            if (originalResult.data?.reminderId) {
              await firebaseService.deleteDocument('reminders', originalResult.data.reminderId);
              console.log('✅ 已取消提醒設定:', originalResult.data.reminderId);
            }
            
            await conversationManager.clearExpectedInput(userId);
            delete context.state.lastActions[intent];
            await conversationManager.saveContext(userId, context);
            
            return {
              success: true,
              message: `❌ 已取消剛才的提醒設定`,
              quickReply: [
                { label: '⏰ 重新設定', text: '設定提醒' },
                { label: '📅 查詢課表', text: '查詢今天課表' }
              ]
            };
            
          default:
            // 其他操作的取消
            await conversationManager.clearExpectedInput(userId);
            delete context.state.lastActions[intent];
            await conversationManager.saveContext(userId, context);
            
            return {
              success: true,
              message: `❌ 已取消剛才的操作`,
              quickReply: [
                { label: '📅 新增課程', text: '新增課程' },
                { label: '📅 查詢課表', text: '查詢今天課表' }
              ]
            };
        }
      } catch (error) {
        console.error('❌ 撤銷操作失敗:', error);
        return {
          success: false,
          message: '❌ 撤銷操作時發生錯誤，請手動檢查並處理。'
        };
      }
    }
    
    // 如果原操作失敗或還在處理中，只需清理狀態
    await conversationManager.clearExpectedInput(userId);
    delete context.state.lastActions[intent];
    await conversationManager.saveContext(userId, context);
    
    return {
      success: true,
      message: `❌ 已取消操作\n\n您可以重新開始：`,
      quickReply: [
        { label: '📅 新增課程', text: '新增課程' },
        { label: '📅 查詢課表', text: '查詢今天課表' },
        { label: '📝 記錄內容', text: '記錄課程內容' }
      ]
    };
    
  } catch (error) {
    console.error('❌ 處理取消操作失敗:', error);
    return {
      success: false,
      message: '❌ 取消操作時發生錯誤，請稍後再試。'
    };
  }
}

module.exports = handle_cancel_action_task;