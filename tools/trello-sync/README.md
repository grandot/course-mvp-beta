# Trello 同步工具

集中所有 Trello 相關腳本。核心目標：
- 用 `[uid:xxxxxxxx]` 做唯一身分（與標題解耦）。
- 從 `PROJECT_STATUS.md` 推送（push）或從 Trello 拉回（pull）。
- 支援清空卡片再全量同步、列表篩選、乾跑、標籤（可選）。

## 目錄

- `trello-sync.js`：MD ↔ Trello 同步（push/pull/merge-duplicates）
- `status-uid.js`：為 `PROJECT_STATUS.md` 條目補 `[uid:xxxxxxxx]`
- `trello-webhook-server.js`：Webhook 事件收集（可選）
- `register-trello-webhook.js`：註冊 Trello Webhook（可選）

## 快速開始（終端機直接輸入）

- 全量推送（MD → Trello 五列表）：
```bash
./bin/trello:push
```

- 全量拉回（Trello → MD；會覆蓋 MD）：
```bash
./bin/trello:pull
```

- 只同步 Doing/Done：
```bash
node tools/trello-sync/trello-sync.js --lists=Doing,Done
```

- 先刪除所有卡再全量推送（保留列表；危險操作）：
```bash
./bin/trello:push --purge --purge-concurrency=12
```

可直接執行（本機已加入 PATH）：
```bash
trello:push
trello:pull
```

其他環境若未加入 PATH，可參考：
```bash
# 臨時（當前視窗有效）
export PATH="$PATH:$(pwd)/bin"

# 或永久加入（請把 /absolute/path/to/repo 換成你的專案絕對路徑）
echo 'export PATH="$PATH:/absolute/path/to/repo/bin"' >> ~/.zshrc
source ~/.zshrc
```

## 參數與功能

- `--lists=...`：僅同步指定列表（逗號分隔）。
- `--purge`：推送前刪除目標列表的所有卡片（非封存，保留列表）。
- `--purge-concurrency=<N>`：刪卡並行度（1~16，預設 8）。
- `--dry-run`：僅輸出即將執行的動作，不寫 Trello。
- `--labels`：啟用 `[P1][Feature]` 等標籤自動化（也可用環境變數 `ENABLE_TRELLO_LABELS=true`）。
- `--enhanced`：啟用附件與 checklist 雙向同步（也可用環境變數 `ENABLE_TRELLO_ENHANCED=true`）。
- `--mode=pull`：改為拉回模式（Trello → MD）。
- `--merge-duplicates`：依 UID 合併重複卡（保留最早活動卡，封存其餘）。

## 同步規則（重點）

- 卡片唯一身分：Description 首行 `uid:xxxxxxxx`（支援 8 或 12 碼）。
- 推送時：
  - 找到相同 UID 的卡 → 若在錯誤列表則移動 → 標題以 MD 為準（去掉技術標記） → 更新描述表頭（uid/source/syncedAt）與 `ref: spec/...`（若 MD 有）。
  - 找不到 → 依 MD 建立新卡，補上描述表頭。
  - **增強功能（`--enhanced`）**：同步 MD 中的附件和 checklist 到 Trello 卡片。
- 拉回時：
  - 直接用 Trello 卡名覆蓋 `PROJECT_STATUS.md` 對應區塊（請先確定不要保留本地修改）。
  - **自動包含**：Trello 卡片中的附件和 checklist 會自動格式化到 MD 中。

## 增強功能：附件與 Checklist 同步

### MD 格式規範
```markdown
### Doing
- 主要任務標題 [uid:abc12345]
  - 📎 [設計稿.png](https://example.com/design.png)
  - 📎 [需求文檔.pdf](https://example.com/requirement.pdf)
  - 任務列表1
    - 子任務1
    - 子任務2
  - 檢查列表
    - 檢查項目A
    - 檢查項目B
```

### 功能說明
- **Push 模式（MD → Trello）**：需要 `--enhanced` 參數才會同步附件和 checklist
- **Pull 模式（Trello → MD）**：總是包含 Trello 中已存在的附件和 checklist
- **附件格式**：`- 📎 [filename](url)`
- **Checklist 格式**：
  - Checklist 名稱：`- 任務列表名稱`
  - Checklist 項目：`  - 項目名稱`（兩個空格縮排）

### 使用範例
```bash
# 啟用增強功能推送
./bin/trello:push --enhanced

# 使用環境變數
ENABLE_TRELLO_ENHANCED=true ./bin/trello:push

# 拉回時自動包含附件和 checklist（無需額外參數）
./bin/trello:pull
```

### 資料檔案
- UID 映射：`tools/trello-sync/PROJECT_STATUS.uidmap.json`（僅此一份；根目錄舊檔已淘汰）

## Webhook（可選）

- 啟動：`node tools/trello-sync/trello-webhook-server.js`
- 設定： `.env` 需含 `TRELLO_APP_SECRET` 與 `TRELLO_WEBHOOK_CALLBACK_URL`
- 產出：`reports/trello-webhook-events.ndjson`
- 註冊：`node tools/trello-sync/register-trello-webhook.js`

---

如需新增子工具，請放在本目錄並在此 README 補上用法。保持介面一致：終端機直接輸入即可，不強制透過 npm script。


