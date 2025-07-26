# IntentOS Course MVP - 三層語義架構系統

## 🎯 核心理念

**分離式架構設計** - Single Source of Truth + Forced Boundaries

```
用戶自然語言 → 語義處理層 → 時間處理層 → 任務執行層 → 統一格式回覆
```

### 🔒 強制性分離架構

| 功能域 | 唯一入口 | 職責 | 禁止事項 |
|-------|---------|------|---------|
| **語義處理** | `SemanticService` | 意圖+實體+上下文 | ❌ 直接調用 OpenAI/規則引擎 |
| **時間處理** | `TimeService` | 解析+格式化+計算+驗證 | ❌ 直接使用 `new Date()` |
| **數據處理** | `DataService` | 存取+查詢+格式化 | ❌ 直接調用 Firebase |
| **任務執行** | `TaskService` | 業務邏輯協調 | ❌ 跨域直接調用 |

### 🏗️ 系統性設計原則

**Single Source of Truth**：每種功能只有一個唯一入口
- ✅ 所有時間相關 → `TimeService`
- ✅ 所有語義相關 → `SemanticService`  
- ✅ 所有數據相關 → `DataService`

**Forced Boundaries**：通過技術手段強制邊界約束
- ✅ ESLint 規則禁止跨層調用
- ✅ 模組封裝隱藏內部實現
- ✅ 接口契約明確職責邊界

**No Cross-Layer Access**：禁止跨層直接調用
- ❌ Controllers 不得直接調用 OpenAI
- ❌ Services 不得直接使用 `new Date()`
- ❌ Utils 不得直接操作數據庫

### 💡 分離式架構實現

**SemanticService（語義處理唯一入口）**：
```javascript
class SemanticService {
  static async analyzeMessage(text, context) {
    // 內部協調：規則引擎 + OpenAI + 上下文分析
    // 外部接口：統一的語義分析結果
  }
  
  static async extractCourse(text) {
    // 專門的課程名稱提取
  }
  
  static async extractTime(text) {
    // 專門的時間信息提取
  }
}
```

**TimeService（時間處理唯一入口）**：
```javascript
class TimeService {
  static getCurrentUserTime() {
    // 替換所有 new Date() 使用
  }
  
  static parseTimeString(str, referenceTime) {
    // 統一的時間解析入口
  }
  
  static formatForDisplay(time, format) {
    // 統一的時間格式化入口
  }
}
```

**DataService（數據處理唯一入口）**：
```javascript
class DataService {
  static async saveCourse(courseData) {
    // 統一的數據存儲入口
  }
  
  static async queryCourses(criteria) {
    // 統一的數據查詢入口
  }
}
```

### 🧠 Ultra-Hard 設計原則

**第一性原則**：確定性問題用規則，複雜性問題用AI
```javascript
// ✅ 正確：確定性意圖用規則匹配
"取消試聽" → IntentRuleEngine → cancel_course (100% 準確)

// ✅ 正確：複雜語義用 AI 理解
"我想學點什麼" → OpenAI → 模糊意圖 + 上下文分析

// ❌ 錯誤：讓 AI 做確定性工作
"取消試聽" → OpenAI → record_course (錯誤識別)
```

**剃刀法則**：能用簡單規則解決的，不用複雜AI
```yaml
# 配置驅動：視覺化、可維護
cancel_course:
  keywords: ['取消', '刪除']
  priority: 10
  
# 而非代碼硬編碼
if (message.includes('取消')) return 'cancel_course'
```

---

## 🏗️ 技術架構

### 核心技術棧
```
LINE Bot → Express.js → Scenario Layer → EntityService → Firebase Firestore
                 ↓
              OpenAI GPT-3.5 + YAML Config + TimeService
```

### 🎯 Scenario Layer 架構 (v9.0 - 2025-07-26)

**Template-Based 多場景業務平台**：從單一課程管理系統轉換為通用多場景平台

```
用戶自然語言 → 語義處理層 → Scenario Layer → EntityService → 統一格式回覆
```

