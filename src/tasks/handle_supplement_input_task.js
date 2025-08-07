/**
 * 處理補充缺失資訊的通用任務處理器
 * 當用戶提供缺失的資訊時（如學生姓名、課程名稱等），將資訊整合並重新執行原任務
 */

const { getConversationManager } = require('../conversation/ConversationManager');
const { extractSlots } = require('../intent/extractSlots');

/**
 * 處理學生姓名補充
 */
async function handle_supplement_student_name_task(slots, userId, event) {
  return await handleSupplementInput(userId, event.message.text, 'studentName', 'student_name_input');
}

/**
 * 處理課程名稱補充
 */
async function handle_supplement_course_name_task(slots, userId, event) {
  return await handleSupplementInput(userId, event.message.text, 'courseName', 'course_name_input');
}

/**
 * 處理上課時間補充
 */
async function handle_supplement_schedule_time_task(slots, userId, event) {
  return await handleSupplementInput(userId, event.message.text, 'scheduleTime', 'schedule_time_input');
}

/**
 * 處理課程日期補充
 */
async function handle_supplement_course_date_task(slots, userId, event) {
  return await handleSupplementInput(userId, event.message.text, 'courseDate', 'course_date_input');
}

/**
 * 處理星期幾補充
 */
async function handle_supplement_day_of_week_task(slots, userId, event) {
  return await handleSupplementInput(userId, event.message.text, 'dayOfWeek', 'day_of_week_input');
}

/**
 * 通用補充資訊處理邏輯
 * @param {string} userId - 用戶 ID
 * @param {string} userInput - 用戶輸入的補充資訊
 * @param {string} slotName - 要補充的 slot 名稱
 * @param {string} inputType - 期待的輸入類型
 * @returns {Promise<object>} 處理結果
 */
async function handleSupplementInput(userId, userInput, slotName, inputType) {
  console.log(`🔧 處理 ${slotName} 補充:`, userInput);

  try {
    const conversationManager = getConversationManager();

    // 取得對話上下文
    const context = await conversationManager.getContext(userId);
    if (!context || !context.state.pendingData) {
      return {
        success: false,
        message: '❌ 找不到待處理的資訊，請重新開始。',
      };
    }

    const { intent, existingSlots } = context.state.pendingData.slots;
    console.log('📋 原始意圖:', intent);
    console.log('📋 現有 slots:', existingSlots);

    // 根據補充類型提取對應的值
    let supplementValue;

    switch (slotName) {
      case 'studentName':
        supplementValue = userInput.trim();
        break;
      case 'courseName':
        supplementValue = userInput.trim();
        break;
      case 'scheduleTime':
        // 使用時間解析器處理時間
        const { parseTime } = require('../intent/timeParser');
        const timeResult = parseTime(userInput);
        supplementValue = timeResult.output || userInput.trim();
        break;
      case 'courseDate':
        supplementValue = userInput.trim();
        break;
      case 'dayOfWeek':
        supplementValue = userInput.trim();
        break;
      default:
        supplementValue = userInput.trim();
    }

    // 更新 slots 資料
    const updatedSlots = {
      ...existingSlots,
      [slotName]: supplementValue,
    };

    console.log('✅ 更新後的 slots:', updatedSlots);

    // 動態載入原始任務處理器
    const originalTaskHandler = require(`./handle_${intent}_task`);

    // 清除期待輸入狀態
    await conversationManager.clearExpectedInput(userId);

    // 重新執行原始任務
    console.log(`🔄 重新執行 ${intent} 任務`);
    const result = await originalTaskHandler(updatedSlots, userId, {
      message: { text: `已補充 ${slotName}: ${supplementValue}` },
    });

    // 如果還有缺失資訊，會再次設定期待輸入狀態
    if (!result.success && result.expectingInput) {
      return {
        success: false,
        message: result.message,
        expectingInput: true,
      };
    }

    return result;
  } catch (error) {
    console.error(`❌ 處理 ${slotName} 補充失敗:`, error);

    // 清除期待輸入狀態以防止卡住
    const conversationManager = getConversationManager();
    await conversationManager.clearExpectedInput(userId);

    return {
      success: false,
      message: '❌ 處理補充資訊時發生錯誤，請重新開始。',
    };
  }
}

module.exports = {
  handle_supplement_student_name_task,
  handle_supplement_course_name_task,
  handle_supplement_schedule_time_task,
  handle_supplement_course_date_task,
  handle_supplement_day_of_week_task,
};
