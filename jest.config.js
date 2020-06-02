module.exports = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/packages/*/source/**/*.{ts,tsx}'],
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/source/@types'],
  moduleNameMapper: {},
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/testSetup.ts'],
  testPathIgnorePatterns: ['dist/', 'examples/'],
  verbose: true,
}
