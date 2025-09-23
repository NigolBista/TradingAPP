import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import OpenAI from "openai";
import { useTheme } from "../providers/ThemeProvider";
import {
  getGlobalMarketData,
  refreshGlobalCache,
} from "../services/marketDataCache";
import type {
  NewsItem,
  TrendingStock,
  MarketEvent,
} from "../services/newsProviders";
import type { FedEvent, EconomicIndicator } from "../services/federalReserve";
import { useUserStore } from "../store/userStore";
import { fetchNewsWithDateFilter } from "../services/newsProviders";
import { apiEngine } from "../services/apiEngine";

type TimeframeKey = "today" | "week" | "month";

interface FocusBuckets {
  news: Record<TimeframeKey, NewsItem[]>;
  fedEvents: Record<TimeframeKey, FedEvent[]>;
  marketEvents: Record<TimeframeKey, MarketEvent[]>;
  watchlistNews: Record<TimeframeKey, NewsItem[]>;
}

interface WatchlistInsight {
  symbol: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  newsCount: number;
  latestHeadline?: string;
}

interface WatchlistDigestEntry {
  id: string;
  symbol: string;
  headline: string;
  sentiment?: string;
  publishedAt?: string;
  source?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1C",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 6,
  },
  eventsContainer: {
    marginTop: 6,
    gap: 8,
  },
  eventsCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  eventsHeaderText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  eventLineText: {
    color: "#B6C0CA",
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  summaryHeaderText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  summaryText: {
    color: "#B6C0CA",
    fontSize: 13,
    lineHeight: 18,
  },
  metricsCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
  },
  metricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metricsHeaderText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricItem: {
    backgroundColor: "#1F2937",
    borderRadius: 6,
    padding: 8,
    minWidth: 100,
    flex: 1,
  },
  metricLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 2,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  metricChange: {
    fontSize: 11,
    fontWeight: "500",
  },
  metricPositive: {
    color: "#10B981",
  },
  metricNegative: {
    color: "#EF4444",
  },
  watchlistCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
  },
  watchlistHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  watchlistHeaderText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  watchlistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  watchlistItem: {
    backgroundColor: "#1F2937",
    borderRadius: 6,
    padding: 8,
    minWidth: 100,
    flex: 1,
  },
  watchlistSymbol: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  watchlistNews: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 2,
  },
  watchlistSentiment: {
    fontSize: 11,
    fontWeight: "500",
  },
  digestCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
  },
  digestLine: {
    marginBottom: 8,
  },
  digestSymbol: {
    color: "#93C5FD",
    fontWeight: "700",
    fontSize: 13,
  },
  digestHeadline: {
    color: "#E5E7EB",
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  digestMeta: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  eventCard: {
    backgroundColor: "#0F1629",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  eventTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  eventMeta: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 6,
  },
});

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isWithin(dateIso?: string, from?: Date, to?: Date): boolean {
  if (!dateIso) return false;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return false;
  const fromMs = from ? from.getTime() : -Infinity;
  const toMs = to ? to.getTime() : Infinity;
  return t >= fromMs && t <= toMs;
}

