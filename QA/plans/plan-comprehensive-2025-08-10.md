# LINE 課程管理機器人 – 測試情境（依範本格式重寫）

說明：本檔案依「Markdown 測試情境範本」重寫自 `QA/comprehensive-test-plan.md`。每一段即一條可執行用例。

---

## Group A｜獨立功能

### A1.1-A 新增單次課程（標準格式）
@id: A1.1-A
@suite: render
@target: prod
@steps:
- 小明明天下午2點要上數學課
@expect.keywords: 確認, 小明, 數學課, 成功
@expect.code: ADD_COURSE_OK

### A1.1-B 時間格式多樣性（美式 PM/AM）
@id: A1.1-B
@suite: time
@target: prod
@steps:
- Lumi後天晚上八點半要上鋼琴課
@expect.keywords: 確認, Lumi, 鋼琴課, 8:30, 成功
@expect.code: ADD_COURSE_OK

### A1.1-C 中文數字時間（十點三十分）
@id: A1.1-C
@suite: time
@target: prod
@steps:
- 小光明天上午十點三十分英文課
@expect.keywords: 確認, 小光, 英文課, 10:30, 成功
@expect.code: ADD_COURSE_OK

### A1.2-A 缺少學生資訊（啟動補問）
@id: A1.2-A
@suite: multi
@target: prod
@steps:
1) 明天下午3點要上數學課
@expect.keywords(step=1): 學生, 哪位, 補充
2) 小明
@expect.keywords(step=2): 確認, 小明, 數學課, 15:00, 成功
@expect.code: ADD_COURSE_OK

### A1.2-B 缺少時間資訊（補問）
@id: A1.2-B
@suite: multi
@target: prod
@steps:
1) 小明要上數學課
@expect.keywords(step=1): 時間, 課程日期
2) 明天下午2點
@expect.keywords(step=2): 確認, 小明, 數學課, 14:00, 成功
@expect.code: ADD_COURSE_OK

### A1.2-C 多輪完整（學生→課程→時間）
@id: A1.2-C
@suite: multi
@target: prod
@steps:
1) 小明要上課
@expect.keywords(step=1): 課程, 什麼課
2) 數學課
@expect.keywords(step=2): 時間, 什麼時候
3) 明天下午2點
@expect.keywords(step=3): 確認, 小明, 數學課, 14:00, 成功
@expect.code: ADD_COURSE_OK

### A1.3-A 無效時間格式（25點）
@id: A1.3-A
@suite: time
@target: prod
@steps:
- 小明明天25點上數學課
@expect.keywords: 時間格式不正確, 重新輸入
@expect.code: INVALID_TIME

### A1.3-B 過去時間（昨日下午）
@id: A1.3-B
@suite: time
@target: prod
@steps:
- 小明昨天下午2點上數學課
@expect.keywords: 無法新增過去時間, 重新輸入
@expect.code: INVALID_PAST_TIME

### A1.3-C 模糊語句（意圖不明）
@id: A1.3-C
@suite: render
@target: prod
@steps:
- 我想要什麼時候上課來著
@expect.keywords: 不太理解, 請提供具體
@expect.code: UNKNOWN_HELP

### A2.1-A 每週重複課程（標準）
@id: A2.1-A
@suite: time
@target: prod
@steps:
- Lumi每週三下午3點要上鋼琴課
@expect.keywords: 確認, Lumi, 鋼琴課, 每週三, 成功
@expect.code: ADD_COURSE_OK

### A2.1-B 多天每週重複（一三五）
@id: A2.1-B
@suite: time
@target: prod
@steps:
- 小光每週一三五上午10點英文課
@expect.keywords: 確認, 小光, 英文課, 每週一, 每週三, 每週五, 成功
@expect.code: ADD_COURSE_OK

### A2.1-C 每日重複課程（功能開啟）
@id: A2.1-C
@suite: time
@target: prod
@steps:
- 小明每天早上8點晨練課
@expect.keywords: 確認, 小明, 晨練課, 每天, 成功
@expect.code: ADD_COURSE_OK

