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
## 🐛 Bug 調試流程

### 當用戶報告 chatbot bug 時，立即執行以下調試步驟：

#### 1. **查詢應用程序日誌**
```bash
# 基本查詢（最近50條）
./scripts/get-app-logs.sh 50

# 搜索特定關鍵詞
./scripts/get-app-logs.sh 30 "用戶輸入內容"

# 查找錯誤日誌
./scripts/get-app-logs.sh 50 "ERROR"

# 查找特定功能
./scripts/get-app-logs.sh 30 "課表"
```

#### 2. **Render CLI 配置信息**
- **已安裝**: `brew install render`
- **已登錄**: 工作空間 `tea-d1otdn7fte5s73bnf3k0`
- **服務ID**: `srv-d21f9u15pdvs73frvns0`
- **配置文件**: `~/.render/cli.yaml`

#### 3. **常見調試場景**
```bash
# 語義解析問題
./scripts/get-app-logs.sh 50 "SemanticService"

# 時間處理問題  
./scripts/get-app-logs.sh 30 "TimeService"

# 課程操作問題
./scripts/get-app-logs.sh 40 "CourseManagement"

# API調用問題
./scripts/get-app-logs.sh 50 "POST"
```

#### 4. **用戶報告模板**
用戶可以這樣報告bug：
```
我剛輸入"XXX"但返回結果不對，查render日誌分析問題
```

#### 5. **調試後續流程**
1. 分析日誌找出問題根源
2. 定位相關代碼文件  
3. 修復代碼邏輯
4. 更新 CHANGELOG.md
5. 推送到 git (必須先更新changelog.md)

---
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

### 用戶輸入處理流程 (User Input Processing Flow)

1.  **接收用戶輸入 (Receive User Input)**: `lineController` 接收來自 Line Platform 的 Webhook 事件。
2.  **上下文加載 (Load Context)**: `conversationContext` 模組負責從 Firestore 加載或初始化用戶的對話上下文。
3.  **場景路由 (Scenario Routing)**: `ScenarioManager` 根據意圖規則 (`intent-rules.yaml`) 和對話歷史，決定當前的對話場景 (Scenario)。
4.  **語義適配 (Semantic Adaptation)**: `semanticAdapter` 對用戶輸入進行預處理，提取潛在的實體，並將其轉換為標準化的數據結構，以便進行槽位填充。
5.  **槽位狀態管理 (Slot State Management)**: `slotStateManager` 接收 `semanticAdapter` 的輸出，更新當前場景的槽位狀態 (Slot State)。這包括填充新槽位、確認已有槽位或標記需要澄清的槽位。
6.  **問題檢測 (Problem Detection)**: `slotProblemDetector` 檢查當前槽位是否存在問題，例如信息模糊、衝突或缺失。如果檢測到問題，會生成一個需要用戶澄清的內部狀態。
7.  **任務觸發 (Task Triggering)**: `taskTrigger` 根據 `slot-templates` 中定義的規則，檢查槽位是否滿足觸發後端任務的條件。
8.  **任務執行 (Task Execution)**: 如果觸發條件滿足，`taskService` 會調用相應的後端服務 (例如 `courseService` 或 `dataService`) 來執行業務邏輯。
9.  **人類提示生成 (Human Prompt Generation)**: `humanPromptGenerator` 根據 `slotStateManager` 的當前狀態、`slotProblemDetector` 的檢測結果以及 `taskService` 的執行結果，生成一個自然、易於理解的文字回應給用戶。
10. **回應發送 (Send Response)**: `lineService` 將生成的回應通過 Line Messaging API 發送給用戶。

### 🚨 多輪對話增強 (Multi-Turn Dialog Enhancement)

**新增處理步驟**：

11. **補充信息檢測 (Supplement Intent Detection)**: `tempSlotStateManager` 檢測用戶輸入是否為對之前未完成任務的補充信息。
12. **暫存狀態管理 (Temporary State Management)**: 當檢測到單一問題時，創建暫存狀態等待用戶補充信息。
13. **智能分離處理 (Intelligent Separation)**: `slotProblemDetector` 檢測並分離混雜的槽位內容，重新處理分離後的結果。
14. **問題策略處理 (Problem Strategy Handling)**: 根據問題數量（0個、1個、多個）採用不同的處理策略：
    - **0個問題**: 直接執行任務
    - **1個問題**: 創建暫存狀態並生成單一問題提示
    - **多個問題**: 要求用戶重新輸入完整信息

