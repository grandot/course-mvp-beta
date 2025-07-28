/**
 * Slot Template Loader
 * 負責載入、驗證和快取 Slot Template 配置
 */

const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class TemplateLoader {
  constructor() {
    this.templates = new Map();
    this.schema = null;
    this.ajv = new Ajv();
    addFormats(this.ajv);
    this.templateDir = path.join(process.cwd(), 'config', 'slot-templates');
    this.schemaPath = path.join(this.templateDir, 'schema.json');
    this.initialized = false;
  }

  /**
   * 初始化 TemplateLoader
   * 載入 schema 並預載入所有模板
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 載入 JSON Schema
      await this.loadSchema();
      
      // 預載入所有模板
      await this.loadAllTemplates();
      
      this.initialized = true;
      console.log(`[TemplateLoader] 初始化完成，載入了 ${this.templates.size} 個模板`);
    } catch (error) {
      console.error('[TemplateLoader] 初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 載入 JSON Schema
   */
  async loadSchema() {
    try {
      const schemaContent = await fs.readFile(this.schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validateSchema = this.ajv.compile(this.schema);
      console.log('[TemplateLoader] Schema 載入完成');
    } catch (error) {
      console.error('[TemplateLoader] Schema 載入失敗:', error);
      throw new Error(`無法載入 Slot Template Schema: ${error.message}`);
    }
  }

  /**
   * 載入所有模板文件
   */
  async loadAllTemplates() {
    try {
      const files = await fs.readdir(this.templateDir);
      const templateFiles = files.filter(file => 
        file.endsWith('.json') && file !== 'schema.json'
      );

      for (const file of templateFiles) {
        const templatePath = path.join(this.templateDir, file);
        await this.loadTemplate(templatePath);
      }

      console.log(`[TemplateLoader] 載入了 ${templateFiles.length} 個模板文件`);
    } catch (error) {
      console.error('[TemplateLoader] 載入模板失敗:', error);
      throw error;
    }
  }

  /**
   * 載入單個模板文件
   */
  async loadTemplate(templatePath) {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(content);
      
      // 驗證模板格式
      this.validateTemplate(template);
      
      // 存入快取
      this.templates.set(template.template_id, template);
      
      console.log(`[TemplateLoader] 載入模板: ${template.template_id} (${template.template_name})`);
      return template;
    } catch (error) {
      console.error(`[TemplateLoader] 載入模板失敗 ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * 驗證模板格式
   */
  validateTemplate(template) {
    if (!this.validateSchema) {
      throw new Error('Schema 尚未載入');
    }

    const valid = this.validateSchema(template);
    if (!valid) {
      const errors = this.validateSchema.errors
        .map(err => `${err.instancePath}: ${err.message}`)
        .join(', ');
      throw new Error(`模板驗證失敗: ${errors}`);
    }

    // 額外的業務邏輯驗證
    this.validateBusinessRules(template);
  }

  /**
   * 業務邏輯驗證
   */
  validateBusinessRules(template) {
    const { slots, completion_rules } = template;
    
    // 檢查必填 slots 是否存在
    for (const requiredSlot of completion_rules.minimum_required) {
      if (!slots[requiredSlot]) {
        throw new Error(`必填 slot '${requiredSlot}' 在模板中未定義`);
      }
    }

    // 檢查自動完成 slots 是否有預設值
    if (completion_rules.auto_complete) {
      for (const autoSlot of completion_rules.auto_complete) {
        if (!slots[autoSlot]) {
          throw new Error(`自動完成 slot '${autoSlot}' 在模板中未定義`);
        }
        if (slots[autoSlot].default === undefined) {
          console.warn(`[TemplateLoader] 警告: 自動完成 slot '${autoSlot}' 沒有預設值`);
        }
      }
    }

    // 檢查條件必填的依賴關係
    if (completion_rules.conditional_required) {
      for (const [condition, conditionalSlots] of Object.entries(completion_rules.conditional_required)) {
        for (const slot of conditionalSlots) {
          // 支援嵌套欄位 (如 repeat.pattern)
          const rootSlot = slot.split('.')[0];
          if (!slots[rootSlot]) {
            throw new Error(`條件必填 slot '${slot}' 的根欄位 '${rootSlot}' 在模板中未定義`);
          }
          
          // 如果是嵌套欄位，檢查是否為 object 類型
          if (slot.includes('.') && slots[rootSlot].type !== 'object') {
            throw new Error(`條件必填 slot '${slot}' 需要根欄位 '${rootSlot}' 為 object 類型`);
          }
        }
      }
    }
  }

  /**
   * 根據 template_id 獲取模板
   */
  async getTemplate(templateId) {
    await this.ensureInitialized();
    
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`找不到模板: ${templateId}`);
    }
    
    return template;
  }

  /**
   * 根據 intent 獲取對應的模板
   */
  async getTemplateByIntent(intent) {
    await this.ensureInitialized();
    
    for (const template of this.templates.values()) {
      if (template.intents.includes(intent)) {
        return template;
      }
    }
    
    throw new Error(`找不到支援 intent '${intent}' 的模板`);
  }

  /**
   * 獲取所有模板的列表
   */
  async getAllTemplates() {
    await this.ensureInitialized();
    return Array.from(this.templates.values());
  }

  /**
   * 重新載入指定模板 (用於開發環境的熱重載)
   */
  async reloadTemplate(templateId) {
    if (!this.isDevelopment()) {
      console.warn('[TemplateLoader] 熱重載功能僅在開發環境下可用');
      return;
    }

    try {
      const templatePath = path.join(this.templateDir, `${templateId}.json`);
      await this.loadTemplate(templatePath);
      console.log(`[TemplateLoader] 重新載入模板: ${templateId}`);
    } catch (error) {
      console.error(`[TemplateLoader] 重新載入模板失敗 ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * 清空快取並重新載入所有模板
   */
  async reloadAll() {
    if (!this.isDevelopment()) {
      console.warn('[TemplateLoader] 重新載入功能僅在開發環境下可用');
      return;
    }

    this.templates.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * 確保已初始化
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 檢查是否為開發環境
   */
  isDevelopment() {
    return process.env.NODE_ENV === 'development' || 
           process.env.SLOT_DEBUG_MODE === 'true';
  }

  /**
   * 獲取模板統計資訊
   */
  async getStats() {
    await this.ensureInitialized();
    
    const stats = {
      total_templates: this.templates.size,
      templates: [],
      intents_coverage: new Set()
    };

    for (const template of this.templates.values()) {
      stats.templates.push({
        id: template.template_id,
        name: template.template_name,
        version: template.version,
        slots_count: Object.keys(template.slots).length,
        intents: template.intents
      });

      template.intents.forEach(intent => stats.intents_coverage.add(intent));
    }

    stats.intents_coverage = Array.from(stats.intents_coverage);
    return stats;
  }

  /**
   * 驗證模板覆蓋的完整性
   */
  async validateCoverage(existingIntents) {
    await this.ensureInitialized();
    
    const coveredIntents = new Set();
    for (const template of this.templates.values()) {
      template.intents.forEach(intent => coveredIntents.add(intent));
    }

    const uncoveredIntents = existingIntents.filter(intent => !coveredIntents.has(intent));
    const orphanedIntents = Array.from(coveredIntents).filter(intent => !existingIntents.includes(intent));

    return {
      covered: Array.from(coveredIntents),
      uncovered: uncoveredIntents,
      orphaned: orphanedIntents,
      coverage_rate: existingIntents.length > 0 ? 
        (existingIntents.length - uncoveredIntents.length) / existingIntents.length : 0
    };
  }
}

// 單例模式
let instance = null;

/**
 * 獲取 TemplateLoader 實例
 */
function getTemplateLoader() {
  if (!instance) {
    instance = new TemplateLoader();
  }
  return instance;
}

module.exports = {
  TemplateLoader,
  getTemplateLoader
};