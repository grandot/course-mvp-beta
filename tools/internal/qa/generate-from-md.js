#!/usr/bin/env node

/**
 * 將 QA/plans/*.md（@id/@suite 標註格式）解析並生成可執行用例 JS 檔
 * 生成目錄：tools/suites/<suite>/cases/generated/
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { TagMarkdownParser } = require('../../../qa-system/core/TagMarkdownParser');

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

function groupBySuite(cases) {
  const map = new Map();
  for (const c of cases) {
    const key = (c.suite || 'render').trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return map;
}

function buildTestFileContent(suiteName, cases) {
  const header = `#!/usr/bin/env node\n/** 自動生成：${suiteName} - ${new Date().toISOString()} */\n`;
  return header + `\n` +
`const path = require('path');
const { UnifiedTestRunner } = require(path.resolve(__dirname, '../../../../..', 'qa-system/core/UnifiedTestRunner'));

(async () => {
  const runner = new UnifiedTestRunner({ mode: process.env.QA_MODE || 'both' });
  const tests = ${JSON.stringify(cases, null, 2)};
  const results = await runner.runTests(tests, process.env.QA_MODE || 'both');
  runner.generateReport(results);
  const ok = (results.local ? results.local.failed === 0 : true) && (results.real ? results.real.failed === 0 : true);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('❌ 生成測試執行失敗:', e.message); process.exit(1); });
`;
}

async function main() {
  const root = path.resolve(__dirname, '../../../');
  const plansDir = path.join(root, 'QA/plans');

  // 收集所有 .md（包含根目錄那份大計畫）
  const mdFiles = [
    ...glob.sync(path.join(plansDir, '*.md')),
    path.join(root, 'QA/comprehensive-test-plan.md')
  ].filter(Boolean);

  if (mdFiles.length === 0) {
    console.log('⚠️ 找不到任何 MD 計畫檔');
    process.exit(0);
  }

  console.log('📄 掃描 MD：');
  mdFiles.forEach(f => console.log(' - ' + f));

  const parser = new TagMarkdownParser();
  const cases = await parser.parseFiles(mdFiles);
  if (!cases.length) {
    console.log('⚠️ 未解析到任何 @id 用例');
    process.exit(0);
  }

  // 依 suite 分組並生成
  const grouped = groupBySuite(cases);
  const suiteDirMap = { 'multi': 'multi-turn' };
  for (const [suite, list] of grouped.entries()) {
    const suiteDir = suiteDirMap[suite] || suite;
    const outDir = path.join(root, 'tools/suites', suiteDir, 'cases', 'generated');
    await ensureDir(outDir);
    const filePath = path.join(outDir, `generated-from-md.js`);
    const content = buildTestFileContent(suite, list);
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`✅ 已生成 ${suite} 用例：${filePath}（${list.length} 條）`);
  }
}

if (require.main === module) {
  main();
}


