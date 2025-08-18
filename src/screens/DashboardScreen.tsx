import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  portfolioAggregationService,
  type PortfolioSummary,
} from "../services/portfolioAggregationService";
import {
  brokerageApiService,
  type BrokerageWatchlistItem,
} from "../services/brokerageApiService";
import { brokerageAuthService } from "../services/brokerageAuth";
import { useNavigation } from "@react-navigation/native";
import SimpleLineChart from "../components/charts/SimpleLineChart";
import MarketOverview from "../components/insights/MarketOverview";
import type { NewsItem } from "../services/newsProviders";

const { width } = Dimensions.get("window");

interface DashboardState {
  portfolio: PortfolioSummary | null;
  watchlist: BrokerageWatchlistItem[];
  loading: boolean;
  refreshing: boolean;
}

interface DashboardData {
  cachedNews: NewsItem[];
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [state, setState] = useState<DashboardState>({
    portfolio: null,
    watchlist: [],
    loading: true,
    refreshing: false,
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    cachedNews: [],
  });

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

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setState((prev) => ({ ...prev, refreshing: true }));
    } else {
      setState((prev) => ({ ...prev, loading: true }));
    }

    try {
      const [portfolioData, watchlistData] = await Promise.all([
        portfolioAggregationService.getPortfolioSummary(),
        portfolioAggregationService.getConsolidatedWatchlist(),
      ]);

      setState((prev) => ({
        ...prev,
        portfolio: portfolioData,
        watchlist: watchlistData,
        loading: false,
        refreshing: false,
      }));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
      }));
    }
  };

  useEffect(() => {
    loadData();
    const main = generateDummySeries();
    setDummySeries(main);
    const bench = main.map((d, i) => ({
      time: d.time,
      close: d.close * (0.985 + 0.00025 * i),
    }));
    setBenchmarkSeries(bench);
  }, []);

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      const result = await portfolioAggregationService.addToAllWatchlists(
        symbol
      );
      if (result.success) {
        Alert.alert("Success", `${symbol} added to watchlist`);
        loadData(true);
      } else {
        Alert.alert("Partial Success", `${symbol} added to some accounts`);
      }
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
    const hasReal = !!state.portfolio && (state.portfolio!.totalValue || 0) > 0;
    // Derive fallback values from dummy series so direction matches the chart
    const first = dummySeries[0]?.close ?? 0;
    const last = dummySeries[dummySeries.length - 1]?.close ?? 0;
    const fallbackValue = last || 1205340.12;
    const fallbackChange = first > 0 ? last - first : 0;
    const fallbackPct = first > 0 ? (fallbackChange / first) * 100 : 0;

    const totalValue = hasReal ? state.portfolio!.totalValue : fallbackValue;
    const totalGainLoss = hasReal
      ? state.portfolio!.totalGainLoss
      : fallbackChange;
    const totalGainLossPercent = hasReal
      ? state.portfolio!.totalGainLossPercent
      : fallbackPct;
    const accounts = hasReal ? state.portfolio!.providersConnected.length : 0;
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
          {accounts} account(s) connected
        </Text>
        {/* Inline chart like Robinhood (no separation) */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <SimpleLineChart
            data={dummySeries}
            height={220}
            color={isPositive ? "#00D4AA" : "#FF6B6B"}
            strokeWidth={2}
            showFill={false}
          />
        </View>
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
        <MarketOverview
          compact={true}
          onNewsPress={() => navigation.navigate("News" as never)}
          onNewsDataFetched={handleNewsDataFetched}
          navigation={navigation}
        />
      </View>
    );
  };

  const renderWatchlist = () => {
    if (state.watchlist.length === 0) {
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
    }

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
        {state.watchlist.map((item, index) => (
          <View key={index} style={styles.watchlistItem}>
            <View style={styles.watchlistLeft}>
              <Text style={styles.watchlistSymbol}>{item.symbol}</Text>
              <Text style={styles.watchlistName}>{item.name}</Text>
            </View>
            <View style={styles.watchlistRight}>
              <Text style={styles.watchlistPrice}>
                {formatCurrency(item.price)}
              </Text>
              <Text
                style={[
                  styles.watchlistChange,
                  item.changePercent >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {formatPercent(item.changePercent)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (state.loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00D4AA" />
        <Text style={styles.loadingText}>Loading your portfolio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#00D4AA"
          />
        }
      >
        {renderPortfolioHeader()}
        {renderMarketBrief()}
        {renderWatchlist()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#888888", marginTop: 16, fontSize: 16 },

  // Portfolio Header
  portfolioHeader: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: "center",
  },
  portfolioValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
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
  positive: { color: "#00D4AA" },
  negative: { color: "#FF5722" },
  portfolioSubtext: {
    color: "#888888",
    fontSize: 14,
    marginTop: 8,
  },

  // Chart
  chartContainer: {
    backgroundColor: "#1a1a1a",
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
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  chartSubtext: {
    color: "#888888",
    fontSize: 14,
    marginTop: 4,
  },

  // Sections
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#ffffff" },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    color: "#00D4AA",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },

  // Market Brief
  briefText: {
    color: "#cccccc",
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
    color: "#888888",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Watchlist
  emptyText: {
    color: "#888888",
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
    borderBottomColor: "#2a2a2a",
  },
  watchlistLeft: {
    flex: 1,
  },
  watchlistSymbol: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  watchlistName: {
    color: "#888888",
    fontSize: 14,
    marginTop: 2,
  },
  watchlistRight: {
    alignItems: "flex-end",
  },
  watchlistPrice: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  watchlistChange: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
});
