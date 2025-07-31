/**
 * Memory.yaml 數據結構與業務需求一致性驗證測試
 * 基於 First Principles 設計驗證
 */

const { 
  CourseRecordValidator, 
  MemoryExampleGenerator, 
  BusinessRequirementChecker 
} = require('../src/types/memoryValidation');

/**
 * 業務需求一致性驗證測試套件
 */
class MemoryStructureTest {
  
  /**
   * 運行完整的一致性檢查
   */
  static async runFullConsistencyCheck() {
    console.log('🚀 開始 Memory.yaml 數據結構一致性驗證...\n');

    const results = {
      courseRecordValidation: this.testCourseRecordValidation(),
      memoryStructureTest: this.testMemoryStructure(),
      businessRequirementCheck: this.testBusinessRequirements(),
      gptFallbackCompatibility: this.testGPTFallbackCompatibility(),
      performanceRequirement: this.testPerformanceRequirements()
    };

    this.printTestResults(results);
    return results;
  }

  /**
   * 測試 CourseRecord 驗證邏輯
   */
  static testCourseRecordValidation() {
    console.log('📋 測試 CourseRecord 驗證邏輯...');
    
    const testCases = [
      // 有效的課程記錄
      {
        name: '完整課程記錄',
        data: {
          courseName: '數學課',
          schedule: {
            time: '14:00',
            date: '2025-07-31',
            recurring: 'weekly',
            dayOfWeek: 3
          },
          teacher: '張老師',
          frequency: 5
        },
        expectValid: true
      },
      
      // 無效的課程記錄
      {
        name: '缺少課程名稱',
        data: {
          schedule: { time: '14:00' }
        },
        expectValid: false
      },
      
      {
        name: '無效時間格式',
        data: {
          courseName: '英文課',
          schedule: { time: '25:00' } // 無效時間
        },
        expectValid: false
      },
      
      {
        name: '無效重複類型',
        data: {
          courseName: '音樂課',
          schedule: { recurring: 'daily' } // 不支援的類型
        },
        expectValid: false
      }
    ];

    const results = [];
    testCases.forEach(testCase => {
      const validation = CourseRecordValidator.validate(testCase.data);
      const passed = validation.valid === testCase.expectValid;
      
      results.push({
        name: testCase.name,
        passed,
        details: validation.errors
      });
      
      console.log(`  ${passed ? '✅' : '❌'} ${testCase.name}`);
      if (!passed) {
        console.log(`    錯誤: ${validation.errors.join(', ')}`);
      }
    });

    return {
      category: 'CourseRecord 驗證',
      passed: results.every(r => r.passed),
      details: results
    };
  }

