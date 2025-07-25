/**
 * Local ESLint plugin for custom rules
 */
const noCrossLayerImports = require('./eslint-rules/no-cross-layer-imports');

module.exports = {
  rules: {
    'no-cross-layer-imports': noCrossLayerImports,
  },
};