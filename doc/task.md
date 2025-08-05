# Claude Code 任務執行規劃表

本文件定義了各種開發任務的標準執行流程，確保 Claude Code 能夠系統性地完成任務。

## 📋 任務分類

### A. 功能開發任務
- 新增意圖 (Intent)
- 新增任務處理器 (Task Handler)
- 整合外部 API
- 資料模型調整

### B. 維護優化任務
- 程式碼重構
- 效能優化
- 錯誤修復
- 文件更新

### C. 配置管理任務
- 環境變數設定
- 部署配置
- Feature Flag 調整

---

## 🎯 A. 功能開發任務

### A1. 新增意圖 (Add New Intent)

**任務目標**：新增一個新的對話意圖，讓機器人能理解新的使用者需求。

**執行步驟**：
1. **分析需求**
   - [ ] 閱讀 `/doc/implement.md` 確認業務邏輯
   - [ ] 確認意圖名稱符合 snake_case 規範（動詞_名詞）
   - [ ] 列出必要的 slots（實體欄位）

2. **更新配置**
   - [ ] 編輯 `/config/mvp/intent-rules.yaml`
   - [ ] 新增意圖規則：keywords、required_slots、priority
   - [ ] 考慮排除詞避免誤判

3. **實作任務處理器**
   - [ ] 在 `/src/tasks/` 建立 `handle_[intent]_task.js`
   - [ ] 實作業務邏輯
   - [ ] 確保回傳格式為 `{ success: boolean, message: string }`

4. **整合測試**
   - [ ] 使用 `node tools/send-test-message.js` 測試
   - [ ] 驗證意圖識別正確
   - [ ] 驗證 slots 提取完整
   - [ ] 確認回應訊息符合預期

5. **文件更新**
   - [ ] 更新 `/doc/developer-guide.md` 的任務函式列表
   - [ ] 在 `/doc/implement.md` 新增對話範例

**範例指令**：
```bash
# 測試新意圖
node tools/send-test-message.js "請幫我查詢小明這週的上課記錄"
```

### A2. 新增任務處理器 (Add Task Handler)

**任務目標**：為已存在的意圖實作具體的業務邏輯處理。

**執行步驟**：
1. **理解需求**
   - [ ] 查看意圖的 required_slots
   - [ ] 確認需要呼叫哪些服務（Google Calendar/Firebase）
   - [ ] 規劃錯誤處理策略

2. **建立檔案**
   ```javascript
   // /src/tasks/handle_[intent]_task.js
   const { googleCalendarService, firebaseService } = require('../services');
   
   async function handle_[intent]_task(slots, userId) {
     try {
       // 1. 驗證輸入
       // 2. 執行業務邏輯
       // 3. 回傳結果
       return { success: true, message: '✅ 成功訊息' };
     } catch (error) {
       console.error('Error in handle_[intent]_task:', error);
       return { success: false, message: '❌ 錯誤訊息' };
     }
   }
   
   module.exports = handle_[intent]_task;
   ```

3. **註冊任務**
   - [ ] 在 `/src/tasks/index.js` 匯出新函式
   - [ ] 在意圖路由器中註冊對應關係

4. **單元測試**（Phase 2 才需要）
   - [ ] 測試正常流程
   - [ ] 測試錯誤情況
   - [ ] 測試邊界條件

### A3. 整合外部 API

**任務目標**：整合新的外部服務（如圖片上傳、天氣查詢等）。

**執行步驟**：
1. **API 研究**
   - [ ] 閱讀 API 文件
   - [ ] 確認認證方式
   - [ ] 了解 rate limit 和配額限制
   - [ ] 測試 API endpoint

2. **建立服務模組**
   - [ ] 在 `/src/services/` 建立新服務檔案
   - [ ] 實作 API 呼叫封裝
   - [ ] 加入錯誤處理和重試機制
   - [ ] 實作回應資料轉換

3. **環境配置**
   - [ ] 新增必要的環境變數（API key 等）
   - [ ] 更新 `.env.example`
   - [ ] 在 README 說明配置方式

4. **整合到任務流程**
   - [ ] 在相關 task handler 中使用新服務
   - [ ] 處理 API 錯誤情況
   - [ ] 確保使用者體驗流暢

### A4. 資料模型調整

**任務目標**：修改 Firebase 資料結構以支援新功能。

**執行步驟**：
1. **影響分析**
   - [ ] 列出受影響的集合和文件
   - [ ] 評估對現有資料的影響
   - [ ] 規劃資料遷移策略（如需要）

