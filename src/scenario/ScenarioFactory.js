/**
 * ScenarioFactory - 場景模板工廠類
 * 職責：負載場景配置和實例化對應的場景模板
 * 設計原則：
 * - 簡單工廠模式，根據場景類型創建模板實例
 * - 配置驅動，從YAML文件載入場景配置
 * - 錯誤處理，提供清晰的錯誤信息
 */

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class ScenarioFactory {
  /**
   * 創建場景模板實例
   * @param {string} scenarioType - 場景類型，例如：'course_management'
   * @returns {ScenarioTemplate} 場景模板實例
   * @throws {Error} 當配置文件不存在或模板類載入失敗時拋出錯誤
   */
  static create(scenarioType) {
    if (!scenarioType || typeof scenarioType !== 'string') {
      throw new Error('ScenarioFactory: scenarioType must be a non-empty string');
    }

    console.log(`🏭 [ScenarioFactory] Creating scenario: ${scenarioType}`);

    try {
      // Step 1: 載入場景配置
      const config = this.loadScenarioConfig(scenarioType);
      console.log(`🏭 [ScenarioFactory] Config loaded for: ${config.scenario_name}`);

      // Step 2: 動態載入實現類
      const TemplateClass = this.loadTemplateClass(scenarioType);
      console.log(`🏭 [ScenarioFactory] Template class loaded: ${TemplateClass.name}`);

      // Step 3: 創建實例
      const instance = new TemplateClass(config);
      console.log(`🏭 [ScenarioFactory] Instance created successfully`);

      return instance;

    } catch (error) {
      console.error(`❌ [ScenarioFactory] Failed to create scenario: ${scenarioType}`);
      console.error(`❌ [ScenarioFactory] Error details:`, error.message);
      throw new Error(`Failed to create scenario '${scenarioType}': ${error.message}`);
    }
  }

  /**
   * 載入場景配置文件
   * @param {string} scenarioType - 場景類型
   * @returns {Object} 解析後的配置對象
   * @private
   */
  static loadScenarioConfig(scenarioType) {
    // 構建配置文件路徑
    const configPath = path.join(
      __dirname, 
      '../../config/scenarios', 
      `${scenarioType}.yaml`
    );

    console.log(`🏭 [ScenarioFactory] Loading config from: ${configPath}`);

    // 檢查文件是否存在
    if (!fs.existsSync(configPath)) {
      throw new Error(`Scenario config file not found: ${configPath}`);
    }

    try {
      // 讀取並解析YAML文件
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContent);

      if (!config || typeof config !== 'object') {
        throw new Error('Invalid config file format: must be a valid YAML object');
      }

      // 驗證配置基本結構
      this.validateConfig(config, scenarioType);

      return config;

    } catch (yamlError) {
      if (yamlError.name === 'YAMLException') {
        throw new Error(`Invalid YAML syntax in config file: ${yamlError.message}`);
      }
      throw yamlError;
    }
  }

  /**
   * 驗證配置文件的基本結構
   * @param {Object} config - 配置對象
   * @param {string} scenarioType - 場景類型
   * @private
   */
  static validateConfig(config, scenarioType) {
    const requiredFields = [
      'scenario_name',
      'entity_type', 
      'entity_name',
      'messages'
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    // 驗證場景名稱是否一致
    if (config.scenario_name !== scenarioType) {
      console.warn(
        `⚠️ [ScenarioFactory] Config scenario_name '${config.scenario_name}' ` +
        `does not match requested type '${scenarioType}'`
      );
    }

    // 驗證messages配置
    if (!config.messages || typeof config.messages !== 'object') {
      throw new Error('Config field "messages" must be an object');
    }
  }

  /**
   * 動態載入場景模板類
   * @param {string} scenarioType - 場景類型
   * @returns {Class} 場景模板類
   * @private
   */
  static loadTemplateClass(scenarioType) {
    const templateClassName = this.getTemplateClassName(scenarioType);
    const templatePath = path.join(__dirname, 'templates', `${templateClassName}.js`);

    console.log(`🏭 [ScenarioFactory] Loading template class from: ${templatePath}`);

    // 檢查模板文件是否存在
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Template class file not found: ${templatePath}. ` +
        `Expected class name: ${templateClassName}`
      );
    }

    try {
      // 動態載入模板類
      const TemplateClass = require(templatePath);

      // 驗證載入的類
      if (typeof TemplateClass !== 'function') {
        throw new Error(`Template file must export a class constructor`);
      }

      // 檢查是否繼承自ScenarioTemplate（可選驗證）
      const ScenarioTemplate = require('./ScenarioTemplate');
      if (!(TemplateClass.prototype instanceof ScenarioTemplate)) {
        console.warn(
          `⚠️ [ScenarioFactory] Template class '${templateClassName}' ` +
          `does not extend ScenarioTemplate`
        );
      }

      return TemplateClass;

    } catch (requireError) {
      if (requireError.code === 'MODULE_NOT_FOUND') {
        throw new Error(`Template class not found: ${templateClassName}`);
      }
      throw new Error(`Failed to load template class: ${requireError.message}`);
    }
  }

  /**
   * 根據場景類型生成模板類名稱
   * @param {string} scenarioType - 場景類型，例如：'course_management'
   * @returns {string} 類名稱，例如：'CourseManagementScenarioTemplate'
   * @private
   */
  static getTemplateClassName(scenarioType) {
    if (!scenarioType || typeof scenarioType !== 'string') {
      throw new Error('scenarioType must be a non-empty string');
    }

    // course_management -> CourseManagementScenarioTemplate
    return scenarioType
      .split('_')
      .map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('') + 'ScenarioTemplate';
  }

  /**
   * 獲取可用的場景類型列表
   * @returns {Array<string>} 可用場景類型數組
   */
  static getAvailableScenarios() {
    const scenariosDir = path.join(__dirname, '../../config/scenarios');
    
    try {
      if (!fs.existsSync(scenariosDir)) {
        return [];
      }

      const files = fs.readdirSync(scenariosDir);
      return files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.basename(file, path.extname(file)));

    } catch (error) {
      console.error('❌ [ScenarioFactory] Failed to read scenarios directory:', error);
      return [];
    }
  }

  /**
   * 檢查指定場景是否可用
   * @param {string} scenarioType - 場景類型
   * @returns {boolean} 是否可用
   */
  static isScenarioAvailable(scenarioType) {
    const availableScenarios = this.getAvailableScenarios();
    return availableScenarios.includes(scenarioType);
  }

  /**
   * 驗證場景完整性（配置+實現類都存在）
   * @param {string} scenarioType - 場景類型
   * @returns {Object} 驗證結果 { isValid, missingComponents }
   */
  static validateScenarioIntegrity(scenarioType) {
    const result = {
      isValid: true,
      missingComponents: []
    };

    try {
      // 檢查配置文件
      const configPath = path.join(__dirname, '../../config/scenarios', `${scenarioType}.yaml`);
      if (!fs.existsSync(configPath)) {
        result.missingComponents.push('config');
      }

      // 檢查實現類文件
      const templateClassName = this.getTemplateClassName(scenarioType);
      const templatePath = path.join(__dirname, 'templates', `${templateClassName}.js`);
      if (!fs.existsSync(templatePath)) {
        result.missingComponents.push('template_class');
      }

      result.isValid = result.missingComponents.length === 0;

    } catch (error) {
      result.isValid = false;
      result.missingComponents.push('validation_error');
      result.error = error.message;
    }

    return result;
  }
}

module.exports = ScenarioFactory;