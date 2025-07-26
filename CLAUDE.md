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
LINE Bot → Express.js → OpenAI GPT-3.5 → YAML Config → Firebase Firestore
```

### 專案結構（分離式架構 v2.0）
```
src/
├── controllers/lineController.js   # 請求接收層（重構完成 ✅）
├── services/
│   ├── semanticService.js         # 語義處理唯一入口 ✅
│   ├── dataService.js             # 數據處理唯一入口 ✅
│   ├── courseService.js           # 課程業務邏輯（重構完成 ✅）
│   └── taskExecutor.js            # 任務執行協調層
├── utils/
│   ├── timeService.js             # 時間處理唯一入口 ✅
│   ├── intentRuleEngine.js        # 規則引擎實現
│   ├── intentParser.js            # 參數標準化層
│   ├── scheduleFormatter.js       # 課表格式化
│   └── timeRangeManager.js        # 時間範圍管理
├── config/
│   └── intent-rules.yaml          # 意圖規則配置
└── [待移至 internal/]             # 下階段重構
    ├── openaiService.js           # OpenAI 調用實現
    ├── firebaseService.js         # Firebase 操作實現
    └── lineService.js             # LINE API 實現
```

### 🏗️ 分離式架構實現（2025-07-24）

**核心設計原則**：Single Source of Truth + Forced Boundaries + No Cross-Layer Access

#### 統一服務層

**SemanticService - 語義處理統一入口**
```javascript
// ✅ 正確用法：所有語義處理都通過此服務
const analysis = await semanticService.analyzeMessage(text, userId);
const entities = await semanticService.extractCourseEntities(text, userId);

// ❌ 禁止：直接調用底層服務
const analysis = await openaiService.analyzeIntent(); // 違反架構約束
const result = intentRuleEngine.analyzeIntent();      // 違反架構約束
```

**TimeService - 時間處理統一入口**
```javascript
// ✅ 正確用法：所有時間操作都通過此服務
const parsedTime = TimeService.parseTimeString(timeInput);
const displayTime = TimeService.formatForDisplay(timeValue, courseDate);
const currentTime = TimeService.getCurrentUserTime();
const validation = TimeService.validateTime(timeObj);

// ❌ 禁止：直接使用原生時間或其他時間邏輯
const now = new Date();                    // 違反架構約束
const parsed = timeParser.parseTime();     // 違反架構約束
```

**DataService - 數據操作統一入口**
```javascript
// ✅ 正確用法：所有數據操作都通過此服務
const result = await dataService.createCourse(courseData);
const courses = await dataService.getUserCourses(userId);
const updated = await dataService.updateCourse(courseId, updateData);

// ❌ 禁止：直接調用底層數據服務
const course = await firebaseService.createCourse(); // 違反架構約束
```

#### 強制邊界機制

| 層級 | 允許調用 | 禁止調用 | 實現狀態 |
|------|----------|----------|----------|
| **Controller 層** | semanticService, lineService | openaiService, intentRuleEngine | ✅ 已實現 |
| **Service 層** | TimeService, dataService | firebaseService, new Date() | ✅ 已實現 |
| **統一服務層** | 內部協調所有底層邏輯 | - | ✅ 已實現 |

#### 重構成果

**問題解決率**：
- ✅ **消除分散邏輯**：時間處理、語義處理、數據操作完全統一
- ✅ **強制架構約束**：無法直接跨層調用，必須通過統一入口
- ✅ **單一數據源**：每個領域只有一個真實來源
- ✅ **可維護性提升**：修改邏輯只需在一處進行

**架構優勢**：
- ✅ **調試容易**：所有操作都通過統一入口，日誌清晰
- ✅ **測試簡單**：每個服務職責明確，單元測試容易編寫
- ✅ **擴展性強**：新增功能只需在對應統一服務中添加
- ✅ **錯誤隔離**：錯誤處理在服務層統一管理

### 🎯 YAML 配置驅動架構

**意圖規則配置 (`intent-rules.yaml`)**：
```yaml
cancel_course:
  keywords: ['取消', '刪除', '移除', '不要', '不上']
  priority: 10
  exclusions: ['新增', '安排', '預約']
  
record_course:
  keywords: ['新增', '安排', '預約', '上課', '學習', '有']
  priority: 5
  exclusions: ['取消', '刪除', '不要']
```

**參數提取配置 (`intent-params.yaml`)**：
```yaml
record_course:
  required: ['courseName', 'time']
  optional: ['location', 'teacher']
  mappings:
    courseName: ['課程', 'course']
    time: ['時間', 'time']
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