#!/usr/bin/env node

/**
 * 多輪對話功能測試工具
 * 測試各種多輪對話場景，包括：
 * - Quick Reply 按鈕處理
 * - 上下文感知的意圖識別
 * - 操作性意圖處理
 * - 對話狀態管理
 */

require('dotenv').config();
const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');
const { executeTask } = require('../src/tasks');
const { getConversationManager } = require('../src/conversation/ConversationManager');

// 測試用戶 ID
const TEST_USER_ID = 'test_multi_turn_user_123';

// 測試顏色標記
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 模擬用戶對話並測試回應
 */
async function simulateConversation(userMessage, expectation = null) {
  try {
    colorLog('blue', `\n🗣️ 用戶：${userMessage}`);
    
    // 1. 意圖識別
    const intent = await parseIntent(userMessage, TEST_USER_ID);
    console.log(`🎯 識別意圖：${intent}`);
    
    // 2. 實體提取
    const slots = await extractSlots(userMessage, intent, TEST_USER_ID);
    console.log(`📋 提取slots：`, slots);
    
    // 3. 任務執行
    const result = await executeTask(intent, slots, TEST_USER_ID);
    
    // 4. 記錄對話到上下文
    const conversationManager = getConversationManager();
    await conversationManager.recordUserMessage(TEST_USER_ID, userMessage, intent, slots);
    await conversationManager.recordTaskResult(TEST_USER_ID, intent, slots, result);
    
    // 5. 顯示結果
    if (result.success) {
      colorLog('green', `✅ 機器人：${result.message}`);
      if (result.quickReply && result.quickReply.length > 0) {
        console.log('📱 Quick Reply 按鈕：');
        result.quickReply.forEach((btn, index) => {
          console.log(`   ${index + 1}. ${btn.label} (${btn.text})`);
        });
      }
    } else {
      colorLog('red', `❌ 機器人：${result.message}`);
    }
    
    // 6. 驗證期望結果
    if (expectation) {
      if (expectation.intent && intent !== expectation.intent) {
        colorLog('red', `❌ 意圖識別錯誤：期望 ${expectation.intent}，實際 ${intent}`);
      }
      if (expectation.success !== undefined && result.success !== expectation.success) {
        colorLog('red', `❌ 任務執行結果錯誤：期望 ${expectation.success}，實際 ${result.success}`);
      }
      if (expectation.hasQuickReply && (!result.quickReply || result.quickReply.length === 0)) {
        colorLog('red', `❌ 缺少預期的 Quick Reply 按鈕`);
      }
    }
    
    return { intent, slots, result };
    
  } catch (error) {
    colorLog('red', `❌ 對話模擬失敗：${error.message}`);
    return null;
  }
}

/**
 * 測試場景 1：基礎課程新增 + Quick Reply 確認
 */
async function testScenario1() {
  colorLog('cyan', '\n=== 測試場景 1：基礎課程新增 + Quick Reply 確認 ===');
  
  // 第一輪：新增課程
  await simulateConversation(
    '小明明天下午2點數學課',
    { intent: 'add_course', success: true, hasQuickReply: true }
  );
  
  // 第二輪：點擊確認按鈕
  await simulateConversation(
    '確認',
    { intent: 'confirm_action', success: true }
  );
}

/**
 * 測試場景 2：課程新增 + 修改操作
 */
async function testScenario2() {
  colorLog('cyan', '\n=== 測試場景 2：課程新增 + 修改操作 ===');
  
  // 第一輪：新增課程
  await simulateConversation(
    'Lumi每週三晚上7點英文課',
    { intent: 'create_recurring_course', success: true, hasQuickReply: true }
  );
  
  // 第二輪：點擊修改按鈕
  await simulateConversation(
    '修改',
    { intent: 'modify_action', success: true }
  );
  
  // 第三輪：具體修改指令
  await simulateConversation(
    '修改時間到下午5點',
    { intent: 'modify_course' }
  );
}

/**
 * 測試場景 3：上下文感知的實體提取
 */
async function testScenario3() {
  colorLog('cyan', '\n=== 測試場景 3：上下文感知的實體提取 ===');
  
  // 第一輪：提及學生和課程
  await simulateConversation(
    '小華明天有鋼琴課',
    { intent: 'add_course', success: true }
  );
  
  // 第二輪：只提及動作，應該能從上下文推斷學生和課程
  await simulateConversation(
    '設定提醒',
    { intent: 'set_reminder' }
  );
  
  // 第三輪：記錄內容，應該能推斷是哪個學生的哪堂課
  await simulateConversation(
    '今天表現很好',
    { intent: 'record_content' }
  );
}

