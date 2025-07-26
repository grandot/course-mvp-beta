# Scenario Layer重構計劃 - 快速擴展場景架構

## 🎯 重構目標

實現**高度易擴展的Scenario Layer**，讓開發者能快速複製模板來創建新場景的chatbot：
- 課程管理 → 長照系統 → 保險業務員成交管理
- **完全獨立**：每個chatbot獨立部署，互不影響
- **快速擴展**：複製config+class就能launch新bot
- **配置驅動**：純配置文件定義場景邏輯

## 🏗️ 簡化架構設計

### 當前架構
```
LineController → SemanticService → TaskService → CourseService → DataService/TimeService
                     ↑                ↑            ↑
                 語義處理層        任務執行層    業務邏輯層(耦合)
```

### 目標架構 - 四層場景抽象設計
```
LineController (請求接收層)
  ↓
SemanticService (語義處理統一入口) 
  ↓
TaskService (任務協調層，啟動時載入單一scenario)
  ↓
ScenarioTemplate (單一場景模板實例，完全可替換)
  ↓
EntityService (通用實體服務層)
  ↓
DataService/TimeService (統一服務層)
```

### 🔒 強制邊界約束

| 層級 | 允許調用 | 禁止調用 | 職責 |
|------|----------|----------|------|
| **TaskService** | ScenarioTemplate | EntityService, DataService | 純協調，委託給scenario |
| **ScenarioTemplate** | EntityService | DataService, TimeService | 場景邏輯實現 |
| **EntityService** | DataService, TimeService | - | 通用CRUD操作 |

## 📋 重構步驟詳解

### Phase 1: 核心抽象層創建

#### Step 1: ScenarioTemplate 抽象基類
```javascript
// src/scenario/ScenarioTemplate.js
class ScenarioTemplate {
  constructor(config) {
    this.config = config;
    this.entityType = config.entity_type;
    this.entityName = config.entity_name;
  }

  // 抽象方法 - 子類必須實現
  async createEntity(entities, userId) { 
    throw new Error('ScenarioTemplate.createEntity must be implemented'); 
  }
  
  async modifyEntity(entities, userId) { 
    throw new Error('ScenarioTemplate.modifyEntity must be implemented'); 
  }
  
  async cancelEntity(entities, userId) { 
    throw new Error('ScenarioTemplate.cancelEntity must be implemented'); 
  }
  
  async queryEntities(userId) { 
    throw new Error('ScenarioTemplate.queryEntities must be implemented'); 
  }
  
  async clearAllEntities(entities, userId) { 
    throw new Error('ScenarioTemplate.clearAllEntities must be implemented'); 
  }

  // 通用方法
  getConfig() { return this.config; }
  getEntityType() { return this.entityType; }
  getEntityName() { return this.entityName; }
  
  // 格式化訊息模板
  formatMessage(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
  }
}

module.exports = ScenarioTemplate;
```

#### Step 2: scenario-config.yaml 配置結構
```yaml
# config/scenarios/course-management.yaml
scenario_name: "course_management"
scenario_version: "1.0.0"
entity_type: "courses"  # 資料庫集合名稱
entity_name: "課程"      # 顯示名稱

# 必要欄位定義
required_fields: ["course_name", "timeInfo"]
optional_fields: ["location", "teacher"]

# 訊息模板
messages:
  create_success: "✅ {entity_name}「{course_name}」已成功新增！"
  create_missing_name: "請告訴我{entity_name}名稱，例如：「數學課」、「英文課」等"
  create_missing_time: "請提供上課時間，例如：「明天下午2點」、「週三晚上7點」等"
  
  modify_success: "✅ 成功修改「{course_name}」的{modified_fields}"
  modify_not_found: "找不到「{course_name}」{entity_name}，請確認名稱是否正確"
  modify_missing_name: "請指定要修改的{entity_name}名稱，例如：「修改數學課時間」"
  
  cancel_success: "✅ {entity_name}「{course_name}」已成功取消！"
  cancel_not_found: "找不到要取消的「{course_name}」{entity_name}"
  cancel_missing_name: "請指定要取消的{entity_name}名稱"
  
  query_empty: "您目前沒有任何{entity_name}安排"
  
  clear_warning: "⚠️ 警告：此操作將刪除您的所有 {count} 門{entity_name}，且無法恢復！\\n\\n如果確定要清空{entity_name}表，請回覆「確認清空」。"
  clear_success: "✅ 成功清空{entity_name}表！共刪除 {count} 門{entity_name}"
  clear_empty: "您目前沒有任何{entity_name}安排需要清空。"

# 驗證規則
validation_rules:
  time_conflict_check: true
  name_format_check: true

# 顯示格式
display:
  time_format: "MM/DD HH:MM AM/PM"
  list_item_format: "🕒 {schedule_time} - 📚 {course_name}"
```

