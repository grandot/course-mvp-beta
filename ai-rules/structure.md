# 專案組織與開發規範

本文件說明專案的組織結構、開發流程、命名規範，以及 Claude Code 的任務執行標準。

## 📂 專案結構

### 核心目錄結構
```
/ai-rules/              # AI 助手指導文檔
├── product.md          # 產品定義：商業邏輯、功能規格、使用情境
├── tech.md             # 技術實現：架構設計、開發環境、實作細節  
└── structure.md        # 專案組織：文檔結構、開發流程、約定規範

/src/                   # 主要程式碼
├── bot/                # LINE webhook 接收與回覆邏輯
├── intent/             # 語意辨識與實體提取（語意解析模組）
├── tasks/              # 各意圖對應工具函式模組
├── services/           # API 服務封裝
├── utils/              # 通用工具函式
└── config/             # 功能開關配置

/doc/                   # 開發文檔
├── developer-guide.md  # 開發者入門指南（重要）
├── deployment-guide.md # 部署操作指南
└── technical-debt.md   # 技術債務追蹤

/spec/                  # 功能規格文檔
├── multi-dialogue/     # 多輪對話功能規格
└── ai-enhance/         # AI增強功能規格

/config/                # 配置檔案
├── mvp/                # Phase 1 當前配置
└── future/             # Phase 2+ 未來功能配置

/tools/                 # 測試與開發工具
```

### 文檔分工說明

#### 📋 `/ai-rules/` - AI 助手核心指導
- **product.md**: 商業邏輯、功能規格、使用情境
- **tech.md**: 技術架構、開發環境、實作細節
- **structure.md**: 專案組織、開發流程、約定規範

#### 📚 `/doc/` - 開發文檔
- **developer-guide.md**: 新人入門必讀，完整的開發指南
- **deployment-guide.md**: 部署操作步驟
- **technical-debt.md**: 持續維護的技術債務記錄

#### 🔬 `/spec/` - 功能規格
- 新功能的詳細規格說明
- 分階段實現的功能規劃

