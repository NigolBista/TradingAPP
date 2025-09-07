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

### LLM Chart Engine (Experimental)

The `runLLMChartEngine` helper allows an LLM to iteratively control the chart using
OpenAI tool calls. Both user-driven actions and LLM-generated actions funnel
through the same `ChartBridge` so every capability exposed to a user is also
available to the model. Register a bridge that knows how to perform chart
actions and capture screenshots, then invoke the engine:

```ts
import { runLLMChartEngine } from "./src/logic";

await runLLMChartEngine({
  symbol: "AAPL",
  strategy: "day_trade",
  runs: 1,
  sendData: "screenshot",
});
```

The engine will request chart actions from the LLM, execute them via the
bridge, optionally send a screenshot back for analysis, and produce a strategy
plan using the existing AI strategy pipeline. Increase the `runs` option for
deep multi-step analysis. A custom `strategyRunner` can be supplied for a
different analysis engine, keeping the module extensible.
