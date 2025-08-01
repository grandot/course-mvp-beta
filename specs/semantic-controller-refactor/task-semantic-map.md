# ⚡ 語意對照表+架構簡化重構任務執行計劃 (Task Execution Plan)

> 基於 `plan-semantic-map.md` v2.0 的原子化任務分解
> 
> **第一性原則**：每個任務都有明確的輸入、輸出、驗收標準，確保零遺漏，架構簡化最大化

## 🚨 重要修正說明 (Critical Correction)

在深度分析現有"語意控制器決策"架構後，發現原計劃存在**重大風險**，已進行關鍵修正：

### ❌ 原計劃的問題
- **錯誤集成點**: 計劃在 SemanticController.buildResult 中集成 normalizer
- **破壞風險**: 可能影響 P1-P5 證據驅動決策邏輯
- **理解錯誤**: 以為只有部分 OpenAI 調用有 Token 問題

### ✅ 修正後的正確策略
- **正確集成點**: 在 `SemanticService.parseAIAnalysisResponse()` 中集成 normalizer
- **完全保護**: SemanticController 的 P1-P5 決策邏輯**完全不動**
- **全面優化**: 證據驅動系統也需要 Token 優化，但更謹慎

### 🎯 修正後的核心原則
```javascript
// ✅ 正確做法：在 OpenAI 結果解析時標準化
parseAIAnalysisResponse(content, originalText) {
  const parsed = JSON.parse(content);
  
  return {
    intent: SemanticNormalizer.normalizeIntent(parsed.intent),     // 標準化
    entities: SemanticNormalizer.normalizeEntities(parsed.entities), // 標準化  
    evidence: parsed.evidence,           // 保持不變 - P1-P5 需要
    reasoning_chain: parsed.reasoning_chain, // 保持不變 - P1-P5 需要
    confidence: parsed.confidence        // 保持不變 - P1-P5 需要
  };
}
```

**影響**：
- ✅ P1-P5 證據驅動決策**零影響**
- ✅ 仍然解決格式不一致問題
- ✅ 仍然實現 Token 優化（30-60% 減少）
- ✅ 更安全的漸進式改進

---

## 🎯 任務執行總覽

### 📊 任務統計
- **總任務數**: 35 個原子任務（新增7個架構簡化任務）
- **預估工時**: 50-60 小時
- **風險等級**: 中等（有完整回滾機制）
- **並行度**: 支持部分任務並行執行

### 🚀 執行階段劃分
- **Phase 1**: 基礎設施建設（14 個任務）- 無風險
- **Phase 2**: 漸進式整合+架構簡化（12 個任務）- 低風險  
- **Phase 3**: 全面優化+架構清理（9 個任務）- 中風險

---

## 🔧 Phase 1: 基礎設施建設（無風險階段）

> **目標**: 建立 SemanticNormalizer、UnifiedSemanticGateway 和映射表，不改變現有流程

- [ ] ### Task 1.1: 創建映射數據結構
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: 無

**輸入**:
- `/src/services/taskService.js` 中的 Intent 處理邏輯
- `/config/intent-rules.yaml` 中的 Intent 定義
- 現有 OpenAI prompt 中的格式約束

**執行步驟**:
1. 創建 `/data/` 目錄結構
2. 分析 TaskService 支持的所有 Intent，創建完整映射表
3. 分析現有 Entity 格式，創建 Entity 映射表
4. 創建 fallback 值定義

**輸出**:
- `/data/intentMap.json` - Intent 中英文映射表
- `/data/entityKeyMap.json` - Entity 鍵名映射表
- `/data/entityValueMap.json` - 常用 Entity 值映射表

**驗收標準**:
- ✅ 映射表包含 TaskService 中所有 Intent 分支
- ✅ **映射表包含 OpenAIService 中所有 Intent**（修復遺漏）
- ✅ JSON 格式正確，可被 Node.js 正常載入
- ✅ 包含至少 30 個常用中文→英文 Intent 映射
- ✅ Entity 映射表涵蓋所有系統使用的標準欄位

**驗證方法**:
```bash
# 驗證 JSON 格式
node -e "console.log(JSON.parse(require('fs').readFileSync('./data/intentMap.json', 'utf8')))"
# 驗證映射完整性
grep -r "case.*:" src/services/taskService.js | wc -l  # 應該與映射表條目數量匹配
```

---

- [ ] ### Task 1.2: 創建 TypeScript 類型定義
**優先級**: P1 (High)  
**預估時間**: 1 小時  
**依賴**: Task 1.1

**輸入**:
- Task 1.1 創建的映射數據文件
- 現有 `/src/types/semantic.ts`

**執行步驟**:
1. 創建 `/src/types/semanticMapping.ts`
2. 定義 Intent、Entity 映射相關的 TypeScript 類型
3. 更新 `/src/types/semantic.ts` 加入標準化格式定義

**輸出**:
- `/src/types/semanticMapping.ts` - 新的映射類型定義
- 更新的 `/src/types/semantic.ts` - 包含標準格式定義

**驗收標準**:
- ✅ TypeScript 編譯無錯誤
- ✅ 類型定義覆蓋所有映射表結構
- ✅ 與現有類型系統兼容

**驗證方法**:
```bash
npx tsc --noEmit src/types/semanticMapping.ts
```

---

- [ ] ### Task 1.3: 實現 SemanticNormalizer 核心邏輯
**優先級**: P0 (Critical)  
**預估時間**: 4 小時  
**依賴**: Task 1.1, Task 1.2

**輸入**:
- Task 1.1 的映射數據文件
- Task 1.2 的類型定義
- 現有系統的 Intent/Entity 處理邏輯

**執行步驟**:
1. 創建 `/src/services/semanticNormalizer.js`
2. 實現 Intent 映射和 Enum 約束邏輯
3. 實現 Entity 鍵名和值的映射邏輯
4. 實現多層 Fallback 機制
5. 添加詳細的日誌記錄

**輸出**:
- `/src/services/semanticNormalizer.js` - 完整的正規化服務

**核心方法簽名**:
```javascript
class SemanticNormalizer {
  /**
   * 正規化 OpenAI 分析結果
   * @param {Object} openaiResult - OpenAI 原始結果
   * @returns {Object} 標準化後的結果
   */
  static normalizeAnalysisResult(openaiResult);
  
  /**
   * 映射 Intent 到標準格式
   * @param {string} rawIntent - 原始 Intent
   * @returns {string} 標準化 Intent
   */
  static normalizeIntent(rawIntent);
  
  /**
   * 映射 Entities 到標準格式  
   * @param {Object} rawEntities - 原始 Entities
   * @returns {Object} 標準化 Entities
   */
  static normalizeEntities(rawEntities);
}
```

