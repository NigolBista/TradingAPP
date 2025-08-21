import { fetchCandlesForTimeframe } from "./marketProviders";
import type { Candle } from "./marketProviders";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Base candle data structure
export interface BaseCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Cache entry for a symbol
interface CandleCache {
  symbol: string;
  baseTimeframe: string; // The highest resolution we have (e.g., "1m", "5m")
  data: BaseCandle[];
  lastUpdate: number;
  lastCandle: number; // Timestamp of the most recent candle
}

// Derived timeframe mappings
const TIMEFRAME_HIERARCHY: Record<
  string,
  { minutes: number; priority: number }
> = {
  "1m": { minutes: 1, priority: 1 },
  "2m": { minutes: 2, priority: 2 },
  "3m": { minutes: 3, priority: 3 },
  "5m": { minutes: 5, priority: 4 },
  "15m": { minutes: 15, priority: 5 },
  "30m": { minutes: 30, priority: 6 },
  "1h": { minutes: 60, priority: 7 },
  "2h": { minutes: 120, priority: 8 },
  "4h": { minutes: 240, priority: 9 },
  "1D": { minutes: 1440, priority: 10 },
  "1W": { minutes: 10080, priority: 11 },
  "1M": { minutes: 43200, priority: 12 }, // Approximate
};

class SmartCandleManager {
  private cache = new Map<string, CandleCache>();
  private inflightRequests = new Map<string, Promise<BaseCandle[]>>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_INCREMENTAL_GAP = 24 * 60 * 60 * 1000; // 24 hours
  private readonly STORAGE_PREFIX = "candles_cache_";
  private readonly STORAGE_TTL = 60 * 60 * 1000; // 1 hour

  /** Ensure a symbol's cache is loaded from persistent storage */
  private async ensureCacheLoaded(symbol: string): Promise<void> {
    if (this.cache.has(symbol)) return;
    try {
      const raw = await AsyncStorage.getItem(this.STORAGE_PREFIX + symbol);
      if (!raw) return;
      const parsed: CandleCache = JSON.parse(raw);
      if (Date.now() - parsed.lastUpdate < this.STORAGE_TTL) {
        this.cache.set(symbol, parsed);
      } else {
        await AsyncStorage.removeItem(this.STORAGE_PREFIX + symbol);
      }
    } catch (error) {
      console.warn("⚠️ Failed to load candle cache", symbol, error);
    }
  }

