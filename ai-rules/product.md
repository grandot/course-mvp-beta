## 💡 核心設計理念

**分工協作，不是主從關係**：
- **Google Calendar**：專精時間處理（重複規則、衝突檢測、提醒觸發）
- **Firebase**：專精業務資料（用戶帳號、課程詳情、內容記錄）

## 🎯 目標

* 「不重新造輪子」，所以整合Google Calender與LINE。
* 讓家長透過 LINE Bot 輕鬆新增、查詢與管理子女的課後班資訊，並在課前收到提醒。
* Google Calendar 處理時間邏輯，Firebase 儲存用戶業務資料，兩者分工協作。家長不需登入 Google，避免用戶體驗割裂。
* MVP主要用於課後班管理，不支援國小國中高中等正常課程的管理。未來版本視情況加上。

---

## 🧱 系統架構圖

```
graph TD
A[家長 LINE 輸入課程內容] --> B[Express.js 語意處理 + Firebase 查詢]
B --> C{是否已有對應學生行事曆？}
C --否--> D[建立 Google Calendar 日曆並綁定]
C --是--> E[寫入事件至 Google Calendar]
E --> F[記錄基本資訊至 Firebase /courses]
Firebase 定時檢查即將開始的課程 --> G[LINE Bot 推送提醒]

```

---

## 🧰 技術棧

| 模組 工具 |                                              |
| ----- | -------------------------------------------- |
| 前端輸入  | LINE Messaging API                           |
| 後端邏輯  | Node.js + Express.js                         |
| 資料儲存  | Firebase Firestore                           |
| 課程來源  | Google Calendar API (平台服務帳號控管)               |
| 課前提醒  | Firebase Scheduled Functions + LINE Push API |
| 使用者識別 | LINE User ID（對應家長）+ 子女暱稱（唯一鍵）                |

---

## 📘 使用情境與功能總覽

### 使用情境：

* 家長透過 LINE chatbot，管理多孩的課程時間與內容記錄
* 可安排重複課程，例如：「每週三下午兩點 Lumi 要上直排輪」、「Lumi 每天上午 10 點英文課」

### 功能：

* 新增、刪除、修改、查詢課程：

  * 對話式（語義辨識意圖，提取實體，執行任務）
  * 暫不支援批次處理
* 記錄課程內容（文字與圖片）
* 查看課程日誌
* 每週推送本週學習日誌摘要
* 支援上下文多輪對話以補充不完整資訊
* 使用LINE Quick Reply 功能，提升用戶體驗
* 每個任務對話結束後，都要有 Quick Reply 按鈕，讓用戶 確認/修改/刪除 ，以明確任務完成
* chatbot回覆時，時間顯示統一使用12小時制中文格式（如「下午2:00」），內部儲存使用24小時制（如「14:00」）

---

## 🗂️ 課程資料結構設計

### 必要欄位（如缺少則啟動上下文多輪對話要求補充）：

* courseId（自動生成）
* courseName
* studentName
* courseDate
* scheduleTime

### 擴充欄位：

* courseRecord（可接受圖片或文字）

---

## 📦 核心功能模組流程

> Google Calendar 處理時間邏輯，Firebase 儲存業務資料，兩者分工協作。Firebase 不直接修改 Google Calendar，保持資料流向清晰。

### 1. **學生課表資料管理**

* 每位學生對應一份 Google Calendar
* Calendar 命名方式：`{lineUserId}__{studentName}`
* 寫入後回存於 Firebase `/parents/{lineUserId}/students`

### 2. **新增課程**

* 家長透過 LINE 輸入（例如：「小光週三下午三點有鋼琴課」）
* 語意層解析出學生、時間、課名
* 課程先寫入對應的 Google Calendar
* 寫入成功後，再同步存入 Firebase（作為資料副本與提醒來源）

### 3. **自動同步課表至 Firebase**

* 每日 cron job 拉取每份 calendar 的事件
* 寫入 Firebase `/courses`，供查詢與提醒
* 支援一次性與 recurrent（每週重複）課程

### 4. **LINE 課前提醒**（Firebase 定時檢查）

* 課程是否需要提醒，完全由家長輸入時決定（不預設啟用）
* 當語意中出現「提醒」意圖，才會寫入 shouldRemind: true
* Firebase Scheduled Functions 每隔指定時間（如每5分鐘）檢查：
  - 查詢 Firebase /courses 中標記 shouldRemind: true 的課程
  - 找出即將開始的課程（如30分鐘內）
  - 發送 LINE 推播提醒給對應家長
* 常見用途：

  * 重複課程中有特別事項（如要帶物品、繳費）
  * 單次課程（如體驗課、臨時換課）

### 5. **家長資料管理**

* 家長初次互動時，透過 LINE Profile API 取得暱稱
* 儲存格式如下：

