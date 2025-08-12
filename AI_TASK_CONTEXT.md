## AI 任務上下文（聊天）
**記錄當前chat上下文，用以重啟或者新開chat之後，讓AI理解上一輪對話的上下文，繼續工作**

- 最後更新：2025-08-12 05:21:35（台北時間, UTC+8）


### 當前上下文摘要（依新舊降冪）
[cursor chat]

- 共識：prompt抓的上下文是來自於模型記憶，無法被程序調用，所以AI_TASK_CONTEXT.md得手動寫
- 決策：`AI_TASK_CONTEXT.md` 僅保存「當前聊天要點與下一步」，不混入 Trello/系統日誌
- 同步：Trello push/pull/pull:write 完成；一鍵 `npm run sync:trello`（Trello → 檔案 → 文檔同步）
- 修復：Trello 授權/Board ID 問題（shortLink→長 ID）、`app-key` 產生 token、401/400 已排除
- 旗標：`--dry-run`（演練）、`--lists=`（限定列表）、`--labels`（從 `[P1][Feature]` 自動映射標籤）
- Webhook：提供 server 與註冊腳本，事件落檔於 `reports/`，預設關閉
- 文檔：Trello 指南集中 `tools/README.md`；根 `README.md` 精簡；`.env.example` 補齊
- 摘要策略：固定 prompt 產出 6–12 條主題摘要（合併去重），本次直接用當前聊天上下文
- 自動化：`sync:trello` 可接受 `AI_CONTEXT_TEXT`/`AI_CONTEXT_TEXT_FILE`/`AI_CONTEXT_TEXT_FETCHER` 來源；若無來源則僅做 Trello 同步
- 後續：若需零輸入自動摘要，可評估提供對話來源 API 或本機 DB 只讀方案
