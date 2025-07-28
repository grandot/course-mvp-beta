# Slot Template System 資料遷移

本目錄包含 Slot Template System 的資料遷移腳本。

## 📁 文件說明

- `001_slot_template_setup.js` - 主要遷移腳本，設置所有必要的 Firestore 集合、索引和安全規則
- `validate-migration.js` - 驗證腳本，檢查遷移腳本的完整性和配置文件
- `README.md` - 本說明文件

## 🚀 快速開始

### 1. 前置準備

```bash
# 設定 Firebase 認證
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# 設定專案 ID
export FIREBASE_PROJECT_ID=your-project-id

# 安裝 Firebase CLI (如需要)
npm install -g firebase-tools

# 登入 Firebase (如需要)
firebase login
```

### 2. 驗證環境

```bash
# 檢查遷移腳本完整性
node scripts/migrations/validate-migration.js
```

### 3. 執行遷移

```bash
# 執行完整遷移
node scripts/migrations/001_slot_template_setup.js
```

### 4. 回滾 (僅開發環境)

```bash
# 回滾遷移 (僅限開發環境)
NODE_ENV=development node scripts/migrations/001_slot_template_setup.js rollback
```

## 📋 遷移內容

### 集合創建
- `user_slot_states` - 用戶 Slot 對話狀態
- `slot_templates` - Slot Template 配置
- `slot_execution_logs` - 執行日誌
- `slot_metrics` - 系統指標

### 索引部署
- 從 `firestore.indexes.json` 讀取索引配置
- 使用 Firebase CLI 自動部署索引

### 安全規則設定
- 自動生成 `firestore.rules` 文件
- 使用 Firebase CLI 部署安全規則
- 支援基於角色的存取控制

### 模板載入
- 從 `config/slot-templates/` 載入所有模板文件
- 支援模板版本管理
- 自動更新現有模板

### 系統配置
- 在 `system_config` 集合中設置系統參數
- 預設為停用狀態，需手動啟用

## ⚠️ 注意事項

1. **生產環境保護**: 回滾功能在生產環境中被禁用
2. **Firebase CLI 依賴**: 索引和安全規則部署需要 Firebase CLI
3. **認證要求**: 需要有效的 Firebase 服務帳號認證
4. **索引建立時間**: 首次建立索引可能需要數分鐘
5. **資料備份**: 執行遷移前建議備份現有資料

## 🔍 驗證結果

遷移完成後，您可以在 Firebase Console 中驗證：

1. **Firestore** - 檢查集合是否正確創建
2. **索引** - 確認所有索引已建立完成
3. **安全規則** - 檢查規則是否正確部署
4. **系統配置** - 查看 `system_config/slot_template` 文檔

## 🐛 故障排除

### 常見錯誤

1. **認證失敗**
   ```
   Error: Unable to detect a Project Id
   ```
   - 檢查 `GOOGLE_APPLICATION_CREDENTIALS` 環境變數
   - 確認服務帳號金鑰文件路徑正確

2. **專案 ID 未設定**
   ```
   Error: FIREBASE_PROJECT_ID 環境變數未設定
   ```
   - 設定 `FIREBASE_PROJECT_ID` 環境變數

3. **Firebase CLI 未安裝**
   ```
   ⚠️ Firebase CLI 未安裝
   ```
   - 安裝 Firebase CLI: `npm install -g firebase-tools`
   - 或手動部署索引和規則

### 手動部署

如果自動部署失敗，可以手動執行：

```bash
# 部署索引
firebase deploy --only firestore:indexes --project your-project-id

# 部署安全規則  
firebase deploy --only firestore:rules --project your-project-id
```

## 📞 支援

如果遇到問題，請檢查：
1. Firebase 專案權限設定
2. 服務帳號權限範圍
3. 網路連接狀況
4. Firebase API 配額限制