### A2.1-D 每日重複（變體表達）
@id: A2.1-D
@suite: time
@target: prod
@steps:
- 安排Lumi每日下午5點瑜伽課
@expect.keywords: 確認, Lumi, 瑜伽課, 每天, 17:00, 成功
@expect.code: ADD_COURSE_OK

### A2.1-E 每月重複（目前標示未完成）
@id: A2.1-E
@suite: time
@target: prod
@steps:
- 小光每月第一個週一上午10點評鑑
@expect.keywords: 評鑑, 每月
@expect.code: NOT_IMPLEMENTED_MONTHLY

### A2.2-A 重複關鍵詞識別（定期/每週）
@id: A2.2-A
@suite: time
@target: prod
@steps:
- 安排小明定期游泳課每週二晚上7點
@expect.keywords: 確認, 小明, 游泳課, 每週二, 19:00, 成功
@expect.code: ADD_COURSE_OK

### A2.2-B 模糊重複表達（每個星期四）
@id: A2.2-B
@suite: time
@target: prod
@steps:
- Lumi固定每個星期四下午兩點鋼琴課
@expect.keywords: 確認, Lumi, 鋼琴課, 每週四, 14:00, 成功
@expect.code: ADD_COURSE_OK

### A2.2-C 重複類型區分（daily/weekly/monthly）
@id: A2.2-C
@suite: time
@target: prod
@steps:
1) 小明每天早上8點英文課
@expect.keywords(step=1): 每天, 08:00
2) 小明每週一早上8點英文課
@expect.keywords(step=2): 每週一, 08:00
3) 小明每月1號早上8點英文課
@expect.keywords(step=3): 每月, 1號, 08:00

### A2.2-D 功能開關（每日重複關閉時降級）
@id: A2.2-D
@suite: time
@target: prod
@steps:
- 小明每天早上8點英文課
@expect.keywords: 英文課, 08:00

### A2.2-E 重複課時間衝突處理
@id: A2.2-E
@suite: time
@target: prod
@steps:
1) 小明每天下午2點數學課
2) 小明每天下午2點英文課
@expect.keywords(step=2): 時間衝突, 覆蓋
@expect.code: TIME_CONFLICT

### A3.1-A 意圖邊界（查詢/新增分流）
@id: A3.1-A
@suite: render
@target: prod
@steps:
- 我想了解一下課程安排的情況
@expect.keywords: 查詢, 新增, 指引

### A3.1-B 複合意圖處理（先新增再查詢）
@id: A3.1-B
@suite: render
@target: prod
@steps:
- 幫我安排小明數學課，然後查一下他今天有什麼課
@expect.keywords: 一次, 一個, 請先, 具體

### A3.2-A 系統錯誤恢復（提供導引）
@id: A3.2-A
@suite: render
@target: prod
@steps:
- （觸發系統錯誤的占位輸入）
@expect.keywords: 導引, 請提供, 具體
@expect.code: UNKNOWN_HELP

### A3.2-B 輸入修正流程（無效→更正）
@id: A3.2-B
@suite: render
@target: prod
@steps:
1) 小明明天25點上課
@expect.keywords(step=1): 時間格式不正確
2) 下午2點
@expect.keywords(step=2): 確認, 小明

---

## Group B｜依賴功能

### B1.1-A 今日課程查詢
@id: B1.1-A
@suite: render
@target: prod
@steps:
- 小明今天有什麼課？
@expect.keywords: 小明, 今天, 課表

### B1.1-B 明日課程查詢
@id: B1.1-B
@suite: render
@target: prod
@steps:
- 查詢Lumi明天的課表
@expect.keywords: Lumi, 明天, 課表

### B1.1-C 本週課程查詢（含重複課）
@id: B1.1-C
@suite: render
@target: prod
@steps:
- 看一下小光這週的安排
@expect.keywords: 小光, 這週, 課表

### B1.2-A 無課程日查詢（空結果）
@id: B1.2-A
@suite: render
@target: prod
@steps:
- 小王今天有什麼課？
@expect.keywords: 沒有安排課程
@expect.code: QUERY_OK_EMPTY

### B1.3-A 特定課程查詢（篩選）
@id: B1.3-A
@suite: render
@target: prod
@steps:
- 小明的數學課什麼時候上？
@expect.keywords: 小明, 數學課, 時間

