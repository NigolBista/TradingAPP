# Stock Detail Screen Refactor Plan

## Scope
Refactor `StockDetailScreen` into smaller, testable units by separating state management, data fetching, and presentation. The goal is to reduce the 2.6k line screen into cohesive modules that can be reasoned about and reused by other chart-related views.

## Why
- The current screen mixes navigation wiring, async requests, Zustand writes, and JSX layout in one component, making it hard to validate changes or reuse logic (`src/screens/StockDetailScreen.tsx`).
- Re-render cascades caused by inline store mutations hinder chart performance and complicate debugging.
- Extraction of shared chart/watchlist behavior prepares the codebase for upcoming refactors of `ChartFullScreen` and other analytics screens.

## TODO
1. [ ] Introduce `useStockDetails` hook encapsulating quote loading, news fetching, sentiment, and alert interactions.
2. [ ] Extract header/price summary and alert management into dedicated presentational components.
3. [ ] Migrate news and AI analysis sections to separate components wired through the new hook state.
4. [ ] Update navigation and dependent screens/tests to consume the refactored API, then remove leftover inline logic.
5. [ ] Integrate Detox-based E2E smoke suite to protect the refactor; ensures StockDetail critical flows stay green before broader chart refactors.

Test after each step to validate behavior before proceeding to the next item.
