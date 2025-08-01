# 📘《語意控制器決策改版方案書》v2.0 - 證據驅動優化版

### 適用對象：

給負責 IntentOS Course 模組開發的工程師（Claude）

---

## 🧭 一、背景與問題說明

目前語意任務系統的解析邏輯是：

```
Regex 優先 → 若無命中再交由 AI 補全 slot
```

但實際執行結果造成以下問題：

* 使用者語句如「上次Rumi的課上得怎麼樣」常被誤判為「新增課程」。
* AI 被動補全，沒有主導意圖的判斷力。
* 用戶問「我記得7/31不是已經記錄過了嗎」，系統卻又當作是修改課程，造成嚴重誤判。
* 整體互動體驗非常死板，缺乏語意靈活性，無法感受到語言驅動任務的效果。

---

## 🎯 二、改版目標

1. 建立一個語意控制器（Semantic Decision Controller），負責整合 AI 與 Regex 的判斷結果。
2. 由控制器負責**裁決最終意圖與欄位**，而非只靠順序決定。
3. 建立 AI 對自身結果的「信心分數」判斷機制，提升 AI 決策可信度。
4. 將此控制器邏輯部署在主後端 API 中，與 Claude Code CLI 無關，真正上線運行。

---

## 🧠 三、核心邏輯概念

### （1）語意輸入 → 雙重分析

使用者每次輸入，會同時送往兩個解析器：

* `OpenAI 語意模型`：產出意圖、欄位、信心分數
* `Regex 模組`：根據固定模式產出意圖、欄位、是否命中

---

### （2）中控決策邏輯（語意控制器）- 證據驅動機制

負責根據兩組分析結果的**證據質量**，判斷應採用哪一種。不再依賴簡單分數比較，而是分析推理邏輯。

**決策規則如下：**

| 優先級 | 決策條件 | 採用來源 | 判斷依據 |
|--------|----------|----------|----------|
| P1 | 語氣與意圖衝突 | AI | 疑問語氣 + Regex判斷新增 = 邏輯矛盾 |
| P2 | 時間線索存在 | AI | 含"上次/昨天"等時序詞，Regex無法理解 |
| P3 | AI推理鏈完整 | AI | 推理步驟≥3且confidence>0.8 |
| P4 | Regex強匹配 | Regex | pattern_strength>0.9且無歧義詞 |
| P5 | 默認保守策略 | AI | 避免Regex硬規則誤判 |

**關鍵創新**：控制器分析**為什麼**這樣判斷，而非只看**分數高低**。

### 補強機制

#### （4）預設失敗處理（Fallback 機制）

在以下情況觸發 fallback：
- 無法判斷意圖（兩方皆模糊）
- AI 回傳格式錯誤
- Regex 沒有 match 且 AI 信心不足 (<0.6)

Fallback 輸出格式：
```json
{
  "final_intent": "unknown",
  "source": "fallback", 
  "reason": "AI與Regex均無法提供足夠證據",
  "suggestion": "請明確說明您想查詢哪一堂課的記錄？或者提供更多課程細節？",
  "confidence": 0.0
}
```

#### （5）可觀察性（Debug Trace）

內部測試模式支援 `debug: true`，回傳完整決策路徑：
```json
{
  "final_intent": "query_course",
  "source": "ai", 
  "reason": "含時間線索與疑問語氣，Regex無法解讀",
  "used_rule": "P2",
  "debug_info": {
    "ai_analysis": { /* 完整AI分析結果 */ },
    "regex_analysis": { /* 完整Regex分析結果 */ },
    "decision_path": ["P1檢查-未命中", "P2檢查-命中", "決策完成"],
    "execution_time": "120ms"
  }
}
```

---

### （3）證據驅動分析機制

