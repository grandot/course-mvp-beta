# Changelog

All notable changes to this project will be documented in this file.

## [v15.0.0] - 2025-07-31 🎯 第一性原則語氣系統重構：統一溫暖活潑體驗

### ✨ 用戶體驗根本改善
- **🚨 問題根因**: 多語氣風格切換導致用戶體驗不一致，感覺在與陌生人對話
- **🎯 第一性原則**: 用戶需要一個溫暖、一致的助理，而非多個令人困惑的風格選擇
- **⚡ 剃刀法則**: 用戶體驗一致性 > 技術靈活性，簡單即美

### 🎭 語氣系統重大重構

#### 重構前問題：
```javascript
❌ 三種語氣風格 (warm/cheerful/calm) + 自動切換
❌ 用戶困惑：今天溫暖，明天專業，後天活潑
❌ 過度工程：200+ 行複雜選擇邏輯
```

#### 重構後解決方案：
```javascript
✅ 統一溫暖活潑風格 (warm_cheerful)
✅ 固定語氣配置，確保每次互動一致
✅ 簡化架構：移除多風格選擇，專注用戶價值
```

### 🔧 核心組件重構

#### 1. UnifiedToneManager
- **移除**: 多風格配置系統、自動切換邏輯、用戶偏好調整
- **統一**: 固定溫暖活潑語氣風格
- **新增**: `enhanceMessage()` 統一語氣增強
- **保留**: 向後兼容 `ToneManager` 別名

#### 2. UnifiedFewShotManager  
- **簡化**: 從複雜嵌套結構改為扁平化場景管理
- **統一**: 所有範例使用一致的溫暖活潑語氣
- **場景**: 6種核心場景 (new_course, follow_up, need_info, chat_redirect, error_handling, success)
- **移除**: 智能選擇、多風格映射、複雜權重計算

#### 3. LineController 重複邏輯移除
- **整合**: 統一使用 `SlotTemplateManager.processWithProblemDetection()`
- **新增**: `convertSlotStateToEntities()` 格式轉換
- **新增**: `handleSlotTemplateResponse()` 統一響應處理
- **移除**: `checkCourseCompleteness`, `detectSupplementInfo`, `mergeContextWithSupplement`

#### 4. 配置管理系統
- **新增**: `ConfigManager` 統一配置管理
- **支援**: 環境變數覆蓋、運行時配置更新、文件監聽
- **整合**: `HumanPromptGenerator` 使用 ConfigManager
- **文件**: `config/slotTemplateConfig.json` 集中化配置

### 🎯 用戶體驗展示

#### 統一語氣風格範例：
```
新增課程: "太好了！已為你安排明天下午兩點的鋼琴課喔～需要提醒嗎？🎹"
缺少信息: "✅ 已記錄：下午兩點 還需要確認上課日期喔～比如：明天、後天、7月30日 😊"
延續對話: "好的～還有什麼課程要安排嗎？😊"
任務完成: "完成啦！🎉 所有資訊都收集完畢～正在為你安排課程中..."
```

### 📊 技術改進成果
- **代碼簡化**: 移除 200+ 行複雜多風格邏輯
- **性能提升**: 減少運行時選擇判斷，降低內存使用
- **維護性**: 統一語氣管理，簡化測試用例
- **向後兼容**: 保留舊類名別名，平滑遷移

### 🚀 核心價值實現
- ✅ **用戶體驗一致性**: 每次互動都是同一個熟悉助理
- ✅ **溫暖有溫度**: 讓冰冷的系統變得親切
- ✅ **適度活潑**: 增加互動樂趣但不過度
- ✅ **系統可靠性**: 簡化邏輯，降低故障風險

### 📁 新增檔案
- `src/tone/toneManager.js` → UnifiedToneManager (重構)
- `src/tone/fewShotExamples.js` → UnifiedFewShotManager (重構)
- `src/config/configManager.js` → 統一配置管理器
- `config/slotTemplateConfig.json` → 集中化配置文件
- `examples/unified-tone-demo.js` → 統一語氣系統展示

### 🔧 修改檔案
- `src/controllers/lineController.js` → 移除重複邏輯，整合統一處理
- `src/slot-template/humanPromptGenerator.js` → 整合 ConfigManager
- `CLAUDE.md` → 更新架構約束說明

---

## [v14.0.0] - 2025-07-31 🎯 第一性原則重大架構重構：Regex優先 → OpenAI Fallback

### ✨ 架構哲學根本變革
- **🚨 問題根因**: 過度依賴OpenAI導致簡單操作成本高、延遲大、準確性反而不如規則
- **🎯 第一性原則**: 確定性操作用確定性方法(Regex)，模糊操作才用智能推理(OpenAI)
- **⚡ 剃刀法則**: 最簡單的解決方案往往是最好的，不要過度設計

### 🏗️ 核心架構重構
```javascript
// 舊架構：OpenAI優先 → 規則Fallback (v13.0.0之前)
const openaiResult = await OpenAI.analyzeIntent(text);
if (openaiResult.success) return OpenAI結果;
else return 規則引擎兜底;

// 新架構：Regex優先 → OpenAI Fallback (v14.0.0)
const ruleResult = IntentRuleEngine.analyzeIntent(text);
if (ruleResult.confidence > 0.7) return Regex結果;  // 70%+ 案例，瞬間響應
else return await OpenAI.analyzeIntent(text);       // 30% 案例，智能處理
```

### 🔧 完整系統改造
1. **IntentRuleEngine**: 恢復完整正則邏輯，移除人工限制
2. **SemanticService**: 主流程反轉，Regex優先判斷(confidence>0.7)
3. **extractStudentName**: 恢復多層次正則匹配策略，支持中英文名稱
4. **規則配置增強**: 新增過去時間課程內容記錄支持(昨天/前天/上週)

### 🎯 關鍵問題修復
- **「昨天的科學實驗課老師說表現很好」正確識別**: 
  - 修復前: `record_course` ❌ (OpenAI誤判為新增課程)
  - 修復後: `record_lesson_content` ✅ (Regex精確匹配過去課程內容)

### 📊 預期效果提升
| 指標 | 舊架構(OpenAI優先) | 新架構(Regex優先) | 改善幅度 |
|------|-------------------|-------------------|----------|
| 響應速度 | 200-500ms | 50-100ms | 75%+ ⬇️ |
| OpenAI成本 | 100% | 30% | 70% ⬇️ |
| 準確性 | 語義理解好但邊界模糊 | 明確操作100%準確 | 提升 ⬆️ |
| 系統穩定性 | 依賴外部API | 本地規則可靠 | 大幅提升 ⬆️ |

### 🛡️ 永不失效保障
- **三層容錯架構**:
  1. Regex主路徑(70%+ 案例)
  2. OpenAI智能路徑(複雜案例)  
  3. 規則引擎最終兜底(任何情況都有結果)

### 🎯 符合第一性原則
- **根本問題**: 不是所有語義理解都需要AI，簡單操作用簡單方法
- **根本解決**: 各司其職，規則處理確定性，AI處理模糊性
- **長期價值**: 成本可控、性能可預測、擴展性更強

## [v13.0.0] - 2025-07-31 🔥 剃刀法則重大突破：課程內容記錄智能化

