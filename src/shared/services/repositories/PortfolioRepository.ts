import { BaseRepository, RepositoryResponse, ApiClient } from './BaseRepository';

// Portfolio and account types
export interface Account {
  id: string;
  provider: string;
  accountName: string;
  accountType: string;
  category: string;
  balance: number;
  dayChange: number;
  dayChangePercent: number;
  lastSync: string;
  isConnected: boolean;
  metadata?: Record<string, any>;
}

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  provider: string;
  lastUpdated: string;
  metadata?: Record<string, any>;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  topGainer: Position | null;
  topLoser: Position | null;
  positionCount: number;
  connectedAccounts: number;
  assetAllocation: {
    stocks: number;
    etfs: number;
    crypto: number;
    cash: number;
    other: number;
  };
  sectorAllocation: Record<string, number>;
  lastUpdated: string;
}

export interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Record<string, number>; // symbol -> market value
}

export interface PortfolioHistory {
  data: HistoricalDataPoint[];
  period: '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
  startValue: number;
  endValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  benchmark?: {
    symbol: string;
    startValue: number;
    endValue: number;
    totalReturn: number;
    totalReturnPercent: number;
  };
}

export interface Transaction {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend' | 'split' | 'transfer';
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  date: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'price' | 'change' | 'volume' | 'news';
  condition: 'above' | 'below' | 'equals';
  value: number;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Portfolio repository implementation
export class PortfolioRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }

  // Account management
  async getAccounts(): Promise<RepositoryResponse<Account[]>> {
    const cacheKey = 'portfolio:accounts';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Account[]>('/portfolio/accounts'),
      300000 // 5 minutes cache
    );
  }

  async getAccount(accountId: string): Promise<RepositoryResponse<Account>> {
    const cacheKey = `portfolio:account:${accountId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Account>(`/portfolio/accounts/${accountId}`),
      300000 // 5 minutes cache
    );
  }

  async syncAccount(accountId: string): Promise<RepositoryResponse<Account>> {
    try {
      const account = await this.apiClient.post<Account>(`/portfolio/accounts/${accountId}/sync`);

      // Invalidate related caches
      await this.invalidateAccountCache(accountId);

      return {
        data: account,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Position management
  async getPositions(accountId?: string): Promise<RepositoryResponse<Position[]>> {
    const cacheKey = accountId ? `portfolio:positions:${accountId}` : 'portfolio:positions:all';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Position[]>('/portfolio/positions', {
        headers: accountId ? { 'X-Account-Id': accountId } : {},
      }),
      60000 // 1 minute cache for positions
    );
  }

  async getPosition(positionId: string): Promise<RepositoryResponse<Position>> {
    const cacheKey = `portfolio:position:${positionId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Position>(`/portfolio/positions/${positionId}`),
      60000 // 1 minute cache
    );
  }

  async getPositionsBySymbol(symbol: string): Promise<RepositoryResponse<Position[]>> {
    const cacheKey = `portfolio:positions:symbol:${symbol}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Position[]>(`/portfolio/positions/symbol/${symbol}`),
      60000 // 1 minute cache
    );
  }

  // Portfolio summary and analytics
  async getPortfolioSummary(): Promise<RepositoryResponse<PortfolioSummary>> {
    const cacheKey = 'portfolio:summary';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<PortfolioSummary>('/portfolio/summary'),
      60000 // 1 minute cache
    );
  }

  async getPortfolioHistory(
    period: '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL' = '1M',
    benchmark?: string
  ): Promise<RepositoryResponse<PortfolioHistory>> {
    const cacheKey = `portfolio:history:${period}:${benchmark || 'none'}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<PortfolioHistory>(`/portfolio/history/${period}`, {
        headers: benchmark ? { 'X-Benchmark': benchmark } : {},
      }),
      this.getHistoryCacheTTL(period)
    );
  }

  async getPerformanceMetrics(): Promise<RepositoryResponse<any>> {
    const cacheKey = 'portfolio:metrics';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get('/portfolio/metrics'),
      300000 // 5 minutes cache
    );
  }

  // Transaction history
  async getTransactions(
    accountId?: string,
    symbol?: string,
    limit: number = 100
  ): Promise<RepositoryResponse<Transaction[]>> {
    const cacheKey = `portfolio:transactions:${accountId || 'all'}:${symbol || 'all'}:${limit}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Transaction[]>('/portfolio/transactions', {
        headers: {
          ...(accountId && { 'X-Account-Id': accountId }),
          ...(symbol && { 'X-Symbol': symbol }),
          'X-Limit': limit.toString(),
        },
      }),
      600000 // 10 minutes cache
    );
  }

  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<RepositoryResponse<Transaction>> {
    try {
      const newTransaction = await this.apiClient.post<Transaction>('/portfolio/transactions', transaction);

      // Invalidate related caches
      await this.invalidatePortfolioCache();

      return {
        data: newTransaction,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Alert management
  async getAlerts(): Promise<RepositoryResponse<Alert[]>> {
    const cacheKey = 'portfolio:alerts';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Alert[]>('/portfolio/alerts'),
      300000 // 5 minutes cache
    );
  }

  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<RepositoryResponse<Alert>> {
    try {
      const newAlert = await this.apiClient.post<Alert>('/portfolio/alerts', alert);

      // Invalidate alerts cache
      await this.invalidateCache('portfolio:alerts');

      return {
        data: newAlert,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<RepositoryResponse<Alert>> {
    try {
      const updatedAlert = await this.apiClient.put<Alert>(`/portfolio/alerts/${alertId}`, updates);

      // Invalidate alerts cache
      await this.invalidateCache('portfolio:alerts');

      return {
        data: updatedAlert,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAlert(alertId: string): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.delete(`/portfolio/alerts/${alertId}`);

      // Invalidate alerts cache
      await this.invalidateCache('portfolio:alerts');

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Bulk operations
  async refreshAllPositions(): Promise<RepositoryResponse<Position[]>> {
    try {
      const positions = await this.apiClient.post<Position[]>('/portfolio/positions/refresh');

      // Invalidate all position-related caches
      await this.invalidateCache('portfolio:positions*');
      await this.invalidateCache('portfolio:summary');

      return {
        data: positions,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async syncAllAccounts(): Promise<RepositoryResponse<Account[]>> {
    try {
      const accounts = await this.apiClient.post<Account[]>('/portfolio/accounts/sync-all');

      // Invalidate all portfolio-related caches
      await this.invalidatePortfolioCache();

      return {
        data: accounts,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Cache management
  async invalidateAccountCache(accountId: string): Promise<void> {
    await this.invalidateCache(`portfolio:account:${accountId}`);
    await this.invalidateCache(`portfolio:positions:${accountId}`);
    await this.invalidateCache('portfolio:accounts');
    await this.invalidateCache('portfolio:summary');
  }

  async invalidatePortfolioCache(): Promise<void> {
    await this.invalidateCache('portfolio:*');
  }

  // Get appropriate cache TTL based on data type
  private getHistoryCacheTTL(period: string): number {
    switch (period) {
      case '1D':
        return 300000; // 5 minutes
      case '1W':
        return 900000; // 15 minutes
      case '1M':
      case '3M':
        return 1800000; // 30 minutes
      case '6M':
      case 'YTD':
      case '1Y':
      case 'ALL':
        return 3600000; // 1 hour
      default:
        return 900000; // 15 minutes default
    }
  }

  // Health check for portfolio services
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/portfolio/health', { timeout: 5000 });
      return response === 'ok';
    } catch {
      return false;
    }
  }
}