2. **更新資料模型**
   - [ ] 修改 `/doc/developer-guide.md` 的資料結構說明
   - [ ] 更新相關的 service 函式
   - [ ] 確保向後相容（或提供遷移腳本）

3. **測試驗證**
   - [ ] 測試新欄位的讀寫
   - [ ] 驗證既有功能不受影響
   - [ ] 檢查查詢效能

### A5. 語意處理任務（Intent + Slot 模型開發）

**任務目標**：開發和調整語意識別系統，處理自然語言理解的相關任務。

**執行步驟**：
1. **新增意圖識別規則**
   - [ ] 在 `/config/mvp/intent-rules.yaml` 新增意圖
   - [ ] 定義關鍵詞陣列（keywords）
   - [ ] 設定必要欄位（required_slots）
   - [ ] 配置優先級（priority，數字越小優先級越高）
   - [ ] 加入排除詞（exclude_keywords）避免誤判

2. **設計 Slot 抽取 Prompt**
   - [ ] 在 `/src/intent/extractSlots.js` 加入新的抽取邏輯
   - [ ] 為每個 slot 定義清楚的格式要求
   - [ ] 加入範例輸入和預期輸出
   - [ ] 處理模糊語句的預設值

3. **設計 OpenAI API Fallback 格式**
   ```javascript
   // OpenAI API 呼叫格式範例
   const prompt = `
   判斷以下語句的意圖，回傳 JSON 格式：
   
   語句：「${userMessage}」
   
   可能的意圖：add_course, query_schedule, set_reminder, record_content, cancel_course
   
   回傳格式：{"intent": "意圖名稱", "confidence": 0.8}
   如果不確定，請回傳：{"intent": "unknown", "confidence": 0.0}
   `;
   ```

4. **測試語意處理**
   - [ ] 使用 `node tools/send-test-message.js` 測試各種語句
   - [ ] 驗證意圖識別準確率
   - [ ] 檢查 slots 抽取完整性
   - [ ] 測試邊界情況（模糊語句、錯字、簡寫）

5. **Debug 語意錯誤**
   - [ ] 加入 console.log 追蹤意圖識別過程
   - [ ] 檢查 intent-rules.yaml 的關鍵詞是否足夠
   - [ ] 驗證 OpenAI API 的 prompt 是否清楚
   - [ ] 確認 slots 的資料格式轉換正確

**範例任務：處理「我想補一下昨天那堂課的內容」**
```yaml
# 在 intent-rules.yaml 新增
- intent: record_content
  keywords: ["補", "記錄", "內容", "上課", "課程"]
  required_slots: ["timeReference", "courseName", "studentName"]
  priority: 2
  exclude_keywords: ["查詢", "查看"]
```

```javascript
// extractSlots 處理邏輯
if (intent === 'record_content') {
  // 時間參考處理
  if (message.includes('昨天')) {
    slots.timeReference = 'yesterday';
    slots.courseDate = getYesterday();
  }
  // 課程需要進一步詢問或從上下文取得
  if (!slots.courseName) {
    needMoreInfo.push('courseName');
  }
}
```

### A6. MVP 核心意圖實作任務

以下是 MVP 階段必須實作的 5 個核心意圖，每個都包含完整的開發規格：

#### A6.1 新增課程 (add_course)

**使用者語句範例**：
- 「小明每週三下午3點數學課」
- 「Lumi 星期五要上鋼琴課」
- 「幫我排小光明天上午10點的英文課」

**Intent 配置**：
```yaml
- intent: add_course
  keywords: ["上", "課", "安排", "排", "新增"]
  required_slots: ["studentName", "courseName", "scheduleTime"]
  priority: 1
```

**Slots 資料格式**：
```javascript
{
  studentName: "小明",           // 必填
  courseName: "數學課",          // 必填
  scheduleTime: "15:00",         // 必填，統一24小時制
  courseDate: "2025-01-15",      // 單次課程必填
  recurring: true,               // 是否重複
  dayOfWeek: 3,                  // 星期幾（0=週日）
  duration: 60                   // 課程長度（分鐘）
}
```

**任務函式名稱**：`handle_add_course_task`

**處理流程**：
1. **驗證輸入**
   - [ ] 檢查必要 slots 是否存在
   - [ ] 驗證時間格式
   - [ ] 確認學生是否已註冊