### ✨ 核心問題解決
- **🎯 場景**: 「今天上課很專心」缺課程名稱，無法記錄
- **❌ 過度工程化方案**: 新增Helper類、複雜狀態管理、多層查詢邏輯
- **✅ 剃刀法則方案**: OpenAI prompt 4行修改 + TaskService 1個方法

### 🧠 OpenAI Prompt智能化
```javascript
// 新增特殊場景識別
- ⚠️ 特殊：內容描述但缺少課程名稱 = query_today_courses_for_content (查詢今天課程來記錄內容)

// 新增範例
- "今天上課很專心" → query_today_courses_for_content (需查詢今天課程)
```

### 🎯 TaskService極簡實現
- **新增意圖**: `query_today_courses_for_content`
- **新增方法**: `queryTodayCoursesForContent()` - 50行搞定完整邏輯
- **智能分流**:
  - 0堂課 → 詢問新增課程
  - 1堂課 → 確認記錄到該課程  
  - 多堂課 → 用戶選擇課程

### 🔄 完整業務流程
1. 🧠 **語義識別**: OpenAI直接識別 `query_today_courses_for_content`
2. 🔍 **課程查詢**: 自動查詢今天課程安排
3. 💬 **智能對話**: 根據課程數量動態響應
4. ✅ **內容記錄**: 將內容關聯到正確課程

### 📊 性能對比
| 方法 | 複雜度 | 代碼行數 | 架構影響 | 維護成本 |
|------|--------|----------|----------|----------|
| 過度工程化 | 🔴 高 | +200行 | 🔴 新增類 | 🔴 高 |
| **剃刀法則** | 🟢 低 | +50行 | 🟢 零影響 | 🟢 低 |

### 🧪 測試驗證
- ✅ 「今天上課很專心」→ `query_today_courses_for_content` (信心度: 0.95)
- ✅ 「明天數學課很專心」→ `record_course` (正確區分)
- ✅ 完整多輪對話流程測試通過

## [v12.0.0] - 2025-07-31 🎯 第一性原則語義識別重大修復：OpenAI極簡化+Fallback超詳細化

### Fixed - 時間語境判斷根本問題修復
- **🔥 原始問題**: "昨天的科学实验课 老师说他表现很好 成功造出来火箭" 被誤判為 `record_course`
- **🎯 根本原因**: OpenAI prompt 過度詳細限制語義理解，且fallback無法處理時間語境
- **第一性原則分析**: 
  - OpenAI 應發揮語義理解優勢，不應被硬編碼規則限制
  - Fallback 應超詳細覆蓋所有邊緣情況，確保容錯性
  - 必須拒絕非課程管理內容，避免閒聊干擾

### Changed - 雙層架構重新設計
- **OpenAI Prompt 極簡化**: 從過度詳細回歸純語義理解
  ```javascript
  // 修復前：限制性詳細規則
  🎯 意圖識別指南：
  - **record_course**: 一次性課程 (明天、後天、特定日期)
  - 包含"昨天、前天、上週、已經、表現、回饋"等過去語境時，通常不是 record_course
  
  // 修復後：核心判斷原則
  核心判斷原則：
  - 過去時間(昨天/前天/上週) + 課程描述/回饋 = query_schedule
  - 未來時間(明天/後天/下週) + 課程安排 = record_course
  ```
- **Fallback 超詳細化**: 多優先級檢測體系
  - 🚨 優先級1: 過去語境檢測 (confidence=0.9) - 防止誤判為新增課程
  - 🚨 優先級2: 重複課程檢測 (confidence=0.85)
  - 🚨 優先級3: 一次性課程檢測 (嚴格條件)
  - 🚨 優先級4: 其他明確意圖檢測

### Added - 非課程管理內容拒絕機制
- **閒聊內容過濾**: OpenAI 和 Fallback 雙重檢測
  - 新增意圖: `not_course_related`
  - 關鍵詞檢測: 40+ 課程相關詞彙白名單
  - 拒絕訊息: "抱歉，我是課程管理助手，只能協助處理課程相關的事務"
- **SemanticService 集成**: 完整的內容過濾與用戶友好回應

### Enhanced - 實體提取精確化
- **Fallback 實體提取**: 5層精確匹配
  - 課程名稱: 多模式匹配，常見課程識別
  - 時間提取: HH:MM、中文數字、時段識別
  - 日期提取: 完整相對與絕對時間
  - 地點提取: 教室、場館模式識別
  - 老師提取: 多種稱謂模式處理

### Results - 完美修復驗證
**🎉 關鍵案例測試結果**:
- ✅ "昨天的科学实验课 老师说他表现很好 成功造出来火箭" → `query_schedule` (修復成功)
- ✅ "明天下午3點有數學課" → `record_course` (正確)
- ✅ "LUMI每週三下午三點有科學實驗課" → `create_recurring_course` (正確)
- ✅ "你好" → `not_course_related` (正確拒絕)
- ✅ "天氣怎麼樣" → `not_course_related` (正確拒絕)

**架構效果**:
- 🎯 OpenAI 優先發揮語義理解能力 (90%+ 案例)
- 🛡️ Fallback 提供完整容錯保障 (邊緣案例)
- 🚫 內容相關性過濾避免無關干擾
- 📊 第一性原則: 完全正確辨識用戶語義

## [v11.2.0] - 2025-07-31 🎯 第一性原則架構修復：統一OpenAI優先策略

### Fixed - 重大架構問題修復
- **🚨 混合架構根本問題解決**: 基於第一性原則重新設計語義理解架構
  - **根本問題識別**: 意圖識別使用"規則優先→OpenAI後備"，實體提取使用"OpenAI優先→正則後備"，違反剃刀法則
  - **設計矛盾**: 規則引擎高confidence直接返回，阻斷OpenAI分析機會，導致重複課程無法正確識別
  - **第一性原則分析**: 統一語義理解路徑比混合決策更簡潔、可靠、準確

### Changed - 統一OpenAI優先架構
- **SemanticService 架構重構**: 完全統一為OpenAI優先策略
  ```javascript
  // 修復前：混合邏輯
  if (ruleResult.confidence > 0) return 規則結果; // 阻斷OpenAI
  // 修復後：統一優先
  const openaiResult = await OpenAI.analyzeIntent();
  if (openaiResult.success) return OpenAI結果;
  else return 規則引擎容錯兜底;
  ```
- **意圖識別與實體提取**: 統一使用相同的優先策略，符合第一性原則

### Enhanced - OpenAI能力完善
- **OpenAI Prompt 修復**: 添加完整重複課程意圖支持
  - 新增意圖: `create_recurring_course`, `modify_recurring_course`, `stop_recurring_course`
  - 明確識別指南: 重複關鍵詞(每週、每天、每月)的優先級處理
  - 具體範例: "LUMI每週三下午三點有科學實驗課" → create_recurring_course
- **JSON解析容錯增強**: 
  - 控制字符處理: 移除`[\x00-\x1F\x7F]`避免解析失敗
  - 多層修復策略: 未閉合字符串、缺失括號、多餘逗號
  - 智能降級: JSON失敗時啟用增強的關鍵詞fallback

