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
- 商業邏輯：`/doc/implement.md` (功能規格與使用情境)
- 開發指南：`/doc/developer-guide.md` (給新進工程師的實作指南)
- 架構設計：`/doc/technical.md` (設計決策、實作細節與未來規劃)
- 任務規劃：`/doc/task.md` (Claude Code 執行任務的標準流程)
- 配置組織：`/config/README.md` (分階段配置說明)