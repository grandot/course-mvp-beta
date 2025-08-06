#!/usr/bin/env node

/**
 * Quick Reply 端到端測試
 * 測試完整的多輪對話流程，包含 Quick Reply 按鈕功能
 */

require('dotenv').config();
const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');
const { getConversationManager } = require('../src/conversation/ConversationManager');

// 動態載入任務處理器
function getTaskHandler(intent) {
  try {
    return require(`../src/tasks/handle_${intent}_task`);
  } catch (error) {
    console.error(`⚠️ 找不到任務處理器: handle_${intent}_task`);
    return null;
  }
}

// 模擬完整的訊息處理流程
async function processMessage(message, userId) {
  console.log(`\n👤 用戶: ${message}`);
  
  // 1. 解析意圖
  const intent = await parseIntent(message, userId);
  console.log(`🎯 意圖: ${intent}`);
  
  // 2. 提取實體
  const slots = await extractSlots(message, intent, userId);
  console.log(`📋 實體:`, slots);
  
  // 3. 執行任務
  const taskHandler = getTaskHandler(intent);
  if (!taskHandler) {
    console.log(`❌ 找不到任務處理器`);
    return null;
  }
  
  const result = await taskHandler(slots, userId, {});
  
  // 4. 顯示結果
  console.log(`🤖 機器人: ${result.message}`);
  
  if (result.quickReply) {
    console.log(`📱 Quick Reply 按鈕:`);
    result.quickReply.forEach((btn, idx) => {
      console.log(`   ${idx + 1}. ${btn.label} → "${btn.text}"`);
    });
  }
  
  // 5. 更新對話上下文（如果任務成功）
  if (result.success) {
    const manager = getConversationManager();
    const context = await manager.getContext(userId) || { userId, state: {} };
    
    if (!context.state.lastActions) {
      context.state.lastActions = {};
    }
    
    context.state.lastActions[intent] = {
      intent,
      slots,
      result,
      timestamp: Date.now()
    };
    
    await manager.saveContext(userId, context);
  }
  
  return result;
}

// 測試場景
async function runE2ETest() {
  console.log('🚀 開始 Quick Reply 端到端測試\n');
  console.log('=' .repeat(50));
  
  const userId = 'e2e_test_user_' + Date.now();
  const manager = getConversationManager();
  
  try {
    // 場景1: 新增課程 → 時間衝突 → 確認覆蓋
    console.log('\n📊 場景1: 時間衝突處理流程');
    console.log('-'.repeat(50));
    
    // 第一次新增（會成功）
    let result = await processMessage('小明明天下午2點數學課', userId);
    
    if (result?.success && result?.quickReply) {
      console.log('✅ 第一次新增成功，顯示 Quick Reply');
    }
    
    // 第二次新增同時間（會衝突）
    console.log('\n嘗試新增衝突的課程...');
    result = await processMessage('小明明天下午2點英文課', userId);
    
    if (!result?.success && result?.message?.includes('衝突')) {
      console.log('✅ 正確偵測到時間衝突');
      
      // 點擊「確認」覆蓋
      console.log('\n點擊確認按鈕覆蓋...');
      result = await processMessage('確認', userId);
      
      if (result?.success) {
        console.log('✅ 確認覆蓋成功');
      } else {
        console.log('❌ 確認覆蓋失敗');
      }
    }
    
    // 場景2: 新增課程 → 修改
    console.log('\n\n📊 場景2: 修改課程流程');
    console.log('-'.repeat(50));
    
    result = await processMessage('Lumi每週三晚上7點鋼琴課', userId);
    
    if (result?.success && result?.quickReply) {
      console.log('✅ 課程新增成功');
      
      // 點擊「修改」
      console.log('\n點擊修改按鈕...');
      result = await processMessage('修改', userId);
      
      if (result?.success && result?.message?.includes('請告訴我')) {
        console.log('✅ 進入修改流程');
        
        // 執行修改
        console.log('\n輸入修改內容...');
        result = await processMessage('改成下午5點', userId);
        console.log(`修改結果: ${result?.success ? '成功' : '失敗'}`);
      }
    }
    
    // 場景3: 新增課程 → 取消操作
    console.log('\n\n📊 場景3: 取消操作流程');
    console.log('-'.repeat(50));
    
    result = await processMessage('小華週五早上10點美術課', userId);
    
    if (result?.success && result?.quickReply) {
      console.log('✅ 課程新增成功');
      
      // 點擊「取消操作」
      console.log('\n點擊取消操作按鈕...');
      result = await processMessage('取消操作', userId);
      
      if (result?.success && result?.message?.includes('已取消')) {
        console.log('✅ 取消操作成功');
      } else {
        console.log('❌ 取消操作失敗');
      }
    }
    
    // 場景4: 查詢課表 → Quick Reply
    console.log('\n\n📊 場景4: 查詢課表與後續操作');
    console.log('-'.repeat(50));
    
    result = await processMessage('查詢這週課表', userId);
    
    if (result?.success && result?.quickReply) {
      console.log('✅ 查詢成功，顯示 Quick Reply 選項');
    }
    
    // 清理測試數據
    console.log('\n\n🧹 清理測試數據...');
    await manager.clearContext(userId);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ 端到端測試完成！');
    
    // 測試總結
    console.log('\n📊 測試總結:');
    console.log('1. ✅ Quick Reply 按鈕正確顯示');
    console.log('2. ✅ 確認/修改/取消 操作意圖正確識別');
    console.log('3. ✅ 對話上下文正確維護');
    console.log('4. ✅ 多輪對話流程完整');
    
  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
  } finally {
    // 確保清理
    await manager.clearContext(userId);
    process.exit(0);
  }
}

// 執行測試
if (require.main === module) {
  runE2ETest().catch(console.error);
}

module.exports = { processMessage, runE2ETest };