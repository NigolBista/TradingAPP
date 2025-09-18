// Repository exports
export { BaseRepository, RepositoryError } from './BaseRepository';
export { MarketDataRepository } from './MarketDataRepository';
export { PortfolioRepository } from './PortfolioRepository';
export { UserRepository } from './UserRepository';
export { TradingRepository } from './TradingRepository';

// Type exports
export type {
  ApiClient,
  RequestConfig,
  RepositoryResponse,
} from './BaseRepository';

export type {
  Quote,
  ChartData,
  NewsItem,
  MarketSummary,
  SearchResult,
} from './MarketDataRepository';

export type {
  Account,
  Position as PortfolioPosition,
  PortfolioSummary,
  HistoricalDataPoint,
  PortfolioHistory,
  Transaction,
  Alert as PortfolioAlert,
} from './PortfolioRepository';

export type {
  User,
  UserProfile,
  NotificationPreferences,
  TradingPreferences,
  PrivacySettings,
  Watchlist,
  WatchlistItem,
  AuthSession,
  LoginCredentials,
  RegisterData,
} from './UserRepository';

export type {
  Order,
  OrderRequest,
  Position as TradingPosition,
  TradingAlert,
  TradingStrategy,
  StrategyPerformance,
  BacktestRequest,
  BacktestResult,
  TradingSignal,
  RiskMetrics,
} from './TradingRepository';