#### 專案結構（Scenario-Based 架構）
```
src/
├── controllers/lineController.js     # 請求接收層 ✅
├── scenario/                         # 🆕 Scenario Layer 核心
│   ├── ScenarioTemplate.js          # 抽象基類 - 統一場景接口
│   ├── ScenarioFactory.js           # 工廠類 - 動態加載場景
│   └── templates/                   # 場景模板實現
│       ├── CourseManagementScenarioTemplate.js    # 課程管理
│       ├── HealthcareManagementScenarioTemplate.js # 長照系統
│       └── InsuranceSalesScenarioTemplate.js      # 保險業務
├── services/
│   ├── semanticService.js           # 語義處理統一入口 ✅
│   ├── dataService.js               # 數據處理統一入口 ✅
│   ├── entityService.js             # 🆕 通用實體 CRUD 服務
│   └── taskService.js               # 🔄 重構為 instance-based 委託模式
├── utils/
│   ├── timeService.js               # 時間處理統一入口 ✅
│   ├── intentRuleEngine.js          # 規則引擎實現
│   ├── conversationContext.js       # 會話上下文管理器
│   └── [其他工具...]
├── config/
│   ├── intent-rules.yaml            # 意圖規則配置
│   └── scenarios/                   # 🆕 場景配置文件
│       ├── course_management.yaml   # 課程管理配置
│       ├── healthcare_management.yaml # 長照系統配置
│       └── insurance_sales.yaml     # 保險業務配置
└── internal/                        # 底層實現
    ├── openaiService.js             # OpenAI 調用實現
    ├── firebaseService.js           # Firebase 操作實現
    └── lineService.js               # LINE API 實現
```

### 🏗️ Scenario Layer 核心設計

#### ScenarioTemplate 抽象基類
```javascript
class ScenarioTemplate {
  constructor(config) {
    this.config = config;
    this.entityType = config.entity_type;
    this.entityName = config.entity_name;
  }

  // 統一業務接口 - 所有場景必須實現
  async createEntity(entities, userId) { throw new Error('Must implement'); }
  async modifyEntity(entities, userId) { throw new Error('Must implement'); }
  async cancelEntity(entities, userId) { throw new Error('Must implement'); }
  async queryEntities(entities, userId) { throw new Error('Must implement'); }
  async clearAllEntities(userId) { throw new Error('Must implement'); }

  // 通用工具方法 - 統一實現
  formatMessage(template, variables) { /* 統一訊息格式化 */ }
  formatConfigMessage(messageKey, variables) { /* 配置驅動訊息 */ }
  validateRequiredFields(entities) { /* 統一欄位驗證 */ }
  createSuccessResponse(message, data) { /* 統一成功回應 */ }
  createErrorResponse(error, message, details) { /* 統一錯誤回應 */ }
}
```

#### ScenarioManager 單例模式（性能優化）
```javascript
class ScenarioManager {
  // 🎯 啟動時一次性預加載當前場景
  static async initialize() {
    const scenarioType = process.env.SCENARIO_TYPE || 'course_management';
    console.log(`🏭 [ScenarioManager] Initializing single scenario: ${scenarioType}`);
    
    // 只加載當前部署場景，不加載其他場景
    await this.preloadScenario(scenarioType);
    this.currentScenarioType = scenarioType;
    
    console.log(`✅ [ScenarioManager] Initialized scenario "${scenarioType}" in 3ms`);
    console.log(`🎯 WebService mode: Single scenario deployment`);
  }

  // 🎯 獲取當前場景實例（O(1) 查找，無文件 I/O）
  static getCurrentScenario() {
    return this.scenarios.get(this.currentScenarioType);
  }

  // 🔒 安全檢查：禁止獲取未加載的場景
  static getScenario(scenarioType) {
    if (scenarioType !== this.currentScenarioType) {
      throw new Error(`Scenario "${scenarioType}" not available in this webservice. Current: "${this.currentScenarioType}"`);
    }
    return this.scenarios.get(scenarioType);
  }
}
```

