import { create } from "zustand";
import { useAppDataStore } from "./appDataStore";
import {
  generateMarketOverviewWithData,
  type MarketOverview,
} from "../services/marketOverview";
import type { NewsItem } from "../services/newsProviders";

type Timeframe = "1D" | "1W" | "1M";

type SentimentSummary = {
  overall: "bullish" | "bearish" | "neutral";
  confidence: number;
};

type MarketOverviewStore = {
  overviewByTf: Partial<Record<Timeframe, MarketOverview>>;
  rawNews: NewsItem[];
  lastFetchedMs: number;
  isLoading: boolean;
  error: string | null;
  ensureOverview: (
    tf: Timeframe,
    options?: { force?: boolean; analysisDepth?: "brief" | "detailed" }
  ) => Promise<MarketOverview>;
  setOverview: (
    tf: Timeframe,
    overview: MarketOverview,
    rawNews?: NewsItem[]
  ) => void;
  clear: () => void;
  getSentimentSummary: () => SentimentSummary | null;
  getNewsSentimentCounts: () => {
    positive: number;
    negative: number;
    neutral: number;
  };
};

const TTL_MS = 120_000; // Keep in sync with marketDataCache

export const useMarketOverviewStore = create<MarketOverviewStore>(
  (set, get) => ({
    // Static properties - data comes from centralized store
    overviewByTf: {} as Partial<Record<Timeframe, MarketOverview>>,
    rawNews: [] as NewsItem[],
    lastFetchedMs: 0,
    isLoading: false,
    error: null,

    setOverview: (tf, overview, rawNews) => {
      // This is now handled by the centralized store
      // Just update local state for compatibility
      set((s) => ({
        lastFetchedMs: Date.now(),
        isLoading: false,
        error: null,
      }));
    },

    clear: () => {
      // Clear handled by centralized store
      set({ lastFetchedMs: 0, error: null });
    },

    ensureOverview: async (tf, options) => {
      const appStore = useAppDataStore.getState();
      const overview = appStore.getMarketOverview(tf);

      // Return immediately with cached data - no loading states!
      if (overview && !options?.force) {
        return overview;
      }

      // If forced refresh, trigger background refresh
      if (options?.force) {
        appStore.refreshInBackground();
      }

      // Always return available data immediately
      return (
        overview ||
        ({
          summary: "Market data loading from live sources...",
          keyHighlights: [
            "Fetching real-time market data",
            "AI analysis in progress",
          ],
          topStories: [],
          trendingStocks: [],
          upcomingEvents: [],
          fedEvents: [],
          economicIndicators: [],
          lastUpdated: new Date().toISOString(),
          marketSentiment: { overall: "neutral", confidence: 50, factors: [] },
        } as MarketOverview)
      );
    },

    getSentimentSummary: () => {
      const appStore = useAppDataStore.getState();
      return appStore.getSentimentSummary();
    },

    getNewsSentimentCounts: () => {
      const appStore = useAppDataStore.getState();
      return appStore.getNewsSentimentCounts();
    },
  })
);
