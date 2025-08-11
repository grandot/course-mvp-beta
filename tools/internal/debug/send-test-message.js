#!/usr/bin/env node

/**
 * 測試訊息發送工具
 * 模擬 LINE 用戶發送訊息給機器人，用於測試各種功能
 */

// 載入環境變數
require('dotenv').config();
const path = require('path');

// 專案根目錄（從 tools/internal/debug/ 往上三層）
const ROOT = path.resolve(__dirname, '../../..');

const { parseIntent } = require(path.join(ROOT, 'src/intent/parseIntent'));
const { extractSlots } = require(path.join(ROOT, 'src/intent/extractSlots'));

// 模擬用戶資料
const TEST_USER_ID = 'TEST_USER_12345';
const TEST_REPLY_TOKEN = 'TEST_REPLY_TOKEN';

/**
 * 模擬執行任務處理器
 */
async function simulateTaskExecution(intent, slots, userId) {
  try {
    console.log('🎯 模擬執行任務:', intent);
    console.log('📋 slots:', JSON.stringify(slots, null, 2));

    const TASKS_DIR = path.join(ROOT, 'src/tasks');
    // 動態載入對應的任務處理器（改成絕對路徑）
    const taskHandlers = {
      add_course: path.join(TASKS_DIR, 'handle_add_course_task'),
      create_recurring_course: path.join(TASKS_DIR, 'handle_add_course_task'),
      query_schedule: path.join(TASKS_DIR, 'handle_query_schedule_task'),
      record_content: path.join(TASKS_DIR, 'handle_record_content_task'),
      add_course_content: path.join(TASKS_DIR, 'handle_record_content_task'),
      set_reminder: path.join(TASKS_DIR, 'handle_set_reminder_task'),
      cancel_course: path.join(TASKS_DIR, 'handle_cancel_course_task'),
      stop_recurring_course: path.join(TASKS_DIR, 'handle_cancel_course_task'),
    };

    if (!taskHandlers[intent]) {
      return { success: false, message: `❓ 任務處理器 ${intent} 尚未實作` };
    }

    const handlerPath = taskHandlers[intent];
    const handler = require(handlerPath);
    const result = await handler(slots, userId);

    return result;
  } catch (error) {
    console.error('❌ 任務執行失敗:', error);
    return { success: false, message: `❌ 執行失敗: ${error.message}` };
  }
}

/**
 * 測試主函式
 */
async function testMessage(message) {
  console.log('='.repeat(60));
  console.log('🤖 課程管理機器人測試工具');
  console.log('='.repeat(60));
  console.log('📝 測試訊息:', message);
  console.log('👤 測試用戶:', TEST_USER_ID);
  console.log('-'.repeat(60));

  try {
    // 第一步：意圖識別
    console.log('🎯 開始意圖識別...');
    const intent = await parseIntent(message);
    console.log('✅ 識別結果:', intent);

    if (intent === 'unknown') {
      console.log('❓ 無法識別意圖，測試結束');
      return;
    }

    // 第二步：實體提取
    console.log('\n🔍 開始實體提取...');
    const slots = await extractSlots(message, intent, TEST_USER_ID);
    console.log('✅ 提取結果:', JSON.stringify(slots, null, 2));

    // 第三步：任務執行
    console.log('\n⚙️ 開始任務執行...');
    const result = await simulateTaskExecution(intent, slots, TEST_USER_ID);

    console.log('\n📤 機器人回應:');
    console.log('-'.repeat(40));
    console.log(result.message);
    console.log('-'.repeat(40));

    if (result.success) {
      console.log('✅ 測試成功完成');
      if (result.data) {
        console.log('📊 附加資料:', JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log('❌ 測試失敗');
    }
  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error);
  }

  console.log('='.repeat(60));
}

/**
 * 批量測試常見語句
 */
async function runBatchTests() {
  const testCases = [
    // 新增課程測試
    '小明每週三下午3點數學課',
    'Lumi星期五要上鋼琴課',
    '小光明天上午10點的英文課',

    // 查詢測試
    '小明今天有什麼課？',
    '查詢Lumi這週的課表',
    '看一下小光明天的安排',

    // 其他測試
    '今天天氣如何？', // 應該無法識別
    '你好', // 應該無法識別
  ];

  console.log('🧪 開始批量測試...\n');

  for (let i = 0; i < testCases.length; i++) {
    console.log(`\n🧪 測試案例 ${i + 1}/${testCases.length}`);
    await testMessage(testCases[i]);

    if (i < testCases.length - 1) {
      console.log('\n⏳ 等待 2 秒後繼續...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🎉 批量測試完成！');
}

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📖 使用方法:');
    console.log('  單一測試: node tools/internal/debug/send-test-message.js "測試訊息"');
    console.log('  批量測試: node tools/internal/debug/send-test-message.js --batch');
    console.log('');
    console.log('📝 測試範例:');
    console.log('  node tools/internal/debug/send-test-message.js "小明每週三下午3點數學課"');
    console.log('  node tools/internal/debug/send-test-message.js "查詢小明今天的課程"');
    return;
  }

  if (args[0] === '--batch') {
    await runBatchTests();
  } else {
    const message = args.join(' ');
    await testMessage(message);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 測試工具執行失敗:', error);
    process.exit(1);
  });
}

module.exports = {
  testMessage,
  runBatchTests,
};