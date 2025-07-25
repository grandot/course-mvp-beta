# Changelog

All notable changes to this project will be documented in this file.

## [Phase 0] - 2025-07-25

### 🚀 專案初始化
- 建立 IntentOS Course MVP 專案骨架
- 設定 Node.js 20+ 開發環境
- 採用三層語義架構設計理念

### 📦 依賴管理
- 配置 `package.json` 含完整開發工具鏈
- 整合 Jest 測試框架
- 整合 ESLint + Prettier 程式碼品質工具
- 設定 Express.js 作為核心框架

### 🔧 開發工具配置
- **ESLint**: 採用 Airbnb Base 規則集
- **Prettier**: 統一程式碼格式化標準
- **Jest**: 測試框架配置，支援空測試通過
- **Git**: 初始化版本控制，建立 .gitignore

### 🏗️ 專案結構
```
├── src/                    # 原始碼目錄（預留）
├── .github/workflows/      # CI/CD 自動化
├── package.json           # 專案配置
├── .eslintrc.js          # ESLint 規則
├── .prettierrc           # Prettier 配置
├── jest.config.js        # Jest 測試配置
├── CLAUDE.md             # 專案架構文檔
├── README.md             # 專案說明
└── .gitignore            # Git 忽略規則
```

### ⚡ CI/CD 自動化
- **GitHub Actions**: 自動化 CI 流程
- **自動檢查**: ESLint 程式碼品質
- **自動測試**: Jest 單元測試執行
- **觸發條件**: push 到 main/develop 分支或 PR

### 📋 NPM Scripts
```bash
npm run dev         # 開發模式（預留）
npm test           # Jest 測試執行
npm run lint       # ESLint 程式碼檢查
npm run lint:fix   # ESLint 自動修正
npm run prettier   # Prettier 格式化
```

### 🎯 階段目標達成
- ✅ 建立乾淨的專案骨架
- ✅ 零業務程式碼，純開發環境
- ✅ CI/CD 流程就緒
- ✅ 程式碼品質工具配置完成
- ✅ GitHub 遠端倉庫建立
- ✅ 所有檢查通過（lint + test）

### 📚 技術債務
- `src/` 目錄為空，等待下階段業務邏輯實現
- 環境變數 `.env` 已配置但未整合到應用程式中
- 三層語義架構設計文檔已完成，待實作

---

**Next Phase**: 開始實現三層語義架構的核心服務層