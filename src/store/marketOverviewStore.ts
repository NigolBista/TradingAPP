import { create } from "zustand";
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
    overviewByTf: {},
    rawNews: [],
    lastFetchedMs: 0,
    isLoading: false,
    error: null,

    setOverview: (tf, overview, rawNews) =>
      set((s) => ({
        overviewByTf: { ...s.overviewByTf, [tf]: overview },
        rawNews: rawNews ?? s.rawNews,
        lastFetchedMs: Date.now(),
        isLoading: false,
        error: null,
      })),

    clear: () =>
      set({ overviewByTf: {}, rawNews: [], lastFetchedMs: 0, error: null }),

    ensureOverview: async (tf, options) => {
      const { overviewByTf, lastFetchedMs, isLoading } = get();
      const hasFresh = overviewByTf[tf] && Date.now() - lastFetchedMs < TTL_MS;
      if (!options?.force && hasFresh) {
        return overviewByTf[tf] as MarketOverview;
      }
      if (isLoading && overviewByTf[tf]) {
        return overviewByTf[tf] as MarketOverview;
      }
      set({ isLoading: true, error: null });
      try {
        const { overview, rawData } = await generateMarketOverviewWithData({
          analysisDepth: options?.analysisDepth ?? "brief",
          timeframe: tf,
        });
        get().setOverview(tf, overview, rawData.news);
        return overview;
      } catch (err: any) {
        set({
          isLoading: false,
          error: err?.message || "Failed to load market overview",
        });
        throw err;
      }
    },

    getSentimentSummary: () => {
      const state = get();
      const ov =
        state.overviewByTf["1D"] ||
        state.overviewByTf["1W"] ||
        state.overviewByTf["1M"];
      if (!ov) return null;
      if ((ov as any).marketSentiment) {
        const ms = (ov as any).marketSentiment as SentimentSummary;
        return ms || null;
      }
      const news = state.rawNews || [];
      let positive = 0;
      let negative = 0;
      let neutral = 0;
      for (const n of news) {
        const s = (n.sentiment || "").toLowerCase();
        if (s === "positive") positive++;
        else if (s === "negative") negative++;
        else neutral++;
      }
      const total = positive + negative + neutral;
      if (total === 0) return null;
      const pos = positive / total;
      const neg = negative / total;
      let overall: "bullish" | "bearish" | "neutral";
      let confidence: number;
      if (pos > 0.6) {
        overall = "bullish";
        confidence = Math.round(pos * 100);
      } else if (neg > 0.6) {
        overall = "bearish";
        confidence = Math.round(neg * 100);
      } else {
        overall = "neutral";
        confidence = Math.round(Math.max(pos, neg) * 100);
      }
      return { overall, confidence };
    },

    getNewsSentimentCounts: () => {
      const news = get().rawNews || [];
      let positive = 0;
      let negative = 0;
      let neutral = 0;
      for (const n of news) {
        const s = (n.sentiment || "").toLowerCase();
        if (s === "positive") positive++;
        else if (s === "negative") negative++;
        else neutral++;
      }
      return { positive, negative, neutral };
    },
  })
);
