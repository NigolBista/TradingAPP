module.exports = {
  preset: 'detox',
  testMatch: ['**/?(*.)+(spec|test).+(js)'],
  testTimeout: 120000,
  reporters: ['detox/runners/jest/streamlineReporter'],
  setupFilesAfterEnv: ['./init.js'],
};
