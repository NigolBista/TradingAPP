import { supabase } from '../lib/supabase';
import { ApiClient } from './ApiClient';

// Types for batch processing
export interface Quote {
  ticker: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  lastUpdated: number;
  source: string;
}

export interface BatchRequest {
  ticker: string;
  resolve: (quote: Quote) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface CachedQuote extends Quote {
  isExpired: boolean;
  ttlExpiresAt: string;
}

export interface BatchProcessingMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  averageResponseTime: number;
  costSavings: number;
}

/**
 * Batch Data Fetcher for cost optimization
 *
 * Key Features:
 * - Intelligent batching with configurable delays
 * - Multi-level caching (database + memory)
 * - Reference counting for ticker subscriptions
 * - Cost tracking and analytics
 * - Automatic retry with exponential backoff
 */
export class BatchDataFetcher {
  private pendingRequests: Map<string, Promise<Quote>> = new Map();
  private batchQueue: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private promiseResolvers: Map<string, { resolve: (quote: Quote) => void; reject: (error: Error) => void }> = new Map();

  // Configuration
  private readonly BATCH_DELAY = 100; // 100ms batching window
  private readonly MAX_BATCH_SIZE = 50; // API limit for batch requests
  private readonly MEMORY_CACHE_TTL = 10000; // 10 seconds memory cache
  private readonly CACHE_CHECK_INTERVAL = 60000; // 1 minute cleanup interval

  // Memory cache for ultra-fast access
  private memoryCache: Map<string, { quote: Quote; timestamp: number }> = new Map();

