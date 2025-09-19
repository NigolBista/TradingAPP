# Navigation Architecture

This directory contains the modular navigation system for the Trading App.

## Structure

```
navigation/
├── types.ts              # Navigation type definitions and linking config
├── RootNavigator.tsx     # Main navigation container
├── AuthNavigator.tsx     # Authentication flow navigation
├── MainTabNavigator.tsx  # Bottom tab navigation for main app
├── TradingNavigator.tsx  # Trading-specific screens
├── PortfolioNavigator.tsx # Portfolio and account screens
├── MarketNavigator.tsx   # Market data and analysis screens
├── hooks.ts              # Typed navigation hooks and helpers
├── index.tsx             # Main export file
└── README.md             # This file
```

## Key Features

### Type Safety
- All navigation parameters are strictly typed
- TypeScript will catch navigation errors at compile time
- Auto-completion for screen names and parameters

### Feature-Based Organization
- Each major feature has its own navigator
- Clear separation between authentication, main app, and feature modules
- Easy to add new features without affecting existing navigation

### Deep Linking Support
- Configured for both custom scheme (`tradingapp://`) and web URLs
- Automatic parameter extraction from URLs
- Support for nested navigation structures

## Usage Examples

### Basic Navigation
```typescript
import { useNavigationHelpers } from '../navigation/hooks';

function MyComponent() {
  const { navigateToStock, navigateToChart } = useNavigationHelpers();

  const handleStockPress = () => {
    navigateToStock('AAPL', 'Apple Inc.', 'watchlist');
  };

  const handleChartPress = () => {
    navigateToChart('AAPL', '1D');
  };
}
```

### Typed Navigation with Parameters
```typescript
import { useTypedNavigation, useTypedRoute } from '../navigation/hooks';
import type { TradingStackParamList } from '../navigation/types';

function StockDetailScreen() {
  const navigation = useTypedNavigation<'StockDetail'>();
  const route = useTypedRoute<'StockDetail'>();

  // TypeScript knows route.params has { symbol: string; name?: string; source?: string }
  const { symbol, name, source } = route.params;

  const navigateToChart = () => {
    navigation.navigate('ChartFullScreen', { symbol, timeframe: '1D' });
  };
}
```

### Deep Linking
```typescript
import { useDeepLinking } from '../navigation/hooks';

function NotificationHandler() {
  const { handleStockLink, resetToStock } = useDeepLinking();

  const handleNotification = (stockSymbol: string) => {
    // Reset navigation stack and navigate to stock
    resetToStock(stockSymbol);
  };
}
```

## Navigation Flow

```
RootNavigator
├── Auth (if not logged in)
│   ├── Login
│   └── Register
└── Main (if logged in)
    ├── MainTabNavigator
    │   ├── Dashboard
    │   ├── Watchlist
    │   ├── Market
    │   ├── Focus
    │   └── Profile
    ├── Trading (Modal)
    │   ├── StockDetail
    │   ├── ChartFullScreen
    │   ├── ChartChat
    │   └── IndicatorConfig
    ├── Portfolio (Modal)
    │   ├── BrokerageAccounts
    │   └── Journey
    └── Market (Modal)
        ├── Scanner
        ├── AIInsights
        ├── MarketOverview
        ├── FederalReserve
        ├── DecalpX
        ├── MarketOverviewPage
        ├── EarningsCalendar
        └── Chat
```

## Migration from Old Navigation

The new navigation system is backward compatible. The old navigation file (`index.tsx`) now re-exports the new modular system, so existing imports will continue to work.

### Before
```typescript
import { navigate } from '../navigation';
navigate('StockDetail', { symbol: 'AAPL' });
```

### After (Recommended)
```typescript
import { useNavigationHelpers } from '../navigation/hooks';
const { navigateToStock } = useNavigationHelpers();
navigateToStock('AAPL', 'Apple Inc.');
```

## Benefits

1. **Type Safety**: Compile-time checking of navigation parameters
2. **Better Organization**: Feature-based navigation structure
3. **Easier Testing**: Each navigator can be tested independently
4. **Performance**: Lazy loading of screen components
5. **Deep Linking**: Built-in support for URL-based navigation
6. **Developer Experience**: Auto-completion and better error messages

## Adding New Screens

### 1. Add to Types
```typescript
// types.ts
export type TradingStackParamList = {
  // ... existing screens
  NewTradingScreen: { param1: string; param2?: number };
};
```

### 2. Add to Navigator
```typescript
// TradingNavigator.tsx
<TradingStack.Screen
  name="NewTradingScreen"
  component={NewTradingScreen}
  options={{ title: 'New Trading Feature' }}
/>
```

### 3. Add Helper (Optional)
```typescript
// hooks.ts
navigateToNewTradingScreen: (param1: string, param2?: number) => {
  navigation.navigate('Trading', {
    screen: 'NewTradingScreen',
    params: { param1, param2 },
  });
},
```

## Performance Considerations

- Screen components are lazy-loaded
- Navigation animations are optimized for 60fps
- Deep linking is handled efficiently
- Type checking has minimal runtime overhead