#### AI 分析結果結構
```typescript
{
  "intent": "query_course",
  "entities": { "course_name": "科學實驗", "time": "上週" },
  
  // 核心優化：多維度證據
  "evidence": {
    "temporal_clues": ["上次"],           // 時間線索
    "mood_indicators": ["怎麼樣"],        // 語氣指標  
    "action_verbs": ["上得"],             // 動作詞
    "question_markers": ["怎麼樣"]        // 疑問標記
  },
  
  // 推理鏈（解決「為什麼」的問題）
  "reasoning_chain": {
    "step1": "識別到時間詞'上次'，表示回顧過去",
    "step2": "識別到疑問語氣'怎麼樣'，表示詢問狀態", 
    "step3": "結合語境，判定為查詢意圖",
    "confidence_source": "基於步驟1-3的邏輯鏈"
  },
  
  "confidence": {
    "overall": 0.92,
    "intent_certainty": 0.95,           // 對意圖的把握
    "context_understanding": 0.88       // 對語境的理解
  }
}
```

#### Regex 分析結果結構
```typescript
{
  "intent": "add_course", 
  "entities": { "course_name": "科學實驗" },
  
  // 新增：匹配證據
  "match_details": {
    "triggered_patterns": ["課程.*實驗"],
    "keyword_matches": ["課", "實驗"],
    "ambiguous_terms": ["課"],           // 可能有歧義的詞
    "pattern_strength": 0.6
  },
  
  // 限制性分析
  "limitations": {
    "context_blind": true,              // 忽略了上下文
    "temporal_blind": true,             // 忽略了時間線索
    "mood_blind": true                  // 忽略了語氣
  }
}
```

---

## 🏗️ 四、架構圖（證據驅動版）

```plaintext
使用者語句 + 對話歷史
   ↓
【 OpenAI 證據分析 】──┐  生成：evidence + reasoning_chain + confidence
                        ├─→ 語意控制器 ──→ 證據邏輯分析 ──→ 最終決策
【 Regex 模式分析 】───┘  生成：match_details + limitations + pattern_strength
                        ↓
                   決策依據：
                   P1: 語氣衝突檢測
                   P2: 時間線索權重  
                   P3: 推理鏈質量
                   P4: 強匹配優勢
                   P5: 保守AI策略
```

---

## 🛠️ 五、開發任務拆解

### ✅ A. semanticService.analyzeByOpenAI (增強版)

優化 OpenAI 分析，支援證據驅動：

```typescript
interface AIAnalysisParams {
  userText: string;
  conversationHistory?: Message[];
}

// 返回結構
interface AIAnalysisResult {
  intent: string;
  entities: Record<string, any>;
  evidence: {
    temporal_clues: string[];
    mood_indicators: string[];
    action_verbs: string[];
    question_markers: string[];
  };
  reasoning_chain: Record<string, string>;
  confidence: {
    overall: number;
    intent_certainty: number;
    context_understanding: number;
  };
}
```

**新版 Prompt 模板**：
```
分析用戶語句，提供證據和推理過程：
輸入："${userText}"
${conversationHistory ? `對話歷史：${history}` : ''}

返回JSON格式，包含evidence、reasoning_chain、confidence等字段。
特別注意：
- "上次/昨天/之前" + 疑問 = 查詢過去
- "不是...嗎" = 確認性疑問  
- 純粹描述 = 新增記錄
```

### ✅ B. semanticService.analyzeByRegex (增強版)

增加匹配質量分析：

```typescript
interface RegexAnalysisResult {
  intent: string;
  entities: Record<string, any>;
  match_details: {
    triggered_patterns: string[];
    keyword_matches: string[];
    ambiguous_terms: string[];
    pattern_strength: number;
  };
  limitations: {
    context_blind: boolean;
    temporal_blind: boolean;
    mood_blind: boolean;
  };
}
```

### ✅ C. semanticController.decideByEvidence (核心邏輯)

