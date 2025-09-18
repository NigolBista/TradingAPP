import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import type {
  AllStackParamList,
  RootStackParamList,
} from './types';

// Typed navigation hook
export function useTypedNavigation() {
  return useNavigation<NavigationProp<RootStackParamList>>();
}

// Typed route hook
export function useTypedRoute<T extends keyof AllStackParamList>() {
  return useRoute<RouteProp<AllStackParamList, T>>();
}

// Combined navigation and route hook
export function useScreenProps<T extends keyof AllStackParamList>() {
  const navigation = useTypedNavigation();
  const route = useTypedRoute<T>();

  return { navigation, route };
}

// Navigation helpers for common actions
export function useNavigationHelpers() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return {
    // Trading navigation
    navigateToStock: (symbol: string, name?: string, source?: string) => {
      (navigation as any).navigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source },
      });
    },

    navigateToChart: (symbol: string, timeframe?: string) => {
      (navigation as any).navigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    navigateToChartChat: (symbol: string, chartData?: any) => {
      (navigation as any).navigate('Trading', {
        screen: 'ChartChat',
        params: { symbol, chartData },
      });
    },

    // Market navigation
    navigateToScanner: () => {
      (navigation as any).navigate('Market', { screen: 'Scanner' });
    },

    navigateToInsights: () => {
      (navigation as any).navigate('Market', { screen: 'AIInsights' });
    },

    navigateToMarketOverview: () => {
      (navigation as any).navigate('Market', { screen: 'MarketOverview' });
    },

    navigateToChat: (context?: 'market' | 'stock' | 'general', symbol?: string) => {
      (navigation as any).navigate('Market', {
        screen: 'Chat',
        params: { context, symbol },
      });
    },

    // Portfolio navigation
    navigateToAccounts: () => {
      (navigation as any).navigate('Portfolio', { screen: 'BrokerageAccounts' });
    },

    navigateToJourney: () => {
      (navigation as any).navigate('Portfolio', { screen: 'Journey' });
    },

    // Main tabs
    navigateToDashboard: () => {
      (navigation as any).navigate('Main', { screen: 'Dashboard' });
    },

    navigateToWatchlist: () => {
      (navigation as any).navigate('Main', { screen: 'Watchlist' });
    },

    navigateToProfile: () => {
      (navigation as any).navigate('Main', { screen: 'Profile' });
    },

    // Auth navigation
    navigateToLogin: () => {
      (navigation as any).navigate('Auth', { screen: 'Login' });
    },

    navigateToRegister: () => {
      (navigation as any).navigate('Auth', { screen: 'Register' });
    },

    // Utility functions
    goBack: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  };
}

// Hook for deep linking and external navigation
export function useDeepLinking() {
  const navigation = useNavigation<ScreenNavigationProp<keyof AllStackParamList>>();

  return {
    // Handle stock deep links (e.g., tradingapp://stock/AAPL)
    handleStockLink: (symbol: string, name?: string) => {
      (navigation as any).navigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source: 'deeplink' },
      });
    },

    // Handle chart deep links (e.g., tradingapp://chart/AAPL)
    handleChartLink: (symbol: string, timeframe?: string) => {
      (navigation as any).navigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    // Handle market scanner deep links
    handleScannerLink: () => {
      (navigation as any).navigate('Market', { screen: 'Scanner' });
    },

    // Reset to a specific screen (useful for notifications)
    resetToStock: (symbol: string, name?: string) => {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Main', params: { screen: 'Dashboard' } },
          {
            name: 'Trading',
            params: { screen: 'StockDetail', params: { symbol, name } },
          },
        ],
      });
    },
  };
}