module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['local'],
  rules: {
    'no-console': 'warn',
    'local/no-cross-layer-imports': 'error',
  },
};