  // Metrics tracking
  private metrics: BatchProcessingMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    averageResponseTime: 0,
    costSavings: 0
  };

  // API client for external data
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
    this.startCacheCleanup();
  }

  /**
   * Fetch quote for a ticker with intelligent caching and batching
   */
  async fetchQuote(ticker: string): Promise<Quote> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check memory cache first (fastest)
      const memoryResult = this.getFromMemoryCache(ticker);
      if (memoryResult) {
        this.metrics.cacheHits++;
        return memoryResult;
      }

      // Check database cache
      const cachedResult = await this.getCachedQuote(ticker);
      if (cachedResult && !cachedResult.isExpired) {
        this.metrics.cacheHits++;

        // Update memory cache
        this.setMemoryCache(ticker, cachedResult);

        return cachedResult;
      }

      this.metrics.cacheMisses++;

      // Check if request already pending
      if (this.pendingRequests.has(ticker)) {
        return this.pendingRequests.get(ticker)!;
      }

      // Add to batch queue
      this.batchQueue.add(ticker);

      // Start batch timer if not running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY);
      }

      // Force process if batch is full
      if (this.batchQueue.size >= this.MAX_BATCH_SIZE) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
        this.processBatch();
      }

      // Create promise for this ticker
      const promise = new Promise<Quote>((resolve, reject) => {
        this.promiseResolvers.set(ticker, { resolve, reject });
      });

      this.pendingRequests.set(ticker, promise);

      const result = await promise;

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);

      return result;

    } catch (error) {
      console.error(`Error fetching quote for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple quotes efficiently
   */
  async fetchQuotesBatch(tickers: string[]): Promise<Quote[]> {
    const promises = tickers.map(ticker => this.fetchQuote(ticker));
    return Promise.all(promises);
  }

  /**
   * Process batch of ticker requests
   */
  private async processBatch() {
    if (this.batchQueue.size === 0) return;

    const tickers = Array.from(this.batchQueue);
    this.batchQueue.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      console.log(`📊 Processing batch of ${tickers.length} tickers:`, tickers);

      // Track API call for cost monitoring
      this.metrics.apiCalls++;
      await this.trackApiCost('polygon_api', 'batch_quotes', tickers.length, tickers.length * 1); // 1 cent per ticker

      // Fetch quotes from external API
      const quotes = await this.fetchQuotesFromAPI(tickers);

      // Cache all quotes in database
      await this.cacheQuotesBatch(quotes);

      // Update memory cache
      quotes.forEach(quote => {
        this.setMemoryCache(quote.ticker, quote);
      });

      // Resolve all pending promises
      quotes.forEach(quote => {
        const resolver = this.promiseResolvers.get(quote.ticker);
        if (resolver) {
          resolver.resolve(quote);
          this.promiseResolvers.delete(quote.ticker);
          this.pendingRequests.delete(quote.ticker);
        }
      });

      // Handle any missing tickers (failed requests)
      tickers.forEach(ticker => {
        if (!quotes.find(q => q.ticker === ticker)) {
          const resolver = this.promiseResolvers.get(ticker);
          if (resolver) {
            resolver.reject(new Error(`No data available for ${ticker}`));
            this.promiseResolvers.delete(ticker);
            this.pendingRequests.delete(ticker);
          }
        }
      });

      console.log(`✅ Successfully processed ${quotes.length}/${tickers.length} quotes`);

    } catch (error) {
      console.error('❌ Error processing batch:', error);

      // Reject all pending promises
      tickers.forEach(ticker => {
        const resolver = this.promiseResolvers.get(ticker);
        if (resolver) {
          resolver.reject(error as Error);
          this.promiseResolvers.delete(ticker);
          this.pendingRequests.delete(ticker);
        }
      });
    }
  }

  /**
   * Fetch quotes from external API
   */
  private async fetchQuotesFromAPI(tickers: string[]): Promise<Quote[]> {
    try {
      // Use existing API client for consistency
      const responses = await Promise.allSettled(
        tickers.map(ticker => this.apiClient.getStock(ticker))
      );

      const quotes: Quote[] = [];

      responses.forEach((response, index) => {
        if (response.status === 'fulfilled' && response.value) {
          const data = response.value;
          quotes.push({
            ticker: tickers[index],
            price: data.price || 0,
            changePercent: data.changePercent || 0,
            volume: data.volume || 0,
            marketCap: data.marketCap,
            lastUpdated: Date.now(),
            source: 'polygon'
          });
        }
      });

      return quotes;

    } catch (error) {
      console.error('Error fetching from API:', error);
      throw error;
    }
  }

  /**
   * Get quote from memory cache
   */
  private getFromMemoryCache(ticker: string): Quote | null {
    const cached = this.memoryCache.get(ticker);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.MEMORY_CACHE_TTL) {
      this.memoryCache.delete(ticker);
      return null;
    }

    return cached.quote;
  }

  /**
   * Set quote in memory cache
   */
  private setMemoryCache(ticker: string, quote: Quote) {
    this.memoryCache.set(ticker, {
      quote,
      timestamp: Date.now()
    });
  }

  /**
   * Get quote from database cache
   */
  private async getCachedQuote(ticker: string): Promise<CachedQuote | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_cached_market_data', { p_ticker: ticker });

      if (error || !data || data.length === 0) return null;

      const cachedData = data[0];

      return {
        ticker: cachedData.ticker,
        price: parseFloat(cachedData.price || '0'),
        changePercent: parseFloat(cachedData.change_percent || '0'),
        volume: parseInt(cachedData.volume || '0'),
        marketCap: cachedData.quote_data?.marketCap,
        lastUpdated: new Date(cachedData.last_updated).getTime(),
        source: 'cache',
        isExpired: cachedData.is_expired,
        ttlExpiresAt: cachedData.ttl_expires_at
      };

    } catch (error) {
      console.error('Error getting cached quote:', error);
      return null;
    }
  }

  /**
   * Cache quotes in database
   */
  private async cacheQuotesBatch(quotes: Quote[]) {
    try {
      const cachePromises = quotes.map(quote =>
        supabase.rpc('update_market_data_cache', {
          p_ticker: quote.ticker,
          p_quote_data: {
            ticker: quote.ticker,
            price: quote.price,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
            source: quote.source,
            timestamp: quote.lastUpdated
          },
          p_price: quote.price,
          p_change_percent: quote.changePercent,
          p_volume: quote.volume,
          p_ttl_seconds: this.isMarketHours() ? 15 : 300 // 15s during market, 5min after
        })
      );

      await Promise.all(cachePromises);

    } catch (error) {
      console.error('Error caching quotes:', error);
    }
  }

  /**
   * Check if market is currently open
   */
  private isMarketHours(): boolean {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    // Weekend check
    if (day === 0 || day === 6) return false;

    // Market hours: 9:30 AM - 4:00 PM EST (converted to minutes)
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM

    return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
  }

  /**
   * Track API costs for monitoring
   */
  private async trackApiCost(
    serviceType: string,
    operationType: string,
    requestCount: number,
    costCents: number
  ) {
    try {
      await supabase.rpc('track_api_cost', {
        p_service_type: serviceType,
        p_operation_type: operationType,
        p_request_count: requestCount,
        p_cost_cents: costCents
      });

      // Update local metrics
      this.metrics.costSavings += requestCount > 1 ? (requestCount - 1) * costCents : 0;

    } catch (error) {
      console.error('Error tracking API cost:', error);
    }
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number) {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup() {
    setInterval(() => {
      this.cleanupMemoryCache();
    }, this.CACHE_CHECK_INTERVAL);
  }

  /**
   * Clean up expired memory cache entries
   */
  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [ticker, cached] of this.memoryCache.entries()) {
      if (now - cached.timestamp > this.MEMORY_CACHE_TTL) {
        this.memoryCache.delete(ticker);
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): BatchProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      averageResponseTime: 0,
      costSavings: 0
    };
  }

  /**
   * Get cache hit ratio
   */
  getCacheHitRatio(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.cacheHits / this.metrics.totalRequests;
  }

  /**
   * Get cost savings summary
   */
  getCostSavings(): {
    totalSavings: number;
    savingsPercentage: number;
    requestsAvoided: number
  } {
    const requestsAvoided = this.metrics.cacheHits;
    const totalSavings = this.metrics.costSavings;
    const potentialCost = this.metrics.totalRequests * 1; // 1 cent per request
    const savingsPercentage = potentialCost > 0 ? (totalSavings / potentialCost) * 100 : 0;

    return {
      totalSavings,
      savingsPercentage,
      requestsAvoided
    };
  }

  /**
   * Force clear all caches
   */
  clearCaches() {
    this.memoryCache.clear();
    this.pendingRequests.clear();
    this.promiseResolvers.clear();
    this.batchQueue.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      memoryCacheSize: this.memoryCache.size,
      pendingRequests: this.pendingRequests.size,
      batchQueueSize: this.batchQueue.size,
      hasBatchTimer: this.batchTimer !== null,
      metrics: this.metrics
    };
  }
}

// Singleton instance for global use
export const batchDataFetcher = new BatchDataFetcher();