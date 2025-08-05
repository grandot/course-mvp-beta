#!/usr/bin/env node

/**
 * 正則表達式測試工具
 */

function testRegex() {
  const message = '提醒我小明明天的數學課';
  
  console.log(`測試語句: "${message}"`);
  console.log();
  
  const patterns = [
    { name: '貪婪匹配', regex: /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3})(?=明天|今天|昨天|的)/ },
    { name: '非貪婪匹配', regex: /提醒.*?我.*?([小大]?[一-龥A-Za-z]{2,3})(?=明天|今天|昨天|的)/ },
    { name: '具體界限', regex: /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3}?)(?=明天|今天|昨天)/ },
    { name: '最小匹配', regex: /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3}?)(?=明天的)/ },
    { name: '名詞邊界', regex: /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3})(?=明天的課)/ },
    { name: '分步匹配', regex: /提醒.*我.*?([小大]?[一-龥]{2,3})(?=明天)/ }
  ];
  
  patterns.forEach(({ name, regex }) => {
    const match = message.match(regex);
    if (match) {
      console.log(`✅ ${name}: "${match[0]}" → 捕獲組: "${match[1]}"`);
    } else {
      console.log(`❌ ${name}: 無匹配`);
    }
  });
}

testRegex();