/**
 * 最小版：查詢最近一筆課程內容記錄
 */

const firebaseService = require('../services/firebaseService');

async function handle_query_course_content_task(slots, userId) {
  const studentName = slots.studentName;
  const courseName = slots.courseName;
  if (!studentName || !courseName) {
    return {
      success: false,
      code: 'MISSING_FIELDS',
      message: '❓ 請提供學生姓名與課程名稱，例如：「小明昨天數學課學了什麼？」',
      expectingInput: true,
      missingFields: [!studentName && '學生姓名', !courseName && '課程名稱'].filter(Boolean),
    };
  }

  // 查詢：先用必要條件 where，再在記憶體排序，避免複合索引阻塞
  const baseQuery = firebaseService.getCollection('course_contents')
    .where('userId', '==', userId)
    .where('studentName', '==', studentName)
    .where('courseName', '==', courseName);
  const querySnap = await baseQuery.get();
  if (querySnap.empty) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: `❌ 找不到 ${studentName} 的 ${courseName} 內容記錄`,
    };
  }

  // 轉為時間戳排序，缺失時回退 recordDate/updatedAt
  const toTs = (doc) => {
    const created = doc.createdAt ? Date.parse(doc.createdAt) : NaN;
    const updated = doc.updatedAt ? Date.parse(doc.updatedAt) : NaN;
    const record = doc.recordDate ? Date.parse(doc.recordDate) : NaN;
    return [created, updated, record].find((v) => !Number.isNaN(v)) || 0;
  };
  const docs = querySnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toTs(b) - toTs(a));
  const latest = docs[0];

  const data = latest;
  const content = data.content || '(無文字內容)';
  const date = data.recordDate || data.createdAt?.split('T')[0] || '';

  return {
    success: true,
    code: 'QUERY_CONTENT_OK',
    message: `📘 最近一次的內容記錄\n👨‍🎓 學生：${studentName}\n📚 課程：${courseName}\n📅 日期：${date}\n💬 內容：${content}`,
    data: { recordId: latest.id },
  };
}

module.exports = handle_query_course_content_task;