### B1.3-B 每日重複課程查詢
@id: B1.3-B
@suite: render
@target: prod
@steps:
- 小明的晨練課每天幾點？
@expect.keywords: 晨練課, 每天, 時間

### B1.3-C 重複課類型識別查詢
@id: B1.3-C
@suite: render
@target: prod
@steps:
- 查詢Lumi的重複課程
@expect.keywords: Lumi, 重複課程, 課表

### B2.1-A 當日課程記錄（標準）
@id: B2.1-A
@suite: render
@target: prod
@steps:
- 今天小明的數學課學了分數加減法
@expect.keywords: 已記錄, 小明, 數學課, 分數加減法

### B2.1-B 昨日課程補記錄
@id: B2.1-B
@suite: render
@target: prod
@steps:
- 補記一下昨天Lumi鋼琴課的內容，練習了小星星
@expect.keywords: 已記錄, Lumi, 鋼琴課, 小星星

### B2.2-A 查詢課程記錄
@id: B2.2-A
@suite: render
@target: prod
@steps:
- 小明昨天數學課學了什麼？
@expect.keywords: 內容, 記錄

### B2.3-A 不存在課程記錄（應提示）
@id: B2.3-A
@suite: render
@target: prod
@steps:
- 記錄小明今天化學課的內容
@expect.keywords: 找不到, 請確認, 先新增
@expect.code: NOT_FOUND

### B3.1-A 標準提醒設定
@id: B3.1-A
@suite: render
@target: prod
@steps:
- 提醒我小明的數學課
@expect.keywords: 提醒, 小明, 數學課, 30分鐘

### B3.1-B 自訂提醒時間
@id: B3.1-B
@suite: render
@target: prod
@steps:
- Lumi鋼琴課前1小時提醒我
@expect.keywords: 提醒, Lumi, 鋼琴課, 60分鐘

### B3.2-A 不存在課程提醒
@id: B3.2-A
@suite: render
@target: prod
@steps:
- 提醒我小明的物理課
@expect.keywords: 找不到, 小明, 物理課
@expect.code: NOT_FOUND

---

## Group C｜複雜操作

### C1.1-A 修改課程時間（功能待落地）
@id: C1.1-A
@suite: render
@target: prod
@steps:
- 小明的數學課改到下午4點
@expect.keywords: 修改, 小明, 數學課, 16:00

### C1.1-B 修改每日重複課時間（系列操作）
@id: C1.1-B
@suite: render
@target: prod
@steps:
- 小明每天的晨練課改到早上7點
@expect.keywords: 修改, 每天, 07:00, 選項

### C1.1-C 修改重複類型（週→日）
@id: C1.1-C
@suite: render
@target: prod
@steps:
- Lumi的鋼琴課改成每天下午3點
@expect.keywords: 修改, 每天, 15:00

### C2.1-A 取消單次課程
@id: C2.1-A
@suite: render
@target: prod
@steps:
- 取消小明明天的數學課
@expect.keywords: 取消, 小明, 明天, 數學課

### C2.1-B 取消每日重複課程（提供範圍選項）
@id: C2.1-B
@suite: render
@target: prod
@steps:
- 取消小明的晨練課
@expect.keywords: 只取消今天, 明天起所有, 刪除整個重複
@expect.code: RECURRING_CANCEL_OPTIONS

### C2.1-C 取消下週範圍（部分）
@id: C2.1-C
@suite: render
@target: prod
@steps:
- 取消小明下週的晨練課
@expect.keywords: 已取消, 下週, 晨練課

### C2.1-D 類型區分取消（daily/weekly）
@id: C2.1-D
@suite: render
@target: prod
@steps:
1) 取消小明每天的晨練課
2) 取消Lumi每週三的鋼琴課
@expect.keywords(step=1): 每天, 取消
@expect.keywords(step=2): 每週三, 取消

### C3.1-A 併發處理測試
@id: C3.1-A
@suite: render
@target: prod
@steps:
- （同時多使用者發起課表查詢，應全部成功）
@expect.keywords: 成功, 查詢, 課程

---

（完）