  /**
   * 測試記憶結構完整性
   */
  static testMemoryStructure() {
    console.log('\n🏗️ 測試記憶結構完整性...');
    
    const sampleMemory = MemoryExampleGenerator.generateExample('test_user');
    const issues = [];

    // 1. 檢查必要欄位存在
    if (!sampleMemory.userId) issues.push('缺少 userId 欄位');
    if (!sampleMemory.students) issues.push('缺少 students 欄位');
    if (!sampleMemory.recentActivities) issues.push('缺少 recentActivities 欄位');
    if (!sampleMemory.recurringPatterns) issues.push('缺少 recurringPatterns 欄位');
    if (!sampleMemory.lastUpdated) issues.push('缺少 lastUpdated 欄位');

    // 2. 檢查學生數據結構
    Object.entries(sampleMemory.students).forEach(([studentName, studentInfo]) => {
      if (!Array.isArray(studentInfo.courses)) {
        issues.push(`學生 ${studentName} 的 courses 不是陣列`);
      }
      if (!studentInfo.preferences) {
        issues.push(`學生 ${studentName} 缺少 preferences 欄位`);
      }
    });

    // 3. 檢查活動記錄結構
    sampleMemory.recentActivities.forEach((activity, index) => {
      if (!activity.activityId) issues.push(`活動 ${index} 缺少 activityId`);
      if (!activity.activityType) issues.push(`活動 ${index} 缺少 activityType`);
      if (!activity.timestamp) issues.push(`活動 ${index} 缺少 timestamp`);
    });

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 記憶結構完整性檢查`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return {
      category: '記憶結構完整性',
      passed,
      details: issues
    };
  }

  /**
   * 測試業務需求符合度
   */
  static testBusinessRequirements() {
    console.log('\n📊 測試業務需求符合度...');
    
    const sampleMemory = MemoryExampleGenerator.generateExample('test_user');
    const consistencyCheck = BusinessRequirementChecker.checkConsistency(sampleMemory);
    
    console.log(`  記錄數量: ${consistencyCheck.totalRecords}/20`);
    console.log(`  摘要長度: ${consistencyCheck.summaryLength} 字符`);
    
    const passed = consistencyCheck.valid;
    console.log(`  ${passed ? '✅' : '❌'} 業務需求一致性檢查`);
    
    if (!passed) {
      consistencyCheck.issues.forEach(issue => {
        console.log(`    ❌ ${issue}`);
      });
    }
    
    if (consistencyCheck.recommendations.length > 0) {
      console.log('  💡 改進建議:');
      consistencyCheck.recommendations.forEach(rec => {
        console.log(`    - ${rec}`);
      });
    }

    return {
      category: '業務需求符合度',
      passed,
      details: consistencyCheck
    };
  }

  /**
   * 測試 GPT Fallback 相容性
   */
  static testGPTFallbackCompatibility() {
    console.log('\n🤖 測試 GPT Fallback 相容性...');
    
    const sampleMemory = MemoryExampleGenerator.generateExample('test_user');
    const memorySummary = MemoryExampleGenerator.generateMemorySummary(sampleMemory);
    
    const issues = [];
    
    // 1. 檢查摘要格式
    if (!memorySummary.includes('記憶 Memory.yaml:')) {
      issues.push('摘要缺少標準開頭');
    }
    
    // 2. 檢查學生資訊格式
    Object.keys(sampleMemory.students).forEach(studentName => {
      if (!memorySummary.includes(`${studentName}：`)) {
        issues.push(`摘要缺少學生 ${studentName} 的資訊`);
      }
    });
    
    // 3. 檢查課程格式
    let courseCount = 0;
    Object.values(sampleMemory.students).forEach(studentInfo => {
      studentInfo.courses.forEach(course => {
        courseCount++;
        if (!memorySummary.includes(course.courseName)) {
          issues.push(`摘要缺少課程 ${course.courseName}`);
        }
      });
    });
    
    // 4. 檢查長度限制 (建議 < 2000 字符)
    if (memorySummary.length > 2000) {
      issues.push(`摘要過長 (${memorySummary.length} > 2000 字符)`);
    }
    
    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} GPT Fallback 相容性檢查`);
    console.log(`  課程數量: ${courseCount}`);
    console.log(`  摘要長度: ${memorySummary.length} 字符`);
    
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    // 顯示範例摘要（前500字符）
    console.log('\n  📄 範例記憶摘要:');
    console.log('  ' + '='.repeat(50));
    console.log(memorySummary.substring(0, 500) + (memorySummary.length > 500 ? '...' : ''));
    console.log('  ' + '='.repeat(50));

    return {
      category: 'GPT Fallback 相容性',
      passed,
      details: { issues, summaryLength: memorySummary.length, courseCount }
    };
  }

  /**
   * 測試性能需求
   */
  static testPerformanceRequirements() {
    console.log('\n⚡ 測試性能需求...');
    
    const issues = [];
    const performanceMetrics = {};

    // 1. 記憶創建性能測試
    const startCreate = Date.now();
    const sampleMemory = MemoryExampleGenerator.generateExample('perf_test');
    const createTime = Date.now() - startCreate;
    performanceMetrics.createTime = createTime;
    
    if (createTime > 10) { // 超過10ms
      issues.push(`記憶創建時間過長: ${createTime}ms`);
    }

    // 2. 摘要生成性能測試
    const startSummary = Date.now();
    const summary = MemoryExampleGenerator.generateMemorySummary(sampleMemory);
    const summaryTime = Date.now() - startSummary;
    performanceMetrics.summaryTime = summaryTime;
    
    if (summaryTime > 5) { // 超過5ms
      issues.push(`摘要生成時間過長: ${summaryTime}ms`);
    }

    // 3. 驗證性能測試
    const startValidation = Date.now();
    BusinessRequirementChecker.checkConsistency(sampleMemory);
    const validationTime = Date.now() - startValidation;
    performanceMetrics.validationTime = validationTime;
    
    if (validationTime > 20) { // 超過20ms
      issues.push(`一致性檢查時間過長: ${validationTime}ms`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 性能需求檢查`);
    console.log(`  記憶創建: ${createTime}ms`);
    console.log(`  摘要生成: ${summaryTime}ms`);
    console.log(`  一致性檢查: ${validationTime}ms`);
    
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return {
      category: '性能需求',
      passed,
      details: { issues, metrics: performanceMetrics }
    };
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 Memory.yaml 數據結構一致性驗證結果');
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
      console.log('🎉 所有測試通過！數據結構與業務需求完全一致');
    } else {
      console.log('⚠️  部分測試未通過，需要修正');
    }
    console.log('='.repeat(60));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  MemoryStructureTest.runFullConsistencyCheck()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = MemoryStructureTest;