/**
 * 修改操作任務處理器
 * 處理 Quick Reply 按鈕的「修改」操作
 * 引導用戶進入修改流程
 */

const { getConversationManager } = require('../conversation/ConversationManager');

/**
 * 處理修改操作
 * @param {object} slots - 從上下文繼承的實體
 * @param {string} userId - 用戶 ID
 * @param {object} event - LINE 事件物件
 * @returns {Promise<object>} 處理結果
 */
async function handle_modify_action_task(slots, userId, event) {
  console.log('✏️ 執行修改操作任務:', { slots, userId });
  
  try {
    const conversationManager = getConversationManager();
    
    // 取得最近的操作上下文
    const context = await conversationManager.getContext(userId);
    if (!context || !context.state.lastActions) {
      return {
        success: false,
        message: '❓ 沒有找到需要修改的操作。請重新輸入您的需求。'
      };
    }
    
    // 取得最新的操作（按時間戳排序）
    const lastAction = Object.values(context.state.lastActions)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const { intent, slots: originalSlots } = lastAction;
    
    console.log('📝 修改操作詳情:', {
      intent,
      originalSlots
    });
    
    // 設定期待修改輸入的狀態
    await conversationManager.setExpectedInput(userId, 'course_modification', [
      'time_modification',
      'date_modification', 
      'course_name_modification',
      'cancel_modification'
    ], originalSlots);
    
    // 根據操作類型提供修改指引
    let modifyGuide = '';
    
    switch (intent) {
      case 'add_course':
        modifyGuide = `📝 請告訴我您要修改什麼：

目前課程資訊：
• 學生：${originalSlots.studentName || '未指定'}
• 課程：${originalSlots.courseName || '未指定'}
• 時間：${originalSlots.scheduleTime || '未指定'}
• 日期：${originalSlots.courseDate || originalSlots.dayOfWeek ? `每週${originalSlots.dayOfWeek}` : '未指定'}

修改範例：
• 「改成下午3點」
• 「改成明天」
• 「改成英文課」
• 「改成每週二」`;
        break;
        
      case 'record_content':
        modifyGuide = `📝 請告訴我您要修改什麼：

目前記錄資訊：
• 學生：${originalSlots.studentName || '未指定'}
• 課程：${originalSlots.courseName || '未指定'}
• 內容：${originalSlots.content ? originalSlots.content.substring(0, 50) + '...' : '未指定'}

修改範例：
• 「改成今天學了ABC」
• 「改成數學課」`;
        break;
        
      case 'set_reminder':
        modifyGuide = `📝 請告訴我您要修改什麼：

目前提醒設定：
• 學生：${originalSlots.studentName || '未指定'}
• 課程：${originalSlots.courseName || '未指定'}
• 提前時間：${originalSlots.reminderTime || 30} 分鐘

修改範例：
• 「改成提前1小時」
• 「改成提前15分鐘」`;
        break;
        
      default:
        modifyGuide = `📝 請告訴我您要修改的內容，或輸入「取消」放棄修改。`;
    }
    
    return {
      success: true,
      message: modifyGuide,
      quickReply: [
        { label: '🕐 修改時間', text: '改成下午3點' },
        { label: '📅 修改日期', text: '改成明天' },
        { label: '📚 修改課程', text: '改成英文課' },
        { label: '❌ 取消修改', text: '取消修改' }
      ]
    };
    
  } catch (error) {
    console.error('❌ 處理修改操作失敗:', error);
    return {
      success: false,
      message: '❌ 修改操作時發生錯誤，請稍後再試。'
    };
  }
}

module.exports = handle_modify_action_task;