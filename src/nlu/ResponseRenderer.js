/**
 * ResponseRenderer
 * 統一回覆模板（里程碑1：先提供 Query 模板）
 */

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

module.exports = {
  renderQuery,
};


