/**
 * QA 編排系統主要入口 - 整合所有核心組件
 */

const path = require('path');
const { MarkdownParser } = require('./core/MarkdownParser');
const { EntityExtractor } = require('./core/EntityExtractor');
const { DependencyResolver } = require('./core/DependencyResolver');
const { UnifiedTestRunner } = require('./core/UnifiedTestRunner');

class QAOrchestrator {
  constructor(options = {}) {
    this.options = {
      testPlanPath: options.testPlanPath || path.join(__dirname, '../QA/comprehensive-test-plan.md'),
      dependencyConfigPath: options.dependencyConfigPath || path.join(__dirname, '../QA/config/test-dependencies-auto.yaml'),
      mode: options.mode || 'both', // 'local', 'real', 'both'
      ...options
    };
    
    // 初始化核心組件
    this.parser = new MarkdownParser();
    this.extractor = new EntityExtractor();
    this.resolver = new DependencyResolver();
    this.runner = new UnifiedTestRunner({ mode: this.options.mode });
    
    console.log('🤖 QA Orchestrator 初始化完成');
    console.log(`📋 測試計劃: ${this.options.testPlanPath}`);
    console.log(`⚙️  配置輸出: ${this.options.dependencyConfigPath}`);
    console.log(`🎯 執行模式: ${this.options.mode}`);
  }
  
  /**
   * 完整的 QA 流程：解析 -> 提取 -> 解決依賴 -> 執行測試
   */
  async runFullPipeline() {
    try {
      console.log('\n🚀 開始完整 QA 流程...');
      console.log('='.repeat(80));
      
      // Phase 1: 解析測試計劃
      console.log('\n📖 Phase 1: 解析測試計劃');
      const testCases = await this.parseTestPlan();
      
      // Phase 2: 提取實體
      console.log('\n🔍 Phase 2: 提取實體和依賴關係');
      const enrichedTestCases = await this.extractEntities(testCases);
      
      // Phase 3: 解析依賴
      console.log('\n🔗 Phase 3: 構建依賴關係圖');
      const dependencyInfo = await this.resolveDependencies(enrichedTestCases);
      
      // Phase 4: 生成配置
      console.log('\n⚙️  Phase 4: 生成依賴配置');
      await this.generateConfig(dependencyInfo);
      
      // Phase 5: 執行測試
      console.log('\n🧪 Phase 5: 執行測試');
      const testResults = await this.executeTests(enrichedTestCases);
      
      // Phase 6: 生成報告
      console.log('\n📊 Phase 6: 生成測試報告');
      await this.generateReport(testResults, dependencyInfo);
      
      console.log('\n✅ QA 流程完成！');
      return testResults;
      
    } catch (error) {
      console.error('❌ QA 流程執行失敗:', error.message);
      throw error;
    }
  }
  
  /**
   * 解析測試計劃
   */
  async parseTestPlan() {
    console.log(`📄 解析文件: ${this.options.testPlanPath}`);
    
    const testCases = await this.parser.parse(this.options.testPlanPath);
    const stats = this.parser.getStatistics(testCases);
    
    console.log(`✅ 解析完成: ${stats.total} 個測試案例`);
    console.log(`   Group A: ${stats.byGroup.A} 個`);
    console.log(`   Group B: ${stats.byGroup.B} 個`);
    console.log(`   Group C: ${stats.byGroup.C} 個`);
    
    return testCases;
  }
  
  /**
   * 提取實體
   */
  async extractEntities(testCases) {
    console.log('🔍 開始實體提取...');
    
    const enrichedTestCases = testCases.map(testCase => {
      const entities = this.extractor.extractEntities(testCase);
      const validation = this.extractor.validateExtraction(entities);
      
      return {
        ...testCase,
        entities: entities,
        validation: validation
      };
    });
    
    // 統計提取結果
    const totalEntities = enrichedTestCases.reduce(
      (sum, tc) => sum + tc.entities.creates.length + tc.entities.requires.length, 0
    );
    const avgConfidence = enrichedTestCases.reduce(
      (sum, tc) => sum + tc.entities.confidence, 0
    ) / enrichedTestCases.length;
    
    console.log(`✅ 實體提取完成: ${totalEntities} 個實體關係`);
    console.log(`📊 平均信心度: ${Math.round(avgConfidence * 100)}%`);
    
    return enrichedTestCases;
  }
  
  /**
   * 解析依賴關係
   */
  async resolveDependencies(enrichedTestCases) {
    console.log('🔗 構建依賴關係圖...');
    
    const dependencyInfo = this.resolver.buildDependencyGraph(enrichedTestCases);
    
    if (!dependencyInfo.validation.isValid) {
      console.warn('⚠️  依賴驗證發現問題:');
      dependencyInfo.validation.issues.forEach(issue => {
        console.warn(`   - ${issue}`);
      });
      
      // 嘗試自動修復
      const fixResult = await this.resolver.autoFixDependencyIssues(
        enrichedTestCases, 
        dependencyInfo.validation
      );
      
      if (fixResult.fixed) {
        console.log('🔧 執行自動修復...');
        
        // 更新測試案例為修復後的版本
        enrichedTestCases.splice(0, enrichedTestCases.length, ...fixResult.testCases);
        
        // 重新構建依賴圖
        const newDependencyInfo = this.resolver.buildDependencyGraph(enrichedTestCases);
        
        // 返回修復後的依賴信息
        return {
          ...newDependencyInfo,
          autoFixed: true,
          fixResult: fixResult
        };
      } else {
        console.warn('❌ 自動修復失敗，請手動檢查測試計劃');
      }
    }
    
    if (dependencyInfo.validation.warnings.length > 0) {
      console.warn('⚠️  依賴驗證警告:');
      dependencyInfo.validation.warnings.forEach(warning => {
        console.warn(`   - ${warning}`);
      });
    }
    
    console.log(`✅ 依賴圖構建完成`);
    console.log(`📊 統計: ${dependencyInfo.validation.statistics.totalTests} 測試, ${dependencyInfo.validation.statistics.totalEntities} 實體`);
    
    return dependencyInfo;
  }
  
