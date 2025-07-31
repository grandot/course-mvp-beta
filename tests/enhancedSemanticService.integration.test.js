/**
 * EnhancedSemanticService 與 EnhancedConversationContext 整合測試
 * 驗證 Phase 4 的整合效果
 */

const EnhancedSemanticService = require('../src/services/enhancedSemanticService');
const EnhancedConversationContext = require('../src/utils/enhancedConversationContext');
const path = require('path');

class EnhancedSemanticServiceIntegrationTest {
  
  static async runAllTests() {
    console.log('🧪 開始 EnhancedSemanticService 與 EnhancedConversationContext 整合測試...\n');
    
    // 測試配置 - 啟用增強上下文
    const testConfig = {
      memoryYaml: {
        maxRecords: 5,
        storagePath: path.join(process.cwd(), 'test-enhanced-integration'),
        cacheTTL: 1000
      },
      regexFirstPriority: true,
      memoryInjectionEnabled: true,
      smartQueryBypass: true,
      enhancedContextEnabled: true  // 🆕 啟用增強上下文
    };
    
    const service = new EnhancedSemanticService(testConfig);
    
    const testResults = {
      enhancedContextIntegration: await this.testEnhancedContextIntegration(service),
      expandedTriggerIntegration: await this.testExpandedTriggerIntegration(service),
      learningAndPrediction: await this.testLearningAndPrediction(service),
      enhancedStatsIntegration: await this.testEnhancedStatsIntegration(service)
    };
    
    // 清理測試資料
    await this.cleanup(testConfig.memoryYaml.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試增強上下文整合
   */
  static async testEnhancedContextIntegration(service) {
    console.log('🔗 測試增強上下文整合...');
    const issues = [];
    const testUserId = 'test_user_enhanced_integration';

    try {
      // 檢查服務配置
      const stats = service.getServiceStats();
      if (!stats.configuration.enhancedContextEnabled) {
        issues.push('增強上下文未啟用');
        return { category: '增強上下文整合', passed: false, details: issues };
      }

      console.log('  服務配置檢查:');
      console.log(`    ✅ 增強上下文: ${stats.configuration.enhancedContextEnabled ? '啟用' : '停用'}`);
      console.log(`    ✅ 擴展觸發意圖: ${stats.enhancedContextStats?.expandedTriggerIntents || 0} 個`);

      // 測試三層記憶載入使用增強上下文
      const memoryLayers = await service.loadTripleMemory(testUserId);
      
      if (!memoryLayers.enhancedContext) {
        issues.push('三層記憶載入未使用增強上下文');
      } else {
        console.log(`  ✅ 三層記憶載入使用增強上下文`);
      }

      // 測試記憶更新觸發增強上下文
      const mockResult = {
        success: true,
        intent: 'record_lesson_content', // 新增的觸發意圖
        confidence: 0.95,
        entities: {
          student: '小明',
          courseName: '數學課',
          content: '今天學習了二次方程式'
        }
      };

      await service.updateTripleMemory(testUserId, mockResult, memoryLayers);

      // 檢查是否觸發增強上下文更新
      const updatedContext = EnhancedConversationContext.getContext(testUserId);
      if (!updatedContext) {
        issues.push('增強上下文更新失敗');
      } else if (updatedContext.lastIntent !== 'record_lesson_content') {
        issues.push(`增強上下文更新錯誤: 預期 record_lesson_content, 實際 ${updatedContext.lastIntent}`);
      } else {
        console.log(`  ✅ 增強上下文更新成功: ${updatedContext.lastIntent}`);
        
        // 檢查學習數據
        if (updatedContext.recentCourses && updatedContext.recentCourses.length > 0) {
          console.log(`  ✅ 學習數據生成: ${updatedContext.recentCourses.length} 門最近課程`);
        }
        
        if (updatedContext.userPreferences && updatedContext.userPreferences.defaultStudent) {
          console.log(`  ✅ 用戶習慣學習: 默認學生 ${updatedContext.userPreferences.defaultStudent.name}`);
        }
      }

    } catch (error) {
      issues.push(`增強上下文整合測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 增強上下文整合測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '增強上下文整合', passed, details: issues };
  }

  /**
   * 測試擴展觸發整合
   */
  static async testExpandedTriggerIntegration(service) {
    console.log('\n🎯 測試擴展觸發整合...');
    const issues = [];
    const testUserId = 'test_user_expanded_trigger';

    try {
      // 測試新增的觸發意圖
      const newTriggerIntents = [
        { intent: 'upload_class_photo', entities: { courseName: '美術課', student: '小華' } },
        { intent: 'set_reminder', entities: { courseName: '英文課', student: '小明' } },
        { intent: 'query_course_content', entities: { courseName: '數學課', student: '小明' } }
      ];

      console.log('  測試新增觸發意圖:');
      for (const testCase of newTriggerIntents) {
        const mockResult = {
          success: true,
          intent: testCase.intent,
          confidence: 0.9,
          entities: testCase.entities
        };

        const memoryLayers = await service.loadTripleMemory(testUserId);
        await service.updateTripleMemory(testUserId, mockResult, memoryLayers);

        // 檢查是否正確觸發增強上下文
        const context = EnhancedConversationContext.getContext(testUserId);
        if (!context || context.lastIntent !== testCase.intent) {
          issues.push(`新觸發意圖失敗: ${testCase.intent}`);
        } else {
          console.log(`    ✅ ${testCase.intent} → 上下文已更新`);
        }
      }

      // 測試不應觸發的意圖
      const nonTriggerResult = {
        success: true,
        intent: 'greeting',
        confidence: 0.9,
        entities: {}
      };

      const beforeContext = EnhancedConversationContext.getContext(testUserId);
      const lastIntent = beforeContext?.lastIntent;

      const memoryLayers = await service.loadTripleMemory(testUserId);
      await service.updateTripleMemory(testUserId, nonTriggerResult, memoryLayers);

      const afterContext = EnhancedConversationContext.getContext(testUserId);
      if (afterContext?.lastIntent !== lastIntent) {
        issues.push('非觸發意圖錯誤更新了上下文');
      } else {
        console.log(`    ✅ greeting → 正確跳過上下文更新`);
      }

    } catch (error) {
      issues.push(`擴展觸發整合測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 擴展觸發整合測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '擴展觸發整合', passed, details: issues };
  }

  /**
   * 測試學習與預測功能整合
   */
  static async testLearningAndPrediction(service) {
    console.log('\n🧠 測試學習與預測功能整合...');
    const issues = [];
    const testUserId = 'test_user_learning_prediction';

    try {
      // 建立可預測的行為模式
      const behaviorPattern = [
        { intent: 'add_course', entities: { courseName: '數學課', student: '小明' } },
        { intent: 'record_lesson_content', entities: { courseName: '數學課', student: '小明' } },
        { intent: 'add_course', entities: { courseName: '英文課', student: '小明' } },
        { intent: 'record_lesson_content', entities: { courseName: '英文課', student: '小明' } },
        { intent: 'add_course', entities: { courseName: '物理課', student: '小明' } },
        { intent: 'record_lesson_content', entities: { courseName: '物理課', student: '小明' } }
      ];

      console.log('  建立學習模式:');
      for (let i = 0; i < behaviorPattern.length; i++) {
        const pattern = behaviorPattern[i];
        const mockResult = {
          success: true,
          intent: pattern.intent,
          confidence: 0.9,
          entities: pattern.entities
        };

        const memoryLayers = await service.loadTripleMemory(testUserId);
        await service.updateTripleMemory(testUserId, mockResult, memoryLayers);
        
        console.log(`    ${i + 1}. ${pattern.intent} - ${pattern.entities.courseName}`);
      }

      // 檢查學習結果
      const context = EnhancedConversationContext.getContext(testUserId);
      if (!context || !context.userPreferences) {
        issues.push('學習數據生成失敗');
      } else {
        // 檢查默認學生學習
        if (!context.userPreferences.defaultStudent || context.userPreferences.defaultStudent.name !== '小明') {
          issues.push('默認學生學習失敗');
        } else {
          console.log(`  ✅ 默認學生學習: ${context.userPreferences.defaultStudent.name} (置信度: ${context.userPreferences.defaultStudent.confidence?.toFixed(2)})`);
        }

        // 檢查課程頻率學習
        const recentCourses = context.recentCourses || [];
        if (recentCourses.length === 0) {
          issues.push('課程頻率學習失敗');
        } else {
          console.log(`  ✅ 課程頻率學習: ${recentCourses.length} 門課程`);
          recentCourses.forEach(course => {
            console.log(`    - ${course.name}: ${course.frequency} 次`);
          });
        }
      }

      // 測試預測功能
      console.log('  測試智能預測:');
      const prediction = service.predictUserNextAction(testUserId, 'add_course');
      
      if (!prediction) {
        issues.push('智能預測功能失敗');
      } else if (prediction.predictedIntent !== 'record_lesson_content') {
        issues.push(`預測結果錯誤: 預期 record_lesson_content, 實際 ${prediction.predictedIntent}`);
      } else {
        console.log(`    ✅ 預測成功: add_course → ${prediction.predictedIntent} (置信度: ${prediction.confidence.toFixed(2)})`);
      }

    } catch (error) {
      issues.push(`學習與預測功能整合測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 學習與預測功能整合測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '學習與預測功能整合', passed, details: issues };
  }

  /**
   * 測試增強統計整合
   */
  static async testEnhancedStatsIntegration(service) {
    console.log('\n📊 測試增強統計整合...');
    const issues = [];

    try {
      // 獲取整合統計
      const stats = service.getServiceStats();
      
      console.log('  整合統計信息:');
      console.log(`    配置 - 增強上下文: ${stats.configuration.enhancedContextEnabled ? '啟用' : '停用'}`);
      
      // 檢查增強上下文統計
      if (!stats.enhancedContextStats) {
        issues.push('缺少增強上下文統計');
      } else {
        console.log(`    增強上下文統計:`);
        console.log(`      - 活躍上下文: ${stats.enhancedContextStats.activeContexts}`);
        console.log(`      - 擴展觸發意圖: ${stats.enhancedContextStats.expandedTriggerIntents}`);
        console.log(`      - 具有學習數據的上下文: ${stats.enhancedContextStats.contextsWithLearning}`);
        console.log(`      - 平均學習數據量: ${stats.enhancedContextStats.averageLearningDataPerContext.toFixed(2)}`);
        
        if (stats.enhancedContextStats.expandedTriggerIntents < 10) {
          issues.push('擴展觸發意圖數量不正確');
        }
      }

      // 檢查基礎統計
      if (!stats.memoryYamlStats || !stats.smartQueryStats) {
        issues.push('基礎統計信息缺失');
      } else {
        console.log(`    基礎統計:`);
        console.log(`      - Memory.yaml 快取大小: ${stats.memoryYamlStats.cacheSize}`);
        console.log(`      - SmartQuery 支援類型: ${stats.smartQueryStats.supportedQueryTypes}`);
      }

    } catch (error) {
      issues.push(`增強統計整合測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 增強統計整合測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '增強統計整合', passed, details: issues };
  }

  /**
   * 清理測試檔案
   */
  static async cleanup(testStoragePath) {
    try {
      const fs = require('fs').promises;
      const files = await fs.readdir(testStoragePath);
      for (const file of files) {
        await fs.unlink(path.join(testStoragePath, file));
      }
      await fs.rmdir(testStoragePath);
      console.log('\n🧹 測試檔案清理完成');
    } catch (error) {
      // 忽略清理錯誤
    }

    // 清理增強上下文
    const testUserIds = [
      'test_user_enhanced_integration',
      'test_user_expanded_trigger',
      'test_user_learning_prediction'
    ];

    for (const userId of testUserIds) {
      EnhancedConversationContext.clearContext(userId);
    }
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 EnhancedSemanticService 與 EnhancedConversationContext 整合測試結果');
    console.log('='.repeat(80));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`總結: ${totalPassed}/${totalTests} 項測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有整合測試通過！Phase 4 整合成功');
      console.log('🚀 EnhancedConversationContext 與 EnhancedSemanticService 完美整合');
      console.log('🧠 用戶習慣學習、智能預測、擴展觸發功能已全面就緒');
    } else {
      console.log('⚠️  部分測試未通過，需要修正');
      
      // 列出失敗的測試
      Object.values(results).forEach(result => {
        if (!result.passed) {
          console.log(`\n❌ ${result.category} 失敗原因:`);
          result.details.forEach(detail => console.log(`   - ${detail}`));
        }
      });
    }
    console.log('='.repeat(80));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  EnhancedSemanticServiceIntegrationTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = EnhancedSemanticServiceIntegrationTest;