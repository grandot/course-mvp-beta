/**
 * EnhancedConversationContext 功能測試
 * 驗證擴展觸發機制和用戶習慣學習功能
 */

const EnhancedConversationContext = require('../src/utils/enhancedConversationContext');

class EnhancedConversationContextTest {
  
  static async runAllTests() {
    console.log('🧪 開始 EnhancedConversationContext 功能測試...\n');
    
    const testResults = {
      expandedTriggers: await this.testExpandedTriggers(),
      learningMechanism: await this.testLearningMechanism(),
      defaultStudentLearning: await this.testDefaultStudentLearning(),
      courseFrequencyLearning: await this.testCourseFrequencyLearning(),
      patternPrediction: await this.testPatternPrediction(),
      contextStats: await this.testContextStats()
    };
    
    // 清理測試數據
    this.cleanup();
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試擴展觸發機制
   */
  static async testExpandedTriggers() {
    console.log('🎯 測試擴展觸發機制...');
    const issues = [];
    const testUserId = 'test_user_triggers';

    try {
      // 清理測試環境
      EnhancedConversationContext.clearContext(testUserId);

      // 測試原有觸發意圖
      const originalIntents = [
        { intent: 'record_course', entities: { courseName: '數學課', student: '小明' }, shouldTrigger: true },
        { intent: 'modify_course', entities: { courseName: '英文課' }, shouldTrigger: true },
        { intent: 'cancel_course', entities: { courseName: '物理課' }, shouldTrigger: true }
      ];

      // 測試新增觸發意圖
      const newIntents = [
        { intent: 'add_course', entities: { courseName: '化學課', student: '小華' }, shouldTrigger: true },
        { intent: 'record_lesson_content', entities: { courseName: '生物課', student: '小李' }, shouldTrigger: true },
        { intent: 'set_reminder', entities: { courseName: '歷史課' }, shouldTrigger: true },
        { intent: 'query_schedule', entities: { student: '小明' }, shouldTrigger: true },
        { intent: 'upload_class_photo', entities: { courseName: '美術課' }, shouldTrigger: true }
      ];

      // 測試不應觸發的意圖
      const nonTriggerIntents = [
        { intent: 'greeting', entities: {}, shouldTrigger: false },
        { intent: 'unknown', entities: {}, shouldTrigger: false },
        { intent: 'query_schedule', entities: {}, shouldTrigger: false } // 無實體的查詢
      ];

      const allTestCases = [...originalIntents, ...newIntents, ...nonTriggerIntents];

      console.log('  測試觸發判斷邏輯:');
      for (const testCase of allTestCases) {
        const shouldTrigger = EnhancedConversationContext.shouldTriggerContextUpdate(
          testCase.intent, 
          testCase.entities
        );
        
        console.log(`    "${testCase.intent}" → ${shouldTrigger ? '觸發' : '跳過'} ${shouldTrigger === testCase.shouldTrigger ? '✅' : '❌'}`);
        
        if (shouldTrigger !== testCase.shouldTrigger) {
          issues.push(`觸發判斷錯誤: ${testCase.intent} 預期 ${testCase.shouldTrigger}, 實際 ${shouldTrigger}`);
        }
      }

      // 測試實際上下文更新
      console.log('  測試實際上下文更新:');
      EnhancedConversationContext.updateContext(testUserId, 'add_course', {
        courseName: '測試課程',
        student: '測試學生',
        teacher: '測試老師'
      });

      const context = EnhancedConversationContext.getContext(testUserId);
      if (!context) {
        issues.push('上下文更新失敗 - 無法獲取上下文');
      } else {
        if (context.lastIntent !== 'add_course') {
          issues.push(`意圖記錄錯誤: 預期 add_course, 實際 ${context.lastIntent}`);
        }
        if (context.lastCourse !== '測試課程') {
          issues.push(`課程記錄錯誤: 預期 測試課程, 實際 ${context.lastCourse}`);
        }
        if (!context.recentCourses || context.recentCourses.length === 0) {
          issues.push('最近課程列表未更新');
        }
        console.log(`    ✅ 上下文更新成功: ${context.lastIntent} - ${context.lastCourse}`);
      }

    } catch (error) {
      issues.push(`擴展觸發機制測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 擴展觸發機制測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '擴展觸發機制', passed, details: issues };
  }

  /**
   * 測試學習機制
   */
  static async testLearningMechanism() {
    console.log('\n🧠 測試學習機制...');
    const issues = [];
    const testUserId = 'test_user_learning';

    try {
      // 清理測試環境
      EnhancedConversationContext.clearContext(testUserId);

      // 模擬多次交互以觸發學習
      const interactions = [
        { intent: 'add_course', entities: { courseName: '數學課', student: '小明', teacher: '張老師' } },
        { intent: 'record_lesson_content', entities: { courseName: '數學課', student: '小明' } },
        { intent: 'modify_course', entities: { courseName: '數學課', student: '小明' } },
        { intent: 'add_course', entities: { courseName: '英文課', student: '小明', teacher: '李老師' } },
        { intent: 'record_lesson_content', entities: { courseName: '英文課', student: '小明' } },
        { intent: 'add_course', entities: { courseName: '物理課', student: '小華', teacher: '王老師' } }
      ];

      console.log('  執行學習交互序列:');
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i];
        EnhancedConversationContext.updateContext(
          testUserId, 
          interaction.intent, 
          interaction.entities
        );
        console.log(`    ${i + 1}. ${interaction.intent} - ${interaction.entities.courseName} (${interaction.entities.student})`);
      }

      // 檢查學習結果
      const context = EnhancedConversationContext.getContext(testUserId);
      if (!context) {
        issues.push('學習測試失敗 - 無法獲取上下文');
        return { category: '學習機制', passed: false, details: issues };
      }

      console.log('  檢查學習結果:');
      
      // 檢查最近課程學習
      if (!context.recentCourses || context.recentCourses.length === 0) {
        issues.push('最近課程學習失敗');
      } else {
        const mathCourse = context.recentCourses.find(c => c.name === '數學課');
        if (!mathCourse || mathCourse.frequency < 3) {
          issues.push(`數學課頻率學習不正確: 預期 >= 3, 實際 ${mathCourse?.frequency || 0}`);
        } else {
          console.log(`    ✅ 課程頻率學習: 數學課 ${mathCourse.frequency} 次`);
        }
      }

      // 檢查最近學生學習
      if (!context.recentStudents || context.recentStudents.length === 0) {
        issues.push('最近學生學習失敗');
      } else {
        const xiaoMing = context.recentStudents.find(s => s.name === '小明');
        if (!xiaoMing || xiaoMing.frequency < 5) {
          issues.push(`小明頻率學習不正確: 預期 >= 5, 實際 ${xiaoMing?.frequency || 0}`);
        } else {
          console.log(`    ✅ 學生頻率學習: 小明 ${xiaoMing.frequency} 次`);
        }
      }

      // 檢查用戶偏好學習
      if (!context.userPreferences) {
        issues.push('用戶偏好學習失敗');
      } else {
        // 檢查默認學生學習
        if (context.userPreferences.defaultStudent?.name !== '小明') {
          issues.push(`默認學生學習錯誤: 預期 小明, 實際 ${context.userPreferences.defaultStudent?.name}`);
        } else {
          console.log(`    ✅ 默認學生學習: ${context.userPreferences.defaultStudent.name} (置信度: ${context.userPreferences.defaultStudent.confidence?.toFixed(2)})`);
        }

        // 檢查主導課程學習
        const dominantCourses = context.userPreferences.dominantCourses || [];
        if (dominantCourses.length === 0) {
          console.log(`    ⚠️ 主導課程: 暫無 (需要更多數據)`);
        } else {
          console.log(`    ✅ 主導課程: ${dominantCourses.map(c => `${c.name}(${c.frequency})`).join(', ')}`);
        }

        // 檢查模式置信度
        if (typeof context.userPreferences.patternConfidence !== 'number') {
          issues.push('模式置信度計算失敗');
        } else {
          console.log(`    ✅ 模式置信度: ${context.userPreferences.patternConfidence.toFixed(2)}`);
        }
      }

      // 檢查會話元數據
      if (!context.sessionMetadata) {
        issues.push('會話元數據學習失敗');
      } else {
        if (context.sessionMetadata.totalInteractions !== interactions.length) {
          issues.push(`交互次數統計錯誤: 預期 ${interactions.length}, 實際 ${context.sessionMetadata.totalInteractions}`);
        } else {
          console.log(`    ✅ 交互統計: ${context.sessionMetadata.totalInteractions} 次交互`);
        }

        if (!context.sessionMetadata.intentHistory || context.sessionMetadata.intentHistory.length === 0) {
          issues.push('意圖歷史記錄失敗');
        } else {
          console.log(`    ✅ 意圖歷史: ${context.sessionMetadata.intentHistory.length} 條記錄`);
        }
      }

    } catch (error) {
      issues.push(`學習機制測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 學習機制測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '學習機制', passed, details: issues };
  }

  /**
   * 測試默認學生學習
   */
  static async testDefaultStudentLearning() {
    console.log('\n👨‍🎓 測試默認學生學習...');
    const issues = [];
    const testUserId = 'test_user_default_student';

    try {
      // 清理測試環境
      EnhancedConversationContext.clearContext(testUserId);

      // 模擬不平衡的學生提及
      const interactions = [
        { student: '小明', courseName: '數學課' },
        { student: '小明', courseName: '英文課' },
        { student: '小明', courseName: '物理課' },
        { student: '小明', courseName: '化學課' },
        { student: '小華', courseName: '音樂課' },
        { student: '小李', courseName: '美術課' }
      ];

      console.log('  執行不平衡學生交互:');
      for (const interaction of interactions) {
        EnhancedConversationContext.updateContext(testUserId, 'add_course', interaction);
        console.log(`    ${interaction.student} - ${interaction.courseName}`);
      }

      const context = EnhancedConversationContext.getContext(testUserId);
      if (!context || !context.userPreferences) {
        issues.push('默認學生學習測試失敗 - 無偏好數據');
        return { category: '默認學生學習', passed: false, details: issues };
      }

      // 檢查默認學生識別
      const defaultStudent = context.userPreferences.defaultStudent;
      if (!defaultStudent) {
        issues.push('未識別出默認學生');
      } else if (defaultStudent.name !== '小明') {
        issues.push(`默認學生錯誤: 預期 小明, 實際 ${defaultStudent.name}`);
      } else if (defaultStudent.confidence < 0.6) {
        issues.push(`默認學生置信度過低: ${defaultStudent.confidence}`);
      } else {
        console.log(`  ✅ 默認學生識別: ${defaultStudent.name} (置信度: ${defaultStudent.confidence.toFixed(2)}, 提及: ${defaultStudent.totalMentions}次)`);
      }

      // 測試學習更新機制
      EnhancedConversationContext.updateContext(testUserId, 'modify_course', { student: '小明', courseName: '生物課' });
      
      const updatedContext = EnhancedConversationContext.getContext(testUserId);
      const updatedDefault = updatedContext.userPreferences.defaultStudent;
      
      if (!updatedDefault || updatedDefault.totalMentions !== 5) {
        issues.push(`默認學生更新失敗: 預期提及次數 5, 實際 ${updatedDefault?.totalMentions}`);
      } else {
        console.log(`  ✅ 默認學生更新: 提及次數增加到 ${updatedDefault.totalMentions}`);
      }

    } catch (error) {
      issues.push(`默認學生學習測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 默認學生學習測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '默認學生學習', passed, details: issues };
  }

  /**
   * 測試課程頻率學習
   */
  static async testCourseFrequencyLearning() {
    console.log('\n📚 測試課程頻率學習...');
    const issues = [];
    const testUserId = 'test_user_course_frequency';

    try {
      // 清理測試環境
      EnhancedConversationContext.clearContext(testUserId);

      // 模擬高頻課程活動
      const courseActivities = [
        { courseName: '數學課', student: '小明' },
        { courseName: '數學課', student: '小明' },
        { courseName: '數學課', student: '小明' },
        { courseName: '數學課', student: '小明' }, // 4次數學課
        { courseName: '英文課', student: '小明' },
        { courseName: '英文課', student: '小明' },
        { courseName: '英文課', student: '小明' }, // 3次英文課  
        { courseName: '物理課', student: '小華' },
        { courseName: '物理課', student: '小華' } // 2次物理課
      ];

      console.log('  執行課程頻率交互:');
      for (const activity of courseActivities) {
        EnhancedConversationContext.updateContext(testUserId, 'record_lesson_content', activity);
      }

      const context = EnhancedConversationContext.getContext(testUserId);
      if (!context) {
        issues.push('課程頻率學習測試失敗 - 無上下文');
        return { category: '課程頻率學習', passed: false, details: issues };
      }

      // 檢查最近課程頻率
      const recentCourses = context.recentCourses || [];
      console.log('  課程頻率統計:');
      
      const mathCourse = recentCourses.find(c => c.name === '數學課');
      const englishCourse = recentCourses.find(c => c.name === '英文課');
      const physicsCourse = recentCourses.find(c => c.name === '物理課');

      if (!mathCourse || mathCourse.frequency !== 4) {
        issues.push(`數學課頻率錯誤: 預期 4, 實際 ${mathCourse?.frequency || 0}`);
      } else {
        console.log(`    ✅ 數學課: ${mathCourse.frequency} 次`);
      }

      if (!englishCourse || englishCourse.frequency !== 3) {
        issues.push(`英文課頻率錯誤: 預期 3, 實際 ${englishCourse?.frequency || 0}`);
      } else {
        console.log(`    ✅ 英文課: ${englishCourse.frequency} 次`);
      }

      if (!physicsCourse || physicsCourse.frequency !== 2) {
        issues.push(`物理課頻率錯誤: 預期 2, 實際 ${physicsCourse?.frequency || 0}`);
      } else {
        console.log(`    ✅ 物理課: ${physicsCourse.frequency} 次`);
      }

      // 檢查主導課程識別 (頻率 >= 3)
      const dominantCourses = context.userPreferences?.dominantCourses || [];
      const expectedDominant = ['數學課', '英文課']; // 頻率 >= 3 的課程

      console.log('  主導課程識別:');
      for (const expectedCourse of expectedDominant) {
        const found = dominantCourses.find(c => c.name === expectedCourse);
        if (!found) {
          issues.push(`主導課程遺漏: ${expectedCourse}`);
        } else {
          console.log(`    ✅ ${found.name}: 頻率 ${found.frequency}, 置信度 ${found.confidence.toFixed(2)}`);
        }
      }

      // 物理課不應該被識別為主導課程 (頻率 < 3)
      const physicsInDominant = dominantCourses.find(c => c.name === '物理課');
      if (physicsInDominant) {
        issues.push('物理課不應被識別為主導課程 (頻率不足)');
      }

    } catch (error) {
      issues.push(`課程頻率學習測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 課程頻率學習測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '課程頻率學習', passed, details: issues };
  }

  /**
   * 測試模式預測
   */
  static async testPatternPrediction() {
    console.log('\n🔮 測試模式預測...');
    const issues = [];
    const testUserId = 'test_user_prediction';

    try {
      // 清理測試環境
      EnhancedConversationContext.clearContext(testUserId);

      // 建立可預測的意圖序列模式
      const intentSequences = [
        'add_course', 'record_lesson_content',        // 序列1
        'add_course', 'record_lesson_content',        // 序列2 (重複)
        'modify_course', 'set_reminder',              // 序列3
        'modify_course', 'set_reminder',              // 序列4 (重複)
        'add_course', 'record_lesson_content',        // 序列5 (再次重複)
      ];

      console.log('  建立意圖序列模式:');
      for (let i = 0; i < intentSequences.length; i++) {
        const intent = intentSequences[i];
        EnhancedConversationContext.updateContext(testUserId, intent, {
          courseName: `課程${i}`,
          student: '小明'
        });
        console.log(`    ${i + 1}. ${intent}`);
      }

      // 測試預測 add_course 後的下一步
      console.log('  測試意圖預測:');
      const predictionAfterAdd = EnhancedConversationContext.predictNextAction(testUserId, 'add_course');
      
      if (!predictionAfterAdd) {
        issues.push('add_course 後的預測失敗');
      } else if (predictionAfterAdd.predictedIntent !== 'record_lesson_content') {
        issues.push(`add_course 預測錯誤: 預期 record_lesson_content, 實際 ${predictionAfterAdd.predictedIntent}`);
      } else {
        console.log(`    ✅ add_course → ${predictionAfterAdd.predictedIntent} (置信度: ${predictionAfterAdd.confidence.toFixed(2)})`);
      }

      // 測試預測 modify_course 後的下一步
      const predictionAfterModify = EnhancedConversationContext.predictNextAction(testUserId, 'modify_course');
      
      if (!predictionAfterModify) {
        issues.push('modify_course 後的預測失敗');
      } else if (predictionAfterModify.predictedIntent !== 'set_reminder') {
        issues.push(`modify_course 預測錯誤: 預期 set_reminder, 實際 ${predictionAfterModify.predictedIntent}`);
      } else {
        console.log(`    ✅ modify_course → ${predictionAfterModify.predictedIntent} (置信度: ${predictionAfterModify.confidence.toFixed(2)})`);
      }

      // 測試沒有模式的意圖預測
      const predictionNoPattern = EnhancedConversationContext.predictNextAction(testUserId, 'query_schedule');
      if (predictionNoPattern) {
        console.log(`    ⚠️ 無模式意圖也有預測: ${predictionNoPattern.predictedIntent} (可能是噪聲)`);
      } else {
        console.log(`    ✅ 無模式意圖正確返回 null`);
      }

    } catch (error) {
      issues.push(`模式預測測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 模式預測測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '模式預測', passed, details: issues };
  }

  /**
   * 測試上下文統計
   */
  static async testContextStats() {
    console.log('\n📊 測試上下文統計...');
    const issues = [];

    try {
      // 先清理所有測試上下文，確保統計準確
      this.cleanup();
      
      // 創建多個測試用戶的上下文
      const testUsers = ['user1', 'user2', 'user3'];
      
      for (const userId of testUsers) {
        EnhancedConversationContext.updateContext(userId, 'add_course', {
          courseName: `${userId}的課程`,
          student: `${userId}學生`
        });
      }

      // 獲取增強統計信息
      const stats = EnhancedConversationContext.getEnhancedStats();
      
      console.log('  增強統計信息:');
      console.log(`    活躍上下文: ${stats.activeContexts}`);
      console.log(`    擴展觸發意圖數: ${stats.expandedTriggerIntents}`);
      console.log(`    具有觸發意圖的上下文: ${stats.contextsWithTriggerIntents}`);
      console.log(`    具有學習數據的上下文: ${stats.contextsWithLearning}`);
      console.log(`    平均學習數據量: ${stats.averageLearningDataPerContext.toFixed(2)}`);

      // 驗證統計數據
      if (stats.activeContexts !== testUsers.length) {
        issues.push(`活躍上下文數量錯誤: 預期 ${testUsers.length}, 實際 ${stats.activeContexts}`);
      }

      if (stats.expandedTriggerIntents !== EnhancedConversationContext.EXPANDED_TRIGGER_INTENTS.length) {
        issues.push(`擴展觸發意圖數量錯誤: 預期 ${EnhancedConversationContext.EXPANDED_TRIGGER_INTENTS.length}, 實際 ${stats.expandedTriggerIntents}`);
      }

      if (stats.contextsWithTriggerIntents !== testUsers.length) {
        issues.push(`觸發意圖上下文數量錯誤: 預期 ${testUsers.length}, 實際 ${stats.contextsWithTriggerIntents}`);
      }

      if (stats.contextsWithLearning === 0) {
        issues.push('沒有檢測到學習數據');
      }

    } catch (error) {
      issues.push(`上下文統計測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 上下文統計測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '上下文統計', passed, details: issues };
  }

  /**
   * 清理測試數據
   */
  static cleanup() {
    // 清理所有測試上下文
    const testUserIds = [
      'test_user_triggers',
      'test_user_learning', 
      'test_user_default_student',
      'test_user_course_frequency',
      'test_user_prediction',
      'user1', 'user2', 'user3'
    ];

    for (const userId of testUserIds) {
      EnhancedConversationContext.clearContext(userId);
    }
    
    console.log('\n🧹 測試數據清理完成');
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📋 EnhancedConversationContext 功能測試結果');
    console.log('='.repeat(70));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`總結: ${totalPassed}/${totalTests} 項測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有功能測試通過！EnhancedConversationContext 運作正常');
      console.log('🚀 用戶習慣學習機制和擴展觸發功能已準備就緒');
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
    console.log('='.repeat(70));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  EnhancedConversationContextTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = EnhancedConversationContextTest;