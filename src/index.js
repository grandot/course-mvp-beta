const express = require('express');
const dotenv = require('dotenv');

// 載入環境變數
dotenv.config();

// 🛡️ 重要安全檢查：防止生產環境使用 Mock Service
if (process.env.NODE_ENV === 'production' && process.env.USE_MOCK_LINE_SERVICE === 'true') {
  console.error('❌ 嚴重錯誤：生產環境不能使用 Mock LINE Service');
  console.error('   請檢查環境變數 USE_MOCK_LINE_SERVICE 設定');
  console.error('   生產環境此變數應為空或 false');
  process.exit(1);
}

// 顯示當前環境配置
console.log('🚀 應用程式啟動中...');
console.log(`📍 環境: ${process.env.NODE_ENV || 'development'}`);
console.log(`🤖 LINE Service: ${process.env.USE_MOCK_LINE_SERVICE === 'true' ? 'Mock (測試)' : 'Real (生產)'}`);
if (process.env.USE_MOCK_LINE_SERVICE === 'true') {
  console.log('🧪 測試模式：使用 Mock LINE Service');
}

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件設置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LINE Bot webhook 路由
app.post('/webhook', async (req, res) => {
  try {
    const { handleWebhook } = require('./bot/webhook');
    await handleWebhook(req, res);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
  });
});

