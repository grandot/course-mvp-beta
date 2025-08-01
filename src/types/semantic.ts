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