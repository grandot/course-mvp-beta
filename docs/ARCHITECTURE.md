# System Architecture Design

## 🏗️ Three-Layer Semantic Architecture

### Core Philosophy
**Separation-based Architecture Design** - Single Source of Truth + Forced Boundaries

```
User Natural Language → Semantic Layer → Time Layer → Task Execution Layer → Unified Response
```

### System Design Principles

**Single Source of Truth**: Each functionality has only one unique entry point
- ✅ All time-related operations → `TimeService`
- ✅ All semantic operations → `SemanticController` (P1-P5 證據驅動決策)
- ✅ All data operations → `DataService`

**Forced Boundaries**: Enforce boundary constraints through technical means
- ✅ ESLint rules prohibit cross-layer calls
- ✅ Module encapsulation hides internal implementation
- ✅ Interface contracts define clear responsibility boundaries

**No Cross-Layer Access**: Prohibit direct cross-layer calls
- ❌ Controllers must not directly call OpenAI
- ❌ Services must not directly use `new Date()`
- ❌ Utils must not directly operate database

### 🎯 SemanticController 證據驅動決策機制

**核心理念**: 不依賴簡單分數比較，而是基於**邏輯推理**的證據質量分析

```
用戶語句 → [AI分析 + Regex分析] → 證據驅動仲裁 → 最終決策
```

**P1-P5 決策優先級** (詳細說明):

#### P1: 語氣與意圖衝突檢測 (最高優先級)
**觸發條件**: 用戶語句含疑問語氣，但Regex判斷為新增意圖
**實例**: "上次Rumi的課怎麼樣" → Regex誤判為新增課程，但含疑問詞"怎麼樣"  
**決策邏輯**: 疑問語氣與新增操作邏輯矛盾，採用AI分析結果
**採用來源**: AI (通常識別為查詢意圖)

#### P2: 時間線索存在
**觸發條件**: 語句含時間回顧詞且Regex無法理解時序
**實例**: "昨天的數學課記錄了嗎" → 含"昨天"時序詞，指向過去事件查詢
**決策邏輯**: Regex無法理解時間語境，AI能做時序推理
**採用來源**: AI (基於時間線索做語境判斷)

#### P3: AI推理鏈完整
**觸發條件**: AI推理步驟≥3且整體信心度>0.8
**實例**: AI提供"識別動作詞→分析語氣→結合上下文→得出意圖"完整推理鏈
**決策邏輯**: 推理鏈完整表示AI深度理解語義，可信度高
**採用來源**: AI (基於完整邏輯推理)

#### P4: Regex強匹配
**觸發條件**: Regex匹配強度>0.9且無歧義詞，AI信心度<0.7
**實例**: "清空課表" → 精確匹配，無歧義，AI反而不確定
**決策邏輯**: 簡潔明確的指令適合確定性Regex處理
**採用來源**: Regex (強匹配且無歧義)

#### P5: 默認保守策略
**觸發條件**: 前述規則均未命中
**決策邏輯**: 避免Regex硬規則誤判，預設採用AI的語義理解
**採用來源**: AI (保守策略，避免錯誤猜測)

**決策示例**:
| 用戶輸入 | P1-P5檢查結果 | 最終決策 | 採用原因 |
|----------|---------------|----------|----------|
| "上次Rumi的課怎麼樣" | P1命中 | AI: query_course | 疑問語氣與新增衝突 |
| "7/31我不是記錄了嗎" | P1命中 | AI: query_course | 確認性疑問與新增衝突 |
| "清空課表" | P4命中 | Regex: clear_schedule | 強匹配無歧義 |
| "今天科學課很棒" | P3命中 | AI: record_course | 推理鏈完整(陳述→記錄) |

**Fallback機制**: 雙重失效時返回 `unknown` + 澄清建議，避免錯誤猜測

**智能分流機制** (SemanticController 內部實現):
```javascript
// ✅ 封裝在 SemanticController 內部的智能分流
// 1. Regex 優先判斷 (IntentRuleEngine) 
// 2. 信心度 > 0.7 → 瞬間響應 <50ms
// 3. 信心度 ≤ 0.7 → OpenAI Fallback 200-500ms

// ❌ 禁止外部直接調用分流組件
const ruleResult = IntentRuleEngine.analyzeIntent(text); // 禁止
const openaiResult = await OpenAI.analyzeIntent(text);   // 禁止
```

**第一性原則**: 確定性操作用確定性方法(Regex)，模糊操作才用智能推理(OpenAI)  
**架構約束**: 分流邏輯封裝在 SemanticController 內部，外部統一調用 `SemanticController.analyze()`

## 🎯 Scenario Layer Architecture (v9.0)

### Template-Based Multi-Scenario Business Platform
Transform from single course management system to universal multi-scenario platform

