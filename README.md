# IntentOS Course MVP

IntentOS 課程管理 MVP 系統 - 三層語義架構設計

## 快速開始

### 本地安裝

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 執行測試
npm test

# 檢查程式碼風格
npm run lint

# 自動修正程式碼風格
npm run lint:fix
```

### CI 驗證

此專案使用 GitHub Actions 自動執行：
- ESLint 程式碼檢查
- Jest 單元測試

推送到 `main` 或 `develop` 分支時會自動觸發 CI 流程。

## 專案結構

```
├── src/                    # 原始碼目錄（空）
├── .github/workflows/      # CI/CD 配置
├── package.json           # 專案配置
├── .eslintrc.js          # ESLint 規則
├── .prettierrc           # Prettier 格式化規則
└── jest.config.js        # Jest 測試配置
```

## 開發規範

- 使用 Airbnb ESLint 規則
- Node.js 20+ 版本
- CommonJS 模組系統
- Jest 測試框架