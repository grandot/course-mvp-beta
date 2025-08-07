# 測試數據管理架構

## 🎯 核心理念

基於第一性原則，測試應該**自包含、可重複、無依賴**。每個測試場景都能獨立執行，不依賴外部狀態。

## 📊 階段式測試架構

### Phase 1: 基礎功能測試（無依賴）
**目標**：測試不需要預置資料的功能
- ✅ 新增課程（首次建立）
- ✅ 系統基礎回應
- ✅ 錯誤處理

### Phase 2: 基於已建立資料的功能測試
**前置條件**：Phase 1 成功建立的資料
**目標**：測試需要現有資料的功能
- ✅ 查詢課程（基於 Phase 1 建立的課程）
- ✅ 記錄內容（基於 Phase 1 建立的課程）
- ✅ 設定提醒（基於 Phase 1 建立的課程）

### Phase 3: 複雜操作測試
**前置條件**：Phase 1 + Phase 2 的資料
**目標**：測試高級功能
- ✅ 修改課程
- ✅ 取消課程
- ✅ 多輪對話

---

## 🗄️ 測試數據標準化

### 標準測試學生
```json
{
  "students": [
    {"name": "測試小明", "id": "test_student_001"},
    {"name": "測試Lumi", "id": "test_student_002"}, 
    {"name": "測試小光", "id": "test_student_003"}
  ]
}
```

### 標準測試課程模板
```json
{
  "courses": [
    {
      "studentName": "測試小明",
      "courseName": "測試數學課",
      "scheduleTime": "14:00",
      "courseDate": "TOMORROW",
      "isRecurring": false
    },
    {
      "studentName": "測試Lumi", 
      "courseName": "測試鋼琴課",
      "scheduleTime": "15:30",
      "dayOfWeek": 3,
      "isRecurring": true
    }
  ]
}
```

---

## 🔄 測試流程設計

### 執行順序
```
1. 數據清理 → 2. Phase 1 → 3. Phase 2 → 4. Phase 3 → 5. 數據清理
```

### 每個 Phase 內部結構
```
Phase X:
├── setup_phase_X_data.js     # 準備本階段需要的數據
├── run_phase_X_tests.js      # 執行測試用例
├── verify_phase_X_results.js # 驗證結果並準備下階段數據
└── cleanup_phase_X_temp.js   # 清理臨時數據
```

---

## 📝 具體實現方案

### 1. 測試前置數據腳本
**檔案**: `/QA/scripts/setup-test-data.js`

功能：
- 檢查測試環境
- 清理舊測試資料
- 為每個 Phase 準備標準化數據

### 2. 依賴關係管理
**檔案**: `/QA/scripts/dependency-tracker.js`

功能：
- 追蹤每個測試用例的依賴關係
- 確保執行順序正確
- 在依賴失敗時跳過相關測試

### 3. 數據隔離機制
**規則**:
- 測試用戶ID: `U_test_*` 
- 測試學生前綴: `測試*`
- 測試課程前綴: `測試*`
- 自動識別並清理

---

## 🎨 測試用例重新分組

### Group A: 獨立功能測試（35個用例）
**無需前置資料**
- 新增課程 - 各種格式、錯誤處理
- 系統回應 - 意圖識別、格式處理
- 多輪對話 - 補充資訊流程

### Group B: 依賴功能測試（40個用例）  
**依賴 Group A 建立的資料**
- 查詢課程 - 各種時間範圍
- 記錄內容 - 文字記錄、內容查詢
- 設定提醒 - 提醒設定、提醒查詢

### Group C: 複雜操作測試（20個用例）
**依賴 Group A + B 的完整數據**
- 修改課程 - 時間修改、資訊修改
- 取消課程 - 單次取消、重複取消
- 系統級測試 - 併發、壓力測試

---

## 🛠️ 實現工具

### 1. 數據管理腳本
```javascript
// /QA/scripts/test-data-manager.js
class TestDataManager {
  async setupPhaseData(phase) {
    // 準備該階段需要的數據
  }
  
  async cleanupTestData() {
    // 清理所有測試數據
  }
  
  async verifyPrerequisites(testCase) {
    // 驗證測試前置條件
  }
}
```

### 2. 依賴關係配置
```yaml
# /QA/config/test-dependencies.yaml
groups:
  group_a:
    dependencies: []
    provides: ["basic_students", "basic_courses"]
    
  group_b:
    dependencies: ["basic_students", "basic_courses"] 
    provides: ["course_records", "reminders"]
    
  group_c:
    dependencies: ["basic_students", "basic_courses", "course_records"]
    provides: []
```

### 3. 自動化執行腳本
```javascript
// /QA/scripts/run-staged-tests.js
async function runStagedTests() {
  await cleanupEnvironment();
  
  const groupA = await runGroup('A', testCasesGroupA);
  if (groupA.success < 0.8) throw new Error('Group A 失敗率過高');
  
  const groupB = await runGroup('B', testCasesGroupB);
  const groupC = await runGroup('C', testCasesGroupC);
  
  await generateReport([groupA, groupB, groupC]);
  await cleanupEnvironment();
}
```

---

## 📈 品質保證指標

### 數據一致性
- 測試前後數據狀態完全相同
- 無測試殘留數據
- 無數據污染

### 測試可靠性  
- Group A 通過率 ≥ 90%
- Group B 通過率 ≥ 85%
- Group C 通過率 ≥ 80%

### 執行效率
- 數據準備時間 ≤ 30秒
- 單個測試執行時間 ≤ 5秒
- 總測試時間 ≤ 3小時

---

## 🎯 下一步實現

1. **建立數據管理腳本**
2. **重新分組測試用例**  
3. **建立依賴關係配置**
4. **修訂測試規劃文檔**
5. **執行階段式測試**

這套架構解決了前置數據問題，讓每個測試都能在乾淨環境中獨立執行，同時最大化覆蓋率和可靠性。