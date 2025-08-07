# QA Orchestrator - 智能測試編排系統

QA Orchestrator 是 Phase 1 的核心實現，提供統一的測試接口和依賴自動化功能。

## 🎯 核心功能

### 1. 統一測試接口
- 整合本機測試 (`test-local-environment.js`)
- 整合線上測試 (`test-real-environment.js`)  
- 支援雙模式對比測試
- 自動生成結果比較報告

### 2. 依賴自動化
- 自動解析 `comprehensive-test-plan.md`
- 智能提取測試實體 (學生、課程)
- 自動構建依賴關係圖
- 生成 `test-dependencies.yaml` 配置

### 3. 智能分析 & 自動修復 🔧
- Markdown 結構解析
- 實體識別與信心度評估
- 循環依賴檢測
- 測試完整性驗證
- **🆕 自動修復依賴關係問題**
- **🆕 智能推斷孤立測試作用**
- **🆕 自動生成缺失的創建者**

## 🚀 快速開始

### 安裝依賴
```bash
# 確保已安裝所有依賴
npm install
```

### 基本使用
```bash
# 完整 QA 流程 (推薦)
npm run qa:full

# 🔧 自動修復依賴關係 (新功能!)
npm run qa:fix

# 快速驗證依賴關係 (含自動修復)
npm run qa:validate

# 僅生成依賴配置
npm run qa:config

# 執行測試 (雙模式)
npm run qa:test

# 僅本機測試
npm run qa:test:local

# 僅線上測試  
npm run qa:test:real
```

### 命令列使用
```bash
# 顯示幫助
node tools/qa-orchestrator.js --help

# 自訂測試計劃文件
node tools/qa-orchestrator.js full --test-plan ./custom-test-plan.md

# 自訂配置輸出路徑
node tools/qa-orchestrator.js config --config ./custom-dependencies.yaml

# 🔧 自動修復專用命令
node tools/qa-orchestrator.js fix
```

### ⚡ 快速示例
```bash
# 1️⃣ 檢測問題
$ npm run qa:validate
❌ 驗證失敗，發現依賴問題
   - 實體 basic_courses 被使用但沒有創建者

# 2️⃣ 自動修復  
$ npm run qa:fix
🔧 自動修復完成:
   ✅ 修復了 1 個問題
   - 將實體 basic_courses 添加到現有創建者 A1.1-A

# 3️⃣ 確認修復
$ npm run qa:validate  
✅ 驗證通過！依賴關係正確
```

## 📁 系統架構

```
qa-system/
├── core/                          # 核心組件
│   ├── UnifiedTestRunner.js       # 統一測試執行器
│   ├── MarkdownParser.js          # Markdown 解析器
│   ├── EntityExtractor.js         # 實體提取器
│   └── DependencyResolver.js      # 依賴解析器
│
├── config/                        # 配置文件
│   ├── inference-rules.yaml       # 推理規則
│   └── test-modes.yaml           # 測試模式配置
│
├── QAOrchestrator.js              # 主要編排器
└── README.md                      # 說明文件
```

## ⚙️ 配置說明

### 推理規則 (`config/inference-rules.yaml`)
定義實體識別、動作推導、命名規範等規則：
```yaml
action_rules:
  creates:
    keywords: ['新增', '創建', '建立', '安排']
    confidence: 0.9

entity_patterns:
  students:
    patterns:
      - pattern: '測試(\w+)(?=的|每|要)'
        confidence: 0.9
```

### 測試模式 (`config/test-modes.yaml`)
配置不同測試模式的行為：
```yaml
test_modes:
  local:
    name: "本機邏輯測試"
    delay_between_tests: 500
    timeout: 30000
    
  real:
    name: "真實環境測試" 
    delay_between_tests: 3000
    timeout: 60000
```

## 🔍 使用流程

### 1. 解析測試計劃
系統自動解析 `QA/comprehensive-test-plan.md`，提取：
- 測試案例 ID 和名稱
- 測試輸入和預期輸出  
- 測試目的和分組
- 明確標註 (`<!-- @creates: ... -->`)

### 2. 實體提取
對每個測試案例進行：
- 學生實體識別 (`測試小明` → `test_student_xiaoming`)
- 課程實體識別 (`測試數學課` → `test_course_math`)
- 動作識別 (`新增` → `creates`)
- 信心度評估

### 3. 依賴解析 & 自動修復 🔧
根據測試分組和實體關係：
- Group A: 創建基礎實體
- Group B: 使用 A 創建的實體
- Group C: 修改 B 的結果
- 檢測循環依賴和完整性
- **🆕 自動修復缺失的創建者**
- **🆕 智能推斷孤立測試**
- **🆕 自動生成修復建議**

