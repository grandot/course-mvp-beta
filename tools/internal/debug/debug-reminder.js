#!/usr/bin/env node

// 載入環境變數
require('dotenv').config();

const { 
  extractStudentName, 
  extractCourseName,
  parseTimeReference
} = require('../src/intent/extractSlots');

/**
 * 測試特定語句的各項提取
 */
function testReminderExtraction() {
  console.log('🧪 測試提醒功能的 slot 提取');
  console.log('=' .repeat(50));
  
  const message = '提醒我小明明天的數學課';
  
  console.log(`📝 測試語句: "${message}"`);
  console.log();
  
  // 測試學生姓名提取
  const studentName = extractStudentName(message);
  console.log(`👤 學生姓名: "${studentName}"`);
  
  // 手動測試過濾邏輯
  console.log('\n🔍 過濾邏輯測試:');
  const testNames = ['小明明天', '小明'];
  const invalidNames = [
    '今天', '明天', '昨天', '每週', '查詢', '提醒', '取消', '看一下', '記錄', 
    '老師說', '這週', '下週', '上週', '安排', '刪掉', '表現', '很好', '內容',
    '一下', '表現很', '提醒我', '明天的', '今天的', '昨天的'
  ];
  
  testNames.forEach(testName => {
    const containsInvalid = invalidNames.some(invalid => 
      testName.includes(invalid) || testName === invalid
    );
    
    console.log(`測試名稱 "${testName}": ${containsInvalid ? '被過濾' : '通過'}`);
    
    if (containsInvalid) {
      const triggeredWords = invalidNames.filter(invalid => 
        testName.includes(invalid) || testName === invalid
      );
      console.log(`  觸發過濾的詞彙: ${triggeredWords.join(', ')}`);
    }
  });
  
  // 測試課程名稱提取
  const courseName = extractCourseName(message);
  console.log(`📚 課程名稱: "${courseName}"`);
  
  // 測試時間參考提取
  const timeReference = parseTimeReference(message);
  console.log(`⏰ 時間參考: "${timeReference}"`);
  
  // 測試正則表達式匹配
  console.log('\n🔍 正則表達式匹配測試:');
  
  const studentPatterns = [
    { name: '提醒我XX明天|昨天|今天|的（修復）', regex: /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3})(?=明天|今天|昨天|的)/ },
    { name: '提醒我XX明天|今天|昨天|的', regex: /提醒.*?我.*?([小大]?[一-龥A-Za-z]{2,6})(?=明天|今天|昨天|的)/ },
    { name: '提醒我XX的', regex: /提醒.*?我.*?([小大]?[一-龥A-Za-z]{2,6})的/ },
    { name: '今天|昨天|明天XX的', regex: /(?:今天|昨天|明天)([小大]?[一-龥A-Za-z]{2,6})的/ },
    { name: 'XX的課', regex: /([小大]?[一-龥A-Za-z]{2,6})的.*課/ }
  ];
  
  studentPatterns.forEach(({ name, regex }) => {
    const match = message.match(regex);
    if (match) {
      console.log(`✅ ${name}: "${match[0]}" → "${match[1]}"`);
    } else {
      console.log(`❌ ${name}: 無匹配`);
    }
  });
}

// 執行測試
testReminderExtraction();