import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAppDataStore,
  type PortfolioHistory,
  type Position,
} from "../store/appDataStore";
import { useNavigation } from "@react-navigation/native";
import MarketOverview from "../components/insights/MarketOverview";
import type { NewsItem } from "../services/newsProviders";
// Removed useMarketOverviewStore to prevent loops - using centralized store instead
import DecalpXMini from "../components/insights/DecalpXMini";
import PerformanceCard from "../components/insights/PerformanceCard";
import NewsStackCarousel from "../components/insights/NewsStackCarousel";
import SignalCarousel, {
  type SignalItem,
} from "../components/insights/SignalCarousel";
import {
  fetchPolygonBulkQuotes,
  isPolygonApiAvailable,
} from "../services/polygonQuotes";
import { useSignalCacheStore } from "../store/signalCacheStore";
import { useTheme, type Theme } from "../providers/ThemeProvider";

const { width } = Dimensions.get("window");

interface DashboardData {
  cachedNews: NewsItem[];
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Use centralized store for market data too
  const { getSentimentSummary } = useAppDataStore();

  // Use centralized store instead of local state
  const {
    accounts,
    positions,
    portfolioSummary,
    getPortfolioHistory,
    getAccountsByCategory,
    getAccountCategories,
    refresh,
    refreshInBackground,
    isRefreshing,
    isHydrated,
  } = useAppDataStore();
  const navigation = useNavigation();
  const [movers, setMovers] = useState<
    { symbol: string; name?: string; changePct: number }[]
  >([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const quoteCacheRef = useRef<Record<string, number>>({});
  const [dismissedNewsIds, setDismissedNewsIds] = useState<string[]>([]);
  const [dismissedSignalIds, setDismissedSignalIds] = useState<string[]>([]);
  const [newsCaughtUp, setNewsCaughtUp] = useState(false);
  const [newsPulse, setNewsPulse] = useState(0);
  const [dismissedFocusIds, setDismissedFocusIds] = useState<string[]>([]);
  const [focusCaughtUp, setFocusCaughtUp] = useState(false);

  // Get sentiment from centralized store
  const sentimentSummary = getSentimentSummary();

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    cachedNews: [],
  });

  const [perfPeriod, setPerfPeriod] = useState<
    "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL"
  >("1M");
  const metricModes = ["netWorth", "cash", "debt", "investments"] as const;
  type MetricMode = (typeof metricModes)[number];
  const [headerModeIndex, setHeaderModeIndex] = useState(0);
  const headerMode: MetricMode = metricModes[headerModeIndex];
  const scrollViewRef = useRef<ScrollView>(null);

  const aggregateBalances = useMemo(() => {
    const totals = { cash: 0, debt: 0, investments: 0 };
    const seenInvestmentAccounts = new Set<string>();
    for (const account of accounts) {
      const balance = Number(account.balance || 0);
      if (!Number.isFinite(balance)) continue;
      switch (account.category) {
        case "Banking":
          totals.cash += balance;
          break;
        case "Credit":
        case "Loans":
          totals.debt += Math.abs(balance);
          break;
        case "Investment":
          if (!seenInvestmentAccounts.has(account.id)) {
            totals.investments += balance;
            seenInvestmentAccounts.add(account.id);
          }
          break;
        default:
          totals.cash += balance;
      }
    }
    return totals;
  }, [accounts]);

  const headerMetrics = useMemo(() => {
    const totals = aggregateBalances;
    const netWorth = portfolioSummary.totalValue + totals.cash - totals.debt;
    return {
      netWorth: {
        title: "Total Net Worth",
        primary: netWorth,
        change: portfolioSummary.dayChange,
        changePercent: portfolioSummary.dayChangePercent,
        label: "Today",
      },
      cash: {
        title: "Total Cash",
        primary: totals.cash,
        change: 0,
        changePercent: 0,
        label: "Across Banking",
      },
      debt: {
        title: "Total Debt",
        primary: totals.debt,
        change: 0,
        changePercent: 0,
        label: "Outstanding",
      },
      investments: {
        title: "Investments",
        primary: portfolioSummary.totalValue,
        change: portfolioSummary.totalGainLoss,
        changePercent: portfolioSummary.totalGainLossPercent,
        label: "Overall",
      },
    } satisfies Record<
      MetricMode,
      {
        title: string;
        primary: number;
        change: number;
        changePercent: number;
        label: string;
      }
    >;
  }, [aggregateBalances, portfolioSummary]);