### Technical - Fallback機制完善
- **fallbackIntentAnalysis 重構**: 添加完整重複課程處理邏輯
  - 重複課程優先級: confidence=0.8，高於一般課程
  - 智能排除邏輯: record_course檢查重複關鍵詞，避免誤判
  - 精確實體提取: 修復貪婪匹配，"LUMI每週三...科學實驗課" → "科學實驗課"
- **IntentRuleEngine 優化**: 啟用required_keywords檢查，確保重複課程強制匹配

### Results - 修復效果驗證
- **測試案例**: "LUMI每週三下午三點有科學實驗課"
  - 修復前: `intent: record_course` ❌ (規則引擎阻斷OpenAI)
  - 修復後: `intent: create_recurring_course` ✅ (OpenAI優先正確分析)
- **實體提取精確性**:
  - 課程名稱: "科學實驗課" ✅ (修復貪婪匹配)
  - 學生姓名: "LUMI" ✅
  - 重複模式: "每週三" ✅
  - 時間解析: "08/06 3:00 PM" ✅

### Architecture Philosophy
- **🎯 第一性原則勝利**: 統一語義理解路徑，OpenAI負責準確理解，規則引擎負責容錯保底
- **⚡ 剃刀法則應用**: 消除不必要的混合架構複雜性，單一決策路徑更簡潔可靠
- **🔧 永不失效原則**: 多層容錯機制確保任何情況下都有基礎功能保障
- **📈 可擴展設計**: 統一架構更容易維護和擴展新功能

## [v11.1.0] - 2025-07-30 🎯 第一性原則實現：真實圖片存儲

### Added - Firebase Storage 圖片存儲功能
- **🏗️ 完整Firebase Storage集成**: 基於第一性原則解決MVP核心需求
  - **根本問題**: Mock存儲違背MVP承諾「圖片存進該堂課中，可下載」
  - **MVP價值**: 家長可真實保存和下載課程照片，實現週報功能
  - **技術實現**: 遵循服務層邊界的三層架構設計

### Service Layer Architecture
- **FirebaseService擴展**: 添加Storage操作能力
  - `uploadFile(buffer, filePath, metadata)` - Firebase Storage上傳
  - `getDownloadURL(filePath)` - 獲取公開訪問URL
  - `deleteFile(filePath)` - 文件刪除管理
  - Storage健康檢查和錯誤診斷

- **DataService統一API**: 媒體管理統一入口
  - `uploadMedia(buffer, metadata)` - 統一媒體上傳接口
  - 智能文件路徑生成: `media/{type}/{userId}/{courseId}/{timestamp}.jpg`
  - 完整元數據管理和錯誤處理

- **LineController適配**: 移除Mock實現
  - 真實Firebase Storage調用替代假URL生成
  - 保持API兼容性，無破壞性變更
  - 統一課程架構整合: 圖片URL存入`media_urls[]`

### Data Flow (Final)
```javascript
LINE圖片 → LineController → DataService.uploadMedia() 
         → FirebaseService.uploadFile() → Firebase Storage
         → 真實下載URL → 統一課程架構 media_urls[]
```

### File Structure
```
media/
├── course_photo/
│   └── {userId}/
│       └── {courseId}/
│           └── {timestamp}_{random}.jpg
└── homework_photo/
    └── {userId}/
        └── {timestamp}_{random}.jpg
```

### Technical Achievements
- **🎯 第一性原則**: 圖片是MVP核心功能，不是可選裝飾
- **💪 服務邊界**: 嚴格遵循架構約束，無跨層調用
- **🔒 數據完整性**: 真實存儲確保下載和週報功能
- **⚡ 統一架構**: 與課程記錄無縫整合
- **📈 擴展性**: 支持多種媒體類型和用戶組織

### Configuration Required
- Firebase Storage需要在Console中啟用並創建默認bucket
- Bucket名稱: `{FIREBASE_PROJECT_ID}.appspot.com`
- 開發環境建議使用測試模式安全規則

### Next Steps
- 用戶需在Firebase Console創建Storage bucket以啟用功能
- 完整功能驗證需要bucket配置完成

## [v11.0.0] - 2025-07-30 🎯 第一性原則重構：統一課程架構

### Breaking Changes - 資料庫架構重大重構
- **🏗️ 統一課程數據結構**: 基於第一性原則重新設計
  - **根本問題識別**: 分離集合設計違反數據原子性，物理刪除導致數據永久丟失
  - **統一集合**: `courses` + `course_contents` → `courses_unified`
  - **軟刪除**: `status: 'deleted'` + `deleted_at` 替代物理刪除
  - **datetime 字段**: `course_date` + `schedule_time` → `datetime: "2025-07-30T14:00:00Z"`
  - **簡化媒體**: `class_media[]` → `media_urls[]`
  - **整合內容**: `lesson_content` + `homework` → `notes`

### Database Migration
- **🔄 完整數據遷移**: 14 筆課程 + 1 筆內容 → 14 筆統一課程
- **💾 自動備份**: 原始數據備份至 `courses_backup_*` 和 `course_contents_backup_*`  
- **🔍 孤立數據修復**: 發現並解決 1 筆孤立的課程內容記錄
- **📊 統計報告**: 完整的遷移追蹤和驗證

### Service Layer Refactoring
- **DataService 重構**: 移除所有 `course_contents` 相關方法
- **軟刪除實現**: `clearUserCourses()` 和 `deleteCourse()` 改為狀態更新
- **查詢優化**: 預設過濾已刪除記錄，支持 `include_deleted` 參數
- **重複課程簡化**: `recurrence_type: 'daily|weekly|monthly'`

### Data Structure (Final)
```javascript
{
  "id": "course-uuid-1234",
  "student_id": "student-lumi-001", 
  "course_name": "鋼琴課",
  "datetime": "2025-07-30T14:00:00Z",
  "location": "A教室",
  "teacher_id": "teacher-wang-123",
  "status": "active",                  // active, deleted, completed
  "deleted_at": null,
  "notes": "今天學了C大調",
  "media_urls": ["https://.../photo1.jpg"],
  "is_recurring": false,
  "recurrence_type": null,             // daily, weekly, monthly
  "created_at": "2025-07-30T08:00:00Z"
}
```

### Technical Achievements
- **🎯 第一性原則**: 課程為主體，所有相關數據為屬性
- **💪 數據完整性**: 消除孤立數據和跨集合一致性問題  
- **🔒 數據安全**: 軟刪除保護，支持數據恢復
- **⚡ 查詢效率**: 單集合查詢，避免複雜 JOIN
- **📈 擴展性**: 統一結構支持未來功能擴展

### Testing & Validation
- **✅ 架構測試**: 統一結構功能驗證通過
- **✅ 軟刪除測試**: 狀態管理機制正常
- **✅ 查詢測試**: 按學生、時間、狀態篩選正常
- **✅ 內容測試**: 筆記和媒體整合正常

## [v10.6.0] - 2025-07-30

