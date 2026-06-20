// Babel config for the Expo app (SDK 54).
// `babel-preset-expo` handles JSX/TS transpilation AND wires up expo-router
// (expo-router no longer needs a separate Babel plugin in SDK 50+/54 — it
// works through babel-preset-expo).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