**驗收標準**:
- ✅ 所有核心方法實現完成
- ✅ 支持中文→英文 Intent 映射
- ✅ 支持 Entity 鍵名標準化
- ✅ 包含完整的錯誤處理和 fallback 邏輯
- ✅ 返回格式與現有系統兼容

**驗證方法**:
```javascript
// 測試基本映射功能
const result = SemanticNormalizer.normalizeIntent("清空課表");
console.assert(result === "clear_schedule", "Intent mapping failed");
```

---

- [ ] ### Task 1.4: 實現映射表動態載入機制
**優先級**: P1 (High)  
**預估時間**: 2 小時  
**依賴**: Task 1.3

**輸入**:
- Task 1.3 的 SemanticNormalizer 基礎實現
- Task 1.1 的映射數據文件

**執行步驟**:
1. 實現映射表的動態載入和緩存機制
2. 添加映射表更新時的自動重載功能
3. 實現映射表載入失敗的 fallback 機制
4. 添加映射表版本管理

**輸出**:
- 更新的 `/src/services/semanticNormalizer.js` - 包含動態載入邏輯

**驗收標準**:
- ✅ 映射表只在首次使用時載入（lazy loading）
- ✅ 映射表載入失敗時有合理的 fallback
- ✅ 支持運行時重載映射表（用於動態更新）
- ✅ 有完整的錯誤處理和日誌記錄

---

- [ ] ### Task 1.5: 創建 SemanticNormalizer 單元測試
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 1.4

**輸入**:
- 完整的 SemanticNormalizer 實現
- 映射數據文件
- 現有測試框架和測試案例結構

**執行步驟**:
1. 創建 `/tests/semanticNormalizer.test.js`
2. 實現所有核心方法的單元測試
3. 實現邊界條件和錯誤情況測試
4. 實現映射表完整性驗證測試

**輸出**:
- `/tests/semanticNormalizer.test.js` - 完整的單元測試套件

**測試覆蓋範圍**:
```javascript
describe('SemanticNormalizer', () => {
  describe('normalizeIntent', () => {
    // 正常映射測試
    // 未知 Intent 處理測試  
    // 空值和異常輸入測試
  });
  
  describe('normalizeEntities', () => {
    // Entity 鍵名映射測試
    // Entity 值映射測試
    // 嵌套結構處理測試
  });
  
  describe('normalizeAnalysisResult', () => {
    // 完整結果正規化測試
    // Fallback 機制測試
    // 格式兼容性測試
  });
});
```

**驗收標準**:
- ✅ 測試覆蓋率 > 95%
- ✅ 所有測試案例通過
- ✅ 包含至少 30 個不同的測試情境
- ✅ 測試執行時間 < 5 秒

**驗證方法**:
```bash
npm test -- --testPathPattern=semanticNormalizer.test.js --coverage
```

---

- [ ] ### Task 1.6: 創建映射表管理工具
**優先級**: P2 (Medium)  
**預估時間**: 2 小時  
**依賴**: Task 1.1

**輸入**:
- 映射數據文件結構
- 系統中所有使用 Intent 的位置

**執行步驟**:
1. 創建 `/scripts/mapping-tools.js`
2. 實現映射表驗證工具
3. 實現缺失映射檢測工具
4. 實現映射表統計工具

**輸出**:
- `/scripts/mapping-tools.js` - 映射表管理工具集

**工具功能**:
```bash
# 驗證映射表完整性
node scripts/mapping-tools.js validate

# 檢測缺失的映射
node scripts/mapping-tools.js check-missing

# 生成映射表統計報告
node scripts/mapping-tools.js stats
```

**驗收標準**:
- ✅ 可以自動檢測 TaskService 中未映射的 Intent
- ✅ 可以驗證 JSON 格式正確性
- ✅ 提供清晰的錯誤報告和建議

---

- [ ] ### Task 1.7: 實現 Enum 約束驗證機制
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Task 1.3

**輸入**:
- TaskService 中支持的所有 Intent
- SemanticNormalizer 基礎實現

**執行步驟**:
1. 定義 VALID_INTENTS 常量（與 TaskService 完全對應）
2. 實現嚴格的 Intent 枚舉驗證
3. 實現 Intent 合法性檢查
4. 添加非法 Intent 的處理邏輯

**輸出**:
- 更新的 `/src/services/semanticNormalizer.js` - 包含 Enum 約束邏輯

**Enum 定義**:
```javascript
// 必須與 TaskService 的 switch 語句完全對應
static VALID_INTENTS = [
  'record_course', 'create_recurring_course', 'modify_course',
  'modify_recurring_course', 'cancel_course', 'stop_recurring_course',
  'query_schedule', 'clear_schedule', 'query_today_courses_for_content',
  'set_reminder', 'record_lesson_content', 'record_homework',
  'upload_class_photo', 'query_course_content', 'modify_course_content',
  'correction_intent', 'unknown'
];
```

**驗收標準**:
- ✅ 枚舉定義與 TaskService 100% 對應
- ✅ 非法 Intent 一律映射為 'unknown'
- ✅ 提供詳細的驗證失敗日誌
- ✅ 零容忍政策：任何非枚舉值都被拒絕

---

- [ ] ### Task 1.8: 建立監控和日誌機制
**優先級**: P1 (High)  
**預估時間**: 2 小時  
**依賴**: Task 1.3

**輸入**:
- SemanticNormalizer 實現
- 現有日誌框架

**執行步驟**:
1. 添加結構化日誌記錄
2. 實現映射統計收集
3. 添加性能監控點
4. 實現異常情況告警

**輸出**:
- 更新的 `/src/services/semanticNormalizer.js` - 包含完整監控

**監控指標**:
```javascript
// 記錄的關鍵指標
{
  mapping_success_rate: "映射成功率",
  unknown_intent_rate: "未知意圖比例", 
  processing_time: "處理時間",
  fallback_trigger_rate: "fallback 觸發率"
}
```

**驗收標準**:
- ✅ 所有關鍵操作都有日誌記錄
- ✅ 性能指標自動收集
- ✅ 異常情況有明確的告警信息
- ✅ 日誌格式結構化，便於分析

---

- [ ] ### Task 1.9: 創建回滾和災難恢復機制
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Task 1.3

**輸入**:
- 現有 SemanticService 實現
- SemanticNormalizer 實現

**執行步驟**:
1. 創建運行時開關機制
2. 實現 normalizer 降級方案
3. 備份原始 prompt 配置
4. 實現快速回滾腳本

**輸出**:
- `/src/config/semanticConfig.js` - 配置管理
- `/scripts/rollback-semantic.js` - 回滾腳本

**安全機制**:
```javascript
// 運行時開關
const config = {
  useSemanticNormalizer: process.env.USE_SEMANTIC_NORMALIZER !== 'false',
  fallbackToOriginalPrompt: true,
  emergencyMode: false
};
```

