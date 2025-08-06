# 開發環境配置指南

## 部署環境說明

本專案部署在 **Render**（無狀態環境），必須遵守以下限制。

### 環境特性

| 特性 | 說明 | 影響 |
|------|------|------|
| **無狀態** | 每個請求可能由不同實例處理 | 不能依賴程序記憶體 |
| **自動休眠** | 15分鐘無活動後休眠 | 冷啟動延遲 |
| **隨機重啟** | 部署、更新、故障時重啟 | 記憶體資料遺失 |
| **水平擴展** | 可能同時運行多個實例 | 實例間無法共享狀態 |

### 狀態管理原則

#### ❌ 禁止使用（會導致資料遺失）

```javascript
// 錯誤：使用記憶體儲存
const cache = new Map();
const users = {};
let globalState = null;

// 錯誤：使用本地檔案
const fs = require('fs');
fs.writeFileSync('./data.json', data);

// 錯誤：假設單一實例
class Singleton {
  static instance = null;
}
```

#### ✅ 正確做法

```javascript
// 正確：使用 Redis
const redis = new Redis(process.env.REDIS_URL);
await redis.set('key', value);

// 正確：使用資料庫
await firebaseService.saveData(data);

// 正確：無狀態設計
function processRequest(input) {
  // 每次都從外部獲取狀態
  const state = await redis.get(userId);
  // 處理邏輯
  await redis.set(userId, newState);
}
```

### 必要的外部服務

1. **Redis**（對話狀態管理）
   - 用途：暫存對話上下文
   - 服務：Upstash 或 Redis Labs
   - TTL：30分鐘自動過期

2. **Firebase**（業務資料）
   - 用途：課程、用戶、記錄
   - 持久化：永久儲存

3. **Google Calendar**（時間邏輯）
   - 用途：排程、重複規則
   - API：無狀態呼叫

### 環境變數配置

```bash
# Redis（必需）
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx
REDIS_TLS=true

# Firebase（必需）
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx

# LINE Bot（必需）
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx

# 部署環境
NODE_ENV=production
PORT=3000
```

### 開發時注意事項

1. **本地開發 vs 生產環境**
   ```javascript
   // 開發環境可以用 Map（方便調試）
   const storage = process.env.NODE_ENV === 'development' 
     ? new Map() 
     : new RedisStorage();
   ```

2. **錯誤處理**
   ```javascript
   // 外部服務可能失敗，需要降級
   try {
     const context = await redis.get(key);
   } catch (error) {
     console.error('Redis failed, degrading...');
     // 降級為無狀態處理
   }
   ```

3. **冷啟動優化**
   ```javascript
   // 延遲初始化，避免啟動時連接所有服務
   let redis;
   function getRedis() {
     if (!redis) redis = new Redis();
     return redis;
   }
   ```

### 部署前檢查清單

- [ ] 沒有使用 Map() 或全域變數儲存狀態
- [ ] 沒有依賴本地檔案系統
- [ ] 所有狀態都儲存在外部服務
- [ ] 有適當的錯誤處理和降級方案
- [ ] 環境變數都已正確設定
- [ ] 考慮了冷啟動的影響

### 常見錯誤案例

1. **對話管理器使用 Map**
   - 問題：服務重啟後對話上下文消失
   - 解法：改用 Redis

2. **檔案上傳到本地**
   - 問題：檔案會被清除
   - 解法：直接上傳到 Firebase Storage

3. **使用 setTimeout 做定時任務**
   - 問題：服務可能在執行前重啟
   - 解法：使用 Firebase Scheduled Functions

### 參考資料

- [Render 文檔 - 無狀態應用](https://render.com/docs/web-services)
- [Vercel 文檔 - Serverless Functions](https://vercel.com/docs/functions)
- [Redis 最佳實踐](https://redis.io/docs/manual/patterns/)