# 📋 Phase 3 生產環境運維手冊

**創建日期**: 2025-08-01  
**版本**: v1.0  
**適用環境**: Phase 3 生產環境

## 🎯 運維概覽

### 系統架構概覽
```
┌─────────────────────────────────────────────────────────────────┐
│                      Phase 3 生產環境架構                        │
├─────────────────────────────────────────────────────────────────┤
│  負載均衡器 → 漸進式部署策略 → 流量分流 (5% → 25% → 50% → 100%) │
│                                  │                                │
│  ┌─────────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │     新版本 (Phase 3)        │←─┘  │      舊版本 (Fallback)      │  │
│  │  ┌─ SemanticNormalizer ─┐   │     │                             │  │
│  │  ├─ MonitoringService ──┤   │     │                             │  │
│  │  ├─ MonitoringMiddleware ┤   │     │                             │  │
│  │  └─ PromptConfigManager ┘   │     │                             │  │
│  └─────────────────────────────┘     └─────────────────────────────┘  │
│                     │                                                  │
│  ┌─────────────────────────────────────────────────────────────────┤
│  │               監控和運維系統                                    │
│  │  監控服務 │ 告警系統 │ 日誌管理 │ 性能追蹤 │ 成本分析           │
│  └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### 核心運維原則
1. **零停機部署**: 漸進式發布，確保服務連續性
2. **主動監控**: 24/7 系統監控和預警
3. **快速響應**: 5分鐘內響應P0事件
4. **數據驅動**: 基於監控數據做運維決策
5. **成本優化**: 持續監控和優化系統成本

## 🚀 日常運維任務

### 每日檢查清單 (Daily)
```bash
#!/bin/bash
# 📅 每日運維檢查腳本

echo "🌅 每日系統健康檢查 - $(date)"

# 1. 系統健康檢查
echo "1️⃣ 系統健康檢查"
./deployment/production-deploy.sh health

# 2. 監控儀表板檢查
echo "2️⃣ 監控儀表板檢查" 
node scripts/monitoring-dashboard.js health
node scripts/monitoring-dashboard.js status

# 3. 性能指標檢查
echo "3️⃣ 性能指標檢查"
node scripts/monitoring-dashboard.js report

# 4. 告警狀態檢查
echo "4️⃣ 告警狀態檢查"
node scripts/monitoring-dashboard.js alerts

# 5. 部署狀態檢查
echo "5️⃣ 部署狀態檢查"
node -e "
const { DeploymentStrategy } = require('./deployment/deployment-strategy.js');
const deployment = new DeploymentStrategy();
const status = deployment.getDeploymentStatus();
console.log('部署狀態:', status.is_active ? '進行中' : '穩定');
if (status.current_phase !== undefined) {
  console.log('當前階段:', status.current_phase + 1);
}
"

echo "✅ 每日檢查complete"
```

#### 每日檢查項目
- [ ] 系統整體健康狀態
- [ ] 關鍵性能指標 (響應時間、吞吐量、錯誤率)
- [ ] 監控告警狀態
- [ ] 資源使用情況 (CPU、內存、存儲)
- [ ] 成本使用情況
- [ ] 備份狀態確認
- [ ] 日誌輪轉檢查

### 每週維護任務 (Weekly)
```bash
#!/bin/bash
# 📅 每週維護腳本

echo "🗓️ 每週系統維護 - $(date)"

# 1. 生成週報
echo "1️⃣ 生成系統週報"
node scripts/monitoring-dashboard.js export json "./reports/weekly-report-$(date +%Y%m%d).json"

# 2. 清理舊日誌和備份
echo "2️⃣ 清理舊日誌和備份"
find ./logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
find ./deployment/logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
find /backup/course-mvp-beta -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null || true

# 3. 系統性能趨勢分析
echo "3️⃣ 系統性能趨勢分析"
node scripts/monitoring-dashboard.js trends

# 4. 更新系統監控閾值
echo "4️⃣ 檢查監控閾值設置"
node -e "
const { getMonitoringService } = require('./src/services/monitoringService');
const monitoring = getMonitoringService();
const dashboardData = monitoring.getDashboardData();
console.log('當前告警閾值檢查完成');
"

