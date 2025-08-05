# 🚀 生產環境部署指南

本文檔說明如何將 LINE 課程管理機器人部署到生產環境。

## 📋 部署前檢查清單

### ✅ 環境準備
- [ ] Firebase 專案已建立
- [ ] LINE Developer Console 帳號已設定
- [ ] Google Cloud Platform 帳號已設定
- [ ] OpenAI API 金鑰已取得
- [ ] 網域名稱已準備（可選）

### ✅ 本地測試
- [ ] 執行 `npm run lint` 無錯誤
- [ ] 執行 `npm run test:quick` 通過
- [ ] 執行 `npm run test:full` 通過率 > 90%
- [ ] 所有環境變數已設定並測試

### ✅ 程式碼品質
- [ ] 所有 TODO 和 FIXME 已處理
- [ ] 敏感資訊已移除
- [ ] 日誌層級設定為 production
- [ ] 錯誤處理機制完善

## 🛠️ 部署步驟

### 1. Firebase 專案設定

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入 Firebase
firebase login

# 初始化專案（如果還沒有）
firebase init

# 選擇服務：
# - Firestore
# - Functions
# - Storage
```

### 2. 環境變數設定

#### Firebase Functions 環境變數
```bash
# 設定 LINE Channel Access Token
firebase functions:config:set line.access_token="YOUR_LINE_CHANNEL_ACCESS_TOKEN"

# 設定 OpenAI API Key
firebase functions:config:set openai.api_key="YOUR_OPENAI_API_KEY"

# 查看設定
firebase functions:config:get
```

#### 主應用程式環境變數
建立 `.env.production` 檔案：
```bash
# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_STORAGE_BUCKET=your_firebase_project_id.appspot.com

# Application Configuration
PORT=3000
NODE_ENV=production

# Feature Flags
ENABLE_AI_FALLBACK=true
ENABLE_REMINDERS=true
ENABLE_IMAGE_UPLOAD=true

# Debugging (生產環境建議關閉)
DEBUG_INTENT_PARSING=false
DEBUG_SLOT_EXTRACTION=false
```

### 3. 部署 Firebase Functions

```bash
# 進入 functions 目錄
cd functions

# 安裝依賴
npm install

# 部署 Functions
firebase deploy --only functions

# 檢查部署狀態
firebase functions:log
```

### 4. 部署 Firestore 規則和索引

```bash
# 部署 Firestore 規則
firebase deploy --only firestore:rules

# 部署 Firestore 索引
firebase deploy --only firestore:indexes

# 部署 Storage 規則
firebase deploy --only storage
```

### 5. 部署主應用程式

#### 選項 A: Render (推薦) ✅

**當前部署狀態**: 已部署並運行中

- **服務 URL**: https://course-mvp-beta.onrender.com
- **Webhook URL**: https://course-mvp-beta.onrender.com/webhook  
- **健康檢查**: https://course-mvp-beta.onrender.com/health

```bash
# 檢查服務狀態
curl https://course-mvp-beta.onrender.com/health

# 預期回應
{
  "status": "ok",
  "timestamp": "2025-08-05T09:03:52.071Z", 
  "version": "1.0.0"
}
```

**Render 部署步驟**:
1. 連接 GitHub 倉庫到 Render
2. 設定環境變數（已完成）
3. 自動部署（已完成）
4. 設定 LINE Webhook URL

#### 選項 B: Google Cloud Run
```bash
# 建立 Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
EOF

# 建立 .dockerignore
cat > .dockerignore << EOF
node_modules
npm-debug.log
.git
.env
.env.local
test-reports
functions
EOF

# 建置並部署
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/course-mvp
gcloud run deploy course-mvp --image gcr.io/YOUR_PROJECT_ID/course-mvp --platform managed
```

#### 選項 B: Heroku
```bash
# 建立 Procfile
echo "web: npm start" > Procfile

# 部署到 Heroku
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set LINE_CHANNEL_ACCESS_TOKEN=your_token
# ... 設定其他環境變數

