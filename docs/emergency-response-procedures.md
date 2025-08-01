# 🚨 緊急響應程序 - Phase 3 生產環境

**創建日期**: 2025-08-01  
**版本**: v1.0  
**適用範圍**: Phase 3 生產環境部署

## 🎯 緊急響應流程概覽

### 緊急事件分級
| 級別 | 描述 | 響應時間 | 影響範圍 |
|------|------|----------|----------|
| **P0 - 嚴重** | 系統完全不可用 | 5分鐘 | 全系統 |
| **P1 - 高危** | 核心功能受影響 | 15分鐘 | 主要功能 |
| **P2 - 中等** | 性能下降明顯 | 30分鐘 | 部分功能 |
| **P3 - 低危** | 非關鍵問題 | 2小時 | 輔助功能 |

## 🚨 P0/P1 緊急響應程序

### 1. 立即行動 (0-5分鐘)
```bash
# 🔥 立即檢查系統狀態
./deployment/production-deploy.sh health

# 🔥 查看監控儀表板
node scripts/monitoring-dashboard.js health
node scripts/monitoring-dashboard.js alerts

# 🔥 檢查最近日誌
./scripts/get-app-logs.sh 50
```

### 2. 問題判斷 (5-10分鐘)
```bash
# 🎯 檢查部署狀態
node -e "
const { DeploymentStrategy } = require('./deployment/deployment-strategy.js');
const deployment = new DeploymentStrategy();
console.log('部署狀態:', deployment.getDeploymentStatus());
console.log('部署報告:', deployment.generateDeploymentReport());
"

# 🎯 檢查核心組件健康
node -e "
const { getMonitoringService } = require('./src/services/monitoringService');
const { getMonitoringMiddleware } = require('./src/middleware/monitoringMiddleware');

const monitoring = getMonitoringService();
const middleware = getMonitoringMiddleware();
const health = middleware.performHealthCheck();

console.log('系統健康狀態:', JSON.stringify(health, null, 2));
"
```

### 3. 緊急回滾決策樹
```
系統不可用? 
├─ YES → 立即執行回滾 (Step 4)
└─ NO → 部分功能受影響?
   ├─ YES → 降級服務 (Step 5) 
   └─ NO → 監控觀察 (Step 6)
```

### 4. 緊急回滾程序
```bash
# 🔄 立即回滾到上一個穩定版本
./deployment/production-deploy.sh rollback

# 🔄 使用部署策略自動回滾
node -e "
const { DeploymentStrategy } = require('./deployment/deployment-strategy.js');
const deployment = new DeploymentStrategy();
deployment.rollback('緊急回滾 - 系統不可用')
  .then(result => console.log('回滾結果:', result))
  .catch(error => console.error('回滾失敗:', error));
"

# 🔄 驗證回滾結果
./deployment/production-deploy.sh health
```

### 5. 服務降級程序
```bash
# 🎯 啟用降級模式 - 禁用非關鍵功能
export EMERGENCY_MODE=true
export DISABLE_ADVANCED_FEATURES=true
export FALLBACK_TO_SIMPLE_MODE=true

# 🎯 重啟核心服務
node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
const normalizer = getEnhancedSemanticNormalizer();
console.log('降級模式下測試:', normalizer.normalizeIntent('測試'));
"
```

## 🛠️ 常見問題快速修復

### 語義處理異常
```bash
# 問題診斷
node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
try {
  const normalizer = getEnhancedSemanticNormalizer();
  const result = normalizer.normalizeIntent('課程記錄');
  console.log('語義處理結果:', result);
} catch (error) {
  console.error('語義處理異常:', error.message);
}
"

# 緊急修復：清除緩存重新初始化
rm -rf /tmp/semantic-cache-* 2>/dev/null || true
node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
const normalizer = getEnhancedSemanticNormalizer();
console.log('重新初始化完成');
"
```

### 監控系統異常
```bash
# 問題診斷
node scripts/monitoring-dashboard.js status

# 緊急修復：重啟監控系統
node -e "
const { getMonitoringService } = require('./src/services/monitoringService');
const monitoring = getMonitoringService();
console.log('監控系統重啟完成');
"
```

### 性能急劇下降
```bash
# 問題診斷
node scripts/monitoring-dashboard.js trends

# 緊急修復：清理緩存和優化
node -e "
const { getEnhancedSemanticNormalizer } = require('./src/services/enhancedSemanticNormalizer');
const normalizer = getEnhancedSemanticNormalizer();
// 緊急清理緩存
console.log('緊急性能優化完成');
"
```

## 📞 緊急聯絡資訊

### 技術響應團隊
- **主要負責人**: Phase 3 架構師
- **監控系統負責人**: 運維團隊  
- **數據恢復負責人**: 數據團隊

### 緊急響應熱線
- **技術支援**: 24/7 可用
- **業務團隊**: 工作時間可用
- **管理層**: 重大事件通知

## 🔍 事後分析程序

### 1. 事件記錄
```bash
# 生成事件報告
node scripts/monitoring-dashboard.js export json "./logs/incident-$(date +%Y%m%d_%H%M%S).json"

# 保存部署狀態
node -e "
const { DeploymentStrategy } = require('./deployment/deployment-strategy.js');
const deployment = new DeploymentStrategy();
const fs = require('fs');
const report = deployment.generateDeploymentReport();
fs.writeFileSync('./logs/deployment-incident-report.json', JSON.stringify(report, null, 2));
console.log('事件報告已保存');
"
```

### 2. 根因分析檢查清單
- [ ] 檢查部署變更記錄
- [ ] 分析監控數據趨勢  
- [ ] 檢查外部依賴狀態
- [ ] 審查配置變更
- [ ] 檢查資源使用情況
- [ ] 分析用戶行為模式

### 3. 改善措施制定
- 識別根本原因
- 制定預防措施
- 更新監控閾值
- 改進告警規則
- 更新緊急響應程序

## 🛡️ 預防性措施

### 每日健康檢查
```bash
# 每日執行的健康檢查腳本
#!/bin/bash
echo "📊 每日健康檢查 - $(date)"
./deployment/production-deploy.sh health
node scripts/monitoring-dashboard.js health
node scripts/monitoring-dashboard.js trends
```

### 監控閾值調整
根據歷史數據調整告警閾值：
- 響應時間 > 200ms 告警
- 錯誤率 > 1% 告警  
- 內存使用 > 80% 告警
- Token 成本異常增長 > 20% 告警

### 定期演練
- **月度演練**: 模擬各種故障場景
- **季度演練**: 完整災難恢復測試
- **年度評估**: 緊急響應程序更新

## 📋 緊急響應檢查清單

### P0 事件響應清單
- [ ] 5分鐘內確認問題
- [ ] 通知相關人員
- [ ] 執行初步診斷
- [ ] 決定回滾或修復
- [ ] 執行響應行動
- [ ] 驗證修復效果
- [ ] 更新事件狀態
- [ ] 通知業務團隊

### P1 事件響應清單
- [ ] 15分鐘內評估影響
- [ ] 制定修復計劃
- [ ] 實施臨時措施
- [ ] 監控修復進度
- [ ] 驗證功能恢復
- [ ] 記錄處理過程

### 事後處理清單
- [ ] 生成事件報告
- [ ] 執行根因分析
- [ ] 制定改善措施
- [ ] 更新文檔程序
- [ ] 團隊復盤討論
- [ ] 預防措施實施

---

**文檔維護**: 每月更新一次  
**測試頻率**: 季度演練驗證  
**聯絡人更新**: 半年審查一次