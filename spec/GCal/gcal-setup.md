# Google Calendar 設定指南（OAuth 推薦方案）

本指南教你用「專用 Gmail + OAuth」快速讓平台程式操作 Google Calendar（支援為「每位學生建立一個日曆」與事件寫入）。

---

## 一、先建立專用 Gmail（平台帳號）

- 名稱：`kkt.chatbot@gmail.com`
- 此帳號僅供機器人使用，不對外分享

---

## 二、在 Google Cloud Platform 建立專案並啟用 API

1. 前往 Google Cloud Console：`https://console.cloud.google.com`
2. 建立新專案（專案名稱任意）
3. 啟用 Google Calendar API：
   - 左側「APIs & Services」→「Library」
   - 搜尋「Google Calendar API」→「Enable」

---

## 三、設定 OAuth 同意畫面（External）

1. 左側「APIs & Services」→「OAuth consent screen」
2. User Type 選擇「External」，建立
3. 填基本資訊（App name/Support email），Scopes 可先維持預設
4. Test users 加入你的「專用 Gmail」帳號（例如 `course.bot.platform@gmail.com`）

---

## 四、建立 OAuth Client（Desktop App）

1. 左側「Credentials」→「Create Credentials」→「OAuth client ID」
2. Application type：選「Desktop app」
3. 取得 Client ID 與 Client Secret（先備註）

---

## 五、取得 Refresh Token（一次性步驟）

使用 OAuth 2.0 Playground 可快速取得：

1. 開啟 `https://developers.google.com/oauthplayground/`
2. 右上角齒輪（Settings）→ 勾選「Use your own OAuth credentials」，貼上上一步的 Client ID/Secret
3. Step 1 輸入 scope：`https://www.googleapis.com/auth/calendar`
4. Authorize APIs → 選你的專用 Gmail 帳號 → 允許
5. Step 2：Exchange authorization code for tokens → 取得 Refresh Token（貼到環境變數）

---

## 六、設定伺服器環境變數（Render 或 .env）

- 最低需求：
  
  ```
  USE_GCAL=true
  GCAL_FALLBACK_FIREBASE=true
  TZ_DEFAULT=Asia/Taipei
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID=360393685424-s06n8a4iffn4squalfgp7fhfaom8u337.apps.googleusercontent.com
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET=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
  GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN=1//04F8cMmdX8kv4CgYIARAAGAQSNwF-L9Ir95FCZgRBurT3eL54Q9fS5bpDzabYxbiTZSjyY-kgeIH1gp-fmdzQUFfUFy6DlNzrhLY
  ```
- 搭配我們的整合策略：
  - 查詢預設走 Firebase（快照），GCal 用於鏡像/校對與背景同步
  - 寫入先 GCal 再 Firebase；GCal 失敗也落地 Firebase 並回補
  - Calendar 顆粒度預設「每位學生一個」，平台帳號持有、不對外分享

---

## 七、Calendar 結構與命名

- 顆粒度：每位學生建立一個 calendar（由平台 Gmail 擁有）
- 建議命名（summary）：`<studentName> 的課表（<lineUserId>）`
- 事件 summary 規範：`[lineUserId] [studentName] - courseName`
- 事件私有屬性（extendedProperties.private）：必含 `userId`、`courseId`、`studentName`

---

## 八、驗證流程（手動冒煙）

1. 在 LINE 輸入：「小明每週三下午3點數學課」
2. 期待結果：
   - GCal：平台帳號的 Calendar 清單會多一個「小明」的日曆，內含 recurring 事件
   - Firebase：寫入對應課程記錄，帶上 `gcalEventId`/`gcalRecurringId`
   - 查詢回覆：從 Firebase 快照回傳課表（GCal 僅作鏡像/校對）

---

## 九、常見 QA

- Q：沒有 Workspace/企業帳號可以嗎？
  - A：可以。OAuth 方案不需要 Workspace，最適合目前時程。
- Q：為什麼不用 Service Account（SA）？
  - A：SA 建立新日曆與授權較繁瑣（需分享權限或 domain delegation）。個人 Gmail + OAuth 能更快導通「每學生一個 calendar」。
- Q：隱私會不會外洩？
  - A：目前 calendar 不對外分享；summary 含 `userId` 僅平台可見。未來要分享給家長時，可改為不顯示 `userId`，僅保留在私有屬性。

---

## 十、切 Workspace/Service Account（選用）

- 適合時機：需要企業級授權、管理大量 calendar、或要在 domain 內無縫建立/管理日曆
- 方向：
  - 建 Service Account，開啟 domain-wide delegation
  - 以 SA 身份操作 Calendar，或在每個日曆設定「與 SA 分享可編輯」
  - 我們的程式碼介面不變，只改憑證與建立日曆的方式

---

## 十一、最小檢查清單

- [ ] 專用 Gmail 建立完成並可登入
- [ ] GCP 專案建立、Calendar API 啟用
- [ ] OAuth 同意畫面完成、Test user 加入
- [ ] OAuth Client（Desktop）建立，拿到 Client ID/Secret
- [ ] 透過 Playground 取得 Refresh Token
- [ ] Render/.env 設定環境變數
- [ ] 線上冒煙：新增一堂課 → GCal/ Firebase 均出現資料
