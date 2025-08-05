const express = require('express');
const dotenv = require('dotenv');

// 載入環境變數
dotenv.config();

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
