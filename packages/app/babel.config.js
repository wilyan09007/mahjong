module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its worklet transform inside react-native-worklets.
    // It MUST be last in the plugin list.
    plugins: ['react-native-worklets/plugin'],
  };
};
