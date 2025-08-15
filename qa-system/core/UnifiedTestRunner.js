/**
 * 統一測試接口 - 整合本機和線上測試工具
 */

const path = require('path');
const { runLocalLogicTests, processMessageAndGetResponse } = require('../../tools/suites/misc/test-local-environment');
const { RealEnvironmentTester } = require('../../tools/suites/misc/test-real-environment');

const fs = require('fs');

class UnifiedTestRunner {
  constructor(options = {}) {
    this.mode = options.mode || 'both'; // 'local', 'real', 'both'
    this.config = options.config || {};
    
    // 初始化測試執行器（統一測試用戶 ID）
    const testUserId = process.env.TEST_USER_ID || 'U_test_user_qa';
    this.realTester = new RealEnvironmentTester({ testUserId });
  }
  
  /**
   * 執行測試
   */
  async runTests(testCases, mode = this.mode) {
    const results = {};
    
    console.log(`🧪 開始執行測試 (模式: ${mode})`);
    console.log(`📊 測試案例數量: ${testCases.length}`);
    
    try {
      // 本機測試
      if (mode === 'local' || mode === 'both') {
        console.log('\n🏠 執行本機邏輯測試...');
        results.local = await this.runLocalTests(testCases);
      }
      
      // 線上測試
      if (mode === 'real' || mode === 'both') {
        console.log('\n🌐 執行真實環境測試...');
        results.real = await this.runRealTests(testCases);
      }
      
      // 生成比較報告
      if (mode === 'both') {
        results.comparison = this.compareResults(results.local, results.real);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ 測試執行失敗:', error.message);
      throw error;
    }
  }
  
  /**
   * 執行本機測試
   */
  async runLocalTests(testCases) {
    // 轉換測試案例格式給本機測試工具
    const results = [];
    
    // 確保每日重複用例可被測試
    process.env.ENABLE_DAILY_RECURRING = process.env.ENABLE_DAILY_RECURRING || 'true';

    for (const testCase of testCases) {
      try {
        // 測試隔離：在每個案例前清空該測試用戶的對話上下文（不影響多步用例）
        const { getConversationManager } = require('../../src/conversation/ConversationManager');
        const conv = getConversationManager();
        const userId = process.env.TEST_USER_ID || 'U_test_user_qa';
        await conv.clearContext(userId);

        // 支援多輪：如有 steps，逐步送入，最後一步用於比對
        let result = null;
        if (Array.isArray(testCase.steps) && testCase.steps.length > 0) {
          for (let i = 0; i < testCase.steps.length; i++) {
            const step = testCase.steps[i];
            result = await this.executeLocalTestCase({ ...testCase, input: step.input });
          }
        } else {
          result = await this.executeLocalTestCase(testCase);
        }
        results.push(result);
        
      } catch (error) {
        results.push({
          testCase: testCase,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: testCases.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
  
  /**
   * 執行線上測試
   */
  async runRealTests(testCases) {
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const result = await this.realTester.runSingleTest(testCase);
        results.push(result);
        
        // 測試間隔
        await this.delay(2000);
        
      } catch (error) {
        results.push({
          testCase: testCase,
          testPassed: false,
          error: error.message
        });
      }
    }
    
    return {
      total: testCases.length,
      passed: results.filter(r => r.testPassed).length,
      failed: results.filter(r => !r.testPassed).length,
      results: results
    };
  }
  
  /**
   * 執行單個本機測試案例
   */
  async executeLocalTestCase(testCase) {
    // 已於頂部導入 processMessageAndGetResponse（修正路徑）
    
    try {
      const userId = process.env.TEST_USER_ID || 'U_test_user_qa';
      const result = await processMessageAndGetResponse(userId, testCase.input);
      
      // 語義對齊（依測試目的與預期回覆/標註）
      const output = result.output || '';
      const expected = testCase.expectedFinalOutput || testCase.expectedOutput || '';
      const expectedKeywords = testCase.expectedKeywords || [];
      const expectedSuccess = testCase.expectedSuccess; // 可能為 true/false/null

      // 新增：若測試用例提供 expectedCode / expectedSuccess，優先用結構化比對
      if (testCase.expectedCode !== undefined || testCase.expectedSuccess !== null) {
        const codeMatch = testCase.expectedCode ? (result.code === testCase.expectedCode) : true;
        const successMatch = (testCase.expectedSuccess === null || testCase.expectedSuccess === undefined)
          ? true
          : (result.success === testCase.expectedSuccess);

        // 額外加入：意圖與 QuickReply 比對
        const expectedIntent = testCase.expectedIntent;
        const intentMatch = expectedIntent ? (result.intent === expectedIntent) : true;

        const expectedQR = Array.isArray(testCase.expectedQuickReplyIncludes) ? testCase.expectedQuickReplyIncludes : null;
        const qrItems = Array.isArray(result.quickReply) ? result.quickReply : [];
        const quickReplyMatch = expectedQR
          ? expectedQR.every(token => qrItems.some(it => String(it.label || it.text || '').includes(token)))
          : true;

        const final = codeMatch && successMatch && intentMatch && quickReplyMatch;
        if (!final) {
          console.log(`❌ 結構化比對失敗 - ${testCase.id} (code:${codeMatch?'✅':'❌'} intent:${intentMatch?'✅':'❌'} qr:${quickReplyMatch?'✅':'❌'} success:${successMatch?'✅':'❌'})`);
        }
        return {
          testCase: testCase,
          success: final,
          output: result.output,
          intent: result.intent,
          keywordMatch: true,
          code: result.code,
          taskSuccess: result.success,
          intentMatch,
          quickReplyMatch,
          quickReply: result.quickReply || null
        };
      }

      // 關鍵詞匹配（every，但允許缺少非關鍵資訊詞）
      const keywordMatch = expectedKeywords.length > 0 ?
        expectedKeywords.every(k => output.includes(k)) : true;

      // 成功/失敗語義對齊
      let semanticSuccessAligns = true;
      if (expectedSuccess === true) {
        const successHints = ['成功', '✅', '已安排', '設定完成', '已取消'];
        semanticSuccessAligns = successHints.some(k => output.includes(k)) && result.success === true;
      } else if (expectedSuccess === false) {
        const failureHints = ['❓', '請提供', '錯誤', '無法', '失敗', '時間衝突'];
        semanticSuccessAligns = failureHints.some(k => output.includes(k)) && result.success === false;
      }

      // 如果沒有 expectedSuccess 標註，退化為：輸出需包含預期字串或關鍵詞
      let fallbackSemantic = true;
      if (expected && typeof expected === 'string' && expected.length > 0) {
        fallbackSemantic = output.includes(expected);
      }

      // 加入：意圖與 QuickReply 斷言（在無 code/success 斷言時也可生效）
      const expectedIntent = testCase.expectedIntent;
      const intentMatch = expectedIntent ? (result.intent === expectedIntent) : true;

      const expectedQR = Array.isArray(testCase.expectedQuickReplyIncludes) ? testCase.expectedQuickReplyIncludes : null;
      const qrItems = Array.isArray(result.quickReply) ? result.quickReply : [];
      const quickReplyMatch = expectedQR
        ? expectedQR.every(token => qrItems.some(it => String(it.label || it.text || '').includes(token)))
        : true;

      const structuredOk = intentMatch && quickReplyMatch;
      const finalSuccess = structuredOk && (expectedSuccess === null
        ? (keywordMatch && fallbackSemantic)
        : (keywordMatch && semanticSuccessAligns));
      
      // 調試信息
      if (!keywordMatch && testCase.expectedKeywords) {
        console.log(`❌ 關鍵字匹配失敗 - ${testCase.id}`);
        console.log(`預期關鍵字: ${JSON.stringify(testCase.expectedKeywords)}`);
        console.log(`實際輸出: ${result.output?.substring(0, 100)}...`);
        testCase.expectedKeywords.forEach(keyword => {
          const found = result.output?.includes(keyword);
          console.log(`  - "${keyword}": ${found ? '✅' : '❌'}`);
        });
      }
      
      if (finalSuccess) {
        console.log(`✅ 測試通過 - ${testCase.id}: ${testCase.name}`);
      } else {
        console.log(`❌ 測試失敗 - ${testCase.id}: intentMatch=${intentMatch}, quickReplyMatch=${quickReplyMatch}, semantic=${expectedSuccess}, keywordMatch=${keywordMatch}`);
      }
      
      return {
        testCase: testCase,
        success: finalSuccess,
        output: result.output,
        intent: result.intent,
        keywordMatch: keywordMatch,
        code: result.code,
        taskSuccess: result.success,
        intentMatch,
        quickReplyMatch,
        quickReply: result.quickReply || null
      };
      
    } catch (error) {
      return {
        testCase: testCase,
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 比較本機和線上測試結果
   */
  compareResults(localResults, realResults) {
    const comparison = {
      consistency: 0,
      differences: [],
      summary: {}
    };
    
    // 計算一致性
    let consistentCount = 0;
    const totalTests = Math.min(localResults.results.length, realResults.results.length);
    
    for (let i = 0; i < totalTests; i++) {
      const local = localResults.results[i];
      const real = realResults.results[i];
      
      const localPassed = local.success;
      const realPassed = real.testPassed;
      
      if (localPassed === realPassed) {
        consistentCount++;
      } else {
        comparison.differences.push({
          testCase: local.testCase.name || `Test ${i + 1}`,
          local: localPassed ? 'PASS' : 'FAIL',
          real: realPassed ? 'PASS' : 'FAIL',
          localOutput: local.output,
          realOutput: real.botReply
        });
      }
    }
    
    comparison.consistency = Math.round((consistentCount / totalTests) * 100);
    comparison.summary = {
      total: totalTests,
      consistent: consistentCount,
      different: totalTests - consistentCount,
      localPassRate: Math.round((localResults.passed / localResults.total) * 100),
      realPassRate: Math.round((realResults.passed / realResults.total) * 100)
    };
    
    return comparison;
  }
  
  /**
   * 生成測試報告
   */
  generateReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 統一測試系統報告');
    console.log('='.repeat(80));
    
    if (results.local) {
      console.log('\n🏠 本機測試結果:');
      console.log(`   總測試數: ${results.local.total}`);
      console.log(`   通過: ${results.local.passed}`);
      console.log(`   失敗: ${results.local.failed}`);
      console.log(`   通過率: ${Math.round((results.local.passed / results.local.total) * 100)}%`);
    }
    
    if (results.real) {
      console.log('\n🌐 線上測試結果:');
      console.log(`   總測試數: ${results.real.total}`);
      console.log(`   通過: ${results.real.passed}`);
      console.log(`   失敗: ${results.real.failed}`);
      console.log(`   通過率: ${Math.round((results.real.passed / results.real.total) * 100)}%`);
    }
    
    if (results.comparison) {
      console.log('\n🔄 本機 vs 線上比較:');
      console.log(`   一致性: ${results.comparison.consistency}%`);
      console.log(`   差異數: ${results.comparison.differences.length}`);
      
      if (results.comparison.differences.length > 0) {
        console.log('\n⚠️  主要差異:');
        results.comparison.differences.slice(0, 3).forEach(diff => {
          console.log(`   ${diff.testCase}: 本機=${diff.local}, 線上=${diff.real}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));

    // 產出詳細 Markdown 報告（人類可讀、逐條用例）
    try {
      const reportPath = this.generateDetailedMarkdownReport(results);
      if (reportPath) {
        console.log(`\n📝 已輸出詳細報告: ${reportPath}`);
      }
    } catch (e) {
      console.log(`\n⚠️  輸出詳細報告失敗: ${e.message}`);
    }
  }

  /**
   * 生成極詳盡的 Markdown 報告，逐條用例列出「期望 vs 實際」與診斷
   * 輸出路徑：QA/reports/detailed-test-report-<timestamp>.md
   */
  generateDetailedMarkdownReport(results) {
    // 收集來源資料
    const local = results.local || { results: [], total: 0, passed: 0, failed: 0 };
    const real = results.real || { results: [], total: 0, passed: 0, failed: 0 };
    const comparison = results.comparison || null;

    const total = (comparison && comparison.summary && comparison.summary.total)
      ? comparison.summary.total
      : Math.max(local.results.length, real.results.length);

    const lines = [];
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const headerTitle = `統一測試詳細報告 (${now})`;
    lines.push(`# ${headerTitle}`);
    lines.push('');

    // 摘要
    lines.push('## 摘要');
    if (results.local) {
      const passRateLocal = Math.round((local.passed / (local.total || 1)) * 100);
      lines.push(`- 本機：共 ${local.total}，通過 ${local.passed}，失敗 ${local.failed}，通過率 ${passRateLocal}%`);
    }
    if (results.real) {
      const passRateReal = Math.round((real.passed / (real.total || 1)) * 100);
      lines.push(`- 線上：共 ${real.total}，通過 ${real.passed}，失敗 ${real.failed}，通過率 ${passRateReal}%`);
    }
    if (comparison) {
      lines.push(`- 本機 vs 線上：一致性 ${comparison.consistency}%、差異數 ${comparison.differences.length}`);
    }
    lines.push('');

    // 公用渲染輔助
    const formatSteps = (tc) => {
      if (!tc) return '';
      if (Array.isArray(tc.steps) && tc.steps.length > 0) {
        return tc.steps.map((s, i) => `  ${i + 1}. ${s.input || ''}`).join('\n');
      }
      return `  1. ${tc.input || tc.testCase?.input || ''}`;
    };

    const bullet = (ok) => ok ? '✅' : '❌';

    const renderKeywordMatrix = (expected = [], actualText = '') => {
      if (!Array.isArray(expected)) return '';
      if (expected.length === 0) return '';
      const rows = expected.map(k => `| ${k} | ${actualText && actualText.includes(k) ? '✅' : '❌'} |`);
      return ['| 關鍵詞 | 命中 |', '| --- | --- |', ...rows].join('\n');
    };

    // 逐條案例
    lines.push('## 用例明細（期望 vs 實際）');
    lines.push('');

    for (let i = 0; i < total; i++) {
      const localItem = local.results[i] || null;
      const realItem = real.results[i] || null;
      const tc = localItem?.testCase || realItem?.testCase || {};

      const id = tc.id || `#${i + 1}`;
      const name = tc.name || '未命名測試';
      const expectedKeywords = Array.isArray(tc.expectedKeywords) ? tc.expectedKeywords : [];
      const expectedCode = tc.expectedCode !== undefined ? String(tc.expectedCode) : '';
      const expectedSuccess = tc.expectedSuccess !== undefined ? String(tc.expectedSuccess) : '';

      lines.push(`### ${id} ${name}`);
      lines.push('');
      lines.push('**輸入步驟**');
      lines.push('');
      lines.push('```');
      lines.push(formatSteps(tc));
      lines.push('```');
      lines.push('');

      // 期望
      const expectLines = [];
      if (expectedKeywords.length > 0) expectLines.push(`- 關鍵詞：${expectedKeywords.join('、')}`);
      if (expectedCode) expectLines.push(`- 預期代碼：${expectedCode}`);
      if (expectedSuccess) expectLines.push(`- 預期成功：${expectedSuccess}`);
      if (tc.expectedIntent) expectLines.push(`- 預期意圖：${tc.expectedIntent}`);
      if (Array.isArray(tc.expectedQuickReplyIncludes) && tc.expectedQuickReplyIncludes.length > 0) {
        expectLines.push(`- 預期 QuickReply：${tc.expectedQuickReplyIncludes.join('、')}`);
      }
      if (expectLines.length === 0) expectLines.push('- 無明確期望（僅觀察行為）');
      lines.push('**期望**');
      lines.push('');
      expectLines.forEach(l => lines.push(l));
      lines.push('');

      // 本機
      if (localItem) {
        lines.push('**本機結果**');
        lines.push('');
        lines.push(`- 總結：${bullet(localItem.success)} 本機 ${localItem.success ? 'PASS' : 'FAIL'}`);
        if (localItem.intent) lines.push(`- 意圖：${localItem.intent}`);
        if (localItem.code) lines.push(`- 任務代碼：${localItem.code}`);
        if (typeof localItem.taskSuccess === 'boolean') lines.push(`- 任務成功：${localItem.taskSuccess ? '✅' : '❌'}`);
        lines.push('- 輸出：');
        lines.push('');
        lines.push('```');
        lines.push((localItem.output || '').toString());
        lines.push('```');
        lines.push('');
        if (expectedKeywords.length > 0) {
          lines.push(renderKeywordMatrix(expectedKeywords, localItem.output || ''));
          lines.push('');
        }
        if (Array.isArray(tc.expectedQuickReplyIncludes) && tc.expectedQuickReplyIncludes.length > 0) {
          const items = Array.isArray(localItem.quickReply) ? localItem.quickReply : [];
          const rows = tc.expectedQuickReplyIncludes.map(k => {
            const hit = items.some(it => String(it.label || it.text || '').includes(k));
            return `| ${k} | ${hit ? '✅' : '❌'} |`;
          });
          lines.push('| QuickReply | 命中 |');
          lines.push('| --- | --- |');
          rows.forEach(r => lines.push(r));
          lines.push('');
        }
      }

      // 線上
      if (realItem) {
        lines.push('**線上結果**');
        lines.push('');
        lines.push(`- 總結：${bullet(realItem.testPassed)} 線上 ${realItem.testPassed ? 'PASS' : 'FAIL'}`);
        lines.push(`- Webhook：${realItem.webhookStatus || 0} ${realItem.webhookOk ? '✅' : '❌'}`);
        if (realItem.taskCode) lines.push(`- 任務代碼：${realItem.taskCode}`);
        if (typeof realItem.taskSuccess === 'boolean') lines.push(`- 任務成功：${realItem.taskSuccess ? '✅' : '❌'}`);
        lines.push('- 回覆：');
        lines.push('');
        lines.push('```');
        lines.push((realItem.botReply || '').toString());
        lines.push('```');
        lines.push('');
        if (expectedKeywords.length > 0) {
          lines.push(renderKeywordMatrix(expectedKeywords, realItem.botReply || ''));
          lines.push('');
        }
        // 診斷
        if (!realItem.testPassed && realItem.diagnosticLogs) {
          lines.push('**診斷日誌（重點節點）**');
          const diag = realItem.diagnosticLogs;
          const showCat = (title, arr) => {
            if (Array.isArray(arr) && arr.length > 0) {
              lines.push(`- ${title}`);
              lines.push('');
              lines.push('```');
              arr.forEach(line => lines.push(line));
              lines.push('```');
              lines.push('');
            }
          };
          showCat('🎯 意圖識別', diag.intentParsing);
          showCat('📋 槽位提取', diag.slotExtraction);
          showCat('⚙️ 任務執行', diag.taskExecution);
          showCat('❌ 錯誤信息', diag.errors);
          showCat('🔧 系統行為', diag.systemBehavior);
          showCat('📝 資料驗證', diag.validation);
        }
      }

      // 差異快照
      if (localItem && realItem) {
        const diffBadge = localItem.success === realItem.testPassed ? '一致 ✅' : '不一致 ❌';
        lines.push(`> 本機 vs 線上：${diffBadge}`);
        if (localItem.success && !realItem.testPassed) {
          lines.push('> 提示：本機 PASS 但線上 FAIL，建議檢查線上意圖/槽位與回覆模板是否一致、以及環境變數差異。');
        }
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // 落檔
    const outDir = 'QA/reports';
    const outFile = `${outDir}/detailed-test-report-${now}.md`;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, lines.join('\n'));
    return outFile;
  }
  
  /**
   * 延遲函數
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { UnifiedTestRunner };