# TradingApp Trading Companion (Expo + Supabase + Stripe)

Production-ready starter implementing:

- Candlestick chart with moving averages (Yahoo/Polygon provider)
- AI insights (OpenAI Chat Completions)
- Watchlist management
- News headlines (Yahoo Finance RSS)
- Stripe provider shell + portal
- Supabase auth client setup

## Setup

Create `.env` at repo root with your keys:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
STRIPE_PUBLISHABLE_KEY=...
OPENAI_API_KEY=...
# Optional
POLYGON_API_KEY=
IOS_BUNDLE_ID=com.example.TradingApp
ANDROID_PACKAGE=com.example.TradingApp
EAS_PROJECT_ID=
```

Install deps and run:

```
yarn
expo start
```

Notes:

- News uses public Yahoo RSS suitable for testing without a key.
- For realtime and server features, add Supabase Edge Functions for caching and Stripe webhooks.
- Not financial advice.
