## 專案：LINE 課程管理機器人

使用 LINE 對話記錄管理課程，採用意圖識別架構。  
核心流程：LINE Bot → parseIntent（Regex 精準過濾/抽取 → 失敗或歧義 → OpenAI 語意辨識 Fallback）→ extractSlots → handle_XXX_task → Google Calendar + Firebase

- Regex 原則：高精度、窄範圍，只處理明確關鍵詞與簡單實體，保留模糊語義給 AI；每個意圖的 Regex 規則 ≤ 3 條

- Fallback 觸發：未命中、多重命中、缺關鍵實體、規則矛盾時，改用 OpenAI 語意辨識

- Google Calendar 處理時間邏輯

- Firebase 處理業務資料

---

## 快速開始

```bash
npm start          # 啟動服務
npm run lint:fix   # 修復格式
node tools/send-test-message.js "測試訊息"  # 測試功能
```

---

## 命名與用詞規範

- **意圖**：`snake_case`

- **函式**：`handle_XXX_task()`

- **變數**：`camelCase`

- **用詞統一**：student / course / scheduleTime（禁用 child / lesson / time）

- **回傳格式**：`{ success: boolean, message: string }`

- **衝突處理**：以 `/doc/technical.md` 第8節為準

---

## 架構遵循原則（Architecture Compliance Rules）

- 架構層已凍結，除非明確接到指示修改架構，不可自行改動模組邊界與責任分工

- **Google Calendar**：唯一時間邏輯運算層，所有時間計算、驗證、轉換必須經由它

- **Firebase**：唯一業務資料儲存層，不可直接繞過操作底層資料庫

- **資料流路徑**：`LINE Bot → parseIntent → extractSlots → handle_XXX_task → (Google Calendar / Firebase)`

- 違反上述規則前，必須先提出架構變更提案（影響範圍、理由、風險、回滾方案）

---

## 任務模式規範

> 根據任務類型，自動套用對應流程與約束。

### 1. Bug 修復模式

- **先診斷**：列出重現步驟、錯誤訊號、影響檔案（含行號）、3 個根因假說

- **再規劃**：提出最小修復方案（檔案 ≤ 2，diff ≤ 60 行）

- **驗收**：修改後重跑對比、附回滾指令與副作用

- 禁止重構、新增抽象層、引入第三方依賴

### 2. 功能開發模式

- 提交功能設計方案（需求 → 資料流 → 模組接口）

- 可新增檔案與模組，但需列出影響範圍與依賴變更

- 附單元測試與至少一個整合測試

### 3. 重構優化模式

- 列出現有問題與重構目標

- 提交影響分析（功能、性能、依賴）

- 制定回滾計畫與測試覆蓋清單

### 4. 測試撰寫模式

- 覆蓋正常、邊界、錯誤三類情境

- 測試命名與描述需清楚對應功能模組

- 遵循現有測試框架與資料夾結構

---

## 通用原則

- 僅用中文與我對話

- 優先選擇最簡單、直接、可驗證的解法

- 從用戶角度思考，不被技術細節帶偏

- 快速開發優先，避免過度設計

- 遇到問題時用第一性原則思考

- **執行任何改動前，先檢查現有架構與可用工具（如 Log 抓取、自動化測試等），優先利用現有資源解決問題**

---

## 相關文檔

- `/ai-rules/product.md` - 商業邏輯、功能規格、使用情境

- `/ai-rules/tech.md` - 架構設計、開發環境、實作細節（含環境限制）

- `/ai-rules/structure.md` - 文檔結構、開發流程、約定規範

- `/doc/developer-guide.md` - 新人開發指南

- `/doc/deployment-guide.md` - 部署步驟

- `/doc/technical-debt.md` - 技術債務追蹤

- `/spec/multi-dialogue/` - 多輪對話規格

- `/spec/ai-enhance/` - AI 增強規格

- `/config/README.md` - 配置管理

- `/PROJECT_STATUS.md` - 專案進度追蹤

- `/AI_TASK_CONTEXT.md` - AI 上下文摘要