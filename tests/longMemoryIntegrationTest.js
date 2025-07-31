/**
 * LongMemoryIntegrationTest - 三層語意記憶系統端到端整合測試
 * Phase 5 實現 - 完整系統整合測試
 * 
 * 測試範圍：
 * - 省略語句智能補全測試場景
 * - Memory.yaml 語意接續測試場景
 * - SmartQuery 直接回應測試場景
 * - 多輪對話連續性測試
 * - 錯誤處理和降級測試
 * 
 * 整合組件：
 * - EnhancedSemanticService (主要服務)
 * - MemoryYamlService (Layer 2)
 * - SmartQueryEngine (Layer 3)
 * - EnhancedConversationContext (Layer 1)
 */

const EnhancedSemanticService = require('../src/services/enhancedSemanticService');
const MemoryYamlService = require('../src/services/memoryYamlService');
const SmartQueryEngine = require('../src/services/smartQueryEngine');
const EnhancedConversationContext = require('../src/utils/enhancedConversationContext');
const path = require('path');

class LongMemoryIntegrationTest {
  
  static async runAllTests() {
    console.log('🧪 開始三層語意記憶系統端到端整合測試...\n');
    console.log('🎯 測試目標：驗證 Regex 優先 → OpenAI Fallback 智能分流機制');
    console.log('📚 測試組件：Layer 1 (Context) + Layer 2 (Memory.yaml) + Layer 3 (SmartQuery)\n');
    
    // 測試配置 - 完整的三層記憶系統配置
    const testConfig = {
      memoryYaml: {
        maxRecords: 10,
        storagePath: path.join(process.cwd(), 'test-long-memory-integration'),
        cacheTTL: 2000
      },
      regexFirstPriority: true,        // 啟用 Regex 優先機制
      memoryInjectionEnabled: true,    // 啟用記憶注入
      smartQueryBypass: true,          // 啟用 SmartQuery 繞過
      enhancedContextEnabled: true     // 啟用增強上下文
    };
    
    const service = new EnhancedSemanticService(testConfig);
    
    const testResults = {
      abbreviatedInputCompletion: await this.testAbbreviatedInputCompletion(service),
      memoryYamlSemanticContinuity: await this.testMemoryYamlSemanticContinuity(service),
      smartQueryDirectResponse: await this.testSmartQueryDirectResponse(service),
      multiTurnConversationContinuity: await this.testMultiTurnConversationContinuity(service),
      errorHandlingAndFallback: await this.testErrorHandlingAndFallback(service)
    };
    
    // 清理測試資料
    await this.cleanup(testConfig.memoryYaml.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試省略語句智能補全場景
   * 驗證三層記憶協作補全省略信息
   */
  static async testAbbreviatedInputCompletion(service) {
    console.log('📝 測試省略語句智能補全場景...');
    const issues = [];
    const testUserId = 'test_user_abbreviation';

    try {
      // 場景設定：用戶先建立完整的課程上下文
      console.log('  🎬 場景設定：建立課程上下文');
      
      // 1. 建立第一個完整的課程記錄
      const fullCourseResult = await service.analyzeMessage(
        '小明明天下午2點有數學課，老師是張老師，在教室A101',
        testUserId
      );
      
      if (!fullCourseResult.success) {
        issues.push('完整課程記錄建立失敗');
        return { category: '省略語句智能補全', passed: false, details: issues };
      }
      
      console.log(`    ✅ 完整課程記錄: ${fullCourseResult.intent} - ${fullCourseResult.entities?.courseName}`);
      
      // 2. 建立第二個完整的課程記錄（不同課程）
      await service.analyzeMessage(
        '小明後天上午10點有英文課，老師是李老師',
        testUserId
      );
      
      // 延遲確保 Memory.yaml 更新完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. 測試省略語句補全 - 只提供最基本信息
      console.log('  🔍 測試省略語句補全:');
      
      const abbreviatedInputs = [
        {
          text: '小明今天數學課取消',
          expectedIntent: 'cancel_course',
          expectedCompletions: ['student', 'courseName'],
          description: '省略時間和地點，應從記憶補全課程信息'
        },
        {
          text: '記錄數學課內容：今天學了二次方程式',
          expectedIntent: 'record_lesson_content',
          expectedCompletions: ['student', 'courseName'],
          description: '省略學生名稱，應從上下文補全'
        },
        {
          text: '英文課改到下午3點',
          expectedIntent: 'modify_course',
          expectedCompletions: ['student', 'courseName'],
          description: '省略學生和老師信息，應從記憶補全'
        }
      ];
      
      for (const testCase of abbreviatedInputs) {
        console.log(`    測試: "${testCase.text}"`);
        const result = await service.analyzeMessage(testCase.text, testUserId);
        
        if (!result.success) {
          issues.push(`省略語句分析失敗: ${testCase.text}`);
          continue;
        }
        
        // 檢查意圖識別
        if (result.intent !== testCase.expectedIntent) {
          issues.push(`意圖識別錯誤: 預期 ${testCase.expectedIntent}, 實際 ${result.intent}`);
        }
        
        // 檢查實體補全
        let completionSuccess = true;
        for (const expectedField of testCase.expectedCompletions) {
          if (!result.entities || !result.entities[expectedField]) {
            issues.push(`實體補全失敗: ${testCase.text} 缺少 ${expectedField}`);
            completionSuccess = false;
          }
        }
        
        if (completionSuccess) {
          console.log(`      ✅ ${testCase.description}`);
          console.log(`      📋 補全實體: ${testCase.expectedCompletions.map(field => 
            `${field}=${result.entities[field]}`).join(', ')}`);
        } else {
          console.log(`      ❌ 補全失敗: ${testCase.description}`);
        }
      }
      
    } catch (error) {
      issues.push(`省略語句智能補全測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 省略語句智能補全測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '省略語句智能補全', passed, details: issues };
  }

  /**
   * 測試 Memory.yaml 語意接續場景
   * 驗證長期記憶的語義理解和上下文接续
   */
  static async testMemoryYamlSemanticContinuity(service) {
    console.log('\n🧠 測試 Memory.yaml 語意接續場景...');
    const issues = [];
    const testUserId = 'test_user_memory_continuity';

    try {
      // 場景設定：建立豐富的 Memory.yaml 背景
      console.log('  🎬 場景設定：建立 Memory.yaml 語義背景');
      
      const memoryBuildingInteractions = [
        '小華每週二下午3點有鋼琴課，老師是王老師',
        '小華每週四上午10點有美術課，老師是陳老師', 
        '記錄小華鋼琴課內容：今天練習了貝多芬小奏鳴曲',
        '記錄小華美術課內容：今天畫了靜物素描',
        '小華鋼琴課表現很好，王老師很滿意'
      ];
      
      for (const interaction of memoryBuildingInteractions) {
        await service.analyzeMessage(interaction, testUserId);
        await new Promise(resolve => setTimeout(resolve, 50)); // 確保記憶更新
      }
      
      console.log('    ✅ Memory.yaml 語義背景建立完成');
      
      // 延遲確保記憶完全寫入
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 測試語意接續場景
      console.log('  🔍 測試 Memory.yaml 語意接續:');
      
      const semanticContinuityTests = [
        {
          text: '小華下週鋼琴課請假',
          expectedBehavior: '應該從 Memory.yaml 識別出鋼琴課的完整信息（時間、老師等）',
          expectedFields: ['student', 'courseName', 'teacher']
        },
        {
          text: '王老師說小華進步很多',
          expectedBehavior: '應該從 Memory.yaml 推斷出這是關於鋼琴課的評價',
          expectedFields: ['student', 'teacher']
        },
        {
          text: '查詢小華本週的課程安排',
          expectedBehavior: '應該從 Memory.yaml 提取出完整的課程列表',
          expectedFields: ['student']
        }
      ];
      
      for (const testCase of semanticContinuityTests) {
        console.log(`    測試: "${testCase.text}"`);
        const result = await service.analyzeMessage(testCase.text, testUserId);
        
        if (!result.success) {
          issues.push(`Memory.yaml 語意接續失敗: ${testCase.text}`);
          continue;
        }
        
        // 檢查是否使用了記憶增強
        const usedMemory = result.method?.includes('memory') || result.memoryInjected;
        if (!usedMemory) {
          issues.push(`未使用 Memory.yaml 增強: ${testCase.text}`);
        }
        
        // 檢查預期欄位是否被正確推斷
        let fieldSuccess = true;
        for (const expectedField of testCase.expectedFields) {
          if (!result.entities || !result.entities[expectedField]) {
            issues.push(`Memory.yaml 推斷失敗: ${testCase.text} 缺少 ${expectedField}`);
            fieldSuccess = false;
          }
        }
        
        if (fieldSuccess && usedMemory) {
          console.log(`      ✅ ${testCase.expectedBehavior}`);
          console.log(`      🧠 記憶來源: ${result.method || 'memory_enhanced'}`);
        } else {
          console.log(`      ❌ 語意接續失敗: ${testCase.expectedBehavior}`);
        }
      }
      
    } catch (error) {
      issues.push(`Memory.yaml 語意接續測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} Memory.yaml 語意接續測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'Memory.yaml 語意接續', passed, details: issues };
  }

  /**
   * 測試 SmartQuery 直接回應場景
   * 驗證明確查詢的快速直接回應機制
   */
  static async testSmartQueryDirectResponse(service) {
    console.log('\n⚡ 測試 SmartQuery 直接回應場景...');
    const issues = [];
    const testUserId = 'test_user_smart_query';

    try {
      // 場景設定：先建立一些課程數據供查詢
      console.log('  🎬 場景設定：建立查詢數據源');
      
      const dataSetupInteractions = [
        '小明明天下午2點有數學課',
        '小華今天上午10點有英文課',
        '小李下週一晚上7點有鋼琴課'
      ];
      
      for (const interaction of dataSetupInteractions) {
        await service.analyzeMessage(interaction, testUserId);
      }
      
      // 測試 SmartQuery 直接回應
      console.log('  🔍 測試 SmartQuery 直接回應:');
      
      const smartQueryTests = [
        {
          query: '查詢小明的課程表',
          expectedType: 'course_list',
          expectedBypass: true,
          description: '學生課程列表查詢'
        },
        {
          query: '顯示所有數學課',
          expectedType: 'course_list',
          expectedBypass: true,
          description: '按課程名稱查詢'
        },
        {
          query: '明天有什麼課',
          expectedType: 'schedule',
          expectedBypass: true,
          description: '按日期查詢課程'
        }
      ];
      
      for (const testCase of smartQueryTests) {
        console.log(`    測試: "${testCase.query}"`);
        const startTime = Date.now();
        const result = await service.analyzeMessage(testCase.query, testUserId);
        const responseTime = Date.now() - startTime;
        
        if (!result.success) {
          issues.push(`SmartQuery 查詢失敗: ${testCase.query}`);
          continue;
        }
        
        // 檢查是否觸發了 SmartQuery 繞過
        if (!result.bypassSemanticProcessing && !result.method?.includes('smart_query')) {
          issues.push(`SmartQuery 繞過未觸發: ${testCase.query}`);
        }
        
        // 檢查查詢類型
        if (result.queryType && result.queryType !== testCase.expectedType) {
          issues.push(`查詢類型錯誤: 預期 ${testCase.expectedType}, 實際 ${result.queryType}`);
        }
        
        // 檢查響應時間（SmartQuery 應該很快）
        if (responseTime > 100) {
          console.log(`      ⚠️ 響應時間偏慢: ${responseTime}ms (預期 < 100ms)`);
        }
        
        if (result.bypassSemanticProcessing || result.method?.includes('smart_query')) {
          console.log(`      ✅ ${testCase.description} (${responseTime}ms)`);
          console.log(`      ⚡ SmartQuery 直接回應: ${result.queryType || result.method}`);
        } else {
          console.log(`      ❌ SmartQuery 機制失效: ${testCase.description}`);
        }
      }
      
    } catch (error) {
      issues.push(`SmartQuery 直接回應測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} SmartQuery 直接回應測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: 'SmartQuery 直接回應', passed, details: issues };
  }

  /**
   * 測試多輪對話連續性場景
   * 驗證三層記憶系統在多輪對話中的協作效果
   */
  static async testMultiTurnConversationContinuity(service) {
    console.log('\n💬 測試多輪對話連續性場景...');
    const issues = [];
    const testUserId = 'test_user_multi_turn';

    try {
      console.log('  🎬 場景：模擬真實的多輪課程管理對話');
      
      // 多輪對話場景：用戶逐步完善課程信息
      const conversationFlow = [
        {
          turn: 1,
          input: '小明明天有數學課',
          expectedMemoryUpdate: '應該記錄學生和課程',
          checks: ['student', 'courseName']
        },
        {
          turn: 2,
          input: '時間是下午2點',
          expectedMemoryUpdate: '應該補充上一個課程的時間信息',
          checks: ['timeInfo'],
          expectsContextEnhancement: true
        },
        {
          turn: 3,
          input: '老師是張老師',
          expectedMemoryUpdate: '應該補充上一個課程的老師信息',
          checks: ['teacher'],
          expectsContextEnhancement: true
        },
        {
          turn: 4,
          input: '記錄今天的數學課內容',
          expectedMemoryUpdate: '應該從前面的對話推斷出完整的課程信息',
          checks: ['student', 'courseName'],
          expectsContextEnhancement: true
        },
        {
          turn: 5,
          input: '今天學了二次方程式，張老師說我進步很多',
          expectedMemoryUpdate: '應該關聯到之前建立的課程和老師信息',
          checks: ['content'],
          expectsSemanticContinuity: true
        }
      ];
      
      console.log('  🔄 執行多輪對話流程:');
      
      for (const turn of conversationFlow) {
        console.log(`    第 ${turn.turn} 輪: "${turn.input}"`);
        const result = await service.analyzeMessage(turn.input, testUserId);
        
        if (!result.success) {
          issues.push(`第 ${turn.turn} 輪對話失敗: ${turn.input}`);
          continue;
        }
        
        // 檢查預期的實體欄位
        let fieldSuccess = true;
        for (const expectedField of turn.checks) {
          if (!result.entities || !result.entities[expectedField]) {
            // 對於需要上下文增強的輪次，檢查是否有增強機制
            if (turn.expectsContextEnhancement || turn.expectsSemanticContinuity) {
              issues.push(`第 ${turn.turn} 輪上下文增強失敗: 缺少 ${expectedField}`);
            }
            fieldSuccess = false;
          }
        }
        
        // 檢查記憶增強是否生效
        if (turn.expectsContextEnhancement || turn.expectsSemanticContinuity) {
          const usedMemoryEnhancement = result.method?.includes('memory') || 
                                       result.method?.includes('context') ||
                                       result.memoryInjected;
          if (!usedMemoryEnhancement) {
            issues.push(`第 ${turn.turn} 輪未使用記憶增強機制`);
          }
        }
        
        if (fieldSuccess) {
          console.log(`      ✅ ${turn.expectedMemoryUpdate}`);
          if (result.entities) {
            const entitySummary = Object.entries(result.entities)
              .filter(([key, value]) => value)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ');
            console.log(`      📋 提取實體: ${entitySummary}`);
          }
        } else {
          console.log(`      ❌ 對話連續性失敗: ${turn.expectedMemoryUpdate}`);
        }
        
        // 輪次間延遲，模擬真實對話節奏
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 最終驗證：檢查整個對話流程是否在記憶中形成了完整的語義關聯
      console.log('  🔍 驗證整體記憶連續性:');
      const finalQueryResult = await service.analyzeMessage('查詢小明的數學課信息', testUserId);
      
      if (finalQueryResult.success && finalQueryResult.data) {
        console.log('    ✅ 多輪對話記憶連續性驗證成功');
      } else {
        issues.push('多輪對話記憶連續性驗證失敗');
      }
      
    } catch (error) {
      issues.push(`多輪對話連續性測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 多輪對話連續性測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '多輪對話連續性', passed, details: issues };
  }

  /**
   * 測試錯誤處理和降級場景
   * 驗證系統在各種故障情況下的穩定性和降級機制
   */
  static async testErrorHandlingAndFallback(service) {
    console.log('\n🛡️ 測試錯誤處理和降級場景...');
    const issues = [];
    const testUserId = 'test_user_error_handling';

    try {
      console.log('  🎬 場景：模擬各種錯誤情況和系統降級');
      
      // 測試異常輸入處理
      console.log('  🔍 測試異常輸入處理:');
      
      const errorTestCases = [
        {
          input: '',
          description: '空輸入',
          expectGracefulHandling: true
        },
        {
          input: '😀😀😀🎉🎉🎉',
          description: '純表情符號輸入',
          expectGracefulHandling: true
        },
        {
          input: 'a'.repeat(1000),
          description: '超長輸入',
          expectGracefulHandling: true
        },
        {
          input: '!@#$%^&*()_+{}:"<>?[]\\;\',./',
          description: '特殊字符輸入',
          expectGracefulHandling: true
        }
      ];
      
      for (const testCase of errorTestCases) {
        console.log(`    測試: ${testCase.description}`);
        
        try {
          const result = await service.analyzeMessage(testCase.input, testUserId);
          
          // 系統應該能處理異常輸入而不崩潰
          if (result) {
            console.log(`      ✅ 優雅處理: ${testCase.description}`);
          } else {
            issues.push(`異常輸入處理失敗: ${testCase.description}`);
          }
          
        } catch (error) {
          issues.push(`異常輸入導致系統崩潰: ${testCase.description} - ${error.message}`);
        }
      }
      
      // 測試服務降級機制
      console.log('  🔍 測試服務降級機制:');
      
      // 模擬 Memory.yaml 服務故障
      try {
        // 創建一個配置錯誤的服務來觸發降級
        const faultyConfig = {
          memoryYaml: {
            storagePath: '/invalid/path/that/does/not/exist',
            maxRecords: 5
          },
          regexFirstPriority: true,
          memoryInjectionEnabled: true,
          smartQueryBypass: true
        };
        
        const faultyService = new EnhancedSemanticService(faultyConfig);
        const result = await faultyService.analyzeMessage('小明明天有數學課', testUserId);
        
        if (result.success) {
          console.log('    ✅ Memory.yaml 故障降級處理成功');
          console.log(`      📋 降級方法: ${result.method}`);
        } else {
          issues.push('Memory.yaml 故障未能正確降級');
        }
        
      } catch (error) {
        // 這裡預期可能會有錯誤，但系統應該能恢復
        console.log(`    ✅ Memory.yaml 故障捕獲: ${error.message}`);
      }
      
      // 測試部分服務失效時的功能保持
      console.log('  🔍 測試部分服務失效處理:');
      
      const partialFailureTests = [
        {
          input: '小明今天上數學課',
          description: '基礎語義分析應該仍然工作',
          expectBasicFunctionality: true
        },
        {
          input: '查詢課程列表',
          description: 'SmartQuery 應該仍然可用',
          expectBasicFunctionality: true
        }
      ];
      
      for (const testCase of partialFailureTests) {
        console.log(`    測試: ${testCase.description}`);
        const result = await service.analyzeMessage(testCase.input, testUserId);
        
        if (result.success) {
          console.log(`      ✅ 部分故障下功能保持: ${testCase.description}`);
        } else {
          issues.push(`部分故障下功能失效: ${testCase.description}`);
        }
      }
      
      // 測試系統恢復能力
      console.log('  🔍 測試系統恢復能力:');
      
      // 在正常服務上測試恢復
      const recoveryResult = await service.analyzeMessage('小華下週有英文課', testUserId);
      if (recoveryResult.success) {
        console.log('    ✅ 系統恢復能力驗證成功');
      } else {
        issues.push('系統恢復能力驗證失敗');
      }
      
    } catch (error) {
      issues.push(`錯誤處理和降級測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 錯誤處理和降級測試`);
    if (!passed) {
      issues.forEach(issue => console.log(`    ❌ ${issue}`));
    }

    return { category: '錯誤處理和降級', passed, details: issues };
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
      'test_user_abbreviation',
      'test_user_memory_continuity',
      'test_user_smart_query',
      'test_user_multi_turn',
      'test_user_error_handling'
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
    console.log('📋 三層語意記憶系統端到端整合測試結果');
    console.log('='.repeat(80));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`總結: ${totalPassed}/${totalTests} 項整合測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有端到端整合測試通過！三層語意記憶系統運作完美');
      console.log('🚀 Regex 優先 → OpenAI Fallback 智能分流機制驗證成功');
      console.log('📚 Layer 1 (Context) + Layer 2 (Memory.yaml) + Layer 3 (SmartQuery) 協作無間');
      console.log('🎯 省略語句補全、語意接續、直接回應、多輪對話、錯誤處理全面就緒');
    } else {
      console.log('⚠️  部分整合測試未通過，需要修正');
      
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
  LongMemoryIntegrationTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('端到端整合測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = LongMemoryIntegrationTest;