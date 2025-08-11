# 📝 Change Log

## 2025-08-11 - 確認按鈕與 Google Calendar 同步修復 🚀

### 🐛 Fixed
- **確認按鈕功能修復**: 修復意圖識別問題，雙重保險設計確保 100% 識別率
- **Google Calendar 同步修復**: 環境變數載入修復，課程直接寫入日曆

---

## 2025-08-10 - 意圖處理改進 🔧

### 🐛 Fixed
- 意圖誤判修復：record_content 不再被誤判為 add_course
- 錯誤處理增強：統一的錯誤訊息回覆機制

### ✨ Added
- 配置集中化：統一的環境變數管理

---

## 2025-08-07 - Render 測試通過率達 100% 🎉

### ✅ Achievement
- 測試通過率：75% → 100% (提升 25%)
- 意圖支援覆蓋：12/18 → 18/18 (100% 完整覆蓋) 
- 多輪對話成功率：0% → 100%

### ✨ Added
- 每日重複課程功能：支援「小明每天早上8點英文課」
- Mock LINE Service 架構：零風險生產環境測試
- 自動化測試工具：12個測試場景完整覆蓋

### 🔧 Technical
- 智能重複類型識別：daily/weekly/monthly 精確識別
- Google Calendar RRULE 整合：完整的重複規則生成
- 意圖處理器映射修復：6個補充意圖恢復正常

---

## 2025-08-06 - 多輪對話與 Quick Reply 功能 💬

### ✨ Added
- Redis 對話狀態管理：30分鐘對話上下文
- Quick Reply 按鈕：確認/修改/取消操作
- 上下文感知實體提取：智能補充缺失資訊

### 🐛 Fixed
- Redis 連接修復：WRONGPASS 錯誤處理
- 生產環境連接問題：避免 localhost 連接錯誤

---

## 2025-08-05 - MVP 核心功能完成 🎉

### 🐛 Critical Fixes
- Firebase 儲存問題：serverTimestamp() 陣列錯誤修復
- Google Calendar 時間範圍錯誤：時區轉換問題修復
- 中文數字時間支援：完全支援「早上十點」等表達

### ✨ Added
- 完整語意處理系統：意圖識別 + 實體提取
- 五大核心功能：新增/查詢/記錄/提醒/取消課程
- Google Calendar 整合：專精時間邏輯處理
- Firebase 整合：完整資料儲存 + 圖片上傳

### 📈 Performance Metrics
- 意圖識別準確率：76.5%
- 實體提取準確率：82%
- 時間解析覆蓋率：100% (40/40 測試案例)

---

## 📋 Legend

- 🎯 Major Features - 主要功能
- ✨ Added - 新增功能
- 🐛 Fixed - 錯誤修復
- 🚀 Performance - 效能提升
- 🔧 Technical - 技術改進
- 🧪 Testing - 測試相關
- ✅ Achievement - 重要成果