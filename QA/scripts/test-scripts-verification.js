/**
 * 測試腳本功能驗證
 * 驗證三個核心腳本的基本功能是否正常
 */

const path = require('path');
const fs = require('fs').promises;

// 引入要測試的模組
const { TestDataManager } = require('./test-data-manager');
const { AutomatedTestRunner } = require('./automated-test-runner');

class ScriptVerification {
  constructor() {
    this.results = {
      testDataManager: { status: 'pending', details: [] },
      configLoading: { status: 'pending', details: [] },
      testRunner: { status: 'pending', details: [] },
      overall: 'pending'
    };
  }

  /**
   * 驗證測試數據管理器
   */
  async verifyTestDataManager() {
    console.log('🧪 驗證測試數據管理器...');
    const details = [];
    let allPassed = true;

    try {
      // 測試 1: 實例化
      const manager = new TestDataManager();
      details.push({ test: '實例化', status: 'passed', message: '成功創建 TestDataManager 實例' });

      // 測試 2: 配置屬性
      if (manager.testUserId === 'U_test_user_qa') {
        details.push({ test: '測試用戶ID', status: 'passed', message: `測試用戶ID: ${manager.testUserId}` });
      } else {
        details.push({ test: '測試用戶ID', status: 'failed', message: '測試用戶ID配置錯誤' });
        allPassed = false;
      }

      // 測試 3: 標準學生數據
      if (manager.standardStudents && manager.standardStudents.length === 3) {
        details.push({ test: '標準學生數據', status: 'passed', message: `包含${manager.standardStudents.length}個標準學生` });
      } else {
        details.push({ test: '標準學生數據', status: 'failed', message: '標準學生數據配置錯誤' });
        allPassed = false;
      }

      // 測試 4: 標準課程數據
      if (manager.standardCourses && manager.standardCourses.length >= 2) {
        details.push({ test: '標準課程數據', status: 'passed', message: `包含${manager.standardCourses.length}個標準課程` });
      } else {
        details.push({ test: '標準課程數據', status: 'failed', message: '標準課程數據配置錯誤' });
        allPassed = false;
      }

      // 測試 5: 方法存在性檢查
      const requiredMethods = ['checkTestEnvironment', 'cleanupAllTestData', 'setupPhaseData', 'verifyPrerequisites'];
      for (const method of requiredMethods) {
        if (typeof manager[method] === 'function') {
          details.push({ test: `方法: ${method}`, status: 'passed', message: '方法存在且為函數' });
        } else {
          details.push({ test: `方法: ${method}`, status: 'failed', message: '必要方法不存在' });
          allPassed = false;
        }
      }

    } catch (error) {
      details.push({ test: '整體測試', status: 'error', message: error.message });
      allPassed = false;
    }

    this.results.testDataManager = {
      status: allPassed ? 'passed' : 'failed',
      details
    };

    console.log(`   ${allPassed ? '✅' : '❌'} 測試數據管理器驗證${allPassed ? '通過' : '失敗'}`);
    return allPassed;
  }

  /**
   * 驗證配置文件載入
   */
  async verifyConfigLoading() {
    console.log('🧪 驗證配置文件載入...');
    const details = [];
    let allPassed = true;

    try {
      // 測試 1: YAML 配置文件存在
      const configPath = path.resolve(__dirname, '../config/test-dependencies.yaml');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      if (configExists) {
        details.push({ test: '配置文件存在', status: 'passed', message: `配置文件路徑: ${configPath}` });
      } else {
        details.push({ test: '配置文件存在', status: 'failed', message: '配置文件不存在' });
        allPassed = false;
      }

      // 測試 2: 配置內容結構
      if (configExists) {
        const yaml = require('js-yaml');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(configContent);

        // 檢查主要結構
        const requiredSections = ['phases', 'test_groups', 'data_entities', 'execution_rules'];
        for (const section of requiredSections) {
          if (config[section]) {
            details.push({ test: `配置節: ${section}`, status: 'passed', message: '配置節存在' });
          } else {
            details.push({ test: `配置節: ${section}`, status: 'failed', message: '必要配置節缺失' });
            allPassed = false;
          }
        }

        // 檢查階段配置
        if (config.phases) {
          const expectedPhases = ['group_a', 'group_b', 'group_c'];
          for (const phase of expectedPhases) {
            if (config.phases[phase]) {
              details.push({ test: `階段: ${phase}`, status: 'passed', message: '階段配置存在' });
            } else {
              details.push({ test: `階段: ${phase}`, status: 'failed', message: '階段配置缺失' });
              allPassed = false;
            }
          }
        }
      }

    } catch (error) {
      details.push({ test: '配置載入', status: 'error', message: error.message });
      allPassed = false;
    }

    this.results.configLoading = {
      status: allPassed ? 'passed' : 'failed',
      details
    };

    console.log(`   ${allPassed ? '✅' : '❌'} 配置文件載入驗證${allPassed ? '通過' : '失敗'}`);
    return allPassed;
  }

