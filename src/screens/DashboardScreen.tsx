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

const { width } = Dimensions.get("window");

interface DashboardState {
  portfolio: PortfolioSummary | null;
  watchlist: BrokerageWatchlistItem[];
  loading: boolean;
  refreshing: boolean;
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [state, setState] = useState<DashboardState>({
    portfolio: null,
    watchlist: [],
    loading: true,
    refreshing: false,
  });

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
    if (!state.portfolio) return null;

    const { totalValue, totalGainLoss, totalGainLossPercent } = state.portfolio;
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
          {state.portfolio.providersConnected.length} account(s) connected
        </Text>
      </View>
    );
  };

  const renderPortfolioChart = () => {
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartPlaceholder}>
          <Ionicons name="trending-up" size={40} color="#00D4AA" />
          <Text style={styles.chartText}>Portfolio Chart</Text>
          <Text style={styles.chartSubtext}>Coming Soon</Text>
        </View>
      </View>
    );
  };

  const renderMarketBrief = () => {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Brief</Text>
        </View>
        <Text style={styles.briefText}>
          Markets are showing mixed signals today. Stay informed with your
          portfolio performance above.
        </Text>
        <View style={styles.marketStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>S&P 500</Text>
            <Text style={[styles.statValue, styles.positive]}>+0.45%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>NASDAQ</Text>
            <Text style={[styles.statValue, styles.positive]}>+0.82%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DOW</Text>
            <Text style={[styles.statValue, styles.negative]}>-0.23%</Text>
          </View>
        </View>
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
        {renderPortfolioChart()}
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
