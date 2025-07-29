# CLAUDE.md - IntentOS 課程管理系統

## 🎯 專案概況
- **技術棧**: LINE Bot + Express.js + OpenAI + Firebase
- **當前版本**: v9.0 - Scenario Layer 架構
- **場景類型**: course_management（單一部署模式）

## 🚨 核心架構約束（必須遵循）

| 服務 | 職責 | 禁止事項 |
|------|------|----------|
| `SemanticService` | 所有語義處理 | ❌ 直接調用 OpenAI |
| `TimeService` | 所有時間操作 | ❌ 直接使用 `new Date()` |
| `DataService` | 所有數據操作 | ❌ 直接調用 Firebase |
| `TaskService` | 業務邏輯協調 | ❌ 硬編碼邏輯 |

## ⚡ 必要工作流程
1. **Bug 報告**: 必須先執行 `./scripts/get-app-logs.sh 50`
2. **代碼修改**: 必須在提交前更新 `CHANGELOG.md`
3. **架構遵循**: 嚴格按照上述服務邊界
4. **禁止跨層**: 服務不可直接調用內部實現

## 📚 詳細文檔導航

需要更多信息時，請查閱：

- **架構設計問題** → `docs/ARCHITECTURE.md`
  - 三層語義架構詳解
  - Scenario Layer 設計
  - 服務層 API 規範

- **開發和編碼問題** → `docs/DEVELOPMENT.md`
  - API 使用方法
  - 編碼規範
  - 測試和調試

- **部署和運維問題** → `docs/DEPLOYMENT.md`
  - 環境變數配置
  - 故障排除步驟
  - 監控和日誌查詢

- **用戶流程和業務邏輯** → `docs/USER_FLOWS.md`
  - 處理流程詳解
  - 多輪對話機制
  - 效能統計

## 🔧 快速指令
```bash
npm run dev                          # 本地開發
./scripts/get-app-logs.sh 50        # 查看日誌
npm test                            # 執行測試
```