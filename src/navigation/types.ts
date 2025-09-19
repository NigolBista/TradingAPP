import { NavigatorScreenParams } from '@react-navigation/native';

// Root navigation structure
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Trading: NavigatorScreenParams<TradingStackParamList>;
  Portfolio: NavigatorScreenParams<PortfolioStackParamList>;
  Market: NavigatorScreenParams<MarketStackParamList>;
};

// Authentication flow
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Main tab navigation
export type MainTabParamList = {
  Dashboard: undefined;
  Watchlist: undefined;
  Market: undefined;
  Focus: undefined;
  Profile: undefined;
};

// Trading-specific screens
export type TradingStackParamList = {
  StockDetail: {
    symbol: string;
    name?: string;
    source?: 'watchlist' | 'search' | 'portfolio' | 'trending';
  };
  ChartFullScreen: {
    symbol: string;
    timeframe?: string;
    indicators?: string[];
  };
  ChartChat: {
    symbol: string;
    chartData?: any;
  };
  IndicatorConfig: {
    symbol: string;
    currentIndicators?: string[];
  };
};

// Portfolio and account screens
export type PortfolioStackParamList = {
  BrokerageAccounts: undefined;
  Journey: undefined;
};

// Market data and analysis screens
export type MarketStackParamList = {
  Scanner: undefined;
  AIInsights: undefined;
  MarketOverview: undefined;
  FederalReserve: undefined;
  DecalpX: undefined;
  MarketOverviewPage: undefined;
  EarningsCalendar: undefined;
  Chat: {
    context?: 'market' | 'stock' | 'general';
    symbol?: string;
  };
};

// Combined type for useNavigation hook
export type AllStackParamList = RootStackParamList &
  AuthStackParamList &
  MainTabParamList &
  TradingStackParamList &
  PortfolioStackParamList &
  MarketStackParamList;

// Navigation prop types for screens
export type ScreenNavigationProp<T extends keyof AllStackParamList> = {
  navigate: <K extends keyof AllStackParamList>(
    screen: K,
    params?: AllStackParamList[K]
  ) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  push: <K extends keyof AllStackParamList>(
    screen: K,
    params?: AllStackParamList[K]
  ) => void;
  replace: <K extends keyof AllStackParamList>(
    screen: K,
    params?: AllStackParamList[K]
  ) => void;
};

// Route prop types for screens
export type ScreenRouteProp<T extends keyof AllStackParamList> = {
  key: string;
  name: T;
  params?: AllStackParamList[T];
};

// Combined navigation and route props
export type ScreenProps<T extends keyof AllStackParamList> = {
  navigation: ScreenNavigationProp<T>;
  route: ScreenRouteProp<T>;
};

// Deep linking configuration
export const LinkingConfig = {
  prefixes: ['tradingapp://', 'https://tradingapp.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Watchlist: 'watchlist',
          Market: 'market',
          Focus: 'focus',
          Profile: 'profile',
        },
      },
      Trading: {
        screens: {
          StockDetail: 'stock/:symbol',
          ChartFullScreen: 'chart/:symbol',
          ChartChat: 'chart-chat/:symbol',
          IndicatorConfig: 'indicators/:symbol',
        },
      },
      Portfolio: {
        screens: {
          BrokerageAccounts: 'accounts',
          Journey: 'journey',
        },
      },
      Market: {
        screens: {
          Scanner: 'scanner',
          AIInsights: 'insights',
          MarketOverview: 'market-overview',
          FederalReserve: 'fed',
          DecalpX: 'decalp',
          MarketOverviewPage: 'market-page',
          EarningsCalendar: 'earnings',
          Chat: 'chat',
        },
      },
    },
  },
};