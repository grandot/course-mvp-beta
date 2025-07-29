# Render 日誌獲取工具設置指南

## 🎯 目標
不用每次都去 Render Dashboard 手動查看日誌，直接在本地命令行獲取。

## 📋 設置步驟

### 1. 獲取 Render API Token
1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 點擊右上角用戶頭像 → Account Settings
3. 在左側選單選擇 "API Keys"
4. 點擊 "Create API Key"
5. 複製生成的 Token

### 2. 獲取 Service ID
1. 在 Render Dashboard 中打開你的服務
2. 從 URL 中複製 Service ID
   - URL 格式：`https://dashboard.render.com/web/srv-xxxxxxxxxxxxx`
   - Service ID 就是 `srv-xxxxxxxxxxxxx` 部分

### 3. 設置環境變數
在專案根目錄的 `.env` 文件中添加：

```env
# Render 日誌工具配置
RENDER_SERVICE_ID=srv-your-service-id-here
RENDER_API_TOKEN=your-api-token-here
```

**注意**：這兩個變數已經在 `.env` 文件中配置完成，可以直接使用。

**重要說明**：此工具獲取的是 Render 服務事件（如 build、deploy 狀態），不是應用程式日誌。如果需要應用程式日誌，建議使用 Render 的 Log Streaming 功能。

## 🚀 使用方法

### 基本用法
```bash
# 獲取最近 50 條日誌
npm run logs

# 獲取最近 100 條日誌
npm run logs -- --limit 100

# 過濾包含特定關鍵詞的日誌
npm run logs -- --filter "每週二"
npm run logs -- --filter "ERROR"

# 組合使用
npm run logs -- --filter "DEBUG" --limit 20
```

### 直接使用腳本
```bash
node scripts/get-render-logs.js --limit 100
node scripts/get-render-logs.js --filter "重複課程" --limit 50
```

## 💡 實用範例

### 查看錯誤日誌
```bash
npm run logs -- --filter "ERROR" --limit 30
```

### 查看部署相關事件
```bash
npm run logs -- --filter "deploy" --limit 20
npm run logs -- --filter "succeeded"
npm run logs -- --filter "failed"
```

### 查看建置相關事件
```bash
npm run logs -- --filter "build" --limit 10
npm run logs -- --filter "canceled"
```

## 🔧 故障排除

### 常見錯誤
1. **「請設置 RENDER_SERVICE_ID」**
   - 檢查 `.env` 文件中的 `RENDER_SERVICE_ID` 是否正確

2. **「請設置 RENDER_API_TOKEN」**
   - 檢查 `.env` 文件中的 `RENDER_API_TOKEN` 是否正確

3. **「請求失敗」**
   - 檢查網路連接
   - 確認 API Token 是否有效
   - 確認 Service ID 是否正確

### 權限問題
確保你的 Render API Key 有讀取服務日誌的權限。

## 🎯 進階用法

### 監控特定錯誤
創建別名來快速查看特定類型的日誌：

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
alias render-errors="cd /path/to/project && npm run logs -- --filter 'ERROR' --limit 50"
alias render-debug="cd /path/to/project && npm run logs -- --filter 'DEBUG' --limit 30"
```

這樣你就可以快速執行：
```bash
render-errors  # 查看錯誤日誌
render-debug   # 查看調試日誌
```