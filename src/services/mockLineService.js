/**
 * Mock LINE Messaging API 服務
 * 專用於測試環境，模擬 LINE API 回應
 *
 * 重要：此檔案只在測試環境中使用，不會影響生產環境
 */

/**
 * Mock LINE Service 類別
 * 提供與 lineService.js 相同的介面，但不實際調用 LINE API
 */
class MockLineService {
  constructor() {
    console.log('🧪 Mock LINE Service 初始化（測試模式）');
  }

  /**
   * 模擬回覆訊息
   */
  async replyMessage(replyToken, message, quickReply = null) {
    console.log('📤 Mock LINE API - 回覆訊息');
    console.log('🎫 Reply Token:', replyToken);

    // 🏷️ 為訊息添加MOCK標記
    let markedMessage;
    if (typeof message === 'string') {
      markedMessage = `[MOCK測試回應] ${message}`;
    } else {
      markedMessage = {
        ...message,
        text: `[MOCK測試回應] ${message.text || JSON.stringify(message)}`,
      };
    }

    console.log('💬 訊息內容:', typeof markedMessage === 'string' ? markedMessage : JSON.stringify(markedMessage, null, 2));

    if (quickReply && quickReply.length > 0) {
      console.log('🔘 Quick Reply 選項:', quickReply.map((item) => item.label || item.text).join(', '));
    }

    // 模擬成功回應（包含標記後的訊息）
    const response = {
      success: true,
      mockResponse: true,
      data: {
        sentMessages: [markedMessage],
        quickReply: quickReply || null,
        timestamp: new Date().toISOString(),
      },
    };

    // 模擬網路延遲（可選）
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('✅ Mock 回覆成功');
    return response;
  }

  /**
   * 模擬推播訊息
   */
  async pushMessage(userId, message) {
    console.log('📤 Mock LINE API - 推播訊息');
    console.log('👤 目標用戶:', userId);
    console.log('💬 推播內容:', typeof message === 'string' ? message : JSON.stringify(message, null, 2));

    // 模擬成功回應
    const response = {
      success: true,
      mockResponse: true,
      data: {
        userId,
        sentMessages: [message],
        timestamp: new Date().toISOString(),
      },
    };

    // 模擬網路延遲
    await new Promise((resolve) => setTimeout(resolve, 150));

    console.log('✅ Mock 推播成功');
    return response;
  }

  /**
   * 模擬群組訊息推播
   */
  async pushMessageToGroup(groupId, message) {
    console.log('📤 Mock LINE API - 群組推播');
    console.log('👥 目標群組:', groupId);
    console.log('💬 訊息內容:', message);

    const response = {
      success: true,
      mockResponse: true,
      data: {
        groupId,
        sentMessages: [message],
        timestamp: new Date().toISOString(),
      },
    };

    await new Promise((resolve) => setTimeout(resolve, 120));

    console.log('✅ Mock 群組推播成功');
    return response;
  }

  /**
   * 模擬多媒體訊息回覆
   */
  async replyWithMedia(replyToken, mediaType, mediaUrl, altText = '多媒體內容') {
    console.log('📤 Mock LINE API - 多媒體回覆');
    console.log('🎫 Reply Token:', replyToken);
    console.log('🖼️ 媒體類型:', mediaType);
    console.log('🔗 媒體 URL:', mediaUrl);
    console.log('📝 替代文字:', altText);

    const response = {
      success: true,
      mockResponse: true,
      data: {
        mediaType,
        mediaUrl,
        altText,
        timestamp: new Date().toISOString(),
      },
    };

    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log('✅ Mock 多媒體回覆成功');
    return response;
  }

  /**
   * 模擬使用者資料獲取
   */
  async getUserProfile(userId) {
    console.log('👤 Mock LINE API - 獲取用戶資料');
    console.log('🆔 用戶 ID:', userId);

    // 模擬用戶資料
    const mockProfile = {
      userId,
      displayName: `測試用戶_${userId.slice(-4)}`,
      pictureUrl: 'https://example.com/mock-avatar.jpg',
      statusMessage: '這是測試用戶的狀態訊息',
      language: 'zh-TW',
    };

    const response = {
      success: true,
      mockResponse: true,
      data: mockProfile,
    };

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('✅ Mock 用戶資料獲取成功:', mockProfile.displayName);
    return response;
  }

  /**
   * 模擬統計資訊獲取
   */
  getStats() {
    return {
      service: 'mockLineService',
      mode: 'testing',
      callCount: this.callCount || 0,
      lastCall: this.lastCall || null,
      enabled: true,
    };
  }

  /**
   * 模擬健康檢查
   */
  async healthCheck() {
    console.log('🏥 Mock LINE Service 健康檢查');

    return {
      status: 'healthy',
      service: 'mockLineService',
      version: '1.0.0',
      mockMode: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 驗證是否為測試環境
   */
  static validateTestEnvironment() {
    if (process.env.NODE_ENV === 'production' && process.env.USE_MOCK_LINE_SERVICE === 'true') {
      throw new Error('❌ 錯誤：生產環境不能使用 Mock LINE Service');
    }

    if (!process.env.USE_MOCK_LINE_SERVICE) {
      console.warn('⚠️ 警告：USE_MOCK_LINE_SERVICE 未設定，建議明確指定');
    }

    return true;
  }
}

// 建立單例實例
const mockLineService = new MockLineService();

// 驗證環境（安全檢查）
MockLineService.validateTestEnvironment();

module.exports = mockLineService;
