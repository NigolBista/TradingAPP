/**
 * Optimized Stock Data Hook with SWR Caching
 * Provides efficient caching and revalidation for stock news and sentiment data
 */

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import {
  fetchNews as fetchSymbolNews,
  fetchStockNewsApi,
  fetchSentimentStats,
  type NewsItem,
  type SentimentStats,
} from "../../../shared/services/newsProviders";
import { fetchSingleQuote, type SimpleQuote } from "../../../shared/services/quotes";

interface CacheConfig {
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  dedupingInterval?: number;
}

interface StockDataHookOptions {
  initialQuote?: SimpleQuote;
  enableAutoRefresh?: boolean;
  cache?: CacheConfig;
}

// Default cache configurations for different data types
const DEFAULT_CACHE_CONFIG = {
  quote: {
    refreshInterval: 5000, // 5 seconds for quotes
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000, // 1 second deduping
  },
  news: {
    refreshInterval: 300000, // 5 minutes for news
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30 seconds deduping
  },
  sentiment: {
    refreshInterval: 600000, // 10 minutes for sentiment
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute deduping
  },
} as const;

// Fetcher functions with proper error handling
const quoteFetcher = async (key: string): Promise<SimpleQuote | null> => {
  const symbol = key.split(':')[1];
  try {
    return await fetchSingleQuote(symbol);
  } catch (error) {
    console.warn(`Quote fetch failed for ${symbol}:`, error);
    return null;
  }
};

const newsFetcher = async (key: string): Promise<NewsItem[]> => {
  const [, symbol, limitStr] = key.split(':');
  const limit = parseInt(limitStr, 10) || 25;

  try {
    // Try primary news source first
    return await fetchStockNewsApi(symbol, limit);
  } catch (error) {
    try {
      // Fallback to secondary source
      return await fetchSymbolNews(symbol);
    } catch (fallbackError) {
      console.warn(`News fetch failed for ${symbol}:`, fallbackError);
      return [];
    }
  }
};

const sentimentFetcher = async (key: string): Promise<SentimentStats | null> => {
  const [, symbol, period] = key.split(':');
  try {
    return await fetchSentimentStats(symbol, period as any);
  } catch (error) {
    console.warn(`Sentiment fetch failed for ${symbol}:`, error);
    return null;
  }
};

