/**
 * 語意控制器類型定義
 * 證據驅動決策系統的核心類型結構
 */

// === 基礎類型 ===

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// === AI 分析結果結構 ===

export interface Evidence {
  temporal_clues: string[];        // 時間線索：上次、昨天、之前
  mood_indicators: string[];       // 語氣指標：怎麼樣、好嗎
  action_verbs: string[];          // 動作詞：上得、記錄了
  question_markers: string[];      // 疑問標記：嗎、怎麼樣、是否
}

export interface ReasoningChain {
  step1?: string;
  step2?: string;
  step3?: string;
  step4?: string;
  step5?: string;
  confidence_source: string;       // 信心來源說明
}

export interface AIConfidence {
  overall: number;                 // 整體信心 0-1
  intent_certainty: number;        // 意圖判斷信心 0-1
  context_understanding: number;   // 語境理解信心 0-1
}

export interface AIAnalysisParams {
  userText: string;
  conversationHistory?: Message[];
}

export interface AIAnalysisResult {
  intent: string;
  entities: Record<string, any>;
  evidence: Evidence;
  reasoning_chain: ReasoningChain;
  confidence: AIConfidence;
}

// === Regex 分析結果結構 ===

export interface MatchDetails {
  triggered_patterns: string[];    // 觸發的模式
  keyword_matches: string[];       // 匹配的關鍵詞
  ambiguous_terms: string[];       // 可能有歧義的詞
  pattern_strength: number;        // 模式匹配強度 0-1
}

export interface RegexLimitations {
  context_blind: boolean;          // 是否忽略上下文
  temporal_blind: boolean;         // 是否忽略時間線索
  mood_blind: boolean;            // 是否忽略語氣
}

export interface RegexAnalysisResult {
  intent: string;
  entities: Record<string, any>;
  match_details: MatchDetails;
  limitations: RegexLimitations;
}

// === 控制器決策結果結構 ===

export interface DebugInfo {
  ai_analysis: AIAnalysisResult;
  regex_analysis: RegexAnalysisResult;
  decision_path: string[];         // 決策路徑追蹤
  execution_time: string;          // 執行時間
}

export interface SemanticDecisionResult {
  final_intent: string;
  source: 'ai' | 'regex' | 'fallback';
  reason: string;                  // 決策理由
  used_rule?: string;              // 使用的規則 P1-P5
  confidence: number;
  suggestion?: string;             // Fallback時的建議
  entities?: Record<string, any>;
  debug_info?: DebugInfo;         // Debug模式時的詳細信息
}

// === 決策規則枚舉 ===

export enum DecisionRule {
  P1_MOOD_CONFLICT = 'P1',        // 語氣與意圖衝突
  P2_TEMPORAL_CLUES = 'P2',       // 時間線索存在
  P3_AI_REASONING_COMPLETE = 'P3', // AI推理鏈完整
  P4_REGEX_STRONG_MATCH = 'P4',   // Regex強匹配
  P5_DEFAULT_AI = 'P5'            // 默認保守策略
}

// === 控制器配置 ===

export interface SemanticControllerConfig {
  debug: boolean;                  // 是否開啟Debug模式
  ai_confidence_threshold: number; // AI信心分數閾值
  regex_strength_threshold: number; // Regex強度閾值
  fallback_threshold: number;      // Fallback觸發閾值
}

// === 分析服務介面 ===

export interface ISemanticService {
  analyzeByOpenAI(params: AIAnalysisParams): Promise<AIAnalysisResult>;
  analyzeByRegex(userText: string): Promise<RegexAnalysisResult>;
}

export interface ISemanticController {
  route(userText: string, conversationHistory?: Message[], config?: Partial<SemanticControllerConfig>): Promise<SemanticDecisionResult>;
}

// === 語意映射重構相關類型 ===

/**
 * Intent 映射結果
 */
export interface IntentMappingResult {
  mapped_intent: string;
  original_intent: string;
  mapping_source: 'direct' | 'fallback' | 'none';
  confidence: number;
}

/**
 * Entity 映射結果
 */
