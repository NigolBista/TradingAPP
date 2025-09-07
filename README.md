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

### Interactive Chart Chat

A dedicated `ChartChat` screen lets users hold a conversation with the trading
assistant. The chat button on the full-screen chart launches a dialog where the
LLM can issue tool calls to change timeframes, add indicators, capture
screenshots, and run iterative analysis. All messages, screenshots, and
strategy outputs are stored in persistent history for review.

### Agentic Trading System

For a more robust, human-in-the-loop workflow, use the `runAgenticTrading`
helper. This wraps the LLM chart engine in a small agent architecture that
critiques each strategy, requests optional user feedback, and iterates for
deeper analysis:

```ts
import { runAgenticTrading } from "./src/logic";

await runAgenticTrading({
  symbol: "AAPL",
  iterations: 2, // number of critique/feedback loops
  onUserFeedback: async (critique) => {
    console.log("Critique:", critique);
    return "Looks good"; // return user notes that influence the next run
  },
});
```

Each iteration runs chart actions, generates a strategy, critiques the result,
and gives a human reviewer a chance to weigh in before continuing. This agentic
approach keeps strategy planning, analysis, critique, and feedback modular and
extensible for future agents.
