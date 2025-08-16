# Changelog

## 2025-08-16

- Reminders: fully implemented end-to-end (create → scheduled execute every 5 minutes → LINE push → daily cleanup at 02:00), with structured logs and graceful error handling.
- Functions: migrated to Firebase Functions Gen2 (Cloud Run) and Node.js 20; switched triggers to `firebase-functions/v2` (`onRequest`, `onSchedule`).
- Cleanup: enhanced `cleanupOldReminders` with detailed query/batch logs, try/catch wrapping, and index hint capture; added schema diagnostics; ensured function never crashes on Firestore errors.
- Security: removed public HTTP test/execute endpoints (check/cleanup/createTestReminder) to reduce exposure; kept `getReminderStats` for read-only monitoring.
- Indexes: added Firestore composite indexes for `reminders(executed, executedAt)` and `reminders(executed, triggerTime)`; aligned existing `courses(studentName, userId, courseDate, scheduleTime)`; removed unnecessary single-field style index definitions that caused 400 errors.
- Config: updated `firebase.json` runtime to `nodejs20`; updated `functions/package.json` engines node to `20` and `firebase-functions` to `^5.0.1`.
- Tooling: kept ESLint clean (only console warnings where intentional for observability).


## [2025-08-16] - 提醒執行器系統完整實作

### 🎯 新功能
- **提醒執行器系統**: 完整實作自動提醒發送功能
  - 可開關的提醒執行器 (`REMINDER_EXECUTOR_ENABLED`)
  - 自動掃描待發送提醒 (每5分鐘)
  - 邊界處理：過期窗口、取消課程、失敗重試
  - 基礎日誌與統計功能
  - 觀測與監控 (健康檢查、告警、性能指標)

### 🔧 技術改進
- **Firebase Functions 整合**: 定時任務與 HTTP API 端點
- **時間處理統一**: Firestore Timestamp 一致性
- **消息發送優化**: 統一使用 `lineService.pushMessage()`
- **監控系統**: 完整的健康檢查與告警機制

### 🛠️ 修復問題
- **修復消息發送錯誤**: `lineService.sendMessage()` → `lineService.pushMessage()`
- **修復時間類型不一致**: 統一使用 Firestore Timestamp
- **修復邊界條件處理**: 兼容多種 `courseId` 字段名稱
- **修復配置缺失**: 補全環境變數文檔

### 📋 新增文件
- `src/services/reminderExecutorService.js` - 主執行器
- `src/utils/reminderMonitor.js` - 監控與健康檢查
- `REMINDER_SYSTEM.md` - 完整系統文檔

### ⚙️ 環境變數
```bash
# 提醒執行器配置
REMINDER_EXECUTOR_ENABLED=true
REMINDER_SCAN_INTERVAL=5
REMINDER_EXPIRE_WINDOW=60
REMINDER_MAX_RETRY=3
REMINDER_RETRY_DELAY=5
REMINDER_BATCH_SIZE=50

# 對話與會話管理
CONVERSATION_TTL_SECONDS=1800
QUERY_SESSION_TTL_MS=300000

# AI 回退配置
AI_FALLBACK_MIN_CONFIDENCE=0.7
AI_FALLBACK_TIMEOUT_MS=900

# 業務邏輯配置
STRICT_RECORD_REQUIRES_COURSE=true

# 調試與測試
USE_MOCK_LINE_SERVICE=false
ENABLE_DIAGNOSTICS=false
```

### 🔗 API 端點
- `POST /triggerReminderCheck` - 手動觸發提醒檢查
- `GET /getReminderStats` - 取得執行統計
- `GET /getReminderHealth` - 健康檢查與監控

### 📊 監控功能
- **健康檢查**: 錯誤率、失敗率、執行時間監控
- **告警機制**: Warning/Critical 閾值與建議
- **性能指標**: 處理量、延遲、錯誤統計
- **日誌格式化**: 結構化日誌輸出

### 🚀 部署需求
1. 設定 `REMINDER_EXECUTOR_ENABLED=true`
2. 配置 `LINE_CHANNEL_ACCESS_TOKEN`
3. 建立 Firestore 複合索引 (executed + triggerTime)
4. 部署 Firebase Functions

### ⚠️ 已知限制
- 需要 Firestore 複合索引才能正常查詢
- 時區處理假設為 Asia/Taipei (+08:00)
- 重試機制最大3次，超過後標記失敗

### 🔮 後續計劃
- Grafana 監控儀錶板整合
- 智能重試策略 (指數退避)
- 更細粒度的性能分析
- 藍綠部署支援
