#!/bin/bash

echo "🧹 開始清理專案檔案，為重構做準備..."

# 檢查 Git 狀態
if ! git status --porcelain | grep -q .; then
    echo "✅ Git 工作目錄乾淨"
else
    echo "⚠️  發現未提交的變更，請先提交或暫存"
    git status --short
    echo "請先處理未提交的變更，然後重新執行腳本"
    exit 1
fi

# 備份當前 main 分支
echo "📦 備份當前 main 分支..."
git checkout -b backup-main-$(date +%Y%m%d-%H%M%S)
git push origin backup-main-$(date +%Y%m%d-%H%M%S)
echo "✅ 已建立備份分支並推送到遠端"

# 回到 main 分支
git checkout main

# 建立備份目錄
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 建立備份目錄: $BACKUP_DIR"

# 備份重要檔案
echo "💾 備份重要檔案..."
cp .env "$BACKUP_DIR/" 2>/dev/null || echo "⚠️  .env 檔案不存在"
cp package.json "$BACKUP_DIR/"
cp package-lock.json "$BACKUP_DIR/"
cp .gitignore "$BACKUP_DIR/"
cp firestore.indexes.json "$BACKUP_DIR/"
cp .eslintrc.js "$BACKUP_DIR/"
cp .prettierrc "$BACKUP_DIR/"

# 備份配置檔案
mkdir -p "$BACKUP_DIR/src/config"
cp src/config/production.js "$BACKUP_DIR/src/config/" 2>/dev/null || echo "⚠️  production.js 不存在"

# 備份自定義工具
cp -r eslint-plugin-local "$BACKUP_DIR/" 2>/dev/null || echo "⚠️  eslint-plugin-local 不存在"
cp -r eslint-rules "$BACKUP_DIR/" 2>/dev/null || echo "⚠️  eslint-rules 不存在"

echo "✅ 備份完成！重要檔案已備份到: $BACKUP_DIR"

# 刪除可以重構的檔案和目錄
echo "🗑️  開始刪除可重構的檔案..."

# 刪除程式碼目錄
rm -rf src/
rm -rf scripts/
rm -rf tests/

# 刪除文檔目錄
rm -rf docs/
rm -rf specs/

# 刪除測試和範例
rm -rf test-*/
rm -rf tests/
rm -rf examples/
rm -rf coverage/

# 刪除記憶體檔案
rm -rf memory/

# 刪除日誌檔案
rm -f server.log
rm -f *.log

# 刪除文檔檔案
rm -f README.md
rm -f CHANGELOG.md
rm -f CLAUDE.md
rm -f ARCHITECTURE_CONFLICTS.md
rm -f DEBUG_LOG_MANAGEMENT.md
rm -f REFACTOR_PLAN_ATOMIC.md
rm -f SCENARIO_LAYER_REFACTOR_PLAN.md
rm -f 待處理.md

# 刪除測試檔案
rm -f test-context-fix.js
rm -f check_storage.js

# 刪除系統檔案
rm -f .DS_Store

# 刪除 node_modules (會重新安裝)
rm -rf node_modules/

echo "✅ 清理完成！"

# 還原重要配置檔案
echo "🔄 還原重要配置檔案..."

# 還原環境配置
if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" .
    echo "✅ 還原 .env"
fi

# 還原 package.json 和 package-lock.json
cp "$BACKUP_DIR/package.json" .
cp "$BACKUP_DIR/package-lock.json" .
echo "✅ 還原 package.json 和 package-lock.json"

# 還原 Git 配置
cp "$BACKUP_DIR/.gitignore" .
echo "✅ 還原 .gitignore"

# 還原 Firestore 索引
cp "$BACKUP_DIR/firestore.indexes.json" .
echo "✅ 還原 firestore.indexes.json"

# 還原 ESLint 和 Prettier 配置
cp "$BACKUP_DIR/.eslintrc.js" .
cp "$BACKUP_DIR/.prettierrc" .
echo "✅ 還原 ESLint 和 Prettier 配置"

# 還原生產環境配置
mkdir -p src/config
cp "$BACKUP_DIR/src/config/production.js" src/config/ 2>/dev/null || echo "⚠️  無法還原 production.js"

# 還原自定義工具
if [ -d "$BACKUP_DIR/eslint-plugin-local" ]; then
    cp -r "$BACKUP_DIR/eslint-plugin-local" .
    echo "✅ 還原 eslint-plugin-local"
fi

if [ -d "$BACKUP_DIR/eslint-rules" ]; then
    cp -r "$BACKUP_DIR/eslint-rules" .
    echo "✅ 還原 eslint-rules"
fi

echo ""
echo "✅ 清理和還原完成！"

# Git 操作
echo "📝 記錄 Git 變更..."
git add .
git commit -m "🔧 重構準備：清理程式碼和文檔，保留環境配置

- 刪除所有程式碼檔案 (src/, scripts/, tests/)
- 刪除所有文檔 (docs/, specs/, *.md)
- 刪除測試和範例檔案
- 刪除記憶體檔案和日誌
- 保留環境配置檔案 (.env, package.json, firestore.indexes.json)
- 保留自定義工具 (eslint-plugin-local, eslint-rules)
- 備份位置: $BACKUP_DIR

準備開始全新重構"

echo "✅ Git 提交完成！"

echo ""
echo "📋 保留的檔案："
echo "  - .env (環境變數)"
echo "  - package.json (專案配置)"
echo "  - package-lock.json (依賴鎖定)"
echo "  - .gitignore (Git 忽略規則)"
echo "  - firestore.indexes.json (資料庫索引)"
echo "  - .eslintrc.js (ESLint 配置)"
echo "  - .prettierrc (Prettier 配置)"
echo "  - eslint-plugin-local/ (自定義 ESLint 插件)"
echo "  - eslint-rules/ (自定義 ESLint 規則)"
echo "  - src/config/production.js (生產環境配置)"
echo ""
echo "📦 備份位置: $BACKUP_DIR"
echo ""
echo "🌿 Git 分支狀態："
echo "  - main: 重構版本（當前分支）"
echo "  - backup-main-*: 原始版本備份"
echo ""
echo "🚀 現在可以開始重構了！"
echo "💡 提示：執行 'npm install' 重新安裝依賴" 