#### Step 3: ScenarioFactory 簡單工廠
```javascript
// src/scenario/ScenarioFactory.js
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class ScenarioFactory {
  static create(scenarioType) {
    // 載入配置
    const configPath = path.join(__dirname, '../../config/scenarios', `${scenarioType}.yaml`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Scenario config not found: ${scenarioType}`);
    }
    
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    // 動態載入實現類
    try {
      const TemplateClass = require(`./templates/${this.getTemplateClassName(scenarioType)}`);
      return new TemplateClass(config);
    } catch (error) {
      throw new Error(`Failed to load scenario template: ${scenarioType}. Error: ${error.message}`);
    }
  }
  
  static getTemplateClassName(scenarioType) {
    // course_management -> CourseManagementScenarioTemplate
    return scenarioType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'ScenarioTemplate';
  }
}

module.exports = ScenarioFactory;
```

### Phase 2: 通用服務層重構

#### Step 4: EntityService 通用實體服務
```javascript
// src/services/entityService.js
const DataService = require('./dataService');
const TimeService = require('./timeService');

class EntityService {
  /**
   * 創建實體
   * @param {string} entityType - 實體類型（資料庫集合名稱）
   * @param {Object} entityData - 實體數據
   * @returns {Promise<Object>} 創建結果
   */
  static async createEntity(entityType, entityData) {
    // 通用驗證
    if (!entityData || typeof entityData !== 'object') {
      throw new Error('EntityService: entityData must be an object');
    }
    
    return DataService.createDocument(entityType, entityData);
  }

  /**
   * 更新實體
   */
  static async updateEntity(entityType, entityId, updateData) {
    if (!entityId || !updateData) {
      throw new Error('EntityService: entityId and updateData are required');
    }
    
    return DataService.updateDocument(entityType, entityId, updateData);
  }

  /**
   * 查詢實體
   */
  static async queryEntities(entityType, criteria) {
    return DataService.queryDocuments(entityType, criteria);
  }

  /**
   * 刪除實體
   */
  static async deleteEntity(entityType, entityId) {
    return DataService.deleteDocument(entityType, entityId);
  }

