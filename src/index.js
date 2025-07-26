/**
 * IntentOS Course MVP 啟動入口
 * Phase 5: LINE Bot Integration + Scenario Manager 優化
 */
require('dotenv').config();
const app = require('./app');
const ScenarioManager = require('./scenario/ScenarioManager');

const PORT = process.env.PORT || 3000;

// 啟動應用程序
async function startServer() {
  try {
    // 🎯 Phase 1: 初始化 ScenarioManager（一次性預加載）
    console.log('🏭 Initializing Scenario Manager...');
    await ScenarioManager.initialize();
    
    // 啟動服務器
    const server = app.listen(PORT, () => {
      console.log(`🚀 IntentOS Course MVP running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 LINE Webhook: http://localhost:${PORT}/callback`);
      
      // 顯示 ScenarioManager 狀態
      const status = ScenarioManager.getStatus();
      console.log(`🎯 Loaded scenarios: ${status.loadedScenarios.join(', ')}`);
      console.log(`⚡ Current scenario: ${process.env.SCENARIO_TYPE || 'course_management'}`);
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// 啟動服務器
const serverPromise = startServer();

// 優雅關閉
async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  
  try {
    const server = await serverPromise;
    server.close(() => {
      console.log('✅ Server closed');
      console.log('🔧 Cleaning up ScenarioManager...');
      ScenarioManager.clearCache();
      console.log('✅ Process terminated');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
