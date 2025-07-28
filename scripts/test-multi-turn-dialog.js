#!/usr/bin/env node

/**
 * 測試第一性原則重新設計後的多輪對話功能
 * 直接測試 LineController.handleTextMessage 方法
 */

const LineController = require('../src/controllers/lineController');

async function testMultiTurnDialog() {
  console.log('\n🎯 開始測試第一性原則重新設計後的多輪對話功能\n');

  const userId = 'test-user-123';
  
  try {
    // 第一輸入：排球 (應該觸發多問題追問)
    console.log('📝 第一輸入：「排球」');
    console.log('預期：系統應該詢問日期和時間，並保存 record_course_pending 狀態');
    
    const firstEvent = {
      message: { text: '排球' },
      source: { userId },
      replyToken: 'test-reply-token-1'
    };
    
    const firstResult = await LineController.handleTextMessage(firstEvent);
    console.log('✅ 第一輸入結果：', JSON.stringify(firstResult, null, 2));
    
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 第二輸入：明天早上十點20 (應該識別為補充信息)
    console.log('\n📝 第二輸入：「明天早上十點20」');
    console.log('預期：系統應該識別為補充信息，合併資料並創建課程');
    
    const secondEvent = {
      message: { text: '明天早上十點20' },
      source: { userId },
      replyToken: 'test-reply-token-2'
    };
    
    const secondResult = await LineController.handleTextMessage(secondEvent);
    console.log('✅ 第二輸入結果：', JSON.stringify(secondResult, null, 2));
    
    // 驗證結果
    console.log('\n🔍 結果分析：');
    
    if (firstResult.success && firstResult.result && firstResult.result.needsFollowUp) {
      console.log('✅ 第一輸入正確觸發追問');
    } else {
      console.log('❌ 第一輸入未正確觸發追問');
    }
    
    if (secondResult.success && secondResult.intent === 'record_course' && secondResult.result.success) {
      console.log('✅ 第二輸入正確創建課程');
      console.log('📚 創建的課程：', secondResult.result.course);
    } else {
      console.log('❌ 第二輸入未正確創建課程');
    }
    
  } catch (error) {
    console.error('❌ 測試失敗：', error.message);
    console.error('完整錯誤：', error);
  }
}

// 執行測試
testMultiTurnDialog().then(() => {
  console.log('\n🎯 測試完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 測試執行失敗：', error);
  process.exit(1);
});