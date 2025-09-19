# Stock Detail Screen Refactor Plan

## Scope
Refactor `StockDetailScreen` into smaller, testable units by separating state management, data fetching, and presentation. The goal is to reduce the 2.6k line screen into cohesive modules that can be reasoned about and reused by other chart-related views.

## Why
- The current screen mixes navigation wiring, async requests, Zustand writes, and JSX layout in one component, making it hard to validate changes or reuse logic (`src/screens/StockDetailScreen.tsx`).
- Re-render cascades caused by inline store mutations hinder chart performance and complicate debugging.
- Extraction of shared chart/watchlist behavior prepares the codebase for upcoming refactors of `ChartFullScreen` and other analytics screens.

## Incremental Execution Plan

Each milestone should end with lint/tests (including Detox once configured) and a commit before moving on.

1. **Baseline Conflict Resolution**
   - Resolve the outstanding merge conflict in `src/screens/StockDetailScreen.tsx` and make sure the screen compiles.
   - Run existing lint/unit tests to confirm we have a clean starting point.
   - Commit: `Resolve conflict and baseline StockDetail`.

2. **Introduce `useStockDetails` Hook**
   - Finalize the hook so it owns quote/news/sentiment/alert data flow and remove duplicated side-effects from the screen.
   - Add unit/integration coverage for the hook where viable.
   - Lint + unit tests; commit: `Introduce useStockDetails hook`.

3. **Extract Header & Price Summary**
   - Move the header (navigation/back, actions) and price summary UI into `src/components/stock-details/StockHeader.tsx` (or similar).
   - Keep the screen responsible for wiring navigation/handlers only.
   - Snapshot/component tests if possible; commit: `Extract StockHeader component`.

4. **Isolate Alerts UI**
   - Break the alerts modal/list orchestration out into a `StockAlertsModal` component fed by the hook.
   - Ensure the hook exposes `upsertAlert` and alert mutations; remove redundant screen logic.
   - Tests + commit: `Refactor alerts modal`.

5. **News & Analysis Sections**
   - Extract news list, sentiment summary, and AI analysis pieces into composable components under `stock-details`.
   - Hook supplies data; screen composes layout.
   - Tests + commit: `Extract news & analysis sections`.

6. **Detox Smoke Integration (High Priority)**
   - Configure Detox if absent: add config, `e2e` folder, and scripts.
   - Write a smoke test validating navigation to Stock Detail, chart render, alerts modal toggle, and news fetch (mock network or seed data).
   - Integrate Detox scripts into CI.
   - Run Detox locally (document limitations if environment blocks execution); commit: `Add Detox smoke test for StockDetail`.

7. **Navigation & Consumer Cleanup**
   - Update navigation params/consumers to work with the refactored pieces; prune unused helpers.
   - Run the full test matrix (lint, unit, Detox); commit: `Finalize StockDetail refactor`.

## Architecture Considerations

- **Feature Modules & Providers**: Group feature-specific hooks, components, and services under folders such as `src/features/stock-details/` to clarify ownership and enable dependency boundaries. Providers (auth, notifications, market status) should expose typed contexts/hooks rather than being imported ad hoc throughout screens.
- **State Segregation**: Use a dedicated state layer (Zustand slices or React Query) for server interactions, keeping React components lean. `useStockDetails` can become a thin orchestrator that composes quote/news/sentiment sub-hooks.
- **Async/Data Layer**: Centralize HTTP/persistent logic in service modules that expose typed clients. Consider introducing a shared API client (e.g., using `ky` or Axios) with interceptors for auth, retries, and logging.
- **UI Composition**: Favor small presentational components with props validated via TypeScript types. Co-locate component-specific styles and tests to enforce encapsulation.
- **Testing Strategy**: Layer tests—unit (hooks/utils), component (React Native Testing Library), and Detox E2E. Mock network/services via dependency injection to keep tests deterministic.
- **Navigation Contracts**: Define screen params and shared navigation helpers in a central place (e.g., `src/navigation/types.ts`) to avoid drift between screens when feature APIs evolve.

Revisit architecture boundaries after the refactor: the `stock-details` feature should serve as a template for future chart analytics work, with hooks/services/components arranged consistently across the app.
