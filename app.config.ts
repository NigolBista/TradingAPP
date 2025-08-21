import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    name: "GPT5",
    slug: "GPT5",
    scheme: "gpt5",
    orientation: "portrait",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0F1C",
    },
    plugins: [
      "expo-secure-store",
      "expo-web-browser",
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier:
            process.env.STRIPE_MERCHANT_ID || "merchant.com.example.gpt5",
          merchantCountryCode: process.env.STRIPE_MERCHANT_COUNTRY || "US",
          enableGooglePay: true,
          googlePayEnvironment: process.env.GOOGLE_PAY_ENV || "Test",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#4F46E5",
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || "com.example.gpt5",
    },
    android: {
      package: process.env.ANDROID_PACKAGE || "com.example.gpt5",
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
      marketProvider: process.env.MARKET_PROVIDER || "marketData",
      stockNewsApiKey: process.env.STOCK_NEWS_API_KEY,
      newsProvider: process.env.NEWS_PROVIDER || "stocknewsapi",
      plaidClientId: process.env.PLAID_CLIENT_ID,
      plaidSecret: process.env.PLAID_SECRET,
      plaidEnvironment: process.env.PLAID_ENVIRONMENT || "sandbox",
      marketDataApiToken: process.env.MARKET_DATA_API_TOKEN,
      expoPublic: {
        sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      },
    },
  } as unknown as ExpoConfig);
