## AI 任務上下文（聊天）
**記錄當前chat上下文，用以重啟或者新開chat之後，讓AI理解上一輪對話的上下文，繼續工作**

- 最後更新：2025-08-14 13:00:00（台北時間, UTC+8）

### 當前上下文摘要（依新舊降冪）

#### 2025-08-14：架構違規修復 - 重複課程刪除功能
**問題背景：**
- 用戶報告「刪除整個重複」功能失效，課程刪除後仍然存在
- 系統顯示刪除成功但實際只刪除了單一日期（2025-08-08），整個重複系列仍存在
- Quick Reply 按鈕不顯示（上下文管理問題）

**根本原因分析：**
- 之前的修改違反了系統架構設計原則
- 在 Firebase 層面試圖處理重複課程邏輯，違反「Google Calendar 專精時間處理，Firebase 專精業務資料」的分工
- 創建了「shit mountain」程式碼，偏離設計框架

**執行的修復步驟：**

1. **保留正確的修復**（不回滾）：
   - `webhook.js` 中的上下文管理時序修復（`recordUserMessage` 在 `extractSlots` 之後）
   - `extractSlots.js` 中的 Quick Reply 特殊處理邏輯
   - `firebaseService.js` 中的 `getStudentsByUser` 函數

2. **回滾架構違規代碼**：
   - 移除 `firebaseService.getRecurringCoursesByStudent` 函數
   - 清理 `handle_cancel_course_task.js` 中的 Firebase 重複課程邏輯（lines 84-97, 129-137）
   - 修正 `handle_query_schedule_task.js` 中對已刪除函數的調用

3. **實現正確的架構**：
   - 新增 `googleCalendarService.deleteRecurringEvent` 函數
   - 實現 Google Calendar 原生重複事件刪除邏輯
   - 確保正確刪除整個重複系列而非單一實例

**技術細節：**
- Google Calendar 負責：重複規則、衝突檢測、事件刪除
- Firebase 負責：業務資料同步、用戶資料、課程記錄
- 重複事件刪除流程：識別主事件或實例 → 刪除整個系列 → Firebase 通過定期同步更新

**部署狀態：**
- 所有修復已提交並推送到 GitHub (commit: a9c004c)
- Render 自動部署中，「刪除整個重複」功能應已修復

**重要經驗：**
- 嚴格遵守架構分工原則，避免跨層處理業務邏輯
- 第一性原則思考，從用戶角度出發
- 避免過度工程化，遵循既定的設計框架

#### 先前上下文
[local cli]
- 同步簡化：`bin/sync` 或 `npm run sync` 只更新 `PROJECT_STATUS.md` → `doc/CHANGELOG.md`，不觸碰 `AI_TASK_CONTEXT.md`
- Trello 對接：`bin/trello:push`（檔→Trello）、`bin/trello:pull`（Trello→檔，覆寫 5 區塊）