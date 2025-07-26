# AI驅動的Template模式設計方案

## 🧠 核心理念：AI優先，配置輔助

你說得對！硬編碼YAML違背了**AI語義辨識**的初衷。讓我們設計一個**AI優先**的Template模式：

- **AI負責**：意圖識別、實體提取、語義理解
- **配置負責**：業務領域定義、回應模板、數據結構

## 🎯 當前系統AI能力分析

### ✅ 已有的AI語義能力
```javascript
// 當前的 OpenAI 分析流程
const prompt = `
分析以下用戶輸入，識別課程管理相關的意圖和實體：
用戶輸入: "${text}"

請以 JSON 格式回應：
{
  "intent": "意圖類型 (record_course, cancel_course, query_schedule...)",
  "confidence": "信心度 (0.0-1.0)",
  "entities": { ... },
  "reasoning": "分析理由"
}
`;
```

**問題**：Prompt硬編碼了"課程管理"領域！

## 🚀 AI驅動的Template方案

### 1. 動態業務領域注入

不再硬編碼"課程管理"，而是動態注入業務領域：

```javascript
/**
 * AI模板引擎 - 動態生成AI分析Prompt
 */
class AITemplateEngine {
  static currentDomain = null;
  
  // 載入業務領域配置
  static loadDomain(domainConfig) {
    this.currentDomain = domainConfig;
  }
  
  // 動態生成AI分析Prompt
  static generateAnalysisPrompt(userText, userId) {
    const domain = this.currentDomain;
    
    return `
你是一個${domain.name}助手，專門幫助用戶分析${domain.description}相關的自然語言輸入。

業務領域：${domain.name}
主要實體：${domain.entities.primary}
可能的操作：${domain.actions.join(', ')}

用戶輸入: "${userText}"
用戶ID: ${userId}

請分析用戶意圖，識別相關實體。以 JSON 格式回應：
{
  "intent": "用戶意圖（基於${domain.name}業務）",
  "confidence": "信心度 (0.0-1.0)",
  "entities": {
    "${domain.entities.primary}": "主要實體名稱",
    "time": "時間信息",
    "date": "日期信息",
    "location": "地點信息",
    "person": "相關人員"
  },
  "reasoning": "分析理由",
  "business_context": "業務上下文"
}

只回應 JSON，不要其他文字。
    `;
  }
}
```

### 2. 輕量級業務領域配置

```javascript
// 業務領域配置（極簡，AI友好）
const DOMAIN_CONFIGS = {
  "course-management": {
    name: "課程管理",
    description: "學習課程的安排、查詢、修改和取消",
    entities: {
      primary: "course_name",
      secondary: ["teacher", "location", "subject"]
    },
    actions: ["安排課程", "查詢課表", "修改課程", "取消課程", "設定提醒"],
    examples: [
      "明天下午2點數學課",
      "取消英文課",
      "查詢我的課表"
    ]
  },
  
  "elderly-care": {
    name: "長照管理", 
    description: "長期照護服務的安排、查詢和管理",
    entities: {
      primary: "service_name",
      secondary: ["caregiver", "location", "care_type"]
    },
    actions: ["安排照護", "查詢服務", "修改照護", "取消服務", "設定提醒"],
    examples: [
      "明天上午復健治療",
      "取消居家照護",
      "查詢照護安排"
    ]
  },
  
  "insurance-sales": {
    name: "保險成交管理",
    description: "保險業務拜訪、客戶管理和成交追蹤",
    entities: {
      primary: "client_name", 
      secondary: ["insurance_type", "location", "meeting_purpose"]
    },
    actions: ["安排拜訪", "查詢行程", "修改約訪", "取消會面", "設定提醒"],
    examples: [
      "明天下午拜訪王先生",
      "取消客戶會面",
      "查詢客戶行程"
    ]
  }
};
```

### 3. AI驅動的語義服務重構

```javascript
/**
 * AI驅動的語義服務
 * 核心改變：動態生成分析Prompt，而非硬編碼
 */
class AISemanticService {
  
  /**
   * AI優先的訊息分析
   * @param {string} text - 用戶輸入
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 分析結果
   */
  static async analyzeMessage(text, userId, context = {}) {
    try {
      // Step 1: 獲取當前業務領域
      const domainConfig = AITemplateEngine.currentDomain;
      if (!domainConfig) {
        throw new Error('No business domain loaded');
      }
      
      // Step 2: 動態生成AI分析Prompt
      const analysisPrompt = AITemplateEngine.generateAnalysisPrompt(text, userId);
      
      // Step 3: 調用OpenAI進行語義分析
      const aiResult = await OpenAIService.analyzeDomainIntent(analysisPrompt);
      
      if (aiResult.success) {
        const { analysis } = aiResult;
        
        // Step 4: 後處理 - 統一時間信息
        const timeInfo = await this.processTimeInfo(text);
        
        return {
          success: true,
          method: 'ai_driven',
          domain: domainConfig.name,
          intent: analysis.intent,
          confidence: analysis.confidence,
          entities: {
            ...analysis.entities,
            timeInfo: timeInfo
          },
          business_context: analysis.business_context,
          reasoning: analysis.reasoning,
          context,
          usage: aiResult.usage,
          analysis_time: Date.now()
        };
      }
      
      // AI失敗時的降級處理
      return this.fallbackAnalysis(text, userId, context);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'error',
        analysis_time: Date.now()
      };
    }
  }
  
  /**
   * AI無法分析時的降級處理
   */
  static async fallbackAnalysis(text, userId, context) {
    return {
      success: true,
      method: 'fallback',
      intent: 'unknown',
      confidence: 0.3,
      entities: {
        raw_text: text,
        timeInfo: await this.processTimeInfo(text)
      },
      context,
      analysis_time: Date.now()
    };
  }
}
```

