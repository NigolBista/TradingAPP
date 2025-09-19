/**
 * Detox configuration for TradingApp.
 *
 * This uses Expo's managed workflow; build commands assume an iOS simulator build.
 * Update the binaryPath/build commands if you generate a different artifact.
 */
module.exports = {
  testRunner: {
    type: "jest",
    jest: {
      runnerConfig: "e2e/jest.config.js",
    },
  },
  apps: {
    "ios.sim.debug": {
      type: "ios.app",
      binaryPath:
        "ios/build/TradingApp/Build/Products/Debug-iphonesimulator/TradingApp.app",
      build:
        "EXPO_USE_DEV_SERVER=1 npx expo run:ios --scheme TradingApp --configuration Debug --no-install",
    },
  },
  devices: {
    "ios.sim": {
      type: "ios.simulator",
      device: {
        type: "iPhone 14",
      },
    },
  },
  configurations: {
    "ios.sim.debug": {
      device: "ios.sim",
      app: "ios.sim.debug",
    },
  },
};
