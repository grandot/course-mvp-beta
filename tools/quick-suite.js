#!/usr/bin/env node

/**
 * 冒煙/端到端 快速測試套件
 * --target local|prod  目標環境（預設 prod）
 * --e2e                跑端到端流程
 */

const { spawnSync } = require('child_process');
function runNode(script, args = []) { return spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' }).status === 0; }
function getArgValue(flag) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i+1] : null; }
function hasFlag(f) { return process.argv.includes(f); }

async function main() {
  const target = getArgValue('--target') || 'prod';
  const runE2E = hasFlag('--e2e');

  // 冒煙：5 cases（依 target 選擇 real/local）
  if (target === 'local') {
    if (!runNode(require.resolve('./test-5-cases.js'))) process.exit(1);
  } else {
    if (!runNode(require.resolve('./test-5-cases-real.js'))) process.exit(1);
  }

  // 端到端
  if (runE2E) {
    if (!runNode(require.resolve('./test-full-workflow.js'))) process.exit(1);
  }
}

if (require.main === module) main();


