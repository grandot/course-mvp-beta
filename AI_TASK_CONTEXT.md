## AI 任務上下文（聊天）
**記錄當前chat上下文，用以重啟或者新開chat之後，讓AI理解上一輪對話的上下文，繼續工作**

- 最後更新：2025-08-12 23:59:59（台北時間, UTC+8）


### 當前上下文摘要（依新舊降冪）
[local cli]

- 同步簡化：`bin/sync` 或 `npm run sync` 只更新 `PROJECT_STATUS.md` → `doc/CHANGELOG.md`，不觸碰 `AI_TASK_CONTEXT.md`
- Trello 對接：`bin/trello:push`（檔→Trello）、`bin/trello:pull`（Trello→檔，覆寫 5 區塊）
