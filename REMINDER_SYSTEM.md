# 提醒執行器系統

LINE 課程管理機器人的自動提醒系統，負責在對的時間自動推送提醒到 LINE。

## 📋 系統概述

本系統採用「規則先行、AI 補強」的架構設計，提供完整的提醒執行、邊界處理、監控與觀測功能。

### 核心特性

- ✅ **可開關的提醒執行器** - 透過環境變數控制
- ✅ **邊界處理** - 取消課程、過期窗口、失敗重試
- ✅ **基礎日誌與統計** - 執行時間、處理數量、錯誤記錄  
- ✅ **觀測與監控** - 健康檢查、告警、性能指標
- ✅ **Firebase Functions 整合** - 定時任務與 HTTP API

---

## 🚀 快速開始

### 環境變數設定

```bash
# 提醒功能開關
REMINDER_EXECUTOR_ENABLED=true

# 時間配置（分鐘）
REMINDER_SCAN_INTERVAL=5      # 掃描間隔
REMINDER_EXPIRE_WINDOW=60     # 過期窗口

# 重試配置
REMINDER_MAX_RETRY=3          # 最大重試次數
REMINDER_RETRY_DELAY=5        # 重試延遲（分鐘）

# 批次處理
REMINDER_BATCH_SIZE=50        # 批次大小
```

### 基本使用

```javascript
const { reminderExecutor } = require('./src/services/reminderExecutorService');

// 執行提醒檢查
const result = await reminderExecutor.execute();
console.log('執行結果:', result.summary);

// 檢查狀態
console.log('功能開啟:', reminderExecutor.isEnabled());
console.log('統計資料:', reminderExecutor.getStats());
```

---

## 🏗️ 系統架構

### 核心元件

```
ReminderExecutor (主執行器)
├── ExecutionStats (統計記錄)
├── ReminderHealthChecker (健康檢查)
├── ReminderLogger (日誌格式化)
└── Firebase Functions (定時任務)
```

### 資料流程

```
定時觸發 → 掃描提醒 → 邊界檢查 → 批次發送 → 統計記錄 → 健康檢查
```

---

## 📊 監控與觀測

### HTTP API 端點

| 端點 | 功能 | 回應格式 |
|------|------|----------|
| `/triggerReminderCheck` | 手動觸發提醒檢查 | `{ success, result }` |
| `/getReminderStats` | 取得執行統計 | `{ success, stats, config }` |
| `/getReminderHealth` | 健康檢查 | `{ success, health, monitoring, metrics }` |

### 統計指標

- **處理量統計**: 掃描數、發送數、成功率
- **延遲指標**: 執行時間、平均處理時間
- **錯誤統計**: 錯誤率、最近錯誤記錄
- **分佈統計**: 發送、失敗、過期、取消數量

### 健康檢查

```javascript
const health = await healthChecker.checkHealth();
// 回傳: { status: 'healthy|warning|critical', alerts: [], recommendations: [] }
```

---

## 🛡️ 邊界處理

### 1. 過期窗口處理

- 提醒觸發時間超過設定窗口時自動標記為過期
- 預設窗口：60分鐘
- 過期提醒不會發送，直接標記狀態

### 2. 取消課程處理

- 檢查關聯課程是否已取消
- 自動跳過已取消課程的提醒
- 標記提醒狀態為 `cancelled`

### 3. 失敗重試機制

- 發送失敗時自動安排重試
- 最大重試次數：3次
- 重試延遲：5分鐘
- 超過重試上限標記為 `failed`

### 4. 併發保護

- 防止多個執行器同時運行
- 運行中的執行器會跳過新的觸發
- 確保系統資源穩定

---

## 🔧 測試與驗證

### 單元測試

```bash
# 基礎功能測試
node test-reminder-executor.js

# 完整系統測試
node test-reminder-system.js
```

### 測試覆蓋

- ✅ 配置檢查
- ✅ 執行器功能
- ✅ 健康檢查
- ✅ 監控功能
- ✅ 邊界情況
- ✅ API 端點模擬

---

## 📝 日誌格式

### 執行日誌

```
[INFO] 提醒執行器完成:
  ⏱️  執行時間: 336ms
  📊 掃描: 5, 發送: 3, 失敗: 1
  ⚠️  過期: 1, 取消: 0, 錯誤: 0
```

### 健康檢查日誌

```
✅ 提醒系統健康檢查: HEALTHY
⚠️ 提醒系統健康檢查: WARNING
  告警 (1):
    1. 錯誤率偏高: 15.2%
  建議:
    1. 檢查 Firebase 連接和索引設定
```

### 性能指標日誌

```
📈 提醒系統性能指標:
  處理量: 10 筆, 成功率: 85.0%
  延遲: 450ms (平均 45.0ms/筆)
  錯誤率: 10.0%
```

---

## 🚨 告警機制

### 警告閾值

- 錯誤率 > 10%
- 失敗率 > 20%  
- 執行時間 > 30秒

### 嚴重閾值

- 錯誤率 > 30%
- 失敗率 > 50%
- 執行時間 > 60秒

### 健康狀態

- `healthy` - 系統正常運行
- `warning` - 需要關注，但仍可運行
- `critical` - 嚴重問題，需要立即處理
- `disabled` - 功能已停用

---

## 📋 部署清單

### 必要步驟

1. **環境變數設定**
   - [ ] 設定 `REMINDER_EXECUTOR_ENABLED=true`
   - [ ] 配置時間和重試參數
   - [ ] 確認 Firebase 連接

2. **Firebase 設定**
   - [ ] 建立 Firestore 索引（複合索引：executed + triggerTime）
   - [ ] 設定 Functions 部署
   - [ ] 配置 LINE API token

3. **監控設定**
   - [ ] 設定健康檢查端點
   - [ ] 配置告警通知
   - [ ] 測試 API 回應

### 驗證檢查

```bash
# 檢查配置
curl -X GET "https://your-function-url/getReminderStats"

# 健康檢查
curl -X GET "https://your-function-url/getReminderHealth"

# 手動觸發
curl -X POST "https://your-function-url/triggerReminderCheck"
```

---

## 🔮 未來擴展

- 📊 Grafana 監控儀錶板整合
- 🔔 Slack/Email 告警通知
- 📈 更細粒度的性能分析
- 🎯 智能重試策略（指數退避）
- 🔄 藍綠部署支援

---

## 📞 支援與維護

- **日誌位置**: Firebase Functions 日誌
- **監控端點**: `/getReminderHealth`
- **手動觸發**: `/triggerReminderCheck`
- **緊急停用**: 設定 `REMINDER_EXECUTOR_ENABLED=false`