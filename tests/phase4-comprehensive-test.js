/**
 * Phase 4 綜合測試 - 完善與測試
 * 測試所有修復的問題和新功能
 */

const SemanticService = require('../src/services/semanticService');
const IntentRuleEngine = require('../src/utils/intentRuleEngine');
const RecurringCourseCalculator = require('../src/utils/recurringCourseCalculator');
const TimeService = require('../src/services/timeService');

class Phase4ComprehensiveTest {
  constructor() {
    this.testResults = [];
  }

  /**
   * 執行所有測試
   */
  async runAllTests() {
    console.log('🧪 === Phase 4 綜合測試開始 ===');
    console.log('');

    // 測試 1: 意圖識別修復
    await this.testIntentRecognitionFixes();
    
    // 測試 2: 課程名稱一致性
    await this.testCourseNameConsistency();
    
    // 測試 3: RecurringCalculator 性能優化
    await this.testRecurringCalculatorOptimization();
    
    // 測試 4: 邊界條件測試
    await this.testEdgeCases();
    
    // 測試 5: 端到端整合測試
    await this.testEndToEndIntegration();

    // 顯示測試結果
    return this.displayTestResults();
  }

  /**
   * 測試 1: 意圖識別修復
   */
  async testIntentRecognitionFixes() {
    console.log('🔍 測試 1: 意圖識別修復');
    
    const testCases = [
      {
        input: '停止數學課每週安排',
        expected: 'stop_recurring_course',
        description: '停止重複課程應被正確識別'
      },
      {
        input: '取消每週英文課',
        expected: 'stop_recurring_course',
        description: '取消每週課程應被識別為停止重複課程'
      },
      {
        input: '不要再重複安排物理課',
        expected: 'stop_recurring_course',
        description: '複雜表達的停止重複課程'
      },
      {
        input: '查詢我的課表',
        expected: 'query_schedule',
        description: '純查詢意圖不應被誤判'
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = IntentRuleEngine.analyzeIntent(testCase.input);
        const passed = result.intent === testCase.expected;
        
        this.testResults.push({
          test: '意圖識別修復',
          input: testCase.input,
          expected: testCase.expected,
          actual: result.intent,
          passed: passed,
          description: testCase.description
        });

        console.log(`  ${passed ? '✅' : '❌'} "${testCase.input}" -> ${result.intent} (期望: ${testCase.expected})`);
      } catch (error) {
        console.log(`  ❌ "${testCase.input}" -> 錯誤: ${error.message}`);
        this.testResults.push({
          test: '意圖識別修復',
          input: testCase.input,
          expected: testCase.expected,
          actual: 'ERROR',
          passed: false,
          error: error.message
        });
      }
    }
    console.log('');
  }

  /**
   * 測試 2: 課程名稱一致性
   */
  async testCourseNameConsistency() {
    console.log('🔍 測試 2: 課程名稱一致性');
    
    const testCases = [
      {
        input: '數學',
        expected: '數學課',
        description: '自動添加課字後綴'
      },
      {
        input: '英語',
        expected: '英文課',
        description: '標準化別名'
      },
      {
        input: '數學課程',
        expected: '數學課',
        description: '標準化課程後綴'
      },
      {
        input: '物理課課',
        expected: '物理課',
        description: '移除重複後綴'
      },
      {
        input: '瑜伽班',
        expected: '瑜伽班',
        description: '保留特殊後綴'
      }
    ];

    for (const testCase of testCases) {
      try {
        const normalized = SemanticService.normalizeCourseNameForConsistency(testCase.input);
        const passed = normalized === testCase.expected;
        
        this.testResults.push({
          test: '課程名稱一致性',
          input: testCase.input,
          expected: testCase.expected,
          actual: normalized,
          passed: passed,
          description: testCase.description
        });

        console.log(`  ${passed ? '✅' : '❌'} "${testCase.input}" -> "${normalized}" (期望: "${testCase.expected}")`);
      } catch (error) {
        console.log(`  ❌ "${testCase.input}" -> 錯誤: ${error.message}`);
        this.testResults.push({
          test: '課程名稱一致性',
          input: testCase.input,
          expected: testCase.expected,
          actual: 'ERROR',
          passed: false,
          error: error.message
        });
      }
    }
    console.log('');
  }

