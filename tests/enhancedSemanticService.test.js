/**
 * EnhancedSemanticService 整合測試
 * 驗證三層語意記憶系統的智能分流機制
 */

const EnhancedSemanticService = require('../src/services/enhancedSemanticService');
const MemoryYamlService = require('../src/services/memoryYamlService');
const SmartQueryEngine = require('../src/services/smartQueryEngine');
const ConversationContext = require('../src/utils/conversationContext');
const path = require('path');

class EnhancedSemanticServiceTest {
  
  static async runAllTests() {
    console.log('🧪 開始 EnhancedSemanticService 整合測試...\n');
    
    // 測試配置
    const testConfig = {
      memoryYaml: {
        maxRecords: 5,
        storagePath: path.join(process.cwd(), 'test-enhanced-memory'),
        cacheTTL: 1000
      },
      regexFirstPriority: true,
      memoryInjectionEnabled: true,
      smartQueryBypass: true
    };
    
    const service = new EnhancedSemanticService(testConfig);
    
    const testResults = {
      smartQueryBypass: await this.testSmartQueryBypass(service),
      memoryLoading: await this.testTripleMemoryLoading(service),
      regexEnhancement: await this.testRegexWithMemoryEnhancement(service),
      gptFallbackMemory: await this.testGptFallbackWithMemory(service),
      memoryUpdate: await this.testTripleMemoryUpdate(service),
      endToEndIntegration: await this.testEndToEndIntegration(service)
    };
    
    // 清理測試資料
    await this.cleanup(testConfig.memoryYaml.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試 SmartQuery 繞過機制
   */
  static async testSmartQueryBypass(service) {
    console.log('⚡ 測試 SmartQuery 繞過機制...');
    const issues = [];
    const testUserId = 'test_user_smartquery';

    try {
      // 明確查詢語句應該被 SmartQuery 直接處理
      const explicitQueries = [
        { text: '查看今天的課程', expectedBypass: true },
        { text: '有哪些課程', expectedBypass: true },
        { text: '張老師教什麼課', expectedBypass: true }
      ];

      console.log('  測試明確查詢繞過:');
      for (const testCase of explicitQueries) {
        const result = await service.analyzeMessage(testCase.text, testUserId);
        
        const isBypassed = result.bypassSemanticProcessing === true;
        console.log(`    "${testCase.text}" → ${isBypassed ? '✅' : '❌'} 繞過`);
        
        if (testCase.expectedBypass && !isBypassed) {
          issues.push(`應該繞過但未繞過: "${testCase.text}"`);
        }
        
        if (isBypassed && result.method !== 'smart_query_bypass') {
          issues.push(`繞過但方法錯誤: "${testCase.text}" → ${result.method}`);
        }
      }

      // 非查詢語句應該進入正常流程
      const nonQueries = [
        { text: '明天2點數學課', expectedBypass: false },
        { text: '小明今天表現很好', expectedBypass: false }
      ];

      console.log('  測試非查詢語句:');
      for (const testCase of nonQueries) {
        const result = await service.analyzeMessage(testCase.text, testUserId);
        
        const isBypassed = result.bypassSemanticProcessing === true;
        console.log(`    "${testCase.text}" → ${isBypassed ? '❌' : '✅'} 正常流程`);
        
        if (testCase.expectedBypass === false && isBypassed) {
          issues.push(`不應該繞過但被繞過: "${testCase.text}"`);
        }
      }

    } catch (error) {
      issues.push(`SmartQuery 繞過測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} SmartQuery 繞過機制測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'SmartQuery 繞過機制', passed, details: issues };
  }

  /**
   * 測試三層記憶載入
   */
  static async testTripleMemoryLoading(service) {
    console.log('\n📚 測試三層記憶載入...');
    const issues = [];
    const testUserId = 'test_user_memory_loading';

    try {
      // 1. 預先設置測試數據
      
      // ConversationContext 設置
      ConversationContext.updateContext(testUserId, {
        lastIntent: 'add_course',
        lastStudent: '小明',
        lastCourse: '數學課'
      });

      // Memory.yaml 設置
      await service.memoryYamlService.updateUserMemory(testUserId, {
        student: '小明',
        courseName: '數學課',
        schedule: { time: '14:00', dayOfWeek: 3 },
        teacher: '張老師'
      });

      // 2. 測試記憶載入
      const memoryLayers = await service.loadTripleMemory(testUserId);
      
      console.log(`  載入時間: ${memoryLayers.loadTime}ms`);
      
      // 檢查 ConversationContext
      if (!memoryLayers.conversationContext || !memoryLayers.conversationContext.lastStudent) {
        issues.push('ConversationContext 載入失敗');
      } else {
        console.log(`  ✅ ConversationContext: ${memoryLayers.conversationContext.lastStudent}`);
      }

      // 檢查 Memory.yaml
      if (!memoryLayers.memoryYaml || !memoryLayers.memoryYaml.students) {
        issues.push('Memory.yaml 載入失敗');
      } else {
        const recordCount = service.memoryYamlService.getTotalRecords(memoryLayers.memoryYaml);
        console.log(`  ✅ Memory.yaml: ${recordCount} 筆記錄`);
        
        if (recordCount === 0) {
          issues.push('Memory.yaml 記錄數為0');
        }
      }

      // 檢查載入時間合理性
      if (memoryLayers.loadTime > 100) {
        console.log(`  ⚠️ 載入時間較長: ${memoryLayers.loadTime}ms`);
      }

    } catch (error) {
      issues.push(`三層記憶載入測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 三層記憶載入測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '三層記憶載入', passed, details: issues };
  }

  /**
   * 測試 Regex + Memory 增強機制
   */
  static async testRegexWithMemoryEnhancement(service) {
    console.log('\n🎯 測試 Regex + Memory 增強機制...');
    const issues = [];
    const testUserId = 'test_user_regex_enhancement';

    try {
      // 1. 預設記憶數據
      await service.memoryYamlService.updateUserMemory(testUserId, {
        student: '小明',
        courseName: '數學課',
        schedule: { time: '14:00' },
        teacher: '張老師'
      });

      ConversationContext.updateContext(testUserId, {
        lastStudent: '小明',
        lastCourse: '數學課'
      });

      // 2. 測試省略語句補全
      const abbreviatedInputs = [
        { 
          text: '修改時間', 
          expectedEnhancement: { student: '小明', courseName: '數學課' }
        },
        { 
          text: '取消課程', 
          expectedEnhancement: { student: '小明' }
        }
      ];

      console.log('  測試省略語句補全:');
      for (const testCase of abbreviatedInputs) {
        const result = await service.analyzeMessage(testCase.text, testUserId);
        
        console.log(`    "${testCase.text}" → ${result.method || 'unknown'}`);
        
        if (result.entities) {
          const hasStudent = result.entities.student === testCase.expectedEnhancement.student;
          const hasCourse = !testCase.expectedEnhancement.courseName || 
                           result.entities.courseName === testCase.expectedEnhancement.courseName;
          
          if (!hasStudent) {
            issues.push(`學生補全失敗: "${testCase.text}" 預期 ${testCase.expectedEnhancement.student}, 實際 ${result.entities.student}`);
          }
          
          if (!hasCourse) {
            issues.push(`課程補全失敗: "${testCase.text}" 預期 ${testCase.expectedEnhancement.courseName}, 實際 ${result.entities.courseName}`);
          }
          
          if (hasStudent && hasCourse) {
            console.log(`      ✅ 補全成功: 學生=${result.entities.student}, 課程=${result.entities.courseName || '無'}`);
          }
        } else {
          issues.push(`實體提取失敗: "${testCase.text}"`);
        }
      }

    } catch (error) {
      issues.push(`Regex + Memory 增強測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} Regex + Memory 增強機制測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'Regex + Memory 增強機制', passed, details: issues };
  }

  /**
   * 測試 GPT Fallback with Memory Injection
   */
  static async testGptFallbackWithMemory(service) {
    console.log('\n🤖 測試 GPT Fallback with Memory Injection...');
    const issues = [];
    const testUserId = 'test_user_gpt_fallback';

    try {
      // 1. 設置記憶背景
      await service.memoryYamlService.updateUserMemory(testUserId, {
        student: '小華',
        courseName: '英文課',
        schedule: { time: '16:00', dayOfWeek: 5 },
        teacher: '李老師'
      });

      // 2. 複雜語句測試 (需要 GPT 理解)
      const complexInputs = [
        '幫小華記錄今天英文課老師說他進步很多',
        '李老師的課程時間可以改成17點嗎',
        '小華說英文課很有趣想多上一些'
      ];

      console.log('  測試複雜語句理解:');
      for (const text of complexInputs) {
        const result = await service.analyzeMessage(text, testUserId);
        
        console.log(`    "${text}"`);
        console.log(`      → 方法: ${result.method || 'unknown'}`);
        console.log(`      → 意圖: ${result.intent || 'unknown'}`);
        console.log(`      → 信心: ${result.confidence || 0}`);
        
        // 檢查是否包含記憶注入標記
        if (result.method && result.method.includes('memory')) {
          console.log(`      ✅ 包含記憶注入`);
        } else {
          console.log(`      ⚠️ 未檢測到記憶注入`);
        }
        
        // 檢查基本成功性
        if (!result.success) {
          issues.push(`GPT 分析失敗: "${text}" → ${result.error || '未知錯誤'}`);
        }
      }

      // 3. 測試記憶摘要生成
      const memoryLayers = await service.loadTripleMemory(testUserId);
      const memorySummary = await service.generateMemorySummary(memoryLayers);
      
      console.log(`  記憶摘要長度: ${memorySummary.length} 字符`);
      if (memorySummary.length === 0) {
        issues.push('記憶摘要生成失敗');
      } else {
        console.log(`  ✅ 記憶摘要生成成功`);
      }

    } catch (error) {
      issues.push(`GPT Fallback 測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} GPT Fallback with Memory Injection 測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'GPT Fallback with Memory Injection', passed, details: issues };
  }

  /**
   * 測試三層記憶更新機制
   */
  static async testTripleMemoryUpdate(service) {
    console.log('\n💾 測試三層記憶更新機制...');
    const issues = [];
    const testUserId = 'test_user_memory_update';

    try {
      // 1. 模擬分析結果
      const mockResult = {
        success: true,
        intent: 'add_course',
        confidence: 0.9,
        entities: {
          student: '小李',
          courseName: '物理課',
          schedule: { time: '18:00' },
          teacher: '王老師'
        }
      };

      const memoryLayers = await service.loadTripleMemory(testUserId);
      
      // 2. 執行記憶更新
      await service.updateTripleMemory(testUserId, mockResult, memoryLayers);
      
      // 3. 驗證 ConversationContext 更新
      const updatedContext = ConversationContext.getContext(testUserId);
      if (!updatedContext || updatedContext.lastIntent !== 'add_course') {
        issues.push('ConversationContext 更新失敗');
      } else {
        console.log(`  ✅ ConversationContext 已更新: ${updatedContext.lastIntent}`);
      }

      // 4. 驗證 Memory.yaml 更新
      const updatedMemory = await service.memoryYamlService.getUserMemory(testUserId);
      const hasNewRecord = updatedMemory.students['小李'] && 
                          updatedMemory.students['小李'].courses.some(c => c.courseName === '物理課');
      
      if (!hasNewRecord) {
        issues.push('Memory.yaml 更新失敗');
      } else {
        console.log(`  ✅ Memory.yaml 已更新: 小李 - 物理課`);
      }

      // 5. 測試非課程意圖不更新 Memory.yaml
      const nonCourseResult = {
        success: true,
        intent: 'greeting',
        confidence: 0.8,
        entities: {}
      };

      const beforeRecordCount = service.memoryYamlService.getTotalRecords(updatedMemory);
      await service.updateTripleMemory(testUserId, nonCourseResult, memoryLayers);
      
      const afterMemory = await service.memoryYamlService.getUserMemory(testUserId);
      const afterRecordCount = service.memoryYamlService.getTotalRecords(afterMemory);
      
      if (beforeRecordCount !== afterRecordCount) {
        issues.push('非課程意圖錯誤更新了 Memory.yaml');
      } else {
        console.log(`  ✅ 非課程意圖正確跳過 Memory.yaml 更新`);
      }

    } catch (error) {
      issues.push(`三層記憶更新測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 三層記憶更新機制測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '三層記憶更新機制', passed, details: issues };
  }

  /**
   * 測試端到端整合流程
   */
  static async testEndToEndIntegration(service) {
    console.log('\n🚀 測試端到端整合流程...');
    const issues = [];
    const testUserId = 'test_user_e2e';

    try {
      // 1. 完整的用戶對話流程模擬
      const conversationFlow = [
        { input: '新增小王的數學課', expectedIntent: 'add_course' },
        { input: '時間是每週三下午2點', expectedIntent: 'modify_course' },
        { input: '老師是張老師', expectedIntent: 'modify_course' },
        { input: '小王上什麼課', expectedBypass: true }, // SmartQuery
        { input: '修改時間到3點', expectedMemoryUse: true }, // Memory 補全
        { input: '查看課程列表', expectedBypass: true } // SmartQuery
      ];

      console.log('  執行完整對話流程:');
      let conversationSuccess = true;

      for (let i = 0; i < conversationFlow.length; i++) {
        const step = conversationFlow[i];
        console.log(`\n    步驟 ${i + 1}: "${step.input}"`);
        
        try {
          const result = await service.analyzeMessage(step.input, testUserId);
          
          console.log(`      → 方法: ${result.method || 'unknown'}`);
          console.log(`      → 意圖: ${result.intent || 'unknown'}`);
          console.log(`      → 成功: ${result.success ? '✅' : '❌'}`);
          
          // 驗證預期結果
          if (step.expectedIntent && result.intent !== step.expectedIntent) {
            issues.push(`步驟 ${i + 1} 意圖錯誤: 預期 ${step.expectedIntent}, 實際 ${result.intent}`);
            conversationSuccess = false;
          }
          
          if (step.expectedBypass && !result.bypassSemanticProcessing) {
            issues.push(`步驟 ${i + 1} 應該繞過但未繞過: "${step.input}"`);
            conversationSuccess = false;
          }
          
          if (step.expectedMemoryUse && !result.method?.includes('memory')) {
            issues.push(`步驟 ${i + 1} 應該使用記憶但未使用: "${step.input}"`);
            conversationSuccess = false;
          }
          
          // 短暫延遲模擬真實對話
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          issues.push(`步驟 ${i + 1} 執行失敗: ${error.message}`);
          conversationSuccess = false;
        }
      }

      console.log(`\n  對話流程${conversationSuccess ? '成功' : '失敗'}`);

      // 2. 檢查最終記憶狀態
      const finalMemory = await service.memoryYamlService.getUserMemory(testUserId);
      const recordCount = service.memoryYamlService.getTotalRecords(finalMemory);
      
      console.log(`  最終記錄數: ${recordCount}`);
      
      if (recordCount === 0) {
        issues.push('端到端流程未生成任何記錄');
      }

      // 3. 性能統計
      const stats = service.getServiceStats();
      console.log(`  服務統計:`);
      console.log(`    Memory.yaml 快取大小: ${stats.memoryYamlStats.cacheSize}`);
      console.log(`    SmartQuery 支援類型: ${stats.smartQueryStats.supportedQueryTypes}`);

    } catch (error) {
      issues.push(`端到端整合測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 端到端整合流程測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '端到端整合流程', passed, details: issues };
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
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📋 EnhancedSemanticService 整合測試結果');
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
      console.log('🎉 所有整合測試通過！三層語意記憶系統運作正常');
      console.log('🚀 EnhancedSemanticService 已準備好進入生產環境');
    } else {
      console.log('⚠️  部分測試未通過，需要修正');
      
      // 列出失敗的測試類別
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
  EnhancedSemanticServiceTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = EnhancedSemanticServiceTest;