#### ⚙️ `/config/` - 配置管理
- **mvp/**: 當前使用的配置
- **future/**: 未來功能的配置（暫不使用）

## 🎯 開發規範

### 命名約定

#### 文件命名
- **意圖識別**: `snake_case` (動詞_名詞)
  - 範例：`add_course`, `query_schedule`, `record_content`
- **任務處理器**: `handle_[intent]_task.js`
  - 範例：`handle_add_course_task.js`
- **服務模組**: `camelCaseService.js`
  - 範例：`firebaseService.js`, `googleCalendarService.js`

#### 程式碼命名
- **函式**: `camelCase`
- **變數**: `camelCase`
- **常數**: `UPPER_SNAKE_CASE`
- **統一用詞**：
  | 概念 | 正確用詞 | 禁用詞 |
  |------|----------|---------|
  | 學生 | student, studentName | child, kid |
  | 課程 | course, courseName | lesson, class |
  | 時間 | scheduleTime | time, classTime |

### 回傳格式規範

所有任務處理器必須遵循統一格式：
```javascript
async function handle_XXX_task(slots, userId, messageEvent) {
  try {
    // 業務邏輯處理
    return { 
      success: true, 
      message: '✅ 成功訊息' 
    };
  } catch (error) {
    console.error('Error in handle_XXX_task:', error);
    return { 
      success: false, 
      message: '❌ 錯誤訊息' 
    };
  }
}
```

### 快速開發指令

```bash
# 開發環境
npm start                           # 啟動服務
npm run lint:fix                   # 修復格式
npm run dev                         # 開發模式

# 測試工具
node tools/send-test-message.js "測試訊息"     # 測試功能
node tools/test-semantic-only.js "語句"       # 語意測試
node tools/quick-test.js                      # 快速測試

# 健康檢查
curl -f http://localhost:3000/health          # 檢查服務狀態
```

## 🔧 Claude Code 任務執行標準

### 任務分類

#### A. 功能開發任務
- 新增意圖 (Intent)
- 新增任務處理器 (Task Handler)
- 整合外部 API
- 資料模型調整

#### B. 維護優化任務
- 程式碼重構
- 效能優化
- 錯誤修復
- 文件更新

#### C. 配置管理任務
- 環境變數設定
- 部署配置
- Feature Flag 調整

### 標準執行流程

#### 功能開發流程
1. **需求分析**
   - [ ] 閱讀 `/ai-rules/product.md` 確認業務邏輯
   - [ ] 確認命名符合規範
   - [ ] 列出必要的 slots（實體欄位）

2. **配置更新**
   - [ ] 編輯 `/config/mvp/intent-rules.yaml`
   - [ ] 新增意圖規則：keywords、required_slots、priority

3. **實作處理器**
   - [ ] 建立 `handle_[intent]_task.js`
   - [ ] 實作業務邏輯
   - [ ] 確保回傳格式正確

4. **測試驗證**
   - [ ] 使用 `node tools/send-test-message.js` 測試
   - [ ] 驗證意圖識別和 slots 提取
   - [ ] 確認回應符合預期

5. **文件更新**
   - [ ] 更新相關文檔
   - [ ] 記錄新增功能

#### 任務執行檢查清單

**執行前**：
- [ ] 閱讀相關文件（product.md、tech.md、developer-guide.md）
- [ ] 確認開發環境正常
- [ ] 拉取最新程式碼

**執行中**：
- [ ] 遵循命名規範
- [ ] 保持程式碼風格一致
- [ ] 適時提交進度

**執行後**：
- [ ] 執行格式檢查 (`npm run lint:fix`)
- [ ] 測試所有相關功能
- [ ] 更新相關文件
- [ ] 清理測試資料

## ⚙️ 配置管理

### Feature Flag 控制

功能開關配置位於 `src/config/features.js`：

```javascript
const FEATURES = {
  SLOT_TEMPLATE_SYSTEM: {
    enabled: false,
    phase: 'Phase 2',
    rolloutPercentage: 0,
    enabledUsers: []
  }
};

// 使用方式
const { isFeatureEnabled } = require('./config/features');
if (isFeatureEnabled('SLOT_TEMPLATE_SYSTEM')) {
  // 啟用新功能
}
```

### 配置檔案組織

#### `/config/mvp/` - 當前使用
- `intent-rules.yaml` - 意圖識別規則
- `course_management.yaml` - 課程管理場景配置  
- `firestore-collections.json` - 資料庫結構

#### `/config/future/` - 未來功能
- `slot-template-collections.json` - Slot Template 系統
- `memory-system-config.js` - 記憶系統配置

### 開發階段規劃

**Phase 1: MVP 基礎功能**（當前）
- ✅ 基礎意圖識別
- ✅ 核心課程管理功能
- ✅ Google Calendar 整合
- ✅ LINE Bot webhook

**Phase 2: 高級對話管理**（未來）
- 🔄 多輪對話狀態管理
- 🔄 Slot Template 系統
- 🔄 動態模板配置

## 🚀 開發最佳實踐

### 程式碼品質
- 使用 ESLint + Prettier 保持程式碼格式
- 遵循單一職責原則
- 避免過度設計，保持 KISS 原則
- 重要邏輯必須有錯誤處理

### 版本控制
- 提交訊息使用中文，簡潔明瞭
- 功能完整後再提交，避免零碎提交
- 重大更改前先建立分支

### 測試策略
- 新功能必須通過語意測試
- 使用 `tools/` 目錄的測試工具
- 部署前進行完整功能測試

### 文件維護
- 程式碼變更後及時更新文檔
- 重要決策記錄在對應的 `.md` 文件中
- 保持文檔的可讀性和時效性

#### CHANGELOG 與狀態板維護規則（強制）
- CHANGELOG 原則：聚焦重點、避免冗長細節；用精煉的一句話說清楚「解了什麼、帶來什麼效果」。實作細節留在 PR/設計文。
- 專案狀態板（`PROJECT_STATUS.md`）的 Done 區塊最多 5 筆；超出者移至 `doc/CHANGELOG.md` 並保留完成日期。
- 自動化腳本：
  - `npm run status:trim` 將 Done 超出部分自動移轉至 CHANGELOG 並修剪狀態板。
  - `npm run changelog:update` 依規則追加簡版條目到 CHANGELOG（避免重複）。

## 🎯 常見開發任務快速參考

### 新增意圖
1. 編輯 `config/mvp/intent-rules.yaml`
2. 建立 `src/tasks/handle_[intent]_task.js`
3. 測試：`node tools/send-test-message.js "測試語句"`

### 整合外部 API
1. 在 `src/services/` 建立服務封裝
2. 新增環境變數到 `.env`
3. 在任務處理器中使用服務

### 修復問題
1. 重現問題：使用測試工具
2. 查看日誌：`npm start` console 輸出
3. 修復並測試：確保問題解決

### 更新配置
1. 修改 `config/mvp/` 中的配置文件
2. 重啟服務載入新配置
3. 測試配置是否生效

## 📝 重要提醒

### 第一性原則思考
- 每個功能都要思考「為什麼要這樣做」
- 避免不必要的複雜性
- 專注於解決實際問題

### 技術選擇原則
- **不重複造輪子**：優先使用成熟方案
- **適合比完美重要**：選擇適合當前階段的技術
- **可維護性優先**：代碼清晰比效能更重要

### 開發心態
- **快速迭代**：MVP 階段快速驗證想法
- **用戶導向**：所有決策以用戶體驗為準
- **持續改進**：定期重構和優化

### 協作規範
- **ALWAYS RESPOND IN CHINESE**
- **THINK USING FIRST PRINCIPLES**
- **AVOID OVER-ENGINEERING**
- 優先解決當前問題，而非預測未來需求

---

本文件隨專案發展持續更新，確保與實際開發狀況同步。