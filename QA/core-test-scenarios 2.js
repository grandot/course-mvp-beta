/**
 * 10個核心功能測試場景
 * 基於第一性原則挑選最關鍵功能驗證點
 * 覆蓋：新增、查詢、記錄、修改、重複課程等核心流程
 */

const coreTestScenarios = [
  {
    name: 'T1-新增單次課程-標準格式',
    purpose: '驗證系統基礎課程解析能力',
    input: '測試小明明天下午2點要上測試數學課',
    expected: '✅ 課程已安排成功',
    expectedKeywords: ['課程', '安排', '成功', '測試小明', '測試數學課'],
    priority: 'critical',
    category: 'add_course'
  },
  
  {
    name: 'T2-新增重複課程-每週',
    purpose: '驗證週期性課程功能',
    input: '測試Lumi每週三下午3點要上測試鋼琴課',
    expected: '✅ 課程已安排成功',
    expectedKeywords: ['課程', '安排', '成功', '測試Lumi', '測試鋼琴課', '每週'],
    priority: 'critical',
    category: 'recurring_course'
  },

  {
    name: 'T3-新增每日重複課程',
    purpose: '驗證每日重複功能（v1.3.4新功能）',
    input: '測試小明每天早上8點測試晨練課',
    expected: '✅ 課程已安排成功',
    expectedKeywords: ['課程', '安排', '成功', '測試小明', '測試晨練課', '每天'],
    priority: 'high',
    category: 'daily_recurring',
    environment: 'ENABLE_DAILY_RECURRING=true'
  },
  
  {
    name: 'T4-資訊補充流程-缺少學生',
    purpose: '驗證多輪對話機制',
    input: '明天下午3點要上測試數學課',
    expected: '請提供以下資訊：學生姓名',
    expectedKeywords: ['請提供', '學生姓名', '資訊'],
    priority: 'critical',
    category: 'multi_dialogue'
  },
  
  {
    name: 'T5-查詢今日課程',
    purpose: '驗證課程查詢功能',
    input: '測試小明今天有什麼課？',
    expected: '今天的課程如下',
    expectedKeywords: ['課程', '今天'],
    priority: 'high',
    category: 'query_course',
    note: '需要預先建立今日課程'
  },
  
  {
    name: 'T6-時間格式多樣性',
    purpose: '驗證複雜時間解析',
    input: '測試Lumi後天晚上八點半要上測試鋼琴課',
    expected: '✅ 課程已安排成功',
    expectedKeywords: ['課程', '安排', '成功'],
    priority: 'medium',
    category: 'time_parsing',
    known_issue: 'render_timezone_issue'
  },
  
  {
    name: 'T7-記錄課程內容',
    purpose: '驗證內容記錄功能',
    input: '今天測試小明的測試數學課學了分數加減法',
    expected: '已記錄.*測試數學課.*的內容',
    expectedKeywords: ['記錄', '內容', '測試數學課'],
    priority: 'medium',
    category: 'record_content',
    note: '需要預先建立課程'
  },
  
  {
    name: 'T8-時間衝突檢測',
    purpose: '驗證衝突識別機制',
    input: '測試小明明天下午2點要上測試英文課',
    expected: '時間衝突',
    expectedKeywords: ['時間衝突', '確認'],
    priority: 'high',
    category: 'conflict_detection',
    note: '需要預先建立相同時間課程'
  },
  
  {
    name: 'T9-錯誤輸入處理',
    purpose: '驗證錯誤處理能力',
    input: '測試小明明天25點上測試數學課',
    expected: '時間格式不正確',
    expectedKeywords: ['時間格式', '不正確', '重新輸入'],
    priority: 'medium',
    category: 'error_handling'
  },
  
  {
    name: 'T10-意圖識別邊界',
    purpose: '驗證意圖分類準確性',
    input: '我想了解一下課程安排的情況',
    expected: '請問您想查詢課程表，還是要新增課程',
    expectedKeywords: ['查詢', '新增', '課程'],
    priority: 'medium',
    category: 'intent_boundary'
  }
];

module.exports = {
  coreTestScenarios,
  
  // 便利方法
  getCriticalTests: () => coreTestScenarios.filter(t => t.priority === 'critical'),
  getTestsByCategory: (category) => coreTestScenarios.filter(t => t.category === category),
  getTotalTestCount: () => coreTestScenarios.length
};