export interface EntityMappingResult {
  mapped_entities: Record<string, any>;
  original_entities: Record<string, any>;
  key_mappings: Record<string, string>;
  value_mappings: Record<string, any>;
  unmapped_keys: string[];
}

/**
 * 標準化結果
 */
export interface NormalizationResult {
  intent: IntentMappingResult;
  entities: EntityMappingResult;
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 映射配置介面
 */
export interface MappingConfig {
  strict_mode: boolean;           // 嚴格模式：未映射項目報錯
  fallback_enabled: boolean;      // 啟用fallback模式
  log_unmapped: boolean;          // 記錄未映射項目
  validation_enabled: boolean;    // 啟用格式驗證
}

/**
 * 語意標準化器介面
 */
export interface ISemanticNormalizer {
  normalizeIntent(intent: string, config?: Partial<MappingConfig>): IntentMappingResult;
  normalizeEntities(entities: Record<string, any>, config?: Partial<MappingConfig>): EntityMappingResult;
  normalize(result: AIAnalysisResult | RegexAnalysisResult, config?: Partial<MappingConfig>): NormalizationResult;
}

/**
 * 統一語意網關介面
 */
export interface IUnifiedSemanticGateway {
  analyze(text: string, userId: string, context?: any): Promise<SemanticDecisionResult>;
  checkSmartQuery(text: string, userId: string): Promise<SemanticDecisionResult | null>;
  callUnifiedOpenAI(text: string, context?: any): Promise<AIAnalysisResult>;
  callRegex(text: string): Promise<RegexAnalysisResult>;
}

/**
 * 標準Intent枚舉（系統內部使用）
 */
export enum StandardIntent {
  RECORD_COURSE = 'record_course',
  CREATE_RECURRING_COURSE = 'create_recurring_course',
  MODIFY_COURSE = 'modify_course',
  MODIFY_RECURRING_COURSE = 'modify_recurring_course',
  CANCEL_COURSE = 'cancel_course',
  STOP_RECURRING_COURSE = 'stop_recurring_course',
  QUERY_SCHEDULE = 'query_schedule',
  CLEAR_SCHEDULE = 'clear_schedule',
  QUERY_TODAY_COURSES_FOR_CONTENT = 'query_today_courses_for_content',
  SET_REMINDER = 'set_reminder',
  RECORD_LESSON_CONTENT = 'record_lesson_content',
  RECORD_HOMEWORK = 'record_homework',
  UPLOAD_CLASS_PHOTO = 'upload_class_photo',
  QUERY_COURSE_CONTENT = 'query_course_content',
  MODIFY_COURSE_CONTENT = 'modify_course_content',
  CORRECTION_INTENT = 'correction_intent',
  UNKNOWN = 'unknown'
}

/**
 * 標準Entity鍵名枚舉
 */
export enum StandardEntityKey {
  COURSE_NAME = 'course_name',
  STUDENT_NAME = 'student_name',
  TEACHER = 'teacher', 
  LOCATION = 'location',
  DATE = 'date',
  TIME = 'time',
  START_TIME = 'start_time',
  END_TIME = 'end_time',
  TIME_INFO = 'timeInfo',
  CONTENT = 'content',
  HOMEWORK = 'homework',
  PHOTOS = 'photos',
  PERFORMANCE = 'performance',
  TEACHER_FEEDBACK = 'teacher_feedback',
  CONFIRMATION = 'confirmation',
  ORIGINAL_USER_INPUT = 'originalUserInput',
  RAW_TEXT = 'raw_text',
  DATE_PHRASE = 'date_phrase',
  TIME_PHRASE = 'time_phrase',
  CONTENT_ENTITIES = 'content_entities'
}

/**
 * 標準化的語意分析結果（統一格式）
 */
export interface StandardSemanticResult {
  intent: StandardIntent;
  entities: Record<StandardEntityKey, any>;
  confidence: number;
  source: 'ai' | 'regex' | 'fallback';
  normalization_applied: boolean;
  original_result?: AIAnalysisResult | RegexAnalysisResult;
  debug_info?: {
    original_intent: string;
    mapping_source: string;
    normalizer_version: string;
    processing_time_ms: number;
  };
}