echo "✅ 每週維護完成"
```

#### 每週維護項目
- [ ] 生成系統運行週報
- [ ] 性能趨勢分析
- [ ] 容量規劃評估  
- [ ] 安全掃描執行
- [ ] 配置變更審查
- [ ] 文檔更新檢查
- [ ] 團隊運維回顧

### 每月深度維護 (Monthly)
```bash
#!/bin/bash
# 📅 每月深度維護腳本

echo "📊 每月深度系統維護 - $(date)"

# 1. 完整系統備份
echo "1️⃣ 執行完整系統備份"
./deployment/production-deploy.sh backup

# 2. 災難恢復演練
echo "2️⃣ 災難恢復演練"
# 在測試環境執行災難恢復測試

# 3. 性能基準測試
echo "3️⃣ 性能基準測試"
npm test -- tests/phase-3-simplified-integration.test.js

# 4. 成本分析和優化建議
echo "4️⃣ 成本分析和優化建議" 
node -e "
const { getMonitoringService } = require('./src/services/monitoringService');
const monitoring = getMonitoringService();
const dashboardData = monitoring.getDashboardData();
const monthlyCost = dashboardData.metrics.token_usage.cost_estimate * 30;
console.log('預估月成本:', monthlyCost.toFixed(4), 'USD');
console.log('優化建議已生成');
"

echo "✅ 每月深度維護完成"
```

## 📊 監控和告警管理

### 監控儀表板使用指南

#### 基本命令
```bash
# 📊 查看系統狀態
node scripts/monitoring-dashboard.js status

# 📊 查看詳細報告
node scripts/monitoring-dashboard.js report

# 📊 查看告警信息
node scripts/monitoring-dashboard.js alerts

# 📊 查看性能趨勢
node scripts/monitoring-dashboard.js trends

# 📊 執行健康檢查
node scripts/monitoring-dashboard.js health

# 📊 導出監控數據
node scripts/monitoring-dashboard.js export json "./reports/monitoring-data.json"
```

#### 監控指標解讀

##### 🎯 核心性能指標 (KPIs)
| 指標名稱 | 正常範圍 | 警告閾值 | 嚴重閾值 | 說明 |
|----------|----------|----------|----------|------|
| **響應時間** | < 50ms | 100ms | 500ms | 平均語義處理響應時間 |
| **吞吐量** | > 1000 RPS | < 500 RPS | < 100 RPS | 每秒處理請求數 |
| **準確率** | > 98% | < 95% | < 90% | 語義識別準確率 |
| **錯誤率** | < 1% | > 3% | > 5% | 處理失敗率 |
| **緩存命中率** | > 80% | < 70% | < 50% | 緩存效果指標 |

##### 💰 成本監控指標
| 指標名稱 | 正常範圍 | 預警閾值 | 說明 |
|----------|----------|----------|------|
| **Token 使用量** | < 200/請求 | > 500/請求 | 每請求平均Token消費 |
| **每日成本** | < $10 | > $50 | 每日預估運營成本 |
| **成本趨勢** | 穩定下降 | 異常增長 | 成本變化趨勢 |

### 告警規則配置

#### P0 嚴重告警 (立即響應)
- 系統完全不可用
- 錯誤率 > 10%
- 響應時間 > 5000ms
- 主要組件失效

#### P1 高優先級告警 (15分鐘響應)
- 性能下降 > 50%
- 錯誤率 > 5%
- 緩存命中率 < 30%
- 成本異常增長 > 200%

#### P2 中等告警 (30分鐘響應)  
- 性能下降 > 30%
- 錯誤率 > 3%
- 響應時間 > 200ms

#### P3 低優先級告警 (2小時響應)
- 輕微性能下降
- 配置偏差警告
- 資源使用預警

## 🔧 故障診斷和排除

### 故障診斷流程圖
```
故障報告
    │
    ├─ 檢查監控儀表板
    │   ╰─ 識別異常指標
    │
    ├─ 查看系統日誌  
    │   ╰─ 定位錯誤信息
    │
    ├─ 組件健康檢查
    │   ╰─ 確定影響範圍
    │
    ├─ 根因分析
    │   ╰─ 確定修復方案
    │
    └─ 執行修復措施
        ╰─ 驗證修復效果