### Fixed
- **🎯 系統永不失效原則：完善所有 OpenAI Fallback 機制**
  - **根本問題**: 多個關鍵流程缺乏 fallback，違反「永不失效」核心原則
  - **修復範圍**: 
    - `clear_schedule` 意圖 100% 失效 → 完整 fallback 支持
    - `analyzeIntent` JSON 解析失敗 → 關鍵詞 fallback
    - `extractAllEntities` API 失敗 → 結構化正則 fallback
  - **修復文件**:
    - `IntentRuleEngine.js`: 添加 clear_schedule 基礎關鍵詞識別
    - `OpenAIService.js`: 新增 fallbackIntentAnalysis + fallbackExtractEntities
  - **技術細節**:
    - 清空課表支持: "清空課表"、"刪除所有課程"、"重置課表"
    - 意圖識別 fallback: 6個核心意圖的關鍵詞匹配
    - 實體提取 fallback: 學生名稱、課程名稱、時間、地點結構化提取
  - **效果驗證**: 測試通過率從 0/4 提升至 4/4，系統真正永不失效

### Technical
- **🔧 修復 IntentRuleEngine intent_name 傳遞問題**
  - 問題: matchRule 無法接收 intent_name，導致 fallback 邏輯失效
  - 解決: 在 analyzeIntent 中正確傳遞 intent_name 給 rule 對象
  - 影響: 所有基礎 fallback 邏輯現在可正常工作

## [v10.5.0] - 2025-07-30

### Fixed
- **🎯 修復學生課表查詢核心問題**: "LUMI課表" 返回所有課表而非 LUMI 專屬課表
  - **根本原因分析**: OpenAI prompt 缺少課表查詢範例，學生名稱驗證不支持英文，字段命名不統一
  - **三層問題修復**:
    1. **OpenAI prompt 優化**: 新增 "LUMI課表"、"小美課表"、"查詢小光的課程安排" 範例
    2. **多語言學生名稱支持**: `isValidStudentName` 支持中文和英文名稱 (小美、LUMI、John)
    3. **字段命名統一**: 全系統 `child_name` → `student_name` 統一重構
  - **修復範圍**: 5個核心文件完整重構
    - `SemanticService.js`: 學生名稱提取與驗證邏輯
    - `TaskService.js`: 日期範圍計算中的學生過濾
    - `CourseManagementScenarioTemplate.js`: 課程查詢與學生信息處理
    - `LineController.js`: LINE bot 回復格式化
    - `RecurringCourseCalculator.js`: 重複課程學生信息保留

### Added
- **🏗️ 智能語義分析架構升級**: OpenAI → 正則 Fallback
  - **架構演進**: 從 "正則→OpenAI" 到 "純OpenAI" 最終到 "OpenAI→正則Fallback"
  - **第一性原則**: AI 負責語義理解，正則負責容錯保底
  - **三層智能 Fallback**:
    1. **IntentRuleEngine**: 基礎關鍵詞 Fallback (課表查詢、記錄課程、取消課程)
    2. **學生名稱糾錯**: 智能從 "LUMI課" 提取 "LUMI"，支持中英文
    3. **課程名稱提取**: 意圖導向正則 Fallback，簡化複雜度
  - **系統可靠性**: 確保核心功能永不失效，OpenAI 失敗時無縫降級

### Changed
- **📝 架構文檔全面更新**: `docs/Regexp-block-test.md`
  - 重命名為 "智能語義分析架構演進記錄"
  - 詳細的三階段演進歷史
  - 完整的 Fallback 實現細節
  - 生產環境監控指標

## [v10.4.0] - 2025-01-30

### Changed
- **🚨 全面禁用正則表達式語義過濾 - 基於第一性原則的架構決策**
  - **根本問題分析**: 正則表達式泛化能力差，邊界條件處理困難，導致語義理解頻繁出錯
  - **典型錯誤案例**:
    - "小美後天晚上六點半鋼琴課" → 學童名稱識別失敗
    - "老師說lumi今天的科學實驗表現很好" → 錯誤識別為新增課程而非課程內容記錄
  - **第一性原則**: 正則表達式本質是**語法匹配工具**，不適合處理需要**語義理解**的自然語言任務
  - **禁用範圍**:
    - `IntentRuleEngine`: 50+ 正則模式全面禁用，強制 confidence=0
    - `extractChildName`: 6個學童名稱匹配策略禁用
    - `intelligentCourseExtraction`: 8個課程提取模式禁用
  - **系統流程變化**: 
    - 之前: 用戶輸入 → 正則過濾 → OpenAI後備
    - 現在: 用戶輸入 → 直接OpenAI處理 (100%案例)
  - **預期效果**: 語義理解準確度大幅提升，邊界條件錯誤減少
  - **詳細記錄**: 參見 `docs/Regexp-block-test.md`

### Added
- **📋 正則禁用完整文檔**: `docs/Regexp-block-test.md`
  - 禁用原因與第一性原則分析
  - 詳細的代碼修改記錄
  - 重新啟用的時機與條件
  - 監控指標與測試方法

## [v10.3.1] - 2025-07-30

### Fixed
- **🎯 基於第一性原則修復學童名稱識別問題**: 解決課程創建時學童名稱丟失的根本原因
  - **問題分析**: 
    - 輸入「小美後天晚上六點半鋼琴課」回覆沒有顯示學童名稱
    - 課程名稱和時間正確提取，唯獨學童名稱缺失
  - **第一性原則深度分析**:
    - **表面問題**: 學童名稱未顯示在回覆中
    - **根本原因**: `SemanticService.extractChildName` 正則表達式過於嚴格 + 字段映射缺失
  - **雙重修復**:
    1. **修復正則表達式**: 支持「小美後天」模式，使用正向先行斷言 `(?=後天|明天|...)`
    2. **修復字段映射**: 當 `extractChildName` 失敗時，將 OpenAI 識別的 `entities.student` 映射到 `child_name`
  - **技術實現**: `src/services/semanticService.js:596,536-540,553-557`
  - **影響**: 徹底解決中英文學童名稱識別問題，支持更自然的語言輸入模式

## [v10.3.0] - 2025-07-30

### Added
- **📸 課程內容模組 (Course Content Module)**: 完整實現家長記錄課程內容、作業和照片功能
  - **核心功能**: 
    - 支持文字記錄課程內容和作業提醒
    - 照片上傳與課程關聯
    - Quick Reply按鈕選擇課程（包含學生角色信息如"小明的數學課"）
    - 30秒超時自動清理機制
  - **用戶流程**:
    - 方式1: 用戶發送課程文字 → 系統記錄 → 詢問是否有照片 → Quick Reply選擇
    - 方式2: 用戶上傳照片 → 系統生成課程按鈕 → 用戶選擇課程 → 自動保存
  - **技術實現**:
    - `SemanticService`: 新增課程內容語義識別（record_lesson_content, record_homework, upload_class_photo）
    - `TaskService`: 完整的課程內容業務邏輯處理
    - `DataService`: 課程內容CRUD操作和數據模型擴展
    - `LineController`: Quick Reply按鈕響應和圖片處理流程
    - `LineService`: Quick Reply消息格式完整支援
  - **第一性原則設計**:
    - 簡化pending狀態管理，移除複雜的混合內容處理
    - 使用Occam's razor原則，內容丟失沒關係，降低複雜度
    - 5分鐘課程數據緩存，提升Quick Reply按鈕生成性能
  - **完整流程**: 文字/照片輸入 → 語義識別 → 任務執行 → 數據存儲 → 用戶反饋

## [v10.2.15] - 2025-07-30

