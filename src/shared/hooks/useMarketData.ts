import { useState, useEffect, useCallback } from "react";
import {
  getAllCachedData,
  refreshGlobalCache,
  getCachedNews,
  getCachedTrendingStocks,
  getCachedMarketEvents,
} from "../services/marketDataCache";
import type {
  NewsItem,
  TrendingStock,
  MarketEvent,
} from "../services/newsProviders";

/**
 * Hook to access cached market data without making additional API calls
 * This should be used after MarketOverview component has loaded data
 */
export function useMarketData() {
  const [cachedData, setCachedData] = useState(() => getAllCachedData());
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Function to refresh cached data
  const refreshData = useCallback(
    async (
      newsCount: number = 30,
      includeTrending: boolean = true,
      includeEvents: boolean = true
    ) => {
      try {
        await refreshGlobalCache(newsCount, includeTrending, includeEvents);
        const newData = getAllCachedData();
        setCachedData(newData);
        setLastUpdate(Date.now());
        return newData;
      } catch (error) {
        console.error("Failed to refresh market data:", error);
        throw error;
      }
    },
    []
  );

  // Function to get fresh cached data
  const getCachedData = useCallback(() => {
    const data = getAllCachedData();
    setCachedData(data);
    setLastUpdate(Date.now());
    return data;
  }, []);

  // Auto-refresh cached data every 30 seconds if component is active
  useEffect(() => {
    const interval = setInterval(() => {
      const data = getAllCachedData();
      if (data.isValid) {
        setCachedData(data);
        setLastUpdate(Date.now());
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    // Cached data
    news: cachedData.news,
    trendingStocks: cachedData.trendingStocks,
    marketEvents: cachedData.marketEvents,
    isValid: cachedData.isValid,
    lastUpdate,

    // Functions
    refreshData,
    getCachedData,

    // Individual getters (for convenience)
    getCachedNews: getCachedNews,
    getCachedTrending: getCachedTrendingStocks,
    getCachedEvents: getCachedMarketEvents,
  };
}

/**
 * Hook specifically for news data with additional utilities
 */
export function useNewsData() {
  const { news, isValid, refreshData, getCachedData } = useMarketData();
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<{
    sentiment?: "Positive" | "Negative" | "Neutral";
    source?: string;
    limit?: number;
  }>({});

  // Apply filters to news data
  useEffect(() => {
    let filtered = [...news];

    if (filter.sentiment) {
      filtered = filtered.filter((item) => item.sentiment === filter.sentiment);
    }

    if (filter.source) {
      filtered = filtered.filter((item) =>
        item.source?.toLowerCase().includes(filter.source!.toLowerCase())
      );
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    setFilteredNews(filtered);
  }, [news, filter]);

  return {
    // Raw news data
    allNews: news,
    filteredNews,
    isValid,

    // Filter functions
    setFilter,
    clearFilter: () => setFilter({}),

    // Convenience filters
    getPositiveNews: () => news.filter((item) => item.sentiment === "Positive"),
    getNegativeNews: () => news.filter((item) => item.sentiment === "Negative"),
    getRecentNews: (hours: number = 24) => {
      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      return news.filter(
        (item) =>
          item.publishedAt && new Date(item.publishedAt).getTime() > cutoff
      );
    },

    // Data management
    refreshData,
    getCachedData,
  };
}
