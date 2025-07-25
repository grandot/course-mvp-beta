/**
 * Express 應用程式主入口
 * IntentOS Course MVP - LINE Bot Integration
 */
const express = require('express');
const lineController = require('./controllers/lineController');

const app = express();

// 中間件配置 - 為 LINE webhook 保留原始 body
app.use('/callback', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 健康檢查端點
app.get('/health', lineController.healthCheck);

// LINE Webhook 端點
app.post('/callback', lineController.webhook);

// 基本路由
app.get('/', (req, res) => {
  res.json({
    service: 'IntentOS Course MVP',
    version: '1.0.0',
    status: 'running',
  });
});

// 錯誤處理中間件
app.use((err, req, res) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