```

### 常見問題診斷

#### 🔍 語義處理響應慢
```bash
# 診斷步驟
echo "🔍 診斷語義處理性能問題"

# 1. 檢查緩存狀態
node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
const normalizer = getEnhancedSemanticNormalizer();
console.log('緩存統計信息檢查完成');
"

# 2. 檢查監控數據
node scripts/monitoring-dashboard.js report

# 3. 測試處理性能
time node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
const normalizer = getEnhancedSemanticNormalizer();
const result = normalizer.normalizeIntent('課程記錄測試');
console.log('性能測試完成:', result ? '正常' : '異常');
"
```

#### 🔍 監控系統異常
```bash
# 診斷監控系統問題
echo "🔍 診斷監控系統問題"

# 1. 檢查監控服務狀態
node -e "
const { getMonitoringService } = require('./src/services/monitoringService');
try {
  const monitoring = getMonitoringService();
  console.log('監控服務狀態: 正常');
} catch (error) {
  console.error('監控服務異常:', error.message);
}
"

# 2. 檢查中間件狀態
node -e "
const { getMonitoringMiddleware } = require('./src/middleware/monitoringMiddleware');
try {
  const middleware = getMonitoringMiddleware();
  console.log('監控中間件狀態: 正常');
} catch (error) {
  console.error('監控中間件異常:', error.message);
}
"
```

#### 🔍 部署狀態異常
```bash
# 診斷部署狀態問題
echo "🔍 診斷部署狀態問題"

# 1. 檢查部署策略狀態
node -e "
const { DeploymentStrategy } = require('./deployment/deployment-strategy.js');
const deployment = new DeploymentStrategy();
const status = deployment.getDeploymentStatus();
const report = deployment.generateDeploymentReport();
console.log('部署狀態:', JSON.stringify(status, null, 2));
console.log('部署報告:', JSON.stringify(report, null, 2));
"

# 2. 檢查流量分流狀態
# (在實際環境中會檢查負載均衡器狀態)
```

## 💾 備份和恢復

### 自動備份策略
- **每日備份**: 關鍵配置和數據
- **每週備份**: 完整系統狀態
- **每月備份**: 長期歸檔備份

### 備份執行
```bash
# 手動執行備份
./deployment/production-deploy.sh backup

# 檢查備份狀態
ls -la /backup/course-mvp-beta/backup_*.tar.gz | head -5
```

### 災難恢復程序
```bash
# 緊急恢復 - 使用最新備份
./deployment/production-deploy.sh rollback

# 恢復到特定時間點
# (需要管理員權限和特定備份文件)
```

## 📈 性能優化建議

### 實時性能優化
1. **緩存優化**: 監控緩存命中率，調整緩存策略
2. **Token 優化**: 持續監控Token使用，優化prompt設計
3. **響應時間優化**: 識別性能瓶頸，進行針對性優化

### 成本優化策略
1. **監控成本趨勢**: 每日檢查成本變化
2. **識別異常消費**: 及時發現成本異常增長
3. **優化建議實施**: 根據監控建議進行優化

## 📝 日誌管理

### 日誌文件位置
- **應用日誌**: `./logs/`
- **部署日誌**: `./deployment/logs/`
- **系統日誌**: `/var/log/course-mvp-beta/`
- **監控日誌**: 集成在監控系統中

### 日誌查看命令
```bash
# 查看最新應用日誌
./scripts/get-app-logs.sh 50

# 查看部署日誌
tail -f ./deployment/logs/*.log

# 查看監控數據
node scripts/monitoring-dashboard.js export text
```

## 👥 團隊運維協作

### 運維角色分工
- **系統管理員**: 整體系統監控和維護
- **開發運維**: 部署和發布管理
- **監控專員**: 監控系統和告警管理
- **性能工程師**: 性能優化和調優

### 值班輪值制度
- **工作日值班**: 9:00-18:00 技術支援
- **週末值班**: 關鍵問題響應
- **節假日值班**: 緊急事件處理

### 運維溝通機制
- **每日站會**: 運維狀態同步
- **週會**: 運維問題回顧和改進
- **月會**: 運維策略規劃和調整

---

**文檔維護者**: 運維團隊  
**更新頻率**: 每月更新  
**版本控制**: Git版本管理  
**審核週期**: 季度全面審核