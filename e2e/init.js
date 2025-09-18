const detox = require('detox');
const adapter = require('detox/runners/jest/adapter');
const config = require('../detox.config.js');

jest.setTimeout(120000);

beforeAll(async () => {
  await detox.init(config, { launchApp: false });
});

beforeEach(async () => {
  await adapter.beforeEach();
  await device.launchApp({ newInstance: true });
});

afterAll(async () => {
  await adapter.afterAll();
  await detox.cleanup();
});

afterEach(async () => {
  await adapter.afterEach();
});
