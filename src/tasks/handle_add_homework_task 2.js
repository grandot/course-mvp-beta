/**
 * 最小版：新增作業/練習記錄
 * 先落存到 homework 集合；若未提供內容或學生/課程，可引導補充
 */

const firebaseService = require('../services/firebaseService');

function validate(slots) {
  const missing = [];
  if (!slots.studentName) missing.push('學生姓名');
  if (!slots.courseName) missing.push('課程名稱');
  if (!slots.content && !slots.homework) missing.push('作業內容');
  return missing;
}

async function handle_add_homework_task(slots, userId) {
  const missing = validate(slots);
  if (missing.length > 0) {
    return {
      success: false,
      code: 'MISSING_FIELDS',
      message: `❓ 請提供以下資訊：${missing.join('、')}`,
      expectingInput: true,
      missingFields: missing,
    };
  }

  const record = {
    userId,
    studentName: slots.studentName,
    courseName: slots.courseName,
    content: slots.content || slots.homework,
    createdAt: new Date().toISOString(),
  };

  const doc = await firebaseService.addDocument('homeworks', record);
  return {
    success: true,
    code: 'HOMEWORK_ADDED',
    message: `✅ 已為 ${slots.studentName} 的 ${slots.courseName} 新增作業/練習內容`,
    data: { homeworkId: doc.id },
  };
}

module.exports = handle_add_homework_task;
