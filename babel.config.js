module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Reanimated plugin must be listed last
      require("react-native-reanimated/plugin"),
    ],
  };
};
