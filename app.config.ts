import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "TradingApp",
  slug: "tradingapp", // keep lowercase and consistent
  version: "1.0.0", // ← REQUIRED for runtimeVersion policy
  scheme: "tradingapp",
  orientation: "portrait",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0A0F1C",
  },

  // ✅ EAS Update config (manually added)
  updates: {
    // Use exactly what EAS printed for your project:
    url: "https://u.expo.dev/b167b23d-8bc1-47da-bfd3-a5b49a75a3be",
    // (Optional) you can also set checkAutomatically/timeout here if you like
    // checkAutomatically: "ON_LOAD",
    // fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion",
  },

  plugins: [
    "expo-secure-store",
    "expo-web-browser",
    "expo-font",
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier:
          process.env.STRIPE_MERCHANT_ID || "merchant.com.example.TradingApp",
        merchantCountryCode: process.env.STRIPE_MERCHANT_COUNTRY || "US",
        enableGooglePay: true,
        googlePayEnvironment: process.env.GOOGLE_PAY_ENV || "Test",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#4F46E5",
      },
    ],
    // `expo-updates` is auto-configured when installed; no plugin entry required.
  ],

  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_ID || "com.example.tradingApp",
  },
  android: {
    package: process.env.ANDROID_PACKAGE || "com.example.tradingApp",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0F1C",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID || "",
    },
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    marketProvider: process.env.MARKET_PROVIDER || "polygon",
    quotesProvider:
      process.env.QUOTES_PROVIDER ||
      process.env.MARKET_PROVIDER ||
      "marketData",
    stockNewsApiKey: process.env.STOCK_NEWS_API_KEY,
    newsProvider: process.env.NEWS_PROVIDER || "stocknewsapi",
    plaidClientId: process.env.PLAID_CLIENT_ID,
    plaidSecret: process.env.PLAID_SECRET,
    plaidEnvironment: process.env.PLAID_ENVIRONMENT || "sandbox",
    marketDataApiToken: process.env.MARKET_DATA_API_TOKEN,
    polygonApiKey: process.env.POLYGON_API_KEY,
    developerMode: String(process.env.DEVELOPER_MODE || "false") === "true",
    realtimeProvider: process.env.REALTIME_PROVIDER || "delayed",
    expoPublic: {
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    },
  },
});