```typescript
class SemanticController {
  async route(userText: string, conversationHistory?: Message[]) {
    const [aiResult, regexResult] = await Promise.all([
      this.semanticService.analyzeByOpenAI(userText, conversationHistory),
      this.semanticService.analyzeByRegex(userText)
    ]);

    return this.decideByEvidence(aiResult, regexResult, userText);
  }

  private decideByEvidence(ai: AIAnalysisResult, regex: RegexAnalysisResult, text: string, debug = false) {
    const decisionPath: string[] = [];
    
    // Fallback 檢測
    const aiInvalid = !ai || ai.confidence.overall < 0.6;
    const regexInvalid = !regex.match_details || regex.match_details.pattern_strength < 0.5;
    
    if (aiInvalid && regexInvalid) {
      return {
        final_intent: 'unknown',
        source: 'fallback',
        reason: 'AI與Regex均無法提供足夠證據',
        suggestion: '請明確說明您想查詢哪一堂課的記錄？或者提供更多課程細節？',
        confidence: 0.0,
        ...(debug && { debug_info: { ai, regex, decision_path: ['進入Fallback'] } })
      };
    }

    // P1: 語氣衝突檢測
    decisionPath.push('P1檢查-語氣衝突');
    if (ai.evidence.question_markers.length > 0 && regex.intent.includes('add_')) {
      decisionPath.push('P1命中-疑問語氣與新增衝突');
      return this.buildResult('ai', ai.intent, 'P1', '疑問語氣與新增意圖衝突', ai, regex, decisionPath, debug);
    }
    decisionPath.push('P1未命中');

    // P2: 時間線索權重
    decisionPath.push('P2檢查-時間線索');
    if (ai.evidence.temporal_clues.length > 0 && regex.limitations.temporal_blind) {
      decisionPath.push('P2命中-含時間線索');
      return this.buildResult('ai', ai.intent, 'P2', '含時間線索，Regex無法理解', ai, regex, decisionPath, debug);
    }
    decisionPath.push('P2未命中');

    // P3: AI推理鏈完整
    decisionPath.push('P3檢查-推理鏈質量');
    const reasoningSteps = Object.keys(ai.reasoning_chain).length - 1;
    if (reasoningSteps >= 3 && ai.confidence.overall > 0.8) {
      decisionPath.push('P3命中-推理鏈完整');
      return this.buildResult('ai', ai.intent, 'P3', 'AI推理鏈完整', ai, regex, decisionPath, debug);
    }
    decisionPath.push('P3未命中');

    // P4: Regex強匹配
    decisionPath.push('P4檢查-Regex強匹配');
    if (regex.match_details.pattern_strength > 0.9 && 
        ai.confidence.overall < 0.7 &&
        regex.match_details.ambiguous_terms.length === 0) {
      decisionPath.push('P4命中-Regex強匹配');
      return this.buildResult('regex', regex.intent, 'P4', 'Regex強匹配且無歧義', ai, regex, decisionPath, debug);
    }
    decisionPath.push('P4未命中');

    // P5: 默認AI
    decisionPath.push('P5默認-AI保守策略');
    return this.buildResult('ai', ai.intent, 'P5', '默認AI避免誤判', ai, regex, decisionPath, debug);
  }

  private buildResult(source: string, intent: string, rule: string, reason: string, 
                     ai: AIAnalysisResult, regex: RegexAnalysisResult, 
                     decisionPath: string[], debug: boolean) {
    const result = {
      final_intent: intent,
      source,
      reason,
      used_rule: rule,
      confidence: source === 'ai' ? ai.confidence.overall : regex.match_details.pattern_strength
    };

    if (debug) {
      result.debug_info = {
        ai_analysis: ai,
        regex_analysis: regex,
        decision_path: decisionPath,
        execution_time: `${Date.now()}ms` // 實際應用中需要正確計時
      };
    }

    return result;
  }
}
```

---

## 🔌 六、整合位置與呼叫路徑

控制器應部署於 `/services/semanticController.ts`
由 `/webhook/line` 呼叫主流程時使用：

```ts
const semanticResult = await semanticController.route(userInput);
```

---

## 📈 七、成效預期

### 核心問題解決效果

