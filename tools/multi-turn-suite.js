#!/usr/bin/env node

/**
 * 多輪對話測試套件（統一入口）
 * --supplement    補問/槽位補齊
 * --render       Render 多輪
 * 預設：--supplement
 */

const { spawnSync } = require('child_process');
function runNode(script, args = []) { return spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' }).status === 0; }
function hasFlag(f) { return process.argv.includes(f); }

async function main() {
  const runSupplement = hasFlag('--supplement') || !hasFlag('--render');
  const runRender = hasFlag('--render');
  let ok = true;
  if (runSupplement) ok = runNode(require.resolve('./suites/multi-turn/cases/test-supplement-input.js')) && ok;
  if (runRender) ok = runNode(require.resolve('./suites/multi-turn/cases/test-multi-turn-dialogue.js')) && ok;
  // 自動包含從 MD 生成的用例（若存在）
  try {
    const gen = require.resolve('./suites/multi-turn/cases/generated/generated-from-md.js');
    ok = runNode(gen) && ok;
  } catch (_) {}
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main();


