/**
 * OpenAI Service - OpenAI API 官方 SDK 包裝
 * 職責：處理 OpenAI API 調用，token 計算，錯誤處理
 * 限制：僅供內部服務調用，外部應通過 SemanticService
 */

class OpenAIService {
  /**
   * 調用 OpenAI Chat Completion API
   * @param {Object} options - API 調用參數
   * @param {string} options.prompt - 用戶提示
   * @param {string} options.model - 模型名稱（默認從環境變數）
   * @param {number} options.max_tokens - 最大 token 數量
   * @param {number} options.temperature - 創造性參數
   * @returns {Promise<Object>} API 響應結果
   */
  static async complete(options = {}) {
    const {
      prompt,
      model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens = 150,
      temperature = 0.7,
    } = options;

    if (!prompt) {
      throw new Error('OpenAIService: prompt is required');
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAIService: OPENAI_API_KEY environment variable is required');
    }

    try {
      // 模擬 OpenAI API 調用結構
      // 實際生產環境中應使用真實的 OpenAI SDK
      const response = await this.mockOpenAICall({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一個課程管理助手，專門幫助用戶分析課程相關的自然語言輸入。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      });

      return {
        success: true,
        content: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        response_time: response.response_time || Date.now(),
      };
    } catch (error) {
      throw new Error(`OpenAIService API Error: ${error.message}`);
    }
  }

  /**
   * 分析語義意圖（專門用於 SemanticService）
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID（用於上下文）
   * @returns {Promise<Object>} 語義分析結果
   */
  static async analyzeIntent(text, userId) {
    if (!text) {
      throw new Error('OpenAIService: text is required for intent analysis');
    }

    const prompt = `
分析以下用戶輸入，識別課程管理相關的意圖和實體：

用戶輸入: "${text}"
用戶ID: ${userId}

請以 JSON 格式回應，包含：
{
  "intent": "意圖類型 (record_course, cancel_course, query_schedule, modify_course, set_reminder)",
  "confidence": "信心度 (0.0-1.0)",
  "entities": {
    "course_name": "課程名稱",
    "time": "時間信息",
    "date": "日期信息",
    "location": "地點",
    "teacher": "老師"
  },
  "reasoning": "分析理由"
}

只回應 JSON，不要其他文字。
`;

    const result = await this.complete({
      prompt,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      max_tokens: 200,
      temperature: 0.3, // 較低溫度確保一致性
    });

    try {
      // 嘗試解析 JSON 回應
      const analysis = JSON.parse(result.content);

      return {
        success: true,
        analysis,
        usage: result.usage,
        model: result.model,
      };
    } catch (parseError) {
      // JSON 解析失敗，回傳原始文本
      return {
        success: false,
        error: 'Failed to parse JSON response',
        raw_content: result.content,
        usage: result.usage,
        model: result.model,
      };
    }
  }

  /**
   * 模擬 OpenAI API 調用（開發/測試用）
   * 生產環境應替換為真實的 OpenAI SDK 調用
   * @param {Object} requestBody - API 請求體
   * @returns {Promise<Object>} 模擬的 API 響應
   */
  static async mockOpenAICall(requestBody) {
    const { model, messages } = requestBody;
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';

    // 模擬處理延遲
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // 簡化的意圖分析邏輯（實際應由 OpenAI 處理）
    let mockResponse = '';
    const promptTokens = Math.floor(userMessage.length / 4); // 粗略估算
    let completionTokens = 0;

    if (userMessage.includes('分析以下用戶輸入')) {
      // 意圖分析請求
      const analysisText = userMessage.match(/用戶輸入: "(.+?)"/)?.[1] || '';

      let intent = 'unknown';
      let confidence = 0.6;
      if (analysisText.includes('取消') || analysisText.includes('刪除')) {
        intent = 'cancel_course';
        confidence = 0.8;
      } else if (analysisText.includes('新增') || analysisText.includes('安排') || analysisText.includes('預約')) {
        intent = 'record_course';
        confidence = 0.8;
      } else if (analysisText.includes('查詢') || analysisText.includes('看看') || analysisText.includes('課表')) {
        intent = 'query_schedule';
        confidence = 0.9;
      } else if (analysisText.includes('修改') || analysisText.includes('改時間')) {
        intent = 'modify_course';
        confidence = 0.8;
      } else if (analysisText.includes('提醒')) {
        intent = 'set_reminder';
        confidence = 0.8;
      }

      mockResponse = JSON.stringify({
        intent,
        confidence,
        entities: {
          course_name: this.extractCourseName(analysisText),
          time: this.extractTime(analysisText),
          date: this.extractDate(analysisText),
          location: null,
          teacher: null,
        },
        reasoning: `基於關鍵詞分析識別為 ${intent}`,
      });
    } else {
      // 一般對話請求
      mockResponse = '我是課程管理助手，可以幫您管理課程安排。';
    }

    completionTokens = Math.floor(mockResponse.length / 4);

    return {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      response_time: Date.now(),
    };
  }

  /**
   * 從文本中提取課程名稱
   * @param {string} text - 輸入文本
   * @returns {string|null} 課程名稱
   */
  static extractCourseName(text) {
    const coursePatterns = [
      /(數學|英文|物理|化學|生物|歷史|地理|國文|英語|中文|法語|德語|日語|韓語|西班牙語|義大利語|俄語|阿拉伯語)課?/, // 具體課程名稱
      /([一-龯]+語)課?/, // 各類語言課程
      /([一-龯]+)課/, // 中文字符課程名稱
      /([一-龯]+)班/, // 中文字符班級名稱
    ];

    for (const pattern of coursePatterns) {
      const match = text.match(pattern);
      if (match) {
        const courseName = match[1] || match[0];
        // 移除課字後綴
        return courseName.replace(/課$/, '');
      }
    }

    return null;
  }

  /**
   * 從文本中提取時間信息
   * @param {string} text - 輸入文本
   * @returns {string|null} 時間信息
   */
  static extractTime(text) {
    const timePatterns = [
      /(\d{1,2}:\d{2})/,
      /(上午|下午).*?(\d{1,2})\s*點/,
      /(\d{1,2})\s*點/,
      /(早上|中午|晚上)/,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * 從文本中提取日期信息
   * @param {string} text - 輸入文本
   * @returns {string|null} 日期信息
   */
  static extractDate(text) {
    const datePatterns = [
      /(今天|明天|後天|昨天|前天)/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2})月(\d{1,2})日/,
      /(週一|週二|週三|週四|週五|週六|週日)/,
      /(星期一|星期二|星期三|星期四|星期五|星期六|星期日)/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * 計算 token 成本（新台幣）
   * @param {number} totalTokens - 總 token 數
   * @param {string} model - 模型名稱
   * @returns {number} 成本（新台幣）
   */
  static calculateCost(totalTokens, model = 'gpt-3.5-turbo') {
    // GPT-3.5-turbo 定價（參考值，實際以 OpenAI 官方為準）
    const pricing = {
      'gpt-3.5-turbo': 0.000002, // USD per token
      'gpt-4': 0.00003, // USD per token
    };

    const usdRate = 31.5; // USD to TWD 匯率（參考值）
    const pricePerToken = pricing[model] || pricing['gpt-3.5-turbo'];

    return totalTokens * pricePerToken * usdRate;
  }
}

module.exports = OpenAIService;
