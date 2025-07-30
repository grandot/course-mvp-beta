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
   * 分析語義意圖並提取 Slot 信息（增強版，支援 Slot Template System）
   * @param {string} text - 用戶輸入文本
   * @param {string} userId - 用戶ID（用於上下文）
   * @param {Object} options - 選項 { enableSlotExtraction: boolean, templateId: string }
   * @returns {Promise<Object>} 語義分析結果
   */
  static async analyzeIntentWithSlots(text, userId, options = {}) {
    if (!text) {
      throw new Error('OpenAIService: text is required for intent analysis');
    }

    const { enableSlotExtraction = true, templateId = 'course_management' } = options;

    const prompt = `
分析以下用戶輸入，識別課程管理相關的意圖和提取所有可能的 slot 值：

用戶輸入: "${text}"
用戶ID: ${userId}

請以 JSON 格式回應，包含：
{
  "intent": "意圖類型 (record_course, modify_course, cancel_course, query_schedule, set_reminder, clear_schedule)",
  "confidence": "信心度 (0.0-1.0 的數字)",
  "slot_state": {
    "student": "學生姓名 (如：小光、小明、Amy) 或 null",
    "course": "課程名稱 (如：鋼琴課、數學課、英文課) 或 null",
    "date": "日期 (YYYY-MM-DD 格式，如：2025-08-01) 或 null",
    "time": "時間 (HH:mm 格式，如：14:00) 或 null",
    "location": "地點 (如：板橋教室、線上、家裡) 或 null",
    "teacher": "老師 (如：王老師、李老師、Miss Chen) 或 null",
    "reminder": "提醒設定物件 (如：{\"minutes_before\": 10}) 或 null",
    "repeat": "重複設定物件 (如：{\"pattern\": \"weekly\", \"frequency\": 1}) 或 null",
    "note": "備註 (字串) 或 null"
  },
  "extraction_details": {
    "processed_entities": "已處理的實體資訊",
    "ambiguous_slots": "模糊不清的 slots 列表",
    "missing_slots": "缺失的 slots 列表"
  },
  "reasoning": "分析理由和置信度說明"
}

重要提醒：
1. 所有 slot 值必須是具體的、可解析的值，模糊的資訊請設為 null
2. 日期格式必須是 YYYY-MM-DD，時間格式必須是 HH:mm
3. 如果無法確定具體值，寧可設為 null 也不要猜測
4. confidence 必須是 0.0-1.0 之間的數字
5. 只回應 JSON，不要其他文字

只回應 JSON，不要其他文字。
`;

    const result = await this.complete({
      prompt,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      max_tokens: 350,
      temperature: 0.2, // 更低溫度確保一致性和準確性
    });

    try {
      // 處理 markdown 格式的 JSON 回應
      let jsonContent = result.content.trim();
      
      // 移除 markdown 代碼塊標記
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 嘗試解析清理後的 JSON
      const analysis = JSON.parse(jsonContent);

      // 驗證 slot_state 格式
      if (analysis.slot_state) {
        analysis.slot_state = this.validateAndCleanSlotState(analysis.slot_state);
      }

      return {
        success: true,
        analysis,
        usage: result.usage,
        model: result.model,
        enhanced_for_slots: true
      };
    } catch (parseError) {
      // JSON 解析失敗，回傳原始文本和詳細錯誤信息
      return {
        success: false,
        error: 'Failed to parse JSON response',
        parseError: parseError.message,
        raw_content: result.content,
        usage: result.usage,
        model: result.model,
        enhanced_for_slots: true
      };
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
  "intent": "意圖類型 (record_course, cancel_course, query_schedule, modify_course, set_reminder, clear_schedule)",
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

注意：clear_schedule 是清空所有課程的意圖，需要包含"清空"、"刪除所有"等關鍵詞。

只回應 JSON，不要其他文字。
`;

    const result = await this.complete({
      prompt,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      max_tokens: 200,
      temperature: 0.3, // 較低溫度確保一致性
    });

    try {
      // 🔧 修復：處理 markdown 格式的 JSON 回應
      let jsonContent = result.content.trim();
      
      // 移除 markdown 代碼塊標記
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 嘗試解析清理後的 JSON
      const analysis = JSON.parse(jsonContent);

      return {
        success: true,
        analysis,
        usage: result.usage,
        model: result.model,
      };
    } catch (parseError) {
      // 🎯 JSON 解析失敗時，嘗試基礎關鍵詞 fallback
      console.warn('[OpenAIService] JSON 解析失敗，啟用關鍵詞 fallback:', parseError.message);
      
      const fallbackResult = this.fallbackIntentAnalysis(text);
      
      return {
        success: true,
        analysis: fallbackResult,
        usage: result.usage,
        model: `${result.model}-fallback`,
        fallback: true,
        parseError: parseError.message,
        raw_content: result.content
      };
    }
  }

  /**
   * 🎯 基礎關鍵詞意圖分析 fallback
   * @param {string} text - 用戶輸入文本
   * @returns {Object} 意圖分析結果
   */
  static fallbackIntentAnalysis(text) {
    const lowerText = text.toLowerCase();
    
    // 🎯 核心意圖關鍵詞映射
    const intentPatterns = {
      clear_schedule: {
        keywords: ['清空', '全部刪除', '刪除所有', '清除所有', '重置'],
        requiredContext: ['課表', '課程', '所有'],
        confidence: 0.7
      },
      cancel_course: {
        keywords: ['取消', '刪除', '移除', '不上了', '不要'],
        confidence: 0.6
      },
      modify_course: {
        keywords: ['修改', '更改', '調整', '改成', '改到', '換成', '換到'],
        confidence: 0.6
      },
      record_course: {
        keywords: ['新增', '安排', '預約', '上課', '報名', '加入'],
        timeWords: ['今天', '明天', '後天', '下週', '點', '時'],
        confidence: 0.6
      },
      query_schedule: {
        keywords: ['查詢', '看看', '顯示', '課表', '什麼課', '有什麼', '安排'],
        confidence: 0.6
      },
      set_reminder: {
        keywords: ['提醒', '通知', '叫我', '記得'],
        confidence: 0.6
      }
    };

    let detectedIntent = 'unknown';
    let maxConfidence = 0;
    let entities = {
      course_name: null,
      time: null,
      date: null,
      location: null,
      teacher: null
    };

    // 意圖檢測
    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      let matched = false;
      
      // 檢查主要關鍵詞
      if (pattern.keywords.some(keyword => text.includes(keyword))) {
        // 特殊處理 clear_schedule - 需要額外上下文
        if (intent === 'clear_schedule') {
          matched = pattern.requiredContext.some(context => text.includes(context));
        } else if (intent === 'record_course') {
          // record_course 需要時間詞彙
          matched = pattern.timeWords && pattern.timeWords.some(word => text.includes(word));
          if (!matched) {
            // 或者有明確的課程名稱
            matched = text.includes('課') || text.includes('班');
          }
        } else {
          matched = true;
        }
      }

      if (matched && pattern.confidence > maxConfidence) {
        detectedIntent = intent;
        maxConfidence = pattern.confidence;
      }
    }

    // 基礎實體提取
    // 課程名稱
    const courseMatch = text.match(/([一-龯A-Za-z]+)(?:課|班)/);
    if (courseMatch) {
      entities.course_name = courseMatch[1];
    }

    // 時間提取
    const timeMatch = text.match(/(\d{1,2}[:：]\d{2}|[上下]午\d{1,2}[點点]|\d{1,2}[點点])/);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }

    // 日期提取
    const dateMatch = text.match(/(今天|明天|後天|週[一二三四五六日]|星期[一二三四五六日])/);
    if (dateMatch) {
      entities.date = dateMatch[0];
    }

    return {
      intent: detectedIntent,
      confidence: maxConfidence,
      entities,
      reasoning: `基於關鍵詞匹配的 fallback 分析`
    };
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

  /**
   * 🚨 新增：提取所有課程相關實體（課程、學生、地點、時間信息）
   * @param {string} text - 用戶輸入文本
   * @returns {Promise<Object>} 所有實體的提取結果
   */
  static async extractAllEntities(text) {
    try {
      const prompt = `
請從以下用戶輸入中提取所有課程相關的信息，並以JSON格式返回。

用戶輸入: "${text}"

提取規則：
1. course_name: 課程名稱（去掉"課"字，保留完整語義）
2. student: 學生姓名（可以是中文名、英文名、或任何名字）
3. location: 上課地點（前台、後台、教室、樓層等）
4. time_phrase: 時間短語（早上、下午、具體時間等）
5. date_phrase: 日期短語（明天、後天、具體日期等）

如果某個欄位無法提取，請設為null。

請只返回JSON格式，不要其他文字：
{
  "course_name": "提取的課程名稱或null",
  "student": "提取的學生姓名或null", 
  "location": "提取的地點或null",
  "time_phrase": "提取的時間短語或null",
  "date_phrase": "提取的日期短語或null"
}

範例：
- "LUMI早上十點乒乓球課" → {"course_name": "乒乓球", "student": "LUMI", "location": null, "time_phrase": "早上十點", "date_phrase": null}
- "後台下午兩點小美直排輪課" → {"course_name": "直排輪", "student": "小美", "location": "後台", "time_phrase": "下午兩點", "date_phrase": null}
- "明天晚上七點鋼琴課" → {"course_name": "鋼琴", "student": null, "location": null, "time_phrase": "晚上七點", "date_phrase": "明天"}
- "LUMI課表" → {"course_name": null, "student": "LUMI", "location": null, "time_phrase": null, "date_phrase": null}
- "小美課表" → {"course_name": null, "student": "小美", "location": null, "time_phrase": null, "date_phrase": null}
- "查詢小光的課程安排" → {"course_name": null, "student": "小光", "location": null, "time_phrase": null, "date_phrase": null}`;

      const response = await this.complete({
        prompt,
        maxTokens: 200,
        temperature: 0.1, // 較低溫度確保一致性
      });

      const content = response.content.trim();
      console.log(`🔧 [DEBUG] OpenAI實體提取原始回應:`, content);

      // 嘗試解析JSON
      try {
        const entities = JSON.parse(content);
        return {
          success: true,
          entities,
          usage: response.usage
        };
      } catch (parseError) {
        console.warn('JSON解析失敗，嘗試修正:', parseError.message);
        
        // 嘗試提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const entities = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            entities,
            usage: response.usage
          };
        }
        
        throw new Error('無法解析實體提取結果');
      }
    } catch (error) {
      console.error('OpenAI實體提取失敗，啟用結構化 fallback:', error.message);
      
      // 🎯 結構化 fallback：基於正則的實體提取
      const fallbackEntities = this.fallbackExtractEntities(text);
      
      return {
        success: true,
        entities: fallbackEntities,
        usage: null,
        fallback: true,
        error: error.message
      };
    }
  }

  /**
   * 🎯 結構化實體提取 fallback
   * @param {string} text - 用戶輸入文本
   * @returns {Object} 提取的實體
   */
  static fallbackExtractEntities(text) {
    const entities = {
      course_name: null,
      student: null,
      location: null,
      time_phrase: null,
      date_phrase: null
    };

    // 1. 提取學生名稱
    // 支持 "LUMI課表"、"小美的課程"、"查詢小光" 等模式
    const studentPatterns = [
      /^([一-龯A-Za-z]{2,10})(?:課表|的課程|的安排)/,
      /查詢([一-龯A-Za-z]{2,10})(?:的)?/,
      /([一-龯A-Za-z]{2,10})(?:早上|下午|晚上|點)/,
      /^([一-龯A-Za-z]{2,10})(?:[一-龯]+課)/
    ];

    for (const pattern of studentPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // 驗證是否為有效名稱（排除課程名稱）
        const name = match[1];
        if (!/課|班|教|學|習|程|術|藝/.test(name)) {
          entities.student = name;
          break;
        }
      }
    }

    // 2. 提取課程名稱
    const courseMatch = text.match(/([一-龯A-Za-z]+)(?:課|班)(?!表)/);
    if (courseMatch && courseMatch[1] !== entities.student) {
      entities.course_name = courseMatch[1];
    }

    // 3. 提取地點
    const locationPatterns = [
      /(前台|後台|教室|線上|家裡|學校|公園|體育館|游泳池)/,
      /在([一-龯]+)(?:上課|學習)/,
      /(\d+樓|\d+F)/
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.location = match[1];
        break;
      }
    }

    // 4. 提取時間短語
    const timePatterns = [
      /(早上|上午|中午|下午|晚上)\s*(\d{1,2}[:：]\d{2}|\d{1,2}[點点](?:\d{1,2})?)/,
      /(\d{1,2}[:：]\d{2})/,
      /(\d{1,2}[點点](?:\d{1,2}分?)?)/,
      /(早上|上午|中午|下午|晚上)/
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.time_phrase = match[0];
        break;
      }
    }

    // 5. 提取日期短語
    const datePatterns = [
      /(今天|明天|後天|大後天)/,
      /(週[一二三四五六日]|星期[一二三四五六日])/,
      /(下週|本週|這週|上週)/,
      /(\d{1,2}月\d{1,2}[日號])/,
      /(\d{4}-\d{2}-\d{2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.date_phrase = match[0];
        break;
      }
    }

    console.log('[OpenAIService] Fallback 實體提取結果:', entities);
    return entities;
  }

  static async extractCourseName(text) {
    try {
      const prompt = `
請從以下用戶輸入中提取課程名稱。如果沒有明確的課程名稱，請返回 null。

用戶輸入: "${text}"

規則：
1. 提取完整的課程名稱，包含課程主題和類型描述，只去掉末尾的"課"字
2. 保留課程的完整語義信息（如：教學、訓練、會話、演奏等）
3. 如果是修改/取消語句，提取動作前的課程名稱，不要包含動作詞
4. 如果沒有明確課程名稱，返回 null
5. 只返回課程名稱，不要其他文字
6. 不要包含"修改"、"取消"、"刪除"、"調整"等動作詞

範例：
- "數學課" → "數學"
- "AI教學課" → "AI教學"
- "英語會話課" → "英語會話"
- "鋼琴演奏課" → "鋼琴演奏"
- "網球訓練課" → "網球訓練"
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

  /**
   * 驗證和清理 slot_state 對象
   * @param {Object} slotState - 原始 slot_state
   * @returns {Object} 清理後的 slot_state
   */
  static validateAndCleanSlotState(slotState) {
    const cleanedState = {};
    
    // 定義預期的 slot 結構
    const expectedSlots = {
      student: 'string',
      course: 'string', 
      date: 'string',
      time: 'string',
      location: 'string',
      teacher: 'string',
      reminder: 'object',
      repeat: 'object',
      note: 'string'
    };
    
    // 驗證和清理每個 slot
    for (const [slotName, expectedType] of Object.entries(expectedSlots)) {
      const value = slotState[slotName];
      
      if (value === null || value === undefined || value === '') {
        cleanedState[slotName] = null;
      } else if (expectedType === 'string' && typeof value === 'string') {
        cleanedState[slotName] = value.trim();
      } else if (expectedType === 'object' && typeof value === 'object') {
        cleanedState[slotName] = value;
      } else if (expectedType === 'string' && typeof value !== 'string') {
        // 嘗試轉換為字符串
        cleanedState[slotName] = String(value).trim();
      } else {
        cleanedState[slotName] = null;
      }
    }
    
    // 特殊驗證：日期格式
    if (cleanedState.date && !this.isValidDateFormat(cleanedState.date)) {
      console.warn(`[OpenAIService] 無效的日期格式: ${cleanedState.date}`);
      cleanedState.date = null;
    }
    
    // 特殊驗證：時間格式
    if (cleanedState.time && !this.isValidTimeFormat(cleanedState.time)) {
      console.warn(`[OpenAIService] 無效的時間格式: ${cleanedState.time}`);
      cleanedState.time = null;
    }
    
    return cleanedState;
  }

  /**
   * 驗證日期格式 (YYYY-MM-DD)
   * @param {string} dateString - 日期字符串
   * @returns {boolean} 是否為有效格式
   */
  static isValidDateFormat(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }
    
    // 驗證是否為有效日期
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(dateString);
  }

  /**
   * 驗證時間格式 (HH:mm)
   * @param {string} timeString - 時間字符串
   * @returns {boolean} 是否為有效格式
   */
  static isValidTimeFormat(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }
}

module.exports = OpenAIService;