  /**
   * 驗證自動化測試執行器
   */
  async verifyTestRunner() {
    console.log('🧪 驗證自動化測試執行器...');
    const details = [];
    let allPassed = true;

    try {
      // 測試 1: 實例化
      const runner = new AutomatedTestRunner();
      details.push({ test: '實例化', status: 'passed', message: '成功創建 AutomatedTestRunner 實例' });

      // 測試 2: 基本屬性
      if (runner.testUserId === 'U_test_user_qa') {
        details.push({ test: '測試用戶ID', status: 'passed', message: `測試用戶ID: ${runner.testUserId}` });
      } else {
        details.push({ test: '測試用戶ID', status: 'failed', message: '測試用戶ID配置錯誤' });
        allPassed = false;
      }

      // 測試 3: 結果結構初始化
      const expectedResultFields = ['startTime', 'endTime', 'totalTests', 'passed', 'failed', 'phases'];
      for (const field of expectedResultFields) {
        if (runner.results.hasOwnProperty(field)) {
          details.push({ test: `結果欄位: ${field}`, status: 'passed', message: '結果欄位存在' });
        } else {
          details.push({ test: `結果欄位: ${field}`, status: 'failed', message: '結果欄位缺失' });
          allPassed = false;
        }
      }

      // 測試 4: 方法存在性檢查
      const requiredMethods = ['loadConfig', 'loadTestCases', 'executeTestCase', 'executePhase', 'runAllTests'];
      for (const method of requiredMethods) {
        if (typeof runner[method] === 'function') {
          details.push({ test: `方法: ${method}`, status: 'passed', message: '方法存在且為函數' });
        } else {
          details.push({ test: `方法: ${method}`, status: 'failed', message: '必要方法不存在' });
          allPassed = false;
        }
      }

      // 測試 5: 配置載入功能
      try {
        await runner.loadConfig();
        if (runner.config && runner.config.phases) {
          details.push({ test: '配置載入功能', status: 'passed', message: '配置載入成功' });
        } else {
          details.push({ test: '配置載入功能', status: 'failed', message: '配置載入失敗' });
          allPassed = false;
        }
      } catch (error) {
        details.push({ test: '配置載入功能', status: 'error', message: error.message });
        allPassed = false;
      }

      // 測試 6: 測試用例載入功能
      try {
        await runner.loadTestCases();
        if (runner.testCases && runner.testCases.size > 0) {
          details.push({ test: '測試用例載入', status: 'passed', message: `載入${runner.testCases.size}個測試用例` });
        } else {
          details.push({ test: '測試用例載入', status: 'failed', message: '測試用例載入失敗' });
          allPassed = false;
        }
      } catch (error) {
        details.push({ test: '測試用例載入', status: 'error', message: error.message });
        allPassed = false;
      }

    } catch (error) {
      details.push({ test: '整體測試', status: 'error', message: error.message });
      allPassed = false;
    }

    this.results.testRunner = {
      status: allPassed ? 'passed' : 'failed',
      details
    };

    console.log(`   ${allPassed ? '✅' : '❌'} 自動化測試執行器驗證${allPassed ? '通過' : '失敗'}`);
    return allPassed;
  }

  /**
   * 執行所有驗證
   */
  async runAllVerifications() {
    console.log('🚀 開始驗證測試腳本功能\n');

    const results = await Promise.all([
      this.verifyTestDataManager(),
      this.verifyConfigLoading(),
      this.verifyTestRunner()
    ]);

    const allPassed = results.every(result => result);
    this.results.overall = allPassed ? 'passed' : 'failed';

    console.log('\n📊 驗證結果摘要:');
    console.log(`   測試數據管理器: ${this.results.testDataManager.status === 'passed' ? '✅' : '❌'}`);
    console.log(`   配置文件載入: ${this.results.configLoading.status === 'passed' ? '✅' : '❌'}`);
    console.log(`   自動化執行器: ${this.results.testRunner.status === 'passed' ? '✅' : '❌'}`);
    console.log(`   整體結果: ${allPassed ? '✅ 通過' : '❌ 失敗'}`);

    if (allPassed) {
      console.log('\n🎉 所有測試腳本功能驗證通過！可以開始執行自動化測試。');
    } else {
      console.log('\n⚠️ 部分功能驗證失敗，請檢查錯誤訊息並修復後重試。');
      
      // 顯示詳細錯誤
      Object.entries(this.results).forEach(([section, result]) => {
        if (result.status === 'failed') {
          console.log(`\n❌ ${section} 失敗詳情:`);
          result.details.forEach(detail => {
            if (detail.status !== 'passed') {
              console.log(`   • ${detail.test}: ${detail.message}`);
            }
          });
        }
      });
    }

    return allPassed;
  }

  /**
   * 生成驗證報告
   */
  async generateReport() {
    const reportPath = path.resolve(__dirname, `../reports/script-verification-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 詳細驗證報告已儲存: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ 報告儲存失敗:', error.message);
    }
  }
}

// 匯出
module.exports = { ScriptVerification };

// CLI 執行
if (require.main === module) {
  async function runVerification() {
    const verification = new ScriptVerification();
    const success = await verification.runAllVerifications();
    await verification.generateReport();
    
    process.exit(success ? 0 : 1);
  }
  
  runVerification().catch(error => {
    console.error('❌ 驗證過程發生錯誤:', error);
    process.exit(1);
  });
}