### Fixed  
- **🎯 基於第一性原則修復重複課程模板問題**: 重新定義重複創建語義，從"拒絕重複"改為"創建或獲取"
  - **第一性原則**: 重複課程模板是唯一語義實體，相同模板本質上是同一個實體
  - **問題**: 小光魔術課每個日期顯示兩次，因為資料庫存在2個相同模板
  - **根本原因**: 系統允許創建重複的語義實體，違反唯一性原則
  - **語義重新定義**: 
    - **舊語義**: 用戶重複輸入 → 系統拒絕 → 用戶困惑
    - **新語義**: 用戶重複輸入 → 系統確認現有 → 用戶安心
  - **第一性原則修復**:
    - 實現"創建或獲取"語義而非"拒絕重複"
    - 重複輸入時返回成功確認而非錯誤
    - 保持重複課程模板的唯一性約束
    - 用戶體驗更自然（不會看到錯誤消息）
  - **技術實現**: `CourseManagementScenarioTemplate.createRecurringEntity:566-603`
  - **影響**: 徹底解決課表重複顯示，提升用戶體驗，符合第一性原則

## [v10.2.14] - 2025-07-30

### Refactored  
- **🎯 學童名稱識別系統重新設計**: 基於第一性原則徹底重構 extractChildName，大幅提升泛用性和容錯性
  - **問題**: 舊正則表達式僵化，要求學童名稱在句首且後跟預定義詞彙列表
  - **第一性原則**: 學童名稱是獨立語義實體，應可在任何位置、任何上下文中被識別
  - **重新設計**:
    - **多策略匹配**: 句首策略 + 句中策略，涵蓋更多自然表達
    - **排除法驗證**: 使用排除詞彙列表而非包含列表，更加靈活
    - **位置無關**: 支持任意位置的學童名稱識別
    - **上下文智能**: 支持「查詢小美」「小美怎麼樣」「小美的安排」等自然表達
  - **三層 Fallback 策略**:
    - **主要策略**: extractChildName 多策略匹配（句首+句中）
    - **Fallback 1**: OpenAI誤識別糾正（將錯誤的course_name糾正為學童名稱）
    - **Fallback 2**: 正則表達式兜底（保持向下兼容）
  - **支持的新格式**:
    - 句首: 「小美課表」「明明安排」「大寶時間」
    - 句中: 「查詢小美課表」「看看明明怎麼樣」「檢查大寶狀況」  
    - 自然語言: 「小美的課程」「小美有什麼課」
  - **技術優勢**:
    - **容錯性強**: 多層策略確保不會遺漏學童名稱
    - **智能糾錯**: 能糾正OpenAI的常見誤識別
    - **維護成本低**: 無需手動添加詞彙到硬編碼列表
    - **擴展性強**: 支持未來的新表達方式
    - **調試友好**: 每個策略都有明確的日誌輸出

---

## [v10.2.13] - 2025-07-30

### Added
- **🎯 獨立學童課表查詢功能**: 基於第一性原則實現按學童名稱過濾課表查詢
  - **功能**: 支持「查詢小美課表」等自然語言，只顯示指定學童的課程
  - **實現原理**:
    - TaskService._calculateDateRange: 從entities中提取child_name並傳遞給查詢選項
    - CourseManagementScenarioTemplate.queryEntities: 添加child_name過濾條件到基礎查詢
    - 重複課程實例雙重過濾: 模板過濾 + 實例生成後二次過濾確保準確性
  - **第一性原則**: 學童是課程的屬性維度，應作為獨立的過濾條件處理
  - **影響範圍**: 
    - 一般課程查詢: 支持child_name過濾
    - 重複課程查詢: 模板和實例都支持child_name過濾
    - 統計信息: 包含child_name過濾狀態
  - **使用示例**: 
    - 「查詢小美課表」→ 只顯示小美的所有課程
    - 「小明下週課表」→ 只顯示小明下週的課程
    - 「課表」→ 顯示所有學童課程（保持向後兼容）

---

## [v10.2.12] - 2025-07-30

### Fixed
- **🚨 重複課程查詢邏輯根本修復**: 基於第一性原則修復查詢課表時跳過正確日期的問題
  - **問題**: 查詢課表時，魔術課程（每週六）第一堂顯示8/9而非8/2
  - **根本問題分析**:
    - 8/2是週六(6)，8/3是週日(0)，8/9是週六(6)
    - 重複課程的 start_date 被錯誤設置為8/3（週日），但模式是每週六
    - RecurringCourseCalculator 查詢時從 `Math.max(start, courseStartDate)` 開始
    - 這導致查詢被錯誤的 courseStartDate 限制，跳過了查詢範圍內的正確實例
  - **修復內容**:
    - **TimeService.parseDateOffset**: 修正條件為 `offset < 0`，允許今天是目標日
    - **RecurringCourseCalculator.calculateFutureOccurrences**: 查詢從查詢起始日期開始，不受錯誤 start_date 影響
  - **修復效果**: 
    - 舊邏輯: 查詢課表 → 魔術課程第一堂8/9（被錯誤start_date限制）
    - 新邏輯: 查詢課表 → 魔術課程第一堂8/2（查詢範圍內的正確實例）
  - **第一性原則**: 查詢應該顯示查詢範圍內所有符合重複規則的實例，不受存儲的 start_date 錯誤影響
  - **影響範圍**: 所有重複課程的查詢和顯示

---

## [v10.2.11] - 2025-07-29

### Fixed
- **🚨 重複課程模式提取根本修復**: 基於第一性原則徹底修復重複課程模式提取和顯示的學童信息污染問題
  - **問題**: "📚 課程：魔術 (每週六小光下午六 重複)" - 學童信息污染重複模式，違反第一性原則
  - **根本問題**: 
    - 語義提取: recurrence_pattern 包含學童信息 "每週六小光下午六"
    - 顯示格式: formatRecurrenceDescription 添加 "重複" 後綴造成冗餘
  - **修復內容**:
    - **SemanticService.buildEntityResult**: 修復週重複模式提取邏輯，只提取純淨的 "每週X" 格式
    - **CourseManagementScenarioTemplate**: 新增 getRecurrenceLabel 方法，統一使用 RecurringCourseCalculator 格式
    - **統一顯示格式**: 所有重複課程回覆改為 "(每週六)" 格式，與查詢顯示一致
  - **修復效果**: 
    - 舊格式: "📚 課程：魔術 (每週六小光下午六 重複)"
    - 新格式: "📚 課程：魔術 (每週六)"
  - **第一性原則**: 重複模式應該純淨無污染，課程顯示格式應該全系統一致
  - **影響範圍**: 重複課程創建、修改、停止回覆，確保與查詢顯示格式統一

---

## [v10.2.10] - 2025-07-29

### Fixed
- **🎯 重複課程標記格式統一修復**: 基於第一性原則將所有重複課程標記統一為 "(每週X)" 格式
  - **問題**: 重複課程標記顯示為 "(週二)" 缺少 "每" 前綴，不符合用戶認知
  - **修復內容**: 
    - RecurringCourseCalculator.getRecurrenceLabel: 週重複課程添加 "每" 前綴
    - 修復效果: "(週二)" → "(每週二)"
  - **第一性原則**: 重複課程標記應明確表達重複性質，"每週二" 比 "週二" 更準確
  - **影響範圍**: 所有重複課程的查詢、創建、修改、停止等顯示場景

