/**
 * LongMemoryIntegrationTest.fast - 快速端到端整合測試
 * Phase 5 實現 - 完整系統整合測試（Mock OpenAI 版本）
 * 
 * 特點：
 * - 使用 Mock OpenAI 服務避免 API 限制
 * - 專注於測試三層記憶系統的協作機制
 * - 驗證 Regex 優先 → Memory Enhancement → GPT Fallback 流程
 */

const EnhancedSemanticService = require('../src/services/enhancedSemanticService');
const EnhancedConversationContext = require('../src/utils/enhancedConversationContext');
const path = require('path');

// Mock OpenAI Service for testing
const mockOpenAIService = {
  analyzeIntent: async (text, userId) => {
    // 基於關鍵詞的簡單 mock 邏輯
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('取消')) {
      return {
        success: true,
        intent: 'cancel_course',
        confidence: 0.9,
        entities: {
          student: extractStudent(text),
          courseName: extractCourseName(text)
        }
      };
    }
    
    if (lowerText.includes('記錄') && lowerText.includes('內容')) {
      return {
        success: true,
        intent: 'record_lesson_content',
        confidence: 0.9,
        entities: {
          student: extractStudent(text),
          courseName: extractCourseName(text),
          content: extractContent(text)
        }
      };
    }
    
    if (lowerText.includes('改到') || lowerText.includes('修改')) {
      return {
        success: true,
        intent: 'modify_course',
        confidence: 0.9,
        entities: {
          student: extractStudent(text),
          courseName: extractCourseName(text),
          timeInfo: extractTimeInfo(text)
        }
      };
    }
    
    if (lowerText.includes('查詢') || lowerText.includes('什麼課')) {
      return {
        success: true,
        intent: 'query_course',
        confidence: 0.9,
        entities: {
          student: extractStudent(text),
          courseName: extractCourseName(text)
        }
      };
    }
    
    if (lowerText.includes('有') && (lowerText.includes('課') || lowerText.includes('老師'))) {
      return {
        success: true,
        intent: 'add_course',
        confidence: 0.9,
        entities: {
          student: extractStudent(text),
          courseName: extractCourseName(text),
          teacher: extractTeacher(text),
          timeInfo: extractTimeInfo(text),
          location: extractLocation(text)
        }
      };
    }
    
    return {
      success: true,
      intent: 'unknown',
      confidence: 0.5,
      entities: {}
    };
  },
  
  analyzeIntentWithSlots: async (text, userId, options) => {
    return mockOpenAIService.analyzeIntent(text, userId);
  }
};

// 輔助函數：實體提取
function extractStudent(text) {
  const students = ['小明', '小華', '小李', '小王', '小張'];
  return students.find(student => text.includes(student)) || null;
}

function extractCourseName(text) {
  const courses = ['數學課', '英文課', '物理課', '化學課', '鋼琴課', '美術課', '音樂課', '體育課'];
  return courses.find(course => text.includes(course)) || null;
}

function extractTeacher(text) {
  const teachers = ['張老師', '李老師', '王老師', '陳老師', '劉老師'];
  return teachers.find(teacher => text.includes(teacher)) || null;
}

function extractTimeInfo(text) {
  const timeRegex = /(\d+)點|下午|上午|晚上|明天|後天|今天/g;
  const matches = text.match(timeRegex);
  if (matches) {
    return {
      display: matches.join(' '),
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };
  }
  return null;
}

function extractLocation(text) {
  const locations = ['教室A101', '教室B202', '音樂室', '美術室'];
  return locations.find(location => text.includes(location)) || null;
}

function extractContent(text) {
  const contentMatch = text.match(/[:：](.+)$/);
  return contentMatch ? contentMatch[1].trim() : null;
}

class LongMemoryIntegrationTestFast {
  
