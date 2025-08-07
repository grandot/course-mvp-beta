/**
 * 自動化測試執行器
 * 基於階段式架構和依賴關係配置自動執行測試
 * 集成數據管理、依賴檢查、結果分析
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');
const { TestDataManager } = require('./test-data-manager');

class AutomatedTestRunner {
  constructor(configPath = '../config/test-dependencies.yaml') {
    this.configPath = path.resolve(__dirname, configPath);
    this.config = null;
    this.testDataManager = new TestDataManager();
    this.results = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      phases: {},
      errors: [],
      summary: null
    };
    
    // 測試用例數據（後續會從文件載入）
    this.testCases = new Map();
    
    // 測試目標URL
    this.testTargetUrl = process.env.TEST_TARGET_URL || 'http://localhost:3000/webhook';
    this.testUserId = 'U_test_user_qa';
  }

  /**
   * 載入配置文件
   */
  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      this.config = yaml.load(configContent);
      console.log('✅ 測試配置載入成功');
      return true;
    } catch (error) {
      console.error('❌ 載入測試配置失敗:', error.message);
      return false;
    }
  }

  /**
   * 載入測試用例數據
   */
  async loadTestCases() {
    console.log('📋 載入測試用例數據...');
    
    // 這裡載入具體的測試用例，暫時用示例數據
    const sampleTestCases = this.generateSampleTestCases();
    
    for (const testCase of sampleTestCases) {
      this.testCases.set(testCase.id, testCase);
    }
    
    console.log(`✅ 載入 ${this.testCases.size} 個測試用例`);
    return true;
  }

  /**
   * 生成示例測試用例（實際應從文件載入）
   */
  generateSampleTestCases() {
    return [
      // Group A - 新增單次課程
      {
        id: 'A1.1-A',
        group: 'group_a_add_single_course',
        phase: 'group_a',
        name: '完整資訊輸入',
        purpose: '驗證標準格式解析',
        input: '測試小明明天下午2點要上測試數學課',
        expected: '課程已安排成功',
        dependencies: [],
        timeout: 5000
      },
      {
        id: 'A1.1-B',
        group: 'group_a_add_single_course',
        phase: 'group_a',
        name: '時間格式多樣性',
        purpose: '驗證時間解析器覆蓋率',
        input: '測試Lumi後天晚上八點半要上測試鋼琴課',
        expected: '課程已安排成功',
        dependencies: [],
        timeout: 5000
      },
      {
        id: 'A1.2-A',
        group: 'group_a_add_single_course', 
        phase: 'group_a',
        name: '缺少學生資訊',
        purpose: '驗證多輪對話補充',
        input: '明天下午3點要上測試數學課',
        expected: '請提供以下資訊：學生姓名',
        dependencies: [],
        timeout: 5000
      },
      
      // Group A - 新增重複課程
      {
        id: 'A2.1-A',
        group: 'group_a_add_recurring_course',
        phase: 'group_a', 
        name: '每週重複課程',
        purpose: '驗證週循環功能',
        input: '測試Lumi每週三下午3點要上測試鋼琴課',
        expected: '課程已安排成功',
        dependencies: [],
        timeout: 5000
      },
      {
        id: 'A2.1-C',
        group: 'group_a_add_recurring_course',
        phase: 'group_a',
        name: '每天重複課程',
        purpose: '驗證每日循環功能',
        input: '測試小明每天早上8點測試晨練課',
        expected: '課程已安排成功',
        dependencies: [],
        timeout: 5000,
        known_issue: 'daily_recurring_not_implemented',
        expected_result: 'failure'
      },
      
      // Group B - 查詢課程
      {
        id: 'B1.1-A',
        group: 'group_b_query_courses',
        phase: 'group_b',
        name: '今日課程查詢',
        purpose: '驗證當日課程顯示',
        input: '測試小明今天有什麼課？',
        expected: '今天的課程如下',
        dependencies: ['test_student_xiaoming', 'test_course_math'],
        timeout: 5000
      },
      {
        id: 'B1.1-B',
        group: 'group_b_query_courses',
        phase: 'group_b',
        name: '明天課程查詢',
        purpose: '驗證次日課程顯示',
        input: '查詢測試Lumi明天的課表',
        expected: '明天的課程如下',
        dependencies: ['test_student_lumi', 'test_course_piano'],
        timeout: 5000
      },
      
      // Group B - 記錄內容
      {
        id: 'B2.1-A',
        group: 'group_b_record_content',
        phase: 'group_b',
        name: '當日課程記錄',
        purpose: '驗證內容記錄功能',
        input: '今天測試小明的測試數學課學了分數加減法',
        expected: '已記錄.*測試數學課.*的內容',
        dependencies: ['test_course_math'],
        timeout: 5000
      },
      
      // Group B - 設定提醒
      {
        id: 'B3.1-A',
        group: 'group_b_set_reminders',
        phase: 'group_b',
        name: '標準課前提醒',
        purpose: '驗證提醒設定功能',
        input: '提醒我測試小明的測試數學課',
        expected: '將在.*開始前.*分鐘提醒您',
        dependencies: ['test_course_math'],
        timeout: 5000
      },
      
      // Group C - 修改課程
      {
        id: 'C1.1-A',
        group: 'group_c_modify_courses',
        phase: 'group_c',
        name: '修改課程時間',
        purpose: '驗證時間修改功能',
        input: '測試小明的測試數學課改到下午4點',
        expected: '已將.*時間修改為',
        dependencies: ['test_course_math', 'course_records'],
        timeout: 5000
      },
      
      // Group C - 取消課程
      {
        id: 'C2.1-A',
        group: 'group_c_cancel_courses',
        phase: 'group_c',
        name: '取消單次課程',
        purpose: '驗證單次課程刪除',
        input: '取消測試小明明天的測試數學課',
        expected: '確定要刪除.*嗎',
        dependencies: ['test_course_math'],
        timeout: 5000
      }
    ];
  }

  /**
   * 檢查環境和依賴
   */
  async checkEnvironmentAndDependencies() {
    console.log('🔍 檢查測試環境和依賴...');
    
    // 檢查測試環境
    const envReady = await this.testDataManager.checkTestEnvironment();
    if (!envReady) {
      throw new Error('測試環境未就緒');
    }
    
    // 檢查配置
    if (!this.config) {
      throw new Error('測試配置未載入');
    }
    
    // 檢查測試目標
    try {
      const response = await axios.get(this.testTargetUrl.replace('/webhook', '/health'), {
        timeout: 5000
      });
      console.log('✅ 測試目標服務正常:', response.data.status);
    } catch (error) {
      console.warn('⚠️ 測試目標服務檢查失敗:', error.message);
    }
    
    console.log('✅ 環境和依賴檢查完成');
    return true;
  }

  /**
   * 執行單個測試用例
   */
  async executeTestCase(testCase) {
    const startTime = Date.now();
    console.log(`🧪 執行測試: ${testCase.id} - ${testCase.name}`);
    
    try {
      // 檢查依賴
      const depsReady = await this.testDataManager.verifyPrerequisites(testCase);
      if (!depsReady) {
        return {
          id: testCase.id,
          status: 'skipped',
          message: '依賴條件未滿足',
          duration: Date.now() - startTime,
          error: 'Missing dependencies'
        };
      }
      
      // 準備測試請求
      const webhookData = {
        events: [{
          type: 'message',
          source: { userId: this.testUserId },
          message: { type: 'text', text: testCase.input },
          replyToken: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }]
      };
      
      // 發送測試請求
      const response = await axios.post(this.testTargetUrl, webhookData, {
        timeout: testCase.timeout || 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Line-Signature': 'test_signature'
        },
        validateStatus: () => true // 允許所有狀態碼
      });
      
      const duration = Date.now() - startTime;
      
      // 分析回應
      let actualOutput = '';
      if (response.status === 200) {
        // 實際的 LINE Bot 回應需要從其他地方獲取
        // 這裡暫時使用狀態碼作為回應指標
        actualOutput = 'Request processed successfully';
      } else {
        actualOutput = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      // 檢查預期結果
      const isExpectedFailure = testCase.expected_result === 'failure';
      const hasKnownIssue = !!testCase.known_issue;
      
      let status = 'passed';
      let message = actualOutput;
      
      // 使用正則表達式檢查預期結果
      const expectedPattern = new RegExp(testCase.expected, 'i');
      const matchesExpected = expectedPattern.test(actualOutput);
      
      if (isExpectedFailure) {
        // 預期失敗的測試
        if (response.status >= 400 || !matchesExpected) {
          status = 'passed'; // 按預期失敗
          message = `按預期失敗 (已知問題: ${testCase.known_issue})`;
        } else {
          status = 'failed';
          message = `預期失敗但實際成功: ${actualOutput}`;
        }
      } else {
        // 預期成功的測試
        if (response.status === 200 && matchesExpected) {
          status = 'passed';
        } else {
          status = 'failed';
          message = `預期: ${testCase.expected}, 實際: ${actualOutput}`;
        }
      }
      
      return {
        id: testCase.id,
        status,
        message,
        duration,
        actualOutput,
        expectedOutput: testCase.expected,
        httpStatus: response.status,
        hasKnownIssue,
        knownIssue: testCase.known_issue
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        id: testCase.id,
        status: 'error',
        message: error.message,
        duration,
        error: error.stack
      };
    }
  }

  /**
   * 執行測試組
   */
  async executeTestGroup(groupName, testCases) {
    console.log(`\n📦 開始執行測試組: ${groupName}`);
    
    const groupConfig = this.config.test_groups[groupName];
    if (!groupConfig) {
      console.error(`❌ 找不到測試組配置: ${groupName}`);
      return { passed: 0, failed: 0, skipped: 0, total: 0 };
    }
    
    const results = {
      groupName,
      startTime: Date.now(),
      passed: 0,
      failed: 0,
      skipped: 0,
      error: 0,
      total: testCases.length,
      testResults: []
    };
    
    // 執行測試組內的所有測試用例
    for (const testCase of testCases) {
      const result = await this.executeTestCase(testCase);
      results.testResults.push(result);
      
      switch (result.status) {
        case 'passed':
          results.passed++;
          console.log(`  ✅ ${result.id}: ${result.message}`);
          break;
        case 'failed':
          results.failed++;
          console.log(`  ❌ ${result.id}: ${result.message}`);
          this.results.errors.push({
            testId: result.id,
            error: result.message,
            phase: testCase.phase
          });
          break;
        case 'skipped':
          results.skipped++;
          console.log(`  ⏭️  ${result.id}: ${result.message}`);
          break;
        case 'error':
          results.error++;
          console.log(`  💥 ${result.id}: ${result.message}`);
          this.results.errors.push({
            testId: result.id,
            error: result.message,
            phase: testCase.phase
          });
          break;
      }
      
      // 測試間隔
      const delay = this.config.execution_rules.timing.between_tests_seconds * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    results.passRate = results.total > 0 ? results.passed / results.total : 0;
    
    console.log(`📊 ${groupName} 完成: ${results.passed}/${results.total} 通過 (${(results.passRate * 100).toFixed(1)}%)`);
    
    return results;
  }

  /**
   * 執行測試階段
   */
  async executePhase(phaseName) {
    console.log(`\n🚀 開始執行階段: ${phaseName.toUpperCase()}`);
    
    const phaseConfig = this.config.phases[phaseName];
    if (!phaseConfig) {
      throw new Error(`找不到階段配置: ${phaseName}`);
    }
    
    // 準備階段數據
    const dataReady = await this.testDataManager.setupPhaseData(phaseName.replace('group_', '').toUpperCase());
    if (!dataReady) {
      throw new Error(`階段 ${phaseName} 數據準備失敗`);
    }
    
    // 獲取該階段的所有測試組
    const phaseGroups = Object.keys(this.config.test_groups).filter(
      groupName => this.config.test_groups[groupName].phase === phaseName
    );
    
    const phaseResults = {
      phaseName,
      startTime: Date.now(),
      groups: {},
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      totalError: 0,
      totalTests: 0
    };
    
    // 執行每個測試組
    for (const groupName of phaseGroups) {
      const groupTestCases = Array.from(this.testCases.values()).filter(
        tc => tc.group === groupName
      );
      
      if (groupTestCases.length === 0) {
        console.warn(`⚠️ 測試組 ${groupName} 沒有測試用例`);
        continue;
      }
      
      const groupResults = await this.executeTestGroup(groupName, groupTestCases);
      phaseResults.groups[groupName] = groupResults;
      
      phaseResults.totalPassed += groupResults.passed;
      phaseResults.totalFailed += groupResults.failed;
      phaseResults.totalSkipped += groupResults.skipped;
      phaseResults.totalError += groupResults.error;
      phaseResults.totalTests += groupResults.total;
      
      // 檢查失敗率是否超過閾值
      const failureRate = (groupResults.failed + groupResults.error) / groupResults.total;
      const threshold = this.config.execution_rules.error_handling[`${phaseName}_failure_threshold`];
      
      if (failureRate > threshold) {
        console.error(`❌ 測試組 ${groupName} 失敗率 ${(failureRate * 100).toFixed(1)}% 超過閾值 ${(threshold * 100).toFixed(1)}%`);
        throw new Error(`階段 ${phaseName} 失敗率過高，測試中止`);
      }
      
      // 組間間隔
      const delay = this.config.execution_rules.timing.between_groups_seconds * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    phaseResults.endTime = Date.now();
    phaseResults.duration = phaseResults.endTime - phaseResults.startTime;
    phaseResults.passRate = phaseResults.totalTests > 0 ? phaseResults.totalPassed / phaseResults.totalTests : 0;
    
    console.log(`🎯 階段 ${phaseName.toUpperCase()} 完成: ${phaseResults.totalPassed}/${phaseResults.totalTests} 通過 (${(phaseResults.passRate * 100).toFixed(1)}%)`);
    
    return phaseResults;
  }

  /**
   * 執行完整測試套件
   */
  async runAllTests() {
    console.log('🎬 開始執行自動化測試套件');
    
    this.results.startTime = Date.now();
    
    try {
      // 載入配置和測試用例
      await this.loadConfig();
      await this.loadTestCases();
      
      // 檢查環境
      await this.checkEnvironmentAndDependencies();
      
      // 清理測試環境
      await this.testDataManager.cleanupAllTestData();
      
      // 按順序執行各個階段
      const phases = this.config.execution_rules.phase_order;
      
      for (const phase of phases) {
        const phaseResults = await this.executePhase(phase);
        this.results.phases[phase] = phaseResults;
        
        this.results.passed += phaseResults.totalPassed;
        this.results.failed += phaseResults.totalFailed;
        this.results.skipped += phaseResults.totalSkipped;
        this.results.totalTests += phaseResults.totalTests;
        
        // 階段間間隔
        const delay = this.config.execution_rules.timing.between_phases_seconds * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error('❌ 測試執行失敗:', error.message);
      this.results.errors.push({
        testId: 'SYSTEM',
        error: error.message,
        phase: 'SETUP'
      });
    } finally {
      this.results.endTime = Date.now();
      
      // 清理測試數據
      await this.testDataManager.postTestCleanup();
    }
    
    // 生成測試報告
    await this.generateTestReport();
    
    return this.results;
  }

  /**
   * 生成測試報告
   */
  async generateTestReport() {
    console.log('\n📊 生成測試報告...');
    
    const totalDuration = this.results.endTime - this.results.startTime;
    const overallPassRate = this.results.totalTests > 0 ? this.results.passed / this.results.totalTests : 0;
    
    this.results.summary = {
      totalDuration: `${(totalDuration / 1000).toFixed(2)}秒`,
      overallPassRate: `${(overallPassRate * 100).toFixed(1)}%`,
      successCriteriaMet: this.checkSuccessCriteria(),
      timestamp: new Date().toISOString()
    };
    
    // 控制台摘要
    console.log('🏁 測試執行完成!');
    console.log(`📈 總計: ${this.results.passed}/${this.results.totalTests} 通過 (${this.results.summary.overallPassRate})`);
    console.log(`⏱️ 執行時間: ${this.results.summary.totalDuration}`);
    console.log(`✅ 成功標準: ${this.results.summary.successCriteriaMet ? '滿足' : '未滿足'}`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ 錯誤摘要 (${this.results.errors.length}個):`);
      this.results.errors.forEach(error => {
        console.log(`  • ${error.testId}: ${error.error}`);
      });
    }
    
    // 儲存詳細報告
    const reportPath = path.resolve(__dirname, `../reports/test-report-${Date.now()}.json`);
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 詳細報告已儲存: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ 報告儲存失敗:', error.message);
    }
  }

  /**
   * 檢查成功標準
   */
  checkSuccessCriteria() {
    if (!this.config.reporting.success_criteria) {
      return true;
    }
    
    const criteria = this.config.reporting.success_criteria;
    const phases = this.results.phases;
    
    // 檢查各階段通過率
    if (phases.group_a) {
      if (phases.group_a.passRate < criteria.group_a_pass_rate) return false;
    }
    if (phases.group_b) {
      if (phases.group_b.passRate < criteria.group_b_pass_rate) return false;
    }
    if (phases.group_c) {
      if (phases.group_c.passRate < criteria.group_c_pass_rate) return false;
    }
    
    // 檢查整體通過率
    const overallPassRate = this.results.totalTests > 0 ? this.results.passed / this.results.totalTests : 0;
    if (overallPassRate < criteria.overall_pass_rate) return false;
    
    return true;
  }
}

// 匯出類和便利函數
module.exports = {
  AutomatedTestRunner,
  
  // 便利函數
  runAllTests: async (configPath) => {
    const runner = new AutomatedTestRunner(configPath);
    return await runner.runAllTests();
  }
};

// CLI 執行
if (require.main === module) {
  async function runCLI() {
    const args = process.argv.slice(2);
    const command = args[0] || 'run';
    
    switch (command) {
      case 'run':
        const configPath = args[1];
        const runner = new AutomatedTestRunner(configPath);
        await runner.runAllTests();
        break;
        
      case 'phase':
        const phase = args[1];
        if (!phase) {
          console.error('請指定階段: A, B, 或 C');
          process.exit(1);
        }
        const phaseRunner = new AutomatedTestRunner();
        await phaseRunner.loadConfig();
        await phaseRunner.loadTestCases();
        await phaseRunner.executePhase(`group_${phase.toLowerCase()}`);
        break;
        
      default:
        console.log(`
使用方法:
  node automated-test-runner.js run [配置文件]  # 執行完整測試
  node automated-test-runner.js phase A        # 只執行特定階段 (A/B/C)
        `);
    }
  }
  
  runCLI().catch(error => {
    console.error('❌ 執行失敗:', error);
    process.exit(1);
  });
}