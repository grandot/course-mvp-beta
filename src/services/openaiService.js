const OpenAI = require('openai');

/**
 * OpenAI API 服務封裝
 * 提供語意分析和自然語言處理功能
 */

let openaiClient = null;

/**
 * 初始化 OpenAI 客戶端
 */
function initializeOpenAI() {
  if (!openaiClient) {
    // 確保 dotenv 已載入（防止環境變數未載入）
    if (typeof require !== 'undefined') {
      try {
        require('dotenv').config();
      } catch (e) {
        // dotenv 可能已載入或不可用，忽略錯誤
      }
    }
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('❌ OPENAI_API_KEY 環境變數未設定');
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('✅ OpenAI 服務初始化完成');
  }
  return openaiClient;
}

/**
 * 呼叫 OpenAI Chat Completion API
 */
async function chatCompletion(prompt, options = {}) {
  try {
    const client = initializeOpenAI();

    const defaultOptions = {
      model: 'gpt-3.5-turbo',
      temperature: 0.1, // 較低的隨機性，確保一致性
      max_tokens: 1000,
      ...options,
    };

    const response = await client.chat.completions.create({
      model: defaultOptions.model,
      messages: [
        {
          role: 'system',
          content: '你是一個專業的課程管理助手，專門處理課程安排、查詢和記錄相關任務。請用繁體中文回應，並保持回應簡潔準確。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: defaultOptions.temperature,
      max_tokens: defaultOptions.max_tokens,
    });

    const result = response.choices[0]?.message?.content?.trim();

    if (!result) {
      throw new Error('OpenAI API 回應為空');
    }

    return result;
  } catch (error) {
    console.error('❌ OpenAI API 呼叫失敗:', error);

    // 根據錯誤類型提供不同的處理
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API 配額不足，請檢查帳戶餘額');
    } else if (error.code === 'invalid_api_key') {
      throw new Error('OpenAI API 金鑰無效，請檢查環境變數設定');
    } else if (error.code === 'model_not_found') {
      throw new Error('OpenAI 模型不存在，請檢查模型名稱');
    } else {
      throw new Error(`OpenAI API 錯誤: ${error.message}`);
    }
  }
}

/**
 * 語意意圖識別專用函式
 */
async function identifyIntent(message) {
  const prompt = `
你是課程管理聊天機器人的意圖分析器。僅處理課程相關語句，嚴格排除無關查詢。

語句：「${message}」

判斷規則：
- 僅在語句明確涉及「課程/上課/學生/課表/安排/提醒/取消/記錄」等教育相關內容時，才分配課程相關意圖
- 天氣/心情/新聞/股市/一般問候/時間詢問（現在幾點）等非課程語句，一律回傳 unknown
- 對模糊或不確定的語句設置低信心度

可能的意圖：
- add_course: 新增單次課程
- create_recurring_course: 創建重複課程（每日、每週、每月）
- query_schedule: 查詢課表或行程
- set_reminder: 設定課程提醒
- cancel_course: 取消或刪除課程
- record_content: 記錄課程內容或表現
- modify_course: 修改課程時間或內容
- confirm_action: 確認操作（確認、好的、是的）
- unknown: 無法識別或不屬於課程管理相關

回傳格式（純 JSON，不要額外文字）：
{"intent": "意圖名稱", "confidence": 0.0~1.0}

對於非課程相關的語句，必須回傳：
{"intent": "unknown", "confidence": 0.0}

信心度門檻：低於 0.7 請回傳 unknown
`;

  try {
    const response = await chatCompletion(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('❌ 意圖識別失敗:', error);
    return { intent: 'unknown', confidence: 0.0 };
  }
}

/**
 * 實體提取專用函式
 */
async function extractEntities(message, intent) {
  const prompt = `
請從以下語句中提取課程管理相關的實體資訊：

語句：「${message}」
已識別意圖：${intent}

請提取以下資訊（如果語句中包含）：
- studentName: 學生姓名（如：小明、Lumi）
- courseName: 課程名稱（如：數學課、鋼琴課）
- scheduleTime: 上課時間，轉換為24小時制（如：下午3點 -> "15:00"）
- courseDate: 具體日期，轉換為 YYYY-MM-DD 格式
- timeReference: 時間參考（today/tomorrow/yesterday/this_week 等）
- recurring: 是否為重複課程（true/false），系統支援每日、每週、每月重複
- dayOfWeek: 星期幾（0=週日，1=週一...6=週六）
- content: 課程內容或描述
- reminderTime: 提醒提前時間（分鐘數）
- reminderNote: 提醒備註內容

回傳 JSON 格式，只包含能確定提取的欄位：
{"studentName": "小明", "courseName": "數學課", "scheduleTime": "15:00"}

如果無法提取任何資訊，回傳空物件：{}
`;

  try {
    const response = await chatCompletion(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('❌ 實體提取失敗:', error);
    return {};
  }
}

/**
 * 生成友善的回應訊息
 */
async function generateResponse(intent, slots, result) {
  const prompt = `
根據以下資訊生成一個友善的回應訊息：

用戶意圖：${intent}
提取的資訊：${JSON.stringify(slots, null, 2)}
處理結果：${JSON.stringify(result, null, 2)}

請生成一個適合的回應訊息，要求：
1. 使用繁體中文
2. 語氣友善、自然
3. 確認用戶的操作結果
4. 如果是成功操作，用 ✅ 開頭
5. 如果是失敗操作，用 ❌ 開頭
6. 如果需要更多資訊，用 ❓ 開頭

重要功能說明：
- 系統已支援每日、每週、每月重複課程功能
- 每月重複包括固定日期（如每月1號、15號）
- 不要告訴用戶「每月重複尚未支援」或「將在後續版本提供」

範例：
- "✅ 小明每週三下午3:00的數學課已安排好了！"
- "✅ 小華每月15號上午10:00的鋼琴課已安排好了！"
- "❌ 抱歉，找不到您提到的課程，請確認學生姓名和課程名稱"
- "❓ 請問數學課的具體上課時間是幾點呢？"

請只回傳訊息內容，不要加引號：
`;

  try {
    const response = await chatCompletion(prompt);
    return response;
  } catch (error) {
    console.error('❌ 回應生成失敗:', error);

    // 提供備用回應
    if (result?.success) {
      return '✅ 操作已完成';
    }
    return '❌ 操作失敗，請稍後再試';
  }
}

/**
 * 測試 OpenAI 服務連接
 */
async function testConnection() {
  try {
    const testResponse = await chatCompletion('請回覆「連接正常」');
    console.log('🔗 OpenAI 服務連接測試:', testResponse);
    return true;
  } catch (error) {
    console.error('❌ OpenAI 服務連接失敗:', error);
    return false;
  }
}

module.exports = {
  chatCompletion,
  identifyIntent,
  extractEntities,
  generateResponse,
  testConnection,
  initializeOpenAI,
};
