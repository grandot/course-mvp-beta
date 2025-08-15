# 📝 Change Log

## 2025-08-15 - 修復取消課程課名匹配問題

### 🐛 Fixed
- **取消課程功能修復**：修正課程名稱比對邏輯，解決「跆拳道」vs「跆拳道課」無法匹配的問題
- **課名正規化**：在取消課程時去除尾字「課」進行比對，提升匹配容錯性
- **重複課檢測**：一併修復重複課程檢測的課名比對邏輯，確保 Quick Reply 正確顯示

### 🔧 Technical
- 修改 `handle_cancel_course_task.js` 三處課名比對邏輯
- 使用防禦性編程：`String(... || '').replace(/課$/, '')`
- 影響範圍：future/recurring/all 取消範圍及重複課檢查

### 📊 測試結果
- ✅ 「取消跆拳道」能成功找到「跆拳道」課程
- ✅ 「取消跆拳道課」能成功找到「跆拳道」課程
- ✅ 保持其他取消功能正常運作

---

## 2025-08-14 - QA 測試系統增強（意圖/QuickReply 斷言 + 六行卡模板）

### ✨ Added
- `qa-system/core/TagMarkdownParser.js` 新增支援：`@expect.intent`、`@expect.quickReplyIncludes`
- `qa-system/core/UnifiedTestRunner.js` 本機測試加入意圖/QuickReply 斷言，詳細報告顯示「預期意圖」與「QuickReply 命中矩陣」
- `QA/TEST-TEMPLATE.md` 改版為「六行卡」：人類易讀（測試輸入 / 我預期看到 / 實際看到 / 結論 / 怎麼修 / 影響面）

### 🧪 Testing
- `tools/internal/qa/generate-from-md.js` 仍沿用現有流程；若於 MD 加入 `@expect.*` 斷言，即可參與自動判定

### 影響
- 報告更直觀：意圖誤分流、缺少 QuickReply 能一眼看出；主管審閱效率提升
- 與既有測試指令完全相容：`node tools/render-suite.js --basic`、`node tools/quick-suite.js --target prod`

## 2025-08-14 - 修復查詢與取消課程上下文問題

### 🐛 Fixed / 💡 Behavior
- **查詢課表上下文修復**：讀取型查詢（`query_schedule`、`query_course_content`）不再自動以上下文補 `courseName`，避免把寬查詢誤縮窄導致「查無資料」
- **課名過濾正規化**：查課表時採用「移除尾字『課』＋雙向包含」比對，修正「跆拳道」≠「跆拳道課」造成的誤過濾
- **取消操作上下文沿用**：取消課程若缺學生姓名，可自動沿用最近查詢會話鎖定的學生（1分鐘窗口），減少重複輸入
- **補充流程完善**：取消課程缺欄位時正確設定 `setExpectedInput`，支援兩句話補完（如：「取消跆拳道」→「取消Lumi的課程」）
- **查詢成功狀態修復**：查詢類意圖成功後不再進入「期待輸入」狀態，避免後續對話被誤判為補充流程

### 🔧 Technical
- 對話記憶 TTL 可設定：新增 `CONVERSATION_TTL_SECONDS`，預設 300 秒（5 分鐘），取代原 30 分鐘固定值
- 統一補充流程資料結構：`setExpectedInput` 使用一致的 `{ intent, existingSlots }` 格式
- 增強日誌追蹤：取消操作沿用查詢會話時輸出 `📎 取消操作沿用查詢會話學生` 日誌

---

## 2025-08-14 - 系統更新 📝

### ✨ Added
- **QuickReply 消息包裝功能**（用戶點擊 QuickReply 按鈕後自動在選項文字外加上【】符號，便於識別和調試，同時保持後端解析純淨消息）

### 🐛 Fixed
- **架構規範修復**（回歸核心設計原則：簡化 regex 規則，模糊語義交由 AI 處理，調整置信度機制確保正確 fallback）
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