export function useOptimizedStockData(
  symbol: string,
  options: StockDataHookOptions = {}
) {
  const {
    initialQuote,
    enableAutoRefresh = true,
    cache = {},
  } = options;

  // Merge cache configurations
  const quoteConfig = { ...DEFAULT_CACHE_CONFIG.quote, ...cache };
  const newsConfig = { ...DEFAULT_CACHE_CONFIG.news, ...cache };
  const sentimentConfig = { ...DEFAULT_CACHE_CONFIG.sentiment, ...cache };

  // Disable auto-refresh if not enabled
  const refreshInterval = enableAutoRefresh ? undefined : 0;

  // SWR hooks for different data types
  const {
    data: quote,
    error: quoteError,
    isLoading: quoteLoading,
    mutate: mutateQuote,
  } = useSWR(
    symbol ? `quote:${symbol}` : null,
    quoteFetcher,
    {
      fallbackData: initialQuote,
      refreshInterval: refreshInterval ?? quoteConfig.refreshInterval,
      revalidateOnFocus: quoteConfig.revalidateOnFocus,
      revalidateOnReconnect: quoteConfig.revalidateOnReconnect,
      dedupingInterval: quoteConfig.dedupingInterval,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      onError: (error) => {
        console.warn(`Quote SWR error for ${symbol}:`, error);
      },
    }
  );

  const {
    data: news = [],
    error: newsError,
    isLoading: newsLoading,
    mutate: mutateNews,
  } = useSWR(
    symbol ? `news:${symbol}:25` : null,
    newsFetcher,
    {
      refreshInterval: refreshInterval ?? newsConfig.refreshInterval,
      revalidateOnFocus: newsConfig.revalidateOnFocus,
      revalidateOnReconnect: newsConfig.revalidateOnReconnect,
      dedupingInterval: newsConfig.dedupingInterval,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      onError: (error) => {
        console.warn(`News SWR error for ${symbol}:`, error);
      },
    }
  );

  const {
    data: sentimentStats,
    error: sentimentError,
    isLoading: sentimentLoading,
    mutate: mutateSentiment,
  } = useSWR(
    symbol ? `sentiment:${symbol}:last30days` : null,
    sentimentFetcher,
    {
      refreshInterval: refreshInterval ?? sentimentConfig.refreshInterval,
      revalidateOnFocus: sentimentConfig.revalidateOnFocus,
      revalidateOnReconnect: sentimentConfig.revalidateOnReconnect,
      dedupingInterval: sentimentConfig.dedupingInterval,
      errorRetryCount: 2,
      errorRetryInterval: 10000,
      onError: (error) => {
        console.warn(`Sentiment SWR error for ${symbol}:`, error);
      },
    }
  );

  // Derived sentiment counts
  const sentimentCounts = useMemo(() => {
    if (!sentimentStats) return null;

    return {
      positive: sentimentStats.totalPositive || 0,
      negative: sentimentStats.totalNegative || 0,
      neutral: sentimentStats.totalNeutral || 0,
    };
  }, [sentimentStats]);

  // Manual refresh functions
  const refreshQuote = useCallback(async () => {
    try {
      return await mutateQuote();
    } catch (error) {
      console.error(`Failed to refresh quote for ${symbol}:`, error);
      return null;
    }
  }, [mutateQuote, symbol]);

  const refreshNews = useCallback(async () => {
    try {
      return await mutateNews();
    } catch (error) {
      console.error(`Failed to refresh news for ${symbol}:`, error);
      return [];
    }
  }, [mutateNews, symbol]);

  const refreshSentiment = useCallback(async () => {
    try {
      return await mutateSentiment();
    } catch (error) {
      console.error(`Failed to refresh sentiment for ${symbol}:`, error);
      return null;
    }
  }, [mutateSentiment, symbol]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      refreshQuote(),
      refreshNews(),
      refreshSentiment(),
    ]);
  }, [refreshQuote, refreshNews, refreshSentiment]);

  // Cache status information
  const cacheStatus = useMemo(() => {
    const now = Date.now();

    return {
      quote: {
        cached: !!quote,
        error: !!quoteError,
        loading: quoteLoading,
        lastUpdate: quote ? now : null,
      },
      news: {
        cached: news.length > 0,
        error: !!newsError,
        loading: newsLoading,
        lastUpdate: news.length > 0 ? now : null,
        count: news.length,
      },
      sentiment: {
        cached: !!sentimentStats,
        error: !!sentimentError,
        loading: sentimentLoading,
        lastUpdate: sentimentStats ? now : null,
      },
    };
  }, [
    quote, quoteError, quoteLoading,
    news, newsError, newsLoading,
    sentimentStats, sentimentError, sentimentLoading
  ]);

  return {
    // Data
    quote,
    news,
    sentimentStats,
    sentimentCounts,

    // Loading states
    quoteLoading,
    newsLoading,
    sentimentLoading,
    isLoading: quoteLoading || newsLoading || sentimentLoading,

    // Error states
    quoteError,
    newsError,
    sentimentError,
    hasError: !!quoteError || !!newsError || !!sentimentError,

    // Refresh functions
    refreshQuote,
    refreshNews,
    refreshSentiment,
    refreshAll,

    // Cache information
    cacheStatus,

    // SWR utilities
    mutateQuote,
    mutateNews,
    mutateSentiment,
  };
}

/**
 * Hook for preloading stock data
 * Useful for warming cache before navigation
 */
export function usePreloadStockData(symbols: string[]) {
  const preloadSymbol = useCallback(async (symbol: string) => {
    try {
      // Preload quote
      await quoteFetcher(`quote:${symbol}`);

      // Preload news (smaller dataset)
      await newsFetcher(`news:${symbol}:10`);

      console.log(`✅ Preloaded data for ${symbol}`);
    } catch (error) {
      console.warn(`⚠️ Failed to preload ${symbol}:`, error);
    }
  }, []);

  const preloadAll = useCallback(async () => {
    const batchSize = 5; // Process 5 symbols at a time

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(symbol => preloadSymbol(symbol))
      );

      // Small delay between batches to avoid overwhelming APIs
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ Preloading completed for ${symbols.length} symbols`);
  }, [symbols, preloadSymbol]);

  return {
    preloadSymbol,
    preloadAll,
  };
}