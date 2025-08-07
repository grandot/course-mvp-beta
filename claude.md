# CLAUDE.md

## 專案：LINE 課程管理機器人
使用 LINE 對話記錄和管理課程，採用意圖識別架構。

## 快速開始
```bash
npm start          # 啟動服務
npm run lint:fix   # 修復格式
node tools/send-test-message.js "測試訊息"  # 測試功能
```

## 核心架構
LINE Bot → parseIntent → extractSlots → handle_XXX_task → Google Calendar + Firebase

Google Calendar 專精時間邏輯，Firebase 專精業務資料，兩者協作分工。

## 重要規範
- **命名**：意圖用 `snake_case`，函式用 `handle_XXX_task()`，變數用 `camelCase`
- **用詞**：student/course/scheduleTime（禁用 child/lesson/time）
- **回傳**：`{ success: boolean, message: string }`
- **衝突處理**：遇到矛盾以 `/doc/technical.md` 第8節為準

## 檔案結構
```
/src/bot/          # LINE webhook
/src/intent/       # parseIntent.js, extractSlots.js  
/src/tasks/        # handle_XXX_task.js
/src/services/     # API 服務封裝
```

## 重要提醒
- ALWAYS TALK TO ME IN CHINESE
- 快速開發優先，避免過度設計

## 詳細文檔

### 🎯 核心指導文檔 (AI-Rules)
- **產品定義：`/ai-rules/product.md`** - 商業邏輯、功能規格、使用情境
- **技術實現：`/ai-rules/tech.md`** - 架構設計、開發環境、實作細節 ⚠️ 含環境限制必讀
- **專案組織：`/ai-rules/structure.md`** - 文檔結構、開發流程、約定規範

### 📚 開發文檔
- **開發指南：`/doc/developer-guide.md`** - 新人入門必讀指南
- **部署指南：`/doc/deployment-guide.md`** - 部署操作步驟
- **技術債務：`/doc/technical-debt.md`** - 技術債務追蹤

### 🔬 功能規格
- **多輪對話：`/spec/multi-dialogue/`** - 多輪對話功能規格
- **AI增強：`/spec/ai-enhance/`** - AI增強功能規格

### ⚙️ 其他參考
- **配置說明：`/config/README.md`** - 分階段配置管理
- **專案進度：`/PROJECT_STATUS.md`** - 即時進度監控與里程碑追蹤