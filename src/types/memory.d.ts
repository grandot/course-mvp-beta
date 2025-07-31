/**
 * 三層語意記憶系統 - TypeScript 類型定義
 * 提供完整的類型安全和 IDE 支援
 */

// ==================== 核心記憶結構 ====================

/**
 * 用戶記憶主結構 - 每個用戶獨立的 YAML 檔案
 */
export interface UserMemory {
  /** 用戶唯一識別ID */
  userId: string;
  /** 學生資訊對象，key為學生姓名 */
  students: Record<string, StudentInfo>;
  /** 最近活動記錄 (最多20筆) */
  recentActivities: RecentActivity[];
  /** 重複模式識別 */
  recurringPatterns: RecurringPattern[];
  /** ISO格式最後更新時間 */
  lastUpdated: string;
}

/**
 * 學生相關資訊
 */
export interface StudentInfo {
  /** 該學生的課程記錄 */
  courses: CourseRecord[];
  /** 學生偏好設定 */
  preferences: StudentPreferences;
}

/**
 * 課程記錄 - Memory.yaml 核心數據結構
 */
export interface CourseRecord {
  /** 課程名稱 (必填) */
  courseName: string;
  /** 課程時間安排 */
  schedule: ScheduleInfo;
  /** 授課老師 */
  teacher?: string;
  /** 上課地點 */
  location?: string;
  /** 課程備註 */
  notes?: string;
  /** 提到次數，用於重要性排序 (預設1) */
  frequency: number;
  /** 最後提及時間 (ISO格式) */
  lastMentioned?: string;
}

/**
 * 課程時間安排資訊
 */
export interface ScheduleInfo {
  /** 具體日期 YYYY-MM-DD */
  date?: string;
  /** 時間 HH:MM 格式 */
  time?: string;
  /** 重複類型 */
  recurring?: 'weekly' | 'monthly' | 'once';
  /** 週幾 (0=週日, 1=週一, ..., 6=週六) */
  dayOfWeek?: number;
  /** 時間描述 (如: "每週三下午") */
  description?: string;
}

/**
 * 學生偏好設定
 */
export interface StudentPreferences {
  /** 高頻課程列表 */
  frequentCourses: string[];
  /** 偏好時間格式 (12h/24h) */
  preferredTimeFormat?: '12h' | '24h';
  /** 其他預設設定 */
  defaultSettings?: Record<string, any>;
}

// ==================== 活動和模式 ====================

/**
 * 最近活動記錄
 */
export interface RecentActivity {
  /** 活動唯一ID */
  activityId: string;
  /** 活動類型 */
  activityType: 'create' | 'modify' | 'cancel' | 'query';
  /** 相關學生 */
  studentName: string;
  /** 相關課程 */
  courseName: string;
  /** 活動時間戳 */
  timestamp: string;
  /** 額外元數據 */
  metadata?: Record<string, any>;
}

/**
 * 重複模式識別
 */
export interface RecurringPattern {
  /** 模式唯一ID */
  patternId: string;
  /** 學生姓名 */
  studentName: string;
  /** 課程名稱 */
  courseName: string;
  /** 模式類型 */
  patternType: 'weekly' | 'monthly';
  /** 重複時間規律 */
  schedule: Record<string, any>;
  /** 模式置信度 (0-1) */
  confidence: number;
  /** 模式建立時間 */
  createdAt: string;
}

// ==================== 操作結果和摘要 ====================

/**
 * Memory.yaml 操作結果
 */
export interface MemoryOperationResult {
  /** 操作是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  error?: string;
  /** 返回數據 */
  data?: any;
  /** 當前記錄數量 */
  recordCount: number;
}

/**
 * GPT Fallback 記憶摘要格式
 */
export interface MemorySummary {
  /** 用戶ID */
  userId: string;
  /** 學生摘要 */
  students: Record<string, StudentSummary>;
  /** 最近模式描述 */
  recentPatterns: string[];
  /** 格式化的GPT可讀文本 */
  formattedText: string;
}