**驗收標準**:
- ✅ 可以隨時關閉 normalizer 使用
- ✅ 可以快速恢復到原始配置
- ✅ 零停機切換能力
- ✅ 完整的配置備份和恢復

---

- [ ] ### Task 1.10: Phase 1 整合測試
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 1.1-1.9

**輸入**:
- 所有 Phase 1 完成的組件
- 現有測試框架

**執行步驟**:
1. 創建 SemanticNormalizer 集成測試
2. 測試映射表載入和處理流程
3. 驗證所有 fallback 機制
4. 性能基準測試

**輸出**:
- `/tests/semanticNormalizer.integration.test.js` - 集成測試
- Phase 1 完整性驗證報告

**驗收標準**:
- ✅ 所有組件可以正常協作
- ✅ 映射表處理準確率 100%
- ✅ fallback 機制在各種異常情況下正常工作
- ✅ 性能符合預期（處理時間 < 50ms）

---

- [ ] ### Task 1.11: 創建 UnifiedSemanticGateway 基礎架構
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 1.3

**輸入**:
- SemanticNormalizer 完整實現
- 現有 SemanticService、OpenAIService、EnhancedSemanticService 介面
- SemanticController P1-P5 決策邏輯

**執行步驟**:
1. 創建 `/src/services/unifiedSemanticGateway.js`
2. 設計統一入口介面 `analyze(text, userId, context)`
3. 實現基礎的調用路由邏輯
4. 準備整合 SmartQuery、OpenAI、Regex 的架構

**輸出**:
- `/src/services/unifiedSemanticGateway.js` - 統一語意網關基礎架構

**驗收標準**:
- ✅ 統一入口介面設計完成
- ✅ 保持與現有 SemanticController 輸出格式完全相容
- ✅ 支持所有現有功能（SmartQuery、Memory、MultiTurn）
- ✅ 有完整的錯誤處理和 fallback 機制

---

- [ ] ### Task 1.12: 分析和映射 OpenAIService 調用路徑
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Task 1.1

**輸入**:
- `/src/internal/openaiService.js` 當前實現
- EnhancedSemanticService 中的 OpenAI 調用路徑
- 現有映射表結構

**執行步驟**:
1. 分析 OpenAIService.analyzeIntent 和 analyzeIntentWithSlots 的格式約束
2. 檢查 Intent 列表是否完整（目前不完整）
3. 設計 OpenAIService 調用的標準化策略
4. 確保所有 OpenAI 調用路徑都被映射表覆蓋

**輸出**:
- OpenAI 調用路徑分析報告
- 更新的映射表（涵蓋 OpenAIService）

**驗收標準**:
- ✅ OpenAIService.analyzeIntentWithSlots Intent 列表與 TaskService 一致
- ✅ 所有 OpenAI 調用路徑的格式不一致問題被識別
- ✅ 映射表更新以支持所有調用路徑

---

- [ ] ### Task 1.13: 強化映射表適配 OpenAIService
**優先級**: P1 (High)  
**預估時間**: 2 小時  
**依賴**: Task 1.12

**輸入**:
- Task 1.12 的分析結果
- SemanticNormalizer 實現

**執行步驟**:
1. 擴展 SemanticNormalizer 支持 OpenAIService 的特殊格式
2. 添加 slot_state 格式的映射支持
3. 確保 analyzeIntentWithSlots 的結果可以正確標準化
4. 添加相關單元測試

**輸出**:
- 更新的 `/src/services/semanticNormalizer.js`
- 新增的測試案例

**驗收標準**:
- ✅ SemanticNormalizer 可以處理 OpenAIService 的所有輸出格式
- ✅ slot_state 和 entities 格式之間的轉換正確
- ✅ 所有相關測試通過

---

- [ ] ### Task 1.14: Phase 1 整合測試
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 1.1-1.13

**輸入**:
- Phase 1 所有完成的組件（包含 UnifiedSemanticGateway）
- 現有測試框架

**執行步驟**:
1. 創建 SemanticNormalizer 集成測試
2. 測試 UnifiedSemanticGateway 基礎功能
3. 測試映射表載入和處理流程
4. 驗證所有 fallback 機制
5. 性能基準測試

**輸出**:
- `/tests/semanticNormalizer.integration.test.js` - 集成測試
- `/tests/unifiedSemanticGateway.test.js` - 統一入口測試
- Phase 1 完整性驗證報告

**驗收標準**:
- ✅ 所有組件可以正常協作
- ✅ UnifiedSemanticGateway 基礎功能正常
- ✅ 映射表處理準確率 100%
- ✅ fallback 機制在各種異常情況下正常工作
- ✅ 性能符合預期（處理時間 < 50ms）

---

- [ ] ### Task 1.15: Phase 1 文檔更新
**優先級**: P2 (Medium)  
**預估時間**: 1 小時  
**依賴**: Task 1.14

**輸入**:
- Phase 1 所有完成的組件
- 現有技術文檔

**執行步驟**:
1. 更新 `/docs/ARCHITECTURE.md` - 添加 SemanticNormalizer 和 UnifiedSemanticGateway 架構說明
2. 更新 `/docs/DEVELOPMENT.md` - 添加映射表維護說明
3. 創建 `/docs/UNIFIED_SEMANTIC_GATEWAY.md` - 統一入口文檔

**輸出**:
- 更新的技術文檔
- UnifiedSemanticGateway 使用指南

**驗收標準**:
- ✅ 文檔準確反映實際實現
- ✅ 包含完整的使用示例
- ✅ 包含故障排除指南

---

## ⚡ Phase 2: 漸進式整合（低風險階段）

> **目標**: 整合現有服務到 UnifiedSemanticGateway，開始架構簡化

- [ ] ### Task 2.1: 分析 SemanticController 集成點
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Phase 1 完成

**輸入**:
- `/src/services/semanticController.js` 當前實現
- SemanticNormalizer 介面定義
- 現有 SemanticController 測試案例

**執行步驟**:
1. 分析 SemanticController.analyze() 方法的返回格式
2. 確定 SemanticNormalizer 的集成點
3. 設計向後兼容的輸出格式
4. 規劃集成後的數據流

**輸出**:
- 集成方案設計文檔
- 數據格式兼容性分析報告

**關鍵集成點**:
```javascript
// 當前 SemanticController 輸出
{
  final_intent: 'record_course',
  entities: { course_name: 'math', student_name: 'John' },
  confidence: 0.85,
  source: 'openai'
}

// 集成後輸出（向後兼容）  
{
  final_intent: 'record_course',  // 經過 normalizer 處理
  entities: { course_name: 'math', student_name: 'John' },  // 經過 normalizer 處理
  confidence: 0.85,
  source: 'openai',
  _normalizer: {  // 新增 debug 信息
    original_intent: '記錄課程',
    mapping_applied: true,
    version: '1.0'
  }
}
```

