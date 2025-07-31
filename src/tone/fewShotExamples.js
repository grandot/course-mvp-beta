/**
 * Unified Few-Shot Examples Library - 統一溫暖活潑對話範例庫
 * 🎯 第一性原則重構：移除多風格選擇，統一溫暖活潑語氣
 * 
 * 核心原則：
 * - 固定溫暖活潑語氣風格
 * - 確保用戶體驗一致性
 * - 簡化管理複雜度
 */

/**
 * 統一語氣的場景範例 - 溫暖活潑風格
 */
const UNIFIED_EXAMPLES = {
  // 新增課程場景
  new_course: [
    {
      user: "明天下午兩點鋼琴課",
      bot: "太好了！已為你安排明天下午兩點的鋼琴課喔～需要提醒嗎？🎹"
    },
    {
      user: "每週三都有游泳課",
      bot: "很棒！已經記下「每週三」的游泳課囉～幾點開始呢？😊"
    },
    {
      user: "小美明天有大提琴課",
      bot: "好的～已記錄小美明天的大提琴課，請問是幾點呢？🎻"
    }
  ],

  // 延續任務場景
  follow_up: [
    {
      user: "再來",
      bot: "好的～還有什麼課程要安排嗎？😊"
    },
    {
      user: "也幫我",
      bot: "沒問題！請告訴我要安排什麼課程喔～✨"
    },
    {
      user: "還有小明的",
      bot: "好的～要為小明安排什麼課程呢？"
    }
  ],

  // 補充信息場景
  need_info: [
    {
      user: "下午兩點",
      bot: "✅ 已記錄：下午兩點\n還需要確認上課日期喔～比如：明天、後天、7月30日 😊"
    },
    {
      user: "明天",
      bot: "✅ 已記錄：明天的課程\n還需要確認上課時間呢～例如：下午3點、晚上7點半 🕐"
    },
    {
      user: "小美",
      bot: "✅ 已記錄：小美的課程\n還需要確認課程名稱喔～例如：大提琴課、小提琴課、鋼琴課 📚"
    }
  ],

  // 閒聊轉回正題場景
  chat_redirect: [
    {
      user: "你吃飯了嗎",
      bot: "謝謝關心～我是協助課程管理的助理喔！有什麼課程需要安排嗎？😊"
    },
    {
      user: "今天天氣好好",
      bot: "是呢！天氣好的日子很適合上課～有要安排課程嗎？☀️"
    },
    {
      user: "你好",
      bot: "你好！我是你的課程管理助理，很高興為你服務～有什麼課程需要安排嗎？✨"
    }
  ],

  // 錯誤處理場景
  error_handling: [
    {
      user: "昨天下午3點鋼琴課",
      bot: "課程時間不能安排在過去喔～要不要改成明天下午3點呢？😊"
    },
    {
      user: "下星期某天上課",
      bot: "需要更具體的日期才能幫你安排喔～比如說「下週一」或「7月30日」這樣？"
    },
    {
      user: "上課",
      bot: "好的～請告訴我更詳細的課程資訊，比如：什麼課程、什麼時候、哪位同學？😊"
    }
  ],

  // 成功完成場景
  success: [
    {
      user: "",
      bot: "太好了！✨ 課程已成功安排！\n📚 課程：{course_name}\n👶 學生：{student_name}\n📅 時間：{datetime}\n還有其他課程要安排嗎？😊"
    },
    {
      user: "",
      bot: "完成啦！🎉 所有資訊都收集完畢～正在為你安排課程中..."
    },
    {
      user: "",
      bot: "搞定！已為你安排好課程，還需要其他協助嗎？🌟"
    }
  ]
};

/**
 * UnifiedFewShotManager - 統一Few-Shot範例管理器
 * 🎯 第一性原則：固定溫暖活潑風格，簡化選擇邏輯
 */
class UnifiedFewShotManager {
  constructor() {
    this.examples = UNIFIED_EXAMPLES;
    
    // 簡化統計資訊
    this.stats = {
      exampleRequests: 0,
      scenarioUsage: {}
    };
    
    console.log('[UnifiedFewShotManager] 初始化完成 - 統一溫暖活潑範例');
  }

  /**
   * 獲取統一風格範例
   * 🎯 簡化邏輯：固定溫暖活潑風格，按場景返回範例
   * @param {string} scenario - 場景類型
   * @param {number} maxCount - 最大範例數
   * @returns {Array} 範例陣列
   */
  getExamples(scenario = 'new_course', maxCount = 3) {
    this.stats.exampleRequests++;
    this.updateStats('scenarioUsage', scenario);
    
    // 獲取對應場景的範例，如果不存在則使用預設場景
    const scenarioExamples = this.examples[scenario] || this.examples.new_course;
    const selectedExamples = scenarioExamples.slice(0, maxCount);
    
    console.log(`[UnifiedFewShotManager] 獲取統一範例 - 場景: ${scenario}, 數量: ${selectedExamples.length}`);
    
    return selectedExamples;
  }

  /**
   * 獲取所有可用場景
   * @returns {Array} 場景名稱陣列
   */
  getAvailableScenarios() {
    return Object.keys(this.examples);
  }

  /**
   * 更新統計資訊
   * @param {string} category - 統計分類
   * @param {string} key - 統計鍵值
   */
  updateStats(category, key) {
    if (!this.stats[category]) {
      this.stats[category] = {};
    }
    this.stats[category][key] = (this.stats[category][key] || 0) + 1;
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      totalScenarios: Object.keys(this.examples).length,
      totalExamples: Object.values(this.examples)
        .reduce((total, examples) => total + examples.length, 0)
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      exampleRequests: 0,
      scenarioUsage: {}
    };
    console.log('[UnifiedFewShotManager] 統計資訊已重置');
  }
}

// 向後兼容
const FewShotExamplesManager = UnifiedFewShotManager;

module.exports = {
  UnifiedFewShotManager,
  FewShotExamplesManager, // 向後兼容
  UNIFIED_EXAMPLES
};