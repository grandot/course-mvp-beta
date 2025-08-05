# 配置檔案組織結構

## 📁 目錄說明

### `/mvp/` - Phase 1 當前實現
**狀態**: ✅ 正在使用  
**描述**: MVP 階段的核心配置，專注基礎課程管理功能

- `intent-rules.yaml` - 意圖識別規則
- `course_management.yaml` - 課程管理場景配置  
- `firestore-collections.json` - MVP 資料庫結構

### `/future/` - Phase 2+ 未來功能
**狀態**: 🔄 規劃中  
**描述**: 高級功能配置，暫時不使用但為未來迭代保留

- `slot-template-collections.json` - Slot Template 系統配置
- `memory-system-config.js` - 三層記憶系統配置
- `advanced-analytics.yaml` - 性能分析與監控配置

## 📋 開發階段規劃

### Phase 1: MVP 基礎功能 (當前)
- ✅ 基礎意圖識別
- ✅ 課程新增/修改/查詢/取消
- ✅ Google Calendar 整合
- ✅ LINE Bot webhook

### Phase 2: 高級對話管理 (未來)
- 🔄 Slot Template 多輪對話系統
- 🔄 對話狀態持久化
- 🔄 動態模板配置

### Phase 3: 企業級功能 (遠期)
- 🔄 三層記憶系統
- 🔄 高級性能監控
- 🔄 智能對話分析

## 🎛️ Feature Flag 控制

功能開關配置位於 `src/config/features.js`，控制各階段功能的啟用/關閉。

```javascript
// 檢查功能是否啟用
const { isFeatureEnabled } = require('../src/config/features');

if (isFeatureEnabled('SLOT_TEMPLATE_SYSTEM')) {
  // 啟用 Slot Template 功能
} else {
  // 使用基礎意圖識別
}
```

## 🔄 配置遷移指南

### 當 Phase 2 開發時:
1. 將 `future/slot-template-collections.json` 移至 `mvp/`
2. 更新 `src/config/features.js` 啟用相關功能
3. 更新 `firestore.indexes.json` 包含 Slot Template 索引

### 當 Phase 3 開發時:
1. 整合 `future/memory-system-config.js` 到 `src/config/production.js`
2. 啟用高級監控與分析功能

## ⚠️ 重要提醒

- **MVP 階段請只使用 `/mvp/` 中的配置**
- **不要修改 `/future/` 配置，除非開始對應階段開發**
- **所有功能開關都由 Feature Flag 控制**
- **保持配置文檔與實現的一致性**