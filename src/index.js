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

// 依賴服務健康檢查端點
app.get('/health/deps', async (req, res) => {
  const checks = {};
  
  try {
    // 檢查 Redis 連接
    try {
      const { redisClient } = require('./services/redisService');
      await redisClient.ping();
      checks.redis = { status: 'ok', message: 'Redis連接正常' };
    } catch (error) {
      checks.redis = { status: 'error', message: error.message };
    }

    // 檢查 Firebase 連接
    try {
      const firebaseService = require('./services/firebaseService');
      const testResult = await firebaseService.healthCheck();
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

    const overallStatus = Object.values(checks).some(check => check.status === 'error') ? 'error' : 'ok';
    
    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
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
