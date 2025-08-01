# System Architecture Design

## 🚑 重大架構回滾記錄 (2025-08-01)

### 🚨 緊急回滾原因
**根本問題**: 複雜的 P1-P5 證據驅動決策系統導致 bug 越修越多，用戶無法正常使用課程功能。

**原始問題**（簡單）：
- "上次Rumi的課上得怎麼樣" 被誤判為 "新增課程"
- "我記得7/31不是已經記錄過了嗎" 被誤判為 "修改課程"

**錯誤解決方案**（過度複雜）：
- 創建了 8-9 層調用鏈的 SemanticController
- 實現 P1-P5 證據驅動決策規則
- 增加了 2558+ 行複雜代碼
- 結果：引入更多 bug，系統更不穩定

### 🔄 回滾過程
**時間**: 2025-08-01 22:00-22:30  
**決策**: 立即回滾到穩定版本 `3f2f27d` (v18.5.0)

**執行步驟**:
1. `git branch feature/semantic-controller-complex` - 保存複雜版本
2. `git reset --hard 3f2f27d` - 回滾主分支
3. `git push origin feature/semantic-controller-complex` - 推送複雜版本分支
4. `git push origin main --force` - 強制推送回滾版本

### ✅ 回滾結果
**成功恢復**:
- ✅ 用戶可正常使用課程功能
- ✅ 回到簡單的 "Regex 優先 → OpenAI Fallback" 架構
- ✅ 移除了 2558+ 行複雜代碼
- ✅ 保留所有版本在 `feature/semantic-controller-complex` 分支

**維護性改善**:
- 代碼可讀性: 複雜 → 簡單
- 調試難度: 困難 → 容易
- 新功能開發: 高風險 → 低風險
- 系統穩定性: 不穩定 → 穩定

### 📝 經驗教訓
1. **複雜系統不是好系統**: 簡單問題用簡單方法解決
2. **第一性原則重要性**: 必須找到根本原因，不是直接增加複雜度
3. **過度工程化風險**: 為了解決 2 個誤判問題，創建了整個語義仲裁系統
4. **回滾策略重要性**: 保存所有版本，快速恢復服務

---

## 🏗️ Three-Layer Semantic Architecture

### Core Philosophy (簡化後)
**簡單優先架構設計** - 單一來源 + 清晰邊界 + 簡單可靠

```
User Natural Language → SemanticService → TaskService → Unified Response
```

### 🔄 簡化後的語義處理流程
```
用戶輸入 → IntentRuleEngine (Regex) → 若信心度 > 0.7 則直接返回
                ↓ (信心度 <= 0.7)
            OpenAI 語義分析 → 結果返回
```

### 🎯 簡化後的設計原則

**單一來源原則**: 每個功能只有一個入口
- ✅ 所有時間相關操作 → `TimeService`
- ✅ 所有語義操作 → `SemanticService` (簡化版)
- ✅ 所有数據操作 → `DataService`

**簡單優先**: 能用簡單方法解決的不用複雜系統
- ✅ Regex 優先，確定性高、速度快
- ✅ OpenAI 補全，處理複雜情況
- ❌ 不再使用 P1-P5 語義仲裁系統

**清晰邊界**: 禁止跨層直接調用
- ❌ Controllers 不得直接調用 OpenAI
- ❌ Services 不得直接使用 `new Date()`
- ❌ Utils 不得直接操作数据库

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
│   ├── semanticService.js           # Semantic processing unified entry ✅
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

### 📊 簡化後的架構約束 (單一來源原則)

| 域 | 唯一入口 | 職責 | 禁止事項 |
|--------|-------------|----------------|-------------------|
| **場景層** | `ScenarioTemplate` | 業務邏輯實現 | ❌ 直接調用 DataService |
| **語義處理** | `SemanticService` (簡化版) | 意圖+實體+上下文 | ❌ 直接調用 OpenAI/規則引擎 |
| **實體操作** | `EntityService` | 通用 CRUD + 驗證 | ❌ 直接調用 Firebase |
| **時間處理** | `TimeService` | 解析+格式化+計算+驗證 | ❌ 直接使用 `new Date()` |
| **數據處理** | `DataService` | 存取+查詢+格式化 | ❌ 直接調用 Firebase |
| **任務執行** | `TaskService` | 場景委託協調 | ❌ 硬編碼業務邏輯 |

### ❌ 已移除的複雜組件
- `SemanticController` (P1-P5 證據驅動決策系統)
- 複雜的語義仲裁機制
- 多層決策路徑追蹤
- 增強版語義標準化器
- 監控中間件

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