```
/parents/Uxxxxxxxxxxxxxxx
{
  displayName: "王媽媽",
  lineUserId: "Uxxxxxxxxxxxxxxx",
  students: [
    {
      studentName: "小光",
      calendarId: "xxx@group.calendar.google.com"
    },
    ...
  ]
}

```

---

## ⚙️ 工作邏輯

### 🔹 建立學生時：

1. 透過 Firebase 建立新子女資料
2. 自動於 Google Calendar 建立一份日曆
3. 回寫 calendarId 至 Firebase student 陣列

### 🔹 新增課程事件：

1. 語意層抽出 slot（課名、學生、時間）
2. 查找對應 Google Calendar
3. 先寫入 Google Calendar 事件
4. 寫入成功後，將對應欄位寫入 Firebase `/courses`

### 🔹 同步行事曆至 Firebase：

* 每日定時觸發
* 從每個 calendarId 拉取 `timeMin ~ timeMax` 的事件
* 寫入 `/courses/{eventId}`，供查詢與提醒使用

### 🔹 課前提醒（細分邏輯說明）：

提醒功能分為兩種：**課程時間提醒**與**課程附加提醒**，皆由使用者主動指定是否啟用，預設不開啟，避免產生過多干擾。

#### 1. 課程時間提醒（Firebase 定時檢查）

* 家長在任何時間（新增課程或事後）可透過語意輸入「請提醒我」等指令，觸發提醒需求。
* 系統在 Firebase `/courses` 記錄中標記 `shouldRemind: true` 和提醒時間設定。
* Firebase Scheduled Functions 定時執行提醒檢查邏輯：
  ```javascript
  // 每5分鐘執行一次
  exports.checkReminders = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 30 * 60000); // 30分鐘後
    
    // 查詢需要提醒的課程
    const courses = await db.collection('courses')
      .where('shouldRemind', '==', true)
      .where('scheduleDateTime', '<=', reminderTime)
      .where('scheduleDateTime', '>', now)
      .get();
      
    // 發送 LINE 推播
    courses.forEach(course => sendLineReminder(course));
  });
  ```
* 此設計完全自控，不依賴外部服務的提醒機制，確保可靠性。

#### 2. 課程附加提醒（內容型備註）

* 如果課程有特殊需求（如「要帶葉子」、「要繳費」），家長可透過語意輸入加入一段備註。
* 系統將這段備註存入 Firebase `reminder_note` 欄位，並在提醒時一併推送，例如：「📌 記得帶植物標本」。

3. 提醒時間預設課程開始前一小時，並且在回覆

### 🔹 需二步確認情境

* 清空課表
* 修改student name

---

## ✅ 補充說明

* `calendarId` 是由 Google API 建立日曆後自動生成的識別碼，格式如 `x7i2u56v7sngjd61l@group.calendar.google.com`。

* 我們建立日曆時，可以自訂 `summary`，作為日曆顯示名稱，方便辨識。例如：

    ```
    {
    studentName: "小明",
    calendarId: "x7i2u56v7sngjd61l@group.calendar.google.com"  // Google 自動生成
    }
    ```
* Firebase 也用於儲存課程的非結構化記錄資料（如照片、評語、作業等），這些資訊不適合寫入 Google Calendar，因此 Firebase 是課程成果記錄與輸出報表的主要來源。

* 所有課程照片與圖文紀錄將上傳至 Firebase Storage，並以課程 ID（courseId）為對應目錄，例如 `/courses-images/{courseId}/img1.jpg`。

* 課程內容記錄會同步寫入 Firestore，結構如下：

```
/courses/{courseId} {
  // 課程基本資訊
  "studentName": "小明",
  "courseName": "鋼琴課",
  "courseDate": "2025-08-04",
  // 課程內容記錄
  "courseRecord": {
    "notes": "今天上了八分音符練習，表現不錯",
    "photos": [
      "https://firebasestorage.googleapis.com/....",
      "https://firebasestorage.googleapis.com/...."
    ],
    "updatedAt": "2025-08-04T10:00:00Z",
    "updatedBy": "Uxxxxxxxxxxxx"
  }
}

```

* 所有行事曆統一使用平台專屬的 Google 帳號（非每位家長登入），由平台後端管理與調用，使用者無需登入 Google。
* 每位學生對應一個獨立 Calendar，以 LINE User ID + 學生暱稱作為唯一識別。
* 所有課程查詢 UI 預設皆從 Firebase 讀取資料，避免直接查詢 Google Calendar API，以獲得更快回應與穩定性。

---

## 🗣️ 對話範例（參考用，具體規範參照前文）

### ✅ **1. 新增課程 - 完整語句**

**使用者**：Lumi 每週三下午兩點要上直排輪課
**Bot**：好的，請確認以下資訊：
📌 Lumi 每週三下午 02:00 上直排輪課
✅ 沒問題｜📝 修改一下

---

### ✅ **2. 新增課程 - 缺少時間（啟動補充對話）**

