/**
 * ESLint 自訂規則：禁止跨層 import
 * 強制架構邊界：controllers ↔ services ↔ utils 之外的跨層調用
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止跨層 import，強制三層語義架構邊界',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      crossLayerImport: '禁止跨層 import: {{fromLayer}} 不能直接調用 {{toLayer}}',
      invalidDirectImport: '禁止直接調用底層服務: {{fromLayer}} 不能直接調用 {{importPath}}',
    },
  },

  create(context) {
    // 定義層級結構
    const layers = {
      controllers: ['controllers'],
      services: ['services'],
      utils: ['utils'],
      internal: ['internal', 'openai', 'firebase', 'line'],
    };

    // 禁止的跨層調用規則
    const forbiddenImports = {
      controllers: ['internal', 'utils'], // controllers 只能調用 services
      services: ['internal'], // services 只能調用 utils，不能直接調用 internal
      utils: ['controllers', 'services'], // utils 不能調用上層
    };

    // 特定的底層服務禁止規則
    const forbiddenDirectImports = {
      controllers: [
        'openaiService',
        'firebaseService',
        'lineService',
        'intentRuleEngine',
        'timeParser',
      ],
      services: [
        'openaiService', 
        'firebaseService',
        'lineService',
      ],
    };

    function getLayerFromPath(filePath) {
      for (const [layerName, patterns] of Object.entries(layers)) {
        if (patterns.some(pattern => filePath.includes(pattern))) {
          return layerName;
        }
      }
      return 'unknown';
    }

    function getImportLayer(importPath) {
      // 檢查是否為相對路徑的 import
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        return getLayerFromPath(importPath);
      }
      return 'external';
    }

    function checkForbiddenDirectImport(fromLayer, importPath) {
      const forbidden = forbiddenDirectImports[fromLayer];
      if (!forbidden) return false;
      
      return forbidden.some(service => 
        importPath.includes(service) || 
        importPath.endsWith(service) ||
        importPath.includes(`/${service}`)
      );
    }

    return {
      ImportDeclaration(node) {
        const currentFile = context.getFilename();
        const fromLayer = getLayerFromPath(currentFile);
        const importPath = node.source.value;
        const toLayer = getImportLayer(importPath);

        // 跳過外部模組
        if (toLayer === 'external' || toLayer === 'unknown') {
          return;
        }

        // 檢查禁止的直接調用
        if (checkForbiddenDirectImport(fromLayer, importPath)) {
          context.report({
            node,
            messageId: 'invalidDirectImport',
            data: {
              fromLayer,
              importPath,
            },
          });
          return;
        }

        // 檢查禁止的跨層調用
        const forbidden = forbiddenImports[fromLayer];
        if (forbidden && forbidden.includes(toLayer)) {
          context.report({
            node,
            messageId: 'crossLayerImport',
            data: {
              fromLayer,
              toLayer,
            },
          });
        }
      },

      CallExpression(node) {
        // 檢查 require() 調用
        if (node.callee.name === 'require' && node.arguments.length > 0) {
          const currentFile = context.getFilename();
          const fromLayer = getLayerFromPath(currentFile);
          const importPath = node.arguments[0].value;
          
          if (typeof importPath === 'string') {
            const toLayer = getImportLayer(importPath);

            // 檢查禁止的直接調用
            if (checkForbiddenDirectImport(fromLayer, importPath)) {
              context.report({
                node,
                messageId: 'invalidDirectImport',
                data: {
                  fromLayer,
                  importPath,
                },
              });
              return;
            }

            // 檢查禁止的跨層調用
            const forbidden = forbiddenImports[fromLayer];
            if (forbidden && forbidden.includes(toLayer)) {
              context.report({
                node,
                messageId: 'crossLayerImport',
                data: {
                  fromLayer,
                  toLayer,
                },
              });
            }
          }
        }
      },
    };
  },
};