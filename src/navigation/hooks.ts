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

  // Helper function to safely navigate with error handling
  const safeNavigate = (routeName: string, params?: any) => {
    try {
      if (navigation && navigation.navigate) {
        // Add a small delay to ensure navigation is ready
        setTimeout(() => {
          (navigation as any).navigate(routeName, params);
        }, 50);
      } else {
        console.warn(`Navigation not ready for route: ${routeName}`);
      }
    } catch (error) {
      console.error(`Navigation error for route ${routeName}:`, error);
    }
  };

  return {
    // Trading navigation
    navigateToStock: (symbol: string, name?: string, source?: string) => {
      safeNavigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source },
      });
    },

    navigateToChart: (symbol: string, timeframe?: string) => {
      safeNavigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    navigateToChartChat: (symbol: string, chartData?: any) => {
      safeNavigate('Trading', {
        screen: 'ChartChat',
        params: { symbol, chartData },
      });
    },

    // Market navigation
    navigateToScanner: () => {
      safeNavigate('Market', { screen: 'Scanner' });
    },

    navigateToInsights: () => {
      safeNavigate('Market', { screen: 'AIInsights' });
    },

    navigateToMarketOverview: () => {
      safeNavigate('Market', { screen: 'MarketOverview' });
    },

    navigateToChat: (context?: 'market' | 'stock' | 'general', symbol?: string) => {
      safeNavigate('Market', {
        screen: 'Chat',
        params: { context, symbol },
      });
    },

    // Portfolio navigation
    navigateToAccounts: () => {
      safeNavigate('Portfolio', { screen: 'BrokerageAccounts' });
    },

    navigateToJourney: () => {
      safeNavigate('Portfolio', { screen: 'Journey' });
    },

    // Main tabs
    navigateToDashboard: () => {
      safeNavigate('Main', { screen: 'Dashboard' });
    },

    navigateToWatchlist: () => {
      safeNavigate('Main', { screen: 'Watchlist' });
    },

    navigateToProfile: () => {
      safeNavigate('Main', { screen: 'Profile' });
    },

    // Auth navigation
    navigateToLogin: () => {
      safeNavigate('Auth', { screen: 'Login' });
    },

    navigateToRegister: () => {
      safeNavigate('Auth', { screen: 'Register' });
    },

    // Utility functions
    goBack: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  };
}

// Hook for deep linking and external navigation
export function useDeepLinking() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Helper function to safely navigate with error handling
  const safeNavigate = (routeName: string, params?: any) => {
    try {
      if (navigation && navigation.navigate) {
        // Add a small delay to ensure navigation is ready
        setTimeout(() => {
          (navigation as any).navigate(routeName, params);
        }, 50);
      } else {
        console.warn(`Deep link navigation not ready for route: ${routeName}`);
      }
    } catch (error) {
      console.error(`Deep link navigation error for route ${routeName}:`, error);
    }
  };

  return {
    // Handle stock deep links (e.g., tradingapp://stock/AAPL)
    handleStockLink: (symbol: string, name?: string) => {
      safeNavigate('Trading', {
        screen: 'StockDetail',
        params: { symbol, name, source: 'deeplink' },
      });
    },

    // Handle chart deep links (e.g., tradingapp://chart/AAPL)
    handleChartLink: (symbol: string, timeframe?: string) => {
      safeNavigate('Trading', {
        screen: 'ChartFullScreen',
        params: { symbol, timeframe },
      });
    },

    // Handle market scanner deep links
    handleScannerLink: () => {
      safeNavigate('Market', { screen: 'Scanner' });
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