**使用者**：Lumi 每週要上兩次英文課
**Bot**：請問英文課的上課時間是什麼時候呢？（例如：每週一、三 下午三點）

（補充後）
**使用者**：每週一、三 下午三點
**Bot**：好的，幫您記下：
📌 Lumi 每週一、三 15:00 上英文課
✅ 沒問題｜📝 修改一下

---

### ✅ **3. 多位子女 - 指定學生**

**使用者**：週五有鋼琴課
**Bot**：請問這堂課是小光還是 Lumi 呢？（您共有兩位孩子）
**使用者**：是小光
**Bot**：幫您記下：
📌 小光 每週五 鋼琴課（尚未指定時間）
請問上課時間是？

**使用者**：每週一、三 下午三點
**Bot**：好的，幫您記下：
📌 小光 每週一、三 15:00 上英文課
✅ 沒問題｜📝 修改一下

---

### ✅ **4. 新增課程內容記錄（文字）**

**使用者**：今天Lumi的直排輪課上了前進煞車還有繞樁
**Bot**：好的，已幫您記錄到今天（8/4）Lumi的直排輪課內容：
📝 前進煞車、繞樁
您還想補充其他內容或上傳照片嗎？

\[好哦] \[不用了]

...

---

### ✅ **5. 新增課程內容記錄（圖片）**

**使用者**：（傳送一張照片）
**Bot**：這張照片是要記錄到哪一堂課呢？請說明課名與學生，例如「Lumi的鋼琴課」
**使用者**：Lumi的英文課
**Bot**：好的，已將照片記錄到今天（8/4）Lumi的英文課中 ✅
✅ 沒問題｜📝 傳錯了，刪除
---

### ✅ **6. 查詢今日課程**

**使用者**：今天Lumi有什麼課？
**Bot**：Lumi 今天（8/4）的課程如下：
📍 上午 10:00 英文課
📍 下午 14:00 直排輪
是否要新增或補充課程內容？

---

### ✅ **7. 查詢本週課程日誌**

**使用者**：幫我看一下這週小光的課程記錄
**Bot**：這是小光本週（7/29–8/4）的課程日誌：
🗓 週二 16:00 科學實驗課（內容：自製小火山）
🗓 週五 17:00 鋼琴課（內容：練習八度跳音）
✅ 需要我幫您匯出成 PDF 嗎？

---

### ✅ **8. 修改課程時間**

**使用者**：Lumi 的英文課從明天開始改到下午五點
**Bot**：已收到，請問是每週都改為 17:00，還是只有明天？
**使用者**：每週都改
**Bot**：好的，已將 Lumi 的英文課改為每週 17:00

---

### ✅ **9. 刪除課程**

**使用者**：刪掉Lumi的直排輪課
**Bot**：您是要刪除單次課程（例如今天的）還是整個重複課程？
**使用者**：整個重複課程
**Bot**：已刪除：Lumi 每週三 14:00 的直排輪課 ✅

---

### ✅ **10. 語意不完整 – 啟動澄清機制**

**使用者**：我想補一下昨天那堂課的內容
**Bot**：請問是哪一位學生的哪一門課呢？例如「Lumi 的英文課」
**使用者**：Lumi 的英文課
**Bot**：已找到 8/3 的英文課，請問您要補充什麼內容呢？可傳文字或圖片

---
### ✅ 11. 課前時間提醒

**使用者**：鋼琴課前一天晚上8點提醒我  
**Bot**：好的，請問是週三（8/6） Lumi 的鋼琴課嗎？  
**使用者**：對  
**Bot**：明白了，將於明天（8/5）晚上 08:00 提醒您「週三（8/6） Lumi 的鋼琴課即將開始」✅  
您也可以設定提醒內容喔（例如：記得帶琴譜）
**使用者**：記得帶便當
**Bot**：了解，已為「週三（8/6） Lumi 的鋼琴課」加入提醒事項：  
📌 上課時記得帶便當

---

### ✅ 12. 課程附加備註提醒

**使用者**：提醒我鋼琴課要帶琴譜  
**Bot**：請問是哪一位學生的鋼琴課？  
**使用者**：小光  
**Bot**：了解，已為「小光的鋼琴課」加入提醒事項：  
📌 上課時記得帶琴譜 🎼  
提醒將在課程開始前 30 分鐘發送 ✅  
（可以告訴我更改提醒時間哦）

## ✅ 優勢

| 面向 成果           |                            |
| --------------- | -------------------------- |
| ✅ 無需家長登入 Google | 所有日曆由平台帳號控管                |
| ✅ 避免同名混淆        | 以 lineUserId + name 組合為唯一鍵 |
| ✅ 原生支援提醒與重複課程   | Google Calendar 本身功能完整     |
| ✅ 擴充彈性高         | 未來可整合 OCR、自動上傳、圖片筆記等       |

---
