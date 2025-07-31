# 🚀 三層語意記憶系統實施任務清單 (Implementation Task List)

**基於**: design.md 設計方案 + plan.md 實施計劃  
**目標**: 原子化步驟 + checkbox 追蹤進度

---

## 📋 Phase 1: Memory.yaml 系統基礎建設 (2週)

### 🗓️ Week 1: 數據結構設計 + 基礎CRUD

#### Day 1-3: Memory.yaml 數據結構設計
- [x] 定義 UserMemory 介面規格
- [x] 定義 CourseRecord 數據結構
- [x] 定義 StudentPreferences 類型
- [x] 定義 RecentActivity 和 RecurringPattern 結構
- [x] 創建 TypeScript 類型定義文件
- [x] 驗證數據結構與業務需求一致性

#### Day 4-7: 基礎 CRUD 操作實現
- [x] 創建 MemoryYamlService 基礎類
- [x] 實現 loadYamlFile() 方法
- [x] 實現 saveYamlFile() 方法
- [x] 實現 getUserMemory() 方法
- [x] 實現 updateUserMemory() 方法
- [x] 實現 insertOrUpdateRecord() 邏輯
- [x] 實現 maintainRecordLimit() (最多20筆)
- [x] 實現 updateRecurringPatterns() 方法
- [x] 基礎功能單元測試

### 🗓️ Week 2: 快取機制 + 定時更新 + 測試

#### Day 1-3: 快取機制整合
- [x] 設計用戶記憶快取策略 (Map-based)
- [x] 實現快取優先讀取邏輯
- [x] 實現快取同步更新機制
- [x] 添加快取失效和清理邏輯
- [x] 快取性能測試與優化

#### Day 4-5: 定時更新 Job 建立
- [x] 安裝 node-cron 依賴
- [ ] 創建每日凌晨4點更新 cron job
- [ ] 實現 fullRebuildMemory() 方法
- [ ] 實現重複課程自動實例化邏輯
- [ ] 定時任務錯誤處理和重試機制

#### Day 6-7: Phase 1 完整測試
- [x] Memory.yaml 檔案讀寫測試
- [x] 多用戶隔離測試
- [x] 併發操作安全性測試
- [ ] 記憶更新觸發測試
- [ ] 性能基準測試 (響應時間<50ms)

---

## 📋 Phase 2: SmartQueryEngine 建設 (1.5週)

### 🗓️ Week 3: SmartQueryEngine 核心邏輯

#### Day 1-3: 查詢引擎基礎架構
- [x] 創建 SmartQueryEngine 基礎類
- [x] 實現 isExplicitQuery() 檢測方法
- [x] 定義查詢模式 regex patterns
- [x] 實現 detectQueryType() 分類邏輯
- [x] 實現 executeQuery() 路由方法

#### Day 4-7: 查詢類型實現
- [x] 實現 schedule 查詢 (課程時間表)
- [x] 實現 course_list 查詢 (課程列表)
- [x] 實現 teacher_courses 查詢 (按老師查課程)
- [x] 查詢結果格式化處理
- [x] 查詢性能優化 (直接回應不經語意處理)

### 🗓️ Week 4: DataService 整合

#### Day 1-4: 與現有 DataService 整合
- [ ] 創建 EnhancedDataService 繼承現有 DataService
- [ ] 實現 processWithSmartQuery() 方法
- [ ] 整合 SmartQueryEngine 到數據服務
- [ ] 實現 bypassSemanticProcessing 邏輯
- [ ] 向後相容性測試

#### Day 5-7: SmartQuery 測試與驗證
- [x] 明確查詢語句識別測試
- [x] 查詢類型分類準確性測試
- [x] 查詢結果正確性驗證
- [x] 響應時間性能測試
- [x] 邊界情況處理測試

---

## 📋 Phase 3: 智能分流機制整合 (2週) ✅

### 🗓️ Week 5: GPT Fallback with Memory Injection

#### Day 1-3: 增強版 SemanticService 架構
- [x] 創建 EnhancedSemanticService 繼承現有服務
- [x] 整合 MemoryYamlService 和 SmartQueryEngine
- [x] 重構 analyzeMessage() 主流程
- [x] 實現三層記憶加載邏輯
- [x] 實現 SmartQuery 優先檢查

#### Day 4-7: GPT Fallback 記憶注入
- [x] 實現 gptFallbackWithMemory() 方法
- [x] 實現 generateMemorySummary() 格式化
- [x] 設計 GPT prompt 記憶注入模板
- [x] 實現 ConversationContext 注入邏輯  
- [x] 實現部分 slots 補全機制

### 🗓️ Week 6: 完整分流邏輯整合

#### Day 1-3: Regex 優先機制增強
- [x] 創建 EnhancedRegexExtractor 類 (整合在 EnhancedSemanticService 中)
- [x] 實現 extractWithContext() 方法 (enhanceWithTripleMemory)
- [x] 實現 ConversationContext 補全邏輯
- [x] 實現 slots 完整性檢查
- [x] 實現來源標記 (_sources) 機制 (method 欄位)

#### Day 7: 三層記憶更新機制
- [x] 實現 updateTripleMemory() 方法
- [x] ConversationContext 更新邏輯
- [x] Memory.yaml 更新觸發機制
- [x] 記憶更新事務性保證
- [x] 更新失敗補償機制

---