  const cycleHeaderMode = useCallback(() => {
    setHeaderModeIndex((prev) => (prev + 1) % metricModes.length);
  }, []);

  // Get data from store
  const portfolioHistory = getPortfolioHistory(perfPeriod);
  const filteredAccounts = getAccountsByCategory("All");
  const accountTabs = getAccountCategories();

  const signalHistory = useSignalCacheStore((state) => state.signalHistory);
  const openSignals = useMemo(
    () => signalHistory.filter((r) => r.status === "open"),
    [signalHistory]
  );
  const closedSignals = useMemo(
    () => signalHistory.filter((r) => r.status === "closed"),
    [signalHistory]
  );
  const investmentPositions = useMemo(() => positions || [], [positions]);

  // Callback to receive news data from MarketOverview component
  const handleNewsDataFetched = (news: NewsItem[]) => {
    console.log(
      "📰 Dashboard received cached news data:",
      news.length,
      "items"
    );
    setDashboardData((prev) => ({ ...prev, cachedNews: news }));
  };

  const [dummySeries, setDummySeries] = useState<
    { time: number; close: number }[]
  >([]);
  const [benchmarkSeries, setBenchmarkSeries] = useState<
    { time: number; close: number }[]
  >([]);

  function generateDummySeries(
    points: number = 240,
    base: number = 1_200_000
  ): { time: number; close: number }[] {
    const now = Date.now();
    const series: { time: number; close: number }[] = [];
    let price = base;
    // GBM-style params
    let mu = 0.00015; // drift per step
    let vol = 0.004; // volatility per step
    const clamp = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, n));
    const gauss = () => {
      // Box-Muller transform
      let u = 0,
        v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * 60_000; // 1-minute steps
      // occasional regime changes in drift/vol
      if (Math.random() < 0.03) mu += (Math.random() - 0.5) * 0.001;
      if (Math.random() < 0.06)
        vol = clamp(vol + (Math.random() - 0.5) * 0.003, 0.0015, 0.012);
      // GBM increment
      const z = gauss();
      const ret = mu + vol * z; // simple additive log-return per step
      price = Math.max(500, price * (1 + ret));
      // occasional jump up/down
      if (Math.random() < 0.02) {
        const jump =
          (Math.random() * 0.05 + 0.01) * (Math.random() < 0.5 ? -1 : 1);
        price = Math.max(500, price * (1 + jump));
      }
      // small mean reversion to base to avoid runaway
      const mr = (base - price) * 0.0000015;
      price = price + mr;
      series.push({ time: t, close: Math.round(price * 100) / 100 });
    }
    // Ensure uptrend for demo so header and chart are consistent visually
    const first = series[0]?.close ?? 0;
    const last = series[series.length - 1]?.close ?? 0;
    if (last <= first && first > 0) {
      const tilt = (first - last) * 1.15 + first * 0.005;
      const n = series.length - 1;
      return series.map((d, i) => ({
        time: d.time,
        close: Math.round((d.close + (tilt * i) / Math.max(1, n)) * 100) / 100,
      }));
    }
    return series;
  }

  // Simple refresh function that uses the centralized store
  const handleRefresh = async () => {
    // Refresh the centralized store (includes market data)
    await refresh();
  };

  useEffect(() => {
    // Generate dummy chart series for the portfolio chart
    const main = generateDummySeries();
    setDummySeries(main);
    const bench = main.map((d, i) => ({
      time: d.time,
      close: d.close * (0.985 + 0.00025 * i),
    }));
    setBenchmarkSeries(bench);
  }, [perfPeriod]);

  useEffect(() => {
    const loadQuotes = async () => {
      if (!investmentPositions.length || !isPolygonApiAvailable()) {
        setMovers([]);
        return;
      }

      const uniqueSymbols = Array.from(
        new Set(
          investmentPositions
            .map((pos) => pos.symbol)
            .filter((symbol): symbol is string => Boolean(symbol))
            .map((symbol) => symbol.toUpperCase())
        )
      );

      if (!uniqueSymbols.length) {
        setMovers([]);
        return;
      }

      setQuotesLoading(true);

      try {
        const quotes = await fetchPolygonBulkQuotes(uniqueSymbols);
        const deltaMap: Record<string, number> = {};

        uniqueSymbols.forEach((symbol) => {
          const quote = quotes[symbol];
          if (quote && Number.isFinite(quote.changePercent)) {
            deltaMap[symbol] = quote.changePercent;
          }
        });

        quoteCacheRef.current = deltaMap;

        const moversList = investmentPositions
          .map((pos) => {
            const symbol = pos.symbol.toUpperCase();
            const pct = deltaMap[symbol] ?? pos.unrealizedPnLPercent ?? 0;
            return {
              symbol,
              name: pos.name,
              changePct: pct,
            };
          })
          .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

        setMovers(moversList.slice(0, 6));
      } catch (err) {
        console.warn("Failed to load Polygon quotes", err);
      } finally {
        setQuotesLoading(false);
      }
    };

    loadQuotes();
  }, [investmentPositions, isHydrated]);

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      // In a real app, this would add to watchlist via API
      // For now, just show success and refresh data
      Alert.alert("Success", `${symbol} added to watchlist`);
      refreshInBackground();
    } catch (error) {
      Alert.alert("Error", `Failed to add ${symbol} to watchlist`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const formatSignalTime = (offsetMinutes: number) => {
    const target = new Date(Date.now() - offsetMinutes * 60 * 1000);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(target);
  };

  const renderMarketBrief = () => {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Overview</Text>
          <Pressable
            onPress={() => navigation.navigate("MarketOverview" as never)}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View Full</Text>
            <Ionicons name="chevron-forward" size={16} color="#00D4AA" />
          </Pressable>
        </View>
        {/* Sentiment strip (bullish/bearish/neutral) below portfolio */}
        <View style={styles.sentimentStrip}>
          <View
            style={[
              styles.sentimentPill,
              sentimentSummary?.overall === "bullish"
                ? styles.pillBull
                : sentimentSummary?.overall === "bearish"
                ? styles.pillBear
                : styles.pillNeutral,
            ]}
          >
            <Ionicons
              name={
                sentimentSummary?.overall === "bullish"
                  ? "trending-up"
                  : sentimentSummary?.overall === "bearish"
                  ? "trending-down"
                  : "remove"
              }
              size={14}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.pillText}>
              {(sentimentSummary?.overall || "neutral").toUpperCase()} •{" "}
              {sentimentSummary
                ? `${Math.round(sentimentSummary.confidence)}%`
                : "--%"}
            </Text>
          </View>
        </View>
        <MarketOverview
          compact={true}
          onNewsPress={() => navigation.navigate("Focus" as never)}
          onNewsDataFetched={handleNewsDataFetched}
          navigation={navigation}
          fullWidth={false}
        />
      </View>
    );
  };

  const handleNewsDismiss = (id: string) => {
    setDismissedNewsIds((prev) => {
      const next = [...prev, id];
      const remaining = dashboardData.cachedNews.filter(
        (item) => !next.includes(item.id)
      );
      if (remaining.length === 0) {
        setNewsCaughtUp(true);
      }
      return next;
    });
  };

  const resetNewsStack = () => {
    setDismissedNewsIds([]);
    setNewsCaughtUp(false);
  };

  const newsStackItems = useMemo(() => {
    return dashboardData.cachedNews.filter(
      (item) => !dismissedNewsIds.includes(item.id)
    );
  }, [dashboardData.cachedNews, dismissedNewsIds]);

  const focusStackItems = useMemo(() => {
    if (!dashboardData.cachedNews?.length) return [] as NewsItem[];

    const userTickers = new Set(
      (investmentPositions || [])
        .map((p) => (p.symbol || "").toUpperCase())
        .filter(Boolean)
    );

    const sectorKeywords = [
      "Technology",
      "Energy",
      "Financial",
      "Healthcare",
      "Consumer",
      "Industrials",
      "Materials",
      "Utilities",
      "Real Estate",
      "Communication",
    ];

    const containsAny = (text: string, keywords: string[]) => {
      const lower = text.toLowerCase();
      return keywords.some((k) => lower.includes(k.toLowerCase()));
    };

    const isFedRelated = (item: NewsItem) => {
      const text = `${item.title || ""} ${item.summary || ""}`;
      return containsAny(text, [
        "fed",
        "fomc",
        "powell",
        "rate",
        "rates",
        "cpi",
        "pce",
        "jobs",
        "employment",
        "inflation",
        "treasury",
        "dot plot",
      ]);
    };

    const isEarningsRelated = (item: NewsItem) => {
      const text = `${item.title || ""} ${item.summary || ""}`;
      return containsAny(text, [
        "earnings",
        "eps",
        "guidance",
        "revenue",
        "outlook",
        "beat",
        "miss",
        "call",
      ]);
    };

    const hasSectorFocus = (item: NewsItem) => {
      const text = `${item.title || ""} ${item.summary || ""}`;
      const topicHit = (item.topics || []).some((t) =>
        sectorKeywords.some((k) =>
          (t || "").toLowerCase().includes(k.toLowerCase())
        )
      );
      return topicHit || containsAny(text, sectorKeywords);
    };

    const recencyWeight = (publishedAt?: string) => {
      if (!publishedAt) return 0;
      const ts = new Date(publishedAt).getTime();
      if (!Number.isFinite(ts)) return 0;
      const hours = Math.max(0, (Date.now() - ts) / (60 * 60 * 1000));
      // 0-12h maps to 10→0
      return Math.max(0, 10 * (1 - Math.min(12, hours) / 12));
    };

    const intersectTickers = (a?: string[]) => {
      if (!a || !a.length) return 0;
      let count = 0;
      for (const t of a) if (userTickers.has((t || "").toUpperCase())) count++;
      return count;
    };

    const score = (item: NewsItem) => {
      let s = 0;
      const tickerMatches = intersectTickers(item.tickers);
      if (tickerMatches > 0) s += Math.min(20, tickerMatches * 10);
      if (isEarningsRelated(item)) s += 15;
      if (isFedRelated(item)) s += 12;
      if ((item.symbol || "").toLowerCase() === "market") s += 8;
      if (hasSectorFocus(item)) s += 6;
      if (item.importance === "high") s += 10;
      if (item.importance === "medium") s += 5;
      s += recencyWeight(item.publishedAt);
      return s;
    };

    return dashboardData.cachedNews
      .filter((n) => !dismissedFocusIds.includes(n.id))
      .map((n) => ({ n, s: score(n) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ n }) => n);
  }, [dashboardData.cachedNews, dismissedFocusIds, investmentPositions]);

  const renderNewsStack = () => {
    if (newsCaughtUp) {
      return (
        <View style={styles.newsCaughtUpContainer}>
          <Text style={styles.newsCaughtUpText}>All caught up on news</Text>
          <Pressable onPress={resetNewsStack} style={styles.newsResetButton}>
            <Text style={styles.newsResetText}>Show again</Text>
          </Pressable>
        </View>
      );
    }

    if (!newsStackItems.length) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spotlight Headlines</Text>
          <Pressable
            onPress={() => navigation.navigate("Focus" as never)}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>See Full Feed</Text>
            <Ionicons name="chevron-forward" size={16} color="#00D4AA" />
          </Pressable>
        </View>
        <NewsStackCarousel
          items={newsStackItems}
          onDismiss={handleNewsDismiss}
          onPressItem={(item) => {
            if (item.url) {
              Linking.openURL(item.url).catch(() => {});
            }
          }}
          onViewAll={() => navigation.navigate("Focus" as never)}
        />
      </View>
    );
  };

  const handleFocusDismiss = (id: string) => {
    setDismissedFocusIds((prev) => {
      const next = [...prev, id];
      const remaining = focusStackItems.filter(
        (item) => !next.includes(item.id)
      );
      if (remaining.length === 0) setFocusCaughtUp(true);
      return next;
    });
  };

  const resetFocusStack = () => {
    setDismissedFocusIds([]);
    setFocusCaughtUp(false);
  };

  const renderFocusToday = () => {
    if (focusCaughtUp) {
      return (
        <View style={styles.newsCaughtUpContainer}>
          <Text style={styles.newsCaughtUpText}>
            All caught up on focus items
          </Text>
          <Pressable onPress={resetFocusStack} style={styles.newsResetButton}>
            <Text style={styles.newsResetText}>Show again</Text>
          </Pressable>
        </View>
      );
    }

    if (!focusStackItems.length) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Focus</Text>
          <Pressable
            onPress={() => navigation.navigate("Focus" as never)}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>See Full Feed</Text>
            <Ionicons name="chevron-forward" size={16} color="#00D4AA" />
          </Pressable>
        </View>
        <NewsStackCarousel
          items={focusStackItems}
          onDismiss={handleFocusDismiss}
          onPressItem={(item) => {
            if (item.url) {
              Linking.openURL(item.url).catch(() => {});
            }
          }}
          onViewAll={() => navigation.navigate("Focus" as never)}
        />
      </View>
    );
  };

  // Stocks In Play mosaic removed in favor of Focus Today news stack

  // Signals carousel
  const [signalQueue, setSignalQueue] = useState<SignalItem[]>(() => [
    {
      id: "sig1",
      title: "Unusual volume spike on NVDA",
      description: "Volume 2.1× 30d avg; buyers dominant into afternoon ramp.",
      type: "bullish",
      confidence: 78,
      time: formatSignalTime(14),
    },
    {
      id: "sig2",
      title: "AAPL mean reversion setup",
      description: "Rejected daily resistance; watch for fade below VWAP.",
      type: "bearish",
      confidence: 65,
      time: formatSignalTime(42),
    },
    {
      id: "sig3",
      title: "TSLA squeeze risk",
      description: "Short interest elevated; gamma pinned near 5% OTM.",
      type: "neutral",
      confidence: 55,
      time: formatSignalTime(73),
    },
  ]);

  const activeSignals = useMemo(
    () => signalQueue.filter((s) => !dismissedSignalIds.includes(s.id)),
    [signalQueue, dismissedSignalIds]
  );

  const handleSignalDismiss = (id: string) => {
    setDismissedSignalIds((prev) => [...prev, id]);
  };

  const renderSignals = () => {
    if (activeSignals.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Pressable
            style={styles.sectionTitleRow}
            onPress={() => navigation.navigate("Focus" as never)}
          >
            <Text style={styles.sectionTitle}>Signals</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.text}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
        <Text style={styles.sectionDescription}>Real-time trading signals</Text>
        <SignalCarousel
          items={activeSignals}
          onDismiss={handleSignalDismiss}
          onCycle={(id) => {
            setSignalQueue((prev) => {
              const idx = prev.findIndex((s) => s.id === id);
              if (idx === -1) return prev;
              const next = [...prev];
              const [spliced] = next.splice(idx, 1);
              next.push(spliced);
              return next;
            });
          }}
        />
      </View>
    );
  };

  const renderWatchlist = () => {
    // For now, show empty watchlist since we're focusing on portfolio data
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <Pressable
            onPress={() => {
              /* Navigate to search */
            }}
          >
            <Ionicons name="add" size={24} color="#00D4AA" />
          </Pressable>
        </View>
        <Text style={styles.emptyText}>No stocks in watchlist</Text>
      </View>
    );
  };

  // Avoid whole-screen loading: show content skeletons/partials instead

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <PerformanceCard
            history={portfolioHistory as any}
            totalNetWorth={headerMetrics[headerMode].primary}
            netWorthChange={headerMetrics[headerMode].change}
            netWorthChangePercent={headerMetrics[headerMode].changePercent}
            selected={perfPeriod}
            onChange={(p) => setPerfPeriod(p)}
            title={headerMetrics[headerMode].title}
            changeLabel={headerMetrics[headerMode].label}
            onHeaderPress={cycleHeaderMode}
            showCycleHint
            showChangeRow={headerMode !== "cash" && headerMode !== "debt"}
          />
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Top Movers</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Track today's biggest portfolio movers.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.portfolioScroll}
            contentContainerStyle={styles.portfolioScrollContent}
          >
            {movers.length === 0 ? (
              <View style={styles.portfolioCardEmpty}>
                <Text style={styles.portfolioCardEmptyText}>
                  No movers to display yet
                </Text>
              </View>
            ) : (
              movers.map((item) => (
                <LinearGradient
                  key={item.symbol}
                  colors={
                    item.changePct >= 0
                      ? ["rgba(16,185,129,0.16)", "rgba(6,95,70,0.35)"]
                      : ["rgba(248,113,113,0.18)", "rgba(185,28,28,0.35)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.portfolioCard}
                >
                  <View style={styles.portfolioCardHeader}>
                    <Text style={styles.portfolioCardSymbol}>
                      {item.symbol}
                    </Text>
                    <Text
                      style={[
                        styles.portfolioCardChange,
                        item.changePct >= 0 ? styles.positive : styles.negative,
                      ]}
                    >
                      {formatPercent(item.changePct)}
                    </Text>
                  </View>
                  {"quantity" in item && "marketValue" in item ? (
                    <>
                      <Text style={styles.portfolioCardMetric}>
                        {formatCurrency((item as any).marketValue)}
                      </Text>
                      <Text style={styles.portfolioCardMeta}>
                        {(item as any).quantity.toFixed(0)} shares
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.portfolioCardMetric}>
                      {formatCurrency(
                        investmentPositions.find(
                          (pos) => pos.symbol.toUpperCase() === item.symbol
                        )?.marketValue || 0
                      )}
                    </Text>
                  )}
                </LinearGradient>
              ))
            )}
            {quotesLoading && (
              <View style={styles.portfolioCardLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </ScrollView>
        </View>
        {/* News Stack under Top Movers */}
        {renderNewsStack()}
        {/* Focus Today News Stack (replaces Stocks in Play) */}
        {renderFocusToday()}
        {/* Signals Carousel */}
        {renderSignals()}
        {/* Open Signals */}
        <View style={[styles.section, styles.signalsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open Signals</Text>
            <Pressable
              onPress={() => navigation.navigate("SignalsFeed" as never)}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#00D4AA" />
            </Pressable>
          </View>
          <Text style={styles.sectionDescription}>
            Active trading signals generated in the last 24 hours.
          </Text>

          {openSignals.length === 0 ? (
            <View style={styles.signalListPlaceholder}>
              <Text style={styles.emptyText}>
                No open signals right now. Check back soon.
              </Text>
            </View>
          ) : (
            openSignals.slice(0, 5).map((signal) => (
              <View key={`${signal.symbol}-open`} style={styles.signalListItem}>
                <View>
                  <Text style={styles.signalSymbol}>{signal.symbol}</Text>
                  {signal.aiMeta?.strategyChosen ? (
                    <Text style={styles.signalMeta}>
                      {signal.aiMeta.strategyChosen}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.signalConfidence}>
                  {signal.aiMeta?.confidence
                    ? `${Math.round(signal.aiMeta.confidence)}%`
                    : "--"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Closed Signals */}
        <View style={[styles.section, styles.signalsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Closed Signals</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Recently completed signals with final outcomes.
          </Text>

          {closedSignals.length === 0 ? (
            <View style={styles.signalListPlaceholder}>
              <Text style={styles.emptyText}>
                No closed signals yet. Your closed signals will appear here.
              </Text>
            </View>
          ) : (
            closedSignals.slice(0, 5).map((signal) => (
              <View
                key={`${signal.symbol}-closed`}
                style={styles.signalListItem}
              >
                <View>
                  <Text style={styles.signalSymbol}>{signal.symbol}</Text>
                  <Text style={styles.signalMeta}>
                    Closed {new Date(signal.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.signalConfidence}>
                  {signal.aiMeta?.confidence
                    ? `${Math.round(signal.aiMeta.confidence)}%`
                    : "--"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { flex: 1, backgroundColor: theme.colors.background },

    // Mock Data Banner
    mockDataBanner: {
      backgroundColor: theme.mode === "dark" ? "#9A6700" : "#FFF7E6",
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    mockDataText: {
      color: theme.mode === "dark" ? "#FCD34D" : "#9A6700",
      fontSize: 12,
      fontWeight: "600",
    },
    centered: {
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: theme.colors.textSecondary,
      marginTop: 16,
      fontSize: 16,
    },

    // Portfolio Header
    portfolioHeader: {
      backgroundColor: theme.mode === "dark" ? "#1a1a1a" : theme.colors.surface,
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      alignItems: "center",
    },
    portfolioValue: {
      fontSize: 36,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 8,
    },
    portfolioChange: {
      flexDirection: "row",
      alignItems: "center",
    },
    changeText: {
      fontSize: 18,
      fontWeight: "600",
    },
    positive: { color: theme.colors.success },
    negative: { color: theme.colors.error },
    portfolioSubtext: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginTop: 8,
    },

    // Chart
    chartContainer: {
      backgroundColor: theme.mode === "dark" ? "#1a1a1a" : theme.colors.surface,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 20,
    },
    chartPlaceholder: {
      alignItems: "center",
      paddingVertical: 40,
    },
    chartText: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "600",
      marginTop: 12,
    },
    chartSubtext: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },

    // Sections
    section: {
      backgroundColor: "transparent",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 0,
      padding: 0,
    },
    sentimentStrip: {
      marginBottom: 12,
      width: "100%",
      alignItems: "flex-start",
    },
    sentimentPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    pillBull: {
      backgroundColor:
        theme.mode === "dark" ? "rgba(22,163,74,0.2)" : "rgba(34,197,94,0.12)",
    },
    pillBear: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(220,38,38,0.2)"
          : "rgba(248,113,113,0.12)",
    },
    pillNeutral: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(107,114,128,0.2)"
          : "rgba(148,163,184,0.12)",
    },
    pillText: {
      color: theme.colors.text,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 0,
      letterSpacing: 0.2,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    sectionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 0,
      marginBottom: 16,
    },
    sectionHeadingGroup: {
      marginHorizontal: 16,
      marginTop: 28,
      marginBottom: 4,
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "600",
      marginRight: 4,
    },

    // Signals sections
    signalsSection: {
      backgroundColor: "transparent",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 0,
      padding: 0,
    },
    signalListPlaceholder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.04)" : theme.colors.surface,
    },
    signalListItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginHorizontal: 4,
    },
    signalSymbol: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    signalMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    signalConfidence: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      marginLeft: 12,
    },

    // News Stack helper styles
    newsCaughtUpContainer: {
      marginHorizontal: 16,
      marginTop: 8,
      padding: 14,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(148,163,184,0.08)"
          : "rgba(15,23,42,0.05)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    newsCaughtUpText: {
      color: theme.colors.textSecondary,
      fontWeight: "600",
    },
    newsResetButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.08)",
    },
    newsResetText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
    },

    // Market Brief
    briefText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 16,
    },
    marketStats: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
    },
    statLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },

    // Watchlist
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
      paddingVertical: 20,
    },
    watchlistItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    watchlistLeft: {
      flex: 1,
    },
    watchlistSymbol: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    watchlistName: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    watchlistRight: {
      alignItems: "flex-end",
    },
    watchlistPrice: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    watchlistChange: {
      fontSize: 14,
      fontWeight: "500",
      marginTop: 2,
    },
    marketOverviewButton: {
      backgroundColor: theme.mode === "dark" ? "#1a1a1a" : theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    marketOverviewContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    marketOverviewTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    marketOverviewSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },

    // Account Tabs
    accountsSection: {
      backgroundColor: "transparent",
      borderRadius: 0,
      padding: 0,
      marginHorizontal: 16,
      marginTop: 32,
    },
    accountTabsContainer: {
      marginBottom: 16,
      backgroundColor: "transparent",
      borderRadius: 0,
      padding: 0,
    },
    accountTabsContent: {
      paddingHorizontal: 0,
    },
    accountTab: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 6,
      alignItems: "center",
      marginRight: 8,
      minWidth: 100,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    accountTabActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    accountTabText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    accountTabTextActive: {
      color: theme.mode === "dark" ? "#ffffff" : theme.colors.background,
      fontWeight: "600",
    },
    sectionTabsContainer: {
      marginTop: 0,
    },
    sectionTabsContent: {},
    sectionTab: {},
    sectionTabActive: {},
    sectionTabText: {},
    sectionTabTextActive: {},
    portfolioTitle: {
      marginBottom: 6,
    },
    portfolioScroll: {
      marginTop: 0,
    },
    portfolioScrollContent: {
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    portfolioCard: {
      width: width * 0.48,
      minWidth: Math.max(width * 0.48, 180),
      height: 80,
      marginHorizontal: 5,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      justifyContent: "space-between",
    },
    portfolioCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    portfolioCardSymbol: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    portfolioCardChangeWrapper: {
      alignItems: "flex-end",
    },
    portfolioCardChange: { fontSize: 13, fontWeight: "700" },
    portfolioCardMetric: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    portfolioCardMeta: {
      marginTop: 4,
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    portfolioCardLoading: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    portfolioCardEmpty: {
      minWidth: Math.max(width * 0.48, 180),
      height: 128,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 255, 255, 0.04)"
          : theme.colors.surface,
    },
    portfolioCardEmptyText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
    },
    portfolioHeadingRow: {
      marginHorizontal: 16,
      marginTop: 28,
    },
  });