  /**
   * 測試 3: RecurringCalculator 性能優化
   */
  async testRecurringCalculatorOptimization() {
    console.log('🔍 測試 3: RecurringCalculator 性能優化');
    
    // 創建測試用重複課程
    const weeklyCourse = {
      id: 'test-weekly',
      course_name: '數學課',
      weekly_recurring: true,
      recurrence_details: {
        days_of_week: [1, 3, 5], // 週一、三、五
        time_of_day: '14:00',
        start_date: '2025-07-28'
      },
      schedule_time: '2:00 PM'
    };

    const monthlyCourse = {
      id: 'test-monthly',
      course_name: '鋼琴課',
      monthly_recurring: true,
      recurrence_details: {
        day_of_month: 15,
        time_of_day: '10:00',
        start_date: '2025-07-28'
      },
      schedule_time: '10:00 AM'
    };

    try {
      // 測試週重複課程計算效率
      const startTime = Date.now();
      const weeklyOccurrences = RecurringCourseCalculator.calculateFutureOccurrences(
        weeklyCourse,
        '2025-07-28',
        '2025-09-28',
        20
      );
      const weeklyTime = Date.now() - startTime;

      console.log(`  ✅ 週重複課程計算: 找到 ${weeklyOccurrences.length} 個實例，耗時 ${weeklyTime}ms`);

      // 測試月重複課程計算效率
      const monthStartTime = Date.now();
      const monthlyOccurrences = RecurringCourseCalculator.calculateFutureOccurrences(
        monthlyCourse,
        '2025-07-28',
        '2025-12-28',
        10
      );
      const monthlyTime = Date.now() - monthStartTime;

      console.log(`  ✅ 月重複課程計算: 找到 ${monthlyOccurrences.length} 個實例，耗時 ${monthlyTime}ms`);

      // 驗證結果正確性
      const weeklyPassed = weeklyOccurrences.length > 0 && weeklyTime < 1000; // 應該在1秒內完成
      const monthlyPassed = monthlyOccurrences.length > 0 && monthlyTime < 1000;

      this.testResults.push({
        test: 'RecurringCalculator 性能',
        input: '週重複課程計算',
        expected: '< 1000ms',
        actual: `${weeklyTime}ms`,
        passed: weeklyPassed,
        description: '週重複課程計算效率'
      });

      this.testResults.push({
        test: 'RecurringCalculator 性能',
        input: '月重複課程計算',
        expected: '< 1000ms',
        actual: `${monthlyTime}ms`,
        passed: monthlyPassed,
        description: '月重複課程計算效率'
      });

    } catch (error) {
      console.log(`  ❌ RecurringCalculator 測試錯誤: ${error.message}`);
      this.testResults.push({
        test: 'RecurringCalculator 性能',
        input: '性能測試',
        expected: '正常運行',
        actual: 'ERROR',
        passed: false,
        error: error.message
      });
    }
    console.log('');
  }

  /**
   * 測試 4: 邊界條件測試
   */
  async testEdgeCases() {
    console.log('🔍 測試 4: 邊界條件測試');
    
    const edgeCases = [
      {
        test: '空字串處理',
        func: () => SemanticService.normalizeCourseNameForConsistency(''),
        expected: '',
        description: '空字串應原樣返回'
      },
      {
        test: 'null 值處理',
        func: () => SemanticService.normalizeCourseNameForConsistency(null),
        expected: null,
        description: 'null 值應原樣返回'
      },
      {
        test: '超長課程名稱',
        func: () => SemanticService.normalizeCourseNameForConsistency('這是一個非常非常非常長的課程名稱'),
        expected: '這是一個非常非常非常長的課程名稱課',
        description: '超長名稱應正常處理'
      },
      {
        test: '特殊字符處理',
        func: () => SemanticService.normalizeCourseNameForConsistency('C++程式設計'),
        expected: 'C++程式設計課',
        description: '特殊字符應正常處理'
      }
    ];

    for (const testCase of edgeCases) {
      try {
        const result = testCase.func();
        const passed = result === testCase.expected;
        
        this.testResults.push({
          test: '邊界條件',
          input: testCase.test,
          expected: testCase.expected,
          actual: result,
          passed: passed,
          description: testCase.description
        });

        console.log(`  ${passed ? '✅' : '❌'} ${testCase.test}: ${JSON.stringify(result)} (期望: ${JSON.stringify(testCase.expected)})`);
      } catch (error) {
        console.log(`  ❌ ${testCase.test}: 錯誤 - ${error.message}`);
        this.testResults.push({
          test: '邊界條件',
          input: testCase.test,
          expected: testCase.expected,
          actual: 'ERROR',
          passed: false,
          error: error.message
        });
      }
    }
    console.log('');
  }