```
User Natural Language → Semantic Layer → Scenario Layer → EntityService → Unified Response
```

### Project Structure (Scenario-Based Architecture)
```
src/
├── controllers/lineController.js     # Request handling layer ✅
├── scenario/                         # 🆕 Scenario Layer core
│   ├── ScenarioTemplate.js          # Abstract base class - unified scenario interface
│   ├── ScenarioFactory.js           # Factory class - dynamic scenario loading
│   └── templates/                   # Scenario template implementations
│       ├── CourseManagementScenarioTemplate.js    # Course management
│       ├── HealthcareManagementScenarioTemplate.js # Healthcare system
│       └── InsuranceSalesScenarioTemplate.js      # Insurance business
├── services/
│   ├── semanticController.js        # 🎯 語義分析唯一入口 (P1-P5證據驅動決策) ✅
│   ├── enhancedSemanticService.js   # SemanticController 內部語義處理服務
│   ├── dataService.js               # Data processing unified entry ✅
│   ├── entityService.js             # 🆕 Universal entity CRUD service
│   └── taskService.js               # 🔄 Refactored to instance-based delegation pattern
├── utils/
│   ├── timeService.js               # Time processing unified entry ✅
│   ├── intentRuleEngine.js          # Rule engine implementation
│   ├── conversationContext.js       # Conversation context manager
│   └── [other utilities...]
├── config/
│   ├── intent-rules.yaml            # Intent rule configuration
│   └── scenarios/                   # 🆕 Scenario configuration files
│       ├── course_management.yaml   # Course management config
│       ├── healthcare_management.yaml # Healthcare system config
│       └── insurance_sales.yaml     # Insurance business config
└── internal/                        # Low-level implementation
    ├── openaiService.js             # OpenAI call implementation
    ├── firebaseService.js           # Firebase operation implementation
    └── lineService.js               # LINE API implementation
```

## 🚀 Independent WebService Deployment Mode

**Core Principle**: Each chatbot is a completely independent webservice containing only one business scenario

### Independent WebService Instances
```
Course Management Chatbot:
- Deploy URL: render.com/course-bot
- Environment: SCENARIO_TYPE=course_management  
- LINE Bot Setup: Connect to course management webhook
- Load Only: Course management config + templates + related dependencies
- Memory Usage: Minimized, contains only course logic

Healthcare System Chatbot:
- Deploy URL: render.com/healthcare-bot
- Environment: SCENARIO_TYPE=healthcare_management
- LINE Bot Setup: Connect to healthcare system webhook
- Load Only: Healthcare system config + templates + related dependencies
- Completely Independent: No sharing with course system

Insurance Business Chatbot:
- Deploy URL: render.com/insurance-bot
- Environment: SCENARIO_TYPE=insurance_sales
- LINE Bot Setup: Connect to insurance business webhook
- Load Only: Insurance business config + templates + related dependencies
- Independent Scaling: Can adjust resources independently based on business needs
```

## 🔧 Unified Service Layer Architecture

### Separation Architecture Constraints (Single Source of Truth)

| Domain | Unique Entry | Responsibility | Prohibited Actions |
|--------|-------------|----------------|-------------------|
| **Scenario Layer** | `ScenarioTemplate` | Business logic implementation | ❌ Direct DataService calls |
| **Semantic Analysis** | `SemanticController` | P1-P5 證據驅動決策 (AI+Regex仲裁) | ❌ 外部直接調用 EnhancedSemanticService |
| **Entity Operations** | `EntityService` | Universal CRUD + Validation | ❌ Direct Firebase calls |
| **Time Processing** | `TimeService` | Parse+Format+Calculate+Validate | ❌ Direct `new Date()` usage |
| **Data Processing** | `DataService` | Store+Query+Format | ❌ Direct Firebase calls |
| **Task Execution** | `TaskService` | Scenario delegation coordination | ❌ Hardcoded business logic |

## 📊 Database Design (Firebase Firestore)

### courses Collection
```javascript
{
  student_id: "LINE User ID",
  course_name: "Course Name", 
  child_name: "Child Name", // 🎯 Multi-child support
  schedule_time: "Time Description",
  course_date: "2025-07-23",         // YYYY-MM-DD
  is_recurring: false,               // Recurring course flag
  recurrence_pattern: "weekly",      // daily/weekly
  location: "Location",
  teacher: "Teacher",
  status: "scheduled"                // scheduled/completed/cancelled
}
```

### token_usage Collection (Cost Control)
```javascript
{
  user_id: "LINE User ID",
  model: "gpt-3.5-turbo",
  total_tokens: 2280,
  total_cost_twd: 0.11,              // Cost in TWD
  user_message: "Original Message",
  timestamp: "ISO Timestamp"
}
```

For more detailed information, please refer to the respective documentation files.