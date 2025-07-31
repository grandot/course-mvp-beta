# CLAUDE.md - IntentOS 課程管理系統

## MVP最終目標：從 LINE 群組中抓取老師發布的課程資訊與照片，整理進孩子的個人學習日曆中
	-家長只要把課程訊息或照片轉傳給 LINE Bot，不需要加任何說明，Bot 會自動回覆詢問這是屬於哪個孩子、是哪一堂課，家長只要點選 Quick Reply 選項完成分類，系統就會自動建立課程記錄，把文字當作課堂備註、圖片存進該堂課中，未來可查詢、編輯、下載或生成成果摘要頁。

## MVP WOW moment：每週自動總結學童課程內容摘要，可點開查看詳細課程內容、評語、照片等，自動發送給家長

## 🚨 核心架構約束（必須遵循）

| 服務 | 職責 | 禁止事項 |
|------|------|----------|
| `SemanticService` | 所有語義處理 | ❌ 直接調用 OpenAI |
| `TimeService` | 所有時間操作 | ❌ 直接使用 `new Date()` |
| `DataService` | 所有數據操作 | ❌ 直接調用 Firebase |
| `TaskService` | 業務邏輯協調 | ❌ 硬編碼邏輯 |

### ⚡ 智能分流機制（意圖辨識 & 實體提取）
```javascript
// SemanticService 統一架構：OpenAI 優先 → 規則引擎容錯兜底
const openaiResult = await OpenAI.analyzeIntent(text, userId);
if (openaiResult.success) {
  return OpenAI結果;  // 90%+ 案例，準確語義理解，200-500ms
} else {
  return 規則引擎容錯兜底;  // <10% 案例，基礎功能保障，<10ms
}
```
🎯 **第一性原則修復**: **意圖辨別**與**實體提取**都統一語義理解路徑，OpenAI負責準確理解，規則引擎負責容錯保底

## 課程必要欄位 ##
1. 課程名稱
2. 課程日期
3. 課程時間
4. student
如果用戶新增課程時缺少以上欄位，則啟動多輪對話補全。

## ⚡ 必要工作流程
1. **Bug 報告**: 必須先執行 `./scripts/get-app-logs.sh 50`
2. **代碼修改**: 必須在提交前更新 `CHANGELOG.md`
3. **架構遵循**: 嚴格按照上述服務邊界
4. **禁止跨層**: 服務不可直接調用內部實現
5. 所有修改與分析必須**遵守第一性原則**
    - ⚠️ 這不是建議，是強制約束
    - 🎯 遇到問題先問：「根本原因是什麼？」
    - 🚫 禁止補丁式修復，必須解決根本問題
    - 📝 每次修改前必須明確說明第一性原則分析
6. **奉行剃刀法則**
    - 能用openai prompt解決的功能不要新增類或邏輯或代碼
    - openai prompt 必須保持簡單，避免過多細節限制AI能力

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
