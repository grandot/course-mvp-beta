#!/usr/bin/env node

/**
 * 真環境（Mock GCal）分批測試執行器
 * - 小量 -> 優化 -> 擴大覆蓋，輸出每批報告
 * - 預設批次：
 *   1) first5
 *   2) groupA
 *   3) groupAB_core（排除已知不做/需真GCal）
 *   4) groupABC_wide（≥40/45 覆蓋）
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const { MarkdownParser } = require('../qa-system/core/MarkdownParser');
const { RealEnvironmentTester } = require('./test-real-environment');

function nowTs() { return new Date().toISOString().replace(/[:.]/g, '-'); }

function filterByIdPrefix(testCases, prefixes) {
  const set = new Set(prefixes);
  return testCases.filter(tc => {
    const id = (tc.id || '').toString();
    for (const p of set) {
      if (id.startsWith(p)) return true;
    }
    return false;
  });
}

function excludeByIds(testCases, ids) {
  const ban = new Set(ids);
  return testCases.filter(tc => !ban.has(tc.id));
}

function markBatchNameResults(name, results) {
  const total = results.length;
  const passed = results.filter(r => r.testPassed).length;
  const failed = total - passed;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  return { name, total, passed, failed, passRate };
}

async function writeBatchReport(batchName, results, summary) {
  const reportsDir = path.resolve(__dirname, '../QA/reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const mdPath = path.join(reportsDir, `real-${batchName}-${nowTs()}.md`);

  const lines = [];
  lines.push(`# 線上真環境（Mock GCal）批次測試報告`);
  lines.push('');
  lines.push(`- 批次: ${batchName}`);
  lines.push(`- 產出時間: ${new Date().toISOString()}`);
  lines.push(`- 測試數: ${summary.total} | 通過: ${summary.passed} | 失敗: ${summary.failed} | 通過率: ${summary.passRate}%`);
  lines.push('');
  results.forEach((r, idx) => {
    lines.push(`### 測試-${idx + 1}. [${r.testCase.id || '?'}] ${r.testCase.name || '未命名'}`);
    lines.push(`- 輸入: ${r.testCase.input}`);
    lines.push(`- Webhook: ${r.webhookStatus} ${r.webhookOk ? '✅' : '❌'}`);
    lines.push(`- 回覆: ${r.botReply || '(無)'} `);
    lines.push(`- 結果: ${r.testPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!r.testPassed && r.diagnosticLogs) {
      lines.push(`- 診斷：`);
      Object.entries(r.diagnosticLogs).forEach(([k, logs]) => {
        lines.push(`  - ${k}:`);
        logs.slice(0, 6).forEach(line => lines.push(`    - ${String(line).replace(/\r?\n/g, ' ').slice(0, 300)}`));
      });
    }
    lines.push('');
  });

  await fs.writeFile(mdPath, lines.join('\n'));
  console.log(`📄 批次報告已產出: ${mdPath}`);
}

async function runBatch(tester, allCases, batchName, selectFn) {
  const batchCases = selectFn(allCases);
  if (!batchCases || batchCases.length === 0) {
    console.log(`⚠️ 批次 ${batchName} 無測試案例，跳過`);
    return { summary: { name: batchName, total: 0, passed: 0, failed: 0, passRate: 0 }, results: [] };
  }
  console.log(`\n===== 批次 ${batchName}：${batchCases.length} 條 =====`);
  const results = await tester.runAllTests(batchCases);
  const summary = markBatchNameResults(batchName, results);
  await writeBatchReport(batchName, results, summary);
  console.log(`📈 批次 ${batchName} 完成，通過率 ${summary.passRate}% (${summary.passed}/${summary.total})`);
  return { summary, results };
}

async function main() {
  // 保障：啟用 Mock GCal
  if (process.env.USE_MOCK_CALENDAR !== 'true') {
    console.log('⚠️ 建議設置 USE_MOCK_CALENDAR=true 以避免污染真實日曆');
  }

  // 允許以環境變數調整批次擴大門檻，預設 80
  const passThreshold = parseInt(process.env.REAL_BATCH_PASS_THRESHOLD || '80', 10);

  const parser = new MarkdownParser();
  const testCases = await parser.parse('./QA/comprehensive-test-plan.md');
  const tester = new RealEnvironmentTester();

  // 已知暫不納入（不做或需真 GCal）
  const knownExcluded = new Set([
    'A2.1-E',            // 每月重複：未支援
    'A2.2-E',            // 重複衝突：Mock 下難以檢測
    'C1.1-B'             // 修改每日重複：需上下文
  ]);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const batches = [
    {
      name: 'first5',
      select: (all) => all.slice(0, 5)
    },
    {
      name: 'groupA_all',
      select: (all) => filterByIdPrefix(all, ['A'])
    },
    {
      name: 'groupAB_core',
      select: (all) => excludeByIds(filterByIdPrefix(all, ['A', 'B']), knownExcluded)
    },
    {
      name: 'groupABC_wide',
      select: (all) => excludeByIds(all, knownExcluded)
    }
  ];

  const resultsByBatch = [];
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    const { summary, results } = await runBatch(tester, testCases, b.name, b.select);
    resultsByBatch.push({ summary, results });

    // 小量擴大循環：若某批次通過率 < 80%，暫停後續批次，待人工調整（避免誤擴）
    if (summary.total > 0 && summary.passRate < passThreshold) {
      console.log(`⚠️ 批次 ${b.name} 通過率 ${summary.passRate}% < ${passThreshold}% ，暫停後續擴大。`);
      break;
    }

    // 批次間間隔，避免速率限制
    if (i < batches.length - 1) {
      await sleep(4000);
    }
  }

  // 輸出總結
  const totalRun = resultsByBatch.reduce((sum, x) => sum + (x.summary.total || 0), 0);
  const totalPass = resultsByBatch.reduce((sum, x) => sum + (x.summary.passed || 0), 0);
  const overallRate = totalRun ? Math.round((totalPass / totalRun) * 100) : 0;
  console.log(`\n✅ 分批測試完成：合計 ${totalRun}，通過 ${totalPass}，總通過率 ${overallRate}%`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 分批測試失敗：', err.message);
    process.exit(1);
  });
}


