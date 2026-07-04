module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.cjs',
    '**/tests/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/integration/**/*.test.cjs'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/integration/'
  ],
  collectCoverageFrom: [
    'services/**/*.cjs',
    'middleware/**/*.cjs',
    '!node_modules/'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65
    }
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
