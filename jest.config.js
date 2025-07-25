module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(some-esm-package)/)',
  ],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: [],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};