  /** Persist a symbol's cache to AsyncStorage */
  private async saveToStorage(
    symbol: string,
    cache: CandleCache
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_PREFIX + symbol,
        JSON.stringify(cache)
      );
    } catch (error) {
      console.warn("⚠️ Failed to persist candle cache", symbol, error);
    }
  }

  /**
   * Get candles for any timeframe - uses smart derivation when possible
   */
  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<BaseCandle[]> {
    console.log(`📊 Getting candles for ${symbol} ${timeframe}`);

    // Normalize timeframe format (handle both "1h" and "1H" formats)
    const normalizedTimeframe = this.normalizeTimeframe(timeframe);
    console.log(
      `🔧 Normalized timeframe: ${timeframe} → ${normalizedTimeframe}`
    );

    // Load from persistent storage if available
    await this.ensureCacheLoaded(symbol);

    // Check if we can derive from cached data
    const derived = this.tryDeriveFromCache(symbol, normalizedTimeframe, limit);
    if (derived && derived.length > 0) {
      console.log(
        `✅ Derived ${symbol} ${normalizedTimeframe} from cache (${derived.length} candles)`
      );
      return derived;
    }

    console.log(
      `❌ Cannot derive ${symbol} ${normalizedTimeframe}, fetching fresh data`
    );
    // Need to fetch fresh data
    return this.fetchAndCache(symbol, normalizedTimeframe, limit);
  }

  /**
   * Normalize timeframe format to match our hierarchy
   */
  private normalizeTimeframe(timeframe: string): string {
    const tf = timeframe.toLowerCase();

    // Handle common variations
    const mappings: Record<string, string> = {
      "1h": "1h",
      "1hr": "1h",
      "1hour": "1h",
      "2h": "2h",
      "4h": "4h",
      "1d": "1D",
      "1day": "1D",
      "1w": "1W",
      "1week": "1W",
      "1m": "1m", // 1 minute
      "5m": "5m", // 5 minutes
      "15m": "15m", // 15 minutes
      "30m": "30m", // 30 minutes
      "1mo": "1M", // 1 month
      "1month": "1M",
    };

    // Direct mapping if available
    if (mappings[tf]) {
      return mappings[tf];
    }

    // Return original if no mapping found
    return timeframe;
  }

  /**
   * Pre-load a symbol with optimal base timeframe
   */
  async preloadSymbol(symbol: string): Promise<void> {
    console.log(`🚀 Pre-loading ${symbol}`);

    try {
      // Fetch high-resolution data that can derive multiple timeframes
      // Use 5m as base - good balance between resolution and data size
      const baseTimeframe = "5m";
      const limit = 2000; // ~7 days of 5m candles

      await this.fetchAndCache(symbol, baseTimeframe, limit);
      console.log(`✅ Pre-loaded ${symbol} with ${baseTimeframe} base data`);
    } catch (error) {
      console.error(`❌ Failed to pre-load ${symbol}:`, error);
    }
  }

  /**
   * Update a symbol with incremental data
   */
  async updateSymbol(symbol: string): Promise<void> {
    const cached = this.cache.get(symbol);
    if (!cached) {
      // No cache, do full preload
      return this.preloadSymbol(symbol);
    }

    const now = Date.now();
    const timeSinceUpdate = now - cached.lastUpdate;

    // If cache was updated very recently, skip to avoid redundant API calls
    // Previously this threshold was 5 minutes which prevented the chart from
    // receiving timely updates. Reduce to 5 seconds so the real-time refresh
    // interval in `realtimeDataManager` can fetch new candles on each cycle.
    if (timeSinceUpdate < 5 * 1000) {
      // 5 seconds
      return;
    }

    try {
      console.log(`🔄 Updating ${symbol} incrementally`);

      // Fetch only recent candles since last update
      const recentCandles = await this.fetchRecentCandles(symbol, cached);

      if (recentCandles.length > 0) {
        // Merge new candles with existing data
        this.mergeCandles(cached, recentCandles);
        await this.saveToStorage(symbol, cached);
        console.log(
          `✅ Updated ${symbol} with ${recentCandles.length} new candles`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to update ${symbol}:`, error);
      // Fallback to full reload if incremental update fails
      await this.preloadSymbol(symbol);
    }
  }

  /**
   * Try to derive timeframe from cached data
   */
  private tryDeriveFromCache(
    symbol: string,
    targetTimeframe: string,
    limit: number
  ): BaseCandle[] | null {
    const cached = this.cache.get(symbol);
    if (!cached) {
      console.log(`❌ No cache found for ${symbol}`);
      return null;
    }

    if (this.isCacheStale(cached)) {
      console.log(
        `❌ Cache stale for ${symbol} (age: ${
          Date.now() - cached.lastUpdate
        }ms)`
      );
      return null;
    }

    const baseMinutes = TIMEFRAME_HIERARCHY[cached.baseTimeframe]?.minutes;
    const targetMinutes = TIMEFRAME_HIERARCHY[targetTimeframe]?.minutes;

    console.log(
      `🔍 Derivation check: ${symbol} ${cached.baseTimeframe}(${baseMinutes}m) → ${targetTimeframe}(${targetMinutes}m)`
    );

    if (!baseMinutes || !targetMinutes) {
      console.log(
        `❌ Unknown timeframe: base=${cached.baseTimeframe}, target=${targetTimeframe}`
      );
      return null;
    }

    // Can only derive higher timeframes from lower ones
    if (targetMinutes < baseMinutes) {
      console.log(
        `❌ Cannot derive lower timeframe: ${targetMinutes}m < ${baseMinutes}m`
      );
      return null;
    }

    // If same timeframe, return cached data
    if (targetMinutes === baseMinutes) {
      console.log(
        `✅ Same timeframe, returning ${cached.data.length} cached candles`
      );
      return cached.data.slice(-limit);
    }

    // Derive higher timeframe from base data
    console.log(
      `🔄 Deriving ${targetTimeframe} from ${cached.baseTimeframe} (${cached.data.length} base candles)`
    );
    return this.deriveTimeframe(cached.data, baseMinutes, targetMinutes, limit);
  }

  /**
   * Derive higher timeframe candles from base data
   */
  private deriveTimeframe(
    baseData: BaseCandle[],
    baseMinutes: number,
    targetMinutes: number,
    limit: number
  ): BaseCandle[] {
    if (baseData.length === 0) return [];

    const ratio = Math.floor(targetMinutes / baseMinutes);
    if (ratio <= 1) return baseData.slice(-limit); // Same or smaller timeframe

    const derived: BaseCandle[] = [];

    console.log(
      `🔄 Deriving ${targetMinutes}m from ${baseMinutes}m data (ratio: ${ratio}, base candles: ${baseData.length})`
    );

    // Group base candles into target timeframe buckets
    for (let i = 0; i < baseData.length; i += ratio) {
      const group = baseData.slice(i, i + ratio);
      if (group.length === 0) continue;

      // Only create derived candle if we have a complete group (or it's the last group)
      if (group.length === ratio || i + ratio >= baseData.length) {
        const derivedCandle: BaseCandle = {
          time: group[0].time,
          open: group[0].open,
          high: Math.max(...group.map((c) => c.high)),
          low: Math.min(...group.map((c) => c.low)),
          close: group[group.length - 1].close,
          volume: group.reduce((sum, c) => sum + c.volume, 0),
        };

        derived.push(derivedCandle);
      }
    }

    console.log(
      `✅ Derived ${derived.length} candles for ${targetMinutes}m timeframe`
    );
    return derived.slice(-limit);
  }

  /**
   * Fetch and cache candles
   */
  private async fetchAndCache(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<BaseCandle[]> {
    const cacheKey = `${symbol}:${timeframe}`;

    // Check if request is already in flight
    const existing = this.inflightRequests.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = this.doFetch(symbol, timeframe, limit);
    this.inflightRequests.set(cacheKey, promise);

    try {
      const candles = await promise;
      // Update cache and persist
      const cacheEntry: CandleCache = {
        symbol,
        baseTimeframe: timeframe,
        data: candles,
        lastUpdate: Date.now(),
        lastCandle: candles.length > 0 ? candles[candles.length - 1].time : 0,
      };
      this.cache.set(symbol, cacheEntry);
      await this.saveToStorage(symbol, cacheEntry);

      return candles;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  /**
   * Fetch recent candles for incremental update
   */
  private async fetchRecentCandles(
    symbol: string,
    cached: CandleCache
  ): Promise<BaseCandle[]> {
    const now = Date.now();
    // cached.lastCandle is stored in epoch milliseconds, do not multiply
    const timeSinceLastCandle = now - cached.lastCandle;

    // If gap is too large, do full reload
    if (timeSinceLastCandle > this.MAX_INCREMENTAL_GAP) {
      const fresh = await this.doFetch(symbol, cached.baseTimeframe, 2000);
      return fresh;
    }

    // Fetch only recent candles (small limit for efficiency)
    const baseMinutes = TIMEFRAME_HIERARCHY[cached.baseTimeframe]?.minutes || 1;
    const perBarMs = baseMinutes * 60 * 1000;
    const recentBarsNeeded = Math.max(
      1,
      Math.ceil(timeSinceLastCandle / perBarMs) + 1
    );
    const recentLimit = Math.min(100, recentBarsNeeded);
    return this.doFetch(symbol, cached.baseTimeframe, recentLimit);
  }

  /**
   * Merge new candles with existing cache
   */
  private mergeCandles(cached: CandleCache, newCandles: BaseCandle[]): void {
    if (newCandles.length === 0) return;

    // Find overlap point
    const lastCachedTime =
      cached.data.length > 0 ? cached.data[cached.data.length - 1].time : 0;
    // If provider returned an updated last candle with the same timestamp,
    // replace the cached last candle in-place to keep price up to date
    if (cached.data.length > 0) {
      const updatedIdx = newCandles.findIndex((c) => c.time === lastCachedTime);
      if (updatedIdx >= 0) {
        cached.data[cached.data.length - 1] = newCandles[updatedIdx];
      }
    }
    const newCandlesFiltered = newCandles.filter(
      (c) => c.time > lastCachedTime
    );

    // Append new candles
    cached.data.push(...newCandlesFiltered);

    // Keep cache size reasonable (last 2000 candles)
    if (cached.data.length > 2000) {
      cached.data = cached.data.slice(-2000);
    }

    // Update metadata
    cached.lastUpdate = Date.now();
    if (newCandlesFiltered.length > 0) {
      cached.lastCandle =
        newCandlesFiltered[newCandlesFiltered.length - 1].time;
    }
  }

  /**
   * Actual API fetch
   */
  private async doFetch(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<BaseCandle[]> {
    console.log(`📡 Fetching ${symbol} ${timeframe} (limit: ${limit})`);

    // Respect the requested output bar count to avoid large payloads
    const outBars = Math.max(1, Math.min(1200, Math.floor(limit || 1)));
    const candles = await fetchCandlesForTimeframe(symbol, timeframe as any, {
      outBars,
      baseCushion: 1.05,
    });

    return candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
    }));
  }

  /**
   * Check if cache is stale
   */
  private isCacheStale(cached: CandleCache): boolean {
    const now = Date.now();
    return now - cached.lastUpdate > this.CACHE_TTL;
  }

  /**
   * Get optimal base timeframe for a symbol based on usage patterns
   */
  private getOptimalBaseTimeframe(symbol: string): string {
    // For now, use 5m as default
    // Could be made smarter based on user preferences, market hours, etc.
    return "5m";
  }

  /**
   * Cleanup stale cache entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [symbol, cached] of this.cache.entries()) {
      if (this.isCacheStale(cached)) {
        this.cache.delete(symbol);
        await AsyncStorage.removeItem(this.STORAGE_PREFIX + symbol);
        console.log(`🧹 Cleaned up stale cache for ${symbol}`);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { symbols: number; totalCandles: number; memoryUsage: string } {
    let totalCandles = 0;
    for (const cached of this.cache.values()) {
      totalCandles += cached.data.length;
    }

    const memoryUsage = `${Math.round((totalCandles * 48) / 1024)} KB`; // Rough estimate

    return {
      symbols: this.cache.size,
      totalCandles,
      memoryUsage,
    };
  }
}

// Export singleton
export const smartCandleManager = new SmartCandleManager();

// Cleanup every 10 minutes
setInterval(() => {
  void smartCandleManager.cleanup();
}, 10 * 60 * 1000);

export default smartCandleManager;
