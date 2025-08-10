#!/usr/bin/env node
/**
 * 測試原始問題：驗證 "早上十點" 現在能否被正確提取為 scheduleTime
 */

const { extractSlots } = require('../src/intent/extractSlots');

console.log('🎯 測試原始問題解決方案');
console.log('=========================\n');

// 原始問題語句
const originalMessage = 'Lumi明天早上十點科學實驗課';
const intent = 'add_course';

console.log(`📝 測試語句: "${originalMessage}"`);
console.log(`🎯 意圖: ${intent}\n`);

// 執行 slots 提取
extractSlots(originalMessage, intent)
  .then(slots => {
    console.log('📋 提取結果:');
    console.log(JSON.stringify(slots, null, 2));
    
    console.log('\n🔍 關鍵檢查:');
    console.log(`• studentName: ${slots.studentName || '❌ 未提取'}`);
    console.log(`• courseName: ${slots.courseName || '❌ 未提取'}`);
    console.log(`• scheduleTime: ${slots.scheduleTime || '❌ 未提取'} ${slots.scheduleTime ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`• timeReference: ${slots.timeReference || '❌ 未提取'}`);
    
    // 核心問題檢驗
    if (slots.scheduleTime === '10:00') {
      console.log('\n🎉 原始問題已完全解決！');
      console.log('✅ "早上十點" 成功解析為 "10:00"');
    } else {
      console.log('\n❌ 原始問題仍未解決');
      console.log(`期望: "10:00", 實際: "${slots.scheduleTime || 'null'}"`);
    }
    
    // 完整性檢查
    const expectedFields = ['studentName', 'courseName', 'scheduleTime', 'timeReference'];
    const missingFields = expectedFields.filter(field => !slots[field]);
    
    if (missingFields.length === 0) {
      console.log('\n✅ 所有必要欄位都已成功提取');
    } else {
      console.log(`\n⚠️ 缺少欄位: ${missingFields.join(', ')}`);
    }
  })
  .catch(error => {
    console.error('❌ 測試失敗:', error);
  });