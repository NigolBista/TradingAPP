// Metro configuration for Expo
// Adds support for bundling .txt files as assets so we can load
// large local scripts (e.g., lightweightCharts.txt) at runtime.

const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ensure .txt is treated as an asset (not a source file)
config.resolver.assetExts = config.resolver.assetExts.concat(["txt"]);

module.exports = config;

