/**
 * 修改課程最小處理器（暫時佔位）
 * 避免誤分流到新增/記錄，統一回覆「功能開發中」
 */

async function handle_modify_course_task(slots, userId) {
  const message = '🛠️ 修改課程功能開發中，近期開放。請先使用「取消」後重新新增或直接重新安排。';
  return {
    success: false,
    code: 'NOT_MODIFIABLE_NO_CONTEXT',
    message,
  };
}

module.exports = handle_modify_course_task;


