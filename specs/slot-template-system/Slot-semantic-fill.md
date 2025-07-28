以下是針對你提出的「語意任務 Slot Template 重構方案」，為 IntentOS Course MVP 的語言驅動課程管理模組設計的完整方案說明，格式為 Claude Code CLI 可接受的 `claude.md` 架構說明文件風格，內容已強調設計目的、Slot Template 結構與執行方法，適合你直接交給 Claude 作為重構依據。

---

````markdown
# 語意任務 Slot Template 重構方案（IntentOS Course MVP）

## 🧠 重構目的

本方案旨在重構語句解析與課程資料填充流程，採用 Slot Template 設計，使系統具備：

- 模組化語句語意解析能力
- 支援語音輸入下的不完整資訊補全
- Slot 記憶追蹤與多輪對話補全能力
- 任務狀態判斷與可執行性控制（僅在欄位齊全後執行任務）

適用於 IntentOS Course MVP 中之「課程新增、修改、取消、提醒、附註」等語意任務流程，並為後續延伸至其他場景（如長照、健身）建立語意結構基礎。

---

## 🧩 Slot Template 定義

下列為目前語意任務需提取並持續補全的欄位定義：

| Slot 名稱 | 說明 | 資料型別 |
|-----------|------|----------|
| `student` | 小孩的名字／角色 | string |
| `course`  | 課程名稱 | string |
| `date`    | 上課日期 | string (ISO 8601 / Natural lang) |
| `time`    | 上課時間 | string (24hr format or natural) |
| `location`| 上課地點 | string |
| `teacher` | 教師名稱 | string |
| `reminder`| 課前提醒設定 | object（預設 -10min）|
| `repeat`  | 是否重複、週期 | string 或 object（ex: `weekly`, `每週三`）|
| `note`    | 附註／作業提醒 | string |

---

## 🔁 任務狀態結構（Slot Memory）

每位用戶在與 Bot 對話期間，系統應維持一個任務暫存結構，用以追蹤每個語意任務的 Slot 填充狀況：

```json
{
  "user_id": "U123456",
  "active_task": {
    "intent": "record_course",
    "slot_state": {
      "student": "小光",
      "course": "鋼琴課",
      "date": "2025-08-01",
      "time": "14:00",
      "location": null,
      "teacher": null,
      "reminder": null,
      "repeat": null,
      "note": null
    },
    "status": "incomplete"
  }
}
````

> 狀態為 `incomplete` 表示需繼續補問；為 `complete` 才會執行任務（如寫入 Firebase）

---

## 🧭 Claude 語意辨識策略（Prompt 層）

每次語句經語音或文字輸入後，Claude 負責執行以下任務：

1. 辨識 Intent（record\_course / modify\_course / cancel\_course / set\_reminder / ...）
2. 擷取 Slot 值，並以 JSON 回傳補全欄位
3. 明確標記未提及或模糊資訊為 null
4. 回傳格式如下：

```json
{
  "intent": "record_course",
  "slot_state": {
    "student": "小光",
    "course": "鋼琴課",
    "date": "2025-08-01",
    "time": "14:00",
    "location": null,
    "teacher": null,
    "reminder": null,
    "repeat": null,
    "note": null
  }
}
```

---

## 🔧 Slot 合併與任務完成條件

每次新的語意輸入，都將與現有的 `slot_state` 進行合併：

* 新的值會覆蓋原有空值（null）
* 若已存在值且新值不同，需確認是否為修改意圖（需進一步對話釐清）
* 所有 `slot_state` 欄位補齊（或達最低執行門檻）時，自動將 `status` 設為 `complete`

---

## ✅ 重構後的行為邏輯示意

使用者連續語句如下：

1. 「小光明天下午三點要上鋼琴課」
2. 「是在板橋教室喔」
3. 「每週三固定上」
4. 「王老師教的」
5. 「提醒我提前10分鐘」

每次語句送出後，Claude 回傳 slot 補全，並合併至 slot\_state
→ 最後 `slot_state` 補齊，status 為 complete → 觸發資料寫入行為

---

## 📌 實作事項摘要

* [ ] 設定全系統共用的 Slot Template JSON
* [ ] Claude Prompt 改為固定格式輸出 `intent` + `slot_state`
* [ ] 為每位使用者建立一個 `active_task` slot 記憶區（暫存區）
* [ ] 撰寫 Slot 合併函式（merge logic）
* [ ] 加入任務完成判斷機制與寫入觸發點

---

## 🔮 延伸方向

* ✅ Slot Template 可場景擴充（健身課、用藥紀錄、照護事項等）
* ✅ 結合情緒分析 slot（如情緒、焦慮度）
* ✅ 變數型提醒：例如「成果發表會前一天提醒」
* ✅ 整合語音摘要 → Slot 建立流程（支援長語音分段拆句補 slot）

---

```

---

如你需要，我可以幫你把這份 claude.md 上傳到你的開發資料夾，或直接根據這份規格，生成 Claude Prompt Pack 樣板、Slot Memory 初始化函式、merge 函數邏輯草稿等。

請告訴我你下一步要我幫你做什麼？
```
