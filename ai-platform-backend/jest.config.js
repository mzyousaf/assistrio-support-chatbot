/** Jest config for unit tests (helper-only, no Nest bootstrap). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/chat/**/*.ts', 'src/rag/**/*.ts', '!**/*.spec.ts'],
  coverageDirectory: 'coverage',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: {},
};
