/**
 * Feature Flag 配置
 * 控制系統功能的啟用/關閉，支援分階段開發
 */

const FEATURES = {
  // === Phase 1: MVP 核心功能 (當前實現) ===
  BASIC_INTENT_RECOGNITION: {
    enabled: true,
    phase: 'Phase 1',
    description: '基礎意圖識別系統',
    status: 'active',
  },

  COURSE_MANAGEMENT: {
    enabled: true,
    phase: 'Phase 1',
    description: '課程新增/修改/查詢/取消',
    status: 'active',
  },

  GOOGLE_CALENDAR_INTEGRATION: {
    enabled: true,
    phase: 'Phase 1',
    description: 'Google Calendar API 整合',
    status: 'active',
  },

  LINE_BOT_WEBHOOK: {
    enabled: true,
    phase: 'Phase 1',
    description: 'LINE Bot 訊息處理',
    status: 'active',
  },

  RECURRING_COURSES: {
    enabled: process.env.ENABLE_RECURRING_COURSES === 'true' || process.env.ENABLE_DAILY_RECURRING === 'true',
    phase: 'Phase 1',
    description: '重複課程功能（每日、每週、每月）',
    status: (process.env.ENABLE_RECURRING_COURSES === 'true' || process.env.ENABLE_DAILY_RECURRING === 'true') ? 'active' : 'disabled',
    environmentVariable: 'ENABLE_RECURRING_COURSES',
    fallbackVariable: 'ENABLE_DAILY_RECURRING',
    defaultValue: 'false',
  },

  // === Phase 2: 高級對話管理 (未來實現) ===
  SLOT_TEMPLATE_SYSTEM: {
    enabled: false,
    phase: 'Phase 2',
    description: '企業級對話狀態管理與多輪對話',
    status: 'planned',
    readyForProduction: false,
    configFiles: [
      'config/future/slot-template-collections.json',
      'firestore.indexes.json (slot相關部分)',
    ],
  },

  MULTI_TURN_CONVERSATION: {
    enabled: false,
    phase: 'Phase 2',
    description: '多輪對話狀態追蹤',
    status: 'planned',
    dependencies: ['SLOT_TEMPLATE_SYSTEM'],
  },

  // === Phase 3: 企業級功能 (遠期規劃) ===
  MEMORY_SYSTEM: {
    enabled: false,
    phase: 'Phase 3',
    description: '三層記憶系統 (Context + YAML + SmartQuery)',
    status: 'planned',
    readyForProduction: false,
    configSource: 'src/config/production.js (memorySystem部分)',
  },

  ADVANCED_ANALYTICS: {
    enabled: false,
    phase: 'Phase 3',
    description: '對話分析與性能監控',
    status: 'planned',
    dependencies: ['SLOT_TEMPLATE_SYSTEM'],
  },

  PERFORMANCE_MONITORING: {
    enabled: false,
    phase: 'Phase 3',
    description: '系統監控與指標收集',
    status: 'planned',
  },
};

// 取得當前啟用的功能
function getEnabledFeatures() {
  return Object.entries(FEATURES)
    .filter(([, config]) => config.enabled)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

// 取得指定階段的功能
function getFeaturesByPhase(phase) {
  return Object.entries(FEATURES)
    .filter(([, config]) => config.phase === phase)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

// 檢查功能是否啟用
function isFeatureEnabled(featureName) {
  const feature = FEATURES[featureName];
  if (!feature) return false;

  // 如果功能依賴環境變數，動態檢查
  if (featureName === 'RECURRING_COURSES') {
    return process.env.ENABLE_RECURRING_COURSES === 'true' || process.env.ENABLE_DAILY_RECURRING === 'true';
  }

  return feature.enabled || false;
}

// 取得開發路徑圖
function getRoadmap() {
  const phases = {};
  Object.entries(FEATURES).forEach(([key, config]) => {
    if (!phases[config.phase]) {
      phases[config.phase] = [];
    }
    phases[config.phase].push({
      name: key,
      description: config.description,
      status: config.status,
      enabled: config.enabled,
    });
  });
  return phases;
}

// 取得環境變數狀態
function getEnvironmentStatus() {
  return {
    ENABLE_RECURRING_COURSES: {
      value: process.env.ENABLE_RECURRING_COURSES || 'false',
      enabled: process.env.ENABLE_RECURRING_COURSES === 'true',
      description: '重複課程功能開關（統一控制日週月）',
    },
    ENABLE_DAILY_RECURRING: {
      value: process.env.ENABLE_DAILY_RECURRING || 'false',
      enabled: process.env.ENABLE_DAILY_RECURRING === 'true',
      description: '每日重複課程功能開關（向後兼容）',
      deprecated: true,
    },
  };
}

module.exports = {
  FEATURES,
  getEnabledFeatures,
  getFeaturesByPhase,
  isFeatureEnabled,
  getRoadmap,
  getEnvironmentStatus,
};