/**
 * 測試場景 4：取消操作
 */
async function testScenario4() {
  colorLog('cyan', '\n=== 測試場景 4：取消操作流程 ===');
  
  // 第一輪：新增課程
  await simulateConversation(
    '安排小光游泳課',
    { intent: 'add_course', success: true, hasQuickReply: true }
  );
  
  // 第二輪：取消操作
  await simulateConversation(
    '取消操作',
    { intent: 'cancel_action', success: true }
  );
  
  // 第三輪：重新開始
  await simulateConversation(
    '重新開始',
    { intent: 'restart_input', success: true }
  );
}

/**
 * 測試場景 5：複雜多輪對話
 */
async function testScenario5() {
  colorLog('cyan', '\n=== 測試場景 5：複雜多輪對話 ===');
  
  // 創建完整的課程管理對話流程
  await simulateConversation('小美每週二下午3點美術課');
  await simulateConversation('確認');
  await simulateConversation('記錄今天課程內容：學會了水彩畫技巧');
  await simulateConversation('確認');
  await simulateConversation('查詢這週課表');
  await simulateConversation('設定美術課提醒');
  await simulateConversation('確認');
}

/**
 * 測試 Redis 連接和對話狀態管理
 */
async function testConversationManager() {
  colorLog('cyan', '\n=== 測試對話狀態管理 ===');
  
  try {
    const conversationManager = getConversationManager();
    
    // 健康檢查
    const health = await conversationManager.healthCheck();
    console.log('🏥 對話管理器健康狀態：', health);
    
    if (health.status === 'healthy') {
      colorLog('green', '✅ Redis 連接正常，多輪對話功能可用');
    } else {
      colorLog('yellow', '⚠️ Redis 不可用，將降級為無狀態處理');
    }
    
    // 測試上下文操作
    const testContext = await conversationManager.getContext(TEST_USER_ID);
    console.log('📋 測試用戶上下文：', testContext ? '存在' : '不存在');
    
    if (testContext) {
      console.log('📝 對話歷史記錄數：', testContext.state.history.length);
      console.log('🧠 提及的實體：', testContext.state.mentionedEntities);
    }
    
  } catch (error) {
    colorLog('red', `❌ 對話管理器測試失敗：${error.message}`);
  }
}

/**
 * 清理測試資料
 */
async function cleanup() {
  try {
    const conversationManager = getConversationManager();
    await conversationManager.clearContext(TEST_USER_ID);
    colorLog('green', '🧹 測試資料清理完成');
  } catch (error) {
    console.warn('⚠️ 清理測試資料失敗：', error.message);
  }
}

/**
 * 主測試函式
 */
async function runAllTests() {
  colorLog('bright', '🚀 開始多輪對話功能測試\n');
  
  try {
    // 清理之前的測試資料
    await cleanup();
    
    // 測試對話管理器
    await testConversationManager();
    
    // 基礎功能測試
    await testScenario1();
    await testScenario2();
    await testScenario3();
    await testScenario4();
    
    // 複雜場景測試
    await testScenario5();
    
    colorLog('green', '\n✅ 所有測試完成！');
    
    // 顯示最終的對話狀態
    const conversationManager = getConversationManager();
    const finalContext = await conversationManager.getContext(TEST_USER_ID);
    if (finalContext) {
      colorLog('blue', '\n📊 最終對話狀態統計：');
      console.log(`• 對話輪數：${finalContext.state.history.length}`);
      console.log(`• 執行的操作：${Object.keys(finalContext.state.lastActions).length}`);
      console.log(`• 提及的學生：${finalContext.state.mentionedEntities.students.join(', ')}`);
      console.log(`• 提及的課程：${finalContext.state.mentionedEntities.courses.join(', ')}`);
    }
    
  } catch (error) {
    colorLog('red', `❌ 測試執行失敗：${error.message}`);
  } finally {
    // 最終清理
    await cleanup();
    process.exit(0);
  }
}

// 如果直接執行此文件
if (require.main === module) {
  runAllTests();
}

module.exports = {
  simulateConversation,
  testConversationManager,
  runAllTests
};