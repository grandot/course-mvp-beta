#!/usr/bin/env node

/**
 * Redis 測試套件（統一入口）
 * --conn    連線測試（test-redis-connection.js）
 * --config  設定檢查（test-redis-config-check.js）
 * --perf    效能測試（redis-performance-test.js）
 * --render  Render 端整合（test-redis-render.js / test-production-redis.js）
 * 預設：--conn --config
 */

const { spawnSync } = require('child_process');

function runNode(script, args = []) {
  const res = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  return res.status === 0;
}

function hasFlag(flag) { return process.argv.includes(flag); }

async function main() {
  const runConn = hasFlag('--conn') || (!hasFlag('--config') && !hasFlag('--perf') && !hasFlag('--render'));
  const runConfig = hasFlag('--config') || (!hasFlag('--perf') && !hasFlag('--render'));
  const runPerf = hasFlag('--perf');
  const runRender = hasFlag('--render');

  let ok = true;
  if (runConn) ok = runNode(require.resolve('./test-redis-connection.js')) && ok;
  if (runConfig) ok = runNode(require.resolve('./test-redis-config-check.js')) && ok;
  if (runPerf) ok = runNode(require.resolve('./redis-performance-test.js')) && ok;
  if (runRender) {
    runNode(require.resolve('./test-redis-render.js'));
    ok = runNode(require.resolve('./test-production-redis.js')) && ok;
  }
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main();