  /**
   * 生成配置文件
   */
  async generateConfig(dependencyInfo) {
    console.log(`⚙️  生成配置文件: ${this.options.dependencyConfigPath}`);
    
    const config = await this.resolver.generateDependencyConfig(this.options.dependencyConfigPath);
    
    console.log('✅ 配置文件生成完成');
    return config;
  }
  
  /**
   * 執行測試
   */
  async executeTests(enrichedTestCases) {
    console.log(`🧪 開始執行測試 (模式: ${this.options.mode})`);
    
    const results = await this.runner.runTests(enrichedTestCases, this.options.mode);
    
    // 顯示測試報告
    this.runner.generateReport(results);
    
    return results;
  }
  
  /**
   * 生成詳細報告
   */
  async generateReport(testResults, dependencyInfo) {
    console.log('📊 生成詳細報告...');
    
    const report = {
      timestamp: new Date().toISOString(),
      mode: this.options.mode,
      summary: {
        totalTests: dependencyInfo.validation.statistics.totalTests,
        totalEntities: dependencyInfo.validation.statistics.totalEntities,
        dependencyValidation: dependencyInfo.validation
      },
      testResults: testResults
    };
    
    // 保存報告到文件
    const reportPath = path.join(__dirname, '../QA/reports', `test-report-${Date.now()}.json`);
    const reportDir = path.dirname(reportPath);
    
    try {
      const fs = require('fs').promises;
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 詳細報告已保存: ${reportPath}`);
    } catch (error) {
      console.warn(`⚠️  無法保存報告: ${error.message}`);
    }
    
    return report;
  }
  
  /**
   * 快速驗證模式 - 只解析和驗證，不執行測試
   */
  async quickValidate() {
    try {
      console.log('⚡ 快速驗證模式');
      
      const testCases = await this.parseTestPlan();
      const enrichedTestCases = await this.extractEntities(testCases);
      const dependencyInfo = await this.resolveDependencies(enrichedTestCases);
      
      if (dependencyInfo.validation.isValid) {
        console.log('✅ 驗證通過！依賴關係正確');
        return true;
      } else {
        console.log('❌ 驗證失敗，發現依賴問題');
        return false;
      }
      
    } catch (error) {
      console.error('❌ 驗證失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 僅生成配置模式
   */
  async generateConfigOnly() {
    try {
      console.log('⚙️  僅生成配置模式');
      
      const testCases = await this.parseTestPlan();
      const enrichedTestCases = await this.extractEntities(testCases);
      const dependencyInfo = await this.resolveDependencies(enrichedTestCases);
      
      await this.generateConfig(dependencyInfo);
      
      console.log('✅ 配置生成完成');
      return true;
      
    } catch (error) {
      console.error('❌ 配置生成失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 自動修復模式 - 檢測並修復依賴關係問題
   */
  async autoFix() {
    try {
      console.log('🔧 自動修復模式');
      console.log('='.repeat(50));
      
      // Phase 1: 解析和分析
      console.log('\n📖 Phase 1: 解析測試計劃');
      const testCases = await this.parseTestPlan();
      
      console.log('\n🔍 Phase 2: 提取實體');
      const enrichedTestCases = await this.extractEntities(testCases);
      
      console.log('\n🔗 Phase 3: 分析依賴關係');
      const initialDependencyInfo = this.resolver.buildDependencyGraph(enrichedTestCases);
      
      // Phase 4: 自動修復
      console.log('\n🔧 Phase 4: 執行自動修復');
      if (!initialDependencyInfo.validation.isValid) {
        const fixResult = await this.resolver.autoFixDependencyIssues(
          enrichedTestCases, 
          initialDependencyInfo.validation
        );
        
        if (fixResult.fixed) {
          // Phase 5: 生成修復後的配置
          console.log('\n⚙️  Phase 5: 生成修復後的配置');
          const finalDependencyInfo = this.resolver.buildDependencyGraph(fixResult.testCases);
          await this.generateConfig(finalDependencyInfo);
          
          console.log('\n✅ 自動修復完成！');
          console.log(`📊 修復摘要:`);
          console.log(`   問題數量: ${fixResult.oldValidation.issues.length} → ${fixResult.newValidation.issues.length}`);
          console.log(`   警告數量: ${fixResult.oldValidation.warnings.length} → ${fixResult.newValidation.warnings.length}`);
          console.log(`   修復項目: ${fixResult.fixedIssues.length} 個`);
          
          return true;
        } else {
          console.error('❌ 自動修復失敗');
          console.log('建議檢查以下問題:');
          initialDependencyInfo.validation.issues.forEach(issue => {
            console.log(`   - ${issue}`);
          });
          return false;
        }
      } else {
        console.log('✅ 依賴關係正確，無需修復');
        return true;
      }
      
    } catch (error) {
      console.error('❌ 自動修復過程失敗:', error.message);
      return false;
    }
  }
}

module.exports = { QAOrchestrator };