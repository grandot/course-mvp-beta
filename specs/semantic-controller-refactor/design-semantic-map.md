# 📘《語意對照表設計方案書》v1.2

> IntentOS 語意任務系統 · 語意正規化映射與 enum 強化版（完整說明）

### 適用對象：

負責語意任務解析與資料清洗的工程師（Claude、NLU 模組設計者）

---

## 🧭 一、設計背景與新增動機

IntentOS 語意任務系統目前透過 OpenAI LLM 模型進行使用者語句解析，產出：

* `intent`（任務意圖）
* `entities`（任務欄位：課名、老師、時間、地點等）

先前系統設計中，為了讓模型能理解語意與回傳正確格式，我們**將 enum 限制、欄位格式、命名規則全部寫入 prompt 中**。但這樣做產生了以下兩個重大問題：

### ❌ 問題 1：Prompt token 暴增

* 為了讓模型理解所有格式與限制，每次呼叫都要輸入完整格式規則與欄位說明
* 當欄位或 intent 種類擴充後，Prompt token 數量容易爆掉限制（尤其是 GPT-3.5）

### ❌ 問題 2：維護困難、規則分散

* 每次新增 intent 或課名、老師等欄位，都需手動調整 Prompt 多處欄位格式
* 無法集中維護，容易造成模型輸出錯誤，且 debugging 成本極高

---

## ✅ 解決思路：將語意標準化邏輯從 prompt 中抽出

建立一個獨立的模組「語意正規化映射層」（Semantic Normalization Layer），將模型輸出的自然語意（中文/模糊語）**映射成系統標準格式（英文 enum、固定欄位）**。

這個映射層的核心目標是：

* **讓 prompt 更簡潔，避免爆 token**
* **讓欄位與 intent 的解析結果標準化可控**
* **讓新增/擴充邏輯在代碼中集中管理、具備 fallback 安全機制**

---

## 🎯 二、解決目標

1. 對 **意圖名稱（Intent）** 做字串映射並限制為 enum
2. 對 **欄位名稱（Entity Keys）** 做鍵名轉換
3. 對 **欄位值（Entity Values）** 做內容轉換（如課名、老師名稱）
4. 保留 **未知值**，不報錯，並納入 fallback 或記錄處理

---

## 🧠 三、設計原則

| 類別          | 規則                                             | 處理方式                               |
| ----------- | ---------------------------------------------- | ---------------------------------- |
| Intent 名稱   | 必須使用標準 enum（固定集合）                              | 用 `intentMap` 映射 + `enum` 校驗       |
| Entity 欄位名稱 | 限定固定鍵名：course\_name、time、teacher、location、note | 使用 `entityKeyMap` 做鍵名轉換            |
| Entity 欄位值  | 建議落入預定義值（如課名表）                                 | 用 `entityValueMap` 映射，未命中 fallback |
| 不合法格式       | 不丟錯、不崩潰                                        | fallback 成 `unknown` 或保留原詞並記錄      |

---

## 🔤 四、Intent 列舉（enum）定義與使用說明

### ✅ 什麼是 enum？

**Enum（enumeration，列舉型別）** 是一組固定可選值，用來保證 intent 不會自由生成，避免語意漂移或崩潰。

### ✅ Intent Enum 定義如下：

```ts
type Intent =
  | "record_course"
  | "query_schedule"
  | "modify_course"
  | "cancel_course"
  | "clear_schedule"
  | "greeting"
  | "help"
```

### ✅ 為什麼不能用 Regex 解析 Intent？

| 問題        | 為何危險？                                      |
| --------- | ------------------------------------------ |
| 誤判風險高     | 例如：「昨天新增的課是什麼？」→ Regex 誤判為 `record_course` |
| 難以維護      | Regex 寫太多比對詞，未來不好調                         |
| 無法保障格式統一性 | Regex 對語意模糊詞無法做語境推理                        |

### ✅ 結論

Intent 僅允許來自 Enum 的固定值，任何自然語言 intent 必須透過 `intentMap` 做標準化。

---

## 🧩 五、對照表格式定義

### ✅ Intent 映射表（intentMap）

```ts
const intentMap = {
  "清空課表": "clear_schedule",
  "刪除課程": "cancel_course",
  "查看記錄": "query_schedule",
  "加一門課": "record_course",
  "修改一下": "modify_course",
  "打個招呼": "greeting",
  "幫我查查看": "query_schedule"
};
```

---

### ✅ Entity 欄位名稱映射（entityKeyMap）

```ts
const entityKeyMap = {
  "課名": "course_name",
  "老師": "teacher",
  "地點": "location",
  "備註": "note",
  "時間": "time"
};
```

---

### ✅ Entity 值映射（以課名為例）

```ts
const courseNameMap = {
  "鋼琴課": "piano",
  "英文課": "english",
  "科學實驗": "science_lab",
  "創意思考": "creative_thinking"
};
```

---

## 🧪 六、處理流程說明

```plaintext
使用者語句
   ↓
OpenAI 語意解析（自然語言 intent + entities）
   ↓
語意對照表映射層處理（intentMap + entityKeyMap + entityValueMap）
   ↓
檢查 intent 是否在 enum 列舉內 → 是 → 傳給 SemanticController
                                      ↓ 否 → fallback "unknown"
   ↓
進入任務執行流程（TaskService）
```

---

## 🛠️ 七、Fallback 策略

### Intent fallback：

* 若映射後的 intent 不在 enum 中 → 設為 `"unknown"`，不進入任務流程

### Entity 欄位未命中：

* 欄位名稱：保留原 key（如 "老師"），記錄 warning
* 欄位值：保留原文（如 "英文寫作課"），標記 `"normalized": false`，可後續補充

---

## 📁 八、建議模組結構

```
/services/
  ├── semanticNormalizer.ts  # 對照轉換邏輯
  └── semanticService.ts     # 呼叫 LLM、做初步語意處理

/data/
  ├── intentMap.json
  ├── entityKeyMap.json
  └── courseNameMap.json     # 可由後台或 CMS 管理

/types/
  └── semantic.ts            # intent enum、欄位定義
```

---

## 🔧 九、維護與擴展建議

| 項目          | 做法                                      |
| ----------- | --------------------------------------- |
| Intent 擴充   | 僅允許透過 enum 修改（由產品方審核）                   |
| Entities 擴充 | 建議用 JSON 管理 courseNameMap 等資料，支援熱更新     |
| 自動補對照表      | 未命中時 log unknown\_entities.json，後台介面可補錄 |
| 多語詞支援       | 課名可接受中、英別名；可設計 alias 層結構                |

---

## ✅ 十、驗收與測試案例

| 測試語句         | 模型回傳                    | 預期轉換後                       |
| ------------ | ----------------------- | --------------------------- |
| "清空課表"       | "intent": "清空課表"        | "intent": "clear\_schedule" |
| "幫我查查看昨天那堂課" | "intent": "幫我查查看"       | "intent": "query\_schedule" |
| "英文寫作課"      | "course\_name": "英文寫作課" | 保留原值，並記錄為 unknown           |
| "打個招呼一下"     | "intent": "打個招呼"        | "greeting"                  |
| "我要上課"       | "intent": "我要上課"        | fallback → "unknown"        |

---

如需搭配：

* ✅《Prompt 編寫規範 v1.0》
* ✅《unknown\_entities 管理流程》
* ✅《意圖擴充審核流程》

可於後續版本增補，若需我幫你擴充其中一份，請指名即可。