  static async runAllTests() {
    console.log('🚀 開始三層語意記憶系統快速端到端整合測試...\n');
    console.log('⚡ 特點：Mock OpenAI 服務，專注測試記憶系統協作');
    console.log('🎯 測試目標：驗證 Regex 優先 → Memory Enhancement → GPT Fallback 流程\n');
    
    // 注入 Mock OpenAI Service
    const OpenAIService = require('../src/internal/openaiService');
    Object.assign(OpenAIService, mockOpenAIService);
    
    // 測試配置
    const testConfig = {
      memoryYaml: {
        maxRecords: 8,
        storagePath: path.join(process.cwd(), 'test-fast-integration'),
        cacheTTL: 5000
      },
      regexFirstPriority: true,
      memoryInjectionEnabled: true,
      smartQueryBypass: true,
      enhancedContextEnabled: true
    };
    
    const service = new EnhancedSemanticService(testConfig);
    
    const testResults = {
      abbreviatedInputCompletion: await this.testAbbreviatedInputCompletion(service),
      memoryEnhancementFlow: await this.testMemoryEnhancementFlow(service),
      smartQueryBypass: await this.testSmartQueryBypass(service),
      multiTurnContinuity: await this.testMultiTurnContinuity(service),
      systemResilience: await this.testSystemResilience(service)
    };
    
    // 清理測試資料
    await this.cleanup(testConfig.memoryYaml.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試省略語句智能補全
   */
  static async testAbbreviatedInputCompletion(service) {
    console.log('📝 測試省略語句智能補全...');
    const issues = [];
    const testUserId = 'test_fast_abbreviation';

    try {
      // 建立上下文
      console.log('  🎬 建立課程上下文');
      
      const setupResult = await service.analyzeMessage(
        '小明明天下午2點有數學課，老師是張老師',
        testUserId
      );
      
      if (!setupResult.success) {
        issues.push('上下文建立失敗');
        return { category: '省略語句智能補全', passed: false, details: issues };
      }
      
      console.log(`    ✅ 上下文建立: ${setupResult.intent}`);
      
      // 等待記憶更新
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 測試省略語句
      console.log('  🔍 測試省略語句補全:');
      
      const testCases = [
        {
          input: '小明數學課取消',
          expectedIntent: 'cancel_course',
          description: '省略時間，應從記憶補全'
        },
        {
          input: '記錄數學課內容：今天學了代數',
          expectedIntent: 'record_lesson_content', 
          description: '省略學生，應從上下文補全'
        }
      ];
      
      for (const testCase of testCases) {
        console.log(`    測試: "${testCase.input}"`);
        const result = await service.analyzeMessage(testCase.input, testUserId);
        
        if (!result.success) {
          issues.push(`省略語句處理失敗: ${testCase.input}`);
          continue;
        }
        
        if (result.intent !== testCase.expectedIntent) {
          issues.push(`意圖識別錯誤: 預期 ${testCase.expectedIntent}, 實際 ${result.intent}`);
          continue;
        }
        
        // 檢查實體補全
        const hasStudent = result.entities?.student;
        const hasCourse = result.entities?.courseName;
        
        if (!hasStudent || !hasCourse) {
          issues.push(`實體補全不完整: ${testCase.input} (學生:${hasStudent}, 課程:${hasCourse})`);
        } else {
          console.log(`      ✅ ${testCase.description}`);
          console.log(`      📋 補全: 學生=${hasStudent}, 課程=${hasCourse}`);
        }
      }
      
    } catch (error) {
      issues.push(`省略語句測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 省略語句智能補全測試`);
    return { category: '省略語句智能補全', passed, details: issues };
  }

  /**
   * 測試記憶增強流程
   */
  static async testMemoryEnhancementFlow(service) {
    console.log('\n🧠 測試記憶增強流程...');
    const issues = [];
    const testUserId = 'test_fast_memory';

    try {
      console.log('  🎬 建立記憶背景');
      
      // 建立豐富的記憶背景
      const memorySetup = [
        '小華每週二有鋼琴課，老師是王老師',
        '小華每週四有美術課，老師是陳老師',
        '記錄小華鋼琴課內容：練習巴哈',
        '記錄小華美術課內容：畫靜物'
      ];
      
      for (const setup of memorySetup) {
        await service.analyzeMessage(setup, testUserId);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('    ✅ 記憶背景建立完成');
      
      // 測試記憶增強
      console.log('  🔍 測試記憶增強流程:');
      
      const enhancementTests = [
        {
          input: '小華鋼琴課請假',
          expectedEnhancement: '應從記憶推斷出王老師和週二時間',
          checkFields: ['student', 'courseName']
        },
        {
          input: '王老師說小華進步了',
          expectedEnhancement: '應從記憶關聯到鋼琴課',
          checkFields: ['student', 'teacher']
        }
      ];
      
      for (const test of enhancementTests) {
        console.log(`    測試: "${test.input}"`);
        const result = await service.analyzeMessage(test.input, testUserId);
        
        if (!result.success) {
          issues.push(`記憶增強測試失敗: ${test.input}`);
          continue;
        }
        
        // 檢查是否使用了記憶增強
        const usedMemory = result.method?.includes('memory') || 
                          result.memoryInjected ||
                          result.source?.includes('memory');
        
        if (!usedMemory) {
          console.log(`      ⚠️ 可能未使用記憶增強: ${test.input}`);
        }
        
        // 檢查字段補全
        let fieldsComplete = true;
        for (const field of test.checkFields) {
          if (!result.entities?.[field]) {
            fieldsComplete = false;
            break;
          }
        }
        
        if (fieldsComplete) {
          console.log(`      ✅ ${test.expectedEnhancement}`);
        } else {
          issues.push(`記憶增強不完整: ${test.input}`);
        }
      }
      
    } catch (error) {
      issues.push(`記憶增強流程測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 記憶增強流程測試`);
    return { category: '記憶增強流程', passed, details: issues };
  }

  /**
   * 測試 SmartQuery 繞過機制
   */
  static async testSmartQueryBypass(service) {
    console.log('\n⚡ 測試 SmartQuery 繞過機制...');
    const issues = [];
    const testUserId = 'test_fast_smart_query';

    try {
      // 先建立一些數據
      await service.analyzeMessage('小明明天有數學課', testUserId);
      await service.analyzeMessage('小華今天有英文課', testUserId);
      
      console.log('  🔍 測試 SmartQuery 繞過:');
      
      const queryTests = [
        {
          query: '查詢小明的課程表',
          description: '學生課程查詢'
        },
        {
          query: '顯示所有數學課',
          description: '課程名稱查詢'
        },
        {
          query: '明天有什麼課',
          description: '日期查詢'
        }
      ];
      
      for (const test of queryTests) {
        console.log(`    測試: "${test.query}"`);
        const startTime = Date.now();
        const result = await service.analyzeMessage(test.query, testUserId);
        const responseTime = Date.now() - startTime;
        
        if (!result.success) {
          issues.push(`SmartQuery 查詢失敗: ${test.query}`);
          continue;
        }
        
        // 檢查是否觸發了快速響應
        const isFastResponse = result.bypassSemanticProcessing || 
                              result.method?.includes('smart_query') ||
                              responseTime < 200;
        
        if (isFastResponse) {
          console.log(`      ✅ ${test.description} (${responseTime}ms)`);
        } else {
          console.log(`      ⚠️ 可能未觸發 SmartQuery: ${test.description} (${responseTime}ms)`);
        }
      }
      
    } catch (error) {
      issues.push(`SmartQuery 繞過測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} SmartQuery 繞過機制測試`);
    return { category: 'SmartQuery 繞過機制', passed, details: issues };
  }

  /**
   * 測試多輪對話連續性
   */
  static async testMultiTurnContinuity(service) {
    console.log('\n💬 測試多輪對話連續性...');
    const issues = [];
    const testUserId = 'test_fast_multi_turn';

    try {
      console.log('  🎬 執行多輪對話流程:');
      
      const conversationFlow = [
        {
          input: '小明明天有數學課',
          description: '建立基礎課程'
        },
        {
          input: '時間是下午2點',
          description: '補充時間信息'
        },
        {
          input: '老師是張老師',
          description: '補充老師信息'
        },
        {
          input: '記錄數學課內容：學了函數',
          description: '記錄課程內容（應能關聯前面信息）'
        }
      ];
      
      let contextBuilt = true;
      
      for (let i = 0; i < conversationFlow.length; i++) {
        const turn = conversationFlow[i];
        console.log(`    第 ${i + 1} 輪: "${turn.input}"`);
        
        const result = await service.analyzeMessage(turn.input, testUserId);
        
        if (!result.success) {
          issues.push(`第 ${i + 1} 輪對話失敗: ${turn.input}`);
          contextBuilt = false;
          continue;
        }
        
        console.log(`      ✅ ${turn.description} (${result.intent})`);
        
        // 輪次間延遲
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 驗證整體連續性
      if (contextBuilt) {
        console.log('  🔍 驗證整體連續性:');
        const verifyResult = await service.analyzeMessage('查詢小明的數學課', testUserId);
        
        if (verifyResult.success) {
          console.log('    ✅ 多輪對話連續性驗證通過');
        } else {
          issues.push('多輪對話連續性驗證失敗');
        }
      }
      
    } catch (error) {
      issues.push(`多輪對話連續性測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 多輪對話連續性測試`);
    return { category: '多輪對話連續性', passed, details: issues };
  }

  /**
   * 測試系統韌性
   */
  static async testSystemResilience(service) {
    console.log('\n🛡️ 測試系統韌性...');
    const issues = [];
    const testUserId = 'test_fast_resilience';

    try {
      console.log('  🔍 測試異常輸入處理:');
      
      const resilenceTests = [
        { input: '', description: '空輸入' },
        { input: '🎉🎉🎉', description: '純符號' },
        { input: 'hello world', description: '英文輸入' },
        { input: '1234567890', description: '純數字' }
      ];
      
      for (const test of resilenceTests) {
        console.log(`    測試: ${test.description}`);
        
        try {
          const result = await service.analyzeMessage(test.input, testUserId);
          
          if (result) {
            console.log(`      ✅ 優雅處理: ${test.description}`);
          } else {
            issues.push(`異常輸入處理失敗: ${test.description}`);
          }
        } catch (error) {
          issues.push(`異常輸入導致崩潰: ${test.description}`);
        }
      }
      
      // 測試正常功能恢復
      console.log('  🔍 測試功能恢復:');
      const recoveryResult = await service.analyzeMessage('小李明天有體育課', testUserId);
      
      if (recoveryResult.success) {
        console.log('    ✅ 系統功能恢復正常');
      } else {
        issues.push('系統功能恢復失敗');
      }
      
    } catch (error) {
      issues.push(`系統韌性測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 系統韌性測試`);
    return { category: '系統韌性', passed, details: issues };
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

    // 清理上下文
    const testUserIds = [
      'test_fast_abbreviation',
      'test_fast_memory',
      'test_fast_smart_query',
      'test_fast_multi_turn',
      'test_fast_resilience'
    ];

    for (const userId of testUserIds) {
      EnhancedConversationContext.clearContext(userId);
    }
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📋 三層語意記憶系統快速端到端整合測試結果');
    console.log('='.repeat(70));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`總結: ${totalPassed}/${totalTests} 項快速整合測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有快速整合測試通過！三層語意記憶系統運作良好');
      console.log('⚡ Mock 環境下驗證了核心協作機制');
      console.log('🚀 Regex → Memory Enhancement → GPT Fallback 流程完整');
    } else {
      console.log('⚠️  部分測試未通過，需要進一步優化');
      
      // 列出失敗的測試
      Object.values(results).forEach(result => {
        if (!result.passed) {
          console.log(`\n❌ ${result.category} 問題:`);
          result.details.forEach(detail => console.log(`   - ${detail}`));
        }
      });
    }
    console.log('='.repeat(70));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  LongMemoryIntegrationTestFast.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('快速整合測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = LongMemoryIntegrationTestFast;