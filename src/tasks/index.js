/**
 * 任務處理器索引檔案
 * 統一匯出所有任務處理器函式
 */

const handle_add_course_task = require('./handle_add_course_task');
const handle_query_schedule_task = require('./handle_query_schedule_task');
const handle_record_content_task = require('./handle_record_content_task');
const handle_set_reminder_task = require('./handle_set_reminder_task');
const handle_cancel_course_task = require('./handle_cancel_course_task');

// 操作性意圖處理器（多輪對話功能）
const handle_confirm_action_task = require('./handle_confirm_action_task');
const handle_modify_action_task = require('./handle_modify_action_task');
const handle_cancel_action_task = require('./handle_cancel_action_task');
const handle_restart_input_task = require('./handle_restart_input_task');

/**
 * 任務處理器對應表
 * 意圖名稱 -> 處理器函式的映射
 */
const taskHandlers = {
  // 課程管理
  add_course: handle_add_course_task,
  create_recurring_course: handle_add_course_task, // 重複課程使用相同處理器
  query_schedule: handle_query_schedule_task,
  cancel_course: handle_cancel_course_task,
  stop_recurring_course: handle_cancel_course_task, // 停止重複課程使用相同處理器

  // 內容記錄
  record_content: handle_record_content_task,
  add_course_content: handle_record_content_task, // 內容記錄使用相同處理器

  // 提醒設定
  set_reminder: handle_set_reminder_task,

  // 操作性意圖（多輪對話功能）
  confirm_action: handle_confirm_action_task,
  modify_action: handle_modify_action_task,
  cancel_action: handle_cancel_action_task,
  restart_input: handle_restart_input_task,
};

/**
 * 根據意圖名稱取得對應的任務處理器
 * @param {string} intent - 意圖名稱
 * @returns {Function|null} 任務處理器函式
 */
function getTaskHandler(intent) {
  const handler = taskHandlers[intent];
  if (!handler) {
    console.log(`⚠️ 找不到意圖 "${intent}" 的任務處理器`);
    return null;
  }
  return handler;
}

/**
 * 執行任務處理器
 * @param {string} intent - 意圖名稱
 * @param {Object} slots - 提取的槽位資料
 * @param {string} userId - LINE 用戶ID
 * @returns {Object} 處理結果 { success: boolean, message: string }
 */
async function executeTask(intent, slots, userId) {
  try {
    const handler = getTaskHandler(intent);
    if (!handler) {
      return {
        success: false,
        message: `❌ 目前不支援「${intent}」功能，請稍後再試`,
      };
    }

    console.log(`🎯 執行任務: ${intent}`);
    const result = await handler(slots, userId);

    console.log('📊 任務執行結果:', result);
    return result;
  } catch (error) {
    console.error(`❌ 任務執行異常 (${intent}):`, error);
    return {
      success: false,
      message: '❌ 系統處理異常，請稍後再試',
    };
  }
}

/**
 * 取得所有支援的意圖列表
 * @returns {Array} 意圖名稱陣列
 */
function getSupportedIntents() {
  return Object.keys(taskHandlers);
}

module.exports = {
  // 核心函式
  getTaskHandler,
  executeTask,
  getSupportedIntents,

  // 任務處理器對應表
  taskHandlers,

  // 個別處理器（供直接引用）
  handle_add_course_task,
  handle_query_schedule_task,
  handle_record_content_task,
  handle_set_reminder_task,
  handle_cancel_course_task,

  // 操作性意圖處理器
  handle_confirm_action_task,
  handle_modify_action_task,
  handle_cancel_action_task,
  handle_restart_input_task,
};
