/**
 * ResponseRenderer
 * 統一回覆模板（里程碑1：先提供 Query 與錯誤碼模板）
 */

function mapTimeReference(timeRef) {
  switch (timeRef) {
    case 'today':
      return '今天';
    case 'tomorrow':
      return '明天';
    case 'yesterday':
      return '昨天';
    case 'this_week':
    case '本週':
      return '本週';
    case 'next_week':
      return '下週';
    case 'last_week':
      return '上週';
    default:
      return '';
  }
}

function renderQuery(studentName, dateDescription, courses, suggestion = true) {
  const title = `📅 ${studentName ? studentName : '所有學生'}${dateDescription}的課表`;
  if (!courses || courses.length === 0) {
    const base = `${title.replace('的課表', '')}沒有安排課程`;
    if (!suggestion) return base;
    return (
      base +
      '\n\n' +
      '🔎 指引：\n' +
      '• 查詢：「小明下週的課表」\n' +
      '• 新增：「小明明天上午10點英文課」\n' +
      '• 記錄：「記錄昨天數學課的內容」'
    );
  }
  return null; // 非空清單沿用現有格式化（由任務層生成），里程碑2再統一
}

function renderError(code, slots = {}) {
  switch (code) {
    case 'MISSING_STUDENT':
      return '❌ 請提供學生姓名。';
    case 'MISSING_COURSE':
      return '❌ 請提供課程名稱。';
    case 'NOT_FOUND':
      return `❌ 找不到 ${slots.studentName || '該學生'} 的 ${slots.courseName || '指定課程'}，請確認是否存在`;
    case 'PAST_COURSE':
      return '❌ 課程時間已過，無法執行此操作';
    case 'PAST_REMINDER_TIME':
      return '❌ 提醒時間已過，請設定更早的提醒時間';
    case 'RECURRING_CANCEL_OPTIONS':
      return '請問是要取消哪個範圍？\n\n🔘 只取消今天\n🔘 取消明天起所有課程\n🔘 刪除整個重複課程';
    case 'FEATURE_UNDER_DEVELOPMENT':
      return '🛠️ 修改課程功能開發中，近期開放。請先使用「取消」後重新新增或直接重新安排。';
    default:
      return '❌ 處理訊息時發生錯誤，請稍後再試。';
  }
}

function render(intent, slots, taskResult) {
  // 錯誤優先：若處理器回傳失敗且有自帶訊息，優先使用；否則使用模板
  if (taskResult && taskResult.success === false) {
    return taskResult.message || renderError(taskResult.code, slots);
  }

  // Query 空結果統一模板，其餘沿用任務層訊息
  if (intent === 'query_schedule') {
    const courses = taskResult?.data?.courses || [];
    const courseCount = taskResult?.data?.courseCount || 0;
    if (courseCount === 0 || courses.length === 0) {
      const student = slots.studentName || null;
      const desc = mapTimeReference(slots.timeReference) || (taskResult?.data?.dateRange?.description || '本週');
      return renderQuery(student, desc, [], true);
    }
  }

  // 預設：沿用處理器訊息
  return taskResult?.message || '😊 不太理解您的意思，試試這些功能：';
}

module.exports = {
  render,
  renderQuery,
  renderError,
  mapTimeReference,
};


