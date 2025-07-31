# 📃 AI 課程管理系統：三層語意記憶整合方案設計（Based on First Principles）

---

## 一、🌟 設計出發點：第一性原則推導

### 🔍 基本問題

用戶會用自然語言來表達「一個計畫」，這些語句常常是：

- 繁複、省略、對話式（ex: 「再排一次」「下次的那堂課」」
- 對於上一段話有依賴（ex: 「修改為三點」」
- 抽象或代詞化（ex: 「那個」「他」「再排」」

### 🔧 答案的兩個基礎功能

> 語意系統需要：
>
> 1. 能夠理解上一段對話、接續下一個計畫
> 2. 能够從用戶語句裡補全所有需要的欄位 (slots)

---

## 二、🌐 全圖結構解決方案

### 📁 基礎分層：語意計畫系統需要的三層記憶

| 層級      | 功能 | 類型 | 用途 |
| ------- | -- | -- | -- |
| Layer 1 |    |    |    |

| **ConversationContext** | 短期記憶                 | 續說 / 修改 / 後悔 |              |
| ----------------------- | -------------------- | ------------ | ------------ |
| Layer 2                 | **Memory.yaml**      | 語意背景         | 不相連話的語意接續    |
| Layer 3                 | **SmartQueryEngine** | 資料實時查詢       | 採用明確語句進行資料回應 |

---

## 三、🌐 資訊流流程

```plaintext
User 輸入
   ↓
[1] 加載 ConversationContext & Memory.yaml
   ↓
[2] Regex slot extraction
   → 如果 slot 全部優雅優化完成 → 返回 intent + slot
   → 如果有欄位缺失 → 使用 context 補全
   → 如果仍不足 → GPT fallback
   ↓
[3] GPT fallback prompt 內含:
     - 使用者語句
     - Memory.yaml (YAML summary)
     - context (lastCourse, lastStudent, etc)
   ↓
[4] GPT 用語意背景充分理解 intent + slot
   ↓
[5] 產生回應
```

---

## 四、🔨 Memory.yaml 與 ConversationContext 實作分工

| 項目   | Memory.yaml          | ConversationContext                               |
| ---- | -------------------- | ------------------------------------------------- |
| 定義   | 用於 GPT 優化理解語意背景      | 用於 Regex 第一階段補全                                   |
| 保存內容 | 最多 20 筆，包含最新、重複、近期課程 | lastIntent, lastCourse, lastTime, lastLocation... |
| 使用報動 | 處理語意接續、省略表達          | 處理續說、相同 intent 連鎖                                 |
| TTL  | 每日重置 + 事件觸發重生        | 5 分鐘 TTL + 系統觸發更新                                 |

---

## 五、🔫 關鍵判斷式 & GPT Prompt 準備

### Regex 判斷流程:

- 先嘗試把語句解析成 intent + slots
- 如果有 slot 缺落：
  - 先看 context 有無 lastCourse / lastStudent 補全
  - 如果仍有欄位缺落 → fallback

### GPT fallback prompt 組合:

```yaml
System:
你是一位親切的課程助理，請根據使用者語句和下方記憶，推理用戶想做什麼，並填寫完整欄位

使用者語句:
"再排一次"

記憶 Memory.yaml:
小明：
- 每週三 數學課 | 14:00 | 張老師
- 本週五 自然課 | 10:00 | 陳老師

ConversationContext:
- lastCourse: 數學課
- lastTime: 14:00
- lastStudent: 小明

請產生:
{
  intent: "create",
  slots: {
    student: "小明",
    courseName: "數學課",
    date: "2025-07-31",
    time: "14:00"
  }
}
```

---

## 六、🤖 行為觸發與維護策略

### Memory.yaml

- 更新時機：
  - 新增/修改/刪除課程
  - 重複課程總是每週自動實例化
  - 每日凌晨4點 cron job 實行 full build

### ConversationContext

- 更新時機：
  - 每次 record / modify / cancel 成功後
  - 需監聽更多意圖或內容類型 (record\_content / set\_reminder...)

---

## 七、📊 計算機下的最佳解決

| 故障問題      | 答案                                    |
| --------- | ------------------------------------- |
| 語句省略 / 接續 | context + memory 兩者觸發                 |
| 對話打錯、修正   | context 自動排除 + 校正                     |
| 多課程迴避     | memory.yaml 完整描述 + GPT disambiguation |
| 最近使用模式    | SmartQuery 觸發分類、支援查資                  |

---

## 八、技術優化策略（讓方案保持「快」）

1. **Memory.yaml 必須快取**（建議用 Redis 或 local memory）
   - 每位 user 的 YAML 對象只需要 1 次/day + 每次任務異動更新
   - 每次語句輸入時，直接讀 cache，不用重算
   - 每個用戶擁有獨立的 YAML，但是保留未來多個家長共同管理的空間（不會超過5個用戶管理一個yaml，大部分是2個即父母雙方）。基本上不存在高並發管理風險。
2. **context 與 memory 不需每輪都 Inject 至 GPT**
   - 只有在 fallback 流程中才帶進 GPT prompt
   - 正常情境下不進 GPT，無 token 成本，也無響應延遲
3. **前端／中間層可預載記憶片段**
   - 若使用 Web / LINE SDK，可在使用者開啟對話時 preload
4. **排程更新 YAML**
   - 每日凌晨更新記憶不會影響使用體驗，與使用者互動解耦

---

## 九、🔯 結論

> 語意任務系統需要能認知語言的續說、接續、省略、微調。
>
> 此種能力無法依靠單一層級完成，必須擁有：
>
> - 短期記憶用來執行上一段話
> - 記憶記錄用來理解不在對話中的背景
> - 手動可採用實時查資功能表得不足，需考慮 prompt-injectable記憶

🔷 最簡單的做法不是最好的 🔷 最好的計劃是組合上下文、記憶、資訊與機器理解能力的依據型系統

你現在看到的就是這個系統的設計上限。

