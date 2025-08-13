import {
  fetchCandles,
  fetchNews,
  Candle,
  NewsItem,
  FetchCandlesOptions,
} from "./marketProviders";
import { brokerageApiService, BrokerageQuote } from "./brokerageApiService";
import { brokerageAuthService, BrokerageProvider } from "./brokerageAuth";
import { sessionHeartbeatService } from "./sessionHeartbeat";

export interface MarketDataOptions extends FetchCandlesOptions {
  preferBrokerage?: boolean;
  brokerageProvider?: BrokerageProvider;
}

export interface EnhancedQuote extends BrokerageQuote {
  provider: string;
  isRealTime: boolean;
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
      onSessionExpired: (provider) => {
        console.warn(`Session expired for ${provider}`);
        // Could show user notification here
      },
      onConnectionLost: (provider) => {
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
    // If user specifically wants brokerage data and has an active session
    if (options.preferBrokerage && options.brokerageProvider) {
      const session = brokerageAuthService.getSession(
        options.brokerageProvider
      );
      if (session) {
        return { provider: options.brokerageProvider, isBrokerage: true };
      }
    }

    // Auto-select best available brokerage provider
    if (options.preferBrokerage) {
      const activeSessions = brokerageAuthService.getActiveSessions();
      if (activeSessions.length > 0) {
        return { provider: activeSessions[0], isBrokerage: true };
      }
    }

    // Fall back to traditional providers
    return {
      provider: options.providerOverride || "marketData",
      isBrokerage: false,
    };
  }

  // Enhanced quote fetching with brokerage support
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

    const { provider, isBrokerage } = this.getBestProvider(options);

    try {
      let quote: EnhancedQuote;

      if (isBrokerage) {
        // Use brokerage API for real-time data
        const brokerageQuote = await brokerageApiService.getQuote(
          symbol,
          provider as BrokerageProvider
        );
        quote = {
          ...brokerageQuote,
          provider,
          isRealTime: true,
        };
      } else {
        // Fall back to traditional providers (delayed data)
        // This is a simplified implementation - you'd need to adapt based on your current quote fetching
        const candles = await fetchCandles(symbol, {
          ...options,
          providerOverride: provider as any,
        });
        const latestCandle = candles[candles.length - 1];

        if (!latestCandle) {
          throw new Error(`No data available for ${symbol}`);
        }

        quote = {
          symbol,
          price: latestCandle.close,
          change: 0, // Would need previous close to calculate
          changePercent: 0,
          volume: latestCandle.volume,
          high: latestCandle.high,
          low: latestCandle.low,
          open: latestCandle.open,
          timestamp: latestCandle.time,
          provider,
          isRealTime: false,
        };
      }

      // Cache the result
      this.quoteCache.set(cacheKey, { quote, timestamp: Date.now() });
      return quote;
    } catch (error) {
      console.error(
        `Failed to get quote for ${symbol} from ${provider}:`,
        error
      );

      // If brokerage failed, try fallback to traditional providers
      if (isBrokerage) {
        console.log(`Falling back to traditional providers for ${symbol}`);
        return this.getQuote(symbol, { ...options, preferBrokerage: false });
      }

      throw error;
    }
  }

  // Enhanced candle fetching with brokerage support
  async getCandles(
    symbol: string,
    options: MarketDataOptions = {}
  ): Promise<Candle[]> {
    const { provider, isBrokerage } = this.getBestProvider(options);

    try {
      if (isBrokerage) {
        // Use brokerage API
        const timeframe = this.mapResolutionToBrokerageTimeframe(
          options.resolution
        );
        return await brokerageApiService.getCandles(
          symbol,
          provider as BrokerageProvider,
          timeframe
        );
      } else {
        // Use traditional providers
        return await fetchCandles(symbol, {
          ...options,
          providerOverride: provider as any,
        });
      }
    } catch (error) {
      console.error(
        `Failed to get candles for ${symbol} from ${provider}:`,
        error
      );

      // If brokerage failed, try fallback
      if (isBrokerage) {
        console.log(
          `Falling back to traditional providers for ${symbol} candles`
        );
        return this.getCandles(symbol, { ...options, preferBrokerage: false });
      }

      throw error;
    }
  }

  // Enhanced news fetching with brokerage support
  async getNews(
    symbol: string,
    options: MarketDataOptions = {}
  ): Promise<NewsItem[]> {
    const { provider, isBrokerage } = this.getBestProvider(options);

    try {
      if (isBrokerage) {
        // Use brokerage API for more comprehensive news
        return await brokerageApiService.getNews(
          symbol,
          provider as BrokerageProvider
        );
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
  async getPositions(provider?: BrokerageProvider) {
    if (provider) {
      return await brokerageApiService.getPositions(provider);
    }

    // Get positions from all connected accounts
    const activeSessions = brokerageAuthService.getActiveSessions();
    const allPositions = [];

    for (const sessionProvider of activeSessions) {
      try {
        const positions = await brokerageApiService.getPositions(
          sessionProvider
        );
        allPositions.push(
          ...positions.map((pos) => ({ ...pos, provider: sessionProvider }))
        );
      } catch (error) {
        console.error(
          `Failed to get positions from ${sessionProvider}:`,
          error
        );
      }
    }

    return allPositions;
  }

  // Get user's watchlist from brokerage account
  async getWatchlist(provider?: BrokerageProvider) {
    if (provider) {
      return await brokerageApiService.getWatchlist(provider);
    }

    // Get watchlist from all connected accounts
    const activeSessions = brokerageAuthService.getActiveSessions();
    const allWatchlist = [];

    for (const sessionProvider of activeSessions) {
      try {
        const watchlist = await brokerageApiService.getWatchlist(
          sessionProvider
        );
        allWatchlist.push(
          ...watchlist.map((item) => ({ ...item, provider: sessionProvider }))
        );
      } catch (error) {
        console.error(
          `Failed to get watchlist from ${sessionProvider}:`,
          error
        );
      }
    }

    return allWatchlist;
  }

  // Map resolution to brokerage timeframe
  private mapResolutionToBrokerageTimeframe(resolution?: string): string {
    switch (resolution) {
      case "1":
        return "1minute";
      case "5":
        return "5minute";
      case "15":
        return "15minute";
      case "30":
        return "30minute";
      case "1H":
        return "hour";
      case "D":
        return "day";
      case "W":
        return "week";
      case "M":
        return "month";
      default:
        return "day";
    }
  }

  // Check connection status for all brokerage accounts
  async checkAllConnections() {
    const activeSessions = brokerageAuthService.getActiveSessions();
    const connectionStatus: Record<string, boolean> = {};

    for (const provider of activeSessions) {
      try {
        connectionStatus[provider] = await brokerageApiService.checkConnection(
          provider
        );
      } catch (error) {
        connectionStatus[provider] = false;
      }
    }

    return connectionStatus;
  }

  // Get available data sources
  getAvailableDataSources() {
    const activeSessions = brokerageAuthService.getActiveSessions();
    return {
      brokerage: activeSessions,
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
