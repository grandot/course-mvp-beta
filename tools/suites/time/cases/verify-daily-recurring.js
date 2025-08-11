#!/usr/bin/env node

/**
 * verify-daily-recurring
 * 簡單驗證每日重複規則的輸出格式
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const { buildRecurrenceRule } = require(path.join(ROOT, 'src/services/googleCalendarService'));

function main() {
  const rules = buildRecurrenceRule(true, 'daily', null);
  if (!Array.isArray(rules) || !rules.find((r) => String(r).includes('FREQ=DAILY'))) {
    console.error('❌ 每日重複規則驗證失敗:', rules);
    process.exit(1);
  }
  console.log('✅ 每日重複規則驗證通過:', rules);
}

if (require.main === module) main();

module.exports = { main };


