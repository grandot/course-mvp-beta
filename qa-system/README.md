# QA Orchestrator - 智能測試編排（新版）

這份文件說明新版 QA 測試流程：用「極簡人看版」寫測試卡，再用工具自動產生機器可讀用例並執行，最後輸出清楚的報告。

## 這次更新（TL;DR）
- 新增：MD 用例支援 `@expect.intent`、`@expect.quickReplyIncludes` 兩個斷言標籤（可選）。
- 新增：本機測試會檢查「意圖是否正確」與「是否包含指定 QuickReply」。
- 新增：詳細報告顯示「預期意圖」與「QuickReply 命中矩陣」。
- 更新：`QA/TEST-TEMPLATE.md` 改為「六行卡」人看版模板（主管易讀）。

> 小結：人寫「六行卡」，機器用 `@expect.*` 斷言自動判定 PASS/FAIL；報告一眼看懂差在哪。

---

## 快速開始（三步）
1) 寫用例（人看版）

把這段貼到 `QA/plans/xxx.md`，一個用例一張卡即可：

```markdown
### <ID> <標題>
測試輸入：<一句話>
我預期看到：<重點回覆/關鍵詞/快捷鈕>
實際看到：<實際回覆重點>
結論：✅/❌
怎麼修：<最小修改點，例如 `src/nlu/IntentRouter.js` 調整關鍵詞與順序；`config/mvp/intent-rules.yaml` 補同義詞>
影響面：<對使用者/流程的具體影響>
```

2)（可選）加機器斷言（讓工具能自動判定）

仍然寫在同一段用例下方，加入 `@expect.*` 標籤：

```markdown
@expect.keywords: 查詢, 課表
@expect.code: QUERY_OK
@expect.success: true
@expect.intent: query_schedule
@expect.quickReplyIncludes: 新增課程, 查下週
```

3) 生成並執行

```bash
# 由 MD 生成機器可讀用例
node tools/internal/qa/generate-from-md.js

# 跑一組套件（例：Render 健檢/對話）
node tools/render-suite.js --basic
# 或快速 5 用例/端到端
node tools/quick-suite.js --target prod
```

---

## 斷言規則（機器如何判定 PASS/FAIL）
- `@expect.keywords`：回覆需包含的關鍵詞（全部命中）
- `@expect.code`：任務代碼需等於（如 `QUERY_OK`、`ADD_COURSE_OK`）
- `@expect.success`：任務 success 布林
- `@expect.intent`（新）：實際意圖需等於（如 `query_schedule`）
- `@expect.quickReplyIncludes`（新）：回覆的 QuickReply 需包含指定按鈕（本機可驗）

計分邏輯：任一已宣告的斷言不符 → 此用例判定 ❌。

提示：線上環境目前難以直接取得 QuickReply 結構，該斷言僅在「本機測試」有效；線上報告仍會輸出回覆文字與關鍵詞命中。

---

## 報告輸出
- 詳細報告（人類可讀）：`QA/reports/detailed-test-report-*.md`
  - 逐條用例列「輸入步驟 / 期望（含預期意圖/QuickReply）/ 本機結果 / 線上結果」
  - 顯示 QuickReply 命中矩陣：每個預期按鈕標記 ✅/❌

---

## 專案結構（與本模組相關）
```
qa-system/
├── core/
│   ├── UnifiedTestRunner.js       # 統一測試執行器（已支援意圖/QuickReply 斷言與報告）
│   └── TagMarkdownParser.js       # MD 解析器（已支援 @expect.intent / @expect.quickReplyIncludes）
└── README.md                      # 本說明
```

`tools/internal/qa/generate-from-md.js`：將 `QA/plans/*.md` 解析為可執行用例，輸出至 `tools/suites/*/cases/generated/`。

---

## FAQ（常見問題）
- Q：我不想在 MD 放任何機器標籤，只寫六行卡可以嗎？
  - A：可以。只是不加斷言時，工具只能做關鍵詞/語義的寬判定，建議至少加 `@expect.keywords`。  
- Q：為何線上測不到 QuickReply？
  - A：LINE 回覆結構在雲端日誌難以完整取回，目前僅本機能讀到結構；線上仍會用文字與代碼判定。
- Q：想擴充更多斷言？
  - A：可按這次模式在 `TagMarkdownParser.js` 增欄位、在 `UnifiedTestRunner.js` 加比對與報告欄位。

---

## 版本記事（本次改動）
- Parser：支援 `@expect.intent`、`@expect.quickReplyIncludes`
- Runner：本機加入意圖/QuickReply 斷言；詳細報告加入預期意圖與 QuickReply 命中矩陣
- Template：`QA/TEST-TEMPLATE.md` 換為六行卡（人看版）
