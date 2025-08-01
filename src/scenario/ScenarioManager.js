/**
 * ScenarioManager - 場景管理器單例
 * 職責：啟動時一次性加載所有場景配置和模板，運行時復用實例
 * 架構約束：保持 Forced Boundaries，提供與 ScenarioFactory 相同的接口
 * 
 * TODO: 技術債 - 當前場景系統主要用於模板消息格式化
 * 未來實現真正業務場景切換時需重構語義解析層整合
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ScenarioManager {
  static instance = null;
  static scenarios = new Map();     // 預加載的場景實例緩存
  static configs = new Map();       // 預加載的配置緩存
  static templates = new Map();     // 預加載的模板類緩存
  static initialized = false;

  /**
   * 獲取單例實例
   * @returns {ScenarioManager} 單例實例
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new ScenarioManager();
    }
    return this.instance;
  }

  /**
   * 初始化當前場景（啟動時調用一次）
   * 🎯 獨立部署模式：每個 webservice 實例只加載一個場景
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized) {
      console.log('🏭 [ScenarioManager] Already initialized, skipping...');
      return;
    }

    // 🎯 只加載當前環境指定的單一場景
    const scenarioType = process.env.SCENARIO_TYPE || 'course_management';
    console.log(`🏭 [ScenarioManager] Initializing single scenario: ${scenarioType}`);
    const startTime = Date.now();

    try {
      // 驗證場景存在性
      const availableScenarios = this.getAvailableScenarios();
      if (!availableScenarios.includes(scenarioType)) {
        throw new Error(`Scenario "${scenarioType}" not found. Available: ${availableScenarios.join(', ')}`);
      }

      // 只預加載當前場景
      await this.preloadScenario(scenarioType);

      this.initialized = true;
      this.currentScenarioType = scenarioType;
      const initTime = Date.now() - startTime;
      console.log(`✅ [ScenarioManager] Initialized scenario "${scenarioType}" in ${initTime}ms`);
      console.log(`🎯 WebService mode: Single scenario deployment`);
      
    } catch (error) {
      console.error('❌ [ScenarioManager] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * 預加載單個場景
   * @param {string} scenarioType - 場景類型
   * @returns {Promise<void>}
   */
  static async preloadScenario(scenarioType) {
    try {
      // 加載配置
      const config = this.loadConfig(scenarioType);
      this.configs.set(scenarioType, config);

      // 加載模板類
      const TemplateClass = this.loadTemplateClass(scenarioType);
      this.templates.set(scenarioType, TemplateClass);

      // 創建實例
      const instance = new TemplateClass(config);
      this.scenarios.set(scenarioType, instance);

      console.log(`✅ [ScenarioManager] Preloaded scenario: ${scenarioType}`);
      
    } catch (error) {
      console.error(`❌ [ScenarioManager] Failed to preload scenario ${scenarioType}:`, error.message);
      throw error;
    }
  }

  /**
   * 獲取當前場景實例（運行時調用，O(1) 查找）
   * 🎯 單場景模式：只能獲取當前已加載的場景
   * @param {string} scenarioType - 場景類型（應該與當前場景匹配）
   * @returns {Object} 場景實例
   */
  static getScenario(scenarioType) {
    if (!this.initialized) {
      throw new Error('ScenarioManager not initialized. Call initialize() first.');
    }

    // 🎯 安全檢查：只允許獲取當前部署的場景
    if (scenarioType !== this.currentScenarioType) {
      throw new Error(`Scenario "${scenarioType}" not available in this webservice. Current scenario: "${this.currentScenarioType}"`);
    }

    const scenario = this.scenarios.get(scenarioType);
    if (!scenario) {
      throw new Error(`Scenario "${scenarioType}" not loaded. This should not happen.`);
    }

    return scenario;
  }

  /**
   * 獲取當前場景實例（簡化版）
   * @returns {Object} 當前場景實例
   */
  static getCurrentScenario() {
    if (!this.initialized) {
      throw new Error('ScenarioManager not initialized. Call initialize() first.');
    }

    return this.scenarios.get(this.currentScenarioType);
  }

  /**
   * 創建場景實例（向後兼容 ScenarioFactory.create）
   * @param {string} scenarioType - 場景類型
   * @returns {Object} 場景實例
   */
  static create(scenarioType) {
    return this.getScenario(scenarioType);
  }

  /**
   * 加載場景配置
   * @param {string} scenarioType - 場景類型
   * @returns {Object} 配置對象
   */
  static loadConfig(scenarioType) {
    const configPath = path.join(__dirname, '..', '..', 'config', 'scenarios', `${scenarioType}.yaml`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Scenario config file not found: ${configPath}`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent);
      
      if (!config || typeof config !== 'object') {
        throw new Error(`Invalid config format in ${configPath}`);
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load config ${configPath}: ${error.message}`);
    }
  }

  /**
   * 加載模板類
   * @param {string} scenarioType - 場景類型
   * @returns {Function} 模板類構造函數
   */
  static loadTemplateClass(scenarioType) {
    // 轉換場景類型為類名格式
    const className = scenarioType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'ScenarioTemplate';

    const templatePath = path.join(__dirname, 'templates', `${className}.js`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template class file not found: ${templatePath}`);
    }

    try {
      const TemplateClass = require(templatePath);
      
      if (typeof TemplateClass !== 'function') {
        throw new Error(`Template class is not a constructor: ${templatePath}`);
      }

      return TemplateClass;
    } catch (error) {
      throw new Error(`Failed to load template class ${templatePath}: ${error.message}`);
    }
  }

  /**
   * 獲取所有可用場景列表
   * @returns {Array<string>} 場景類型列表
   */
  static getAvailableScenarios() {
    const configDir = path.join(__dirname, '..', '..', 'config', 'scenarios');
    
    try {
      const files = fs.readdirSync(configDir);
      return files
        .filter(file => file.endsWith('.yaml'))
        .map(file => path.basename(file, '.yaml'));
    } catch (error) {
      console.error('Failed to read scenarios directory:', error.message);
      return [];
    }
  }

  /**
   * 驗證場景完整性
   * @param {string} scenarioType - 場景類型
   * @returns {Object} 驗證結果
   */
  static validateScenarioIntegrity(scenarioType) {
    const result = {
      isValid: true,
      missingComponents: [],
      errors: []
    };

    try {
      // 檢查配置文件
      const configPath = path.join(__dirname, '..', '..', 'config', 'scenarios', `${scenarioType}.yaml`);
      if (!fs.existsSync(configPath)) {
        result.missingComponents.push('config');
        result.isValid = false;
      }

      // 檢查模板類文件
      const className = scenarioType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('') + 'ScenarioTemplate';
      const templatePath = path.join(__dirname, 'templates', `${className}.js`);
      
      if (!fs.existsSync(templatePath)) {
        result.missingComponents.push('template');
        result.isValid = false;
      }

      // 檢查是否已加載
      if (this.initialized && !this.scenarios.has(scenarioType)) {
        result.missingComponents.push('instance');
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(error.message);
      result.isValid = false;
    }

    return result;
  }

  /**
   * 獲取管理器狀態
   * @returns {Object} 狀態信息
   */
  static getStatus() {
    return {
      initialized: this.initialized,
      deploymentMode: 'single_scenario',
      currentScenario: this.currentScenarioType,
      loadedScenarios: Array.from(this.scenarios.keys()),
      availableScenarios: this.getAvailableScenarios(),
      memoryUsage: {
        scenarios: this.scenarios.size,
        configs: this.configs.size,
        templates: this.templates.size
      }
    };
  }

  /**
   * 清理緩存（測試用）
   * @returns {void}
   */
  static clearCache() {
    this.scenarios.clear();
    this.configs.clear();
    this.templates.clear();
    this.initialized = false;
    this.instance = null;
    console.log('🔧 [ScenarioManager] Cache cleared');
  }
}

module.exports = ScenarioManager;