---

## [v10.2.9] - 2025-07-29

### Fixed
- **🚨 重複課程全場景學童信息缺失根本修復**: 基於第一性原則徹底修復重複課程所有操作流程中的學童信息處理
  - **問題**: 重複課程的創建、修改、停止功能完全忽略學童信息，嚴重違反第一性原則
  - **全面檢查發現的問題**:
    - ❌ 創建重複課程：實體提取、數據構建、回覆消息都缺失學童信息
    - ❌ 修改重複課程：modifyRecurringEntity, modifyEntireRecurringSeries, modifySingleRecurringInstance 都缺失
    - ❌ 停止重複課程：stopRecurringEntity 實體提取和回覆消息都缺失
    - ❌ 字段不一致：同時使用 `student` 和 `child_name`，造成混亂
  - **修復內容**:
    - **創建重複課程**: createRecurringEntity + buildRecurringCourseData 完整修復
    - **修改重複課程**: 三個修改函數完整修復，包括例外記錄創建
    - **停止重複課程**: stopRecurringEntity 完整修復
    - **向後兼容**: 統一使用 `child_name`，兼容舊的 `student` 字段
    - **動態格式**: 所有成功回覆改為動態格式，包含學童信息顯示
  - **第一性原則**: 重複課程與一般課程必須具有完全一致的學童信息處理邏輯
  - **修復效果**: 
    - 創建: `👶 學童: 小美\n📚 課程：小提琴課 (每週二)`
    - 修改: `👶 學童: 小美\n📚 課程：小提琴課 (每週二)\n📝 修改內容：時間`
    - 停止: `👶 學童: 小美\n📚 課程：小提琴課 (每週二)\n📊 影響的未來課程：約 5 堂`

---

## [v10.2.7] - 2025-07-29

### Fixed
- **🎯 重複課程顯示格式修復**: 基於第一性原則修正重複課程標記位置
  - **問題**: 重複課程標記 🔄 顯示在時間後面，違反第一性原則
  - **舊格式**: `📚 西班牙語\n🕒 時間：08/05 2:00 PM 🔄`
  - **新格式**: `📚 西班牙語 (每週二)\n🕒 時間：08/05 2:00 PM`
  - **修復內容**:
    - RecurringCourseCalculator.getRecurrenceLabel: 去掉 🔄 符號，返回純文字描述
    - CourseManagementScenarioTemplate.formatCourseDisplay: 將重複標記放在課程名稱後的括號內
    - 時間行保持純淨，不含重複標記
  - **第一性原則**: 重複信息屬於課程本身，應與課程名稱緊密結合而非時間
  - **影響範圍**: 所有重複課程的查詢和顯示

---

## [v10.2.6] - 2025-07-29

### Added
- **📚 文檔架構重構**: 實施模組化文檔結構，提升開發效率和維護性
  - **CLAUDE.md 重構**: 簡化為核心約束和快速導航，移除冗長內容
  - **分散式文檔系統**: 按功能域分離詳細文檔
    - `docs/ARCHITECTURE.md` - 系統架構設計和 Scenario Layer 詳解
    - `docs/DEVELOPMENT.md` - 開發流程、編碼規範、API 使用指南
    - `docs/DEPLOYMENT.md` - 部署配置、運維監控、故障排除
    - `docs/USER_FLOWS.md` - 用戶流程、處理邏輯、效能統計
  - **英中文檔對應**: 同時提供中英文版本，便於不同開發者使用
  - **導航式設計**: 根據問題類型快速定位相關文檔
  - **關注點分離**: 架構、開發、部署、業務邏輯清晰分離

---

## [v10.2.5] - 2025-07-29

### Fixed
- **🎯 學童信息顯示全場景修復**: 基於第一性原則的系統性修復，確保所有功能場景的學童信息顯示一致性
  - **全面檢查發現的問題**:
    - ✅ 創建課程回覆 - 已正確
    - ❌ 查詢課表回覆 - lineService.js 硬編碼格式
    - ❌ 修改課程回覆 - lineController.js 未檢查 child_name
    - ❌ 取消課程回覆 - lineController.js 未檢查 child_name
    - ❌ 重複課程實例 - RecurringCourseCalculator 完全遺漏 child_name
  - **解決方案**:
    - 修復查詢課表格式邏輯：優先使用 `course.display_text`
    - 修復修改課程回覆：添加學童信息檢查和顯示
    - 修復取消課程回覆：添加學童信息檢查和顯示  
    - 修復重複課程實例：在 `calculateFutureOccurrences` 中保留 `child_name`
  - **第一性原則**: 所有課程操作回覆必須一致地顯示學童信息
  - **影響範圍**: 課程創建、查詢、修改、取消、重複課程等所有場景

---

## [v10.2.4] - 2025-07-29

### Fixed
- **🎯 查詢課表顯示格式根本修復**: 徹底解決查詢課表時學童信息不顯示的問題
  - **問題**: 雖然數據正確且 `display_text` 包含學童信息，但最終用戶看到的課表沒有學童信息
  - **根因**: `lineService.js` 中 `formatCourseResponse` 使用硬編碼格式，忽略了正確的 `display_text`
  - **解決方案**: 修改課表格式化邏輯，優先使用 `course.display_text` 而不是硬編碼格式
  - **第一性原則**: 統一使用 CourseManagementScenarioTemplate 的標準格式化結果
  - **修復效果**: 現在查詢課表將正確顯示 `👶 學童: 小明\n📚 足球\n🕒 時間：07/31 10:30 AM`

---

## [v10.2.3] - 2025-07-29

### Fixed
- **🎯 查詢課表學童信息顯示修復**: 修復查詢課表時學童信息不顯示的問題
  - **問題**: 雖然創建課程時學童信息顯示正常，但查詢課表時學童信息遺失
  - **根因**: `formatCourseForDisplay` 方法未保留 `child_name` 字段，導致查詢結果中學童信息丟失
  - **解決方案**: 在 `formatCourseForDisplay` 方法中明確保留 `child_name` 字段
  - **第一性原則**: 確保查詢和創建功能的學童信息顯示一致性
  - **影響範圍**: 所有查詢操作（課表查詢、週課表查詢、月課表查詢等）

---

## [v10.2.2] - 2025-07-29

### Fixed
- **🎯 多子女功能顯示邏輯修復**: 修復學童信息不顯示的問題
  - **問題**: 雖然數據結構已正確分離，但創建課程成功回覆中學童信息沒有顯示
  - **根因**: lineController 使用硬編碼顯示格式，未檢查 `child_name` 字段
  - **解決方案**: 更新 lineController 顯示邏輯，學童信息優先顯示
  - **正確格式**:
    ```
    ✅ 課程已成功新增！
    
    👶 學童: 小明
    📚 課程：足球課
    🕒 時間：07/31 10:30 AM
    📅 日期：2025-07-31
    ```
  - **第一性原則**: 學童信息清晰可見，課程名稱保持純淨

---

## [v10.2.1] - 2025-07-29

