module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/loadEnv.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  globalSetup: './tests/globalSetup.js',
  forceExit: true,
};
