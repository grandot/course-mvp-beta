// 統一載入環境變數與預設值

require('dotenv').config();

function getEnv(name, fallback = null) {
  const val = process.env[name];
  return (val === undefined || val === '') ? fallback : val;
}

const config = {
  render: {
    url: getEnv('RENDER_URL', 'https://course-mvp-beta.onrender.com'),
    serviceId: getEnv('RENDER_SERVICE_ID', 'srv-d21f9u15pdvs73frvns0'),
  },
  line: {
    channelAccessToken: getEnv('LINE_CHANNEL_ACCESS_TOKEN', ''),
    channelSecret: getEnv('LINE_CHANNEL_SECRET', ''),
  },
  redis: {
    url: getEnv('REDIS_URL', ''),
  },
  firebase: {
    projectId: getEnv('FIREBASE_PROJECT_ID', ''),
    clientEmail: getEnv('FIREBASE_CLIENT_EMAIL', ''),
    privateKey: getEnv('FIREBASE_PRIVATE_KEY', ''),
  },
  features: {
    enableRecurringCourses: getEnv('ENABLE_RECURRING_COURSES', 'false') === 'true' || getEnv('ENABLE_DAILY_RECURRING', 'false') === 'true',
    enableDailyRecurring: getEnv('ENABLE_DAILY_RECURRING', 'false') === 'true', // 向後兼容
    enableAiFallback: getEnv('ENABLE_AI_FALLBACK', 'false') === 'true',
  },
};

module.exports = config;
