import { BaseRepository, RepositoryResponse, ApiClient } from './BaseRepository';

// Trading and order types
export interface Order {
  id: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'submitted' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averageFillPrice?: number;
  totalFees: number;
  submittedAt: string;
  updatedAt: string;
  filledAt?: string;
  cancelledAt?: string;
  externalOrderId?: string;
  metadata?: Record<string, any>;
}

export interface OrderRequest {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface Position {
  accountId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  side: 'long' | 'short';
  openDate: string;
  lastUpdated: string;
}

export interface TradingAlert {
  id: string;
  symbol: string;
  type: 'price' | 'volume' | 'change' | 'technical' | 'news';
  condition: {
    operator: 'above' | 'below' | 'equals' | 'crosses_above' | 'crosses_below';
    value: number;
    timeframe?: string;
    indicator?: string;
  };
  message?: string;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description?: string;
  type: 'momentum' | 'mean_reversion' | 'breakout' | 'swing' | 'scalping' | 'custom';
  parameters: Record<string, any>;
  symbols: string[];
  isActive: boolean;
  isBacktestable: boolean;
  performance?: StrategyPerformance;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyPerformance {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  totalReturnPercent: number;
  period: string;
  lastUpdated: string;
}

export interface BacktestRequest {
  strategyId: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  parameters?: Record<string, any>;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  summary: StrategyPerformance;
  trades: BacktestTrade[];
  equity: { date: string; value: number }[];
  drawdown: { date: string; value: number }[];
  createdAt: string;
}

export interface BacktestTrade {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
  pnl: number;
  cumPnl: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'hold';
  strength: 'weak' | 'moderate' | 'strong';
  source: 'technical' | 'fundamental' | 'sentiment' | 'ai' | 'strategy';
  confidence: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
  reason: string;
  indicators?: Record<string, any>;
  createdAt: string;
  expiresAt?: string;
}

export interface RiskMetrics {
  portfolioValue: number;
  exposure: number;
  leverage: number;
  beta: number;
  var: number; // Value at Risk
  sharpeRatio: number;
  maxDrawdown: number;
  riskScore: number;
  concentration: {
    bySymbol: Record<string, number>;
    bySector: Record<string, number>;
    byAssetType: Record<string, number>;
  };
  lastUpdated: string;
}

// Trading repository implementation
export class TradingRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }

  // Order management
  async getOrders(
    accountId?: string,
    status?: string,
    limit: number = 100
  ): Promise<RepositoryResponse<Order[]>> {
    const cacheKey = `trading:orders:${accountId || 'all'}:${status || 'all'}:${limit}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Order[]>('/trading/orders', {
        headers: {
          ...(accountId && { 'X-Account-Id': accountId }),
          ...(status && { 'X-Status': status }),
          'X-Limit': limit.toString(),
        },
      }),
      60000 // 1 minute cache
    );
  }

  async getOrder(orderId: string): Promise<RepositoryResponse<Order>> {
    const cacheKey = `trading:order:${orderId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Order>(`/trading/orders/${orderId}`),
      30000 // 30 seconds cache
    );
  }

