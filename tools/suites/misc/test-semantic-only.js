#!/usr/bin/env node

/**
 * 純語意處理測試工具
 * 只測試意圖識別和實體提取，不依賴外部服務
 */

// 載入環境變數
require('dotenv').config();

const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');

/**
 * 測試語意處理
 */
async function testSemanticProcessing(message) {
  console.log('='.repeat(60));
  console.log('🧠 語意處理測試工具');
  console.log('='.repeat(60));
  console.log('📝 測試訊息:', message);
  console.log('-'.repeat(60));
  
  try {
    // 第一步：意圖識別
    console.log('🎯 開始意圖識別...');
    const intent = await parseIntent(message);
    console.log('✅ 識別結果:', intent);
    
    if (intent === 'unknown') {
      console.log('❓ 無法識別意圖');
      return { intent, slots: {} };
    }
    
    // 第二步：實體提取
    console.log('\n🔍 開始實體提取...');
    const slots = await extractSlots(message, intent);
    console.log('✅ 提取結果:', JSON.stringify(slots, null, 2));
    
    return { intent, slots };
    
  } catch (error) {
    console.error('❌ 語意處理失敗:', error);
    return { intent: 'error', slots: {} };
  } finally {
    console.log('='.repeat(60));
  }
}

/**
 * 批量測試
 */
async function runBatchTests() {
  const testCases = [
    // 新增課程測試
    { message: '小明每週三下午3點數學課', expected: 'create_recurring_course' },
    { message: 'Lumi星期五要上鋼琴課', expected: 'add_course' },
    { message: '小光明天上午10點的英文課', expected: 'add_course' },
    { message: '安排小美後天下午2點美術課', expected: 'add_course' },
    
    // 查詢測試
    { message: '小明今天有什麼課？', expected: 'query_schedule' },
    { message: '查詢Lumi這週的課表', expected: 'query_schedule' },
    { message: '看一下小光明天的安排', expected: 'query_schedule' },
    { message: '今天有課嗎', expected: 'query_schedule' },
    
    // 記錄內容測試
    { message: '今天小明的數學課學了分數', expected: 'add_course_content' },
    { message: '記錄昨天英文課的內容', expected: 'add_course_content' },
    { message: '老師說小光表現很好', expected: 'add_course_content' },
    
    // 設定提醒測試
    { message: '提醒我小明的數學課', expected: 'set_reminder' },
    { message: '鋼琴課前30分鐘通知我', expected: 'set_reminder' },
    
    // 取消課程測試
    { message: '取消小明明天的數學課', expected: 'cancel_course' },
    { message: '刪掉Lumi的鋼琴課', expected: 'cancel_course' },
    
    // 無法識別的測試
    { message: '今天天氣如何？', expected: 'unknown' },
    { message: '你好', expected: 'unknown' },
  ];
  
  console.log('🧪 開始批量語意測試...\n');
  
  let successCount = 0;
  let totalCount = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 測試案例 ${i + 1}/${totalCount}`);
    
    const result = await testSemanticProcessing(testCase.message);
    
    // 檢查預期結果
    if (result.intent === testCase.expected) {
      console.log('✅ 意圖識別正確');
      successCount++;
    } else {
      console.log(`❌ 意圖識別錯誤 - 預期: ${testCase.expected}, 實際: ${result.intent}`);
    }
    
    // 顯示詳細的 slots 資訊
    if (Object.keys(result.slots).length > 0) {
      console.log('📋 提取的實體:', JSON.stringify(result.slots, null, 2));
    }
    
    if (i < testCases.length - 1) {
      console.log('\n⏳ 等待 1 秒後繼續...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 批量測試完成！');
  console.log(`📊 成功率: ${successCount}/${totalCount} (${(successCount/totalCount*100).toFixed(1)}%)`);
  console.log('='.repeat(60));
}

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📖 使用方法:');
    console.log('  單一測試: node tools/test-semantic-only.js "測試訊息"');
    console.log('  批量測試: node tools/test-semantic-only.js --batch');
    console.log('');
    console.log('📝 測試範例:');
    console.log('  node tools/test-semantic-only.js "小明每週三下午3點數學課"');
    console.log('  node tools/test-semantic-only.js "查詢小明今天的課程"');
    return;
  }
  
  if (args[0] === '--batch') {
    await runBatchTests();
  } else {
    const message = args.join(' ');
    await testSemanticProcessing(message);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 測試工具執行失敗:', error);
    process.exit(1);
  });
}

module.exports = {
  testSemanticProcessing,
  runBatchTests
};