  /**
   * 批量刪除用戶實體
   */
  static async clearUserEntities(entityType, userId) {
    const entities = await this.queryEntities(entityType, { 
      student_id: userId  // 保持與現有資料庫欄位兼容
    });
    
    const deletePromises = entities.map(entity => 
      this.deleteEntity(entityType, entity.id)
    );
    
    const results = await Promise.allSettled(deletePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    return {
      success: successCount === entities.length,
      totalCount: entities.length,
      deletedCount: successCount,
      errors: results.filter(r => r.status === 'rejected').map(r => r.reason)
    };
  }

  /**
   * 檢查時間衝突（通用邏輯）
   */
  static async checkTimeConflicts(entityType, userId, date, time, excludeId = null) {
    const conflicts = await this.queryEntities(entityType, {
      student_id: userId,
      course_date: date,
      schedule_time: time,
      status: 'scheduled'
    });
    
    return conflicts.filter(entity => entity.id !== excludeId);
  }
}

module.exports = EntityService;
```

#### Step 5: CourseScenarioTemplate 具體實現
```javascript
// src/scenario/templates/CourseManagementScenarioTemplate.js
const ScenarioTemplate = require('../ScenarioTemplate');
const EntityService = require('../../services/entityService');
const TimeService = require('../../services/timeService');

class CourseManagementScenarioTemplate extends ScenarioTemplate {
  /**
   * 創建課程
   */
  async createEntity(entities, userId) {
    const { course_name, timeInfo, location, teacher } = entities;
    
    // 驗證必要欄位
    if (!course_name) {
      return {
        success: false,
        error: 'Missing course name',
        message: this.formatMessage(this.config.messages.create_missing_name, {
          entity_name: this.entityName
        })
      };
    }
    
    if (!timeInfo) {
      return {
        success: false,
        error: 'Missing time information',
        message: this.formatMessage(this.config.messages.create_missing_time, {
          entity_name: this.entityName
        })
      };
    }

    // 驗證時間格式
    if (!TimeService.validateTimeInfo(timeInfo)) {
      return {
        success: false,
        error: 'Invalid time information',
        message: '時間格式不正確，請重新輸入時間信息'
      };
    }

    // 檢查時間衝突
    if (this.config.validation_rules.time_conflict_check) {
      const conflicts = await EntityService.checkTimeConflicts(
        this.entityType, userId, timeInfo.date, timeInfo.display
      );
      
      if (conflicts.length > 0) {
        return {
          success: false,
          error: 'Time conflict',
          message: '該時間已有其他課程安排'
        };
      }
    }

    // 創建課程數據
    const courseData = {
      student_id: userId,
      course_name,
      schedule_time: timeInfo.display,
      course_date: timeInfo.date,
      location: location || null,
      teacher: teacher || null,
      status: 'scheduled'
    };

    try {
      const result = await EntityService.createEntity(this.entityType, courseData);
      
      return {
        success: result.success,
        course: result.data,
        message: this.formatMessage(this.config.messages.create_success, {
          entity_name: this.entityName,
          course_name
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '創建課程時發生錯誤，請稍後再試'
      };
    }
  }

  /**
   * 修改課程
   */
  async modifyEntity(entities, userId) {
    const { course_name, timeInfo, location, teacher } = entities;
    
    if (!course_name) {
      return {
        success: false,
        error: 'Missing course name',
        message: this.formatMessage(this.config.messages.modify_missing_name, {
          entity_name: this.entityName
        })
      };
    }

    // 查找要修改的課程
    const existingCourses = await EntityService.queryEntities(this.entityType, {
      student_id: userId,
      course_name,
      status: 'scheduled'
    });

    if (existingCourses.length === 0) {
      return {
        success: false,
        error: 'Course not found',
        message: this.formatMessage(this.config.messages.modify_not_found, {
          course_name,
          entity_name: this.entityName
        })
      };
    }

    // 構建更新數據
    const updateData = {};
    const modifiedFields = [];

    if (timeInfo && TimeService.validateTimeInfo(timeInfo)) {
      updateData.schedule_time = timeInfo.display;
      updateData.course_date = timeInfo.date;
      modifiedFields.push('時間');
    }

    if (location) {
      updateData.location = location;
      modifiedFields.push('地點');
    }

    if (teacher) {
      updateData.teacher = teacher;
      modifiedFields.push('老師');
    }

    if (modifiedFields.length === 0) {
      return {
        success: false,
        error: 'No update fields provided',
        message: '請指定要修改的內容，例如：「修改數學課時間到下午3點」'
      };
    }

    try {
      const courseToModify = existingCourses[0];
      const result = await EntityService.updateEntity(this.entityType, courseToModify.id, updateData);
      
      return {
        success: result.success,
        message: this.formatMessage(this.config.messages.modify_success, {
          course_name,
          modified_fields: modifiedFields.join('、')
        }),
        modifiedFields,
        updatedCourse: result.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '修改課程時發生錯誤，請稍後再試'
      };
    }
  }

  /**
   * 取消課程
   */
  async cancelEntity(entities, userId) {
    const { course_name } = entities;
    
    if (!course_name) {
      return {
        success: false,
        error: 'Missing course name',
        message: this.formatMessage(this.config.messages.cancel_missing_name, {
          entity_name: this.entityName
        })
      };
    }

    // 查找要取消的課程
    const courses = await EntityService.queryEntities(this.entityType, {
      student_id: userId,
      course_name,
      status: 'scheduled'
    });

    if (courses.length === 0) {
      return {
        success: false,
        error: 'Course not found',
        message: this.formatMessage(this.config.messages.cancel_not_found, {
          course_name,
          entity_name: this.entityName
        })
      };
    }

    try {
      const result = await EntityService.updateEntity(this.entityType, courses[0].id, {
        status: 'cancelled'
      });
      
      return {
        success: result.success,
        cancelledCourse: courses[0],
        message: this.formatMessage(this.config.messages.cancel_success, {
          entity_name: this.entityName,
          course_name
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '取消課程時發生錯誤，請稍後再試'
      };
    }
  }

  /**
   * 查詢課表
   */
  async queryEntities(userId) {
    try {
      const courses = await EntityService.queryEntities(this.entityType, {
        student_id: userId,
        status: 'scheduled'
      });

      return {
        success: true,
        courses,
        count: courses.length,
        message: courses.length === 0 ? 
          this.formatMessage(this.config.messages.query_empty, {
            entity_name: this.entityName
          }) : null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '查詢課表時發生錯誤，請稍後再試'
      };
    }
  }

  /**
   * 清空課表
   */
  async clearAllEntities(entities, userId) {
    const { confirmation } = entities;
    const isConfirmation = confirmation === '確認清空' || confirmation === '確認';

    if (!isConfirmation) {
      // 檢查課程數量並要求確認
      const courses = await EntityService.queryEntities(this.entityType, {
        student_id: userId
      });
      
      if (courses.length === 0) {
        return {
          success: true,
          action: 'clear_check',
          message: this.formatMessage(this.config.messages.clear_empty, {
            entity_name: this.entityName
          })
        };
      }

      return {
        success: false,
        action: 'clear_confirmation_required',
        requiresConfirmation: true,
        message: this.formatMessage(this.config.messages.clear_warning, {
          count: courses.length,
          entity_name: this.entityName
        }),
        courseCount: courses.length
      };
    }

    // 執行清空
    try {
      const result = await EntityService.clearUserEntities(this.entityType, userId);
      
      return {
        success: result.success,
        action: 'clear_executed',
        message: this.formatMessage(this.config.messages.clear_success, {
          count: result.deletedCount,
          entity_name: this.entityName
        }),
        deletedCount: result.deletedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '清空課表時發生錯誤，請稍後再試'
      };
    }
  }
}

module.exports = CourseManagementScenarioTemplate;
```

#### Step 6: TaskService 集成單一scenario
```javascript
// src/services/taskService.js (簡化版)
const ScenarioFactory = require('../scenario/ScenarioFactory');

class TaskService {
  constructor() {
    // 啟動時載入場景模板，不再動態切換
    const scenarioType = process.env.SCENARIO_TYPE || 'course_management';
    this.scenarioTemplate = ScenarioFactory.create(scenarioType);
    
    console.log(`TaskService initialized with scenario: ${scenarioType}`);
  }

  /**
   * 統一任務執行入口 - 委託給場景模板
   */
  async executeIntent(intent, entities, userId) {
    console.log(`🔧 [DEBUG] TaskService.executeIntent - Intent: ${intent}, UserId: ${userId}`);

    if (!intent || !userId) {
      return {
        success: false,
        error: 'Missing required parameters',
        message: '缺少必要的參數信息'
      };
    }

    try {
      // 直接委託給場景模板，不再有複雜的協調邏輯
      switch (intent) {
        case 'record_course':
          return this.scenarioTemplate.createEntity(entities, userId);
          
        case 'modify_course':
          return this.scenarioTemplate.modifyEntity(entities, userId);
          
        case 'cancel_course':
          return this.scenarioTemplate.cancelEntity(entities, userId);
          
        case 'query_schedule':
          return this.scenarioTemplate.queryEntities(userId);
          
        case 'clear_schedule':
          return this.scenarioTemplate.clearAllEntities(entities, userId);
          
        case 'set_reminder':
          return {
            success: false,
            error: 'Feature not implemented',
            message: '此功能將在後續版本中實現'
          };
          
        default:
          return {
            success: false,
            error: 'Unknown intent',
            message: '抱歉，我無法理解您的需求，請重新描述'
          };
      }
    } catch (error) {
      console.error(`❌ [ERROR] TaskService.executeIntent - 執行失敗:`, error);
      return {
        success: false,
        error: error.message,
        message: '處理請求時發生錯誤，請稍後再試'
      };
    }
  }
}

module.exports = TaskService;
```

## 🔄 場景擴展示例

### 長照系統場景
```yaml
# config/scenarios/healthcare_management.yaml
scenario_name: "healthcare_management"
entity_type: "care_sessions"
entity_name: "照護"

required_fields: ["client_name", "care_type", "timeInfo"]
optional_fields: ["caregiver", "location", "notes"]

messages:
  create_success: "✅ {client_name}的{care_type}已安排完成！"
  create_missing_name: "請告訴我服務對象姓名"
  modify_success: "✅ 成功修改{client_name}的{care_type}安排"
```

```javascript
// src/scenario/templates/HealthcareManagementScenarioTemplate.js
class HealthcareManagementScenarioTemplate extends ScenarioTemplate {
  async createEntity(entities, userId) {
    const { client_name, care_type, timeInfo, caregiver, location } = entities;
    
    // 長照特定的創建邏輯...
    const careData = {
      caregiver_id: userId,
      client_name,
      care_type,
      scheduled_time: timeInfo.display,
      care_date: timeInfo.date,
      caregiver: caregiver || null,
      location: location || null,
      status: 'scheduled'
    };
    
    // 使用通用EntityService
    const result = await EntityService.createEntity(this.entityType, careData);
    // ...
  }
}
```

### 保險業務場景
```yaml
# config/scenarios/insurance_sales.yaml
scenario_name: "insurance_sales"
entity_type: "client_meetings"
entity_name: "會議"

required_fields: ["client_name", "meeting_type", "timeInfo"]
optional_fields: ["product_type", "location", "notes"]

messages:
  create_success: "✅ 與{client_name}的{meeting_type}會議已安排！"
```

## 🚀 部署方式

### 課程管理chatbot
```bash
SCENARIO_TYPE=course_management npm start
```

### 長照系統chatbot
```bash
SCENARIO_TYPE=healthcare_management npm start
```

### 保險業務chatbot
```bash
SCENARIO_TYPE=insurance_sales npm start
```

## ✅ 擴展新場景的步驟

1. **複製配置**：`cp config/scenarios/course_management.yaml config/scenarios/new_scenario.yaml`
2. **修改配置**：更新entity_type、entity_name、messages等
3. **實現模板類**：創建 `NewScenarioScenarioTemplate.js`
4. **設置環境變數**：`SCENARIO_TYPE=new_scenario`
5. **啟動chatbot**：`npm start`

## 🔒 架構約束

- ScenarioTemplate不得直接調用DataService/TimeService
- 每個chatbot實例只載入一個scenario，不支持切換
- 所有場景邏輯必須在ScenarioTemplate實現
- EntityService提供通用CRUD，不包含場景特定邏輯

**架構簡潔、易擴展、完全獨立部署。**