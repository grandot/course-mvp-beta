# QA 自動化測試系統

基於第一性原則設計的階段式自動化測試系統，確保 LINE 課程管理機器人的功能完整性和穩定性。

## 🎯 核心特色

- **階段式測試架構** - 解決前置數據依賴問題
- **自動數據管理** - 完全隔離的測試環境
- **智能依賴追蹤** - 確保測試執行順序正確
- **全面錯誤分析** - 詳細的失敗原因分類

## 📁 文件結構

```
QA/
├── README.md                           # 本文檔
├── QA-rules.md                         # QA 執行規範
├── comprehensive-test-plan-revised.md  # 完整測試規劃
├── test-data-management.md            # 數據管理架構說明
├── config/
│   └── test-dependencies.yaml         # 依賴關係配置
├── scripts/
│   ├── test-data-manager.js           # 測試數據管理器
│   ├── automated-test-runner.js       # 自動化執行器
│   └── test-scripts-verification.js   # 腳本功能驗證
└── reports/                           # 測試報告目錄
    └── (自動生成的報告文件)
```

## 🚀 快速開始

### 1. 環境準備

確保以下環境變數已設定：
```bash
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
OPENAI_API_KEY=your_openai_key
FIREBASE_PROJECT_ID=your_firebase_project
```

### 2. 驗證腳本功能

```bash
# 驗證所有測試腳本是否正常工作
node QA/scripts/test-scripts-verification.js
```

### 3. 執行完整測試套件

```bash
# 執行所有階段的測試
node QA/scripts/automated-test-runner.js run

# 只執行特定階段
node QA/scripts/automated-test-runner.js phase A  # 獨立功能測試
node QA/scripts/automated-test-runner.js phase B  # 依賴功能測試
node QA/scripts/automated-test-runner.js phase C  # 複雜操作測試
```

### 4. 單獨使用數據管理器

```bash
# 檢查測試環境
node QA/scripts/test-data-manager.js check

# 清理測試數據
node QA/scripts/test-data-manager.js clean

# 準備特定階段數據
node QA/scripts/test-data-manager.js setup A

# 查看數據摘要
node QA/scripts/test-data-manager.js summary
```

## 📊 階段式測試架構

### Group A: 獨立功能測試（35個用例）
**目標**：測試不需要預置資料的基礎功能
- 新增單次課程（12個用例）
- 新增重複課程（15個用例）
- 系統基礎功能（8個用例）

**特點**：
- 無需前置資料
- 為後續階段建立基礎數據
- 通過率目標：≥90%

### Group B: 依賴功能測試（40個用例）
**目標**：測試需要現有資料的功能
- 查詢課程功能（15個用例）
- 記錄內容功能（15個用例）
- 設定提醒功能（10個用例）

**特點**：
- 依賴 Group A 建立的數據
- 驗證數據讀取和操作功能
- 通過率目標：≥85%

### Group C: 複雜操作測試（20個用例）
**目標**：測試高級功能和系統邊界
- 修改課程功能（8個用例）
- 取消課程功能（7個用例）
- 系統級測試（5個用例）

**特點**：
- 需要完整數據環境
- 測試複雜業務邏輯
- 通過率目標：≥80%

## 🛠️ 核心組件說明

### 1. 測試數據管理器 (`test-data-manager.js`)

**功能**：
- 自動環境檢查和清理
- 階段性數據準備
- 依賴關係驗證
- 測試隔離機制

**核心方法**：
```javascript
// 檢查測試環境
await testDataManager.checkTestEnvironment();

// 清理所有測試數據
await testDataManager.cleanupAllTestData();

// 為特定階段準備數據
await testDataManager.setupPhaseData('A');

// 驗證測試前置條件
await testDataManager.verifyPrerequisites(testCase);
```

### 2. 依賴關係配置 (`test-dependencies.yaml`)

**結構**：
- **phases** - 測試階段定義
- **test_groups** - 測試組配置
- **data_entities** - 數據實體依賴
- **execution_rules** - 執行規則
- **known_issues** - 已知問題標記

**關鍵配置**：
```yaml
phases:
  group_a:
    dependencies: []
    provides: ["basic_students", "basic_courses"]
  group_b:
    dependencies: ["basic_students", "basic_courses"]
    provides: ["course_records", "reminders"]
```

### 3. 自動化執行器 (`automated-test-runner.js`)

**功能**：
- 配置和用例載入
- 階段式執行控制
- 實時結果分析
- 詳細報告生成

**執行流程**：
```
環境檢查 → 數據清理 → Group A → Group B → Group C → 報告生成
```

## 📋 測試用例設計標準

每個測試用例包含：
- **id** - 唯一識別碼（如 A1.1-A）
- **name** - 測試名稱
- **purpose** - 測試目的
- **input** - 測試輸入
- **expected** - 預期結果
- **dependencies** - 依賴條件
- **timeout** - 超時設定

## 🔍 已知問題和限制

### 功能缺陷
1. **每日重複課程未實現** - `handle_add_course_task.js` 的 `calculateNextCourseDate()` 未處理每日循環
2. **圖片上傳功能失效** - LINE Bot API 404錯誤（已從測試中移除）

### 技術限制
- 測試間需要 2-3 秒間隔避免 API 過載
- Redis 連接延遲可能影響回應時間
- 需要完整的 Firebase 環境支持

## 📊 成功標準

- **Group A 通過率**：≥90%
- **Group B 通過率**：≥85%
- **Group C 通過率**：≥80%
- **整體通過率**：≥85%
- **單測試回應時間**：≤5秒

## 🔧 故障排除

### 常見問題

**1. 環境檢查失敗**
```bash
# 檢查環境變數
echo $LINE_CHANNEL_ACCESS_TOKEN
echo $FIREBASE_PROJECT_ID

# 驗證服務連接
curl http://localhost:3000/health
```

**2. 測試數據清理失敗**
```bash
# 手動清理
node QA/scripts/test-data-manager.js clean

# 檢查數據摘要
node QA/scripts/test-data-manager.js summary
```

**3. 依賴檢查失敗**
- 確保前一階段測試成功執行
- 檢查 Firebase 中是否有對應的測試數據
- 查看 `test-dependencies.yaml` 配置是否正確

## 📈 結果分析

### 報告內容
- 階段執行摘要
- 詳細測試結果
- 錯誤分類分析
- 性能指標統計
- 成功標準達成情況

### 報告位置
- 控制台即時輸出
- JSON 詳細報告：`QA/reports/test-report-{timestamp}.json`
- 腳本驗證報告：`QA/reports/script-verification-{timestamp}.json`

## 🎯 最佳實踐

1. **執行前準備**
   - 確保測試環境乾淨
   - 檢查所有依賴服務狀態
   - 備份重要生產數據

2. **測試執行**
   - 使用序列執行避免數據競爭
   - 監控資源使用情況
   - 及時處理失敗測試

3. **結果分析**
   - 重點關注失敗率趨勢
   - 分析錯誤分佈模式
   - 建立回歸測試基線

## 🔄 持續改進

- **每週**：執行完整測試套件，更新成功基線
- **每月**：檢查已知問題修復情況，更新測試用例
- **每季**：評估測試覆蓋率，優化測試架構

---

**最後更新**：2025-08-07  
**維護者**：QA 團隊  
**問題反饋**：請在項目 Issues 中提出