2. **查詢學生資料**
   - [ ] 呼叫 `firebaseService.getStudent(userId, studentName)`
   - [ ] 取得學生的 calendarId
   - [ ] 如果學生不存在，先建立學生資料

3. **檢查時間衝突**
   - [ ] 呼叫 `googleCalendarService.checkConflict()`
   - [ ] 如有衝突，詢問使用者是否繼續

4. **建立 Google Calendar 事件**
   - [ ] 呼叫 `googleCalendarService.createEvent()`
   - [ ] 設定重複規則（如適用）
   - [ ] 取得 eventId

5. **儲存到 Firebase**
   - [ ] 呼叫 `firebaseService.saveCourse()`
   - [ ] 路徑：`/courses/{courseId}`
   - [ ] 包含 calendarEventId 關聯

**回傳格式**：
```javascript
{
  success: true,
  message: "✅ 小明每週三下午3:00的數學課已安排好了！"
}
```

#### A6.2 查詢課程 (query_schedule)

**使用者語句範例**：
- 「小明今天有什麼課？」
- 「查詢Lumi這週的課表」
- 「看一下小光明天的安排」

**Intent 配置**：
```yaml
- intent: query_schedule
  keywords: ["查詢", "查看", "看", "課表", "安排", "有什麼課"]
  required_slots: ["studentName", "timeRange"]
  priority: 2
```

**Slots 資料格式**：
```javascript
{
  studentName: "小明",           // 必填
  timeRange: "today",            // today/tomorrow/this_week/next_week
  specificDate: "2025-01-15",    // 具體日期（選填）
  courseName: "數學課"           // 查詢特定課程（選填）
}
```

**任務函式名稱**：`handle_query_schedule_task`

**處理流程**：
1. **解析時間範圍**
   - [ ] 將中文時間轉換為日期區間
   - [ ] 處理相對時間（今天、明天、這週）

2. **查詢 Firebase**
   - [ ] 呼叫 `firebaseService.getCoursesByStudent()`
   - [ ] 按時間篩選課程
   - [ ] 按 scheduleTime 排序

3. **格式化回應**
   - [ ] 轉換時間格式為中文顯示
   - [ ] 組織課程列表
   - [ ] 加入快捷操作按鈕

**回傳格式**：
```javascript
{
  success: true,
  message: "小明今天（1/15）的課程：\n📍 上午10:00 英文課\n📍 下午15:00 數學課"
}
```

#### A6.3 設定提醒 (set_reminder)

**使用者語句範例**：
- 「提醒我小明的數學課」
- 「鋼琴課前30分鐘通知我」
- 「設定提醒，記得帶課本」

**Intent 配置**：
```yaml
- intent: set_reminder
  keywords: ["提醒", "通知", "記得"]
  required_slots: ["studentName", "courseName"]
  priority: 2
```

**Slots 資料格式**：
```javascript
{
  studentName: "小明",           // 必填
  courseName: "數學課",          // 必填
  reminderTime: 30,              // 提前幾分鐘（預設30）
  reminderNote: "記得帶課本",    // 附加提醒內容（選填）
  specificDate: "2025-01-15"     // 特定日期的課程（選填）
}
```

**任務函式名稱**：`handle_set_reminder_task`

**處理流程**：
1. **查找課程**
   - [ ] 呼叫 `firebaseService.findCourse()`
   - [ ] 根據學生、課程名稱、日期查找

2. **建立提醒記錄**
   - [ ] 呼叫 `firebaseService.createReminder()`
   - [ ] 儲存到 Firebase `/reminders/{reminderId}`
   - [ ] 記錄課程ID、用戶ID、提醒時間、提醒內容

3. **更新課程標記**
   - [ ] 呼叫 `firebaseService.updateCourse()`
   - [ ] 設定 shouldRemind: true
   - [ ] 關聯 reminderId

**⚠️ 重要說明：提醒功能執行機制**
- 提醒功能由**定時任務**觸發執行（非使用者即時發送）
- 系統透過 Firebase Scheduled Functions 每5分鐘掃描 `/reminders` 集合
- 檢查是否有符合觸發條件的提醒（課程開始時間 - reminderTime ≤ 現在時間）
- 符合條件時，主動發送 LINE Push Message 給對應使用者
- 發送後標記該提醒為已執行，避免重複發送

