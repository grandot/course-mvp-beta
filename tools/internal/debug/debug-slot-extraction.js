#!/usr/bin/env node

/**
 * 調試 Slot 提取工具
 * 專門用來調試學生姓名和課程名稱提取問題
 */

// 載入環境變數
require('dotenv').config();

const { 
  extractStudentName, 
  extractCourseName 
} = require('../src/intent/extractSlots');

/**
 * 測試學生姓名提取
 */
function testStudentNameExtraction() {
  console.log('🧪 測試學生姓名提取');
  console.log('=' .repeat(40));
  
  const testCases = [
    '刪掉Lumi的英文課',
    '取消小明的數學課',
    '提醒我小光的鋼琴課',
    '小美明天有什麼課'
  ];
  
  testCases.forEach(message => {
    const result = extractStudentName(message);
    console.log(`📝 "${message}" → 姓名: "${result}"`);
  });
}

/**
 * 測試課程名稱提取
 */
function testCourseNameExtraction() {
  console.log('\n🧪 測試課程名稱提取');
  console.log('=' .repeat(40));
  
  const testCases = [
    '刪掉Lumi的英文課',
    '取消小明的數學課',
    '提醒我小光的鋼琴課',
    '明天下午3點數學課'
  ];
  
  testCases.forEach(message => {
    const result = extractCourseName(message);
    console.log(`📝 "${message}" → 課程: "${result}"`);
  });
}

/**
 * 測試正則表達式匹配
 */
function testRegexMatching() {
  console.log('\n🧪 測試正則表達式匹配');
  console.log('=' .repeat(40));
  
  const message = '刪掉Lumi的英文課';
  const patterns = [
    { name: '的XX課', regex: /的([一-龥]{2,6})課/ },
    { name: 'XX課', regex: /([一-龥]{2,6})課(?![學了])/ },
    { name: '上XX', regex: /(?:上|學|要上)([一-龥]{2,6})課?/ }
  ];
  
  patterns.forEach(({ name, regex }) => {
    const match = message.match(regex);
    if (match) {
      console.log(`✅ ${name}: 完整匹配="${match[0]}", 捕獲組="${match[1]}"`);
    } else {
      console.log(`❌ ${name}: 無匹配`);
    }
  });
}

/**
 * 主要測試函式
 */
function main() {
  console.log('🔍 Slot 提取調試工具');
  console.log('=' .repeat(60));
  
  testStudentNameExtraction();
  testCourseNameExtraction();
  testRegexMatching();
}

// 執行測試
main();