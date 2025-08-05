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
  plugins: [],
  rules: {
    'no-console': 'warn',
    'camelcase': ['error', { 
      'properties': 'never', 
      'allow': ['max_tokens', 'prompt_tokens', 'completion_tokens', 'total_tokens'] 
    }],
    'no-restricted-syntax': ['error', 'WithStatement'],
  },
};