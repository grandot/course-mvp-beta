#!/usr/bin/env node

/**
 * 回歸/風險/修復驗證 測試套件（統一入口）
 * --risk    風險場景
 * --fix     修復驗證（可附 tag 或關鍵字）
 * --all     全部
 */

const { spawnSync } = require('child_process');
function runNode(script, args = []) { return spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' }).status === 0; }
function hasFlag(f) { return process.argv.includes(f); }
function getArgValue(flag) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i+1] : null; }

async function main() {
  const runAll = hasFlag('--all');
  const runRisk = hasFlag('--risk') || runAll;
  const runFix = hasFlag('--fix') || runAll;
  let ok = true;
  if (runRisk) ok = runNode(require.resolve('./test-all-risks.js')) && ok;
  if (runFix) {
    const tag = getArgValue('--fix');
    const args = tag ? [tag] : [];
    ok = runNode(require.resolve('./test-fix-verification.js'), args) && ok;
  }
  // 回歸全量
  if (runAll) ok = runNode(require.resolve('./regression-test.js')) && ok;
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main();


