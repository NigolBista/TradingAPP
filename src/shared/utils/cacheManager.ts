/**
 * Advanced Cache Manager for Stock Data
 * Provides cache warming, invalidation, and memory management
 */

import { mutate } from 'swr';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry {
  key: string;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  memoryUsage: number;
}

class StockDataCacheManager {
  private cacheIndex = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 50 * 1024 * 1024; // 50MB max cache
  private readonly maxEntries = 1000;
  private readonly persistKeyPrefix = 'stock_cache_';

  private hits = 0;
  private misses = 0;

  /**
   * Warm cache for multiple symbols
   */
  async warmCache(symbols: string[], dataTypes: string[] = ['quote', 'news']): Promise<void> {
    console.log(`🔥 Warming cache for ${symbols.length} symbols`);

    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.flatMap(symbol =>
          dataTypes.map(type => this.warmSymbolData(symbol, type))
        )
      );

      // Rate limiting
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Cache warming completed`);
  }

  private async warmSymbolData(symbol: string, dataType: string): Promise<void> {
    const key = this.createCacheKey(symbol, dataType);

    try {
      // Check if already cached
      if (this.isCached(key)) {
        this.recordHit(key);
        return;
      }

      // Trigger SWR to fetch and cache
      await mutate(key);
      this.recordMiss(key);

      console.log(`📦 Cached ${dataType} for ${symbol}`);
    } catch (error) {
      console.warn(`⚠️ Failed to warm cache for ${symbol}:${dataType}`, error);
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidateSymbol(symbol: string): Promise<void> {
    const keys = Array.from(this.cacheIndex.keys())
      .filter(key => key.includes(`:${symbol}`));

    await Promise.all(
      keys.map(key => mutate(key, undefined, { revalidate: false }))
    );

    keys.forEach(key => this.cacheIndex.delete(key));

    console.log(`🗑️ Invalidated cache for ${symbol}`);
  }

  async invalidateDataType(dataType: string): Promise<void> {
    const keys = Array.from(this.cacheIndex.keys())
      .filter(key => key.startsWith(`${dataType}:`));

    await Promise.all(
      keys.map(key => mutate(key, undefined, { revalidate: false }))
    );

    keys.forEach(key => this.cacheIndex.delete(key));

    console.log(`🗑️ Invalidated all ${dataType} cache entries`);
  }

  async clearCache(): Promise<void> {
    // Clear SWR cache - only target stock-related keys
    await mutate(
      (key) => {
        if (typeof key !== 'string') return false;
        // Match stock-related cache keys
        return key.startsWith('quote:') ||
               key.startsWith('news:') ||
               key.startsWith('sentiment:') ||
               key.includes('/stocks/') ||
               key.includes('stock:');
      },
      undefined,
      { revalidate: false }
    );

    // Clear persistent cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.persistKeyPrefix));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear persistent cache:', error);
    }

    // Clear local index
    this.cacheIndex.clear();
    this.hits = 0;
    this.misses = 0;

    console.log(`🧹 Stock cache cleared`);
  }

  /**
   * Persist critical cache data to storage
   */
  async persistCache(symbols: string[]): Promise<void> {
    const criticalData = new Map<string, any>();

    for (const symbol of symbols) {
      const quoteKey = this.createCacheKey(symbol, 'quote');
      const newsKey = this.createCacheKey(symbol, 'news');

      // Store only the most recent data
      try {
        const quoteData = await this.getCacheData(quoteKey);
        const newsData = await this.getCacheData(newsKey);

        if (quoteData) {
          criticalData.set(`${this.persistKeyPrefix}${quoteKey}`, {
            data: quoteData,
            timestamp: Date.now(),
          });
        }

        if (newsData && Array.isArray(newsData) && newsData.length > 0) {
          // Store only recent news (last 5 items)
          criticalData.set(`${this.persistKeyPrefix}${newsKey}`, {
            data: newsData.slice(0, 5),
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.warn(`Failed to persist ${symbol}:`, error);
      }
    }

    // Save to AsyncStorage
    try {
      const entries = Array.from(criticalData.entries());
      await AsyncStorage.multiSet(
        entries.map(([key, value]) => [key, JSON.stringify(value)])
      );

      console.log(`💾 Persisted ${entries.length} cache entries`);
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  }

  /**
   * Restore cache from persistent storage
   */
  async restoreCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.persistKeyPrefix));

      if (cacheKeys.length === 0) {
        return;
      }

      const items = await AsyncStorage.multiGet(cacheKeys);
      let restoredCount = 0;

      for (const [key, value] of items) {
        if (!value) continue;

        try {
          const { data, timestamp } = JSON.parse(value);
          const cacheKey = key.replace(this.persistKeyPrefix, '');

          // Only restore if data is less than 1 hour old
          if (Date.now() - timestamp < 3600000) {
            await mutate(cacheKey, data, { revalidate: false });
            this.recordCacheEntry(cacheKey, JSON.stringify(data).length);
            restoredCount++;
          }
        } catch (error) {
          console.warn(`Failed to restore cache entry ${key}:`, error);
        }
      }

      console.log(`🔄 Restored ${restoredCount} cache entries`);
    } catch (error) {
      console.error('Failed to restore cache:', error);
    }
  }

  /**
   * Cleanup old cache entries to manage memory
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const entries = Array.from(this.cacheIndex.entries());

    // Sort by last accessed time (LRU)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let currentSize = entries.reduce((sum, [, entry]) => sum + entry.size, 0);
    let removedCount = 0;

    for (const [key, entry] of entries) {
      // Remove if too old or if we're over memory limit
      const shouldRemove =
        now - entry.timestamp > maxAge ||
        currentSize > this.maxCacheSize ||
        this.cacheIndex.size > this.maxEntries;

      if (shouldRemove) {
        await mutate(key, undefined, { revalidate: false });
        this.cacheIndex.delete(key);
        currentSize -= entry.size;
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cacheIndex.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      totalEntries: entries.length,
      totalSize,
      hitRate,
      memoryUsage: totalSize / this.maxCacheSize,
    };
  }

  /**
   * Prefetch data for upcoming screens
   */
  async prefetchForSymbols(symbols: string[]): Promise<void> {
    // Intelligent prefetching based on usage patterns
    const highPrioritySymbols = symbols.slice(0, 5); // Top 5 symbols
    const lowPrioritySymbols = symbols.slice(5);

    // Immediately fetch high priority
    await this.warmCache(highPrioritySymbols, ['quote', 'news']);

    // Defer low priority prefetching
    setTimeout(() => {
      this.warmCache(lowPrioritySymbols, ['quote']);
    }, 2000);
  }

  // Private helper methods
  private createCacheKey(symbol: string, dataType: string): string {
    switch (dataType) {
      case 'quote':
        return `quote:${symbol}`;
      case 'news':
        return `news:${symbol}:25`;
      case 'sentiment':
        return `sentiment:${symbol}:last30days`;
      default:
        return `${dataType}:${symbol}`;
    }
  }

  private isCached(key: string): boolean {
    return this.cacheIndex.has(key);
  }

  private recordHit(key: string): void {
    this.hits++;
    const entry = this.cacheIndex.get(key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }
  }

  private recordMiss(key: string): void {
    this.misses++;
  }

  private recordCacheEntry(key: string, size: number): void {
    const now = Date.now();
    this.cacheIndex.set(key, {
      key,
      timestamp: now,
      size,
      accessCount: 1,
      lastAccessed: now,
    });
  }

  private async getCacheData(key: string): Promise<any> {
    try {
      // This would typically integrate with SWR's cache
      // For now, we'll use a placeholder
      return null;
    } catch {
      return null;
    }
  }
}

// Global cache manager instance
export const stockDataCacheManager = new StockDataCacheManager();

// Module-scoped cleanup interval reference
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize cache manager - call during app startup
 */
export async function initializeCacheManager(): Promise<void> {
  try {
    // Restore cache from persistent storage
    await stockDataCacheManager.restoreCache();

    // Setup periodic cleanup if not already running
    if (cleanupIntervalId === null) {
      cleanupIntervalId = setInterval(() => {
        stockDataCacheManager.cleanup();
      }, 300000); // Every 5 minutes

      console.log('📦 Cache manager initialized with periodic cleanup');
    }
  } catch (error) {
    console.error('Failed to initialize cache manager:', error);
  }
}

/**
 * Shutdown cache manager - call during app teardown or in tests
 */
export async function shutdownCacheManager(): Promise<void> {
  try {
    // Clear the cleanup interval
    if (cleanupIntervalId !== null) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }

    // Perform final cleanup
    await stockDataCacheManager.cleanup();

    console.log('📦 Cache manager shutdown completed');
  } catch (error) {
    console.error('Error during cache manager shutdown:', error);
  }
}