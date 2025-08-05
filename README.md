# LINE 課程管理機器人 - MVP 版本

語言驅動任務流程的通用架構，讓使用者透過 LINE 對話完成課程紀錄與管理任務。

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 環境變數設定
複製環境變數範例檔案：
```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入以下必要資訊：
```bash
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# OpenAI API 設定
OPENAI_API_KEY=your_openai_api_key

# Firebase 設定
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Google Calendar 設定
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

### 3. 啟動服務
```bash
npm start
```

服務將在 http://localhost:3000 啟動。

## 🧪 測試功能

### 測試語意處理（不需要外部服務）
```bash
# 單一測試
node tools/test-semantic-only.js "小明每週三下午3點數學課"

# 批量測試
node tools/test-semantic-only.js --batch
```

### 測試完整功能（需要環境變數）
```bash
# 測試新增課程
node tools/send-test-message.js "小明每週三下午3點數學課"

# 測試查詢課表
node tools/send-test-message.js "查詢小明今天的課程"
```

## 📋 已實作功能

### ✅ 核心架構
- **意圖識別系統** - 支援規則匹配 + AI 備援
- **實體提取系統** - 自動提取學生姓名、課程、時間等資訊
- **任務執行系統** - 模組化的任務處理器
- **服務整合** - Google Calendar、Firebase、LINE Bot API

### ✅ 基本功能
- **新增課程** (`add_course`) - 支援單次和重複課程
- **查詢課表** (`query_schedule`) - 多種時間範圍查詢
- **LINE Bot 整合** - 完整的 webhook 處理機制

### ⏳ 待實作功能
- **記錄課程內容** (`record_content`) - 文字和圖片記錄
- **設定提醒** (`set_reminder`) - 課前通知功能
- **取消課程** (`cancel_course`) - 課程刪除功能

## 🔧 技術架構

```
LINE Bot → 意圖識別 → 實體提取 → 任務執行 → 資料儲存
   ↑                                          ↓
   └────────────── 回覆結果 ←─────────────────┘
```

### 核心模組
- `/src/bot/` - LINE Webhook 處理
- `/src/intent/` - 語意分析（意圖+實體）
- `/src/tasks/` - 任務處理器
- `/src/services/` - 外部服務封裝

### 資料分工
- **Google Calendar** - 專精時間邏輯（重複規則、衝突檢測）
- **Firebase** - 專精業務資料（學生資料、課程記錄）

## 🎯 使用範例

### 新增課程
```
使用者：「小明每週三下午3點數學課」
機器人：「✅ 課程已安排成功！
        👦 學生：小明
        📚 課程：數學課
        🔄 重複：每週三 下午3:00
        📅 下次上課：2025-01-15」
```

### 查詢課表
```
使用者：「小明今天有什麼課？」
機器人：「📅 小明今天的課程安排
        📆 1/15 (三)
          下午3:00 - 數學課 🔄」
```

## 🔍 語意識別能力

### 支援的意圖
- `add_course` - 新增單次課程
- `create_recurring_course` - 創建重複課程
- `query_schedule` - 查詢課表
- `set_reminder` - 設定提醒
- `cancel_course` - 取消課程
- `record_content` - 記錄課程內容

### 實體提取
- `studentName` - 學生姓名（小明、Lumi等）
- `courseName` - 課程名稱（數學課、鋼琴課等）
- `scheduleTime` - 上課時間（自動轉24小時制）
- `timeReference` - 時間參考（今天、明天、昨天等）
- `recurring` - 是否重複課程
- `dayOfWeek` - 星期幾（0-6）

## 📝 開發指南

### 新增任務處理器
1. 在 `/src/tasks/` 建立 `handle_XXX_task.js`
2. 遵循統一介面：`async function(slots, userId, messageEvent)`
3. 回傳格式：`{ success: boolean, message: string }`
4. 在 `/src/bot/webhook.js` 註冊處理器

### 新增意圖規則
編輯 `/config/mvp/intent-rules.yaml`：
```yaml
new_intent:
  keywords: ['關鍵詞1', '關鍵詞2']
  priority: 10
  exclusions: ['排除詞']
  examples:
    - "範例語句1"
    - "範例語句2"
```

## 🎉 當前測試結果

### 語意處理測試
- **意圖識別準確率**: 76.5% (13/17)
- **實體提取**: 基本可用，持續優化中
- **支援語句類型**: 
  - ✅ 重複課程：「小明每週三下午3點數學課」
  - ✅ 單次課程：「小光明天上午10點英文課」
  - ✅ 課表查詢：「小明今天有什麼課？」
  - ✅ 時間範圍：「查詢這週的課表」

### 系統穩定性
- ✅ 基礎架構完整
- ✅ 錯誤處理機制
- ✅ 環境變數驗證
- ✅ 測試工具完備

## 📞 聯絡資訊

如有問題或建議，請查閱專案文檔：
- 商業邏輯：`/doc/implement.md`
- 開發指南：`/doc/developer-guide.md`
- 技術架構：`/doc/technical.md`
- 任務規劃：`/doc/task.md`