### 🔄 處理流程優化

**第一性原則處理**：
- **純時間輸入攔截**: 拒絕處理無意義的純時間輸入（如「明天下午四點」），避免系統資源浪費
- **規則引擎優先**: 高信心度意圖使用規則引擎處理（60-70%案例，毫秒級響應）
- **AI後備機制**: 低信心度意圖調用OpenAI進行深度理解（30-40%案例）
- **統一狀態管理**: 不管單一還是多個問題，都使用相同的暫存機制

**效能統計**：
| 處理層級 | 案例比例 | 響應時間 | 準確率 | 成本 |
|---------|---------|----------|--------|------|
| **純時間攔截** | ~5% | <1ms | 100% | 免費 |
| **規則引擎** | ~60-70% | <10ms | 100% | 免費 |
| **OpenAI處理** | ~30-40% | 200-500ms | 95%+ | 付費 |

### 核心概念 (Core Concepts)

#### 📋 詳細處理步驟

**Step 0: 純時間檢測攔截**
```javascript
// 攔截無意義的純時間輸入，避免系統資源浪費
detectPureTimeInput("明天下午四點") → 直接拒絕
detectPureTimeInput("明天下午四點跆拳道") → 通過檢測，繼續處理
```

**Step 1: 規則引擎智能打分**
```javascript
// IntentRuleEngine 基於配置進行意圖識別
IntentRuleEngine.analyzeIntent("取消數學課")
→ { intent: 'cancel_course', confidence: 0.8 }

IntentRuleEngine.analyzeIntent("我想學點什麼")  
→ { intent: 'unknown', confidence: 0.0 }
```

**Step 2: 統一實體提取**
```javascript
// OpenAI優先的實體提取，正則表達式fallback
SemanticService.extractCourseEntities("明天下午四點半跆拳道")
→ { course_name: "跆拳道", timeInfo: {...}, location: null }
```

**Step 3: 關鍵信心度測試**
```javascript
// 智能判斷：高信心度跳過AI，低信心度調用AI
if (ruleResult.confidence >= 0.8 && intent !== 'unknown') {
  return 規則引擎結果;  // 60-70% 案例，毫秒級響應
} else {
  return await OpenAI.analyzeIntent();  // 30-40% 案例，深度理解
}
```

**Step 4: Slot Template 處理 (可選)**
```javascript
// 如果啟用 Slot Template System
if (enableSlotTemplate) {
  return await SlotTemplateManager.processWithProblemDetection(userId, semanticResult);
} else {
  return semanticResult; // 標準處理
}
```

#### 🎯 處理效率統計

| 處理層級 | 案例比例 | 響應時間 | 準確率 | 成本 |
|---------|---------|----------|--------|------|
| **純時間攔截** | ~5% | <1ms | 100% | 免費 |
| **規則引擎** | ~60-70% | <10ms | 100% | 免費 |
| **OpenAI處理** | ~30-40% | 200-500ms | 95%+ | 付費 |
| **Slot Template** | ~20-30% | 100-300ms | 98%+ | 中等 |

#### 💡 設計優勢

**效能最佳化**：
- ✅ 70%請求毫秒級響應（規則引擎處理）
- ✅ AI調用量減少70%，大幅降低成本
- ✅ 系統資源使用最小化
- ✅ 多輪對話智能補全，減少用戶重複輸入

**準確性保證**：
- ✅ 確定性意圖100%準確識別
- ✅ 複雜語義交由AI深度理解
- ✅ 分層fallback確保穩定性
- ✅ 智能問題檢測和分離處理

**可維護性**：
- ✅ 規則配置化，易於調整優化
- ✅ 清晰的處理邊界和職責分離
- ✅ 完整的日誌追蹤和性能監控
- ✅ 模組化Slot Template系統，支援場景擴展

---

## 🏗️ 未來技術架構

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
# 真實內容儲存在本地的 .env，不推上git

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

---
## 長期規劃
【IntentOS 未來技術擴展計畫：RLHF 戰略對接】

為提升語意任務系統在真實場景中的對話控制精準度與任務對齊度，IntentOS 將設計語意偏好記錄模組，包含任務輸入語句、用戶後續修正行為、任務完成情形等資料結構，並保留訓練 Reward Model 與微調語言模型的資料路徑。當產品驗證達成後，將尋求與熟悉 RLHF 技術的研究團隊進行合作，基於真實語意任務歷程資料，建立特定場景下的人類偏好模型（Reward Model），進行低成本對齊微調與語意控制優化。