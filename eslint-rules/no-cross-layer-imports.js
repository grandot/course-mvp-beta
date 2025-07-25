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
      services: [], // services 可以調用 utils 和 internal 進行內部協調
      utils: ['controllers', 'services'], // utils 不能調用上層
    };

    // 特定的底層服務禁止規則 - controllers 絕對不能直接調用這些
    const forbiddenDirectImports = {
      controllers: [
        'openaiService',
        'firebaseService',
        '../internal/lineService', // 禁止直接調用 internal
        'intentRuleEngine',
        'timeParser',
      ],
      // services 層移除限制，允許內部協調
      services: [],
    };

    // SemanticService 作為語義處理統一入口，允許調用 internal 服務進行內部協調
    const allowedExceptions = {
      'semanticService.js': ['openaiService'],
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

    function checkForbiddenDirectImport(fromLayer, importPath, currentFile) {
      const forbidden = forbiddenDirectImports[fromLayer];
      if (!forbidden) return false;
      
      // 檢查是否有例外允許
      const fileName = currentFile.split('/').pop();
      const exceptions = allowedExceptions[fileName];
      if (exceptions) {
        const isException = exceptions.some(service => 
          importPath.includes(service) || 
          importPath.endsWith(service) ||
          importPath.includes(`/${service}`)
        );
        if (isException) return false;
      }
      
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
        if (checkForbiddenDirectImport(fromLayer, importPath, currentFile)) {
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
          // 檢查是否有例外允許
          const fileName = currentFile.split('/').pop();
          const exceptions = allowedExceptions[fileName];
          let isAllowedException = false;
          
          if (exceptions && toLayer === 'internal') {
            isAllowedException = exceptions.some(service => 
              importPath.includes(service) || 
              importPath.endsWith(service) ||
              importPath.includes(`/${service}`)
            );
          }
          
          if (!isAllowedException) {
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
            if (checkForbiddenDirectImport(fromLayer, importPath, currentFile)) {
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
              // 檢查是否有例外允許
              const fileName = currentFile.split('/').pop();
              const exceptions = allowedExceptions[fileName];
              let isAllowedException = false;
              
              if (exceptions && toLayer === 'internal') {
                isAllowedException = exceptions.some(service => 
                  importPath.includes(service) || 
                  importPath.endsWith(service) ||
                  importPath.includes(`/${service}`)
                );
              }
              
              if (!isAllowedException) {
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
        }
      },
    };
  },
};