以下是完整的版本，將 **AI 多輪對話設計** 拆解為可實作的功能需求文件，針對後端結構、記憶管理、語氣控制、容錯與提示策略全面規劃，適合作為產品設計與工程實作依據：

---

# 📘 AI 多輪對話系統需求設計書（完整版本）

## 一、目標說明

建立一套具備「多輪語意記憶」與「語氣風格一致性」的 ChatBot 回應系統，支援以下能力：

1. 能承接上一輪使用者尚未說完的任務（如補充欄位、延續意圖）
2. 能維持對話語氣的一致性，符合親切助理的角色設定
3. 在模糊語意或省略語句中具備容錯與反問能力
4. 成本可控（盡可能只於需要時才調用 LLM）

---

## 二、功能模組與資料結構

### 1️⃣ 任務記憶模組（Task Memory Layer）

此模組維護使用者在對話中建立或操作的任務上下文，包括當前進行中與最近一次已完成的任務，用於支援「多輪接續」與「省略補全」。

#### 📦 資料結構

```ts
type TaskContext = {
  taskId: string                 // 任務唯一 ID
  userId: string                 // 使用者 ID
  intent: 'create' | 'update' | 'remind' | 'cancel' | ... // 任務意圖
  slots: {
    courseName?: string
    date?: string
    time?: string
    teacher?: string
    location?: string
    reminder?: string
    notes?: string
  }
  pendingSlots: string[]        // 尚未填寫的欄位
  lastUpdated: ISODateTime      // 記憶體更新時間
  isCompleted: boolean          // 任務是否已完成
}
```

---

### 2️⃣ 調性控制模組（Tone Consistency Engine）

此模組管理 GPT 輸出語氣的一致性，透過固定 system prompt + few-shot 訓練風格範例，維持助理的角色調性。

#### 📦 設定結構

```ts
type ToneConfig = {
  tonePrompt: string           // 用於控制 GPT 語氣的 system prompt
  style: 'warm' | 'cheerful' | 'calm'
  emoji: boolean
  examples: Array<{ user: string, bot: string }>  // few-shot 對話範例
}
```

#### 🔊 System Prompt 範例

```
你是一位親切、耐心、有同理心的語言助理，協助家長管理孩子的課程。
請使用溫柔、貼心的語氣，搭配適度 emoji，讓對話充滿溫度。
請避免過於制式的回應，並主動幫助對方釐清任務需求。
```

---

### 3️⃣ 多輪邏輯處理器（Context Handler）

負責判斷當前輸入是否為：

* A. 新任務（New Task）
* B. 延續前一任務（Follow-up）
* C. 多輪補件（Partial Slot Completion）
* D. 聊天式中斷（轉向聊天）

#### 🧠 判斷邏輯

```pseudo
if (句子含明確意圖詞 + slot 足夠) → A. 新任務
else if (句子中含「再來」「也幫我」等承接語 + 已有任務記憶) → B. 延續任務
else if (句子含 slot 補件，如「下午兩點」） → C. 補填欄位
else if (句子為閒聊（ex:「你吃飯了嗎」） → D. 閒聊模式
```

---

## 三、處理流程詳述

### 🔁 對話處理主流程（Dialogue Processing Flow）

```plaintext
1. 使用者輸入句子
↓
2. 詞彙特徵分析：判斷是否含有意圖詞／slot／承接語
↓
3. 查詢使用者記憶體中是否有進行中的任務
↓
4. 將輸入分類為「新任務 / 延續任務 / 補填欄位 / 閒聊」
↓
5. 更新記憶體中任務狀態（slot 填寫、intent 更新、完成任務等）
↓
6. 根據 tone 設定產生回應語句（調用 GPT）
↓
7. 回傳給使用者（附帶建議行為，如：要不要提醒？）
```

---

## 四、容錯設計（Fallback Strategy）

### 🧩 缺漏欄位處理

* 若用戶只說「幫我提醒一下」，系統需補充任務與時間。
* 使用者說「再幫我安排一下」，系統預設承接上個課程任務。

### 🧩 模糊語意處理

* 使用「模糊解析表」（如：下午 = 13:00–17:00），搭配 GPT 做 disambiguation。
* 若 GPT 不穩定，系統主動問：「你是指今天下午的鋼琴課嗎？」

---

## 五、範例互動

### ✅ Case A：省略補件

> 使用者：明天下午兩點鋼琴課
> → Bot：已為你登記明天下午兩點的鋼琴課喔～需要提醒嗎？🎹

> 使用者：提醒我一下
> → Bot：好喔～要提前幾分鐘提醒你呢？⏰

---

### ✅ Case B：任務接續

> 使用者：每週五都有數學課
> → Bot：幫你記下「每週五」的數學課囉～幾點開始呢？

> 使用者：三點
> → Bot：OK～每週五下午三點的數學課已登記，要提醒嗎？😊

---

## 六、備註

* 對話記憶需綁定 userId，並設定保存期限（如 30 分鐘內有效，或用任務完成作為更新依據）
* 支援多子女模式時，需記得引入「studentId」於任務記憶中，避免錯綜混淆

---

## ✅ 實作任務優先順序建議

| 優先級 | 任務                    | 目標                    |
| --- | --------------------- | --------------------- |
| P0  | 對話記憶結構設計（TaskContext） | 能記住目前任務與欄位            |
| P0  | 多輪補件判斷邏輯              | 接續使用者輸入，完成任務          |
| P1  | 調性 prompt 設計與測試       | 確保語氣自然、親切             |
| P2  | 回應模組 GPT 調用封裝         | 控制風格、減少 hallucination |
| P3  | 多任務切換管理               | 同時處理多子女或多堂課           |

---

如果你需要我幫你產出：

1. 全部欄位的 `slot name + pattern + fallback 提問`
2. 語氣 prompt 樣板檔案（可直接用於 Claude 或 OpenAI）
3. 一套對應 API input/output 格式的 schema（JSON Schema）

都可以隨時說，我可以直接幫你產出完整格式化範例。是否要繼續？
