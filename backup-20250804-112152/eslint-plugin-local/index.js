/**
 * ESLint Plugin for Architecture Constraints
 * Enforces three-layer semantic architecture boundaries
 */
const noCrossLayerImports = require('../eslint-rules/no-cross-layer-imports');

module.exports = {
  rules: {
    'no-cross-layer-imports': noCrossLayerImports,
  },
};