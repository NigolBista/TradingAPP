import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppDataStore, type PortfolioHistory } from "../store/appDataStore";
import { useNavigation } from "@react-navigation/native";
import MarketOverview from "../components/insights/MarketOverview";
import type { NewsItem } from "../services/newsProviders";
// Removed useMarketOverviewStore to prevent loops - using centralized store instead
import DecalpXMini from "../components/insights/DecalpXMini";
import PerformanceCard from "../components/insights/PerformanceCard";
import TopGainersCard from "../components/insights/TopGainersCard";
import AccountsList from "../components/insights/AccountsList";
import { useTheme, type Theme } from "../providers/ThemeProvider";

const { width } = Dimensions.get("window");

interface DashboardData {
  cachedNews: NewsItem[];
}

export default function DashboardScreen() {
  const navigation = useNavigation();
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

  // Get sentiment from centralized store
  const sentimentSummary = getSentimentSummary();

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    cachedNews: [],
  });

  const [perfPeriod, setPerfPeriod] = useState<
    "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL"
  >("1M");
  const [selectedAccountTab, setSelectedAccountTab] = useState<string>("All");
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentScrollY, setCurrentScrollY] = useState(0);

  // Get data from store
  const portfolioHistory = getPortfolioHistory(perfPeriod);
  const filteredAccounts = getAccountsByCategory(selectedAccountTab);
  const accountTabs = getAccountCategories();

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

  const handleAccountTabChange = (tab: string) => {
    // Store current scroll position
    const currentY = currentScrollY;

    // Change the tab
    setSelectedAccountTab(tab);

    // Restore scroll position after a brief delay to allow content to update
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: currentY, animated: false });
    }, 50);
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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const renderPortfolioHeader = () => {
    const totalValue = portfolioSummary.totalValue;
    const totalGainLoss = portfolioSummary.totalGainLoss;
    const totalGainLossPercent = portfolioSummary.totalGainLossPercent;
    const connectedAccounts = portfolioSummary.connectedAccounts;
    const isPositive = totalGainLoss >= 0;

    return (
      <View style={styles.portfolioHeader}>
        <Text style={styles.portfolioValue}>{formatCurrency(totalValue)}</Text>
        <View style={styles.portfolioChange}>
          <Text
            style={[
              styles.changeText,
              isPositive ? styles.positive : styles.negative,
            ]}
          >
            {formatCurrency(totalGainLoss)} (
            {formatPercent(totalGainLossPercent)})
          </Text>
        </View>
        <Text style={styles.portfolioSubtext}>
          {connectedAccounts} account(s) connected
        </Text>
      </View>
    );
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
        onScroll={(event) => {
          setCurrentScrollY(event.nativeEvent.contentOffset.y);
        }}
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
            totalNetWorth={portfolioSummary.totalValue}
            netWorthChange={portfolioSummary.dayChange}
            netWorthChangePercent={portfolioSummary.dayChangePercent}
            selected={perfPeriod}
            onChange={(p) => setPerfPeriod(p)}
          />
        </View>
        {/* Top Gainers from Portfolio */}
        {positions && positions.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 56 }}>
            <TopGainersCard
              positions={positions.map((pos) => ({
                symbol: pos.symbol,
                name: pos.name,
                quantity: pos.quantity,
                currentPrice: pos.currentPrice,
                costBasis: pos.averageCost * pos.quantity,
                marketValue: pos.marketValue,
                unrealizedPnL: pos.unrealizedPnL,
                unrealizedPnLPercent: pos.unrealizedPnLPercent,
                provider: pos.provider,
              }))}
              onPositionPress={(position) => {
                (navigation as any).navigate("StockDetail", {
                  symbol: position.symbol,
                });
              }}
            />
          </View>
        )}

        {/* Accounts */}
        <View style={styles.accountsSection}>
          <Text style={styles.sectionTitle}>Accounts</Text>

          {/* Account Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.accountTabsContainer}
            contentContainerStyle={styles.accountTabsContent}
          >
            {accountTabs.map((tab) => (
              <Pressable
                key={tab}
                style={[
                  styles.accountTab,
                  selectedAccountTab === tab && styles.accountTabActive,
                ]}
                onPress={() => handleAccountTabChange(tab)}
              >
                <Text
                  style={[
                    styles.accountTabText,
                    selectedAccountTab === tab && styles.accountTabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <AccountsList
            accounts={filteredAccounts}
            onAccountPress={(account) => {
              (navigation as any).navigate("BrokerageAccounts");
            }}
            onAddAccountPress={() => {
              (navigation as any).navigate("BrokerageAccounts");
            }}
          />
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
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 14,
      letterSpacing: 0.2,
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
      marginTop: 44,
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
  });
