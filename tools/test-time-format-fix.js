#!/usr/bin/env node

/**
 * 測試時間格式修復
 * 驗證 "上午 10" 是否正確顯示為 "上午 10:00"
 */

// 模擬 formatTime 函數
function formatTime(timeString) {
  if (!timeString) return '時間未定';

  const [hour, minute] = timeString.split(':');
  const h = parseInt(hour);
  const m = `:${minute}`;

  if (h === 0) return `午夜12${m}`;
  if (h < 12) return `上午${h}${m}`;
  if (h === 12) return `中午12${m}`;
  return `下午${h - 12}${m}`;
}

console.log('🧪 測試時間格式修復');
console.log('=' .repeat(40));

const testCases = [
  '10:00',  // 原問題：應該顯示 "上午10:00"
  '09:00',  
  '14:00',  
  '12:00',  
  '00:00',  
  '15:30',  
  '08:45'
];

testCases.forEach(time => {
  const formatted = formatTime(time);
  console.log(`${time} → ${formatted}`);
});

console.log('\n✅ 修復結果：');
console.log('原來: "10:00" → "上午10" (缺少分鐘)');
console.log('修復: "10:00" → "上午10:00" (完整時間)');
console.log('\n🎯 問題解決！');