### Fixed
- **🚨 多子女功能根本設計錯誤修復**: 修復違反第一性原則的嚴重設計缺陷
  - **問題**: 之前錯誤地將子女名稱嵌入課程名稱（如「小明足球課」），污染了課程本質
  - **解決方案**: 重新設計為正確的數據分離架構
    - 課程名稱保持純淨：`足球課` (不含子女信息)
    - 學童信息單獨存儲：`child_name: "小明"`
    - 正確顯示格式：`學童: 小明\n📚 足球課\n🕒 時間：07/31 10:30 AM`
  - **架構修復**:
    - SemanticService: 移除課程名稱污染邏輯，新增 `child_name` 字段傳遞
    - CourseManagementScenarioTemplate: 重寫顯示邏輯，學童信息優先單獨顯示
    - 數據存儲: 添加 `child_name` 字段，保持課程名稱純淨性
  - **測試更新**: 重寫所有單元測試，符合正確設計原則
  - **第一性原則**: 課程就是課程，學童就是學童，數據結構清晰分離

---

## [v10.2.0] - 2025-07-29

### Added
- **多子女課程管理（精簡版）**: 採用語義嵌入法，支持在自然語言中包含子女名稱
  - **自動識別子女名稱**: 支持「小明」、「小美」、「志強」等 2-3 字中文名稱格式
  - **智能顯示分離**: 課程顯示時自動分離子女信息和課程名稱
    - 有子女: `👦 小明\n📚 鋼琴課\n🕒 時間：07/25 2:00 PM`
    - 無子女: `🕒 07/28 9:00 AM - 📚 數學課`
  - **零架構改動**: 使用語義嵌入法，無需修改數據結構和API接口
  - **完全向後兼容**: 現有課程管理功能保持不變
  - **自然語言支持**: 實現「小明明天下午兩點鋼琴課」等自然表達
  - **精確實體提取**: 在 SemanticService 中新增 `extractChildName()` 方法
  - **優化顯示邏輯**: 在 CourseManagementScenarioTemplate 中新增顯示分離功能
  - **完整測試覆蓋**: 包含單元測試、集成測試和向後兼容性測試

---

## [v10.1.3] - 2025-07-29

### Fixed
- **時間範圍查詢完整修復**: 徹底解決週課表和月課表查詢的所有問題。
  - **原始文本保留**: 將用戶原始輸入 `originalUserInput` 傳遞給 TaskService，避免語義分析丟失時間信息
  - **優先級檢測邏輯**: `_calculateDateRange` 按優先級檢查：`originalUserInput` > `course_name` > `raw_text` > `timeInfo.raw`
  - **根因問題解決**: OpenAI 將「下週課表」分解為 course_name="課表" + timeInfo=null，導致時間信息丟失
  - **🚨 關鍵字匹配順序修復**: 修復「下下週課表」被錯誤識別為「下週」的字符串包含匹配問題，將最具體的條件放在前面
  - **🆕 月查詢功能**: 新增完整的月查詢支持，修復「本月課表」錯誤返回8月課程的問題
    - 支持「本月課表」→ 返回當月1日到最後一天
    - 支持「下月課表」→ 返回下月1日到最後一天  
    - 支持「下下月課表」→ 返回下下月完整範圍
  - **TimeService 增強**: 新增 `getStartOfMonth` 和 `getEndOfMonth` 方法，確保精確的月範圍計算

---

## [v10.1.2] - 2025-07-29

### Fixed  
- **生產環境關鍵錯誤修復**: 修復 TaskService 中缺失的 `_calculateDateRange` 方法導致的運行時錯誤。
  - **方法實現完成**: 新增完整的 `_calculateDateRange` 方法實現，支持精確的週範圍計算
  - **智能時間範圍檢測**: 根據用戶輸入自動識別「這週」、「下週」、「下下週」等時間範圍意圖
  - **統一時間處理**: 使用 TimeService 的標準方法確保時間計算的一致性和準確性
  - **生產部署驗證**: 解決 "'_calculateDateRange' is not a function" 和模組載入錯誤
  - **調試工具增強**: 新增 Render 日誌監控腳本，便於快速定位和解決生產問題

### Added
- **調試工具集**: 新增完整的 Render 平台調試工具鏈
  - `scripts/get-app-logs.sh`: 應用程序日誌快速獲取腳本
  - `scripts/render-events.sh`: 服務事件查詢工具
  - `scripts/test-render-log-endpoints.js`: API 端點測試工具

---

## [v10.1.1] - 2025-07-29

### Fixed
- **週課表查詢精準修復**: 修復「下下週課表」、「下週課表」、「這週課表」返回多週而非指定週的問題。
  - **TaskService 邏輯修復**: 恢復 `_calculateDateRange` 方法調用，確保傳遞正確日期範圍
  - **TimeService 增強**: 新增 `getStartOfWeek` 和 `getEndOfWeek` 方法，正確計算週的開始/結束日期
  - **範圍控制優化**: 用戶查詢特定週時只返回該週課程，避免顯示4週內容
  - 解決課表查詢返回過多無關課程的用戶體驗問題

---

## [v10.1.0] - 2025-07-29

### Added
- **Render 日誌獲取工具**: 新增本地命令行工具，無需登入 Dashboard 即可查看服務事件。
  - 支援事件過濾：可按關鍵詞過濾部署、建置狀態
  - 靈活數量控制：可指定獲取的事件數量
  - 友好格式化：自動格式化時間戳和事件類型
  - 命令：`npm run logs [--limit N] [--filter keyword]`

---

## [v10.0.5] - 2025-07-29

### Fixed  
- **重複課程創建根本修復**: 解決重複課程無法正確創建的核心問題。
  - **語義分析修復**: 保留完整重複模式信息（「每週二」而非簡化為「每週」）
  - **數據結構修復**: 添加必要的布林欄位和 `recurrence_details`
  - **模式解析增強**: 正確提取星期幾、時間、月日信息
  - 修復「每週二下午兩點西班牙語課」無法創建的問題

---

## [v10.0.4] - 2025-07-29

### Fixed
- **重複課程回覆修復**: 添加缺失的重複課程意圖處理，解決「正在處理中」fallback 問題。
  - 添加 `create_recurring_course` case：正確顯示重複課程創建成功訊息
  - 添加 `modify_recurring_course` case：處理重複課程修改回覆
  - 添加 `stop_recurring_course` case：處理重複課程停止回覆

---

## [v10.0.3] - 2025-07-29

### Fixed
- **模組導入修復**: 修復 `CourseManagementScenarioTemplate.js` 中的大小寫敏感問題，解決查詢課表功能錯誤。

### Added  
- **規則引擎泛化**: 實施二進制判斷邏輯，提升規則覆蓋率至75%，平均延遲降至82.5ms。
  - 簡化信心度判斷：`confidence > 0` 就用規則引擎
  - 擴展重複課程規則：直接支援週一到週日匹配
  - 增強查詢意圖規則：添加更多常見表達方式

---

## [v10.0.2] - 2025-07-29

### Fixed
- **重複課程意圖識別修復**: 修復 "每周二下午兩點上數學課" 無法觸發重複課程功能的問題。
  - 支援簡體中文字符：新增 "每周"、"周一"、"周二" 等字符變體
  - 更新意圖規則配置支援繁體與簡體中文混用
  - 修復語義分析器重複模式識別邏輯