  async submitOrder(orderRequest: OrderRequest): Promise<RepositoryResponse<Order>> {
    try {
      const order = await this.apiClient.post<Order>('/trading/orders', orderRequest);

      // Invalidate relevant caches
      await this.invalidateCache('trading:orders*');
      await this.invalidateCache('trading:positions*');

      return {
        data: order,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cancelOrder(orderId: string): Promise<RepositoryResponse<Order>> {
    try {
      const order = await this.apiClient.delete<Order>(`/trading/orders/${orderId}`);

      // Invalidate relevant caches
      await this.invalidateCache(`trading:order:${orderId}`);
      await this.invalidateCache('trading:orders*');

      return {
        data: order,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async modifyOrder(
    orderId: string,
    modifications: Partial<OrderRequest>
  ): Promise<RepositoryResponse<Order>> {
    try {
      const order = await this.apiClient.put<Order>(`/trading/orders/${orderId}`, modifications);

      // Update cache
      await this.cache.set(`trading:order:${orderId}`, order, 30000);
      await this.invalidateCache('trading:orders*');

      return {
        data: order,
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
    const cacheKey = `trading:positions:${accountId || 'all'}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Position[]>('/trading/positions', {
        headers: accountId ? { 'X-Account-Id': accountId } : {},
      }),
      60000 // 1 minute cache
    );
  }

  async getPosition(accountId: string, symbol: string): Promise<RepositoryResponse<Position | null>> {
    const cacheKey = `trading:position:${accountId}:${symbol}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Position>(`/trading/positions/${accountId}/${symbol}`),
      60000 // 1 minute cache
    );
  }

  async closePosition(
    accountId: string,
    symbol: string,
    quantity?: number
  ): Promise<RepositoryResponse<Order>> {
    try {
      const order = await this.apiClient.post<Order>(`/trading/positions/${accountId}/${symbol}/close`, {
        quantity,
      });

      // Invalidate relevant caches
      await this.invalidateCache(`trading:position:${accountId}:${symbol}`);
      await this.invalidateCache('trading:positions*');
      await this.invalidateCache('trading:orders*');

      return {
        data: order,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Alert management
  async getAlerts(): Promise<RepositoryResponse<TradingAlert[]>> {
    const cacheKey = 'trading:alerts';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<TradingAlert[]>('/trading/alerts'),
      300000 // 5 minutes cache
    );
  }

  async createAlert(alert: Omit<TradingAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<RepositoryResponse<TradingAlert>> {
    try {
      const newAlert = await this.apiClient.post<TradingAlert>('/trading/alerts', alert);

      // Invalidate alerts cache
      await this.invalidateCache('trading:alerts');

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

  async updateAlert(
    alertId: string,
    updates: Partial<TradingAlert>
  ): Promise<RepositoryResponse<TradingAlert>> {
    try {
      const alert = await this.apiClient.put<TradingAlert>(`/trading/alerts/${alertId}`, updates);

      // Invalidate alerts cache
      await this.invalidateCache('trading:alerts');

      return {
        data: alert,
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
      await this.apiClient.delete(`/trading/alerts/${alertId}`);

      // Invalidate alerts cache
      await this.invalidateCache('trading:alerts');

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

  // Strategy management
  async getStrategies(): Promise<RepositoryResponse<TradingStrategy[]>> {
    const cacheKey = 'trading:strategies';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<TradingStrategy[]>('/trading/strategies'),
      3600000 // 1 hour cache
    );
  }

  async getStrategy(strategyId: string): Promise<RepositoryResponse<TradingStrategy>> {
    const cacheKey = `trading:strategy:${strategyId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<TradingStrategy>(`/trading/strategies/${strategyId}`),
      3600000 // 1 hour cache
    );
  }

  async createStrategy(
    strategy: Omit<TradingStrategy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RepositoryResponse<TradingStrategy>> {
    try {
      const newStrategy = await this.apiClient.post<TradingStrategy>('/trading/strategies', strategy);

      // Invalidate strategies cache
      await this.invalidateCache('trading:strategies');

      return {
        data: newStrategy,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateStrategy(
    strategyId: string,
    updates: Partial<TradingStrategy>
  ): Promise<RepositoryResponse<TradingStrategy>> {
    try {
      const strategy = await this.apiClient.put<TradingStrategy>(`/trading/strategies/${strategyId}`, updates);

      // Update cache
      await this.cache.set(`trading:strategy:${strategyId}`, strategy, 3600000);
      await this.invalidateCache('trading:strategies');

      return {
        data: strategy,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Backtesting
  async runBacktest(request: BacktestRequest): Promise<RepositoryResponse<BacktestResult>> {
    try {
      const result = await this.apiClient.post<BacktestResult>('/trading/backtest', request, {
        timeout: 60000, // 1 minute timeout for backtests
      });

      return {
        data: result,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBacktestResults(strategyId: string): Promise<RepositoryResponse<BacktestResult[]>> {
    const cacheKey = `trading:backtest:${strategyId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<BacktestResult[]>(`/trading/strategies/${strategyId}/backtests`),
      3600000 // 1 hour cache
    );
  }

  // Trading signals
  async getSignals(
    symbols?: string[],
    sources?: string[]
  ): Promise<RepositoryResponse<TradingSignal[]>> {
    const cacheKey = `trading:signals:${symbols?.join(',') || 'all'}:${sources?.join(',') || 'all'}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<TradingSignal[]>('/trading/signals', {
        headers: {
          ...(symbols && { 'X-Symbols': symbols.join(',') }),
          ...(sources && { 'X-Sources': sources.join(',') }),
        },
      }),
      300000 // 5 minutes cache
    );
  }

  async getSignalsForSymbol(symbol: string): Promise<RepositoryResponse<TradingSignal[]>> {
    const cacheKey = `trading:signals:${symbol}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<TradingSignal[]>(`/trading/signals/${symbol}`),
      300000 // 5 minutes cache
    );
  }

  // Risk management
  async getRiskMetrics(accountId?: string): Promise<RepositoryResponse<RiskMetrics>> {
    const cacheKey = `trading:risk:${accountId || 'all'}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<RiskMetrics>('/trading/risk', {
        headers: accountId ? { 'X-Account-Id': accountId } : {},
      }),
      300000 // 5 minutes cache
    );
  }

  async validateOrder(orderRequest: OrderRequest): Promise<RepositoryResponse<{ valid: boolean; warnings: string[]; errors: string[] }>> {
    try {
      const validation = await this.apiClient.post<{ valid: boolean; warnings: string[]; errors: string[] }>(
        '/trading/orders/validate',
        orderRequest
      );

      return {
        data: validation,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Market hours and trading status
  async getMarketStatus(): Promise<RepositoryResponse<{ isOpen: boolean; nextOpen?: string; nextClose?: string }>> {
    const cacheKey = 'trading:market_status';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get('/trading/market-status'),
      60000 // 1 minute cache
    );
  }

  async getTradingPermissions(accountId: string): Promise<RepositoryResponse<{ permissions: string[]; restrictions: string[] }>> {
    const cacheKey = `trading:permissions:${accountId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get(`/trading/accounts/${accountId}/permissions`),
      3600000 // 1 hour cache
    );
  }

  // Cache management
  async invalidateTradingCache(): Promise<void> {
    await this.invalidateCache('trading:*');
  }

  async invalidateOrdersCache(): Promise<void> {
    await this.invalidateCache('trading:orders*');
  }

  async invalidatePositionsCache(): Promise<void> {
    await this.invalidateCache('trading:positions*');
  }

  // Bulk operations
  async refreshAllPositions(): Promise<RepositoryResponse<Position[]>> {
    try {
      const positions = await this.apiClient.post<Position[]>('/trading/positions/refresh');

      // Invalidate position caches
      await this.invalidatePositionsCache();

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

  async cancelAllOrders(accountId?: string): Promise<RepositoryResponse<Order[]>> {
    try {
      const orders = await this.apiClient.delete<Order[]>('/trading/orders/cancel-all', {
        headers: accountId ? { 'X-Account-Id': accountId } : {},
      });

      // Invalidate order caches
      await this.invalidateOrdersCache();

      return {
        data: orders,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check for trading services
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/trading/health', { timeout: 5000 });
      return response === 'ok';
    } catch {
      return false;
    }
  }
}