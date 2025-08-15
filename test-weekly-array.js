/**
 * 測試週間多日重複課程展開功能
 */
const handle_query_schedule_task = require('./src/tasks/handle_query_schedule_task');

async function testWeeklyArrayExpansion() {
  console.log('🧪 測試週間多日重複課程展開（週一三五）\n');
  
  // 模擬課程資料
  const mockCourses = [
    {
      studentName: 'Lumi',
      courseName: '半趣味科學課',
      scheduleTime: '15:30',
      courseDate: '2025-08-18', // 週一
      recurring: true,
      recurrenceType: 'weekly',
      dayOfWeek: [1, 3, 5], // 週一、週三、週五
      cancelled: false
    }
  ];
  
  // 模擬 Firebase 服務
  const mockFirebaseService = {
    getCoursesByStudent: async () => mockCourses,
    getOrCreateParent: async () => ({
      students: [{ studentName: 'Lumi' }]
    })
  };
  
  // 注入 mock
  require.cache[require.resolve('./src/services/firebaseService')] = {
    exports: mockFirebaseService
  };
  
  // 測試查詢下週課表
  const result = await handle_query_schedule_task(
    { studentName: 'Lumi', dateRange: 'next_week' },
    'test-user'
  );
  
  console.log('測試結果：');
  console.log('Success:', result.success);
  console.log('\n回覆訊息：');
  console.log(result.message);
  
  // 驗證是否包含週一、週三、週五
  const hasMonday = result.message.includes('8/18') || result.message.includes('週一');
  const hasWednesday = result.message.includes('8/20') || result.message.includes('週三');
  const hasFriday = result.message.includes('8/22') || result.message.includes('週五');
  
  console.log('\n驗證結果：');
  console.log('✅ 包含週一課程:', hasMonday);
  console.log('✅ 包含週三課程:', hasWednesday);
  console.log('✅ 包含週五課程:', hasFriday);
  
  if (hasMonday && hasWednesday && hasFriday) {
    console.log('\n🎉 測試通過！所有重複課程都正確展開');
  } else {
    console.log('\n❌ 測試失敗！部分重複課程未正確展開');
  }
}

testWeeklyArrayExpansion().catch(console.error);