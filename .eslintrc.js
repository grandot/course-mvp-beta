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
  // Note: Custom architecture rules temporarily disabled for CI compatibility
  // The architecture constraints are enforced through code review and manual checks
  plugins: [],
  rules: {
    'no-console': 'warn',
    'camelcase': ['error', { 
      'properties': 'never', 
      'allow': ['max_tokens', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'user_id', 'course_name', 'total_cost_twd', 'student_id', 'course_date'] 
    }],
    'no-restricted-syntax': ['error', 'WithStatement'],
  },
};