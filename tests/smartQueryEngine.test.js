/**
 * SmartQueryEngine 功能測試
 * 驗證明確查詢檢測和執行功能
 */

const SmartQueryEngine = require('../src/services/smartQueryEngine');

class SmartQueryEngineTest {
  
  static async runAllTests() {
    console.log('🧪 開始 SmartQueryEngine 功能測試...\n');
    
    const engine = new SmartQueryEngine();
    
    const testResults = {
      queryDetection: await this.testQueryDetection(engine),
      queryTypeClassification: await this.testQueryTypeClassification(engine),
      queryExecution: await this.testQueryExecution(engine),
      timeRangeParsing: await this.testTimeRangeParsing(engine),
      entityExtraction: await this.testEntityExtraction(engine)
    };
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試查詢檢測功能
   */
  static async testQueryDetection(engine) {
    console.log('🔍 測試查詢檢測功能...');
    const issues = [];

    // 明確查詢語句測試
    const explicitQueries = [
      '查看今天的課程',
      '明天有什麼課',
      '這週的時間表',
      '有哪些課程',
      '張老師教什麼課',
      '小明上什麼課',
      '最近的活動記錄'
    ];

    // 非查詢語句測試
    const nonQueries = [
      '明天2點數學課',
      '取消課程',
      '修改時間',
      '你好',
      '謝謝'
    ];

    console.log('  測試明確查詢檢測:');
    for (const query of explicitQueries) {
      const isQuery = engine.isExplicitQuery(query);
      console.log(`    "${query}" → ${isQuery ? '✅' : '❌'}`);
      
      if (!isQuery) {
        issues.push(`應該檢測為查詢但未檢測到: "${query}"`);
      }
    }

    console.log('  測試非查詢語句:');
    for (const nonQuery of nonQueries) {
      const isQuery = engine.isExplicitQuery(nonQuery);
      console.log(`    "${nonQuery}" → ${isQuery ? '❌' : '✅'}`);
      
      if (isQuery) {
        issues.push(`不應該檢測為查詢但被檢測到: "${nonQuery}"`);
      }
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 查詢檢測功能測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '查詢檢測功能', passed, details: issues };
  }

  /**
   * 測試查詢類型分類
   */
  static async testQueryTypeClassification(engine) {
    console.log('\n📋 測試查詢類型分類...');
    const issues = [];

    const testCases = [
      // 課程時間表查詢
      { query: '查看今天的課程', expectedType: 'schedule' },
      { query: '明天有什麼課', expectedType: 'schedule' },
      { query: '這週的時間表', expectedType: 'schedule' },
      
      // 課程列表查詢
      { query: '有哪些課程', expectedType: 'course_list' },
      { query: '課程列表', expectedType: 'course_list' },
      { query: '所有的課程', expectedType: 'course_list' },
      
      // 老師課程查詢
      { query: '張老師教什麼課', expectedType: 'teacher_courses' },
      { query: '李老師的課程', expectedType: 'teacher_courses' },
      
      // 學生課程查詢
      { query: '小明上什麼課', expectedType: 'student_courses' },
      { query: '小華的課程安排', expectedType: 'student_courses' },
      
      // 最近活動查詢
      { query: '最近的活動', expectedType: 'recent_activities' },
      { query: '歷史記錄', expectedType: 'recent_activities' }
    ];

    console.log('  查詢類型分類結果:');
    for (const testCase of testCases) {
      const detectedType = engine.detectQueryType(testCase.query);
      const correct = detectedType === testCase.expectedType;
      
      console.log(`    "${testCase.query}" → ${detectedType} ${correct ? '✅' : '❌'}`);
      
      if (!correct) {
        issues.push(`查詢類型錯誤: "${testCase.query}" 預期 ${testCase.expectedType}, 實際 ${detectedType}`);
      }
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 查詢類型分類測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '查詢類型分類', passed, details: issues };
  }

  /**
   * 測試查詢執行
   */
  static async testQueryExecution(engine) {
    console.log('\n⚡ 測試查詢執行...');
    const issues = [];
    const testUserId = 'test_user_query';

    const testQueries = [
      { text: '查看今天的課程', type: 'schedule' },
      { text: '有哪些課程', type: 'course_list' },
      { text: '張老師教什麼課', type: 'teacher_courses' },
      { text: '小明上什麼課', type: 'student_courses' },
      { text: '最近的活動', type: 'recent_activities' }
    ];

    console.log('  查詢執行結果:');
    for (const testQuery of testQueries) {
      try {
        const result = await engine.handleExplicitQuery(testQuery.text, testUserId);
        
        if (result) {
          console.log(`    "${testQuery.text}" → ✅ (類型: ${result.queryType})`);
          
          // 檢查返回結果結構
          if (!result.type || result.type !== 'smart_query_response') {
            issues.push(`查詢結果格式錯誤: "${testQuery.text}"`);
          }
          
          if (!result.bypassSemanticProcessing) {
            issues.push(`未設置語意處理繞過標記: "${testQuery.text}"`);
          }
          
          if (!result.data) {
            issues.push(`查詢結果缺少數據: "${testQuery.text}"`);
          }
        } else {
          console.log(`    "${testQuery.text}" → ❌ (無結果)`);
          issues.push(`查詢執行失敗: "${testQuery.text}"`);
        }
      } catch (error) {
        console.log(`    "${testQuery.text}" → ❌ (錯誤: ${error.message})`);
        issues.push(`查詢執行異常: "${testQuery.text}" - ${error.message}`);
      }
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 查詢執行測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '查詢執行', passed, details: issues };
  }

  /**
   * 測試時間範圍解析
   */
  static async testTimeRangeParsing(engine) {
    console.log('\n📅 測試時間範圍解析...');
    const issues = [];

    const timeTestCases = [
      { text: '今天的課程', expectedDesc: '今天' },
      { text: '明天有什麼課', expectedDesc: '明天' },
      { text: '這週的時間表', expectedDesc: '本週' },
      { text: '本週課程安排', expectedDesc: '本週' }
    ];

    console.log('  時間範圍解析結果:');
    for (const testCase of timeTestCases) {
      const timeRange = engine.parseTimeRange(testCase.text);
      const correct = timeRange.description === testCase.expectedDesc;
      
      console.log(`    "${testCase.text}" → ${timeRange.description} (${timeRange.start} ~ ${timeRange.end}) ${correct ? '✅' : '❌'}`);
      
      if (!correct) {
        issues.push(`時間解析錯誤: "${testCase.text}" 預期 ${testCase.expectedDesc}, 實際 ${timeRange.description}`);
      }
      
      // 檢查日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(timeRange.start)) {
        issues.push(`日期格式錯誤: ${timeRange.start}`);
      }
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 時間範圍解析測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '時間範圍解析', passed, details: issues };
  }

