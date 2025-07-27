---
title: Project Structure & Organization
description: "定義項目的目錄結構、文件組織和命名約定"
inclusion: always
---

# 項目結構與組織規範 - IntentOS Course MVP

## 項目根目錄結構

```
course-mvp-beta/
├── .ai-rules/              # AI 助手指導文件
│   ├── product.md          # 產品願景和功能規範
│   ├── tech.md             # 技術棧和開發規範
│   └── structure.md        # 項目結構規範（本文件）
├── config/                 # 配置文件目錄
│   ├── intent-rules.yaml   # 意圖識別規則配置
│   └── scenarios/          # 場景配置文件
├── docs/                   # 項目文檔
├── eslint-plugin-local/    # 自訂 ESLint 插件
├── eslint-rules/           # ESLint 自訂規則
├── scripts/                # 腳本和工具
├── src/                    # 主要源代碼
├── tests/                  # 測試文件
├── package.json            # 項目依賴配置
├── README.md               # 項目說明文檔
└── CLAUDE.md               # Claude 開發規範
```

## 源代碼結構 (`src/`)

### 目錄組織原則
遵循三層架構模式，每層職責明確分離：

```
src/
├── index.js                # 應用程式入口點
├── app.js                  # Express 應用配置
├── controllers/            # 控制層：請求處理和回應
│   └── lineController.js   # LINE Bot 控制器
├── services/               # 服務層：業務邏輯處理
│   ├── semanticService.js  # 語義分析服務
│   ├── taskService.js      # 任務協調服務
│   ├── entityService.js    # 實體 CRUD 服務
│   ├── dataService.js      # 資料存取服務
│   ├── timeService.js      # 時間處理服務
│   ├── lineService.js      # LINE API 包裝服務
│   └── courseService.js    # 課程專用服務
├── scenario/               # 場景模板層：多場景業務邏輯
│   ├── ScenarioTemplate.js # 場景模板抽象基類
│   ├── ScenarioManager.js  # 場景管理器
│   ├── ScenarioFactory.js  # 場景實例工廠
│   └── templates/          # 具體場景模板實現
│       ├── CourseManagementScenarioTemplate.js
│       ├── HealthcareManagementScenarioTemplate.js
│       └── InsuranceSalesScenarioTemplate.js
├── internal/               # 內部基礎服務
│   ├── firebaseService.js  # Firebase 連接服務
│   ├── openaiService.js    # OpenAI API 服務
│   └── lineService.js      # LINE API 基礎服務
└── utils/                  # 工具和輔助功能
    ├── conversationContext.js  # 對話上下文管理
    └── intentRuleEngine.js     # 意圖規則引擎
```

## 層級職責與依賴關係

### 依賴流向規則
```
Controllers → Services → Scenario → Internal
     ↓           ↓         ↓         ↓
   不依賴     可依賴     可依賴    基礎層
  任何層級   Scenario   Internal  不依賴任何層
```

### 各層詳細職責

#### 1. Controllers 層
- **職責**：HTTP 請求處理、驗證、回應格式化
- **依賴**：僅能依賴 Services 層
- **禁止**：直接調用 Internal 或 Utils

#### 2. Services 層
- **職責**：業務邏輯協調、服務編排
- **依賴**：可依賴 Scenario 和 Internal 層
- **核心服務**：
  - `semanticService`：語義分析統一入口
  - `taskService`：任務執行協調層
  - `entityService`：通用實體 CRUD 操作

#### 3. Scenario 層
- **職責**：場景特定業務邏輯、模板化處理
- **依賴**：可依賴 Internal 層和 Utils
- **設計模式**：Template Method Pattern

#### 4. Internal 層
- **職責**：外部服務整合、基礎設施
- **依賴**：僅依賴外部 SDK 和 Utils
- **服務**：Firebase、OpenAI、LINE Bot API

#### 5. Utils 層
- **職責**：純函數工具、輔助功能
- **依賴**：不依賴任何內部層級

## 配置文件結構 (`config/`)

### 場景配置 (`scenarios/`)
```yaml
# course_management.yaml
scenario:
  name: "Course Management"
  description: "學童課程管理場景"
  entityType: "course"
  
intents:
  - name: "record_course"
    description: "記錄新課程"
    requiredFields: ["courseName", "timeInfo"]
    
  - name: "modify_course"
    description: "修改課程"
    requiredFields: ["courseName"]
```

### 意圖規則 (`intent-rules.yaml`)
```yaml
intents:
  record_course:
    keywords: ["新增", "記錄", "課程", "安排"]
    patterns: ["我要安排", "幫我記錄"]
    
  query_schedule:
    keywords: ["查詢", "課表", "課程表"]
    patterns: ["我的課程", "今天有什麼課"]
```

## 文件命名約定

### 一般規則
- **JavaScript 文件**：camelCase（如：`lineController.js`）
- **類別文件**：PascalCase（如：`ScenarioTemplate.js`）
- **配置文件**：snake_case（如：`course_management.yaml`）
- **文檔文件**：UPPERCASE（如：`README.md`, `CLAUDE.md`）

### 具體約定
- **控制器**：`[feature]Controller.js`
- **服務**：`[feature]Service.js`
- **場景模板**：`[Feature]ManagementScenarioTemplate.js`
- **工具函數**：`[utility].js`
- **測試文件**：`[feature]-test.js`

## 新增功能指引

### 新增 Intent 處理
1. **語義層**：在 `semanticService.js` 新增意圖識別邏輯
2. **控制層**：在 `lineController.js` 新增 case 處理
3. **任務層**：在 `taskService.js` 新增委託邏輯
4. **場景層**：在對應 ScenarioTemplate 實現具體邏輯

### 新增場景模板
1. **創建模板**：`src/scenario/templates/[Feature]ManagementScenarioTemplate.js`
2. **註冊工廠**：在 `ScenarioFactory.js` 新增場景類型
3. **配置文件**：`config/scenarios/[feature]_management.yaml`
4. **環境變數**：設定 `SCENARIO_TYPE=[feature]_management`

### 新增服務模組
1. **位置**：`src/services/[feature]Service.js`
2. **職責**：特定功能的業務邏輯封裝
3. **依賴**：遵循層級依賴規則
4. **測試**：`tests/services/[feature]Service-test.js`

## 架構驗證

### 自動檢查腳本
- **架構檢查**：`scripts/check-architecture.js`
- **依賴檢查**：ESLint 規則 `no-cross-layer-imports`
- **執行命令**：`npm run lint`

### 手動檢查清單
1. ✅ 是否遵循三層架構分離？
2. ✅ 是否違反依賴流向規則？
3. ✅ 新文件是否放在正確目錄？
4. ✅ 命名是否遵循約定？
5. ✅ Claude API 是否僅在 SemanticService 調用？

## 重構與維護

### 重構原則
- **向後兼容**：保持現有 API 接口穩定
- **逐步遷移**：穩定功能保持現狀，新功能採用新架構
- **測試保護**：重構前確保有充分測試覆蓋

### 維護策略
- **定期檢查**：每月執行架構檢查腳本
- **文檔更新**：新功能必須更新相關文檔
- **性能監控**：追蹤各層級的性能表現