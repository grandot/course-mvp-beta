# IntentOS - 多場景智能管理平台

Template-Based 多場景業務平台，支持課程管理、長照系統、保險業務等多種場景。

## 架構

```
用戶自然語言 → 語義處理層 → Scenario Layer → EntityService → 統一格式回覆
```

### 核心組件
- **Scenario Layer**: 業務邏輯模板，支持多場景切換
- **SemanticService**: 語義處理統一入口
- **EntityService**: 通用實體 CRUD 操作
- **TimeService**: 時間處理統一入口
- **TaskService**: 場景委託協調

### 技術棧
- LINE Bot + Express.js + OpenAI GPT-3.5
- Firebase Firestore + YAML 配置
- 環境變數控制場景切換

### 架構特色
- ✅ ScenarioTemplate 抽象基類：統一業務接口
- ✅ TaskService 委託架構：純委託模式
- ✅ 強制邊界約束：Single Source of Truth

## 已完成功能

### 核心功能
- ✅ 多場景支持：課程管理、長照系統、保險業務
- ✅ 自然語言處理：智能語義識別和意圖提取
- ✅ 統一時間格式：MM/DD HH:MM AM/PM
- ✅ 配置驅動：YAML 場景配置和業務規則
- ✅ 成本監控：Token 使用統計和管理後台
- ✅ 多輪對話資訊補齊
- ✅ 衝突檢測：時間衝突自動檢測

## 待開發功能

### 短期 (v10.0)
- 🔄 重複課程：週期性課程管理
- 🔄 多角色
- 🔄 提醒系統：課前、課中、課後提醒



### 中期 (v11.0)
- 🔄 AI 模板生成：智能場景模板提案
- 🔄 多語言支持：國際化架構
- 🔄 高級分析：使用模式分析和優化建議

### 長期 (v12.0+)
- 🔄 企業級功能：多租戶、權限管理
- 🔄 生態系統：第三方集成、API 開放平台
- 🔄 智能進化：語音交互、圖像識別