  /**
   * 測試實體提取
   */
  static async testEntityExtraction(engine) {
    console.log('\n🏷️  測試實體提取...');
    const issues = [];

    // 老師姓名提取測試
    const teacherTests = [
      { text: '張老師教什麼課', expected: '張老師' },
      { text: '李老師的課程', expected: '李老師' },
      { text: '王老師今天有課嗎', expected: '王老師' }
    ];

    console.log('  老師姓名提取:');
    for (const test of teacherTests) {
      const extracted = engine.extractTeacherName(test.text);
      const correct = extracted === test.expected;
      
      console.log(`    "${test.text}" → ${extracted || 'null'} ${correct ? '✅' : '❌'}`);
      
      if (!correct) {
        issues.push(`老師姓名提取錯誤: "${test.text}" 預期 ${test.expected}, 實際 ${extracted}`);
      }
    }

    // 學生姓名提取測試
    const studentTests = [
      { text: '小明上什麼課', expected: '小明' },
      { text: '小華的課程安排', expected: '小華' },
      { text: '小偉今天有課嗎', expected: '小偉' }
    ];

    console.log('  學生姓名提取:');
    for (const test of studentTests) {
      const extracted = engine.extractStudentName(test.text);
      const correct = extracted === test.expected;
      
      console.log(`    "${test.text}" → ${extracted || 'null'} ${correct ? '✅' : '❌'}`);
      
      if (!correct) {
        issues.push(`學生姓名提取錯誤: "${test.text}" 預期 ${test.expected}, 實際 ${extracted}`);
      }
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 實體提取測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '實體提取', passed, details: issues };
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 SmartQueryEngine 功能測試結果');
    console.log('='.repeat(60));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`總結: ${totalPassed}/${totalTests} 項測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有功能測試通過！SmartQueryEngine 運作正常');
    } else {
      console.log('⚠️  部分測試未通過，需要修正');
    }
    console.log('='.repeat(60));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  SmartQueryEngineTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = SmartQueryEngineTest;