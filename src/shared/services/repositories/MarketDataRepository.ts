import { BaseRepository, RepositoryResponse, ApiClient } from './BaseRepository';

// Market data types
export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp: number;
}

export interface ChartData {
  symbol: string;
  timeframe: string;
  data: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  indicators?: Record<string, any[]>;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  imageUrl?: string;
}

export interface MarketSummary {
  indices: {
    symbol: string;
    name: string;
    value: number;
    change: number;
    changePercent: number;
  }[];
  sectors: {
    name: string;
    change: number;
    changePercent: number;
  }[];
  movers: {
    gainers: Quote[];
    losers: Quote[];
    mostActive: Quote[];
  };
  lastUpdated: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'index';
  exchange: string;
  currency: string;
  market?: string;
}

// Market data repository implementation
export class MarketDataRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }

  // Get real-time quote for a single symbol
  async getQuote(symbol: string): Promise<RepositoryResponse<Quote>> {
    const cacheKey = `quote:${symbol}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Quote>(`/quotes/${symbol}`),
      30000 // 30 seconds cache
    );
  }

  // Get quotes for multiple symbols
  async getBulkQuotes(symbols: string[]): Promise<RepositoryResponse<Quote[]>> {
    const cacheKey = `quotes:bulk:${symbols.sort().join(',')}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.post<Quote[]>('/quotes/bulk', { symbols }),
      30000 // 30 seconds cache
    );
  }

  // Get chart data for a symbol
  async getChartData(
    symbol: string,
    timeframe: string = '1D',
    indicators?: string[]
  ): Promise<RepositoryResponse<ChartData>> {
    const cacheKey = `chart:${symbol}:${timeframe}:${indicators?.join(',') || 'none'}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<ChartData>(`/charts/${symbol}`, {
        cache: true,
        cacheTTL: this.getChartCacheTTL(timeframe),
      }),
      this.getChartCacheTTL(timeframe)
    );
  }

  // Get news for a symbol or general market news
  async getNews(
    symbol?: string,
    limit: number = 20
  ): Promise<RepositoryResponse<NewsItem[]>> {
    const cacheKey = symbol ? `news:${symbol}:${limit}` : `news:market:${limit}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<NewsItem[]>('/news', {
        headers: { 'X-Symbol': symbol || 'market' },
        cache: true,
        cacheTTL: 300000, // 5 minutes
      }),
      300000 // 5 minutes cache
    );
  }

  // Get market summary data
  async getMarketSummary(): Promise<RepositoryResponse<MarketSummary>> {
    const cacheKey = 'market:summary';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<MarketSummary>('/market/summary'),
      60000 // 1 minute cache
    );
  }

  // Search for symbols
  async searchSymbols(query: string): Promise<RepositoryResponse<SearchResult[]>> {
    if (query.length < 2) {
      return {
        data: [],
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    }

    const cacheKey = `search:${query.toLowerCase()}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
      3600000 // 1 hour cache for search results
    );
  }

  // Get company fundamentals
  async getFundamentals(symbol: string): Promise<RepositoryResponse<any>> {
    const cacheKey = `fundamentals:${symbol}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get(`/fundamentals/${symbol}`),
      86400000 // 24 hours cache for fundamentals
    );
  }

  // Real-time data subscription (WebSocket-like interface)
  async subscribeToRealTimeData(
    symbols: string[],
    callback: (data: Quote) => void
  ): Promise<() => void> {
    // This would implement WebSocket connection
    // For now, return a polling mechanism

    const interval = setInterval(async () => {
      try {
        const response = await this.getBulkQuotes(symbols);
        if (response.success) {
          response.data.forEach(callback);
        }
      } catch (error) {
        console.error('Real-time data subscription error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Return unsubscribe function
    return () => clearInterval(interval);
  }

  // Batch quote updates with deduplication
  async updateQuotesCache(symbols: string[]): Promise<void> {
    const uniqueSymbols = [...new Set(symbols)];
    const chunkSize = 50; // Limit API requests

    await this.batchFetch(
      this.chunkArray(uniqueSymbols, chunkSize),
      async (chunk: string[]) => {
        const response = await this.getBulkQuotes(chunk);
        return response.data;
      }
    );
  }

  // Invalidate cache for symbol data
  async invalidateSymbolCache(symbol: string): Promise<void> {
    await this.invalidateCache(`quote:${symbol}*`);
    await this.invalidateCache(`chart:${symbol}*`);
    await this.invalidateCache(`news:${symbol}*`);
    await this.invalidateCache(`fundamentals:${symbol}`);
  }

  // Get appropriate cache TTL based on timeframe
  private getChartCacheTTL(timeframe: string): number {
    switch (timeframe) {
      case '1m':
      case '5m':
        return 60000; // 1 minute
      case '15m':
      case '30m':
        return 300000; // 5 minutes
      case '1h':
      case '4h':
        return 900000; // 15 minutes
      case '1D':
        return 1800000; // 30 minutes
      case '1W':
      case '1M':
        return 3600000; // 1 hour
      default:
        return 300000; // 5 minutes default
    }
  }

  // Utility function to chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Health check for market data services
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health', { timeout: 5000 });
      return response === 'ok';
    } catch {
      return false;
    }
  }
}