**驗收標準**:
- ✅ 集成方案不破壞現有 API 契約
- ✅ 輸出格式完全向後兼容
- ✅ 集成點明確，修改範圍最小
- ✅ 有完整的回滾能力

---

- [ ] ### Task 2.2: 實現 SemanticService 中的 Normalizer 集成
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 2.1

**輸入**:
- Task 2.1 的集成方案
- `/src/services/semanticService.js` 中的 `parseAIAnalysisResponse()` 方法
- SemanticNormalizer 完整實現

**執行步驟**:
1. 修改 `SemanticService.parseAIAnalysisResponse()` 方法
2. 在 JSON 解析後立即添加 normalizer 處理
3. 確保 evidence, reasoning_chain, confidence 結構完全保持不變
4. 添加 normalizer 錯誤處理，確保不影響證據驅動決策

**輸出**:
- 更新的 `/src/services/semanticService.js`

**關鍵修改點**:
```javascript
// 在 parseAIAnalysisResponse 方法中添加 normalizer 處理
parseAIAnalysisResponse(content, originalText) {
  // 現有的 JSON 解析邏輯...
  const parsed = JSON.parse(jsonContent);
  
  // 🎯 新增：SemanticNormalizer 處理（只處理 intent 和 entities）
  let normalizedIntent = parsed.intent;
  let normalizedEntities = parsed.entities;
  
  try {
    normalizedIntent = SemanticNormalizer.normalizeIntent(parsed.intent);
    normalizedEntities = SemanticNormalizer.normalizeEntities(parsed.entities);
  } catch (error) {
    console.warn('[SemanticService] Normalizer 處理失敗，使用原始值:', error);
    // fallback 到原始值，不影響主流程
  }
  
  // 返回標準化後的結果，保持 P1-P5 需要的完整結構
  const result = {
    intent: normalizedIntent,
    entities: normalizedEntities,
    evidence: {
      temporal_clues: parsed.evidence?.temporal_clues || [],
      mood_indicators: parsed.evidence?.mood_indicators || [],
      action_verbs: parsed.evidence?.action_verbs || [],
      question_markers: parsed.evidence?.question_markers || []
    },
    reasoning_chain: parsed.reasoning_chain || { confidence_source: '預設推理' },
    confidence: {
      overall: parsed.confidence?.overall || 0.5,
      intent_certainty: parsed.confidence?.intent_certainty || 0.5,
      context_understanding: parsed.confidence?.context_understanding || 0.5
    }
  };
  
  return result;
}
```

**驗收標準**:
- ✅ SemanticController 的 P1-P5 決策邏輯完全不受影響
- ✅ 證據驅動決策接收到標準化的 intent 和 entities
- ✅ evidence, reasoning_chain, confidence 結構完整保持
- ✅ normalizer 失敗時有完整的 fallback 機制
- ✅ 性能影響 < 10ms per request

---

- [ ] ### Task 2.3: 證據驅動 Prompt 的謹慎簡化
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 2.2

**輸入**:
- 當前 `/src/services/semanticService.js` 中的 `buildEvidenceDrivenPrompt()`
- SemanticNormalizer 的映射能力範圍
- P1-P5 決策邏輯對 evidence 結構的依賴

**執行步驟**:
1. 備份當前完整 prompt 到 `/config/prompts/evidence-driven-full.json`
2. **謹慎簡化**格式約束部分，但保留 evidence 結構要求
3. 保留 P1-P5 決策需要的所有關鍵指令
4. 實現配置化的 prompt 版本切換機制

**輸出**:
- `/config/prompts/evidence-driven-full.json` - 原始 prompt 備份
- `/config/prompts/evidence-driven-simplified.json` - 簡化版 prompt
- 更新的 `/src/services/semanticService.js` - 支持 prompt 版本切換

**簡化策略**（**非常謹慎**）:
```javascript
// 🎯 關鍵原則：保留 P1-P5 決策需要的所有結構，只簡化格式約束

// 保留的核心結構（不能簡化）:
const coreStructure = `
"evidence": {
  "temporal_clues": ["時間相關詞語"],     // P2 規則需要
  "mood_indicators": ["語氣相關詞語"],   // P1 規則需要  
  "action_verbs": ["動作詞"],
  "question_markers": ["疑問標記"]      // P1 規則需要
},
"reasoning_chain": { ... },            // P3-P5 需要
"confidence": { ... }                  // 所有規則都需要
`;

// 可簡化的部分（移除詳細的格式約束）:
// 從：「欄位名必須是course_name」→ 到：「課程名稱」
// 從：完整Intent枚舉 → 到：「用戶意圖類型」
// 但通過 SemanticNormalizer 後處理確保格式正確
```

**特別注意**:
- ⚠️ **絕對不能影響 evidence 結構** - P1-P5 決策依賴這些字段
- ⚠️ **保留語氣分析指令** - "疑問語氣通常不是新增意圖"
- ⚠️ **保留時間線索指令** - "上次/昨天/之前"相關規則

**驗收標準**:
- ✅ **Token 使用量減少 60-70%**（更激進的優化目標）
- ✅ P1-P5 決策邏輯完全不受影響
- ✅ evidence, reasoning_chain 結構完整產生
- ✅ 可以動態切換 prompt 版本
- ✅ 有完整的回滾機制
- ✅ **統一內部溝通格式確保**：OpenAI輸出經過標準化後，所有downstream服務接收一致格式

---

- [ ] ### Task 2.4: 驗證 P1-P5 決策邏輯完整性
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 2.2, Task 2.3

**輸入**:
- 集成了 normalizer 的 SemanticService
- 簡化了 prompt 的證據驅動系統
- 現有的 SemanticController P1-P5 測試案例

**執行步驟**:
1. **驗證 P1-P5 決策邏輯完全不受影響**
2. 測試 evidence 結構是否完整生成
3. 測試 reasoning_chain 是否正常工作
4. 驗證所有決策路徑仍然正確

**輸出**:
- P1-P5 決策完整性驗證報告
- 新增的 SemanticService normalizer 集成測試

**關鍵測試案例**:
```javascript
describe('語意控制器決策邏輯完整性驗證', () => {
  test('P1: 疑問語氣與新增意圖衝突檢測', async () => {
    const result = await SemanticController.analyze('我想記錄課程嗎？', []);
    
    // 驗證 P1 規則仍然正確觸發
    expect(result.used_rule).toBe('P1');
    expect(result.reason).toContain('疑問語氣與新增意圖衝突');
    
    // 驗證 normalizer 沒有破壞 evidence 結構
    expect(result.debug_info.ai_analysis.evidence.question_markers).toContain('嗎');
  });
  
  test('P2: 時間線索權重檢測', async () => {
    const result = await SemanticController.analyze('昨天的數學課怎麼樣', []);
    
    expect(result.used_rule).toBe('P2');
    expect(result.debug_info.ai_analysis.evidence.temporal_clues).toContain('昨天');
  });
  
  test('SemanticService normalizer 集成測試', async () => {
    // 直接測試 SemanticService.analyzeByOpenAI
    const result = await semanticService.analyzeByOpenAI('清空課表');
    
    // 驗證 intent 被正規化為英文
    expect(result.intent).toBe('clear_schedule');  // 不是中文 '清空課表'
    
    // 驗證 evidence 結構完整
    expect(result.evidence).toHaveProperty('temporal_clues');
    expect(result.evidence).toHaveProperty('mood_indicators');
    expect(result.evidence).toHaveProperty('question_markers');
    
    // 驗證 confidence 結構完整
    expect(result.confidence).toHaveProperty('overall');
    expect(result.confidence).toHaveProperty('intent_certainty');
  });
});
```

