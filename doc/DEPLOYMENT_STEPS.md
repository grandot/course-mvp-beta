# 🚀 LINE 課程管理機器人 - 雲端部署步驟

## 📋 部署前準備

### 1. 安裝必要工具

#### Google Cloud SDK
```bash
# macOS (使用 Homebrew)
brew install --cask google-cloud-sdk

# 或直接下載安裝
# https://cloud.google.com/sdk/docs/install
```

#### Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. 登錄和設定

#### Google Cloud 登錄
```bash
gcloud auth login
gcloud config set project course-management-bot-da85a
```

#### Firebase 登錄
```bash
firebase login
firebase use course-management-bot-da85a
```

## 🚀 快速部署（一鍵執行）

```bash
# 執行自動部署腳本
./deploy.sh
```

## 📋 手動部署步驟（如果需要）

### 1. 啟用 Google Cloud API
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. 部署 Firebase Functions（提醒系統）
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 3. 部署 Firestore 規則
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. 建立和部署 Cloud Run 服務
```bash
# 建立 Docker 映像
gcloud builds submit --tag gcr.io/course-management-bot-da85a/course-management-bot .

# 部署到 Cloud Run
gcloud run deploy course-management-bot \
  --image gcr.io/course-management-bot-da85a/course-management-bot \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars FIREBASE_PROJECT_ID=course-management-bot-da85a
```

### 5. 取得服務 URL
```bash
gcloud run services describe course-management-bot \
  --region asia-east1 \
  --format 'value(status.url)'
```

## 📱 LINE Bot 設定

### 1. 設定 Webhook URL
1. 前往 [LINE Developer Console](https://developers.line.biz/console/)
2. 選擇你的 Bot
3. 進入 "Messaging API" 頁籤
4. 設定 Webhook URL: `https://your-service-url/webhook`
5. 啟用 "Use webhook"
6. 關閉 "Auto-reply messages"

### 2. 測試設定
```bash
# 測試健康檢查
curl https://your-service-url/health

# 應該回傳：
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## 🧪 功能測試

部署完成後，可以在 LINE 中測試以下對話：

### 基礎功能測試
1. **新增課程**: "小明每週三下午3點數學課"
2. **查詢課表**: "查詢小明今天的課程"
3. **記錄內容**: "今天小明的數學課學了分數"
4. **設定提醒**: "提醒我小明的數學課"
5. **取消課程**: "取消小明明天的數學課"

### 複雜功能測試
- **重複課程**: "Lumi每週一三五下午2點要上英文課"
- **圖片上傳**: 傳送課堂照片 + "這是小明的數學課"
- **時間範圍查詢**: "查詢這週小明的所有課程"

## 📊 監控和日誌

### 查看應用日誌
```bash
# Cloud Run 日誌
gcloud logs tail --follow \
  --filter="resource.type=cloud_run_revision AND resource.labels.service_name=course-management-bot"

# Firebase Functions 日誌
firebase functions:log --follow
```

### 監控指標
```bash
# 服務狀態
gcloud run services describe course-management-bot --region asia-east1

# 使用量統計
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

## 🔧 環境變數管理

### 更新 Cloud Run 環境變數
```bash
gcloud run services update course-management-bot \
  --region asia-east1 \
  --set-env-vars KEY=VALUE
```

### 查看當前環境變數
```bash
gcloud run services describe course-management-bot \
  --region asia-east1 \
  --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
```

## 🚨 故障排除

### 常見問題

1. **服務無法啟動**
   - 檢查環境變數是否正確設定
   - 查看 Cloud Run 日誌

2. **LINE Webhook 無回應**
   - 確認 Webhook URL 設定正確
   - 檢查服務健康狀態

3. **Firebase 連線失敗**
   - 確認 Firebase 專案 ID 正確
   - 確認服務帳戶權限

### 除錯指令
```bash
# 健康檢查
curl https://your-service-url/health

# 測試 webhook
curl -X POST https://your-service-url/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'

# 查看詳細日誌
gcloud logs tail --follow --filter="resource.type=cloud_run_revision"
```

## 🎉 部署完成！

部署成功後，你的 LINE 課程管理機器人就在雲端運行了！

**服務 URL**: `https://course-management-bot-xxxxxxx-de.a.run.app`
**Webhook URL**: `https://course-management-bot-xxxxxxx-de.a.run.app/webhook`

現在可以開始與你的 LINE Bot 對話測試所有功能了！🤖