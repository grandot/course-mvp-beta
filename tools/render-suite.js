#!/usr/bin/env node

/**
 * Render 測試套件（統一入口）
 * 用途：集中執行部署健檢/多輪/持久化/依賴等 Render 相關測試
 * 預設：執行部署健檢（health/cold-start/redis/concurrency）
 * 參數：
 *  --all            全部可用子測試
 *  --basic          只跑部署健檢（等同預設）
 *  --persistence    持久化/上下文測試
 *  --multi          多輪對話（Render）
 *  --api            API 響應驗證
 *  --deps           依賴檢查
 */

const { spawnSync } = require('child_process');

function runNode(script, args = []) {
  const res = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  return res.status === 0;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const runAll = hasFlag('--all');
  const runBasic = hasFlag('--basic') || (!hasFlag('--persistence') && !hasFlag('--multi') && !hasFlag('--api') && !hasFlag('--deps') && !runAll);

  let ok = true;

  if (runBasic || runAll) {
    // 部署健檢（健康、冷啟動、Redis、併發）
    ok = runNode(require.resolve('./suites/render/cases/test-render-deployment.js')) && ok;
  }
  if (hasFlag('--persistence') || runAll) {
    ok = runNode(require.resolve('./suites/render/cases/test-render-persistence.js')) && ok;
  }
  if (hasFlag('--multi') || runAll) {
    ok = runNode(require.resolve('./suites/multi-turn/cases/test-multi-turn-dialogue.js')) && ok;
  }
  if (hasFlag('--api') || runAll) {
    // API 細緻驗證可併入 deployment；暫無額外子測試
  }
  if (hasFlag('--deps') || runAll) {
    // 依賴檢查已包含於 deployment 測試或環境檢查
  }

  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main();
}


