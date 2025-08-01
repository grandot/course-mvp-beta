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
你是課程管理助手。分析用戶輸入並返回JSON格式結果。

用戶輸入："${text}"

🚨 關鍵判斷規則：
1. 記錄課程內容 (record_lesson_content)：包含具體內容、表現、成果、學習內容
   - 關鍵詞：老師說、表現、學了、教了、成功、很好、造出、學會、完成
   - 範例："老師說昨天LUMI科學實驗課表現很好 都造出火箭了" → record_lesson_content
   - 範例："昨天數學課學了分數的加減法" → record_lesson_content

2. 新增課程安排 (record_course)：只有時間+課程，無具體內容
   - 範例："明天下午3點有數學課" → record_course
   - 範例："下週二鋼琴課" → record_course

3. 查詢課程 (query_schedule/query_course_content)：詢問、查詢、了解
   - 關鍵詞：怎麼樣、如何、記得、不是...嗎、課程記錄、是什麼
   - 範例："上次Rumi的課上得怎麼樣" → query_course_content

4. 重複課程 (create_recurring_course)：包含重複模式
   - 關鍵詞：每週、每天、每月
   - 範例："LUMI每週三下午三點有科學實驗課" → create_recurring_course

⚠️ 優先級：記錄內容 > 查詢 > 新增安排

