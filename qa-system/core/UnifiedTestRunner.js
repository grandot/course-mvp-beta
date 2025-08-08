/**
 * 統一測試接口 - 整合本機和線上測試工具
 */

const path = require('path');
const { runLocalLogicTests } = require('../../tools/test-local-environment');
const { RealEnvironmentTester } = require('../../tools/test-real-environment');

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
    const { processMessageAndGetResponse } = require('../../tools/test-local-environment');
    
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
        const final = codeMatch && successMatch;
        if (!final) {
          console.log(`❌ 結構化比對失敗 - ${testCase.id} (expected code=${testCase.expectedCode}, success=${testCase.expectedSuccess}) got code=${result.code}, success=${result.success}`);
        }
        return {
          testCase: testCase,
          success: final,
          output: result.output,
          intent: result.intent,
          keywordMatch: true,
          code: result.code,
          taskSuccess: result.success
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

      const finalSuccess = (expectedSuccess === null
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
        console.log(`❌ 測試失敗 - ${testCase.id}: semantic=${expectedSuccess}, keywordMatch=${keywordMatch}`);
      }
      
      return {
        testCase: testCase,
        success: finalSuccess,
        output: result.output,
        intent: result.intent,
        keywordMatch: keywordMatch,
        code: result.code,
        taskSuccess: result.success
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
  }
  
  /**
   * 延遲函數
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { UnifiedTestRunner };