/**
 * 學生記憶摘要
 */
export interface StudentSummary {
  /** 學生姓名 */
  name: string;
  /** 課程列表 */
  courses: string[];
  /** 時間安排列表 */
  schedules: string[];
  /** 總課程數 */
  totalCourses: number;
}

// ==================== 驗證和配置 ====================

/**
 * 數據驗證結果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 錯誤列表 */
  errors: string[];
}

/**
 * 業務需求一致性檢查結果
 */
export interface ConsistencyCheckResult {
  /** 是否符合要求 */
  valid: boolean;
  /** 發現的問題 */
  issues: string[];
  /** 改進建議 */
  recommendations: string[];
  /** 總記錄數 */
  totalRecords: number;
  /** 摘要長度 */
  summaryLength: number;
}

/**
 * Memory.yaml 服務配置
 */
export interface MemoryServiceConfig {
  /** 最大記錄數量 */
  maxRecords: number;
  /** 快取 TTL (毫秒) */
  cacheTTL: number;
  /** YAML 檔案存儲路徑 */
  storagePath: string;
  /** 自動清理間隔 (毫秒) */
  cleanupInterval: number;
}

// ==================== 三層記憶系統介面 ====================

/**
 * 三層語意記憶系統主介面
 */
export interface LongMemorySystem {
  /** Layer 1: ConversationContext (現有，需增強) */
  conversationContext: {
    storage: Map<string, ConversationState>;
    ttl: number;
    updateTriggers: string[];
  };
  
  /** Layer 2: Memory.yaml (新增) */
  memoryYaml: {
    storage: Map<string, UserMemory>;
    maxRecords: number;
    updateSchedule: string;
    contentTypes: string[];
  };
  
  /** Layer 3: SmartQueryEngine (新增) */
  smartQueryEngine: {
    realTimeQuery: boolean;
    explicitDataResponse: boolean;
    firebaseIntegration: boolean;
  };
  
  /** 🧠 智能分流引擎 */
  intelligentRouting: {
    regexFirst: RegexSlotExtractor;
    gptFallback: OpenAIFallbackEngine;
    memoryInjection: MemoryInjectionEngine;
  };
}

/**
 * 對話狀態 (ConversationContext)
 */
export interface ConversationState {
  lastAction?: string;
  lastCourse?: string;
  lastStudent?: string;
  lastTime?: string;
  lastLocation?: string;
  timestamp: number;
}

/**
 * Regex Slot 提取器
 */
export interface RegexSlotExtractor {
  extractWithContext(text: string, context?: ConversationState): Promise<SlotExtractionResult>;
}

/**
 * OpenAI Fallback 引擎
 */
export interface OpenAIFallbackEngine {
  fallbackWithMemory(
    text: string, 
    context: ConversationState, 
    memory: UserMemory, 
    partialSlots: any
  ): Promise<any>;
}

/**
 * 記憶注入引擎
 */
export interface MemoryInjectionEngine {
  injectMemoryToPrompt(userMemory: UserMemory): string;
}

/**
 * Slot 提取結果
 */
export interface SlotExtractionResult {
  slots: Record<string, any>;
  complete: boolean;
  partialSlots: Record<string, any>;
  sources?: Record<string, string>;
}

// ==================== 匯出類型工具 ====================

/**
 * 創建空的用戶記憶
 */
export function createEmptyUserMemory(userId: string): UserMemory;

/**
 * 創建課程記錄
 */
export function createCourseRecord(
  courseName: string,
  schedule: Partial<ScheduleInfo>,
  options?: Partial<CourseRecord>
): CourseRecord;

/**
 * 驗證用戶記憶數據
 */
export function validateUserMemory(memory: UserMemory): ValidationResult;

/**
 * 檢查業務需求一致性
 */
export function checkBusinessConsistency(memory: UserMemory): ConsistencyCheckResult;