git add .
git commit -m "部署到生產環境"
git push heroku main
```

### 6. LINE Bot Webhook 設定

1. 前往 [LINE Developer Console](https://developers.line.biz/)
2. 選擇你的 Channel
3. 在 "Messaging API" 頁面設定 Webhook URL：
   ```
   https://your-domain.com/webhook
   ```
4. 啟用 "Use webhook"
5. 測試 webhook 連接

## 🔧 部署後設定

### 1. SSL 憑證設定
```bash
# 如果使用 Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### 2. 監控設定

#### Firebase Functions 監控
```bash
# 查看 Functions 日誌
firebase functions:log

# 設定日誌過濾
firebase functions:log --only checkReminders
```

#### 應用程式監控
建立 `monitoring.js`：
```javascript
// 健康檢查端點增強
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    services: {}
  };

  try {
    // 檢查 Firebase
    await firebaseService.testConnection();
    health.services.firebase = 'ok';

    // 檢查 LINE API
    await lineService.testConnection();
    health.services.line = 'ok';

    res.json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(500).json(health);
  }
});
```

### 3. 備份策略

#### Firestore 自動備份
```bash
# 設定每日備份
gcloud firestore operations list
```

#### 設定檔備份
```bash
# 備份重要設定檔
mkdir -p backups/$(date +%Y%m%d)
cp -r functions/index.js firestore.rules firebase.json backups/$(date +%Y%m%d)/
```

## 📊 效能優化

### 1. Firestore 查詢優化
```javascript
// 建立複合索引
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "courses",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "studentName", "order": "ASCENDING"},
        {"fieldPath": "courseDate", "order": "ASCENDING"}
      ]
    }
  ]
}
```

### 2. 快取策略
```javascript
// 實作記憶體快取
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5分鐘快取

// 在查詢前檢查快取
const cacheKey = `course_${userId}_${studentName}`;
let courses = cache.get(cacheKey);
if (!courses) {
  courses = await firebaseService.getCoursesByStudent(userId, studentName);
  cache.set(cacheKey, courses);
}
```

## 🛡️ 安全性設定

### 1. API 速率限制
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100 // 限制每個 IP 每15分鐘最多100個請求
});

app.use('/webhook', limiter);
```

### 2. CORS 設定
```javascript
const cors = require('cors');

app.use(cors({
  origin: ['https://your-domain.com'],
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'x-line-signature']
}));
```

## 📈 監控與警報

### 1. Google Cloud Monitoring
```bash
# 安裝監控 agent
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
sudo bash add-monitoring-agent-repo.sh
sudo apt-get update
sudo apt-get install stackdriver-agent
```

### 2. 錯誤追蹤
```javascript
// 整合 Google Error Reporting
const { ErrorReporting } = require('@google-cloud/error-reporting');
const errors = new ErrorReporting();

process.on('uncaughtException', (error) => {
  errors.report(error);
  console.error('未捕獲的異常:', error);
  process.exit(1);
});
```

## 🧪 部署驗證

### 部署後測試清單
```bash
# 1. 健康檢查
curl https://your-domain.com/health

# 2. LINE Webhook 測試
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'

# 3. 執行完整測試
npm run test:full -- --base-url https://your-domain.com

# 4. 檢查 Functions 狀態
firebase functions:log

# 5. 測試提醒功能
curl https://your-region-your-project.cloudfunctions.net/triggerReminderCheck
```

## 🔄 維護作業

### 日常維護
- 檢查應用程式日誌
- 監控 Firebase 使用量
- 檢查 LINE API 配額
- 更新依賴套件

### 週期性維護
- 清理舊的測試資料
- 分析使用者回饋
- 效能調優
- 安全更新

## 📞 緊急應變

### 服務中斷處理
1. 檢查健康檢查端點
2. 查看錯誤日誌
3. 檢查外部服務狀態
4. 啟動備用系統（如有）

### 回滾程序
```bash
# Firebase Functions 回滾
firebase functions:delete functionName
firebase deploy --only functions

# 應用程式回滾
git checkout previous-stable-commit
# 重新部署
```

## 📚 相關文件

- [Firebase 部署文檔](https://firebase.google.com/docs/hosting/quickstart)
- [LINE Bot 部署指南](https://developers.line.biz/en/docs/messaging-api/deploying-a-bot/)
- [Google Cloud Run 文檔](https://cloud.google.com/run/docs)

---

*部署完成後，記得更新專案 README 和維護文檔*