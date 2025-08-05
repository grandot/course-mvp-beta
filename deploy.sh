#!/bin/bash

# LINE 課程管理機器人 - Google Cloud 部署腳本

set -e

echo "🚀 開始部署 LINE 課程管理機器人到 Google Cloud..."

# 檢查必要工具
echo "🔍 檢查必要工具..."
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK 未安裝，請先安裝：https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI 未安裝，請先安裝：npm install -g firebase-tools"
    exit 1
fi

# 設定變數
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"course-management-bot-da85a"}
REGION=${REGION:-"asia-east1"}
SERVICE_NAME="course-management-bot"

echo "📋 使用配置："
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"

# 確認 Google Cloud 專案
echo "🔐 設定 Google Cloud 專案..."
gcloud config set project $PROJECT_ID

# 啟用必要的 API
echo "🔧 啟用必要的 Google Cloud API..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# 部署 Firebase Functions (提醒系統)
echo "⏰ 部署 Firebase Functions..."
cd functions
npm install
cd ..
firebase deploy --only functions --project $PROJECT_ID

# 部署 Firestore 規則和索引
echo "🔥 部署 Firestore 規則和索引..."
firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT_ID

# 建立並部署 Cloud Run 服務
echo "☁️ 部署主應用到 Cloud Run..."

# 建立 Docker 映像並部署
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

# 部署到 Cloud Run 並設定環境變數
echo "🌐 部署到 Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID

# 取得服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "🎉 部署完成！"
echo ""
echo "📡 服務 URL: $SERVICE_URL"
echo "🔗 Webhook URL: $SERVICE_URL/webhook"
echo "❤️ 健康檢查: $SERVICE_URL/health"
echo ""
echo "📋 接下來的步驟："
echo "1. 到 LINE Developer Console 設定 Webhook URL: $SERVICE_URL/webhook"
echo "2. 啟用 Webhook 並關閉自動回應訊息"
echo "3. 開始測試對話功能！"
echo ""
echo "🧪 測試指令："
echo "  curl $SERVICE_URL/health"
echo ""

# 測試健康檢查
echo "🔍 測試服務健康狀態..."
sleep 10  # 等待服務啟動
curl -f "$SERVICE_URL/health" && echo "✅ 服務健康檢查通過！" || echo "⚠️ 服務可能還在啟動中..."

echo ""
echo "🚀 部署完成！你的 LINE 課程管理機器人已經在雲端運行了！"