#### TaskService 委託架構（優化版）
```javascript
// 原版：static methods with hardcoded course logic
class TaskService {
  static async executeIntent(intent, entities, userId) {
    // hardcoded course management logic
  }
}

// 重構版：instance-based with scenario delegation + 性能優化
class TaskService {
  constructor() {
    // ⚡ 使用預加載的場景實例，避免重複創建和文件 I/O
    this.scenario = ScenarioManager.getCurrentScenario();
  }
  
  async executeIntent(intent, entities, userId) {
    // 純委託模式 - 所有業務邏輯委託給 Scenario Template
    const intentMethodMap = {
      'record_course': 'createEntity',
      'modify_course': 'modifyEntity',
      'cancel_course': 'cancelEntity',
      'query_courses': 'queryEntities',
      'clear_courses': 'clearAllEntities'
    };
    
    return this.scenario[intentMethodMap[intent]](entities, userId);
  }
}
```

### 📁 Configuration-Driven 設計

#### 場景配置結構 (YAML)
```yaml
# config/scenarios/course_management.yaml
scenario_name: "course_management"
entity_type: "courses"                    # Firebase 集合名稱
entity_name: "課程"                       # 顯示名稱
required_fields: ["course_name", "timeInfo"]

# 訊息模板
messages:
  create_success: "✅ {entity_name}「{course_name}」已成功新增！\n🕒 時間：{schedule_time}"
  modify_success: "✅ {entity_name}「{course_name}」時間已修改為 {schedule_time}"
  cancel_success: "✅ {entity_name}「{course_name}」已取消"
  
# 業務規則
business_rules:
  create:
    allow_duplicate_names: false
    auto_generate_missing_fields: true
  modify:
    allowed_fields: ["schedule_time", "course_date", "location", "teacher"]
    conflict_resolution: "time_priority"
  cancel:
    confirmation_required: false
    soft_delete: true

# 驗證規則
validation_rules:
  time_conflict_check: true
  name_format_check: true
  
# 場景特定配置
course_specific:
  course_types: ["學科", "才藝", "語言", "運動"]
  time_slots: ["上午", "下午", "晚上"]
```

### 🚀 獨立 WebService 部署模式

**核心原則**：每個 chatbot 是完全獨立的 webservice，只包含一個業務場景

#### 獨立 WebService 實例
```
課程管理 Chatbot:
- 部署地址: render.com/course-bot
- 環境變數: SCENARIO_TYPE=course_management  
- LINE Bot 設定: 連接到課程管理 webhook
- 只加載: 課程管理配置 + 模板 + 相關依賴
- 內存佔用: 最小化，只包含課程邏輯

長照系統 Chatbot:
- 部署地址: render.com/healthcare-bot
- 環境變數: SCENARIO_TYPE=healthcare_management
- LINE Bot 設定: 連接到長照系統 webhook
- 只加載: 長照系統配置 + 模板 + 相關依賴
- 完全獨立: 與課程系統無任何共享

保險業務 Chatbot:
- 部署地址: render.com/insurance-bot
- 環境變數: SCENARIO_TYPE=insurance_sales
- LINE Bot 設定: 連接到保險業務 webhook
- 只加載: 保險業務配置 + 模板 + 相關依賴
- 獨立擴展: 可根據業務需求獨立調整資源
```

#### 單場景載入實現
```javascript
// 🎯 每個 webservice 實例啟動時
🏭 [ScenarioManager] Initializing single scenario: course_management
✅ [ScenarioManager] Initialized scenario "course_management" in 3ms
🎯 WebService mode: Single scenario deployment

// 🚫 不會加載其他場景的任何配置或代碼
// 課程管理 bot 完全不知道長照和保險場景的存在
```

#### 微服務架構優勢
- ✅ **資源隔離**: 課程 bot 不佔用長照/保險的內存和配置
- ✅ **安全隔離**: 不同業務場景數據完全分離
- ✅ **故障隔離**: 一個場景故障不影響其他場景
- ✅ **獨立擴展**: 根據各場景負載獨立調整實例數量
- ✅ **技術隔離**: 不同場景可使用不同的技術栈版本

