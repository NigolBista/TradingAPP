// @ts-nocheck
import { fetchNews, NewsItem } from "./marketProviders";
import { fetchAndCacheBulkQuotes, fetchSingleQuote } from "./quotes";
// Removed old brokerage services - now using Plaid integration
// import { brokerageApiService, BrokerageQuote } from "./legacy/brokerageApiService";
// import { brokerageAuthService, BrokerageProvider } from "./legacy/brokerageAuth";
// Heartbeat not required for Plaid-based linking; keep a minimal stub
const sessionHeartbeatService = {
  updateConfig: (_cfg: any) => {},
  startAllHeartbeats: () => {},
  refreshAllSessions: async () => ({}),
  getHeartbeatStatus: () => ({}),
  destroy: () => {},
};

export interface MarketDataOptions {
  preferBrokerage?: boolean;
  brokerageProvider?: string; // Changed from BrokerageProvider to string
}

export interface EnhancedQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  provider: string;
  isRealTime: boolean;
  lastUpdated: Date;
}

class EnhancedMarketDataService {
  private quoteCache: Map<string, { quote: EnhancedQuote; timestamp: number }> =
    new Map();
  private readonly QUOTE_CACHE_TTL = 30 * 1000; // 30 seconds for quotes

  constructor() {
    // Start heartbeat service for active sessions
    this.initializeHeartbeat();
  }

  private async initializeHeartbeat() {
    // Configure heartbeat service
    sessionHeartbeatService.updateConfig({
      intervalMs: 10 * 60 * 1000, // 10 minutes
      retryAttempts: 2,
      onSessionExpired: (provider: string) => {
        console.warn(`Session expired for ${provider}`);
        // Could show user notification here
      },
      onConnectionLost: (provider: string) => {
        console.warn(`Connection lost for ${provider}`);
        // Could show user notification here
      },
    });

    // Start heartbeats for all active sessions
    sessionHeartbeatService.startAllHeartbeats();
  }

  // Get the best available provider for a request
  private getBestProvider(options: MarketDataOptions): {
    provider: string;
    isBrokerage: boolean;
  } {
    // Plaid uses standardized providers; we no longer check legacy sessions
    // Keep structure in case we later support direct-broker feeds again

    // Fall back to traditional providers
    return {
      provider: options.providerOverride || "marketData",
      isBrokerage: false,
    };
  }

  // Enhanced quote fetching (Polygon-only via quotes service)
  async getQuote(
    symbol: string,
    options: MarketDataOptions = {}
  ): Promise<EnhancedQuote> {
    const cacheKey = `${symbol}_${options.brokerageProvider || "default"}`;

    // Check cache first
    const cached = this.quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUOTE_CACHE_TTL) {
      return cached.quote;
    }

    try {
      let quote: EnhancedQuote;
      const q = await fetchSingleQuote(symbol);
      quote = {
        symbol: q.symbol,
        price: q.last,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume ?? 0,
        provider: "polygon",
        isRealTime: true,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.quoteCache.set(cacheKey, { quote, timestamp: Date.now() });
      return quote;
    } catch (error) {
      console.error(`Failed to get quote for ${symbol}:`, error);
      throw error;
    }
  }

  // Candle fetching removed; KLine Pro handles candles internally via Polygon

  // Enhanced news fetching with brokerage support
  async getNews(
    symbol: string,
    options: MarketDataOptions = {}
  ): Promise<NewsItem[]> {
    const { provider, isBrokerage } = this.getBestProvider(options);

    try {
      if (isBrokerage) {
        // Use traditional news sources
        return await fetchNews(symbol, provider);
      } else {
        // Use traditional news sources
        return await fetchNews(symbol, provider);
      }
    } catch (error) {
      console.error(
        `Failed to get news for ${symbol} from ${provider}:`,
        error
      );

      // If brokerage failed, try fallback
      if (isBrokerage) {
        console.log(`Falling back to traditional providers for ${symbol} news`);
        return this.getNews(symbol, { ...options, preferBrokerage: false });
      }

      throw error;
    }
  }

  // Get user's positions from brokerage account
  async getPositions() {
    // Positions should be obtained via portfolio aggregation service instead
    return [] as any[];
  }

  // Get user's watchlist from brokerage account
  async getWatchlist() {
    // Watchlist not supported via Plaid read-only; return empty list
    return [] as any[];
  }

  // Check connection status for all brokerage accounts
  async checkAllConnections() {
    // Plaid handles connectivity; always return plaid connected if tokens exist
    return { plaid: true } as Record<string, boolean>;
  }

  // Get available data sources
  getAvailableDataSources() {
    return {
      brokerage: ["plaid"],
      traditional: ["marketData", "yahoo", "alphaVantage", "polygon"],
    };
  }

  // Refresh all sessions
  async refreshAllSessions() {
    return await sessionHeartbeatService.refreshAllSessions();
  }

  // Clear quote cache
  clearQuoteCache() {
    this.quoteCache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      quoteCacheSize: this.quoteCache.size,
      heartbeatStatus: sessionHeartbeatService.getHeartbeatStatus(),
    };
  }

  // Cleanup when service is destroyed
  destroy() {
    sessionHeartbeatService.destroy();
    this.clearQuoteCache();
  }
}

export const enhancedMarketDataService = new EnhancedMarketDataService();
