import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  AllStackParamList,
  ScreenNavigationProp,
  ScreenRouteProp,
} from './types';

// Typed navigation hook
export function useTypedNavigation<T extends keyof AllStackParamList>() {
  return useNavigation<ScreenNavigationProp<T>>();
}

// Typed route hook
export function useTypedRoute<T extends keyof AllStackParamList>() {
  return useRoute<ScreenRouteProp<T>>();
}

// Combined navigation and route hook
export function useScreenProps<T extends keyof AllStackParamList>() {
  const navigation = useTypedNavigation<T>();
  const route = useTypedRoute<T>();

  return { navigation, route };
}

// Navigation helpers for common actions
export function useNavigationHelpers() {
  const navigation = useNavigation<ScreenNavigationProp<keyof AllStackParamList>>();

  return {
    // Trading navigation
    navigateToStock: (symbol: string, name?: string, source?: string) => {
      navigation.navigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source },
      });
    },

    navigateToChart: (symbol: string, timeframe?: string) => {
      navigation.navigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    navigateToChartChat: (symbol: string, chartData?: any) => {
      navigation.navigate('Trading', {
        screen: 'ChartChat',
        params: { symbol, chartData },
      });
    },

    // Market navigation
    navigateToScanner: () => {
      navigation.navigate('Market', { screen: 'Scanner' });
    },

    navigateToInsights: () => {
      navigation.navigate('Market', { screen: 'AIInsights' });
    },

    navigateToMarketOverview: () => {
      navigation.navigate('Market', { screen: 'MarketOverview' });
    },

    navigateToChat: (context?: 'market' | 'stock' | 'general', symbol?: string) => {
      navigation.navigate('Market', {
        screen: 'Chat',
        params: { context, symbol },
      });
    },

    // Portfolio navigation
    navigateToAccounts: () => {
      navigation.navigate('Portfolio', { screen: 'BrokerageAccounts' });
    },

    navigateToJourney: () => {
      navigation.navigate('Portfolio', { screen: 'Journey' });
    },

    // Main tabs
    navigateToDashboard: () => {
      navigation.navigate('Main', { screen: 'Dashboard' });
    },

    navigateToWatchlist: () => {
      navigation.navigate('Main', { screen: 'Watchlist' });
    },

    navigateToProfile: () => {
      navigation.navigate('Main', { screen: 'Profile' });
    },

    // Auth navigation
    navigateToLogin: () => {
      navigation.navigate('Auth', { screen: 'Login' });
    },

    navigateToRegister: () => {
      navigation.navigate('Auth', { screen: 'Register' });
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
      navigation.navigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source: 'deeplink' },
      });
    },

    // Handle chart deep links (e.g., tradingapp://chart/AAPL)
    handleChartLink: (symbol: string, timeframe?: string) => {
      navigation.navigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    // Handle market scanner deep links
    handleScannerLink: () => {
      navigation.navigate('Market', { screen: 'Scanner' });
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