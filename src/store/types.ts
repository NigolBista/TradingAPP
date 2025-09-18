// Core store types and interfaces
import type {
  User,
  UserProfile,
  NotificationPreferences,
  TradingPreferences,
  PrivacySettings,
  AuthSession,
  LoginCredentials,
  Watchlist,
} from '../services/repositories/UserRepository';

import type {
  Order,
  OrderRequest,
  Position as TradingPosition,
  TradingAlert,
  TradingStrategy,
  TradingSignal,
  RiskMetrics,
} from '../services/repositories/TradingRepository';

import type {
  Account,
  Position as PortfolioPosition,
  PortfolioSummary,
  PortfolioHistory,
  Transaction,
} from '../services/repositories/PortfolioRepository';

import type {
  Quote,
  ChartData,
  NewsItem,
  MarketSummary,
  SearchResult,
} from '../services/repositories/MarketDataRepository';

// State slice type helpers
export interface BaseSlice {
  _meta: {
    lastUpdated: number;
    isLoading: boolean;
    error: string | null;
  };
}

export interface SliceActions<T extends BaseSlice> {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  updateMeta: (meta: Partial<T['_meta']>) => void;
}

// WebSocket connection states
export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected: number | null;
  reconnectAttempts: number;
  subscriptions: string[];
}

// Real-time data types
export interface RealTimeQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

export interface RealTimeUpdate<T = any> {
  type: 'quote' | 'chart' | 'order' | 'position' | 'alert' | 'news';
  symbol?: string;
  data: T;
  timestamp: number;
}

// UI state types
export interface UIState extends BaseSlice {
  theme: 'light' | 'dark' | 'auto';
  activeTab: string;
  modals: {
    [key: string]: {
      isOpen: boolean;
      data?: any;
    };
  };
  notifications: AppNotification[];
  connectionStatus: {
    api: 'connected' | 'disconnected' | 'error';
    websocket: 'connected' | 'disconnected' | 'connecting' | 'error';
  };
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

// Auth state types
export interface AuthState extends BaseSlice {
  user: User | null;
  profile: UserProfile | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  permissions: string[];
  preferences: {
    notifications: NotificationPreferences;
    trading: TradingPreferences;
    privacy: PrivacySettings;
  };
}

// Trading state types
export interface TradingState extends BaseSlice {
  orders: {
    [orderId: string]: Order;
  };
  positions: {
    [positionKey: string]: TradingPosition; // accountId:symbol
  };
  alerts: {
    [alertId: string]: TradingAlert;
  };
  strategies: {
    [strategyId: string]: TradingStrategy;
  };
  signals: {
    [symbol: string]: TradingSignal[];
  };
  riskMetrics: RiskMetrics | null;
  marketStatus: {
    isOpen: boolean;
    nextOpen?: string;
    nextClose?: string;
  };
  realTimeData: {
    [symbol: string]: RealTimeQuote;
  };
  subscriptions: Set<string>; // symbols being tracked
}

// Portfolio state types
export interface PortfolioState extends BaseSlice {
  accounts: {
    [accountId: string]: Account;
  };
  positions: {
    [positionKey: string]: PortfolioPosition; // accountId:symbol
  };
  summary: PortfolioSummary | null;
  history: {
    [period: string]: PortfolioHistory;
  };
  transactions: {
    [transactionId: string]: Transaction;
  };
  performance: {
    [period: string]: PerformanceMetrics;
  };
}

// Market data state types
export interface MarketState extends BaseSlice {
  quotes: {
    [symbol: string]: Quote;
  };
  charts: {
    [chartKey: string]: ChartData; // symbol:timeframe
  };
  news: {
    global: NewsItem[];
    bySymbol: {
      [symbol: string]: NewsItem[];
    };
  };
  marketSummary: MarketSummary | null;
  watchlists: {
    [watchlistId: string]: Watchlist;
  };
  searchResults: {
    [query: string]: SearchResult[];
  };
  trends: {
    gainers: Quote[];
    losers: Quote[];
    mostActive: Quote[];
  };
}

// Root store state
export interface AppState {
  auth: AuthState;
  trading: TradingState;
  portfolio: PortfolioState;
  market: MarketState;
  ui: UIState;
  websocket: WebSocketState;

  // Shared services (injected dependencies)
  apiClient: any; // Will be typed properly when ApiClient is imported
  secureStorage: any; // Will be typed properly when SecureStorage is imported
}

// Store actions interface
export interface StoreActions {
  // Global actions
  hydrate: () => Promise<void>;
  reset: () => void;

  // Auth actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshToken: () => Promise<void>;

  // Trading actions
  submitOrder: (order: OrderRequest) => Promise<string>;
  cancelOrder: (orderId: string) => Promise<void>;
  updatePosition: (accountId: string, symbol: string) => Promise<void>;
  createAlert: (alert: Omit<TradingAlert, 'id'>) => Promise<void>;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;

  // Portfolio actions
  refreshSummary: () => Promise<void>;
  syncAccount: (accountId: string) => Promise<void>;
  updatePortfolioHistory: (period: string) => Promise<void>;

  // Market actions
  getQuote: (symbol: string) => Promise<Quote>;
  getChart: (symbol: string, timeframe: string) => Promise<ChartData>;
  searchSymbols: (query: string) => Promise<SearchResult[]>;
  refreshMarketSummary: () => Promise<void>;
  updateWatchlist: (watchlistId: string, updates: Partial<Watchlist>) => Promise<void>;

  // UI actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  openModal: (modalId: string, data?: any) => void;
  closeModal: (modalId: string) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (notificationId: string) => void;
  updateConnectionStatus: (service: 'api' | 'websocket', status: string) => void;

  // WebSocket actions
  connect: () => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  handleMessage: (message: RealTimeUpdate) => void;
}

// Store configuration
export interface StoreConfig {
  persist: {
    name: string;
    partialize?: (state: AppState) => Partial<AppState>;
    version?: number;
    migrate?: (persistedState: any, version: number) => AppState;
  };
  devtools: {
    enabled: boolean;
    name: string;
  };
  middleware: {
    websocket: boolean;
    persistence: boolean;
    devtools: boolean;
  };
}

// Selector types for optimized subscriptions
export type StateSelector<T> = (state: AppState) => T;
export type EqualityFn<T> = (a: T, b: T) => boolean;

// Hook types
export interface UseStoreReturn<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Re-export types from repositories
export type {
  User,
  UserProfile,
  NotificationPreferences,
  TradingPreferences,
  PrivacySettings,
  AuthSession,
  LoginCredentials,
  Watchlist,
} from '../services/repositories/UserRepository';

export type {
  Order,
  OrderRequest,
  Position as TradingPosition,
  TradingAlert,
  TradingStrategy,
  TradingSignal,
  RiskMetrics,
} from '../services/repositories/TradingRepository';

export type {
  Account,
  Position as PortfolioPosition,
  PortfolioSummary,
  PortfolioHistory,
  Transaction,
} from '../services/repositories/PortfolioRepository';

export type {
  Quote,
  ChartData,
  NewsItem,
  MarketSummary,
  SearchResult,
} from '../services/repositories/MarketDataRepository';

// Performance metrics type
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  beta: number;
  alpha: number;
  volatility: number;
  lastUpdated: string;
}