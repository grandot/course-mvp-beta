
const { smartCourseNameMatch } = require('../src/tasks/handle_cancel_course_task');

// 模擬課程數據
const mockCourses = [
  { courseName: '跆拳道課', courseDate: '2025-08-15', cancelled: false },
  { courseName: '鋼琴課', courseDate: '2025-08-16', cancelled: false },
  { courseName: '數學課', courseDate: '2025-08-17', cancelled: false },
  { courseName: '英文課', courseDate: '2025-08-18', cancelled: true },
];

console.log('🧪 測試智能課程匹配功能');

const testCases = [
  { input: '跆拳道', expected: 1 },
  { input: '跆拳道課', expected: 1 },
  { input: '鋼琴', expected: 1 },
  { input: '*FUZZY_MATCH*', expected: 3 }, // 排除已取消的課程
  { input: '游泳', expected: 0 },
];

testCases.forEach(testCase => {
  console.log('測試輸入:', testCase.input);
  try {
    const matches = smartCourseNameMatch(testCase.input, mockCourses);
    console.log('匹配結果數量:', matches.length);
    console.log('匹配課程:', matches.map(c => c.courseName).join(', '));
    console.log('預期數量:', testCase.expected);
    console.log('狀態:', matches.length === testCase.expected ? '✅ 通過' : '❌ 失敗');
    console.log('---');
  } catch (error) {
    console.log('錯誤:', error.message);
    console.log('---');
  }
});