**驗收標準**:
- ✅ **所有 P1-P5 決策測試 100% 通過**
- ✅ evidence 結構完整性驗證通過
- ✅ reasoning_chain 生成正常
- ✅ SemanticController 輸出格式完全不變
- ✅ normalizer 故障時系統仍正常運作

---

- [ ] ### Task 2.5: 端到端格式一致性驗證
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Task 2.4

**輸入**:
- 集成了 normalizer 的完整系統
- `/src/controllers/lineController.js` 當前實現
- TaskService 的 Intent 處理邏輯

**執行步驟**:
1. 驗證完整用戶請求處理流程的格式一致性
2. 測試 "清空課表" 等之前失敗案例現在正常工作
3. 驗證 TaskService 接收到標準化的 intent 和 entities
4. 確認 "Unknown intent" 錯誤已完全解決

**輸出**:
- 端到端格式一致性驗證報告
- 之前問題案例的修復驗證

**關鍵驗證流程**:
```javascript
// 端到端流程驗證
describe('端到端格式一致性測試', () => {
  test('解決 "清空課表" Unknown intent 問題', async () => {
    // 模擬 LINE 用戶輸入
    const userMessage = '清空課表';
    
    // 通過完整流程處理
    const controllerResult = await SemanticController.analyze(userMessage, []);
    
    // 驗證 SemanticController 返回標準格式
    expect(controllerResult.final_intent).toBe('clear_schedule');  // 英文標準格式
    expect(['ai', 'regex', 'fallback']).toContain(controllerResult.source);
    
    // 驗證 TaskService 可以正確處理
    const taskResult = await TaskService.executeIntent(
      controllerResult.final_intent, 
      controllerResult.entities, 
      'test_user'
    );
    
    // 驗證不再有 "Unknown intent" 錯誤
    expect(taskResult.error).not.toContain('Unknown intent');
    expect(taskResult.success).toBe(true);
  });
  
  test('驗證所有 Intent 都在 TaskService 支持範圍內', async () => {
    const testCases = [
      '記錄數學課', '查詢課表', '修改課程', '取消課程', 
      '每週數學課', '清空課表', '記錄課程內容'
    ];
    
    for (const testCase of testCases) {
      const result = await SemanticController.analyze(testCase, []);
      
      // 驗證返回的 intent 都是 TaskService 支持的
      const supportedIntents = [
        'record_course', 'query_schedule', 'modify_course', 
        'cancel_course', 'clear_schedule', 'create_recurring_course',
        'record_lesson_content', 'unknown'
      ];
      
      expect(supportedIntents).toContain(result.final_intent);
    }
  });
});
```

**驗收標準**:
- ✅ "清空課表" 等問題案例完全修復
- ✅ 所有 Intent 都映射到 TaskService 支持的枚舉
- ✅ 端到端測試 100% 通過
- ✅ 無任何 "Unknown intent" 錯誤發生
- ✅ LineController 和 TaskService 無需任何修改

---

- [ ] ### Task 2.6: 建立 A/B 測試框架
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 2.3

**輸入**:
- 原始 prompt 和簡化 prompt
- 現有測試案例集
- 性能監控機制

**執行步驟**:
1. 創建 A/B 測試配置機制
2. 實現並行測試執行邏輯
3. 建立效果對比指標收集
4. 創建測試結果分析工具

**輸出**:
- `/scripts/ab-test-semantic.js` - A/B 測試工具
- A/B 測試配置和執行框架

**測試指標**:
```javascript
const metrics = {
  token_usage: "Token 使用量",
  response_time: "響應時間", 
  accuracy: "意圖識別準確率",
  entity_extraction_quality: "實體提取質量",
  error_rate: "錯誤率"
};
```

**驗收標準**:
- ✅ 可以同時運行原始和簡化 prompt
- ✅ 自動收集和對比關鍵指標
- ✅ 生成詳細的對比報告
- ✅ 幫助決策是否採用簡化 prompt

---

- [ ] ### Task 2.7: 性能和成本監控實施
**優先級**: P1 (High)  
**預估時間**: 2 小時  
**依賴**: Task 2.2

**輸入**:
- 集成了 normalizer 的 SemanticController
- 現有監控框架
- OpenAI API 調用統計

**執行步驟**:
1. 添加 Token 使用量監控
2. 添加 normalizer 處理時間監控
3. 實現成本計算和報告
4. 設置關鍵指標告警

**輸出**:
- 更新的監控配置
- 成本和性能儀表板配置

**監控指標**:
```javascript
const monitoringMetrics = {
  'semantic.token_usage': 'OpenAI Token 消耗',
  'semantic.normalizer_time': 'Normalizer 處理時間',
  'semantic.cost_per_request': '每次請求成本',
  'semantic.normalization_success_rate': '正規化成功率'
};
```

**驗收標準**:  
- ✅ 實時監控 Token 使用量變化
- ✅ 成本優化效果可視化
- ✅ 性能退化及時發現和告警
- ✅ 支持歷史趨勢分析

---

- [ ] ### Task 2.8: Phase 2 端到端測試
**優先級**: P0 (Critical)  
**預估時間**: 4 小時  
**依賴**: Task 2.1-2.7

**輸入**:
- Phase 2 所有完成的組件
- 完整的測試案例集
- 性能基準數據

**執行步驟**:
1. 執行完整的用戶流程測試
2. 驗證所有 Intent 和 Entity 處理正確性
3. 性能回歸測試
4. 穩定性壓力測試

**輸出**:
- 端到端測試報告
- 性能對比分析
- Phase 2 完整性驗證報告

**測試覆蓋範圍**:
```javascript
const testCoverage = {
  '用戶輸入處理': '覆蓋所有支持的 Intent 類型',
  '多輪對話': '驗證上下文處理不受影響', 
  '錯誤處理': '各種異常情況的處理',
  '性能表現': 'Token 優化和響應時間改善',
  '成本效益': '實際成本降低驗證'
};
```

