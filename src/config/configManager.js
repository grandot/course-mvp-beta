/**
 * ConfigManager - 配置管理器
 * 負責加載、管理和提供系統配置
 * 支援運行時配置更新和環境變數覆蓋
 * 
 * 功能：
 * 1. 統一配置文件管理
 * 2. 環境變數覆蓋支援
 * 3. 運行時配置更新
 * 4. 配置驗證和預設值
 */

const fs = require('fs');
const path = require('path');

/**
 * ConfigManager - 統一配置管理器
 */
class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.watchers = new Map();
    this.listeners = new Map();
    
    // 配置文件路徑
    this.configDir = path.join(__dirname, '../../config');
    
    // 統計資訊
    this.stats = {
      configsLoaded: 0,
      configUpdates: 0,
      environmentOverrides: 0
    };
    
    console.log('[ConfigManager] 初始化完成');
  }

  /**
   * 加載配置文件
   * @param {string} configName - 配置名稱
   * @param {boolean} watchForChanges - 是否監聽文件變更
   * @returns {Object} 配置物件
   */
  loadConfig(configName, watchForChanges = false) {
    const configPath = path.join(this.configDir, `${configName}.json`);
    
    try {
      // 檢查文件是否存在
      if (!fs.existsSync(configPath)) {
        console.warn(`[ConfigManager] 配置文件不存在: ${configPath}`);
        return {};
      }
      
      // 讀取並解析配置文件
      const configContent = fs.readFileSync(configPath, 'utf8');
      const baseConfig = JSON.parse(configContent);
      
      // 應用環境變數覆蓋
      const finalConfig = this.applyEnvironmentOverrides(configName, baseConfig);
      
      // 緩存配置
      this.configs.set(configName, finalConfig);
      this.stats.configsLoaded++;
      
      // 設置文件監聽（如果需要）
      if (watchForChanges && !this.watchers.has(configName)) {
        this.watchConfigFile(configName, configPath);
      }
      
      console.log(`[ConfigManager] 配置已加載: ${configName}`);
      return finalConfig;
      
    } catch (error) {
      console.error(`[ConfigManager] 配置加載失敗: ${configName}`, error);
      return {};
    }
  }

  /**
   * 獲取配置值
   * @param {string} configName - 配置名稱
   * @param {string} keyPath - 配置鍵路徑（支援嵌套，如 'promptTemplates.multiProblem.prefix'）
   * @param {*} defaultValue - 預設值
   * @returns {*} 配置值
   */
  get(configName, keyPath = null, defaultValue = null) {
    // 確保配置已加載
    if (!this.configs.has(configName)) {
      this.loadConfig(configName);
    }
    
    const config = this.configs.get(configName) || {};
    
    // 如果沒有指定鍵路徑，返回整個配置
    if (!keyPath) {
      return config;
    }
    
    // 解析嵌套鍵路徑
    const keys = keyPath.split('.');
    let value = config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * 設置配置值（運行時）
   * @param {string} configName - 配置名稱
   * @param {string} keyPath - 配置鍵路徑
   * @param {*} value - 新值
   */
  set(configName, keyPath, value) {
    // 確保配置已加載
    if (!this.configs.has(configName)) {
      this.loadConfig(configName);
    }
    
    const config = this.configs.get(configName) || {};
    const keys = keyPath.split('.');
    let current = config;
    
    // 導航到父級物件
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    // 設置值
    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;
    
    this.stats.configUpdates++;
    
    // 觸發變更監聽器
    this.notifyListeners(configName, keyPath, value);
    
    console.log(`[ConfigManager] 配置已更新: ${configName}.${keyPath} = ${value}`);
  }

  /**
   * 應用環境變數覆蓋
   * @param {string} configName - 配置名稱
   * @param {Object} baseConfig - 基礎配置
   * @returns {Object} 覆蓋後的配置
   */
  applyEnvironmentOverrides(configName, baseConfig) {
    const config = JSON.parse(JSON.stringify(baseConfig)); // 深拷貝
    const envPrefix = `${configName.toUpperCase()}_`;
    
    // 搜索相關的環境變數
    Object.keys(process.env).forEach(envKey => {
      if (envKey.startsWith(envPrefix)) {
        const configKey = envKey.substring(envPrefix.length).toLowerCase();
        const envValue = process.env[envKey];
        
        // 嘗試解析 JSON 值
        let parsedValue;
        try {
          parsedValue = JSON.parse(envValue);
        } catch {
          parsedValue = envValue; // 保持字符串值
        }
        
        // 設置到配置中
        this.setNestedValue(config, configKey.replace(/_/g, '.'), parsedValue);
        this.stats.environmentOverrides++;
        
        console.log(`[ConfigManager] 環境變數覆蓋: ${configName}.${configKey} = ${parsedValue}`);
      }
    });
    
    return config;
  }

  /**
   * 設置嵌套物件值
   * @param {Object} obj - 目標物件
   * @param {string} keyPath - 鍵路徑
   * @param {*} value - 值
   */
  setNestedValue(obj, keyPath, value) {
    const keys = keyPath.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 監聽配置文件變更
   * @param {string} configName - 配置名稱
   * @param {string} configPath - 配置文件路徑
   */
  watchConfigFile(configName, configPath) {
    try {
      const watcher = fs.watchFile(configPath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`[ConfigManager] 配置文件已變更，重新加載: ${configName}`);
          this.reloadConfig(configName);
        }
      });
      
      this.watchers.set(configName, watcher);
      console.log(`[ConfigManager] 開始監聽配置文件: ${configName}`);
      
    } catch (error) {
      console.error(`[ConfigManager] 文件監聽設置失敗: ${configName}`, error);
    }
  }

  /**
   * 重新加載配置
   * @param {string} configName - 配置名稱
   */
  reloadConfig(configName) {
    // 停止現有監聽
    if (this.watchers.has(configName)) {
      fs.unwatchFile(this.watchers.get(configName));
      this.watchers.delete(configName);
    }
    
    // 重新加載
    const newConfig = this.loadConfig(configName, true);
    
    // 觸發重載監聽器
    this.notifyListeners(configName, '__reload__', newConfig);
  }

  /**
   * 添加配置變更監聽器
   * @param {string} configName - 配置名稱
   * @param {Function} callback - 回調函數
   * @returns {string} 監聽器ID
   */
  addListener(configName, callback) {
    if (!this.listeners.has(configName)) {
      this.listeners.set(configName, new Map());
    }
    
    const listenerId = `listener_${Date.now()}_${Math.random()}`;
    this.listeners.get(configName).set(listenerId, callback);
    
    console.log(`[ConfigManager] 添加監聽器: ${configName}/${listenerId}`);
    return listenerId;
  }

  /**
   * 移除配置變更監聽器
   * @param {string} configName - 配置名稱
   * @param {string} listenerId - 監聽器ID
   */
  removeListener(configName, listenerId) {
    if (this.listeners.has(configName)) {
      this.listeners.get(configName).delete(listenerId);
      console.log(`[ConfigManager] 移除監聽器: ${configName}/${listenerId}`);
    }
  }

  /**
   * 觸發監聽器
   * @param {string} configName - 配置名稱
   * @param {string} keyPath - 變更的鍵路徑
   * @param {*} newValue - 新值
   */
  notifyListeners(configName, keyPath, newValue) {
    if (this.listeners.has(configName)) {
      this.listeners.get(configName).forEach((callback, listenerId) => {
        try {
          callback(keyPath, newValue, configName);
        } catch (error) {
          console.error(`[ConfigManager] 監聽器執行失敗: ${listenerId}`, error);
        }
      });
    }
  }

  /**
   * 驗證配置完整性
   * @param {string} configName - 配置名稱
   * @param {Object} schema - 配置模式
   * @returns {Object} 驗證結果
   */
  validateConfig(configName, schema) {
    const config = this.get(configName);
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // 簡單的模式驗證
    this.validateObject(config, schema, '', validation);
    
    return validation;
  }

  /**
   * 驗證物件
   * @param {Object} obj - 要驗證的物件
   * @param {Object} schema - 模式
   * @param {string} path - 當前路徑
   * @param {Object} validation - 驗證結果
   */
  validateObject(obj, schema, path, validation) {
    if (!schema || typeof schema !== 'object') return;
    
    // 檢查必需的屬性
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach(key => {
        if (!(key in obj)) {
          validation.isValid = false;
          validation.errors.push(`缺少必需屬性: ${path}.${key}`);
        }
      });
    }
    
    // 檢查屬性類型
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        if (key in obj) {
          const currentPath = path ? `${path}.${key}` : key;
          this.validateProperty(obj[key], propSchema, currentPath, validation);
        }
      });
    }
  }

  /**
   * 驗證屬性
   * @param {*} value - 屬性值
   * @param {Object} schema - 屬性模式
   * @param {string} path - 屬性路徑
   * @param {Object} validation - 驗證結果
   */
  validateProperty(value, schema, path, validation) {
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        validation.isValid = false;
        validation.errors.push(`屬性類型錯誤: ${path} 期望 ${schema.type}，實際 ${actualType}`);
      }
    }
    
    if (schema.type === 'object' && schema.properties) {
      this.validateObject(value, schema, path, validation);
    }
  }

  /**
   * 獲取所有已加載的配置名稱
   * @returns {Array} 配置名稱陣列
   */
  getLoadedConfigs() {
    return Array.from(this.configs.keys());
  }

  /**
   * 清理資源
   */
  cleanup() {
    // 停止所有文件監聽
    this.watchers.forEach((watcher, configName) => {
      fs.unwatchFile(watcher);
    });
    this.watchers.clear();
    
    // 清理監聽器
    this.listeners.clear();
    
    // 清理配置緩存
    this.configs.clear();
    
    console.log('[ConfigManager] 資源清理完成');
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      loadedConfigs: this.configs.size,
      activeWatchers: this.watchers.size,
      totalListeners: Array.from(this.listeners.values())
        .reduce((sum, listeners) => sum + listeners.size, 0)
    };
  }
}

// 單例模式
let configManagerInstance = null;

/**
 * 獲取 ConfigManager 單例
 * @returns {ConfigManager} ConfigManager 實例
 */
function getConfigManager() {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

module.exports = {
  ConfigManager,
  getConfigManager
};