#### 場景功能示例
```javascript
// 課程管理 Chatbot (course-bot)
"數學課明天下午2點" → CourseManagementScenarioTemplate.createEntity()
→ "✅ 課程「數學課」已成功新增！🕒 時間：07/27 2:00 PM"

// 長照系統 Chatbot (healthcare-bot)  
"王奶奶復健治療明天下午2點" → HealthcareManagementScenarioTemplate.createEntity()
→ "✅ 王奶奶的復健治療已安排完成！🕒 時間：07/27 2:00 PM"

// 保險業務 Chatbot (insurance-bot)
"張先生產品介紹明天下午2點" → InsuranceSalesScenarioTemplate.createEntity() 
→ "✅ 與張先生的產品介紹會議已安排！🕒 時間：07/27 2:00 PM"
```

#### 擴展新場景流程
1. **創建配置**: 複製 `config/scenarios/template.yaml` 為新場景配置
2. **實現模板**: 繼承 `ScenarioTemplate` 實現業務邏輯
3. **獨立部署**: 設置 `SCENARIO_TYPE=new_scenario` 部署新實例
4. **LINE 整合**: 創建新的 LINE Bot 連接到新實例
5. **完全隔離**: 新場景與現有場景完全獨立運行

### 🔧 統一服務層架構

#### EntityService - 通用實體操作
```javascript
class EntityService {
  // 通用 CRUD 操作 - 支持所有實體類型
  static async createEntity(entityType, entityData) {
    // 統一創建邏輯 + 時間戳 + 數據驗證
  }
  
  static async updateEntity(entityType, entityId, updateData) {
    // 統一更新邏輯 + 衝突檢查
  }
  
  static async queryEntities(entityType, criteria) {
    // 統一查詢邏輯 + 過濾排序
  }
  
  static async checkTimeConflicts(entityType, userId, date, time, excludeId) {
    // 統一時間衝突檢查
  }
}
```

#### 分離式架構約束 (Single Source of Truth)

| 功能域 | 唯一入口 | 職責 | 禁止事項 |
|-------|---------|------|---------|
| **Scenario Layer** | `ScenarioTemplate` | 業務邏輯實現 | ❌ 直接調用 DataService |
| **語義處理** | `SemanticService` | 意圖+實體+上下文 | ❌ 直接調用 OpenAI/規則引擎 |
| **實體操作** | `EntityService` | 通用 CRUD + 驗證 | ❌ 直接調用 Firebase |
| **時間處理** | `TimeService` | 解析+格式化+計算+驗證 | ❌ 直接使用 `new Date()` |
| **數據處理** | `DataService` | 存取+查詢+格式化 | ❌ 直接調用 Firebase |
| **任務執行** | `TaskService` | 場景委託協調 | ❌ 硬編碼業務邏輯 |

### 🎯 配置驅動意圖處理

#### 意圖規則配置 (`intent-rules.yaml`)
```yaml
# 糾錯意圖 (最高優先級)
correction_intent:
  keywords: ['不對', '錯了', '不是', '改成']
  priority: 15
  requires_context: true

# 課程操作意圖
cancel_course:
  keywords: ['取消', '刪除', '移除', '不要', '不上']
  priority: 10
  exclusions: ['新增', '安排', '預約']
  
record_course:
  keywords: ['新增', '安排', '預約', '上課', '學習', '有']
  priority: 5
  exclusions: ['取消', '刪除', '不要']
```

### 資料庫設計 (Firebase Firestore)

#### courses 集合
```javascript
{
  student_id: "LINE User ID",
  course_name: "課程名稱", 
  schedule_time: "時間描述",
  course_date: "2025-07-23",         // YYYY-MM-DD
  is_recurring: false,               // 重複課程標記
  recurrence_pattern: "weekly",      // daily/weekly
  location: "地點",
  teacher: "老師",
  status: "scheduled"                // scheduled/completed/cancelled
}
```

#### token_usage 集合 (成本控制)
```javascript
{
  user_id: "LINE User ID",
  model: "gpt-3.5-turbo",
  total_tokens: 2280,
  total_cost_twd: 0.11,              // 新台幣成本
  user_message: "原始訊息",
  timestamp: "ISO 時間"
}
```

---

## 🚀 部署與環境

