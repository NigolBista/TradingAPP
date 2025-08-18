import {
  fetchGeneralMarketNews,
  fetchTrendingStocks,
  fetchMarketEvents,
  type NewsItem,
  type TrendingStock,
  type MarketEvent,
} from "./newsProviders";

// Global cache interface
interface GlobalMarketCache {
  news: NewsItem[];
  trendingStocks: TrendingStock[];
  marketEvents: MarketEvent[];
  timestamp: number;
  isLoading: boolean;
}

// Cache configuration
const CACHE_TTL_MS = 120_000; // 2 minutes
const CACHE_KEY = "global_market_cache";

// Global cache instance
let globalCache: GlobalMarketCache | null = null;
let cachePromise: Promise<GlobalMarketCache> | null = null;

/**
 * Checks if the global cache is valid
 */
export function isCacheValid(): boolean {
  return (
    globalCache !== null &&
    !globalCache.isLoading &&
    Date.now() - globalCache.timestamp < CACHE_TTL_MS
  );
}

/**
 * Gets the current cache data (may be stale)
 */
export function getCurrentCache(): GlobalMarketCache | null {
  return globalCache;
}

/**
 * Fetches fresh market data and updates the global cache
 */
async function fetchAndUpdateCache(
  newsCount: number = 30,
  includeTrending: boolean = true,
  includeEvents: boolean = true
): Promise<GlobalMarketCache> {
  console.log("🔄 Fetching fresh market data for global cache...");

  // Set loading state
  if (globalCache) {
    globalCache.isLoading = true;
  } else {
    globalCache = {
      news: [],
      trendingStocks: [],
      marketEvents: [],
      timestamp: 0,
      isLoading: true,
    };
  }

  try {
    // Fetch all data in parallel
    const [news, trendingStocks, marketEvents] = await Promise.all([
      fetchGeneralMarketNews(newsCount),
      includeTrending
        ? fetchTrendingStocks(7).catch(() => [])
        : Promise.resolve([]),
      includeEvents ? fetchMarketEvents().catch(() => []) : Promise.resolve([]),
    ]);

    // Update global cache
    globalCache = {
      news,
      trendingStocks,
      marketEvents,
      timestamp: Date.now(),
      isLoading: false,
    };

    console.log("✅ Global market cache updated:", {
      newsCount: news.length,
      trendingCount: trendingStocks.length,
      eventsCount: marketEvents.length,
    });

    return globalCache;
  } catch (error) {
    console.error("❌ Failed to update global cache:", error);

    // Reset loading state but keep old data if available
    if (globalCache) {
      globalCache.isLoading = false;
    }

    throw error;
  }
}

/**
 * Gets market data from cache or fetches fresh data
 * This is the main function all components should use
 */
export async function getGlobalMarketData(
  newsCount: number = 30,
  includeTrending: boolean = true,
  includeEvents: boolean = true,
  forceRefresh: boolean = false
): Promise<GlobalMarketCache> {
  // If we have valid cache and not forcing refresh, return it
  if (!forceRefresh && isCacheValid()) {
    console.log("📦 Using valid global cache", {
      newsCount: globalCache!.news.length,
      age: Math.round((Date.now() - globalCache!.timestamp) / 1000) + "s",
    });
    return globalCache!;
  }

  // If there's already a fetch in progress, wait for it
  if (cachePromise) {
    console.log("⏳ Waiting for ongoing cache update...");
    return cachePromise;
  }

  // Start new fetch
  cachePromise = fetchAndUpdateCache(newsCount, includeTrending, includeEvents);

  try {
    const result = await cachePromise;
    return result;
  } finally {
    // Clear the promise so future calls can start new fetches
    cachePromise = null;
  }
}

/**
 * Forces a refresh of the global cache
 */
export async function refreshGlobalCache(
  newsCount: number = 30,
  includeTrending: boolean = true,
  includeEvents: boolean = true
): Promise<GlobalMarketCache> {
  console.log("🔄 Force refreshing global cache...");
  return getGlobalMarketData(newsCount, includeTrending, includeEvents, true);
}

/**
 * Gets cached news data without making API calls
 */
export function getCachedNews(): NewsItem[] {
  return globalCache?.news || [];
}

/**
 * Gets cached trending stocks without making API calls
 */
export function getCachedTrendingStocks(): TrendingStock[] {
  return globalCache?.trendingStocks || [];
}

/**
 * Gets cached market events without making API calls
 */
export function getCachedMarketEvents(): MarketEvent[] {
  return globalCache?.marketEvents || [];
}

/**
 * Gets all cached data in one call
 */
export function getAllCachedData(): {
  news: NewsItem[];
  trendingStocks: TrendingStock[];
  marketEvents: MarketEvent[];
  isValid: boolean;
  isLoading: boolean;
  lastUpdate: number;
} {
  const cache = globalCache;
  return {
    news: cache?.news || [],
    trendingStocks: cache?.trendingStocks || [],
    marketEvents: cache?.marketEvents || [],
    isValid: isCacheValid(),
    isLoading: cache?.isLoading || false,
    lastUpdate: cache?.timestamp || 0,
  };
}

/**
 * Clears the global cache (useful for testing or logout)
 */
export function clearGlobalCache(): void {
  console.log("🗑️ Clearing global market cache");
  globalCache = null;
  cachePromise = null;
}
