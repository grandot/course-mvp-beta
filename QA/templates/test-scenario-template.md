# Markdown 測試情境範本（給 PM 使用）

只要照這個格式填，系統會自動把它轉成可執行的測試用例（不用寫程式）。

填寫規則（重點）
- 一段「標題 + 標記」就是一個用例
- 必填：@id、@suite、@target、@steps
- 期望可以用「關鍵詞」描述（逗號分隔）。多輪用例可對每一步分別寫期望
- 套件類型（@suite）：render / redis / multi / time / quick
- 目標環境（@target）：prod（線上）或 local（本機）

---

## 範例 1｜單步（單輪）用例

### A1.1-A 新增單次課程（標準格式）
@id: A1.1-A
@suite: render
@target: prod
@steps:
- 小明明天下午2點數學課
@expect.keywords: 確認, 小明, 數學課
@expect.code: QUERY_OK

說明：
- 只有一個「訊息步驟」，會直接送到對話裡
- 測試時會檢查回覆文字是否包含「確認/小明/數學課」，並可對齊預期代碼（可選）

---

## 範例 2｜多步（多輪）用例（含補問）

### A1.2-B 缺少時間資訊（補問流程）
@id: A1.2-B
@suite: multi
@target: prod
@steps:
1) 小明要上數學課
@expect.keywords(step=1): 時間, 課程日期
2) 明天下午2點
@expect.keywords(step=2): 確認, 小明, 數學課
@expect.not: 錯誤, 失敗

說明：
- 兩個步驟依序發送
- 第一步期望系統提示補時間（包含「時間/課程日期」等字眼）
- 第二步補齊時間後，期望看到確認與人名/課名
- @expect.not 可列出黑名單關鍵詞（例如：錯誤/失敗）

---

## 範例 3｜時間解析與重複課（time 套件）

### A2.1-A 每週重複課程（標準）
@id: A2.1-A
@suite: time
@target: prod
@steps:
- Lumi每週三下午3點要上鋼琴課
@expect.keywords: 確認, Lumi, 鋼琴課, 每週三

### A2.1-C 每日重複課程（功能開啟）
@id: A2.1-C
@suite: time
@target: prod
@steps:
- 小明每天早上8點晨練課
@expect.keywords: 確認, 小明, 晨練課, 每天

---

## 欄位補充說明
- 標題：方便閱讀的人話名稱（不做機器判斷）
- @id：唯一識別碼（英數或帶點號），例如 A1.1-A；之後可以指名只跑某一條
- @suite：
  - render（線上部署健檢/流程）
  - redis（連線/設定/效能/整合）
  - multi（多輪/補問）
  - time（時間解析/重複規則）
  - quick（冒煙/端到端）
- @target：prod（線上）/ local（本機）
- @steps：
  - 單步：用「- 文句」
  - 多步：用「1) 文句」「2) 文句」分行
- @expect.keywords：
  - 全域關鍵詞（所有步驟都應包含）或
  - @expect.keywords(step=N)：只針對第 N 步檢查
- @expect.code（可選）：簡短代碼（對齊規格或現有錯誤代碼）
- @expect.not（可選）：不應出現的關鍵詞（例如：錯誤, 失敗）

---

提示
- 同一個 MD 裡可以寫很多段落，每段都是一條用例
- 真正執行前，系統會檢查欄位是否齊全；有缺會提示哪一段哪一行需要補
- 若要指定只跑某一條，之後可以用 @id 來點名（由工具提供）