function bucketize(
  news: NewsItem[],
  fedEvents: FedEvent[],
  marketEvents: MarketEvent[],
  watchlistNews: NewsItem[]
): FocusBuckets {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAheadEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthAheadEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const newsBuckets: Record<TimeframeKey, NewsItem[]> = {
    today: news
      .filter((n) => isWithin(n.publishedAt, todayStart, todayEnd))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 10),
    week: news
      .filter((n) => isWithin(n.publishedAt, weekAgo, now))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 10),
    month: news
      .filter((n) => isWithin(n.publishedAt, monthAgo, now))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 10),
  };

  const fedBuckets: Record<TimeframeKey, FedEvent[]> = {
    today: fedEvents
      .filter((e) => isWithin(e.date, todayStart, todayEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    week: fedEvents
      .filter((e) => isWithin(e.date, now, weekAheadEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10),
    month: fedEvents
      .filter((e) => isWithin(e.date, now, monthAheadEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10),
  };

  const marketEventBuckets: Record<TimeframeKey, MarketEvent[]> = {
    today: marketEvents
      .filter((e) => isWithin(e.date, todayStart, todayEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    week: marketEvents
      .filter((e) => isWithin(e.date, now, weekAheadEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8),
    month: marketEvents
      .filter((e) => isWithin(e.date, now, monthAheadEnd))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8),
  };

  const watchlistNewsBuckets: Record<TimeframeKey, NewsItem[]> = {
    today: watchlistNews
      .filter((n) => isWithin(n.publishedAt, todayStart, todayEnd))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 8),
    week: watchlistNews
      .filter((n) => isWithin(n.publishedAt, weekAgo, now))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 8),
    month: watchlistNews
      .filter((n) => isWithin(n.publishedAt, monthAgo, now))
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      )
      .slice(0, 8),
  };

  return {
    news: newsBuckets,
    fedEvents: fedBuckets,
    marketEvents: marketEventBuckets,
    watchlistNews: watchlistNewsBuckets,
  };
}

function computeWatchlistInsights(newsItems: NewsItem[]): WatchlistInsight[] {
  const groups = new Map<string, NewsItem[]>();

  newsItems.forEach((item) => {
    const symbol =
      (item.symbol || item.tickers?.[0] || "")?.toUpperCase()?.trim();
    if (!symbol) return;
    const existing = groups.get(symbol) ?? [];
    existing.push(item);
    groups.set(symbol, existing);
  });

  const insights: WatchlistInsight[] = [];
  groups.forEach((items, symbol) => {
    const sorted = items
      .slice()
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      );
    let score = 0;
    sorted.forEach((item) => {
      if (item.sentiment === "Positive") score += 1;
      else if (item.sentiment === "Negative") score -= 1;
    });
    const sentiment: WatchlistInsight["sentiment"] =
      score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";
    insights.push({
      symbol,
      sentiment,
      newsCount: sorted.length,
      latestHeadline: sorted[0]?.title,
    });
  });

  return insights.sort((a, b) => {
    if (b.newsCount !== a.newsCount) return b.newsCount - a.newsCount;
    return a.symbol.localeCompare(b.symbol);
  });
}

function buildWatchlistPromptLines(insights: WatchlistInsight[]): string {
  if (!insights || insights.length === 0) return "- (none)";
  return insights
    .slice(0, 4)
    .map((insight) => {
      const headline = insight.latestHeadline
        ? insight.latestHeadline.replace(/\s+/g, " ").trim()
        : `${insight.newsCount} update${insight.newsCount === 1 ? "" : "s"}`;
      return `- ${insight.symbol}: ${headline} [${insight.sentiment}]`;
    })
    .join("\n");
}

function truncateHeadline(text?: string, maxLength: number = 90): string {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatShortDate(dateIso?: string): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(dateIso?: string): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff) || diff < 0) return "";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function buildWatchlistDigest(newsItems: NewsItem[]): WatchlistDigestEntry[] {
  const sorted = newsItems
    .filter((item) => item?.title)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
    );

  const seen = new Set<string>();
  const digest: WatchlistDigestEntry[] = [];

  for (const item of sorted) {
    const symbol = (item.symbol || item.tickers?.[0] || "")
      ?.toUpperCase()
      ?.trim();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    digest.push({
      id: item.id || `${symbol}-${item.publishedAt || digest.length}`,
      symbol,
      headline: truncateHeadline(item.title, 110),
      sentiment: item.sentiment,
      publishedAt: item.publishedAt,
      source: item.source,
    });
    if (digest.length >= 6) break;
  }

  return digest;
}

function buildFallbackSummary(
  label: string,
  newsItems: NewsItem[],
  fedItems: FedEvent[],
  marketItems: MarketEvent[],
  watchlistItems: WatchlistInsight[]
): string {
  const timeframe = label.toLowerCase();
  const headlineSource =
    newsItems[0]?.title ||
    watchlistItems[0]?.latestHeadline ||
    marketItems[0]?.title ||
    fedItems[0]?.title ||
    "Monitor key catalysts";

  const summary = truncateHeadline(headlineSource, 120);
  const bullets: string[] = [];

  watchlistItems.slice(0, 2).forEach((item) => {
    const focusHeadline = truncateHeadline(
      item.latestHeadline || `${item.newsCount} new update${item.newsCount === 1 ? "" : "s"}`,
      80
    );
    bullets.push(
      `- Watch ${item.symbol}: ${focusHeadline} [${item.sentiment}]`
    );
  });

  if (fedItems.length > 0) {
    bullets.push(
      `- Prep for ${fedItems[0].title} (${formatShortDate(fedItems[0].date)})`
    );
  }

  if (marketItems.length > 0) {
    bullets.push(`- Note ${truncateHeadline(marketItems[0].title, 70)}`);
  }

  if (newsItems.length > 1) {
    bullets.push(`- Read: ${truncateHeadline(newsItems[1].title, 70)}`);
  }

  const defaults = [
    "- Recheck positions vs. plan",
    "- Review sector leadership",
    "- Update risk levels",
    "- Track economic calendar",
  ];

  for (const line of defaults) {
    if (bullets.length >= 4) break;
    if (!bullets.includes(line)) bullets.push(line);
  }

  return `Summary: ${summary}\n${bullets.slice(0, 4).join("\n")}`;
}