**驗收標準**:
- ✅ 所有用戶流程正常工作
- ✅ Token 使用量減少 40-50%
- ✅ 響應時間改善或保持
- ✅ 無功能退化或準確率下降
- ✅ 系統穩定性不受影響

---

- [ ] ### Task 2.9: 實現 UnifiedSemanticGateway 核心整合
**優先級**: P0 (Critical)  
**預估時間**: 4 小時  
**依賴**: Task 2.2, Task 1.11

**輸入**:
- Task 1.11 的 UnifiedSemanticGateway 基礎架構
- 已集成 normalizer 的 SemanticService
- EnhancedSemanticService 的記憶增強功能
- OpenAIService 的直接調用邏輯

**執行步驟**:
1. 將 SemanticService.analyzeByOpenAI 整合到 UnifiedSemanticGateway
2. 將 EnhancedSemanticService 的 gptFallbackWithMemory 整合到統一入口
3. 將 OpenAIService 的直接調用也通過 SemanticNormalizer
4. 確保所有調用路徑都使用統一標準化
5. 保持 SmartQuery、long-memory、multi-turn 功能完整

**輸出**:
- 更新的 `/src/services/unifiedSemanticGateway.js` - 完整整合功能

**驗收標準**:
- ✅ 所有 OpenAI 調用路徑都通過統一入口
- ✅ 所有調用結果都經過 SemanticNormalizer 標準化
- ✅ EnhancedSemanticService 的所有功能保持完整
- ✅ 所有現有功能測試通過

---

- [ ] ### Task 2.10: 驗證 Long-Memory 系統不受影響
**優先級**: P0 (Critical)  
**預估時間**: 2 小時  
**依賴**: Task 2.9

**輸入**:
- 整合後的 UnifiedSemanticGateway
- 現有的 long-memory 測試案例
- `/tests/longMemoryIntegrationTest.js`

**執行步驟**:
1. 執行現有的 long-memory 整合測試
2. 驗證三層記憶系統（ConversationContext + Memory.yaml + SmartQuery）不受影響
3. 測試省略語句智能補全功能
4. 驗證多輪對話連續性

**輸出**:
- Long-memory 系統完整性驗證報告

**驗收標準**:
- ✅ 所有 long-memory 測試案例 100% 通過
- ✅ 三層記憶系統功能完整
- ✅ 省略語句補全功能正常
- ✅ 多輪對話連續性不受影響

---

- [ ] ### Task 2.11: LineController 遷移到統一入口
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 2.9

**輸入**:
- 完整功能的 UnifiedSemanticGateway
- 現有的 `/src/controllers/lineController.js`
- 所有 LineController 測試案例

**執行步驟**:
1. 更新 LineController 使用 UnifiedSemanticGateway.analyze()
2. 保持完全向後兼容的輸出格式
3. 移除對 SemanticController、SemanticAdapter 的直接調用
4. 新增統一入口的配置開關（支持漸進式切換）

**輸出**:
- 更新的 `/src/controllers/lineController.js`
- 新增的配置檔案

**驗收標準**:
- ✅ 所有 LineController 測試案例 100% 通過
- ✅ 輸出格式完全向後兼容
- ✅ 支持運行時切換入口模式
- ✅ 有完整的回滾能力

---

- [ ] ### Task 2.12: Phase 2 文檔和總結
**優先級**: P2 (Medium)  
**預估時間**: 2 小時  
**依賴**: Task 2.11

**輸入**:
- Phase 2 測試結果
- 性能監控數據
- A/B 測試報告

**執行步驟**:
1. 更新技術文檔反映 Phase 2 變更
2. 撰寫 Phase 2 成果總結報告
3. 記錄經驗教訓和優化建議
4. 準備 Phase 3 執行建議

**輸出**:
- Phase 2 成果報告
- 更新的技術文檔
- Phase 3 準備建議

**驗收標準**:
- ✅ 文檔準確反映實際實現
- ✅ 包含詳細的性能改善數據
- ✅ 為 Phase 3 提供明確的執行指導

---

## 🚀 Phase 3: 全面優化（中風險階段）

> **目標**: 達到最終的統一架構，清理冗餘組件，實現最大的 Token 優化效果

- [ ] ### Task 3.1: 完全簡化 OpenAI Prompt 設計
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Phase 2 完成 + A/B 測試驗證

**輸入**:
- Phase 2 的 A/B 測試結果
- SemanticNormalizer 的完整映射能力
- 當前簡化 prompt 的效果數據

**執行步驟**:
1. 設計極簡版 prompt（僅保留基本 JSON 結構）
2. 移除所有 Intent 枚舉約束
3. 移除所有 Entity 格式約束
4. 保留最核心的語意分析指令

**輸出**:
- `/config/prompts/semantic-minimal.json` - 極簡版 prompt
- 更新的配置機制支持三種 prompt 模式

**極簡 Prompt 設計**:
```javascript
// 目標：<200 tokens 的極簡 prompt
const minimalPrompt = `
分析用戶輸入的意圖和相關信息，返回 JSON 格式：
{
  "intent": "用戶想要做什麼",
  "entities": {
    "course_name": "課程名稱",
    "student_name": "學生姓名",
    "date": "日期", 
    "time": "時間",
    "content": "相關內容"
  }
}
只返回 JSON，不需要其他說明。
`;
```

**驗收標準**:
- ✅ Token 使用量 < 200 tokens per request
- ✅ 仍能正確識別用戶意圖
- ✅ 有完整的 fallback 和回滾機制
- ✅ 通過漸進式部署驗證

---

- [ ] ### Task 3.2: 強化 SemanticNormalizer 映射能力
**優先級**: P0 (Critical)  
**預估時間**: 4 小時  
**依賴**: Task 3.1

**輸入**:
- 極簡 prompt 可能產生的更多樣化輸出
- 現有映射表和處理邏輯
- Phase 2 收集的邊界案例

**執行步驟**:
1. 擴展 Intent 映射表，涵蓋更多自然語言表達
2. 實現模糊匹配算法（如關鍵詞匹配、相似度計算）
3. 強化 Entity 值的智能映射
4. 實現更強的 fallback 和錯誤恢復機制

**輸出**:
- 更新的 `/src/services/semanticNormalizer.js` - 增強版映射邏輯
- 擴展的映射數據文件

**增強功能**:
```javascript
class SemanticNormalizer {
  /**
   * 模糊 Intent 匹配
   * @param {string} rawIntent - 原始 intent，可能是任意自然語言
   * @returns {string} 映射到的標準 intent
   */
  static fuzzyMatchIntent(rawIntent) {
    // 1. 精確映射表查找
    // 2. 關鍵詞匹配
    // 3. 語意相似度計算
    // 4. fallback to 'unknown'
  }
  
  /**
   * 智能 Entity 值映射
   * @param {Object} rawEntities - 原始 entities
   * @returns {Object} 標準化 entities
   */
  static smartEntityMapping(rawEntities) {
    // 實現課程名稱、學生姓名等的智能映射和標準化
  }
}
```