### 環境變數
```env
# OpenAI
OPENAI_API_KEY=your_key

# Firebase  
FIREBASE_PROJECT_ID=your_project
FIREBASE_PRIVATE_KEY=your_key
FIREBASE_CLIENT_EMAIL=your_email

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# 管理後台
ADMIN_KEY=course-admin-2024
BASIC_AUTH_USER=grandot
BASIC_AUTH_PASS=your_password
```

### 開發指令
```bash
npm install          # 安裝依賴
npm run dev         # 開發模式 (熱重載)
npm start           # 生產部署
npm test            # 測試
```

### 部署平台
- **Render** (主要): 自動部署，支援環境變數
- **Vercel** (備選): Serverless 部署
- **Heroku** (支援): 傳統 PaaS 部署

---

## 📊 功能特色

### 智能課程管理
- **自然語言輸入**：「我明天下午2點有英文課」
- **多課程批量處理**：「數學課每週一，英文課每週三」
- **時間智能解析**：支援相對時間、重複課程、中文數字

### 統一時間格式
**所有功能統一顯示**：`MM/DD HH:MM AM/PM`
- 新增課程：`🕒 時間：07/25 2:00 PM`
- 修改課程：`🕒 時間：07/25 2:00 PM`
- 查詢課表：`🕒 07/25 2:00 PM`
- 取消課程：`🕒 時間：07/25 2:00 PM`

### 成本控制與監控
- **Token 使用統計**：即時成本計算
- **安全管理後台**：多層防護，數據導出
- **自動刷新**：30秒間隔數據更新

### 提醒系統
- **課前提醒**：「數學課前10分鐘提醒我」
- **課程開始**：「英文課開始時提醒我」
- **課後提醒**：「物理課結束後提醒我」

---

## 🚀 MVP 開發規則

### 快速原型優先原則
**目標：快速驗證核心功能，優先用戶體驗**

- ✅ **專注核心功能**：課程管理、自然語言處理、LINE Bot 集成
- ✅ **直接部署驗證**：Render 生產環境直接測試
- ❌ **暫不實施**：CI/CD pipeline、測試環境、自動化測試
- ❌ **暫不實施**：單元測試、集成測試、端到端測試

### MVP 階段開發流程
```
功能開發 → 本地驗證 → 直接部署 → 生產測試 → 用戶反饋 → 快速迭代
```

**重要提醒**：
- 🎯 **MVP 階段重點**：功能完整性、用戶體驗、系統穩定性
- 🎯 **測試策略**：手動測試 + 生產環境驗證
- 🎯 **質量保證**：代碼審查 + 架構約束 + ESLint 規則

---

## 🛠️ 故障排除

### 常見問題

#### 1. OpenAI API 錯誤
```bash
# 檢查 API Key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

#### 2. Firebase 連接問題
```bash
# 檢查服務帳號金鑰
echo $FIREBASE_PRIVATE_KEY | head -c 50
```

#### 3. LINE API 錯誤  
```bash
# 檢查 Channel Access Token
curl -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
     https://api.line.me/v2/bot/info
```

### 日誌查看
```bash
# 本地開發
npm run dev

# Render 部署
# Dashboard → 服務 → Logs

# Vercel 部署  
vercel logs
```

---

## 📝 修改日誌

詳細修改記錄請參考：[CHANGELOG.md](./CHANGELOG.md)

---

**注意**: 此版本採用三層語義架構設計，透過配置驅動的參數提取引擎，實現了更清晰的職責分離和更高的可維護性。每一層都有明確的輸入輸出介面，便於獨立開發、測試和優化。

## 代碼與註釋寫作規範

### 禁止使用的誇張形容詞
-  "革命性升級" →  "架構重構"
-  "大幅提升" →  "性能優化"  
-  "顯著改善" →  "功能改進"
-  "巨大突破" →  "重要更新"
-  "驚人效果" →  "明顯改善"

### 推薦的技術描述
- 使用具體的技術術語
- 描述實際的改進效果
- 避免主觀評價詞彙
- 保持客觀和專業性

### 寫作原則
1. **客觀性**：描述事實而非主觀評價
2. **具體性**：使用具體的技術指標
3. **簡潔性**：避免冗長和誇張的表達
4. **專業性**：使用標準的技術術語