### 4. 執行測試
支援三種模式：
- **本機模式**: 快速邏輯測試
- **線上模式**: 完整環境測試
- **雙模式**: 對比測試結果

## 📊 輸出結果

### 依賴配置文件
自動生成 `QA/config/test-dependencies-auto.yaml`：
```yaml
phases:
  group_a:
    name: "獨立功能測試"
    provides: ["basic_students", "basic_courses"]
    
test_groups:
  A1.1-A:
    phase: "group_a"
    creates: ["test_student_xiaoming", "test_course_math"]
    
data_entities:
  test_student_xiaoming:
    type: "student"
    created_by: ["A1.1-A"]
    used_by: ["B1.1-A", "C1.1-A"]
```

### 測試報告
生成詳細的 JSON 報告：
```json
{
  "timestamp": "2024-XX-XX",
  "mode": "both",
  "summary": {
    "totalTests": 45,
    "totalEntities": 23
  },
  "testResults": {
    "local": { "passed": 42, "failed": 3 },
    "real": { "passed": 40, "failed": 5 },
    "comparison": { "consistency": 87 }
  }
}
```

## 🛠️ 開發指南

### 擴展實體類型
修改 `core/EntityExtractor.js`：
```javascript
this.entityPatterns = {
  // 新增實體類型
  teachers: [
    /教師(\w+)/g,
    /(老師\w+)/g
  ]
};
```

### 自訂推理規則
編輯 `config/inference-rules.yaml`：
```yaml
action_rules:
  # 新增動作類型
  schedules:
    keywords: ['排課', '安排時間']
    confidence: 0.8
```

### 整合新測試工具
修改 `core/UnifiedTestRunner.js`：
```javascript
// 新增測試執行器
this.customRunner = new CustomTestRunner();
```

## 🐛 故障排除

### 常見問題

**1. 找不到測試計劃文件**
```bash
Error: ENOENT: no such file or directory 'comprehensive-test-plan.md'
```
解決: 確認文件路徑或使用 `--test-plan` 參數指定

**2. 實體提取信心度過低**
```bash
Warning: 實體提取信心度過低: 0.3
```
解決: 在測試案例中添加明確標註或改進測試輸入格式

**3. 依賴循環檢測**
```bash
Error: 發現循環依賴: A1 -> B1 -> A1
```
解決: 檢查測試分組和實體創建邏輯

### 調試模式
```bash
# 開啟詳細日誌
NODE_ENV=development npm run qa:full

# 僅驗證不執行
npm run qa:validate
```

## 🔧 自動修復功能

### 智能檢測能力
- **缺失創建者**: 識別被使用但未定義的實體
- **孤立測試**: 發現沒有依賴關係的測試案例  
- **循環依賴**: 檢測測試間的循環引用
- **跨階段依賴**: 確保依賴順序符合邏輯

### 自動修復策略
- **實體修復**: 自動為缺失實體找到或創建合適的創建者
- **測試推斷**: 根據內容推斷孤立測試的實際作用
- **依賴重構**: 自動調整測試依賴關係
- **配置生成**: 生成修復後的完整配置文件

### 使用範例
```bash
# 檢測到問題: 實體 basic_courses 被使用但沒有創建者
npm run qa:validate

# 自動修復
🔧 開始自動修復依賴關係問題...
   ✅ 修復了 1 個問題
   - 將實體 basic_courses 添加到現有創建者 A1.1-A
   📊 問題數量: 1 → 0

# 驗證修復結果
✅ 驗證通過！依賴關係正確
```

## 📈 效能指標

- **解析速度**: ~100 測試案例/秒
- **本機測試**: ~2 測試/秒  
- **線上測試**: ~1 測試/5秒 (含延遲)
- **記憶體使用**: <100MB
- **依賴分析**: <5秒
- **🆕 自動修復**: <3秒

## 🔄 版本更新

### v1.0.0 (Phase 1) - 已完成 ✅
- ✅ 統一測試接口
- ✅ 依賴自動化
- ✅ Markdown 解析
- ✅ 實體提取
- ✅ 循環依賴檢測
- ✅ **自動修復依賴關係問題**
- ✅ **智能推斷測試作用**
- ✅ **Single Source of Truth**

### 計劃中 (Phase 2)
- 🔄 Agent 輔助生成
- 🔄 自然語言驅動
- 🔄 LLM 整合

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📞 技術支援

如有問題，請檢查：
1. `qa-system/README.md` (本文件)
2. `QA/plan-QA-agent.md` (完整技術規劃)
3. 使用 `--help` 查看命令列說明