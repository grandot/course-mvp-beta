# 三層語意記憶系統 - 生產部署指南

## 📋 系統概述

三層語意記憶系統是一套智能課程管理的語義處理架構，包含：
- **Layer 1**: ConversationContext (短期記憶，5分鐘TTL)
- **Layer 2**: Memory.yaml (語義背景，用戶隔離YAML檔案)  
- **Layer 3**: SmartQueryEngine (實時查詢處理)

## 🚀 部署前準備

### 1. 系統需求
- Node.js >= 20.0.0
- 記憶體 >= 512MB (建議 1GB+)
- 磁碟空間 >= 1GB (用於 Memory.yaml 檔案存儲)
- 網路：支持 HTTPS 和 Webhook

### 2. 環境變數配置
```bash
# 基礎配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# Firebase 配置
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# LINE Bot 配置
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# 記憶存儲配置
MEMORY_STORAGE_PATH=./memory

# 日誌配置
LOG_LEVEL=info

# 安全配置
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3. 目錄結構準備
```
production-app/
├── src/                     # 應用程式碼
├── memory/                  # Memory.yaml 存儲目錄
├── logs/                   # 日誌檔案目錄
├── config/                 # 配置檔案
└── docs/                   # 文檔
```

## 🔧 部署步驟

### Step 1: 安裝依賴
```bash
npm ci --production
```

### Step 2: 檢查配置
```bash
# 檢查環境變數
node -e "console.log(require('./src/config/production.js'))"

# 驗證 Firebase 連接
npm run check:firebase

# 驗證 OpenAI API
npm run check:openai
```

### Step 3: 初始化系統
```bash
# 創建必要目錄
mkdir -p memory logs

# 設置目錄權限
chmod 755 memory logs

# 初始化監控
npm run init:monitoring
```

### Step 4: 啟動服務
```bash
# 方式1: 直接啟動
npm start

# 方式2: 使用 PM2 (推薦)
pm2 start ecosystem.config.js --env production

# 方式3: 使用 Docker
docker-compose up -d
```

## 📊 監控與健康檢查

### 健康檢查端點
```bash
# 系統整體健康狀態
GET /health

# 詳細監控指標
GET /metrics

# 服務狀態檢查
GET /api/status
```

### 監控指標

#### 1. 系統指標
- CPU 使用率
- 記憶體使用量
- 磁碟使用量
- 網路延遲

#### 2. 應用指標
- 請求響應時間
- 錯誤率
- 併發連接數
- 三層記憶系統性能

#### 3. 業務指標
- 語義分析成功率
- Regex 優先覆蓋率 (目標 70%)
- Memory.yaml 快取命中率
- SmartQuery 響應時間

## 🛡️ 安全配置

### 1. HTTPS 配置
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. 防火牆規則
```bash
# 允許 HTTPS 流量
sudo ufw allow 443/tcp

# 允許 LINE Webhook
sudo ufw allow from 147.92.150.0/24 to any port 443

# 禁止直接訪問應用端口
sudo ufw deny 3000/tcp
```

### 3. 速率限制
生產配置自動啟用：
- 每 IP 每 15 分鐘最多 1000 請求
- 可通過環境變數調整：`RATE_LIMIT_MAX=1000`

## 🔄 升級與回滾

### 無停機升級
```bash
# 1. 下載新版本
git pull origin main

# 2. 安裝新依賴
npm ci --production

# 3. 執行資料庫遷移
npm run migrate

# 4. 重新載入服務
pm2 reload all
```

### 回滾程序
```bash
# 1. 回滾到上一版本
git checkout HEAD~1

# 2. 回滾資料庫
npm run migrate:rollback

# 3. 重啟服務
pm2 restart all
```

## 📈 性能優化

### 1. Memory.yaml 優化
- **LRU 快取**: 預設快取 1000 個用戶
- **批量更新**: 每 10 秒批量寫入
- **記憶體限制**: 最大 100MB

### 2. SmartQuery 優化
- **查詢快取**: 自動快取常用查詢
- **響應超時**: 5 秒自動降級
- **併發限制**: 最多 100 併發請求

### 3. ConversationContext 優化
- **TTL 管理**: 5 分鐘自動過期
- **學習機制**: 實時用戶習慣學習
- **模式預測**: 智能下一步預測

## 🚨 故障排除

### 常見問題

#### 1. 記憶體不足
```bash
# 檢查記憶體使用
free -h

# 清理 Memory.yaml 快取
curl -X POST http://localhost:3000/api/admin/clear-cache
```

#### 2. OpenAI API 超時
```bash
# 檢查 API 狀態
curl -X GET http://localhost:3000/health | jq '.services.openai'

# 切換到 Regex 模式
export OPENAI_FALLBACK_ONLY=true
pm2 restart all
```

#### 3. Firebase 連接失敗
```bash
# 檢查 Firebase 配置
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# 測試連接
npm run test:firebase
```

### 日誌查看
```bash
# 應用日誌
tail -f logs/app.log

# PM2 日誌
pm2 logs

# 系統日誌
journalctl -u your-app-service -f
```

## 🎯 最佳實踐

### 1. 監控告警
- 設置 CPU 使用率 > 80% 告警
- 設置記憶體使用率 > 90% 告警
- 設置錯誤率 > 5% 告警
- 設置響應時間 > 2s 告警

### 2. 備份策略
```bash
# 每日備份 Memory.yaml
0 2 * * * tar -czf backup_$(date +\%Y\%m\%d).tar.gz memory/

# 每週清理舊備份
0 3 * * 0 find backup_*.tar.gz -mtime +7 -delete
```

### 3. 容量規劃
- **用戶規模**: 每 1000 活躍用戶需要約 50MB Memory.yaml 存儲
- **QPS 承載**: 單實例可處理約 100 QPS
- **記憶體需求**: 基礎 512MB + 每 1000 用戶 100MB

## 📞 技術支援

如有部署問題，請提供：
1. 系統環境信息 (`uname -a`)
2. Node.js 版本 (`node --version`)
3. 錯誤日誌 (`logs/app.log` 最後 100 行)
4. 健康檢查結果 (`curl localhost:3000/health`)

---

**部署完成檢查清單**:
- [ ] 環境變數配置正確
- [ ] 健康檢查端點正常 (`/health` 返回 200)
- [ ] 三層記憶系統運作正常
- [ ] LINE Bot Webhook 連接成功
- [ ] 監控告警配置完成
- [ ] 備份策略執行正常