| 用戶輸入案例 | 原方案結果 | v2.0結果 | 改善原因 |
|-------------|------------|----------|----------|
| "上次Rumi的課怎麼樣" | ❌ 新增課程 | ✅ 查詢課程 | P2: 時間線索 + P1: 疑問語氣 |
| "7/31我不是記錄了嗎" | ❌ 修改課程 | ✅ 查詢記錄 | P1: 確認性疑問語氣衝突檢測 |
| "今天數學課很精彩" | ✅ 新增課程 | ✅ 新增課程 | P3: AI推理鏈判斷陳述語氣 |
| "幫我查看課程記錄" | ✅ 查詢課程 | ✅ 查詢課程 | P4: Regex強匹配無歧義 |
| "嗯...那個...課程" | ❌ 隨機判斷 | ✅ unknown + 請澄清 | Fallback機制優雅降級 |

### 整體指標改善

| 指標 | 改版前 | v2.0預期 | 關鍵改善 |
|------|--------|----------|----------|
| 誤判率（查詢vs新增） | ~30% | <10% | 證據驅動決策邏輯 |
| 語意理解自然度 | 低（死板） | 高（智能） | AI推理鏈+語氣分析 |
| 調試效率 | 低（黑盒） | 高（透明） | Debug trace完整決策路徑 |
| 開發時間浪費 | 高（調順序） | 0（邏輯穩定） | 不再依賴調參 |
| 系統可靠性 | 低（崩潰式失敗） | 高（優雅降級） | Fallback機制處理邊界情況 |
| 用戶體驗一致性 | 差（隨機猜測） | 優（明確澄清） | unknown時請求更多信息 |
| 響應速度 | 不穩定 | 穩定 | 並行分析+智能決策 |

---

## ✅ 八、交付要求（v2.0 證據驅動版）

### 必須實現的核心功能

1. **增強版 OpenAI 語意分析**
   - 支援 evidence 多維度分析（時間、語氣、動作、疑問）
   - 提供 reasoning_chain 推理過程
   - 返回多層次 confidence 分數

2. **增強版 Regex 模式分析**  
   - 計算 pattern_strength 匹配強度
   - 識別 ambiguous_terms 歧義詞
   - 標註 limitations 分析盲區

3. **語意控制器核心邏輯**
   - 實現 P1-P5 優先級決策規則
   - 證據衝突檢測與仲裁
   - 每個決策附帶 reason 解釋

4. **Fallback 機制** ⭐
   - AI/Regex 雙重失效時優雅降級
   - 返回 unknown + 具體澄清建議
   - 避免系統崩潰式猜測

5. **Debug 可觀察性** ⭐  
   - 支援 debug:true 模式
   - 完整決策路徑追蹤
   - 性能指標統計

6. **整合與測試**
   - webhook 流程調整使用新控制器
   - 針對文檔中的問題案例進行測試
   - 確保決策可解釋性

### 🎯 關鍵成功指標

**核心功能驗證**：
- ✅ "上次Rumi的課怎麼樣" → 正確識別為查詢
- ✅ "7/31我不是記錄了嗎" → 正確識別為查詢確認  
- ✅ 每個決策都有清晰的 reason 解釋
- ✅ 不再需要手動調整 Regex/AI 執行順序

**Fallback 機制驗證**：
- ✅ "嗯...那個...課程" → 返回 unknown + 澄清建議
- ✅ AI 格式錯誤時不崩潰，優雅降級
- ✅ 雙方信心不足時請求更多信息

**Debug 可觀察性驗證**：
- ✅ debug:true 時返回完整決策路徑
- ✅ 可清楚看到哪個規則命中(P1-P5)
- ✅ 執行時間和性能指標可觀測

### 📁 文件結構建議

```
/services/
  ├── semanticController.ts    # 主控制器
  ├── semanticService.ts       # AI分析服務  
  └── regexService.ts          # Regex分析服務

/types/
  └── semantic.ts              # 類型定義
```

---

**第一性原則檢驗**：這個方案解決的不是「調參問題」，而是「決策架構問題」。從根本上讓系統具備邏輯推理能力，而非依賴順序和閾值。
