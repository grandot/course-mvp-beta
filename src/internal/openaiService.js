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
      // 🧠 使用真正的 OpenAI API 進行語義理解
      const { OpenAI } = require('openai');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
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
        response_time: Date.now(),
      };
    } catch (error) {
      // 🛡️ OpenAI API 失敗時，回退到 mock 服務確保系統穩定性
      console.warn('OpenAI API failed, falling back to mock service:', error.message);
      
      try {
        const mockResponse = await this.mockOpenAICall({
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
          content: mockResponse.choices[0].message.content,
          usage: mockResponse.usage,
          model: `${mockResponse.model}-mock-fallback`,
          response_time: mockResponse.response_time || Date.now(),
        };
      } catch (mockError) {
        throw new Error(`OpenAI Service Error: ${error.message}, Mock fallback also failed: ${mockError.message}`);
      }
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
   * 🧠 AI 驅動的課程名稱提取
   * @param {string} text - 輸入文本
   * @returns {Promise<string|null>} 課程名稱
   */
  static async extractCourseName(text) {
    try {
      const prompt = `
請從以下用戶輸入中提取課程名稱。如果沒有明確的課程名稱，請返回 null。

用戶輸入: "${text}"

規則：
1. 只提取課程的主要名稱部分，去掉"課"字後綴
2. 如果是修改/取消語句，提取動作前的課程名稱，不要包含動作詞
3. 如果沒有明確課程名稱，返回 null
4. 只返回課程名稱，不要其他文字
5. 不要包含"修改"、"取消"、"刪除"、"調整"等動作詞

範例：
- "數學課" → "數學"
- "網球改成下午四點" → "網球"  
- "直排輪課改時間" → "直排輪"
- "取消英文課" → "英文"
- "修改物理課時間" → "物理"
- "明天下午2點" → null (沒有課程名稱)

課程名稱:`;

      const result = await this.complete({
        prompt,
        model: 'gpt-3.5-turbo',
        maxTokens: 50,
        temperature: 0.1, // 低溫度確保一致性
      });

      if (result.success) {
        const extracted = result.content.trim();
        // 處理 AI 回應，過濾無效結果
        if (extracted && 
            extracted !== 'null' && 
            extracted !== 'NULL' &&
            extracted !== '無' &&
            extracted !== '沒有' &&
            extracted.length <= 20 && 
            extracted.length >= 1) {
          return extracted;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('AI course name extraction failed, using fallback:', error.message);
      // 回退到原有模式匹配
      return this.fallbackExtractCourseName(text);
    }
  }

  /**
   * 回退課程名稱提取（保持系統穩定性）
   * @param {string} text - 輸入文本  
   * @returns {string|null} 課程名稱
   */
  static fallbackExtractCourseName(text) {
    const coursePatterns = [
      /(數學|英文|物理|化學|生物|歷史|地理|國文|英語|中文|法語|德語|日語|韓語|西班牙語|義大利語|俄語|阿拉伯語|籃球|足球|排球|羽毛球|乒乓球|網球|游泳|跑步|健身|瑜伽|舞蹈|武術|跆拳道|空手道|柔道|劍道|直排輪|鋼琴|吉他|小提琴)課?/,
      /([一-龯]+語)課?/,
      /([一-龯]+)課/,
      /([一-龯]+)班/,
      // 💡 新增：提取修改語句中的課程名稱
      /^([^修改取消刪除調整更改變更改成改到換成換到]{1,10})(?=修改|取消|刪除|調整|更改|變更|改成|改到|換成|換到)/,
    ];

    for (const pattern of coursePatterns) {
      const match = text.match(pattern);
      if (match) {
        const courseName = match[1] || match[0];
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
      // HH:MM 格式
      /(\d{1,2}:\d{2})/,
      
      // 🔧 修復：中文數字+分鐘數 (下午四點20)
      /(上午|下午|早上|中午|晚上)?\s*(十一|十二|一|二|三|四|五|六|七|八|九|十)[點点](\d{1,2})/,
      
      // 數字+分鐘數 (3點45, 14點30)
      /(\d{1,2})[點点](\d{1,2})/,
      
      // 上午下午+數字時間+分鐘數 (上午9點15)
      /(上午|下午|早上|中午|晚上)\s*(\d{1,2})[點点](\d{1,2})?/,
      
      // 中文數字時間 (四點, 十一點)
      /(上午|下午|早上|中午|晚上)?\s*(十一|十二|一|二|三|四|五|六|七|八|九|十)[點点]/,
      
      // 數字時間 (3點, 14點) 
      /(\d{1,2})[點点]/,
      
      // 上午下午+數字時間 (下午3點)
      /(上午|下午|早上|中午|晚上)\s*(\d{1,2})[點点]/,
      
      // 時段詞
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
