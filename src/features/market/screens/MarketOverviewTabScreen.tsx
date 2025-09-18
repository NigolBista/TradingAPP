import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import MarketOverview from "../components/insights/MarketOverview";
import UpcomingEarningsCard from "../components/insights/UpcomingEarningsCard";
import ETFStrip from "../components/insights/ETFStrip";
import DecalpXMini from "../components/insights/DecalpXMini";
import { MarketScanner, type ScanResult } from "../services/marketScanner";
import {
  generateSignalSummary,
  type SignalSummary,
} from "../services/signalEngine";
import { useUserStore } from "../store/userStore";
import { useAppDataStore } from "../store/appDataStore";
import { useTheme } from "../providers/ThemeProvider";

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 4,
      marginHorizontal: 16, // Match content boxes: 16 + 8 = 24
      marginTop: 16, // Add proper top margin for spacing between header and tabs
      marginBottom: 16, // Add proper margin for spacing
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      alignItems: "center",
    },
    activeTab: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    activeTabText: {
      color: theme.isDark ? "#ffffff" : "#000000",
      fontWeight: "600",
    },
    content: {
      flex: 1,
      paddingTop: 0, // Remove any top padding
    },
    marketContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 0, // Remove top padding to eliminate gap
    },
    decalpxContainer: {
      marginBottom: 16,
    },
    // Signals styles
    section: {
      backgroundColor: "transparent",
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
      flexWrap: "wrap",
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: "transparent",
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: "500",
    },
    filterChipTextActive: {
      color: theme.isDark ? "#ffffff" : "#000000",
    },
    signalCard: {
      backgroundColor: "transparent",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    signalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    signalSymbol: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    confidenceBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    confidenceText: {
      color: theme.isDark ? "#ffffff" : "#000000",
      fontSize: 12,
      fontWeight: "600",
    },
    signalAction: {
      fontSize: 14,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    buyAction: {
      color: theme.colors.success,
    },
    sellAction: {
      color: theme.colors.error,
    },
    signalType: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    signalDetails: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    strategyModal: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      width: "90%",
      maxHeight: "80%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.text },
    strategyItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    strategyName: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
    strategyDesc: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
  });

type TabType = "Market" | "Signals";

const STRATEGY_FILTERS = [
  { id: "all", label: "All Signals", description: "Show all trading signals" },
  {
    id: "intraday",
    label: "Day Trading",
    description: "Short-term intraday signals",
  },
  {
    id: "swing",
    label: "Swing Trading",
    description: "Multi-day position trades",
  },
  {
    id: "longterm",
    label: "Long-term",
    description: "Investment-horizon signals",
  },
  {
    id: "breakout",
    label: "Breakouts",
    description: "Momentum breakout patterns",
  },
  {
    id: "dip_buy",
    label: "Dip Buying",
    description: "Mean reversion oversold bounces",
  },
  {
    id: "trend_follow",
    label: "Trend Following",
    description: "Riding established trends",
  },
];

