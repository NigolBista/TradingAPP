## Prompting Engine Architecture

### Goals

- Modular strategy engines with a simple, typed interface and registry.
- Indicator defaults for day and swing trading, auto-applied when options are missing.
- Two-stage LLM flow (intent then execution) to minimize prompt/context size.
- Sequential chart-control engine that performs visible, narrated steps with cancel.
- Clear separation of concerns: intent parsing, orchestration, chart control, strategy generation.

### High-Level Components

- Strategy Engines (`src/logic/strategies/`)

  - Interface: `StrategyEngine` → `run(input) => AIStrategyOutput`.
  - Default implementation: `LLMStrategyEngine` (wraps existing `runAIStrategy`).
  - Registry: `StrategyEngineRegistry` maps engine keys to implementations.

- Indicator Defaults (`src/logic/indicatorDefaults.ts`)

  - Profiles: `day_trade`, `swing_trade` with most-used params/styles.
  - `normalizeIndicatorOptions(indicator, options, profile)` ensures `calcParams` and `styles.lines`.
  - `getDefaultIndicatorStack(profile)` returns a ready-to-apply stack.

- Intent Engine (`src/logic/intentEngine.ts`)

  - Stage 1: `inferIntent(userInput, context)` → structured intent (action, strategy, timeframes, indicators, sequence plan).
  - Stage 2: Execute with only the context required by the intent (chart, strategy, or both).
  - Supports sequential intents (multi-step sequences) and freeform questions.

- Chart Sequence Engine (`src/logic/chartSequenceEngine.ts`)

  - Executes `SequenceStep[]` sequentially using `executeChartAction`.
  - Shows transparent overlay messages per step; can capture screenshots and emit feedback.
  - Cancelable mid-flow.

- Overlay UI (`src/providers/OverlayProvider.tsx`, `src/services/overlayBus.ts`)

  - Global overlay to display agent reasoning while keeping the chart visible.
  - Exposes `show(message)`, `hide()`, and cancel signal subscription.

- Agents
  - `ChartSequenceAgent`: runs scripted sequences via the sequence engine.
  - Existing: `ChartControlAgent`, `OrchestratorAgent`, `StrategyAgent` continue to work.

### Data Flow

1. User asks: "Analyze this stock chart."
2. Intent engine classifies: chart-analysis intent with sequence plan (e.g., 1m → EMA, screenshot → 15m → RSI, screenshot).
3. Orchestrator dispatches to `ChartSequenceAgent` to run steps; overlay narrates reasoning with option to stop.
4. When analysis is needed, strategy engine runs (`LLMStrategyEngine`), applying indicator defaults per profile.
5. Final result is displayed and/or returned to chat.

### Strategy Engines

- `LLMStrategyEngine` (default): wraps `runAIStrategy` (OpenAI) using prompts from `src/logic/strategies/index.ts`.
- Additional engines can be registered later (rule-based, backtest-based).

### Indicator Defaults (most used)

- Day trading
  - EMA: [9, 21, 50] overlay
  - VWAP
  - Volume (VOL)
  - RSI: [14]
  - MACD: [12, 26, 9]
  - BOLL: [20, 2]
- Swing trading
  - EMA: [20, 50, 200] overlay
  - SMA: [50, 200]
  - Volume (VOL)
  - RSI: [14]
  - MACD: [12, 26, 9]
  - BOLL: [20, 2]

`normalizeIndicatorOptions` will ensure defaults are applied when omitted.

### Two-Stage LLM Calls

- Stage 1 (Intent): small prompt, returns JSON intent with steps and required context.
- Stage 2 (Execution): only the minimal context for the chosen path is passed.
- Benefits: lower token usage, clearer tool calls, faster iterations.

### Public APIs

- `runChartSequence(script, options)` → runs sequential UI flow.
- `inferIntent(input, ctx)` → intent JSON.
- `executeIntent(intent, ctx)` → routes to sequence/strategy.
- `StrategyEngineRegistry.get(engineKey)` → `run(input)`.
- `normalizeIndicatorOptions(ind, opts, profile)`.

### Migration Notes

- Existing `llmChartEngine` and `llmChartChat` will call `normalizeIndicatorOptions` when adding indicators.
- `chartBridge` gains `executeChartActionsSequentially` for step-by-step flows.
- `agents/registry.ts` registers `ChartSequenceAgent`.

### Future Work

- Add rule-based strategy engine.
- Backtesting integration for validation.
- More robust overlay UX (persisted logs, step controls).
