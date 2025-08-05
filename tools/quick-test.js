#!/usr/bin/env node

/**
 * 快速功能測試腳本
 * 用於開發過程中的快速驗證
 */

const { sendLineWebhookRequest } = require('./test-full-workflow');

// 快速測試案例
const QUICK_TESTS = [
  {
    name: '新增課程',
    message: '測試小明每週三下午3點數學課',
    expected: 'success'
  },
  {
    name: '查詢課程',
    message: '查詢測試小明今天的課程',
    expected: 'success'
  },
  {
    name: '記錄內容',
    message: '測試小明今天的數學課學了分數',
    expected: 'success'
  },
  {
    name: '設定提醒',
    message: '提醒我測試小明明天的數學課',
    expected: 'success'
  },
  {
    name: '未知意圖',
    message: '這是一個無法識別的訊息',
    expected: 'handled'
  }
];

async function runQuickTests() {
  console.log('🚀 開始快速功能測試...\n');
  
  let passed = 0;
  let total = QUICK_TESTS.length;
  
  for (const test of QUICK_TESTS) {
    process.stdout.write(`📝 測試 ${test.name}... `);
    
    try {
      const result = await sendLineWebhookRequest(test.message);
      
      if (result.success) {
        console.log('✅ 通過');
        passed++;
      } else {
        console.log(`❌ 失敗: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ 異常: ${error.message}`);
    }
    
    // 短暫延遲避免請求過快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 測試結果: ${passed}/${total} 通過 (${(passed/total*100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('🎉 所有快速測試通過！');
  } else {
    console.log('⚠️ 部分測試失敗，請檢查系統狀態');
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  runQuickTests().catch(error => {
    console.error('❌ 快速測試執行失敗:', error.message);
    process.exit(1);
  });
}

module.exports = { runQuickTests };