export default function MarketOverviewTabScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const profile = useUserStore((s) => s.profile);
  const [activeTab, setActiveTab] = useState<TabType>("Market");
  const insets = useSafeAreaInsets();

  // Use centralized store for market data
  const { refresh, isRefreshing } = useAppDataStore();

  const styles = createStyles(theme);

  // Signals state
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<SignalSummary[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState("all");
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  useEffect(() => {
    if (activeTab === "Signals") {
      loadSignals();
    }
  }, [selectedStrategy, activeTab]);

  const handleNewsPress = () => {
    // Navigate to the News tab (unified route name)
    navigation.navigate("News" as never);
  };

  async function loadSignals() {
    try {
      setLoading(true);

      // Get all favorite and watchlist symbols
      const favoriteSymbols = new Set<string>();

      // Add global favorites
      profile.favorites.forEach((symbol) => favoriteSymbols.add(symbol));

      // Add all watchlist items
      profile.watchlists.forEach((watchlist) => {
        watchlist.items.forEach((item) => favoriteSymbols.add(item.symbol));
      });

      // Convert to array
      const symbolsToAnalyze = Array.from(favoriteSymbols);

      if (symbolsToAnalyze.length === 0) {
        setSignals([]);
        return;
      }

      // Generate signal summaries for favorite stocks only
      const summaries = await Promise.all(
        symbolsToAnalyze.map((symbol) =>
          generateSignalSummary(
            symbol,
            profile.accountSize,
            profile.riskPerTradePct
          )
        )
      );

      // Filter based on strategy and confidence
      const filtered = summaries
        .filter((s): s is SignalSummary => !!s && !!s.topSignal)
        .filter((s) => {
          const signal = s.topSignal!;

          // Apply strategy filter
          const strategyMatch = applyStrategyFilter(signal, selectedStrategy);
          if (!strategyMatch) return false;

          // Apply confidence threshold
          return signal.confidence >= (profile.signalConfidenceThreshold || 60);
        })
        .sort(
          (a, b) =>
            (b.topSignal?.confidence || 0) - (a.topSignal?.confidence || 0)
        );

      setSignals(filtered);
    } catch (error) {
      console.error("Error loading signals:", error);
    } finally {
      setLoading(false);
    }
  }

  function applyStrategyFilter(signal: any, strategy: string): boolean {
    switch (strategy) {
      case "intraday":
        return signal.type === "intraday";
      case "swing":
        return signal.type === "swing";
      case "longterm":
        return signal.type === "longterm";
      case "breakout":
        return (
          signal.type === "breakout" || signal.patterns?.includes("breakout")
        );
      case "dip_buy":
        return (
          signal.type === "dip_buy" || signal.patterns?.includes("oversold")
        );
      case "trend_follow":
        return (
          signal.type === "trend_follow" || signal.patterns?.includes("trend")
        );
      case "all":
      default:
        return true; // Show all signals
    }
  }

  function getFilterForStrategy(strategy: string) {
    switch (strategy) {
      case "intraday":
        return { signalTypes: ["intraday" as const], minConfidence: 65 };
      case "swing":
        return { signalTypes: ["swing" as const], minConfidence: 60 };
      case "longterm":
        return { signalTypes: ["longterm" as const], minConfidence: 55 };
      case "breakout":
        return { volumeRatioMin: 1.5, minConfidence: 70 };
      case "dip_buy":
        return { rsiMax: 35, volumeRatioMin: 1.2, minConfidence: 60 };
      case "trend_follow":
        return { trendDirection: "uptrend" as const, minConfidence: 65 };
      default:
        return { minConfidence: 60 };
    }
  }

  async function onRefresh() {
    if (activeTab === "Market") {
      // Refresh market data from centralized store
      await refresh();
    } else {
      // Refresh signals data
      await loadSignals();
    }
  }

  function renderSignal(summary: SignalSummary) {
    const signal = summary.topSignal!;

    return (
      <Pressable
        key={summary.symbol}
        style={styles.signalCard}
        onPress={() =>
          (navigation as any).navigate("StockDetail", {
            symbol: summary.symbol,
          })
        }
      >
        <View style={styles.signalHeader}>
          <Text style={styles.signalSymbol}>{summary.symbol}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {signal.confidence.toFixed(0)}%
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={[
              styles.signalAction,
              signal.action === "buy" ? styles.buyAction : styles.sellAction,
            ]}
          >
            {signal.action}
          </Text>
          <Text style={styles.signalType}>
            {signal.type.toUpperCase()} • R/R {signal.riskReward}:1
          </Text>
        </View>

        <Text style={styles.signalDetails}>
          Entry ${signal.entry.toFixed(2)} • Stop ${signal.stopLoss.toFixed(2)}{" "}
          • Targets {signal.targets.map((t) => t.toFixed(2)).join(", ")}
        </Text>

        <Text style={[styles.signalDetails, { marginTop: 4 }]}>
          Size {signal.tradePlan.positionSize} • Risk $
          {(signal.tradePlan as any).maxRiskAmount?.toFixed(0) || "N/A"}
        </Text>
      </Pressable>
    );
  }

  const renderSignalsContent = () => {
    if (loading && signals.length === 0) {
      const favoriteCount = Array.from(
        new Set([
          ...profile.favorites,
          ...profile.watchlists.flatMap((w) => w.items.map((i) => i.symbol)),
        ])
      ).length;

      return (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 16 }}>
            {favoriteCount > 0
              ? `Analyzing signals for ${favoriteCount} favorite stocks...`
              : "Loading AI signals..."}
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* Strategy Filters */}
        <View style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Strategy Filter
            </Text>
            <Pressable
              style={{ padding: 8 }}
              onPress={() => setShowStrategyModal(true)}
            >
              <Ionicons name="options" size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {STRATEGY_FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterChip,
                    selectedStrategy === filter.id && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedStrategy(filter.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStrategy === filter.id &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Signals List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={activeTab === "Market" ? isRefreshing : loading}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {signals.length === 0 ? (
            <View style={{ alignItems: "center", padding: 32 }}>
              <Ionicons
                name="radio-outline"
                size={48}
                color={theme.colors.textSecondary}
              />
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                {Array.from(
                  new Set([
                    ...profile.favorites,
                    ...profile.watchlists.flatMap((w) =>
                      w.items.map((i) => i.symbol)
                    ),
                  ])
                ).length === 0
                  ? "Add stocks to your watchlist or favorites to see signals here."
                  : "No signals found for your favorite stocks with the current filter. Try adjusting the strategy or check back later."}
              </Text>
            </View>
          ) : (
            signals.map(renderSignal)
          )}
        </ScrollView>
      </>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Market":
        return (
          <ScrollView
            style={styles.marketContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ETF Overview */}
            <View style={{ marginBottom: 16 }}>
              <ETFStrip compact={true} />
            </View>

            {/* Market Overview */}
            <MarketOverview
              onNewsPress={handleNewsPress}
              navigation={navigation}
              fullWidth={true}
              compact={false}
            />
          </ScrollView>
        );
      case "Signals":
        return renderSignalsContent();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Overview</Text>
        <Text style={styles.headerSubtitle}>AI Powered Market Analysis</Text>
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  );
}
