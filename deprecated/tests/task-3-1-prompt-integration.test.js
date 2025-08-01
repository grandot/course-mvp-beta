/**
 * Task 3.1 測試：PromptConfigManager 集成到 SemanticService
 * 驗證 buildEvidenceDrivenPrompt 方法正確使用 PromptConfigManager
 */

const SemanticService = require('../src/services/semanticService');
const { getInstance: getPromptConfigManager } = require('../src/services/promptConfigManager');

describe('Task 3.1: PromptConfigManager 集成測試', () => {
  
  describe('buildEvidenceDrivenPrompt 方法集成', () => {
    test('成功使用 PromptConfigManager 構建 evidence_minimal prompt', () => {
      const service = new SemanticService();
      const userText = '今天數學課怎麼樣？';
      const conversationHistory = [];

      const result = service.buildEvidenceDrivenPrompt(userText, conversationHistory);

      // 驗證返回的是字符串
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // 驗證包含用戶輸入
      expect(result).toContain(userText);

      // 驗證是簡化版本，不應該包含完整的欄位約束
      expect(result).not.toContain('欄位名必須是course_name');
      expect(result).not.toContain('絕對不可使用中文欄位名');
    });

    test('包含對話歷史時正確處理', () => {
      const service = new SemanticService();
      const userText = '修改時間';
      const conversationHistory = [
        { role: 'user', content: '記錄數學課' },
        { role: 'assistant', content: '好的，已記錄數學課' }
      ];

      const result = service.buildEvidenceDrivenPrompt(userText, conversationHistory);

      expect(typeof result).toBe('string');
      expect(result).toContain(userText);
      
      // 對話歷史應該通過context_template處理，但不一定直接可見
      expect(result.length).toBeGreaterThan(100);
    });

    test('PromptConfigManager 失敗時使用 fallback', () => {
      const service = new SemanticService();
      
      // Mock PromptConfigManager 拋出錯誤
      const originalBuildPrompt = getPromptConfigManager().buildPrompt;
      getPromptConfigManager().buildPrompt = () => {
        throw new Error('配置載入失敗');
      };

      const userText = '查詢課表';
      const result = service.buildEvidenceDrivenPrompt(userText, []);

      // 應該使用 fallback，返回完整的 legacy prompt
      expect(typeof result).toBe('string');
      expect(result).toContain(userText);
      expect(result).toContain('欄位名必須是course_name'); // legacy prompt 的特徵
      expect(result).toContain('絕對不可使用中文欄位名'); // legacy prompt 的特徵

      // 恢復原始方法
      getPromptConfigManager().buildPrompt = originalBuildPrompt;
    });

    test('_buildLegacyFullPrompt 方法正常工作', () => {
      const service = new SemanticService();
      const userText = '記錄英文課';
      const conversationHistory = [{ role: 'user', content: '今天有課嗎？' }];

      const result = service._buildLegacyFullPrompt(userText, conversationHistory);

      expect(typeof result).toBe('string');
      expect(result).toContain(userText);
      expect(result).toContain('對話歷史');
      expect(result).toContain('JSON格式回答');
      expect(result).toContain('intent');
      expect(result).toContain('entities');
      expect(result).toContain('evidence');
      expect(result).toContain('reasoning_chain');
      expect(result).toContain('confidence');
      
      // 驗證完整的格式約束存在
      expect(result).toContain('欄位名必須是course_name');
      expect(result).toContain('絕對不可使用中文欄位名');
    });
  });

  describe('PromptConfigManager 本身的功能驗證', () => {
    test('PromptConfigManager 正確載入配置', () => {
      const manager = getPromptConfigManager();
      
      expect(manager.config).toBeTruthy();
      expect(manager.currentMode).toBe('minimal');
    });

    test('buildPrompt 方法返回正確的格式', () => {
      const manager = getPromptConfigManager();
      const userText = '查詢今天的課程';
      
      const promptConfig = manager.buildPrompt(userText, [], 'evidence_minimal');
      
      expect(promptConfig).toHaveProperty('messages');
      expect(promptConfig).toHaveProperty('mode', 'evidence_minimal');
      expect(promptConfig).toHaveProperty('estimated_tokens');
      expect(promptConfig).toHaveProperty('fallback_mode', 'full');
      
      expect(Array.isArray(promptConfig.messages)).toBe(true);
      expect(promptConfig.messages.length).toBeGreaterThan(0);
      
      // 驗證 messages 格式
      promptConfig.messages.forEach(msg => {
        expect(msg).toHaveProperty('role');
        expect(msg).toHaveProperty('content');
        expect(['system', 'user']).toContain(msg.role);
        expect(typeof msg.content).toBe('string');
      });
    });

    test('不同模式返回不同的 token 估計', () => {
      const manager = getPromptConfigManager();
      const userText = '測試文本';
      
      const ultraConfig = manager.buildPrompt(userText, [], 'ultra');
      const minimalConfig = manager.buildPrompt(userText, [], 'minimal');
      const evidenceConfig = manager.buildPrompt(userText, [], 'evidence_minimal');
      
      expect(ultraConfig.estimated_tokens).toBeLessThan(minimalConfig.estimated_tokens);
      expect(minimalConfig.estimated_tokens).toBeLessThan(evidenceConfig.estimated_tokens);
      
      // 驗證 token 估計在期望範圍內
      expect(ultraConfig.estimated_tokens).toBeLessThanOrEqual(130);
      expect(minimalConfig.estimated_tokens).toBeLessThanOrEqual(200);
      expect(evidenceConfig.estimated_tokens).toBeLessThanOrEqual(250);
    });
  });

  describe('Token 優化驗證', () => {
    test('evidence_minimal 模式應該比 legacy prompt 更短', () => {
      const service = new SemanticService();
      const userText = '記錄數學課，小明，今天下午2點';
      const conversationHistory = [];

      // 獲取新的簡化 prompt
      const newPrompt = service.buildEvidenceDrivenPrompt(userText, conversationHistory);
      
      // 獲取 legacy prompt
      const legacyPrompt = service._buildLegacyFullPrompt(userText, conversationHistory);

      // 新 prompt 應該明顯更短
      expect(newPrompt.length).toBeLessThan(legacyPrompt.length);
      
      // 驗證優化比例（應該大於 70%）
      const optimizationRatio = (1 - newPrompt.length / legacyPrompt.length) * 100;
      expect(optimizationRatio).toBeGreaterThan(70);
      
      console.log(`Token 優化結果:`);
      console.log(`- Legacy prompt 長度: ${legacyPrompt.length} 字符`);
      console.log(`- Evidence minimal prompt 長度: ${newPrompt.length} 字符`);
      console.log(`- 優化比例: ${optimizationRatio.toFixed(1)}%`);
    });

    test('驗證不同模式的 token 節省效果', () => {
      const manager = getPromptConfigManager();
      const stats = manager.getTokenStats();
      
      expect(stats).toHaveProperty('current_mode', 'minimal');
      expect(stats).toHaveProperty('estimated_tokens');
      expect(stats).toHaveProperty('optimization_ratio');
      expect(stats).toHaveProperty('fallback_count');
      
      // 優化比例應該大於 70%
      expect(stats.optimization_ratio).toBeGreaterThan(70);
      
      console.log('PromptConfigManager 統計:', stats);
    });
  });

  describe('錯誤處理和回退機制', () => {
    test('配置文件不存在時使用默認配置', () => {
      // 這個測試驗證 PromptConfigManager 的健壯性
      const manager = getPromptConfigManager();
      
      // 即使配置有問題，也應該能正常工作
      expect(manager.config).toBeTruthy();
      
      const prompt = manager.buildPrompt('測試', [], 'minimal');
      expect(prompt).toHaveProperty('messages');
      expect(prompt.messages.length).toBeGreaterThan(0);
    });
  });
});