**提醒定時任務實作**：
```javascript
// functions/scheduledReminder.js
exports.checkReminders = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  const now = new Date();
  
  // 查詢需要發送的提醒
  const reminders = await db.collection('reminders')
    .where('executed', '==', false)
    .where('triggerTime', '<=', now)
    .get();
    
  // 批次發送提醒
  for (const reminder of reminders.docs) {
    await sendLineReminder(reminder.data());
    await reminder.ref.update({ executed: true });
  }
});
```

**回傳格式**：
```javascript
{
  success: true,
  message: "✅ 將在小明數學課開始前30分鐘提醒您"
}
```

#### A6.4 記錄課程內容 (record_content)

**使用者語句範例**：
- 「今天小明的數學課學了分數」
- 「記錄一下Lumi的鋼琴課內容」
- 「我想補一下昨天那堂課的內容」
- 使用者傳送照片 + 文字說明

**Intent 配置**：
```yaml
- intent: record_content
  keywords: ["記錄", "學了", "內容", "補", "上了"]
  required_slots: ["studentName", "courseName", "content"]
  priority: 2
```

**Slots 資料格式**：
```javascript
{
  studentName: "小明",           // 必填
  courseName: "數學課",          // 必填
  content: "學了分數加減法",     // 課程內容（必填）
  courseDate: "2025-01-15",      // 課程日期（預設今天）
  photos: [],                    // 照片陣列（選填）
  timeReference: "today"         // today/yesterday/specific_date
}
```

**任務函式名稱**：`handle_record_content_task`

**處理流程**：
1. **查找課程**
   - [ ] 根據學生、課程、日期查找對應課程
   - [ ] 如果是「昨天」等相對時間，轉換為具體日期

2. **處理圖片上傳**（如有圖片）
   - [ ] 呼叫 `uploadImage()` 函式處理每張圖片
   - [ ] 上傳到 Firebase Storage：`/courses-images/{courseId}/{timestamp}`
   - [ ] 取得公開圖片網址
   - [ ] 將圖片網址加入 photos 陣列

3. **更新課程記錄**
   - [ ] 呼叫 `firebaseService.updateCourseRecord()`
   - [ ] 路徑：`/courses/{courseId}/courseRecord`
   - [ ] 累加內容，不覆蓋既有記錄
   - [ ] 寫入圖片網址到 photos 欄位

**⚠️ 重要說明：圖片上傳功能實作**

**uploadImage() 函式規格**：
```javascript
/**
 * 上傳圖片到 Firebase Storage
 * @param {Buffer} imageBuffer - 圖片二進位資料
 * @param {string} courseId - 課程ID
 * @param {string} fileName - 檔案名稱
 * @returns {Promise<string>} 公開圖片網址
 */
async function uploadImage(imageBuffer, courseId, fileName) {
  try {
    // 1. 建立 Storage 參考路徑
    const storageRef = admin.storage().bucket().file(`courses-images/${courseId}/${fileName}`);
    
    // 2. 上傳圖片
    await storageRef.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    // 3. 設定公開存取權限
    await storageRef.makePublic();
    
    // 4. 回傳公開網址
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageRef.name}`;
    return publicUrl;
    
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('圖片上傳失敗');
  }
}
```

**圖片處理完整流程**：
1. 使用者透過 LINE 傳送圖片
2. Bot 接收圖片並下載為 Buffer
3. 呼叫 `uploadImage()` 上傳到 Firebase Storage
4. 取得公開圖片網址
5. 將網址寫入 Firebase `/courses/{courseId}/courseRecord/photos` 陣列
6. 回傳確認訊息給使用者

**回傳格式**：
```javascript
{
  success: true,
  message: "✅ 已記錄小明1/15數學課的內容：學了分數加減法（含2張照片）"
}
```

#### A6.5 刪除課程 (cancel_course)

**使用者語句範例**：
- 「取消小明明天的數學課」
- 「刪掉Lumi的鋼琴課」
- 「不上英文課了」

**Intent 配置**：
```yaml
- intent: cancel_course
  keywords: ["取消", "刪除", "刪掉", "不上"]
  required_slots: ["studentName", "courseName"]
  priority: 2