  /**
   * 測試 5: 端到端整合測試
   */
  async testEndToEndIntegration() {
    console.log('🔍 測試 5: 端到端整合測試');
    
    try {
      // 模擬複雜的用戶輸入處理流程
      const complexInput = '每週一下午數學';
      
      // 1. 意圖識別
      const intentResult = IntentRuleEngine.analyzeIntent(complexInput);
      console.log(`  🔍 意圖識別: "${complexInput}" -> ${intentResult.intent}`);
      
      // 2. 課程名稱提取和標準化
      const courseName = SemanticService.extractCourseNameByRegex(complexInput);
      const normalizedName = SemanticService.normalizeCourseNameForConsistency(courseName || '數學');
      console.log(`  📝 課程名稱: "${courseName}" -> "${normalizedName}"`);
      
      // 3. 時間處理
      const timeInfo = await TimeService.parseTimeString('下午2點', TimeService.getCurrentUserTime());
      console.log(`  ⏰ 時間解析: "下午2點" -> ${TimeService.formatForDisplay(timeInfo)}`);
      
      // 驗證整合流程
      const integrationPassed = 
        intentResult.intent === 'create_recurring_course' &&
        normalizedName === '數學課' &&
        timeInfo instanceof Date;

      this.testResults.push({
        test: '端到端整合',
        input: complexInput,
        expected: '完整處理流程',
        actual: `意圖:${intentResult.intent}, 課程:${normalizedName}, 時間:${TimeService.formatForDisplay(timeInfo)}`,
        passed: integrationPassed,
        description: '複雜輸入的完整處理流程'
      });

      console.log(`  ${integrationPassed ? '✅' : '❌'} 端到端整合測試 ${integrationPassed ? '通過' : '失敗'}`);

    } catch (error) {
      console.log(`  ❌ 端到端整合測試錯誤: ${error.message}`);
      this.testResults.push({
        test: '端到端整合',
        input: '複雜輸入',
        expected: '正常處理',
        actual: 'ERROR',
        passed: false,
        error: error.message
      });
    }
    console.log('');
  }

  /**
   * 顯示測試結果摘要
   */
  displayTestResults() {
    console.log('📊 === 測試結果摘要 ===');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`總測試數: ${totalTests}`);
    console.log(`通過: ${passedTests} ✅`);
    console.log(`失敗: ${failedTests} ❌`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ 失敗的測試:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.input}`);
          console.log(`    期望: ${r.expected}, 實際: ${r.actual}`);
          if (r.error) {
            console.log(`    錯誤: ${r.error}`);
          }
        });
    }
    
    console.log('\n🎯 Phase 4 測試完成');
    return passedTests === totalTests;
  }
}

// 執行測試
async function runPhase4Tests() {
  const tester = new Phase4ComprehensiveTest();
  const allPassed = await tester.runAllTests();
  
  if (allPassed) {
    console.log('\n🎉 所有測試通過！系統已準備好進行生產部署。');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分測試失敗，請檢查並修復問題。');
    process.exit(1);
  }
}

// 如果直接執行此文件
if (require.main === module) {
  runPhase4Tests().catch(console.error);
}

module.exports = Phase4ComprehensiveTest;