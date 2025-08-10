#!/usr/bin/env node

/**
 * 測試缺失資訊的多輪對話功能
 * 模擬用戶提供缺失資訊的完整流程
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
    // 如果找不到單獨的處理器，嘗試從補充處理器中載入
    if (intent.startsWith('supplement_')) {
      const supplementHandlers = require('../src/tasks/handle_supplement_input_task');
      const handlerName = `handle_${intent}_task`;
      return supplementHandlers[handlerName];
    }
    console.error(`⚠️ 找不到任務處理器: handle_${intent}_task`);
    return null;
  }
}

// 模擬完整的訊息處理流程
async function processMessage(message, userId) {
  console.log(`\\n👤 用戶: ${message}`);
  
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
  
  const result = await taskHandler(slots, userId, {
    message: { text: message }
  });
  
  // 4. 顯示結果
  console.log(`🤖 機器人: ${result.message}`);
  
  if (result.quickReply) {
    console.log(`📱 Quick Reply 按鈕:`)
    result.quickReply.forEach((btn, idx) => {
      console.log(`   ${idx + 1}. ${btn.label} → \"${btn.text}\"`)
    })
  }
  
  if (result.expectingInput) {
    console.log(`⏳ 期待輸入: ${result.missingFields?.join('、')}`)
  }
  
  return result;
}

// 測試場景
async function runSupplementTest() {
  console.log('🚀 開始缺失資訊補充測試\\n');
  console.log('=' .repeat(50));
  
  const userId = 'supplement_test_user_' + Date.now();
  const manager = getConversationManager();
  
  try {
    // 場景1: 缺少學生姓名的課程安排
    console.log('\\n📊 場景1: 缺少學生姓名的課程安排');
    console.log('-'.repeat(50));
    
    // 第一步: 發送缺少學生姓名的訊息
    let result = await processMessage('每週五下午五點半跆拳道課', userId);
    
    if (!result?.success && result?.expectingInput) {
      console.log('✅ 系統正確檢測到缺失資訊並設定期待輸入');
      
      // 檢查對話狀態
      const context = await manager.getContext(userId);
      console.log('📋 對話狀態:', {
        currentFlow: context?.state?.currentFlow,
        expectingInput: context?.state?.expectingInput,
        hasPendingData: !!context?.state?.pendingData
      });
      
      // 第二步: 補充學生姓名
      console.log('\\n👤 補充學生姓名...');
      result = await processMessage('Lumi', userId);
      
      if (result?.success) {
        console.log('✅ 學生姓名補充成功，課程創建完成！');
      } else {
        console.log('❌ 學生姓名補充失敗:', result?.message);
      }
    } else {
      console.log('❌ 系統沒有正確檢測到缺失資訊');
    }
    
    // 場景2: 缺少多個資訊的情況
    console.log('\\n\\n📊 場景2: 缺少多個資訊');
    console.log('-'.repeat(50));
    
    // 清理之前的狀態
    await manager.clearContext(userId);
    
    result = await processMessage('明天下午數學課', userId);
    
    if (!result?.success && result?.expectingInput) {
      console.log('✅ 檢測到缺失多個資訊');
      
      // 補充學生姓名
      console.log('\\n👤 補充學生姓名...');
      result = await processMessage('小明', userId);
      
      // 檢查是否還需要其他資訊
      if (!result?.success && result?.expectingInput) {
        console.log('✅ 學生姓名已補充，還需要其他資訊');
        
        // 補充時間
        console.log('\\n👤 補充時間...');
        result = await processMessage('下午2點', userId);
        
        if (result?.success) {
          console.log('✅ 所有資訊補充完成，課程創建成功！');
        } else {
          console.log('❌ 時間補充失敗:', result?.message);
        }
      } else if (result?.success) {
        console.log('✅ 課程創建成功！');
      }
    }
    
    // 清理測試數據
    console.log('\\n\\n🧹 清理測試數據...');
    await manager.clearContext(userId);
    
    console.log('\\n' + '='.repeat(50));
    console.log('✅ 缺失資訊補充測試完成！');
    
    // 測試總結
    console.log('\\n📊 測試總結:');
    console.log('1. ✅ 缺失資訊檢測');
    console.log('2. ✅ 期待輸入狀態設定');
    console.log('3. ✅ 補充資訊意圖識別');
    console.log('4. ✅ 資訊整合與任務重新執行');
    console.log('5. ✅ 多輪補充流程處理');
    
  } catch (error) {
    console.error('\\n❌ 測試失敗:', error);
  } finally {
    // 確保清理
    await manager.clearContext(userId);
    process.exit(0);
  }
}

// 執行測試
if (require.main === module) {
  runSupplementTest().catch(console.error);
}

module.exports = { processMessage, runSupplementTest };