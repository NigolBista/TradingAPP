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
import { useTheme, type Theme } from "../providers/ThemeProvider";
import { COLORS } from "../constants/colors";
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

export default function FocusScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [fedEvents, setFedEvents] = useState<FedEvent[]>([]);
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [economicIndicators, setEconomicIndicators] = useState<
    EconomicIndicator[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [summaries, setSummaries] = useState<Record<TimeframeKey, string>>({
    today: "",
    week: "",
    month: "",
  });
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    const data = await getGlobalMarketData(40, true, true);
    setNews(data.news || []);
    setFedEvents((data as any).fedEvents || []);
    setMarketEvents((data as any).marketEvents || []);
    setTrendingStocks((data as any).trendingStocks || []);
    setEconomicIndicators((data as any).economicIndicators || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buckets = useMemo(
    () => bucketize(news, fedEvents, marketEvents, []),
    [news, fedEvents, marketEvents]
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
        economicItems: EconomicIndicator[]
      ) => {
        const headlines = newsItems
          .slice(0, 5)
          .map((n) => `- ${n.title}${n.sentiment ? ` [${n.sentiment}]` : ""}`)
          .join("\n");
        const fedEvents = fedItems
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
                i.changePercent
                  ? ` (${
                      i.changePercent > 0 ? "+" : ""
                    }${i.changePercent.toFixed(1)}%)`
                  : ""
              }`
          )
          .join("\n");

        return `You are an expert market assistant. Write a very concise, plain-language focus for ${label}.

Rules:
- Max 1 short sentence summary (<= 35 words)
- Then up to 4 short bullets starting with a verb (no more than 8 words each)
- Avoid jargon; be direct and actionable; no emojis

Context:
Headlines:\n${headlines || "- (no major headlines)"}
Fed/FOMC:\n${fedEvents || "- (none)"}
Market Events:\n${marketEventsText || "- (none)"}
Trending:\n${trending || "- (none)"}
Economic Data:\n${indicators || "- (none)"}

Output format:
Summary: <one-sentence>
- <bullet 1>
- <bullet 2>
- <bullet 3>
- <bullet 4>`;
      };

      async function summarizeLabel(
        label: string,
        newsItems: NewsItem[],
        fedItems: FedEvent[],
        marketItems: MarketEvent[],
        trendingItems: TrendingStock[],
        economicItems: EconomicIndicator[]
      ): Promise<string> {
        if (!client) {
          const fallback = `Summary: ${newsItems.length} headlines, ${fedItems.length} Fed events, ${marketItems.length} market events to watch.\n- Scan top stories\n- Note upcoming policy events\n- Monitor trending stocks\n- Track economic data`;
          return fallback;
        }

        const prompt = buildPrompt(
          label,
          newsItems,
          fedItems,
          marketItems,
          trendingItems,
          economicItems
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
          return `Summary: ${newsItems.length} headlines, ${fedItems.length} Fed events, ${marketItems.length} market events to watch.\n- Scan top stories\n- Note upcoming policy events\n- Monitor trending stocks\n- Track economic data`;
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
            economicIndicators
          ),
          summarizeLabel(
            "this week",
            buckets.news.week,
            buckets.fedEvents.week,
            buckets.marketEvents.week,
            trendingStocks,
            economicIndicators
          ),
          summarizeLabel(
            "this month",
            buckets.news.month,
            buckets.fedEvents.month,
            buckets.marketEvents.month,
            trendingStocks,
            economicIndicators
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
        0;

    if (hasData) {
      runSummaries();
    } else {
      setSummaries({ today: "", week: "", month: "" });
    }
  }, [buckets, trendingStocks, economicIndicators]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await refreshGlobalCache(40, true, true);
      setNews(data.news || []);
      setFedEvents((data as any).fedEvents || []);
      setMarketEvents((data as any).marketEvents || []);
      setTrendingStocks((data as any).trendingStocks || []);
      setEconomicIndicators((data as any).economicIndicators || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
                    : styles.metricNeutral,
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
          {renderFedEventsText(buckets.fedEvents.today)}
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
          {renderFedEventsText(buckets.fedEvents.week)}
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
          {renderFedEventsText(buckets.fedEvents.month)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: "700",
    },
    headerSubtitle: {
      color: theme.colors.textSecondary,
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
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 6,
    },
    eventsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 6,
    },
    eventsHeaderText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 6,
    },
    eventLineText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    summaryHeaderText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginLeft: 6,
    },
    summaryText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    metricsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },
    metricsHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    metricsHeaderText: {
      color: theme.colors.text,
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
      backgroundColor:
        theme.mode === "dark" ? "#1F2937" : "rgba(15, 23, 42, 0.06)",
      borderRadius: 6,
      padding: 8,
      minWidth: 100,
      flex: 1,
    },
    metricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      marginBottom: 2,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    metricChange: {
      fontSize: 11,
      fontWeight: "500",
    },
    metricPositive: {
      color: COLORS.POSITIVE,
    },
    metricNegative: {
      color: COLORS.NEGATIVE,
    },
    metricNeutral: {
      color: theme.colors.textSecondary,
    },
    eventCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    eventTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
    eventMeta: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    watchlistCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },
    watchlistHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    watchlistHeaderText: {
      color: theme.colors.text,
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
      backgroundColor:
        theme.mode === "dark" ? "#1F2937" : "rgba(15, 23, 42, 0.06)",
      borderRadius: 6,
      padding: 8,
      minWidth: 100,
      flex: 1,
    },
    watchlistSymbol: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 2,
    },
    watchlistNews: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      marginBottom: 2,
    },
    watchlistSentiment: {
      fontSize: 11,
      fontWeight: "500",
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginTop: 6,
    },
  });
