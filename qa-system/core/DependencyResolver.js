/**
 * 依賴解析器 - 構建測試依賴關係圖並生成配置
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class DependencyResolver {
  constructor() {
    this.dependencyGraph = new Map();
    this.entities = new Map();
    this.phases = ['group_a', 'group_b', 'group_c'];
  }
  
  /**
   * 構建依賴關係圖
   */
  buildDependencyGraph(testCases) {
    console.log('🔗 構建測試依賴關係圖...');
    
    // 重置圖
    this.dependencyGraph.clear();
    this.entities.clear();
    
    // 1. 收集所有實體
    this.collectEntities(testCases);
    
    // 2. 建立測試案例節點
    testCases.forEach(testCase => {
      this.dependencyGraph.set(testCase.id, {
        testCase: testCase,
        creates: testCase.entities.creates || [],
        requires: testCase.entities.requires || [],
        dependencies: [],
        dependents: []
      });
    });
    
    // 3. 建立依賴關係
    this.establishDependencies();
    
    // 4. 驗證依賴完整性
    const validation = this.validateDependencies();
    
    console.log(`✅ 依賴圖構建完成: ${testCases.length} 個測試案例, ${this.entities.size} 個實體`);
    
    return {
      graph: this.dependencyGraph,
      entities: this.entities,
      validation: validation
    };
  }
  
  /**
   * 收集所有實體
   */
  collectEntities(testCases) {
    testCases.forEach(testCase => {
      const entities = testCase.entities || {};
      
      // 記錄實體的創建者
      (entities.creates || []).forEach(entityId => {
        if (!this.entities.has(entityId)) {
          this.entities.set(entityId, {
            id: entityId,
            type: this.inferEntityType(entityId),
            createdBy: [],
            usedBy: []
          });
        }
        this.entities.get(entityId).createdBy.push(testCase.id);
      });
      
      // 記錄實體的使用者
      (entities.requires || []).forEach(entityId => {
        if (!this.entities.has(entityId)) {
          this.entities.set(entityId, {
            id: entityId,
            type: this.inferEntityType(entityId),
            createdBy: [],
            usedBy: []
          });
        }
        this.entities.get(entityId).usedBy.push(testCase.id);
      });
    });
  }
  
  /**
   * 推斷實體類型
   */
  inferEntityType(entityId) {
    if (entityId.includes('student')) return 'student';
    if (entityId.includes('course')) return 'course';
    if (entityId.includes('record')) return 'record';
    if (entityId.includes('reminder')) return 'reminder';
    if (entityId.includes('basic_')) return 'collection';
    return 'unknown';
  }
  
  /**
   * 建立依賴關係
   */
  establishDependencies() {
    for (const [testId, node] of this.dependencyGraph) {
      // 找到此測試需要的實體的創建者
      node.requires.forEach(entityId => {
        const entity = this.entities.get(entityId);
        if (entity) {
          entity.createdBy.forEach(creatorTestId => {
            if (creatorTestId !== testId) {
              // 添加依賴關係
              if (!node.dependencies.includes(creatorTestId)) {
                node.dependencies.push(creatorTestId);
              }
              
              // 添加反向關係
              const creatorNode = this.dependencyGraph.get(creatorTestId);
              if (creatorNode && !creatorNode.dependents.includes(testId)) {
                creatorNode.dependents.push(testId);
              }
            }
          });
        }
      });
    }
  }
  
  /**
   * 驗證依賴完整性
   */
  validateDependencies() {
    const issues = [];
    const warnings = [];
    
    // 1. 檢查循環依賴
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      issues.push(`發現循環依賴: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }
    
    // 2. 檢查缺失的創建者
    for (const [entityId, entity] of this.entities) {
      if (entity.usedBy.length > 0 && entity.createdBy.length === 0) {
        issues.push(`實體 ${entityId} 被使用但沒有創建者`);
      }
    }
    
    // 3. 檢查跨階段依賴
    for (const [testId, node] of this.dependencyGraph) {
      const testPhase = this.getTestPhase(testId);
      
      node.dependencies.forEach(depId => {
        const depPhase = this.getTestPhase(depId);
        const testPhaseIndex = this.phases.indexOf(testPhase);
        const depPhaseIndex = this.phases.indexOf(depPhase);
        
        if (depPhaseIndex > testPhaseIndex) {
          issues.push(`測試 ${testId} (${testPhase}) 依賴於後期階段的 ${depId} (${depPhase})`);
        }
      });
    }
    
    // 4. 檢查孤立的測試
    for (const [testId, node] of this.dependencyGraph) {
      if (node.dependencies.length === 0 && node.dependents.length === 0 && 
          node.creates.length === 0 && node.requires.length === 0) {
        warnings.push(`測試 ${testId} 似乎是孤立的（沒有依賴關係）`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      warnings: warnings,
      statistics: this.getValidationStatistics()
    };
  }
  
  /**
   * 檢測循環依賴
   */
  detectCycles() {
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];
    
    const dfs = (nodeId, path) => {
      if (recStack.has(nodeId)) {
        // 找到循環
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart).concat([nodeId]));
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      recStack.add(nodeId);
      
      const node = this.dependencyGraph.get(nodeId);
      if (node) {
        node.dependencies.forEach(depId => {
          dfs(depId, [...path, nodeId]);
        });
      }
      
      recStack.delete(nodeId);
    };
    
    for (const nodeId of this.dependencyGraph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }
    
    return cycles;
  }
  
  /**
   * 獲取測試階段
   */
  getTestPhase(testId) {
    const group = testId.charAt(0).toLowerCase();
    return `group_${group}`;
  }
  
  /**
   * 獲取驗證統計
   */
  getValidationStatistics() {
    const stats = {
      totalTests: this.dependencyGraph.size,
      totalEntities: this.entities.size,
      byPhase: { group_a: 0, group_b: 0, group_c: 0 },
      entityTypes: {},
      dependencyCount: 0
    };
    
    // 統計各階段測試數
    for (const testId of this.dependencyGraph.keys()) {
      const phase = this.getTestPhase(testId);
      stats.byPhase[phase]++;
    }
    
    // 統計實體類型
    for (const entity of this.entities.values()) {
      stats.entityTypes[entity.type] = (stats.entityTypes[entity.type] || 0) + 1;
    }
    
    // 統計依賴關係數
    for (const node of this.dependencyGraph.values()) {
      stats.dependencyCount += node.dependencies.length;
    }
    
    return stats;
  }
  
  /**
   * 生成測試依賴配置 YAML
   */
  async generateDependencyConfig(outputPath) {
    const config = {
      '# 測試依賴關係配置': null,
      '# 自動生成，請勿手動編輯': null,
      
      phases: {},
      test_groups: {},
      data_entities: {},
      execution_rules: this.getExecutionRules(),
      environment_checks: this.getEnvironmentChecks(),
      reporting: this.getReportingConfig()
    };
    
    // 生成階段配置
    this.generatePhaseConfig(config.phases);
    
    // 生成測試組配置
    this.generateTestGroupConfig(config.test_groups);
    
    // 生成實體配置
    this.generateEntityConfig(config.data_entities);
    
    // 寫入文件
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
    
    await fs.writeFile(outputPath, yamlContent, 'utf-8');
    console.log(`✅ 依賴配置已生成: ${outputPath}`);
    
    return config;
  }
  
  /**
   * 生成階段配置
   */
  generatePhaseConfig(phases) {
    const phaseStats = this.getValidationStatistics().byPhase;
    
    phases.group_a = {
      name: '獨立功能測試',
      description: '不需要預置資料的基礎功能測試',
      dependencies: [],
      provides: ['basic_students', 'basic_courses', 'basic_calendar_events'],
      prerequisites: ['clean_environment'],
      estimated_time_minutes: Math.max(30, phaseStats.group_a * 3)
    };
    
    phases.group_b = {
      name: '依賴功能測試',
      description: '基於Group A建立資料的功能測試',
      dependencies: ['basic_students', 'basic_courses'],
      provides: ['course_records', 'reminders', 'query_results'],
      prerequisites: ['group_a_success'],
      estimated_time_minutes: Math.max(30, phaseStats.group_b * 3)
    };
    
    phases.group_c = {
      name: '複雜操作測試',
      description: '需要完整數據環境的高級功能測試',
      dependencies: ['basic_students', 'basic_courses', 'course_records', 'reminders'],
      provides: ['modified_courses', 'cancelled_courses', 'system_stress_results'],
      prerequisites: ['group_a_success', 'group_b_success'],
      estimated_time_minutes: Math.max(20, phaseStats.group_c * 2)
    };
  }
  
  /**
   * 生成測試組配置
   */
  generateTestGroupConfig(testGroups) {
    for (const [testId, node] of this.dependencyGraph) {
      const testCase = node.testCase;
      const phase = this.getTestPhase(testId);
      
      testGroups[testId] = {
        phase: phase,
        name: testCase.name,
        test_count: 1,
        dependencies: node.requires,
        provides: node.creates,
        description: testCase.purpose || `測試案例 ${testId}`
      };
    }
  }
  
  /**
   * 生成實體配置
   */
  generateEntityConfig(dataEntities) {
    for (const [entityId, entity] of this.entities) {
      dataEntities[entityId] = {
        type: entity.type,
        created_by: entity.createdBy,
        used_by: entity.usedBy
      };
      
      // 添加額外屬性
      if (entity.type === 'student') {
        dataEntities[entityId].test_id = entityId.replace('test_student_', 'test_student_');
      } else if (entity.type === 'course') {
        dataEntities[entityId].is_recurring = this.inferRecurringType(entityId);
      }
    }
  }
  
  /**
   * 推斷重複類型
   */
  inferRecurringType(entityId) {
    // 根據實體ID推斷是否為重複課程
    return entityId.includes('recurring') || entityId.includes('daily') || entityId.includes('weekly');
  }
  
  /**
   * 獲取執行規則
   */
  getExecutionRules() {
    return {
      phase_order: ['group_a', 'group_b', 'group_c'],
      error_handling: {
        group_a_failure_threshold: 0.10,
        group_b_failure_threshold: 0.15,
        group_c_failure_threshold: 0.20
      },
      retry_policy: {
        max_retries: 2,
        retry_delay_seconds: 3,
        retry_on_network_error: true,
        retry_on_timeout: true
      },
      timing: {
        between_tests_seconds: 2.5,
        between_groups_seconds: 10,
        between_phases_seconds: 30
      },
      concurrency: {
        max_concurrent_tests: 1,
        allow_parallel_phases: false
      }
    };
  }
  
  /**
   * 獲取環境檢查配置
   */
  getEnvironmentChecks() {
    return {
      required_services: ['firebase', 'line_bot', 'openai'],
      optional_services: ['redis', 'google_calendar'],
      required_env_vars: [
        'LINE_CHANNEL_ACCESS_TOKEN',
        'LINE_CHANNEL_SECRET', 
        'OPENAI_API_KEY',
        'FIREBASE_PROJECT_ID'
      ],
      test_data_constraints: {
        test_user_id: 'U_test_user_qa',
        test_student_prefix: '測試',
        test_course_prefix: '測試'
      }
    };
  }
  
  /**
   * 獲取報告配置
   */
  getReportingConfig() {
    return {
      output_format: 'json',
      detailed_logs: true,
      include_timing: true,
      include_dependencies: true,
      success_criteria: {
        group_a_pass_rate: 0.90,
        group_b_pass_rate: 0.85,
        group_c_pass_rate: 0.80,
        overall_pass_rate: 0.85
      },
      failure_analysis: {
        categorize_failures: true,
        track_regression: true,
        identify_bottlenecks: true
      }
    };
  }
  
  /**
   * 自動修復依賴關係問題
   */
  async autoFixDependencyIssues(testCases, validation) {
    if (validation.isValid) {
      console.log('✅ 依賴關係無問題，無需修復');
      return { fixed: false, testCases: testCases };
    }
    
    console.log('🔧 開始自動修復依賴關係問題...');
    let modifiedTestCases = [...testCases];
    let fixedIssues = [];
    
    // 1. 修復缺失的創建者
    const missingCreators = validation.issues.filter(issue => 
      issue.includes('被使用但沒有創建者')
    );
    
    for (const issue of missingCreators) {
      const entityId = this.extractEntityFromIssue(issue);
      const fix = this.fixMissingCreator(entityId, modifiedTestCases);
      if (fix.success) {
        modifiedTestCases = fix.testCases;
        fixedIssues.push(fix.description);
      }
    }
    
    // 2. 修復孤立的測試案例
    const isolatedTests = validation.warnings.filter(warning => 
      warning.includes('似乎是孤立的')
    );
    
    for (const warning of isolatedTests) {
      const testId = this.extractTestIdFromWarning(warning);
      const fix = this.fixIsolatedTest(testId, modifiedTestCases);
      if (fix.success) {
        modifiedTestCases = fix.testCases;
        fixedIssues.push(fix.description);
      }
    }
    
    // 3. 重新驗證修復結果
    this.buildDependencyGraph(modifiedTestCases);
    const newValidation = this.validateDependencies();
    
    console.log(`🔧 自動修復完成:`);
    console.log(`   ✅ 修復了 ${fixedIssues.length} 個問題`);
    fixedIssues.forEach(fix => console.log(`   - ${fix}`));
    
    if (newValidation.issues.length < validation.issues.length) {
      console.log(`   📊 問題數量: ${validation.issues.length} → ${newValidation.issues.length}`);
    }
    
    return {
      fixed: true,
      fixedIssues: fixedIssues,
      testCases: modifiedTestCases,
      oldValidation: validation,
      newValidation: newValidation
    };
  }
  
  /**
   * 修復缺失的創建者
   */
  fixMissingCreator(entityId, testCases) {
    // 找到使用該實體的測試案例
    const usageTests = testCases.filter(tc => 
      tc.entities.requires && tc.entities.requires.includes(entityId)
    );
    
    if (usageTests.length === 0) {
      return { success: false, description: `找不到使用實體 ${entityId} 的測試` };
    }
    
    // 尋找適合的創建者（通常是 Group A 的測試）
    const groupATests = testCases.filter(tc => tc.group === 'A');
    
    // 根據實體類型找到最合適的創建者
    let creatorTest = null;
    
    if (entityId.includes('student')) {
      // 找創建學生的測試
      creatorTest = groupATests.find(tc => 
        tc.entities.creates && tc.entities.creates.some(c => c.includes('student'))
      );
    } else if (entityId.includes('course')) {
      // 找創建課程的測試
      creatorTest = groupATests.find(tc => 
        tc.entities.creates && tc.entities.creates.some(c => c.includes('course'))
      );
    }
    
    if (!creatorTest) {
      // 創建新的創建者測試
      const newCreatorId = this.generateCreatorTestId(entityId);
      const newTest = this.generateCreatorTest(newCreatorId, entityId);
      testCases.push(newTest);
      
      return {
        success: true,
        testCases: testCases,
        description: `為實體 ${entityId} 創建了新的創建者測試 ${newCreatorId}`
      };
    } else {
      // 在現有創建者中添加該實體
      if (!creatorTest.entities.creates.includes(entityId)) {
        creatorTest.entities.creates.push(entityId);
      }
      
      return {
        success: true,
        testCases: testCases,
        description: `將實體 ${entityId} 添加到現有創建者 ${creatorTest.id}`
      };
    }
  }
  
  /**
   * 修復孤立的測試案例
   */
  fixIsolatedTest(testId, testCases) {
    const testCase = testCases.find(tc => tc.id === testId);
    if (!testCase) {
      return { success: false, description: `找不到測試案例 ${testId}` };
    }
    
    // 根據測試名稱和內容推斷其作用
    const inferredPurpose = this.inferTestPurpose(testCase);
    
    if (inferredPurpose.creates.length > 0) {
      testCase.entities = testCase.entities || {};
      testCase.entities.creates = inferredPurpose.creates;
      
      return {
        success: true,
        testCases: testCases,
        description: `為孤立測試 ${testId} 推斷創建實體: ${inferredPurpose.creates.join(', ')}`
      };
    }
    
    if (inferredPurpose.requires.length > 0) {
      testCase.entities = testCase.entities || {};
      testCase.entities.requires = inferredPurpose.requires;
      
      return {
        success: true,
        testCases: testCases,
        description: `為孤立測試 ${testId} 推斷依賴實體: ${inferredPurpose.requires.join(', ')}`
      };
    }
    
    return { success: false, description: `無法推斷孤立測試 ${testId} 的作用` };
  }
  
  /**
   * 推斷測試案例的作用
   */
  inferTestPurpose(testCase) {
    const creates = [];
    const requires = [];
    
    const text = `${testCase.name} ${testCase.input} ${testCase.purpose}`.toLowerCase();
    
    // 基於關鍵詞推斷創建的實體
    if (text.includes('新增') || text.includes('創建') || text.includes('建立')) {
      if (text.includes('小明') || text.includes('student')) {
        creates.push('test_student_xiaoming');
      }
      if (text.includes('課程') || text.includes('數學課') || text.includes('course')) {
        creates.push('test_course_math');
      }
    }
    
    // 基於關鍵詞推斷依賴的實體
    if (text.includes('查詢') || text.includes('修改') || text.includes('刪除')) {
      if (text.includes('小明')) {
        requires.push('test_student_xiaoming');
      }
      if (text.includes('課程') || text.includes('數學課')) {
        requires.push('test_course_math');
      }
    }
    
    return { creates, requires };
  }
  
  /**
   * 生成創建者測試
   */
  generateCreatorTest(testId, entityId) {
    const entityType = entityId.includes('student') ? '學生' : '課程';
    const entityName = this.extractEntityName(entityId);
    
    return {
      id: testId,
      group: 'A',
      name: `創建${entityType}：${entityName}`,
      input: `測試新增${entityName}的${entityType}`,
      expectedOutput: '成功創建',
      purpose: `為其他測試提供${entityType}實體`,
      entities: {
        creates: [entityId],
        requires: []
      },
      generated: true // 標記為自動生成
    };
  }
  
  /**
   * 輔助方法：從錯誤信息中提取實體 ID
   */
  extractEntityFromIssue(issue) {
    const match = issue.match(/實體 (\w+) 被使用但沒有創建者/);
    return match ? match[1] : null;
  }
  
  /**
   * 輔助方法：從警告中提取測試 ID
   */
  extractTestIdFromWarning(warning) {
    const match = warning.match(/測試 ([\w\.-]+) 似乎是孤立的/);
    return match ? match[1] : null;
  }
  
  /**
   * 生成創建者測試 ID
   */
  generateCreatorTestId(entityId) {
    const timestamp = Date.now().toString().slice(-4);
    return `A0.0-AUTO-${timestamp}`;
  }
  
  /**
   * 從實體 ID 中提取名稱
   */
  extractEntityName(entityId) {
    if (entityId.includes('xiaoming')) return '小明';
    if (entityId.includes('math')) return '數學課';
    if (entityId.includes('piano')) return '鋼琴課';
    return entityId.replace(/^test_(student_|course_)/, '');
  }
}

module.exports = { DependencyResolver };