**驗收標準**:
- ✅ 能處理各種自然語言表達的 intent
- ✅ Entity 值的自動標準化和去重
- ✅ 模糊匹配準確率 > 85%
- ✅ 處理時間增加 < 100ms

---

- [ ] ### Task 3.3: 優化其他語意服務組件
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 3.2

**輸入**:
- `/src/services/enhancedSemanticService.js` 當前實現
- 統一的 SemanticNormalizer 介面
- 其他相關語意處理組件

**執行步驟**:
1. 更新 enhancedSemanticService 使用統一的 normalizer
2. 修改 semanticAdapter 適配新的格式標準
3. 檢查和更新所有語意相關的工具類
4. 統一所有組件的輸出格式

**輸出**:
- 更新的語意服務組件
- 統一的格式標準文檔

**統一標準**:
```javascript
// 所有語意服務組件都必須遵循的輸出格式
const STANDARD_OUTPUT_FORMAT = {
  intent: 'string',           // 必須是 VALID_INTENTS 中的值
  entities: 'object',         // 必須符合標準 entity 結構
  confidence: 'number',       // 0-1 的信心分數
  source: 'string',          // 'openai' | 'regex' | 'hybrid'
  _debug: 'object'           // debug 和追蹤信息
};
```

**驗收標準**:
- ✅ 所有語意服務輸出格式統一
- ✅ 無格式相關的集成問題
- ✅ 保持各組件的獨特功能
- ✅ 性能無明顯退化

---

- [ ] ### Task 3.4: 實施映射表緩存和性能優化
**優先級**: P1 (High)  
**預估時間**: 2 小時  
**依賴**: Task 3.2

**輸入**:
- 強化後的 SemanticNormalizer
- 性能監控數據
- 高頻訪問模式分析

**執行步驟**:
1. 實現映射表內存緩存
2. 優化映射查找算法
3. 實現結果緩存機制
4. 添加緩存命中率監控

**輸出**:
- 性能優化版的 SemanticNormalizer
- 緩存監控配置

**優化策略**:
```javascript
class SemanticNormalizer {
  static cache = new Map();
  static hitRate = 0;
  
  static normalizeWithCache(input) {
    const cacheKey = JSON.stringify(input);
    
    if (this.cache.has(cacheKey)) {
      this.hitRate = (this.hitRate * 0.99) + 0.01; // 滑動平均
      return this.cache.get(cacheKey);
    }
    
    const result = this.normalizeAnalysisResult(input);
    this.cache.set(cacheKey, result);
    
    // LRU 策略，限制緩存大小
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return result;
  }
}
```

**驗收標準**:
- ✅ normalizer 處理時間減少 > 50%
- ✅ 緩存命中率 > 60%
- ✅ 內存使用量控制在合理範圍
- ✅ 支持緩存清除和刷新

---

- [ ] ### Task 3.5: 建立全面的監控和告警系統  
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 3.1-3.4

**輸入**:
- 完整的 Phase 3 實現
- 現有監控框架
- 關鍵業務指標定義

**執行步驟**:
1. 建立 Token 使用量和成本監控儀表板
2. 實現準確率和性能監控
3. 設置異常檢測和自動告警
4. 建立趨勢分析和預測能力

**輸出**:
- 完整的監控和告警配置
- 運維儀表板和報告

**監控體系**:
```javascript
const monitoringSystem = {
  metrics: {
    'token_usage_rate': 'Token 使用量變化率',
    'cost_savings': '成本節省金額',
    'accuracy_rate': '意圖識別準確率', 
    'entity_quality_score': 'Entity 提取質量分數',
    'normalizer_performance': 'Normalizer 處理性能',
    'cache_hit_rate': '緩存命中率'
  },
  alerts: {
    'accuracy_drop': '準確率下降超過 5%',
    'cost_spike': '成本異常增長',
    'performance_degradation': '響應時間增加超過 50%'
  }
};
```

**驗收標準**:
- ✅ 實時監控所有關鍵指標
- ✅ 異常情況及時告警
- ✅ 提供趨勢分析和優化建議
- ✅ 支持歷史數據分析和報告

---

- [ ] ### Task 3.6: Phase 3 全面測試和驗證
**優先級**: P0 (Critical)  
**預估時間**: 4 小時  
**依賴**: Task 3.1-3.5

**輸入**:
- Phase 3 所有完成的組件
- 完整的測試案例庫
- 性能和成本基準數據

**執行步驟**:
1. 執行完整的回歸測試
2. 進行大規模的壓力測試
3. 驗證極限情況下的系統行為
4. 測試回滾和災難恢復流程

**輸出**:
- 全面測試報告
- 性能優化效果驗證
- 系統穩定性評估報告

**測試範圍**:
```javascript
const testSuite = {
  功能測試: '所有 Intent 和 Entity 處理正確性',
  性能測試: 'Token 優化效果和響應時間改善',
  穩定性測試: '長時間運行和高並發場景',
  災難恢復測試: '各種異常情況的處理和恢復',
  成本效益測試: '實際成本節省驗證'
};
```

**驗收標準**:
- ✅ 所有功能測試通過，無回歸問題
- ✅ Token 使用量減少 80%+，成本節省 70%+
- ✅ 響應時間改善 > 30%
- ✅ 系統穩定性指標符合預期
- ✅ 災難恢復機制有效

---

- [ ] ### Task 3.7: 生產環境部署準備
**優先級**: P0 (Critical)  
**預估時間**: 3 小時  
**依賴**: Task 3.6

**輸入**:
- 通過全面測試的 Phase 3 實現
- 生產環境配置和約束
- 部署和回滾程序

**執行步驟**:
1. 準備生產環境配置
2. 建立漸進式部署策略
3. 準備監控和告警配置
4. 建立應急響應程序

**輸出**:
- 生產部署配置和腳本
- 運維手冊和應急程序
- 漸進式部署計劃

**部署策略**:
```javascript
const deploymentStrategy = {
  phase1: '5% 流量使用新系統，95% 使用舊系統',
  phase2: '25% 流量使用新系統，監控指標',
  phase3: '50% 流量使用新系統，全面對比',
  phase4: '100% 切換到新系統，舊系統保持待命'
};
```

**驗收標準**:
- ✅ 有完整的部署和回滾腳本
- ✅ 監控和告警在生產環境正常工作
- ✅ 有詳細的運維文檔和程序
- ✅ 應急響應流程經過演練

---

- [ ] ### Task 3.8: 架構清理和組件移除
**優先級**: P1 (High)  
**預估時間**: 3 小時  
**依賴**: Task 3.7

**輸入**:
- 完整功能的 UnifiedSemanticGateway
- 現有的 SemanticAdapter、EnhancedSemanticService 等組件
- 所有相關測試案例

