/**
 * EnhancedSemanticService 簡化測試
 * 專注測試核心功能，避免複雜的 GPT 調用
 */

const EnhancedSemanticService = require('../src/services/enhancedSemanticService');
const ConversationContext = require('../src/utils/conversationContext');
const path = require('path');

class EnhancedSemanticServiceSimpleTest {
  
  static async runAllTests() {
    console.log('🧪 開始 EnhancedSemanticService 簡化測試...\n');
    
    // 測試配置 - 使用較短的 TTL 便於測試
    const testConfig = {
      memoryYaml: {
        maxRecords: 3,
        storagePath: path.join(process.cwd(), 'test-enhanced-simple'),
        cacheTTL: 500 // 0.5秒
      },
      regexFirstPriority: true,
      memoryInjectionEnabled: true,
      smartQueryBypass: true
    };
    
    const service = new EnhancedSemanticService(testConfig);
    
    const testResults = {
      serviceInitialization: await this.testServiceInitialization(service),
      smartQueryBasic: await this.testSmartQueryBasic(service),
      memoryLoadingBasic: await this.testMemoryLoadingBasic(service),
      memoryUpdateBasic: await this.testMemoryUpdateBasic(service)
    };
    
    // 清理測試資料
    await this.cleanup(testConfig.memoryYaml.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試服務初始化
   */
  static async testServiceInitialization(service) {
    console.log('🚀 測試服務初始化...');
    const issues = [];

    try {
      // 檢查服務屬性
      if (!service.memoryYamlService) {
        issues.push('MemoryYamlService 未初始化');
      }

      if (!service.smartQueryEngine) {
        issues.push('SmartQueryEngine 未初始化');
      }

      // 檢查配置
      if (!service.regexFirstPriority) {
        issues.push('regexFirstPriority 配置錯誤');
      }

      if (!service.memoryInjectionEnabled) {
        issues.push('memoryInjectionEnabled 配置錯誤');
      }

      if (!service.smartQueryBypass) {
        issues.push('smartQueryBypass 配置錯誤');
      }

      // 檢查統計信息
      const stats = service.getServiceStats();
      if (!stats.memoryYamlStats || !stats.smartQueryStats) {
        issues.push('服務統計信息不完整');
      } else {
        console.log(`  MemoryYaml 最大記錄: ${stats.memoryYamlStats.maxRecords}`);
        console.log(`  SmartQuery 支援類型: ${stats.smartQueryStats.supportedQueryTypes}`);
      }

    } catch (error) {
      issues.push(`服務初始化測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 服務初始化測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '服務初始化', passed, details: issues };
  }

  /**
   * 測試 SmartQuery 基本功能
   */
  static async testSmartQueryBasic(service) {
    console.log('\n⚡ 測試 SmartQuery 基本功能...');
    const issues = [];
    const testUserId = 'test_user_smartquery_basic';

    try {
      // 測試明確查詢
      const queryTests = [
        { text: '查看今天的課程', shouldBypass: true },
        { text: '課程列表', shouldBypass: true },
        { text: '新增課程', shouldBypass: false }
      ];

      for (const test of queryTests) {
        console.log(`  測試: "${test.text}"`);
        
        const result = await service.handleSmartQueryFirst(test.text, testUserId);
        const isBypassed = !!result;
        
        console.log(`    → ${isBypassed ? '繞過' : '正常流程'} ${isBypassed === test.shouldBypass ? '✅' : '❌'}`);
        
        if (isBypassed !== test.shouldBypass) {
          issues.push(`SmartQuery 行為錯誤: "${test.text}" 預期 ${test.shouldBypass ? '繞過' : '正常'}, 實際 ${isBypassed ? '繞過' : '正常'}`);
        }
        
        if (isBypassed && result.method !== 'smart_query_bypass') {
          issues.push(`SmartQuery 方法標記錯誤: "${test.text}" → ${result.method}`);
        }
      }

    } catch (error) {
      issues.push(`SmartQuery 基本功能測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} SmartQuery 基本功能測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'SmartQuery 基本功能', passed, details: issues };
  }

  /**
   * 測試記憶載入基本功能
   */
  static async testMemoryLoadingBasic(service) {
    console.log('\n📚 測試記憶載入基本功能...');
    const issues = [];
    const testUserId = 'test_user_memory_basic';

    try {
      // 1. 測試空記憶載入
      const emptyMemory = await service.loadTripleMemory(testUserId);
      
      if (!emptyMemory.conversationContext) {
        issues.push('ConversationContext 載入失敗');
      }
      
      if (!emptyMemory.memoryYaml) {
        issues.push('Memory.yaml 載入失敗');
      }
      
      if (typeof emptyMemory.loadTime !== 'number') {
        issues.push('載入時間記錄失敗');
      }
      
      console.log(`  空記憶載入時間: ${emptyMemory.loadTime}ms`);

      // 2. 設置一些記憶數據後重新載入
      ConversationContext.updateContext(testUserId, 'add_course', {
        student: '小明',
        courseName: '測試課程'
      });

      await service.memoryYamlService.updateUserMemory(testUserId, {
        student: '小明',
        courseName: '測試課程',
        schedule: { time: '14:00' }
      });

      const withDataMemory = await service.loadTripleMemory(testUserId);
      
      if (!withDataMemory.conversationContext.lastStudent) {
        issues.push('ConversationContext 數據載入失敗');
      }
      
      const recordCount = service.memoryYamlService.getTotalRecords(withDataMemory.memoryYaml);
      if (recordCount === 0) {
        issues.push('Memory.yaml 數據載入失敗');
      }
      
      console.log(`  含數據記憶載入: ConversationContext=${!!withDataMemory.conversationContext.lastStudent}, Memory.yaml=${recordCount}筆`);

    } catch (error) {
      issues.push(`記憶載入基本功能測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 記憶載入基本功能測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '記憶載入基本功能', passed, details: issues };
  }

  /**
   * 測試記憶更新基本功能
   */
  static async testMemoryUpdateBasic(service) {
    console.log('\n💾 測試記憶更新基本功能...');
    const issues = [];
    const testUserId = 'test_user_update_basic';

    try {
      // 1. 準備測試數據
      const mockResult = {
        success: true,
        intent: 'add_course',
        confidence: 0.9,
        entities: {
          student: '小李',
          courseName: '英文課',
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
        console.log(`  ✅ ConversationContext 更新: ${updatedContext.lastIntent}`);
      }

      // 4. 驗證 Memory.yaml 更新
      const updatedMemory = await service.memoryYamlService.getUserMemory(testUserId);
      const hasNewRecord = updatedMemory.students['小李'] && 
                          updatedMemory.students['小李'].courses.some(c => c.courseName === '英文課');
      
      if (!hasNewRecord) {
        issues.push('Memory.yaml 更新失敗');
      } else {
        console.log(`  ✅ Memory.yaml 更新: 小李 - 英文課`);
      }

      // 5. 測試記憶摘要生成
      const memorySummary = await service.generateMemorySummary(memoryLayers);
      if (memorySummary.length === 0) {
        issues.push('記憶摘要生成失敗');
      } else {
        console.log(`  ✅ 記憶摘要生成: ${memorySummary.length} 字符`);
      }

    } catch (error) {
      issues.push(`記憶更新基本功能測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 記憶更新基本功能測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '記憶更新基本功能', passed, details: issues };
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
    console.log('\n' + '='.repeat(60));
    console.log('📋 EnhancedSemanticService 簡化測試結果');
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
      console.log('🎉 基本功能測試通過！EnhancedSemanticService 核心功能正常');
      console.log('🚀 三層語意記憶系統基礎架構運作良好');
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
    console.log('='.repeat(60));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  EnhancedSemanticServiceSimpleTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = EnhancedSemanticServiceSimpleTest;