# 📝 Change Log

## 2025-08-14 - 系統更新 📝

### 🐛 Fixed
- **課表查詢數據一致性修復**（修復已取消課程仍顯示在課表中的問題，確保 Firebase 和用戶界面數據同步）
- **重複課程功能完整實作**（P0 支援 daily/weekly/monthly BYMONTHDAY，單一開關控制，起始日智慧推導，小月跳過策略，2分鐘撤銷時限｜規格: spec/recurring/task-recurring.md） [uid:0236f790]
- 修復取消重複課程 Quick Reply 不顯示的 BUG [uid:e825f3c7f840]

---

## 2025-08-14 - 系統更新 📝

### 🐛 Fixed
- **重複課程功能完整實作**（P0 支援 daily/weekly/monthly BYMONTHDAY，單一開關控制，起始日智慧推導，小月跳過策略，2分鐘撤銷時限｜規格: spec/recurring/task-recurring.md） [uid:0236f790]
- 修復取消重複課程 Quick Reply 不顯示的 BUG [uid:e825f3c7f840]

---

## 2025-08-13 - 系統更新 📝

### 🐛 Fixed
- 修改課程功能（modify_course v1 完成｜規格: spec/modify-course/plan.md） [uid:ceab455d]
- 時間格式統一（訊息固定顯示 :mm；00:xx → 上午12:xx） [uid:9eaa05c2]

---

## 2025-08-12 - 系統更新 📝

### 🐛 Fixed
- 新增課程時日曆未寫入成功，但是firebase寫入成功 [uid:35c38d0e]
- **確認按鈕功能恢復**（AI prompt + 規則兜底雙重保險，確保「確認」100% 識別） [uid:679a56d2]
- **Google Calendar 同步修復**（環境變數載入修復，課程直接寫入日曆） [uid:963526f1]

---

## 2025-08-11 - 系統更新 📝

### 🐛 Fixed
- 意圖識別準確率修復（AI 信心閾值 0.3→0.7，啟用規則兜底，非課程語句防呆）
- 啟用 IntentRouter 分層架構（parseIntent 專注識別，補問邏輯由 Router 處理）
- AI 服務緊急修復：恢復意圖識別功能
- NLU 規則補齊：add_course 加入必要詞群組合驗證

---

## 2025-08-10 - 系統更新 📝

### 🐛 Fixed
- 意圖誤判修復：record_content 不再被誤判為 add_course
- 錯誤處理增強：統一的錯誤訊息回覆機制
- 配置集中化：統一的環境變數管理

---

## 2025-08-07 - 系統更新 📝

### ✅ Achievement
- 測試通過率：75% → 100% (提升 25%)
- 意圖支援覆蓋：12/18 → 18/18 (100% 完整覆蓋)
- 多輪對話成功率：0% → 100%

### 🐛 Fixed
- 每日重複課程功能：支援「小明每天早上8點英文課」
- Mock LINE Service 架構：零風險生產環境測試
- 自動化測試工具：12個測試場景完整覆蓋
- 智能重複類型識別：daily/weekly/monthly 精確識別
- Google Calendar RRULE 整合：完整的重複規則生成
- 意圖處理器映射修復：6個補充意圖恢復正常

---

## 📋 Legend

- 🎯 Major Features - 主要功能
- ✨ Added - 新增功能
- 🐛 Fixed - 錯誤修復
- 🚀 Performance - 效能提升
- 🔧 Technical - 技術改進
- 🧪 Testing - 測試相關
- ✅ Achievement - 重要成果