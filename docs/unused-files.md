# Unused File Findings

This document captures modules that are currently not referenced by the app entry chain (`index.ts` → `App.tsx`). The list comes from a static import graph walk, so dynamic requires or future use weren’t detected. Known dynamically invoked modules (for example, the agent registry used by OpenAI orchestration) are intentionally excluded.

## Logic Toolkit
- `src/logic/actionSchemas.ts`
- `src/logic/index.ts`
- `src/logic/indicatorRegistry.ts`
- `src/logic/types.ts`
- `src/logic/userChartEngine.ts`

## Trading – Chart Full Screen Extras
- `src/features/trading/screens/ChartFullScreen/CustomRRModal.tsx`
- `src/features/trading/screens/ChartFullScreen/IndicatorConfigModal.tsx`

## Shared Components & Helpers
- `src/shared/components/common/BrokerageConnectionManager.tsx`
- `src/shared/components/common/index.ts`
- `src/shared/components/index.ts`
- `src/shared/constants/index.ts`
- `src/shared/hooks/index.ts`
- `src/shared/hooks/useOptimizedStockData.ts`
- `src/shared/index.ts`
- `src/shared/types/index.ts`
- `src/shared/utils/cacheManager.ts`
- `src/shared/utils/index.ts`
- `src/shared/utils/performanceTest.ts`

## Shared Services & Repositories
- `src/shared/services/ApiClient.ts`
- `src/shared/services/appInitializer.ts`
- `src/shared/services/brokerageApiService.ts`
- `src/shared/services/domain/TradingService.ts`
- `src/shared/services/enhancedMarketData.ts`
- `src/shared/services/index.ts`
- `src/shared/services/marketData.ts`
- `src/shared/services/repositories/BaseRepository.ts`
- `src/shared/services/repositories/MarketDataRepository.ts`
- `src/shared/services/repositories/PortfolioRepository.ts`
- `src/shared/services/repositories/TradingRepository.ts`
- `src/shared/services/repositories/UserRepository.ts`
- `src/shared/services/repositories/index.ts`
- `src/shared/services/sessionHeartbeat.ts`
- `src/shared/services/simulatorRealtime.ts`
- `src/shared/services/stripe.ts`
- `src/shared/services/tradingHours.ts`

## Store Layer
- `src/store/index.ts`
- `src/store/marketOverviewStore.ts`
- `src/store/slices/authSlice.ts`
- `src/store/slices/marketSlice.ts`
- `src/store/slices/portfolioSlice.ts`
- `src/store/slices/tradingSlice.ts`
- `src/store/slices/uiSlice.ts`
- `src/store/slices/websocketSlice.ts`
- `src/store/types.ts`

> _Note_: Please flag any intentional re-exports or future dynamic loads so we can adjust before deleting.
