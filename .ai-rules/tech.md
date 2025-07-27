---
title: Tech Stack & Development Standards
description: "定義項目的技術棧、架構模式和開發規範"
inclusion: always
---

# 技術棧與開發規範 - IntentOS Course MVP

## 核心技術棧

### 後端技術
- **運行環境**：Node.js >= 20.0.0
- **Web 框架**：Express.js ^4.18.2
- **AI 服務**：OpenAI GPT API ^5.10.2（語義分析）
- **資料庫**：Firebase Firestore（NoSQL 文件資料庫）
- **外部整合**：LINE Bot API（使用者介面）

### 開發工具與套件
- **環境管理**：dotenv ^17.2.1
- **配置解析**：js-yaml ^4.1.0（YAML 配置文件）
- **程式碼品質**：
  - ESLint ^8.57.0（程式碼檢查）
  - Prettier ^3.2.5（程式碼格式化）
  - Airbnb ESLint 配置

### 專案管理指令
```bash
# 開發模式啟動
npm run dev

# 生產環境啟動
npm start

# 程式碼檢查
npm run lint

# 程式碼自動修正
npm run lint:fix

# 程式碼格式化
npm run prettier
```

## 架構設計模式

### 三層架構 (MVP 混合模式)
```
用戶自然語言 → 語義處理層 → Scenario Layer → EntityService → 統一格式回覆
```

#### 1. 語義層 (Semantic Layer)
- **職責**：使用 Claude API 解析語意，輸出 `intent`、`entities`、`timeInfo`
- **限制**：Claude API 僅能調用一次，且只能在語意層呼叫
- **服務**：`SemanticService`

#### 2. 控制層 (Control Layer)
- **職責**：根據 `intent` 執行對應函數，處理任務邏輯
- **實現**：`LineController`、`TaskService`
- **原則**：每個 intent 對應一個 `handleXXXCourse()` 函數

#### 3. 資料層 (Data Layer)
- **職責**：所有資料存取操作集中處理
- **服務**：`FirestoreService`、`DataService`、`EntityService`
- **限制**：不得在 Controller 直接操作 Firebase SDK

### 場景模板架構 (Scenario Template)
- **ScenarioTemplate**：抽象基類，定義業務接口
- **ScenarioManager**：場景管理和切換
- **ScenarioFactory**：場景實例創建工廠

#### 雙車道開發策略
1. **穩定車道（完整架構）**：
   ```
   Controller → TaskService → ScenarioTemplate → EntityService → DataService
   ```
   - 適用：核心、複雜、已穩定的功能

2. **高速車道（簡化路徑）**：
   ```
   Controller → TaskService → EntityService/DataService
   ```
   - 適用：新的、簡單的、需要快速實現的 MVP 功能

## 資料格式規範

### 課程資料格式
```typescript
{
  courseName: string,
  teacher: string,
  location: string,
  date: string, // e.g. '2025-07-30'
  timeInfo: {
    start: string, // '2025-07-30T14:00:00Z'
    end: string    // '2025-07-30T15:00:00Z'
  },
  isRecurring: boolean
}
```

### 語義分析回傳格式
```typescript
{
  intent: string,
  entities: Object,
  timeInfo: Object,
  confidence: number
}
```

## 開發規範與約束

### Claude 開發五大原則（MVP 專用）

#### 1. 語義解析單一入口
- Claude API 僅能調用一次，且只能在 `SemanticService` 呼叫
- 不得在控制層或資料層二次調用 Claude
- 回傳格式固定為：`{ intent, entities, timeInfo, confidence }`

#### 2. 控制層邏輯清晰
- 每個 intent 對應一個 `handleXXXCourse()` 函數
- 可以集中寫在 Controller，但不得混寫不同任務
- 若欄位不足，請加入簡易 fallback 提示

#### 3. 資料層職責單一
- 所有與課程、提醒等儲存操作應集中在 FirestoreService
- 不得在 Controller 直接操作 Firebase SDK

#### 4. 欄位格式統一
- 禁止任意新增欄位
- 必須符合預定義的課程格式規範

#### 5. 錯誤處理一致
- 統一錯誤回應格式
- 提供用戶友好的錯誤訊息

### 程式碼品質要求
- **ESLint 規則**：遵循 Airbnb JavaScript 風格指南
- **自訂規則**：`no-cross-layer-imports`（防止跨層級導入）
- **架構檢查**：使用 `scripts/check-architecture.js` 驗證架構約束

## 環境配置

### 必要環境變數
```bash
# LINE Bot 配置
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key

# Firebase 配置
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PROJECT_ID=your_firebase_project_id

# 場景配置
SCENARIO_TYPE=course_management

# 開發模式
NODE_ENV=development
```

### 部署要求
- **Node.js 版本**：>= 20.0.0
- **記憶體需求**：最少 512MB
- **網路需求**：支援 HTTPS（LINE Bot Webhook 要求）

## 測試策略
- **架構測試**：場景層架構完整性測試
- **集成測試**：LINE Bot 與 Firebase 整合測試
- **語義測試**：自然語言處理準確性測試

## 效能監控
- **Token 使用統計**：OpenAI API 調用成本監控
- **回應時間監控**：LINE Bot 回應延遲追蹤
- **錯誤率監控**：系統穩定性指標