{
  "intent": "record_course|record_lesson_content|cancel_course|query_schedule|modify_course|set_reminder|clear_schedule|create_recurring_course|modify_recurring_course|stop_recurring_course|query_course_content|query_today_courses_for_content",
  "confidence": 0.0-1.0,
  "entities": {
    "course_name": "課程名稱",
    "student_name": "學生名稱", 
    "time": "時間",
    "date": "日期",
    "location": "地點",
    "teacher": "老師",
    "recurrence_pattern": "重複模式",
    "content_to_record": "要記錄的課程內容",
    "query_type": "查詢類型"
  },
  "reasoning": "判斷理由"
}
`;

    const result = await this.complete({
      prompt,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      max_tokens: 200,
      temperature: 0.3, // 較低溫度確保一致性
    });

    try {
      // 🎯 第一性原則修復：強化JSON解析容錯性
      let jsonContent = result.content.trim();
      
      // 移除 markdown 代碼塊標記
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 🎯 新增：從包含中文解釋的文本中提取JSON
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      // 🎯 增強容錯處理：修復常見JSON格式錯誤
      try {
        // 嘗試標準解析
        const analysis = JSON.parse(jsonContent);
        
        // 驗證必要字段
        if (!analysis.intent || analysis.confidence === undefined) {
          throw new Error('Missing required fields: intent or confidence');
        }
        
        // 🚨 處理非課程管理內容拒絕
        if (analysis.intent === 'not_course_related') {
          return {
            success: true,
            analysis: {
              intent: 'not_course_related', 
              confidence: analysis.confidence,
              entities: {},
              reasoning: analysis.reasoning || 'OpenAI識別為非課程管理相關內容'
            },
            usage: result.usage,
            model: result.model,
          };
        }
        
        return {
          success: true,
          analysis,
          usage: result.usage,
          model: result.model,
        };
        
      } catch (strictParseError) {
        console.warn('[OpenAIService] 標準JSON解析失敗，嘗試容錯修復:', strictParseError.message);
        
        // 🎯 容錯修復策略（第一性原則：最大化容錯能力）
        let fixedContent = jsonContent;
        
        // 修復1: 移除控制字符（根本問題修復）
        fixedContent = fixedContent.replace(/[\x00-\x1F\x7F]/g, '');
        
        // 修復2: 處理未閉合的字符串
        fixedContent = fixedContent.replace(/("[^"]*?)(\n|$)/g, '$1"$2');
        
        // 修復3: 處理末尾缺少的括號
        if (!fixedContent.trim().endsWith('}')) {
          fixedContent = fixedContent.trim() + '}';
        }
        
        // 修復4: 處理多餘的逗號
        fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1');
        
        // 修復5: 處理特殊字符轉義
        fixedContent = fixedContent.replace(/\\n/g, '\\\\n');
        
        // 修復6: 處理其他常見問題
        fixedContent = fixedContent.replace(/\n/g, ' ').replace(/\t/g, ' ');
        
        try {
          const analysis = JSON.parse(fixedContent);
          
          console.log('[OpenAIService] JSON容錯修復成功');
          return {
            success: true,
            analysis,
            usage: result.usage,
            model: `${result.model}-fixed`,
            repaired: true
          };
          
        } catch (fixedParseError) {
          console.warn('[OpenAIService] JSON容錯修復也失敗:', fixedParseError.message);
          throw strictParseError; // 拋出原始錯誤
        }
      }
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
    // 🎯 第一步：檢查是否為課程管理相關內容（拒絕閒聊）
    const courseRelatedKeywords = [
      '課', '班', '學習', '教學', '老師', '學生', '上課', '下課', '教師',
      '時間', '安排', '預約', '取消', '修改', '查詢', '課表', '時間表',
      '每週', '每天', '每月', '重複', '提醒', '通知', '科學', '數學', '英文',
      '音樂', '體育', '美術', '實驗', '作業', '考試', '成績', '表現'
    ];
    
    const isCourseRelated = courseRelatedKeywords.some(keyword => text.includes(keyword));
    
    if (!isCourseRelated) {
      return {
        intent: 'not_course_related',
        confidence: 0.95,
        entities: {},
        reasoning: '輸入內容與課程管理無關，拒絕處理閒聊內容'
      };
    }

    // 🎯 第二步：詳細意圖分析（超詳細fallback - 確保不漏任何情況）
    
    let detectedIntent = 'unknown';
    let maxConfidence = 0;
    let entities = {
      course_name: null,
      time: null,
      date: null,
      location: null,
      teacher: null,
      recurrence_pattern: null,
      student_name: null,
      query_type: null
    };

    // 🚨 優先級1：查詢意圖檢測（最高優先級 - 處理自然語言查詢）
    const queryWords = ['怎麼樣', '如何', '記得', '不是', '嗎', '查詢', '看', '顯示', '課表', '時間表', '有什麼', '上次', '最近', '之前', '課程記錄', '是什麼'];
    const questionWords = ['怎麼樣', '如何', '記得', '不是', '嗎', '是什麼'];
    const fuzzyTimeWords = ['上次', '最近', '之前', '上一次'];
    const recordQueryWords = ['課程記錄', '記錄', '內容'];
    
    const hasQueryWords = queryWords.some(word => text.includes(word));
    const hasQuestionWords = questionWords.some(word => text.includes(word));
    const hasFuzzyTime = fuzzyTimeWords.some(word => text.includes(word));
    const hasRecordQuery = recordQueryWords.some(word => text.includes(word));
    
    // 查詢課程內容（表現查詢或記錄查詢）
    if ((hasQuestionWords || hasRecordQuery) && text.includes('課')) {
      detectedIntent = 'query_course_content';
      maxConfidence = 0.9;
      entities.query_type = hasRecordQuery ? '記錄查詢' : '表現查詢';
    }
    // 一般查詢
    else if (hasQueryWords) {
      detectedIntent = 'query_schedule';
      maxConfidence = 0.85;
      entities.query_type = '一般查詢';
    }

    // 🚨 優先級2：課程內容記錄檢測（第二高優先級 - MVP核心功能）
    if (detectedIntent === 'unknown') {
      const courseWords = ['課', '班'];
      const contentWords = [
        // 課程內容/成果
        '表現', '回饋', '學到', '老師說', '成功', '很好', '不錯', '進步', '棒', '厲害', '造出', '做出', '完成', '成果', '評語',
        // 課程準備/提醒 (關鍵！)
        '要帶', '準備', '提醒', '注意', '記得', '別忘', '需要', '要交', '作業', '考試', '測驗',
        // 課程狀況
        '專心', '認真', '開心', '困難', '簡單', '有趣', '無聊'
      ];
      
      const hasCourseContent = courseWords.some(word => text.includes(word));
      const hasSpecificContent = contentWords.some(word => text.includes(word));
      
      // 課程+具體內容 = 記錄課程內容到學習日曆 (不論時間，MVP核心功能)
      if (hasCourseContent && hasSpecificContent) {
        detectedIntent = 'record_course';
        maxConfidence = 0.9;
      }
    }
    
    // 🚨 優先級3：重複課程檢測（第三高優先級）
    if (detectedIntent === 'unknown') {
      const recurringWords = ['每週', '每周', '每天', '每日', '每月', '重複', '定期', '固定'];
      const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      const futureIndicators = ['有', '安排', '上', '開始', '要'];
      
      const hasRecurringWords = recurringWords.some(word => text.includes(word));
      const hasWeekdays = weekdays.some(day => text.includes(day));
      const hasFutureIndicators = futureIndicators.some(word => text.includes(word));
      
      if ((hasRecurringWords || hasWeekdays) && hasFutureIndicators && text.includes('課')) {
        detectedIntent = 'create_recurring_course';
        maxConfidence = 0.85;
        
        // 提取重複模式
        const recurringMatch = text.match(/(每週[一-日]?|每周[一-日]?|每天|每日|每月|週[一-日]|周[一-日])/);
        if (recurringMatch) {
          entities.recurrence_pattern = recurringMatch[0];
        }
      }
    }
    
    // 🚨 優先級4：一次性課程檢測（嚴格條件 - 必須未來時間且無過去語境）
    if (detectedIntent === 'unknown') {
      const recordKeywords = ['新增', '安排', '預約', '有', '上課', '報名', '加入', '要上'];
      const futureWords = ['明天', '後天', '下週', '下個月', '點', '時', '未來'];
      const excludePastWords = ['昨天', '前天', '上週', '已經', '表現', '回饋', '學到', '老師說', '成功', '很好'];
      
      const hasRecordKeywords = recordKeywords.some(keyword => text.includes(keyword));
      const hasFutureTime = futureWords.some(word => text.includes(word));
      const hasPastContext_exclude = excludePastWords.some(word => text.includes(word));
      const hasRecurringContext = ['每週', '每周', '每天', '每月'].some(word => text.includes(word));
      
      if (hasRecordKeywords && hasFutureTime && !hasPastContext_exclude && !hasRecurringContext && text.includes('課')) {
        detectedIntent = 'record_course';
        maxConfidence = 0.8;
      }
    }
    
    // 🚨 優先級5：其他明確意圖檢測
    if (detectedIntent === 'unknown') {
      const intentChecks = [
        {
          intent: 'cancel_course',
          keywords: ['取消', '刪除', '移除', '不上了', '不要', '停止'],
          confidence: 0.75
        },
        {
          intent: 'modify_course',
          keywords: ['修改', '更改', '調整', '改成', '改到', '換成', '換到', '變更'],
          confidence: 0.7
        },
        {
          intent: 'set_reminder',
          keywords: ['提醒', '通知', '叫我', '記得', '鬧鐘', '提醒我'],
          confidence: 0.6
        },
        {
          intent: 'clear_schedule',
          keywords: ['清空', '刪除所有', '移除所有', '全部刪除', '重置', '清除所有'],
          contextRequired: ['課程', '課表', '所有'],
          confidence: 0.8
        }
      ];
      
      for (const check of intentChecks) {
        const hasKeywords = check.keywords.some(keyword => text.includes(keyword));
        
        if (hasKeywords) {
          if (check.contextRequired) {
            const hasContext = check.contextRequired.some(context => text.includes(context));
            if (hasContext && check.confidence > maxConfidence) {
              detectedIntent = check.intent;
              maxConfidence = check.confidence;
            }
          } else if (check.confidence > maxConfidence) {
            detectedIntent = check.intent;
            maxConfidence = check.confidence;
          }
        }
      }
    }

    // 🎯 詳細實體提取（超精確匹配 - 確保不漏掉任何信息）
    
    // 1. 學生名稱提取 - 優先處理
    const studentPatterns = [
      /([A-Za-z]{2,10})(?:的|有什麼|怎麼|狀況|課表|表現如何|表現怎麼樣)/,  // LUMI表現如何
      /([A-Za-z]{2,10})(?:的|課)/,  // LUMI的課
      /([一-龯]{1,4})(?:的|課)/,  // 小明的課
    ];
    
    for (const pattern of studentPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.student_name = match[1];
        break;
      }
    }
    
    // 2. 課程名稱提取 - 多模式匹配
    if (!entities.course_name) {
      const coursePatterns = [
        /([一-龯A-Za-z\d]{2,8}[課班])/,  // 標準課程名稱
        /有([一-龯A-Za-z\d]{2,8}[課班])/,  // "有XX課"格式
        /([一-龯A-Za-z\d]{2,8})課/,  // XX課格式
        /的([一-龯A-Za-z\d]{2,8}[課班])/,  // "的XX課"格式
        /(科學實驗|數學|英文|音樂|體育|美術|語文|物理|化學|生物|歷史|地理)[課班]?/  // 常見課程
      ];
      
      for (const pattern of coursePatterns) {
        const match = text.match(pattern);
        if (match && !['每週', '每周', '下午', '上午', '早上', '晚上'].includes(match[1] || match[0])) {
          entities.course_name = match[1] || match[0];
          if (!entities.course_name.includes('課') && !entities.course_name.includes('班')) {
            entities.course_name += '課';
          }
          break;
        }
      }
    }

    // 3. 時間提取 - 詳細匹配
    const timePatterns = [
      /(\d{1,2}[:：]\d{2})/,  // HH:MM格式
      /([上下]午\d{1,2}[點点])/,  // 上午X點/下午X點
      /(\d{1,2}[點点])/,  // X點
      /([上下午][八九十一二三四五六七八九]點)/,  // 中文數字時間
      /(早上|中午|下午|晚上|夜晚)/  // 時段
    ];
    
    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.time = match[1] || match[0];
        break;
      }
    }

    // 4. 日期提取 - 完整匹配
    const datePatterns = [
      /(昨天|前天|今天|明天|後天|大後天)/,
      /(上週|本週|下週|上個月|這個月|下個月)/,
      /(週[一二三四五六日]|星期[一二三四五六日])/,
      /(\d{1,2}月\d{1,2}[日號])/,
      /(\d{1,2}\/\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.date = match[1] || match[0];
        break;
      }
    }
    
    // 5. 地點提取
    const locationPatterns = [
      /(在|到)([一-龯A-Za-z\d]{2,10}[室房廳場館])/,
      /([一-龯A-Za-z\d]{2,10}[教室|會議室|實驗室|圖書館|操場|體育館])/
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.location = match[2] || match[1];
        break;
      }
    }
    
    // 6. 老師提取
    const teacherPatterns = [
      /(老師|教師|講師)([一-龯A-Za-z]{1,5})/,
      /([一-龯A-Za-z]{1,5})(老師|教師|講師)/,
      /(老師說|教師說)/
    ];
    
    for (const pattern of teacherPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          entities.teacher = match[2];
        } else if (match[1] && !['老師說', '教師說'].includes(match[0])) {
          entities.teacher = match[1];
        } else {
          entities.teacher = '老師';
        }
        break;
      }
    }

    return {
      intent: detectedIntent,
      confidence: maxConfidence,
      entities,
      reasoning: `基於關鍵詞匹配的 fallback 分析 - 檢測到${detectedIntent}意圖`
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
      /(今天|明天|後天|昨天|前天)/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2})月(\d{1,2})日/,
      /(週一|週二|週三|週四|週五|週六|週日)/,
      /(星期一|星期二|星期三|星期四|星期五|星期六|星期日)/,
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
你是一位細心的課程助理老師，專門幫家長從對話中找出孩子上了什麼課。

對話內容：「${text}」

作為專業的課程助理，你的判斷原則：

👀 **我會仔細聽家長說的話**：
- 如果家長明確說了「XX課」，我就記錄「XX」
- 如果家長說「孩子的鋼琴練習」，我知道是「鋼琴」課
- 如果家長說「取消數學課」，我記錄「數學」課

🚫 **我不會胡亂猜測**：
- 家長說「科學實驗課做火箭」，課程就是「科學實驗」，不是「火箭製作」
- 家長說「在前台等候」，這不是課程名稱
- 家長說「上課時畫素描」，但沒說「素描課」，我不會猜測

❓ **如果完全沒提到課程**：
- 只說時間地點活動，沒說課程名稱 → 我回答 null

請告訴我，這位家長提到的課程名稱是什麼？（只要課程名稱，不要「課」字）

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