**執行步驟**:
1. **移除 SemanticAdapter**（過度複雜的適配器模式）
2. **清理 EnhancedSemanticService**（功能已整合到 UnifiedSemanticGateway）
3. **統一 OpenAIService 調用**（移除直接調用，統一通過 Gateway）
4. 更新所有相關測試案例
5. 更新文檔和 import 參考

**輸出**:
- 清理後的代碼庫（移除冗餘組件）
- 更新的測試案例
- 更新的文檔

**驗收標準**:
- ✅ SemanticAdapter 完全移除，無殘留引用
- ✅ EnhancedSemanticService 功能完全整合到 UnifiedSemanticGateway
- ✅ 所有 OpenAI 調用統一通過 Gateway
- ✅ 所有測試案例通過
- ✅ **代碼量減少 30%+**，維護成本大幅降低

---

- [ ] ### Task 3.9: Phase 3 總結和文檔化
**優先級**: P2 (Medium)  
**預估時間**: 2 小時  
**依賴**: Task 3.8

**輸入**:
- Phase 3 完整實現和測試結果
- 性能和成本優化數據
- 部署和運維經驗

**執行步驟**:
1. 撰寫 Phase 3 成果總結報告
2. 更新技術文檔和架構圖
3. 記錄最佳實踐和經驗教訓
4. 準備知識轉移材料

**輸出**:
- Phase 3 成果報告
- 完整的技術文檔更新
- 最佳實踐指南

**驗收標準**:
- ✅ 文檔完整反映最終實現
- ✅ 包含詳細的性能和成本改善數據
- ✅ 提供清晰的維護和擴展指導
- ✅ 支持團隊知識轉移

---

## 📊 總體執行計劃

### 🎯 里程碑和時間線

| 階段 | 任務數 | 預估時間 | 關鍵里程碑 | 風險等級 |
|------|--------|----------|------------|----------|
| **Phase 1** | 14 | 25 小時 | SemanticNormalizer + UnifiedSemanticGateway 完成 | 🟢 無風險 |
| **Phase 2** | 12 | 20 小時 | 漸進式整合+架構簡化完成 | 🟡 低風險 |
| **Phase 3** | 9 | 15 小時 | 全面優化+架構清理完成 | 🟠 中風險 |

### ⚡ 並行執行策略

**可並行執行的任務組**:
- Task 1.1, 1.2, 1.12 可以並行
- Task 1.6, 1.8, 1.9, 1.13 可以並行  
- Task 2.3, 2.6, 2.10 可以並行
- Task 3.4, 3.5 可以並行

**關鍵依賴路徑**:
```
1.1 → 1.3 → 1.11 → 2.9 → 2.11 → 3.8 → 3.9
```

### 🚨 風險緩解策略

**高風險任務的額外保障**:
- Task 2.2, 3.1: 有完整的 A/B 測試和回滾機制
- Task 3.6: 多輪測試驗證，漸進式部署
- Task 3.7: 分階段部署，實時監控

### 📈 成功指標總覽

**量化目標**:
- 🎯 **Token 使用量減少**: > 80%
- 🎯 **成本節省**: > 70%  
- 🎯 **響應時間改善**: > 30%
- 🎯 **準確率維持**: ≥ 95%
- 🎯 **系統可用性**: > 99.9%
- 🎯 **💯 代碼量減少**: > 30%
- 🎯 **💯 維護成本降低**: > 70%

**質量目標**:
- 🎯 **零回歸**: 所有現有功能正常
- 🎯 **零停機**: 平滑升級和部署
- 🎯 **完整文檔**: 支持長期維護
- 🎯 **團隊能力**: 完整的知識轉移
- 🎯 **💯 架構清晰**: 統一入口，消除複雜度
- 🎯 **💯 開發效率**: 新功能開發速度提升 50%+

---

## ✅ 執行檢查清單

### 🔍 Phase 1 檢查項目
- [ ] Task 1.1: 映射數據結構完成（包含 OpenAIService 映射）
- [ ] Task 1.2: TypeScript 類型定義完成  
- [ ] Task 1.3: SemanticNormalizer 核心邏輯完成
- [ ] Task 1.4: 動態載入機制完成
- [ ] Task 1.5: 單元測試完成（覆蓋率 > 95%）
- [ ] Task 1.6: 映射表管理工具完成
- [ ] Task 1.7: Enum 約束驗證完成
- [ ] Task 1.8: 監控和日誌機制完成
- [ ] Task 1.9: 回滾機制完成
- [ ] Task 1.10: Phase 1 整合測試通過
- [ ] Task 1.11: **UnifiedSemanticGateway 基礎架構完成**
- [ ] Task 1.12: **OpenAIService 調用路徑分析完成**
- [ ] Task 1.13: **映射表適配 OpenAIService 完成**
- [ ] Task 1.14: **Phase 1 整合測試通過**
- [ ] Task 1.15: 文檔更新完成

### 🔍 Phase 2 檢查項目  
- [ ] Task 2.1: SemanticController 集成方案確定
- [ ] Task 2.2: Normalizer 集成實現完成
- [ ] Task 2.3: 第一版 prompt 簡化完成（Token 減少 60-70%）
- [ ] Task 2.4: 測試案例更新完成
- [ ] Task 2.5: LineController 適配性驗證通過
- [ ] Task 2.6: A/B 測試框架建立
- [ ] Task 2.7: 性能監控實施完成
- [ ] Task 2.8: Phase 2 端到端測試通過
- [ ] Task 2.9: **UnifiedSemanticGateway 核心整合完成**
- [ ] Task 2.10: **Long-Memory 系統不受影響驗證通過**
- [ ] Task 2.11: **LineController 遷移到統一入口完成**
- [ ] Task 2.12: Phase 2 文檔和總結完成

### 🔍 Phase 3 檢查項目
- [ ] Task 3.1: 極簡 prompt 設計完成（< 200 tokens）
- [ ] Task 3.2: 強化映射能力完成
- [ ] Task 3.3: 其他語意服務優化完成
- [ ] Task 3.4: 性能優化實施完成
- [ ] Task 3.5: 全面監控系統建立
- [ ] Task 3.6: 全面測試和驗證通過
- [ ] Task 3.7: 生產部署準備完成
- [ ] Task 3.8: **架構清理和組件移除完成**
- [ ] Task 3.9: 總結文檔化完成

---

**🎯 執行原則**：
> 每個任務都必須有明確的輸入、輸出、驗收標準，確保可追蹤、可驗證、可回滾。通過原子化任務分解，我們將複雜的全局重構轉化為可控的、漸進式的改進過程。

---

*任務計劃版本：v2.0*  
*更新日期：2025-08-01*  
*總預估工時：60 小時*  
*負責人：Claude Code*  
*主要更新：新增 UnifiedSemanticGateway 和架構簡化任務*