---

## [v10.0.1] - 2025-07-29

### Fixed
- **生產環境修復**: 修復模組導入大小寫敏感問題，解決 Linux 伺服器上 `RecurringCourseCalculator` 模組找不到的錯誤。

---

## [v10.0.0] - 2025-07-29

### Added
- **重複課程功能**: 全新的重複課程管理系統，支援每天、每週、每月重複課程。
  - 智能起始日期判斷：根據當前時間自動避免過期課程
  - 動態計算架構：查詢時即時計算，不預先創建課程實例
  - 完整管理介面：創建、修改、停止重複課程
  - 布林欄位標註：使用 `daily_recurring`、`weekly_recurring`、`monthly_recurring` 標記重複類型
  - 🔄 標籤顯示：重複課程在查詢時自動顯示重複標籤

### Enhanced
- **語義分析增強**: 新增重複課程語義識別，支援「每週三」、「每天」、「每月15號」等自然語言表達。
- **意圖規則擴展**: 新增 `create_recurring_course`、`modify_recurring_course`、`stop_recurring_course` 意圖。
- **時間服務擴展**: 新增智能起始日期計算方法 `calculateSmartStartDate`。
- **動態衝突檢測**: 支援重複課程的時間衝突檢測，計算未來4週時間點。

### Technical
- **RecurringCourseCalculator**: 新增動態課程計算引擎，支援高效的重複課程實例生成。
- **資料模型擴展**: 在 `courses` 集合中新增重複課程相關欄位。
- **性能優化**: 智能迭代次數控制，避免無限循環，計算效率 < 100ms。
- **架構相容**: 完全遵循三層語義架構，不影響現有功能。

---

## [v9.3.0] - 2025-07-28

### Changed
- **語義分析優化**: 在多輪對話中，若用戶僅輸入時間（如「明天早上十點」），系統將拒絕處理並引導用戶提供完整課程資訊，避免誤判。

---

## [v9.2.0] - 2025-07-26

### Changed
- **性能優化**: 顯著減少了 `EntityService` 和 `TaskService` 的日誌輸出，並優化了內部驗證邏輯，提升運行效率。

---

## [v9.1.0] - 2025-07-26

### Fixed
- **重大架構修正**: 修正了部署模式，確保每個服務實例只加載其對應的單一業務場景（如課程管理），大幅降低了內存使用並實現了真正的微服務隔離。

---

## [v9.0.0] - 2025-07-26

### Added
- **核心架構升級 (Scenario Layer)**: 引入了以模板為基礎的 `Scenario Layer` 架構，將業務邏輯從核心服務中分離，使系統能夠支持多種業務場景（如課程、長照、保險）。
- **通用實體服務 (`EntityService`)**: 新增了通用的數據庫操作服務，以支持不同類型的業務實體。
- **配置驅動開發**: 業務規則、訊息模板等現在由 YAML 文件配置，提高了靈活性和可維護性。

### Changed
- **TaskService 重構**: `TaskService` 被重構為一個純粹的委託層，將所有業務邏輯轉發給對應的 `Scenario` 模板處理。

---

## [v8.0.0] - 2025-07-26

### Added
- **會話上下文與糾錯**: 引入了5分鐘過期的會話上下文機制。現在可以處理用戶的糾錯意圖，例如在「扯鈴改成四點30」之後，用戶可以說「不對，是下午」，系統能理解並正確修改。

---

## [v7.2.0] - 2025-07-26

### Fixed
- **語義與時間解析修正**:
  - 增強了對「AI教學」等複合詞課程的識別能力。
  - 修正了 OpenAI 回應中包含 Markdown 標記導致的 JSON 解析失敗問題。
  - 修正了「四點半」被錯誤解析為「4:00」的問題。
  - 修正了「晚上八點」被錯誤解析為上午 (AM) 的問題。
- **回覆內容增強**: 在操作成功後的回覆中加入更詳細的課程資訊，提升用戶體驗。

---

## [v7.1.0] - 2025-07-26

### Added
- **完整調試日誌系統**: 在開發模式下，實現了從用戶輸入到數據庫操作的全鏈路日誌追蹤，大幅提升了開發和除錯效率。

---

## [v7.0.0] - 2025-07-25

### Added
- **引入真實 AI 語義理解**:
  - 正式對接 OpenAI API，取代了原有的 Mock 服務和硬編碼規則。
  - 使用大型語言模型 (LLM) 進行實體提取，能更智能地處理多樣化的自然語言表達。
- **智能後備機制**: 實現了「規則引擎優先，AI 後備」的混合模式。高確定性的指令由本地規則快速處理，模糊指令則交由 AI 進行深度理解。

### Fixed
- **架構約束修復**: 透過引入本地 ESLint 插件，完整地實現了開發時的跨層導入檢查，確保了架構的純淨性。
- **CI/CD 流程修復**: 提交了 `package-lock.json` 並修正了 ESLint 規則，使自動化流程恢復正常。

---

## [v6.3.0] - 2025-07-25

### Added
- **修改課程功能**: 實現了修改現有課程時間、地點、老師等資訊的核心業務邏輯。
- **清空課表功能**: 新增了清空所有課程的功能，並設計了二次確認機制以防止誤操作。

---

## [v5.0.0] - 2025-07-25

### Added
- **LINE Bot 集成**: 實現了完整的 LINE Webhook 後端，包括 Express 服務器、簽名驗證、消息接收與回覆的完整流程。系統已可接收真實的 LINE 訊息並作出回應。

---

## [v4.0.0] - 2025-07-25

### Added
- **Firebase 持久化**:
  - 將課程數據從記憶體存儲遷移至 Firebase Firestore，實現了數據的永久保存。
  - 新增 `token_usage` 集合，用於記錄和監控 OpenAI API 的調用成本。
- **部署配置修復**: 提供了完整的 Render 平台環境變數設置指南，解決了因配置缺失導致的 Firebase 初始化失敗問題。

---

## [v3.0.0] - 2025-07-25

### Added
- **核心業務邏輯實現 (記憶體)**: 在 `CourseService` 和 `DataService` 中完整實現了課程的新增、查詢、更新、刪除 (CRUD) 操作，但數據暫存於伺服器記憶體中。

---

## [v2.0.0] - 2025-07-25

### Added
- **規則引擎與時間解析**:
  - `IntentRuleEngine`: 實現了基於 YAML 配置的本地規則引擎，用於快速、準確地識別用戶意圖。
  - `TimeService`: 實現了強大的時間解析功能，支持自然語言（如「明天下午三點半」）和多種時區。

---

## [v1.0.0] - 2025-07-25

### Added
- **三層語義架構骨架**:
  - 建立了專案的核心服務層，包括 `SemanticService`、`TimeService` 和 `DataService` 的接口定義。
  - **強制架構邊界**: 引入了自訂的 ESLint 規則 (`no-cross-layer-imports`)，從技術上強制分離了不同層級的職責，禁止了不合規的跨層調用。

---

## [v0.1.0] - 2025-07-25

### Added
- **專案初始化**: 創建專案骨架，配置了 Node.js、ESLint、Prettier、Jest，並建立了基本的 CI/CD 流程。