// entire packages we don't want to test
const packagesToIgnore = []

// folders & files we don't want to test OR babel-transform
// Be Aware: if you tweak this array, this also needs to be updated in .watchmanconfig file
const patternsToIgnore = [
  '/.git/',
  '/coverage/',
  '/test/',
  '^/(.*\\.spec\\.js)$',
]

// folders & packages we don't want to test
const testIgnoreDirectories = packagesToIgnore.map((curPackage) => `/${curPackage}/`).concat(patternsToIgnore)

// exclude these no-test packages from coverage too
const ignoreGlobs = packagesToIgnore.map((curPackage) => `!packages/${curPackage}/**/*.js`)

module.exports = {
  testRunner: 'jest-circus/runner',
  roots: ['<rootDir>/packages', '<rootDir>/src'],
  moduleNameMapper: {
    '\\.(mdx|css|less|jpg|ico|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/jest.RawLoaderStub.js',
  },
  modulePathIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/bots/test/setupTests.js'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'].concat(testIgnoreDirectories),
  // this says to ignore all the foldersToIgnore plus node_modules EXCEPT for the ones listed in the lookahead for babel transpilation
  transformIgnorePatterns: patternsToIgnore,
  // transform: {
  //   '^.+\\.(js|ts|tsx)$': 'babel-jest',
  // },
  collectCoverageFrom: [
    '/**/src/**/*.{js,ts,tsx}',
    '!<rootDir>/**/*.spec.*',
  ].concat(ignoreGlobs),
  coverageReporters: ['json', 'lcov', 'text', 'text-summary', 'html'],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
}