```

**Slots 資料格式**：
```javascript
{
  studentName: "小明",           // 必填
  courseName: "數學課",          // 必填
  scope: "single",               // single/recurring/all
  specificDate: "2025-01-15",    // 取消特定日期（選填）
  reason: "生病"                 // 取消原因（選填）
}
```

**任務函式名稱**：`handle_cancel_course_task`

**處理流程**：
1. **確認取消範圍**
   - [ ] 詢問是單次還是整個重複課程
   - [ ] 顯示課程資訊讓使用者確認

2. **刪除 Google Calendar 事件**
   - [ ] 呼叫 `googleCalendarService.deleteEvent()`
   - [ ] 處理重複事件的部分刪除

3. **更新 Firebase**
   - [ ] 單次：標記 cancelled: true
   - [ ] 重複：刪除整筆記錄
   - [ ] 保留歷史記錄供查詢

**回傳格式**：
```javascript
{
  success: true,
  message: "✅ 已取消小明明天（1/16）的數學課"
}
```

### A7. 每週學習成果摘要卡片任務（AI 生成，定時任務）

每週六上午 10:00，自動執行以下流程，向家長推播一張學習摘要圖片卡：

1. 查詢 Firebase 中該學生過去 7 天內的課程資料（`courses` / `course_content`），彙整課名、內容與圖片。

2. 呼叫 AI 模型（如 GPT-3.5）生成一段文字摘要，內容包括：
   - 本週學習亮點
   - 上課表現與進度
   - 推薦鼓勵語句（溫暖、正向、口語化）

3. 背景圖片生成邏輯：
   - **若該學生過去 7 天內有課程圖片**，挑選其中一張代表性圖片，送入風格轉換模型（如 Replicate 或 Stability API），使用 prompt：
     ```
     Studio Ghibli style children’s learning moment illustration, warm color, dreamy, cinematic
     ```
   - **若無圖片可用**，則根據本週最多的課程類型（如鋼琴、美術、科學），呼叫 AI 圖片生成 API（如 DALL·E）輸入背景 prompt：

     ```
     Studio Ghibli styleA cheerful and heartwarming children's learning background, with soft colors, suitable for weekly report card; theme: {課程主題}, warm lighting, 1080x1080
     ```

4. 使用 `node-canvas` 合成圖片卡片，步驟如下：
   - 載入背景圖（風格轉換圖 或 AI 背景圖）作為底圖
   - 將文字摘要加上自動排版，繪製在圖中央偏上位置（最多三段）
   - 圖片右下角加入水印：**「{學生名稱}@課課通」**（白字 + 半透明深色背景）
   - 圖片解析度為 1080 x 1080，匯出為 PNG

   ```ts
   composeSummaryCard(text: string, imageUrl: string, studentName: string): Buffer
   ```

5. 將生成的圖片卡上傳至 Firebase Storage，取得公開連結 URL。

6. 透過 LINE 推播 API 發送圖片卡給對應家長帳號：

   ```ts
   sendLinePush(userId: string, imageUrl: string): Promise<void>
   ```

---

📌 **注意事項：**
- 多子女家庭應分別生成與推播
- 若資料過少，可生成通用訊息 + 插入過去內容
- 背景圖優先使用課堂照片轉圖風，若失敗則退回 AI 主題生成
- 可考慮針對課程類型設計一套主題圖背景 Prompt 參數模板（延伸發展）

---

🔧 **對應函式與模組：**

| 函式名稱 | 功能說明 |
|----------|-----------|
| `generateWeeklySummary(studentId)` | 生成文字摘要（使用 GPT） |
| `generateWeeklyImage(theme)` | AI 產生吉卜力風格背景圖片 |
| `convertPhotoToGhibliStyle(image)` | 課堂照片轉吉卜力風圖（風格轉換） |
| `composeSummaryCard(text, image, studentName)` | 合成圖卡（文字 + 圖片 + 水印） |
| `uploadToStorage(buffer)` | 上傳圖卡至 Firebase Storage |
| `sendLinePush(userId, imageUrl)` | 發送 LINE 圖片訊息 |

---

## 🔧 B. 維護優化任務

### B1. 程式碼重構

**任務目標**：改善程式碼品質而不改變功能。

**執行步驟**：
1. **識別重構目標**
   - [ ] 使用 `npm run lint` 檢查程式碼品質
   - [ ] 找出重複的程式碼片段
   - [ ] 識別過長的函式（超過 50 行）

2. **重構實施**
   - [ ] 提取共用函式到 `/src/utils/`
   - [ ] 分解複雜函式
   - [ ] 統一錯誤處理模式
   - [ ] 改善變數命名

3. **驗證測試**
   - [ ] 執行 `npm run lint:fix`
   - [ ] 測試所有受影響的功能
   - [ ] 確認行為沒有改變

### B2. 效能優化

**任務目標**：提升系統回應速度和資源使用效率。

**執行步驟**：
1. **效能分析**
   - [ ] 識別瓶頸（API 呼叫、資料庫查詢）
   - [ ] 測量現有回應時間
   - [ ] 設定優化目標

2. **優化實施**
   - [ ] 實施快取策略（記憶體或 Redis）
   - [ ] 優化資料庫查詢（加入索引）
   - [ ] 減少不必要的 API 呼叫
   - [ ] 實施批次處理

3. **效果驗證**
   - [ ] 測量優化後的回應時間
   - [ ] 監控資源使用情況
   - [ ] 確保功能正確性

### B3. 錯誤修復

**任務目標**：修復已知的程式錯誤。

**執行步驟**：
1. **問題重現**
   - [ ] 根據錯誤報告重現問題
   - [ ] 收集錯誤日誌
   - [ ] 確認影響範圍

2. **根因分析**
   - [ ] 追蹤錯誤堆疊
   - [ ] 找出錯誤根源
   - [ ] 評估修復方案

3. **修復實施**
   - [ ] 實作修復程式碼
   - [ ] 加入防禦性程式設計
   - [ ] 改善錯誤訊息

4. **迴歸測試**
   - [ ] 驗證錯誤已修復
   - [ ] 測試相關功能
   - [ ] 確保沒有引入新問題

---

## ⚙️ C. 配置管理任務

### C1. 環境變數設定

**任務目標**：新增或修改環境變數配置。

**執行步驟**：
1. **更新配置檔案**
   - [ ] 編輯 `.env.example`
   - [ ] 加入變數說明註解
   - [ ] 提供範例值

2. **程式碼整合**
   - [ ] 在相關模組中讀取環境變數
   - [ ] 加入預設值處理
   - [ ] 驗證必要變數存在

3. **文件更新**
   - [ ] 更新 README 的環境設定章節
   - [ ] 說明變數用途和格式
   - [ ] 提供設定範例

### C2. Feature Flag 調整

**任務目標**：啟用或關閉特定功能。

**執行步驟**：
1. **評估影響**
   - [ ] 查看 `/src/config/features.js`
   - [ ] 了解功能的依賴關係
   - [ ] 確認是否需要資料遷移

2. **調整設定**
   - [ ] 修改 feature flag 的 enabled 狀態
   - [ ] 設定 rolloutPercentage（如需要）
   - [ ] 更新 enabledUsers 白名單（如需要）

3. **測試驗證**
   - [ ] 測試功能開關效果
   - [ ] 確認降級機制正常
   - [ ] 監控系統穩定性

---

## 📝 任務執行檢查清單

每個任務執行前後都應該：

**執行前**：
- [ ] 閱讀相關文件（implement.md、developer-guide.md）
- [ ] 確認開發環境正常（npm install、環境變數）
- [ ] 拉取最新程式碼（git pull）

**執行中**：
- [ ] 遵循命名規範（參考 claude.md）
- [ ] 保持程式碼風格一致（使用 npm run lint:fix）
- [ ] 適時提交進度（git commit）

**執行後**：
- [ ] 執行格式檢查（npm run lint）
- [ ] 測試所有相關功能
- [ ] 更新相關文件
- [ ] 清理測試資料

---

## 🚀 快速任務範本

### 快速新增查詢意圖
```bash
# 1. 新增意圖規則
echo "- intent: query_[something]
  keywords: [\"查詢\", \"查看\", \"顯示\"]
  required_slots: [\"studentName\", \"dateRange\"]" >> /config/mvp/intent-rules.yaml

# 2. 建立任務處理器
touch /src/tasks/handle_query_[something]_task.js

# 3. 測試新功能
node tools/send-test-message.js "查詢小明本週的[something]"
```

### 快速修復錯誤
```bash
# 1. 查看錯誤日誌
npm start | grep ERROR

# 2. 定位問題檔案
grep -r "錯誤關鍵字" /src

# 3. 修復並測試
npm run lint:fix
node tools/send-test-message.js "觸發錯誤的訊息"
```

---

## 📌 注意事項

1. **第一性原則**：每個任務都要思考「為什麼要這樣做」
2. **保持簡單**：MVP 階段避免過度設計
3. **使用者優先**：所有改動都要考慮對使用者體驗的影響
4. **文件同步**：程式碼改動後記得更新相關文件

本規劃表會隨著專案演進持續更新。