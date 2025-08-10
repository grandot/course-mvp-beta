#!/usr/bin/env node

/**
 * 時間與重複規則測試套件（統一入口）
 * --parser   時間解析
 * --format   時間格式修正
 * --daily    每日重複/驗證
 * 預設：--parser --daily
 */

const { spawnSync } = require('child_process');
function runNode(script, args = []) { return spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' }).status === 0; }
function hasFlag(f) { return process.argv.includes(f); }

async function main() {
  const runParser = hasFlag('--parser') || (!hasFlag('--format') && !hasFlag('--daily'));
  const runFormat = hasFlag('--format');
  const runDaily = hasFlag('--daily') || (!hasFlag('--format'));
  let ok = true;
  if (runParser) ok = runNode(require.resolve('./suites/time/cases/test-time-parser.js')) && ok;
  if (runFormat) ok = runNode(require.resolve('./suites/time/cases/test-time-format-fix.js')) && ok;
  if (runDaily) {
    ok = runNode(require.resolve('./suites/time/cases/test-daily-recurring.js')) && ok;
    runNode(require.resolve('./suites/time/cases/verify-daily-recurring.js'));
  }
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main();