## 📋 Phase 4: ConversationContext 擴展整合 (1週) ✅

### 🗓️ Day 1-3: 觸發範圍擴展

#### ConversationContext 意圖觸發擴展
- [x] 擴展觸發意圖列表 (從3個到15個)
- [x] 添加課程管理意圖觸發 (add_course, query_course, create_recurring_course, stop_recurring_course)
- [x] 添加內容記錄意圖觸發 (record_lesson_content, record_homework, upload_class_photo, modify_course_content)
- [x] 添加查詢場景意圖觸發 (query_schedule, query_course_content)
- [x] 添加提醒設置意圖觸發 (set_reminder, modify_reminder)
- [x] 更新意圖觸發配置

### 🗓️ Day 4-7: 數據結構增強 + 學習機制

#### EnhancedConversationContext 實現
- [x] 創建 EnhancedConversationContext 類
- [x] 擴展數據結構 (recentCourses, recentStudents)
- [x] 添加 userPreferences 學習字段
- [x] 添加 sessionMetadata 會話級數據
- [x] 實現 updateWithLearning() 方法

#### 用戶習慣學習機制
- [x] 實現 learnUserPatterns() 方法
- [x] 實現默認學生學習邏輯 (learnDefaultStudent)
- [x] 實現高頻課程學習邏輯 (findDominantCourses)
- [x] 實現 updateFrequencyStats() 統計方法
- [x] 實現 findDominantPattern() 模式識別 (predictNextAction)

#### 🆕 額外實現功能
- [x] 智能預測下一步操作 (predictNextAction)
- [x] 增強統計信息 (getEnhancedStats)
- [x] 整合到 EnhancedSemanticService
- [x] 完整測試覆蓋 (6/6 項測試通過)
- [x] 整合測試驗證 (4/4 項測試通過)

---

## 📋 Phase 5: 系統整合與優化 (1.5週) ✅

### 🗓️ Week 8 Day 1-3: 端到端整合測試

#### 完整系統整合測試
- [x] 創建 LongMemoryIntegrationTest 測試類
- [x] 實現省略語句智能補全測試場景
- [x] 實現 Memory.yaml 語意接續測試場景
- [x] 實現 SmartQuery 直接回應測試場景
- [x] 實現多輪對話連續性測試
- [x] 實現錯誤處理和降級測試

### 🗓️ Week 8 Day 4-5: 性能優化調優

#### 系統性能優化
- [x] 實現 Memory.yaml LRU 快取策略
- [x] 配置快取大小和 TTL 參數
- [x] 實現批量更新機制 (batchUpdates)
- [x] 優化 Regex 優先覆蓋率 (目標70%)
- [x] 記憶體使用監控和優化

### 🗓️ Week 8 Day 6-7: 生產部署準備

#### 生產環境準備
- [x] 創建生產環境配置文件
- [x] 實現健康檢查端點
- [x] 添加關鍵指標監控
- [x] 實現優雅降級機制
- [x] 生產部署文檔編寫

---

## 📋 開發環境準備任務

### 依賴安裝與配置
- [ ] 安裝 js-yaml 依賴 (^4.1.0)
- [ ] 安裝 node-cron 依賴 (^3.0.2)
- [ ] 安裝 lru-cache 依賴 (^7.14.0)  
- [ ] 安裝 TypeScript 類型定義
- [ ] 更新 package.json 依賴列表

### 資料夾結構建立
- [ ] 創建 src/services/memoryYamlService.js
- [ ] 創建 src/services/smartQueryEngine.js
- [ ] 創建 src/services/enhancedSemanticService.js
- [ ] 創建 src/services/enhancedConversationContext.js
- [ ] 創建 memory/ 資料夾 (用戶記憶檔案)
- [ ] 創建 tests/integration/ 測試資料夾

---

## 🎖️ 驗收標準檢查

### 功能性指標驗證
- [ ] Regex 優先覆蓋率達到 70%
- [ ] Memory.yaml 省略語句補全率達到 80%
- [ ] SmartQuery 明確查詢準確率達到 100%
- [ ] 三層協作切換延遲 < 50ms

### 業務價值指標驗證  
- [ ] 平均對話輪數減少 40%
- [ ] 省略語句處理成功率 > 85%
- [ ] 用戶滿意度反饋 > 90%

### 技術穩定性指標驗證
- [ ] 系統可用性達到 99.5%
- [ ] 整體響應時間增長 < 15%
- [ ] Memory.yaml 更新成功率 > 99%

---

## 🚨 風險緩解任務

### 技術風險處理
- [ ] 實現用戶隔離防止 Memory.yaml 併發寫入衝突
- [ ] 實現 GPT fallback 超時控制和降級機制
- [ ] 實現三層記憶同步事務性更新機制
- [ ] 實現 Regex 規則版本化管理

### 業務風險處理
- [ ] 制定透明化隱私政策說明
- [ ] 實現智能 TTL 和用戶確認機制
- [ ] 完善模組化設計和技術文檔
- [ ] 建立用戶回饋收集機制

---

**📅 最後更新**: 2025-07-31  
**⏱️ 預估總工期**: 8週  
**🎯 成功標準**: 90%+準確率 + <200ms響應時間

*🎯 **使用說明**: 每完成一個任務請標記 checkbox ✅，然後進行下一個任務。建議按照 Phase 順序依序執行，確保每個階段都完整測試通過後再進入下一階段。*