export default function FocusScreen() {
  const { theme } = useTheme();
  const { favorites, watchlists } = useUserStore((state) => ({
    favorites: state.profile.favorites,
    watchlists: state.profile.watchlists,
  }));
  const [news, setNews] = useState<NewsItem[]>([]);
  const [fedEvents, setFedEvents] = useState<FedEvent[]>([]);
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [economicIndicators, setEconomicIndicators] = useState<
    EconomicIndicator[]
  >([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summaries, setSummaries] = useState<Record<TimeframeKey, string>>({
    today: "",
    week: "",
    month: "",
  });
  const [summarizing, setSummarizing] = useState(false);

  const watchlistSymbols = useMemo(() => {
    if (favorites && favorites.length > 0) {
      return Array.from(
        new Set(
          favorites
            .filter((s): s is string => typeof s === "string" && s.length > 0)
            .map((s) => s.toUpperCase())
        )
      ).slice(0, 8);
    }
    const fallback = watchlists?.find((w) => w.items && w.items.length > 0);
    if (fallback) {
      return Array.from(
        new Set(
          fallback.items
            .map((item) => item.symbol)
            .filter((s): s is string => typeof s === "string" && s.length > 0)
            .map((s) => s.toUpperCase())
        )
      ).slice(0, 8);
    }
    return ["AAPL", "MSFT", "GOOGL"];
  }, [favorites, watchlists]);

  const hasWatchlistTargets = watchlistSymbols.length > 0;

  const loadWatchlistNews = useCallback(async (force: boolean = false) => {
    if (!hasWatchlistTargets) {
      setWatchlistNews([]);
      return;
    }

    setWatchlistLoading(true);
    try {
      const tasks = watchlistSymbols.map((symbol) =>
        apiEngine
          .request(
            `focus-watchlist-news:${symbol}`,
            () => fetchNewsWithDateFilter(symbol, 24 * 30),
            {
              priority: "high",
              ttlMs: 15 * 60 * 1000,
              cache: !force,
              dedupe: !force,
            }
          )
          .then((items) =>
            items.map((item, idx) => ({
              ...item,
              id: item.id || `${symbol}-${idx}`,
              symbol: (item.symbol || symbol).toUpperCase(),
              tickers:
                item.tickers && item.tickers.length > 0
                  ? item.tickers.map((t: string) => t.toUpperCase())
                  : [symbol],
            }))
          )
          .catch(() => [])
      );

      const results = await Promise.all(tasks);
      const merged = results.flat();
      const dedup = new Map<string, NewsItem>();
      for (const item of merged) {
        if (!item.symbol) continue;
        const normalized: NewsItem = {
          ...item,
          symbol: item.symbol.toUpperCase(),
          tickers:
            item.tickers && item.tickers.length > 0
              ? item.tickers.map((t) => t.toUpperCase())
              : [item.symbol.toUpperCase()],
        };
        if (!dedup.has(normalized.id)) {
          dedup.set(normalized.id, normalized);
        }
      }
      const sorted = Array.from(dedup.values()).sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      );
      setWatchlistNews(sorted);
    } catch (error) {
      console.warn("⚠️ Failed to load watchlist news", error);
    } finally {
      setWatchlistLoading(false);
    }
  }, [hasWatchlistTargets, watchlistSymbols]);

  const load = useCallback(async () => {
    const data = await apiEngine.request(
      "focus-global-market",
      () => getGlobalMarketData(40, true, true),
      {
        priority: "high",
        ttlMs: 90 * 1000,
      }
    );
    setNews(data.news || []);
    setFedEvents((data as any).fedEvents || []);
    setMarketEvents((data as any).marketEvents || []);
    setTrendingStocks((data as any).trendingStocks || []);
    setEconomicIndicators((data as any).economicIndicators || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadWatchlistNews();
  }, [loadWatchlistNews]);

  const buckets = useMemo(
    () => bucketize(news, fedEvents, marketEvents, watchlistNews),
    [news, fedEvents, marketEvents, watchlistNews]
  );

  const watchlistInsights = useMemo(
    () => ({
      today: computeWatchlistInsights(buckets.watchlistNews.today),
      week: computeWatchlistInsights(buckets.watchlistNews.week),
      month: computeWatchlistInsights(buckets.watchlistNews.month),
    }),
    [buckets]
  );

  // Generate concise AI summaries per section
  useEffect(() => {
    async function runSummaries() {
      const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
      const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

      const buildPrompt = (
        label: string,
        newsItems: NewsItem[],
        fedItems: FedEvent[],
        marketItems: MarketEvent[],
        trendingItems: TrendingStock[],
        economicItems: EconomicIndicator[],
        watchlistItems: WatchlistInsight[]
      ) => {
        const headlines = newsItems
          .slice(0, 5)
          .map((n) => `- ${n.title}${n.sentiment ? ` [${n.sentiment}]` : ""}`)
          .join("\n");
        const fedEventsText = fedItems
          .slice(0, 3)
          .map((e) => `- ${e.title} (${new Date(e.date).toLocaleDateString()})`)
          .join("\n");
        const marketEventsText = marketItems
          .slice(0, 3)
          .map(
            (e) =>
              `- ${e.title} [${e.impact}] (${new Date(
                e.date
              ).toLocaleDateString()})`
          )
          .join("\n");
        const trending = trendingItems
          .slice(0, 4)
          .map((t) => `- ${t.ticker} (${t.sentiment}, ${t.mentions} mentions)`)
          .join("\n");
        const indicators = economicItems
          .slice(0, 3)
          .map(
            (i) =>
              `- ${i.title}: ${i.value}${i.unit}${
                i.changePercent !== undefined
                  ? ` (${i.changePercent > 0 ? "+" : ""}${i.changePercent.toFixed(1)}%)`
                  : ""
              }`
          )
          .join("\n");
        const watchlistFocus = buildWatchlistPromptLines(watchlistItems);

        return `You are an expert market assistant. Write a very concise, plain-language focus for ${label}.\n\nRules:\n- Max 1 short sentence summary (<= 35 words)\n- Then up to 4 short bullets starting with a verb (no more than 8 words each)\n- Avoid jargon; be direct and actionable; no emojis\n\nContext:\nHeadlines:\n${headlines || "- (no major headlines)"}\nFed/FOMC:\n${fedEventsText || "- (none)"}\nMarket Events:\n${marketEventsText || "- (none)"}\nTrending:\n${trending || "- (none)"}\nEconomic Data:\n${indicators || "- (none)"}\nWatchlist Focus:\n${watchlistFocus}\n\nOutput format:\nSummary: <one-sentence>\n- <bullet 1>\n- <bullet 2>\n- <bullet 3>\n- <bullet 4>`;
      };

      async function summarizeLabel(
        label: string,
        newsItems: NewsItem[],
        fedItems: FedEvent[],
        marketItems: MarketEvent[],
        trendingItems: TrendingStock[],
        economicItems: EconomicIndicator[],
        watchlistItems: WatchlistInsight[]
      ): Promise<string> {
        if (!client) {
          return buildFallbackSummary(
            label,
            newsItems,
            fedItems,
            marketItems,
            watchlistItems
          );
        }

        const prompt = buildPrompt(
          label,
          newsItems,
          fedItems,
          marketItems,
          trendingItems,
          economicItems,
          watchlistItems
        );

        try {
          const resp = await client.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content:
                  "You generate succinct, actionable investor briefs. Be clear, structured, and minimal.",
              },
              { role: "user", content: prompt },
            ],
            max_completion_tokens: 220,
          });
          return resp.choices[0]?.message?.content?.trim() || "";
        } catch (e) {
          return buildFallbackSummary(
            label,
            newsItems,
            fedItems,
            marketItems,
            watchlistItems
          );
        }
      }

      try {
        setSummarizing(true);
        const [today, week, month] = await Promise.all([
          summarizeLabel(
            "today",
            buckets.news.today,
            buckets.fedEvents.today,
            buckets.marketEvents.today,
            trendingStocks,
            economicIndicators,
            watchlistInsights.today
          ),
          summarizeLabel(
            "this week",
            buckets.news.week,
            buckets.fedEvents.week,
            buckets.marketEvents.week,
            trendingStocks,
            economicIndicators,
            watchlistInsights.week
          ),
          summarizeLabel(
            "this month",
            buckets.news.month,
            buckets.fedEvents.month,
            buckets.marketEvents.month,
            trendingStocks,
            economicIndicators,
            watchlistInsights.month
          ),
        ]);
        setSummaries({ today, week, month });
      } finally {
        setSummarizing(false);
      }
    }

    const hasData =
      buckets.news.today.length +
        buckets.news.week.length +
        buckets.news.month.length >
        0 ||
      buckets.fedEvents.today.length +
        buckets.fedEvents.week.length +
        buckets.fedEvents.month.length >
        0 ||
      watchlistInsights.today.length +
        watchlistInsights.week.length +
        watchlistInsights.month.length >
        0;

    if (hasData) {
      runSummaries();
    } else {
      setSummaries({ today: "", week: "", month: "" });
    }
  }, [buckets, trendingStocks, economicIndicators, watchlistInsights]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      apiEngine.invalidate("focus-global-market");
      watchlistSymbols.forEach((symbol) =>
        apiEngine.invalidate(`focus-watchlist-news:${symbol}`)
      );
      const refreshPromise = refreshGlobalCache(40, true, true);
      const watchlistPromise = loadWatchlistNews(true);
      const data = await refreshPromise;
      await watchlistPromise;
      setNews(data.news || []);
      setFedEvents((data as any).fedEvents || []);
      setMarketEvents((data as any).marketEvents || []);
      setTrendingStocks((data as any).trendingStocks || []);
      setEconomicIndicators((data as any).economicIndicators || []);
    } finally {
      setRefreshing(false);
    }
  }, [loadWatchlistNews, watchlistSymbols]);
  function formatEventLine(e: FedEvent): string {
    const d = new Date(e.date);
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const monthDay = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `- ${weekday} ${monthDay} ${time}: ${e.title}`;
  }

  function renderFedEventsText(items: FedEvent[]) {
    return (
      <View style={styles.eventsCard}>
        <Text style={styles.eventsHeaderText}>Fed events</Text>
        {items && items.length > 0 ? (
          items.slice(0, 5).map((e) => (
            <Text key={e.id} style={styles.eventLineText}>
              {formatEventLine(e)}
            </Text>
          ))
        ) : (
          <Text style={styles.eventLineText}>- None</Text>
        )}
      </View>
    );
  }

  function renderWatchlistDigest(timeframe: TimeframeKey) {
    if (!hasWatchlistTargets) return null;
    const digest = buildWatchlistDigest(buckets.watchlistNews[timeframe]);

    if (watchlistLoading && digest.length === 0) {
      return (
        <View style={styles.digestCard}>
          <View style={styles.watchlistHeader}>
            <Ionicons name="newspaper-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.watchlistHeaderText}>Favorite headlines</Text>
          </View>
          <Text style={styles.watchlistNews}>Gathering favorite ticker headlines…</Text>
        </View>
      );
    }

    if (digest.length === 0) {
      return null;
    }

    return (
      <View style={styles.digestCard}>
        <View style={styles.watchlistHeader}>
          <Ionicons name="newspaper-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.watchlistHeaderText}>Favorite headlines</Text>
        </View>
        {digest.slice(0, 4).map((entry) => {
          const metaParts = [
            entry.sentiment,
            entry.source,
            formatRelativeTime(entry.publishedAt) || formatShortDate(entry.publishedAt),
          ].filter(Boolean);
          return (
            <View key={`${timeframe}-${entry.id}`} style={styles.digestLine}>
              <Text style={styles.digestSymbol}>{entry.symbol}</Text>
              <Text style={styles.digestHeadline}>{entry.headline}</Text>
              {metaParts.length > 0 ? (
                <Text style={styles.digestMeta}>{metaParts.join(" • ")}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  function renderWatchlistSection(timeframe: TimeframeKey) {
    if (!hasWatchlistTargets) return null;
    const insights = watchlistInsights[timeframe];
    const headingMap: Record<TimeframeKey, string> = {
      today: "Favorites to watch today",
      week: "Focus this week",
      month: "Focus this month",
    };

    return (
      <View style={styles.watchlistCard}>
        <View style={styles.watchlistHeader}>
          <Ionicons name="newspaper" size={16} color={theme.colors.primary} />
          <Text style={styles.watchlistHeaderText}>{headingMap[timeframe]}</Text>
        </View>
        {watchlistLoading && insights.length === 0 ? (
          <Text style={styles.watchlistNews}>Loading watchlist headlines...</Text>
        ) : insights.length > 0 ? (
          <View style={styles.watchlistGrid}>
            {insights.slice(0, 4).map((insight) => (
              <View
                key={`${timeframe}-${insight.symbol}`}
                style={styles.watchlistItem}
              >
                <Text style={styles.watchlistSymbol}>{insight.symbol}</Text>
                {insight.latestHeadline ? (
                  <Text style={styles.watchlistNews}>
                    {truncateHeadline(insight.latestHeadline)}
                  </Text>
                ) : (
                  <Text style={styles.watchlistNews}>
                    {insight.newsCount} headline
                    {insight.newsCount === 1 ? "" : "s"}
                  </Text>
                )}
                <Text
                  style={[
                    styles.watchlistSentiment,
                    insight.sentiment === "Positive"
                      ? styles.metricPositive
                      : insight.sentiment === "Negative"
                      ? styles.metricNegative
                      : { color: "#9CA3AF" },
                  ]}
                >
                  {insight.sentiment} • {insight.newsCount} story
                  {insight.newsCount === 1 ? "" : "ies"}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {favorites && favorites.length > 0
              ? "No fresh headlines for your favorites."
              : "Pick favorites to unlock personalized focus."}
          </Text>
        )}
      </View>
    );
  }

  function renderTrendingStocks() {
    if (!trendingStocks || trendingStocks.length === 0) return null;

    return (
      <View style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <Ionicons name="trending-up" size={16} color={theme.colors.primary} />
          <Text style={styles.metricsHeaderText}>Trending Stocks</Text>
        </View>
        <View style={styles.metricsGrid}>
          {trendingStocks.slice(0, 6).map((stock, idx) => (
            <View key={idx} style={styles.metricItem}>
              <Text style={styles.metricLabel}>{stock.ticker}</Text>
              <Text style={styles.metricValue}>{stock.mentions} mentions</Text>
              <Text
                style={[
                  styles.metricChange,
                  stock.sentiment === "Positive"
                    ? styles.metricPositive
                    : stock.sentiment === "Negative"
                    ? styles.metricNegative
                    : { color: "#9CA3AF" },
                ]}
              >
                {stock.sentiment}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderEconomicIndicators() {
    if (!economicIndicators || economicIndicators.length === 0) return null;

    return (
      <View style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <Ionicons name="stats-chart" size={16} color={theme.colors.primary} />
          <Text style={styles.metricsHeaderText}>Economic Data</Text>
        </View>
        <View style={styles.metricsGrid}>
          {economicIndicators.slice(0, 6).map((indicator, idx) => (
            <View key={idx} style={styles.metricItem}>
              <Text style={styles.metricLabel}>{indicator.title}</Text>
              <Text style={styles.metricValue}>
                {indicator.value}
                {indicator.unit}
              </Text>
              {indicator.changePercent && (
                <Text
                  style={[
                    styles.metricChange,
                    indicator.changePercent > 0
                      ? styles.metricPositive
                      : styles.metricNegative,
                  ]}
                >
                  {indicator.changePercent > 0 ? "+" : ""}
                  {indicator.changePercent.toFixed(1)}%
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Focus</Text>
          <Text style={styles.headerSubtitle}>
            What matters today, this week, and this month
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Market Overview - Always show trending stocks and economic data */}
        {renderTrendingStocks()}
        {renderEconomicIndicators()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Today</Text>
          </View>
          {summaries.today ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryHeaderText}>AI Focus</Text>
              </View>
              <Text style={styles.summaryText}>{summaries.today}</Text>
            </View>
          ) : null}
          {renderWatchlistDigest("today")}
          {renderFedEventsText(buckets.fedEvents.today)}
          {renderWatchlistSection("today")}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>This Week</Text>
          </View>
          {summaries.week ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryHeaderText}>AI Focus</Text>
              </View>
              <Text style={styles.summaryText}>{summaries.week}</Text>
            </View>
          ) : null}
          {renderWatchlistDigest("week")}
          {renderFedEventsText(buckets.fedEvents.week)}
          {renderWatchlistSection("week")}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.sectionTitle}>This Month</Text>
          </View>
          {summaries.month ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryHeaderText}>AI Focus</Text>
              </View>
              <Text style={styles.summaryText}>{summaries.month}</Text>
            </View>
          ) : null}
          {renderWatchlistDigest("month")}
          {renderFedEventsText(buckets.fedEvents.month)}
          {renderWatchlistSection("month")}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
