## Trello Pull Snapshot
- board: Course Management Bot (https://trello.com/b/DDy0faNG/course-management-bot)
- pulledAt: 2025-08-11T18:44:44.386Z

### Backlog
- [P1][Feature] 批次操作（一次新增多個課程）
- [P2][Feature] 匯出 PDF 課程報表
- [P2][Feature] 搜尋特定課程/內容
- [P1][Ops] 監控告警（異常監控與即時告警）
- [P2][Perf] Redis 連接池與延遲優化
- [P2][Security] Rate limiting 與輸入驗證

### Next
- [P1][Feature] 修改課程功能（需求定義完成；尚未開工）
- [P1][Quality] 單元測試補齊（需求定義完成；尚未開工）

### Doing


### Blocked
- [P1][External] 圖片上傳 404（LINE API）— 需官方支援或替代流程決策

### Done
- 2025-08-12：**確認按鈕功能恢復**（AI prompt + 規則兜底雙重保險，確保「確認」100% 識別）
- 2025-08-12：**Google Calendar 同步修復**（環境變數載入修復，課程直接寫入日曆）
- 2025-08-11：意圖識別準確率修復（AI 信心閾值 0.3→0.7，啟用規則兜底，非課程語句防呆）
- 2025-08-11：啟用 IntentRouter 分層架構（parseIntent 專注識別，補問邏輯由 Router 處理）
- 2025-08-11：測試模式安全機制（開發環境可跳過 LINE 簽名驗證）
