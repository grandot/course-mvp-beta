# 專案工作板（單一資訊來源）

### Doing
### Next（優先序由上而下）
- deleteDocument 集合白名單（僅允許刪除 courses/reminders/course_contents｜規格: doc/developer-guide.md）
- 除了測試的日曆，正常用戶的日曆不可刪除。如果用戶下達刪除指令，改變status不要物理刪除。
- 確認GCal跟firebase是否同步（新增/刪除/修改）
- 衝突檢查條件化（僅在日期/時間變更時檢查｜規格: spec/modify-course/plan.md）
- 每月「第N個週X」重複（P1；RRULE: BYDAY+BYSETPOS；支援「最後一個週X」；起始日推導；成功訊息校準｜規格: spec/recurring/task-recurring.md）
- 直接修改「重複系列」（P1；限改時間/課名、無例外日；目前 P0 為撤銷＋重建策略｜規格: spec/modify-course/plan.md）
- 撤銷時限共用介面（P1；抽出 `src/utils/timeWindow.js`，供新增/修改/撤銷共用）
- 小月提示互動強化（P1；提供 Quick Reply 選項，避免誤解｜規格: spec/recurring/task-recurring.md）
- 測試與文件補強（P1；新增「每月第N個週X」端到端用例與 QA 報告；校準 `README` 與規格文件）
- 單元測試補齊（需求定義完成；尚未開工）
- 開關文件同步（`config/env.example`、`README` 補充 `ENABLE_RECURRING_COURSES` 與舊變數相容性說明）
- Render 健檢 400 校準（健檢/Redis 檢查使用免簽名端點或加入測試標頭 x-qa-mode:test；更新 `tools/render-suite.js`）
- 修改課程成功訊息優化（僅改課名時以「已更新課名為 X」簡短回饋｜規格: spec/modify-course/task.md）
### Backlog（優先序由上而下）
- 批次操作（一次新增多個課程）
- 匯出 PDF 課程報表
- 搜尋特定課程/內容
- 無變更保護（修改課程無實質變更時不更新，提示引導）
- 監控告警（異常監控與即時告警）
- Redis 連接池與延遲優化
- Rate limiting 與輸入驗證
- 課名提取強化（cleanCourseName 句式擴充與動作詞容錯｜規格: spec/modify-course/plan.md）
- 時區一致性整理（統一 Asia/Taipei +08:00 的解析/顯示與過去時間判斷）
- 衝突檢查排除自身事件（修改時忽略當前事件，避免自我衝突）
- 已固定 Asia/Taipei（+08:00）並處理跨日進位；符合目前產品市場。若未來跨時區，需抽象化。
- 測試報告存證與口徑統一（所有測試輸出以 tee 落檔；彙整報告僅讀檔案數據，避免批次口徑差）
- 測試標準化與差異守門（同旗標配置、userId 隔離；一致性差異門檻警示）
- 覆蓋率管線（整合 nyc/jest 產出 coverage，納入 QA 報告）
- 旗標汰換（逐步移除 `ENABLE_DAILY_RECURRING`，僅保留 `ENABLE_RECURRING_COURSES`，清理 deprecation log）
### Blocked（阻塞與依賴）
- 圖片上傳 404（LINE API）— 需官方支援或替代流程決策
### Done（最近 5 筆，含完成日）
- 2025-08-13：**重複課程功能完整實作**（P0 支援 daily/weekly/monthly BYMONTHDAY，單一開關控制，起始日智慧推導，小月跳過策略，2分鐘撤銷時限｜規格: spec/recurring/task-recurring.md）
- 2025-08-13：修改課程功能（modify_course v1 完成｜規格: spec/modify-course/plan.md）
- 2025-08-13：時間格式統一（訊息固定顯示 :mm；00:xx → 上午12:xx）
- 2025-08-12：新增課程時日曆未寫入成功，但是firebase寫入成功
- 2025-08-12：**確認按鈕功能恢復**（AI prompt + 規則兜底雙重保險，確保「確認」100% 識別）
- 2025-08-12：**Google Calendar 同步修復**（環境變數載入修復，課程直接寫入日曆）
---