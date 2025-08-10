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
    ok = runNode(require.resolve('./test-render-deployment.js')) && ok;
  }
  if (hasFlag('--persistence') || runAll) {
    ok = runNode(require.resolve('./test-render-persistence.js')) && ok;
  }
  if (hasFlag('--multi') || runAll) {
    ok = runNode(require.resolve('./test-render-multi-turn.js')) && ok;
  }
  if (hasFlag('--api') || runAll) {
    // 覆蓋較細緻 API 驗證腳本（若缺任一不致中斷）
    runNode(require.resolve('./test-render.js'));
    runNode(require.resolve('./test-render-api.js'));
    ok = runNode(require.resolve('./test-render-comprehensive.js')) && ok;
  }
  if (hasFlag('--deps') || runAll) {
    ok = runNode(require.resolve('./test-render-deps.js')) && ok;
  }

  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main();
}