// 環境配置檢查端點
app.get('/debug/config', (req, res) => {
  res.json({
    ENABLE_AI_FALLBACK: process.env.ENABLE_AI_FALLBACK,
    NODE_ENV: process.env.NODE_ENV,
    has_openai_key: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Webhook 調試端點 - 檢查實際請求數據
app.post('/debug/webhook', async (req, res) => {
  try {
    console.log('🔍 Webhook 調試請求:', JSON.stringify(req.body, null, 2));

    const { events } = req.body;
    if (events && events.length > 0) {
      const event = events[0];
      const userId = event.source ? event.source.userId : 'unknown';

      console.log('📋 實際用戶ID:', userId);
      console.log('📋 用戶ID類型:', typeof userId);
      console.log('📋 是否以 U_test_ 開頭:', userId && userId.startsWith('U_test_'));

      const { getLineService } = require('./bot/webhook');
      const lineService = getLineService(userId);

      console.log('📋 選擇的服務類型:', lineService.constructor.name || 'Object');

      res.json({
        status: 'debug_success',
        userId,
        userIdType: typeof userId,
        isTestUser: userId && userId.startsWith('U_test_'),
        serviceType: lineService.constructor.name || 'Object',
        eventType: event.type,
        messageText: event.message ? event.message.text : 'no_message',
      });
    } else {
      res.json({ status: 'no_events', body: req.body });
    }
  } catch (error) {
    console.error('❌ Webhook 調試錯誤:', error);
    res.status(500).json({
      status: 'debug_error',
      message: error.message,
    });
  }
});

// LINE Service 選擇測試端點
app.post('/test/lineservice', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('🔍 測試 LINE Service 選擇:', userId);

    const { getLineService } = require('./bot/webhook');
    const lineService = getLineService(userId);

    console.log('📋 選擇的服務類型:', lineService.constructor.name);
    console.log('📋 是否為測試用戶:', userId && userId.startsWith('U_test_'));

    res.json({
      status: 'success',
      userId,
      isTestUser: userId && userId.startsWith('U_test_'),
      serviceType: lineService.constructor.name,
      hasReplyMethod: typeof lineService.replyMessage === 'function',
    });
  } catch (error) {
    console.error('❌ LINE Service 測試錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// Redis 連接測試端點
app.post('/test/redis', async (req, res) => {
  try {
    console.log('🔍 開始測試 Redis 連接...');

    const { getRedisService } = require('./services/redisService');
    const redisService = getRedisService();

    console.log('📋 Redis 配置存在:', !!redisService.config);
    console.log('📋 Redis URL:', redisService.config ? 'configured' : 'not configured');

    // 嘗試連接並測試
    const connected = await redisService.connect();
    console.log('🔗 連接結果:', connected);

    if (connected && redisService.client) {
      // 測試基本操作
      const testKey = `test:${Date.now()}`;
      await redisService.set(testKey, 'test-value', 10);
      const value = await redisService.get(testKey);
      await redisService.delete(testKey);

      console.log('✅ Redis 測試成功');
      res.json({
        status: 'success',
        message: 'Redis 連接和操作正常',
        connected: true,
        testResult: { key: testKey, value },
      });
    } else {
      console.log('❌ Redis 連接失敗');
      res.json({
        status: 'failed',
        message: 'Redis 連接失敗',
        connected: false,
        config: !!redisService.config,
      });
    }
  } catch (error) {
    console.error('❌ Redis 測試錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test failed',
    });
  }
});

// 依賴服務健康檢查端點
app.get('/health/deps', async (req, res) => {
  const checks = {};

  try {
    // 檢查 Redis 連接
    try {
      const { getRedisService } = require('./services/redisService');
      const redisService = getRedisService();
      if (redisService && redisService.client) {
        await redisService.client.ping();
        checks.redis = { status: 'ok', message: 'Redis連接正常' };
      } else {
        checks.redis = { status: 'warning', message: 'Redis服務未初始化' };
      }
    } catch (error) {
      checks.redis = { status: 'error', message: error.message };
    }

    // 檢查 Firebase 連接
    try {
      const firebaseService = require('./services/firebaseService');
      const testResult = await firebaseService.testConnection();
      checks.firebase = { status: 'ok', message: 'Firebase連接正常', data: testResult };
    } catch (error) {
      checks.firebase = { status: 'error', message: error.message };
    }

    // 檢查 OpenAI 連接
    try {
      const openaiService = require('./services/openaiService');
      if (openaiService.client) {
        checks.openai = { status: 'ok', message: 'OpenAI服務已初始化' };
      } else {
        checks.openai = { status: 'warning', message: 'OpenAI服務未初始化' };
      }
    } catch (error) {
      checks.openai = { status: 'error', message: error.message };
    }

    // 檢查 Google Calendar 連接（OAuth/SA）
    try {
      const gcal = require('./services/googleCalendarService');
      const result = await gcal.testConnection();
      checks.gcal = result.ok
        ? { status: 'ok', message: 'Google Calendar連接正常', authMode: result.authMode }
        : { status: 'error', message: result.error || '連接失敗', authMode: result.authMode };
    } catch (error) {
      checks.gcal = { status: 'error', message: error.message };
    }

    const overallStatus = Object.values(checks).some((check) => check.status === 'error') ? 'error' : 'ok';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 單獨的 GCal 健康檢查（更易於外部快速驗證）
app.get('/health/gcal', async (req, res) => {
  try {
    const gcal = require('./services/googleCalendarService');
    const result = await gcal.testConnection();
    res.json({ status: result.ok ? 'ok' : 'error', authMode: result.authMode, timestamp: new Date().toISOString(), error: result.error || null });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message, timestamp: new Date().toISOString() });
  }
});

// 啟動服務器
async function startServer() {
  try {
    // 檢查環境變數
    const requiredEnvVars = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'OPENAI_API_KEY',
      'FIREBASE_PROJECT_ID',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
      console.warn('⚠️ 缺少環境變數:', missingVars.join(', '));
      console.warn('⚠️ 請檢查 .env 檔案設定');
    }

    app.listen(PORT, () => {
      console.log('🚀 課程管理機器人服務已啟動');
      console.log(`📡 服務端口: ${PORT}`);
      console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
      console.log(`❤️ 健康檢查: http://localhost:${PORT}/health`);
      console.log('---');

      if (missingVars.length === 0) {
        console.log('✅ 所有環境變數已設定完成');
      }
    });
  } catch (error) {
    console.error('❌ 服務啟動失敗:', error);
    process.exit(1);
  }
}

// 優雅關閉處理
process.on('SIGINT', () => {
  console.log('\n📴 正在關閉服務...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📴 正在關閉服務...');
  process.exit(0);
});

startServer();