### 4. OpenAI服務擴展

```javascript
/**
 * OpenAI服務擴展 - 支援動態領域分析
 */
class OpenAIService {
  
  /**
   * 通用領域意圖分析（替代原有的analyzeIntent）
   * @param {string} dynamicPrompt - 動態生成的分析Prompt
   * @returns {Promise<Object>} 分析結果
   */
  static async analyzeDomainIntent(dynamicPrompt) {
    const result = await this.complete({
      prompt: dynamicPrompt,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      max_tokens: 300,
      temperature: 0.3
    });

    try {
      const analysis = JSON.parse(result.content);
      return {
        success: true,
        analysis,
        usage: result.usage,
        model: result.model
      };
    } catch (parseError) {
      return {
        success: false,
        error: 'Failed to parse JSON response',
        raw_content: result.content,
        usage: result.usage,
        model: result.model
      };
    }
  }
  
  /**
   * AI驅動的回應生成
   * @param {Object} analysisResult - 語義分析結果
   * @param {Object} actionResult - 業務操作結果
   * @returns {Promise<string>} 生成的回應文字
   */
  static async generateResponse(analysisResult, actionResult) {
    const domain = AITemplateEngine.currentDomain;
    
    const prompt = `
你是${domain.name}助手。根據以下信息生成合適的回應：

用戶意圖：${analysisResult.intent}
操作結果：${actionResult.success ? '成功' : '失敗'}
業務實體：${JSON.stringify(analysisResult.entities)}
操作詳情：${JSON.stringify(actionResult)}

請生成一個自然、友善、符合${domain.name}場景的回應。直接回應文字，不要JSON格式。
    `;
    
    const result = await this.complete({
      prompt,
      max_tokens: 150,
      temperature: 0.7
    });
    
    return result.content;
  }
}
```

## 🔄 Template切換機制

### 1. 應用啟動時載入領域

```javascript
// src/index.js 修改
const AITemplateEngine = require('./core/aiTemplateEngine');
const DOMAIN_CONFIGS = require('./config/domainConfigs');

async function initializeApp() {
  // 從配置或環境變數讀取當前領域
  const activeDomain = process.env.ACTIVE_DOMAIN || 'course-management';
  const domainConfig = DOMAIN_CONFIGS[activeDomain];
  
  if (!domainConfig) {
    throw new Error(`Unknown domain: ${activeDomain}`);
  }
  
  // 載入業務領域到AI模板引擎
  AITemplateEngine.loadDomain(domainConfig);
  
  console.log(`🧠 AI Template loaded: ${domainConfig.name}`);
  console.log(`📋 Available actions: ${domainConfig.actions.join(', ')}`);
  
  // 啟動應用
  const app = require('./app');
  // ...
}
```

### 2. 動態切換命令

```bash
# 切換領域（重啟應用）
ACTIVE_DOMAIN=elderly-care npm start
ACTIVE_DOMAIN=insurance-sales npm start
ACTIVE_DOMAIN=course-management npm start
```

### 3. 運行時切換API

```javascript
// 添加管理端點
app.post('/admin/switch-domain', async (req, res) => {
  const { domain } = req.body;
  const domainConfig = DOMAIN_CONFIGS[domain];
  
  if (!domainConfig) {
    return res.status(400).json({ error: 'Invalid domain' });
  }
  
  AITemplateEngine.loadDomain(domainConfig);
  
  res.json({ 
    success: true, 
    message: `Switched to ${domainConfig.name}`,
    domain: domainConfig.name
  });
});
```

## 💡 AI驅動Template的優勢

### ✅ AI優先設計
- **意圖識別**：完全由AI判斷，不受規則限制
- **實體提取**：AI自動適應不同業務領域
- **語義理解**：AI理解業務上下文

### ✅ 極簡配置
- 只需定義**業務領域元數據**
- 不需要硬編碼意圖規則
- AI自動學習業務邏輯

### ✅ 強大適應性
- 新業務場景：只需添加領域配置
- 用戶表達多樣性：AI自動處理
- 業務邏輯演進：AI自動適應

### ✅ 保持現有架構
- 三層語義架構不變
- Service層繼續工作
- 只是讓AI更智能

## 🎯 實現步驟建議

1. **Phase 1**: 重構OpenAI服務，支援動態Prompt
2. **Phase 2**: 創建AI模板引擎和領域配置
3. **Phase 3**: 修改語義服務，使用AI驅動分析
4. **Phase 4**: 添加其他業務領域配置
5. **Phase 5**: 實現動態切換機制

這樣的設計真正做到**AI優先，配置輔助**，讓你的系統既智能又靈活！ 