import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScanResult } from "../services/marketScanner";
import { useAnalysisStore } from "../store/analysisStore";
import { useUserStore } from "../store/userStore";
import { formatDistanceToNow } from "date-fns";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#888888",
    fontSize: 14,
  },
  headerMeta: {
    color: "#666666",
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  stockLeft: {
    flex: 1,
  },
  stockSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  stockMetrics: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  stockRight: {
    alignItems: "flex-end",
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  stockChange: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  positiveChange: {
    color: "#00D4AA",
  },
  negativeChange: {
    color: "#FF5722",
  },
  alertBadge: {
    backgroundColor: "#FF5722",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  overviewCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: (width - 64) / 2 - 4,
  },
  overviewTitle: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  overviewSubvalue: {
    fontSize: 10,
    color: "#888888",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 32,
  },
  loadingText: {
    color: "#888888",
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: "#00D4AA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  quotaBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00D4AA",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quotaBannerText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 12,
    marginLeft: 8,
  },
  cacheRibbon: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#222222",
  },
  cacheRibbonTitle: {
    color: "#888888",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cacheEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  cacheEntryTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  cacheEntryMeta: {
    color: "#777777",
    fontSize: 12,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "#F97316",
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorBannerText: {
    color: "#F97316",
    marginLeft: 8,
    fontSize: 12,
    flex: 1,
  },
});

export default function MarketScreenerScreen() {
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);

  const {
    data,
    loading,
    error,
    lastUpdated,
    loadInitialQuota,
    loadMarketAnalysis,
    runsUsedToday,
    remainingRunsToday,
    plan,
    cachedEntries,
    useCachedScreener,
    fromCache,
    lastSymbols,
  } = useAnalysisStore();
  const cacheEntries = useMemo(() => {
    return Object.values(cachedEntries)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [cachedEntries]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "Never";
    try {
      return formatDistanceToNow(new Date(lastUpdated), { addSuffix: true });
    } catch (error) {
      return new Date(lastUpdated).toLocaleTimeString();
    }
  }, [lastUpdated]);

  const remainingRunsLabel = useMemo(() => {
    if (remainingRunsToday === null) return "Unlimited";
    return `${remainingRunsToday} remaining`;
  }, [remainingRunsToday]);

  const quotaBannerLabel = useMemo(() => {
    if (plan === "Free") {
      return remainingRunsToday === 0
        ? "Daily limit reached. Upgrade for unlimited market coverage."
        : `Free plan · ${remainingRunsLabel}`;
    }
    if (plan === "Pro") {
      return `Pro plan · ${remainingRunsLabel}`;
    }
    return "Elite plan · Unlimited runs";
  }, [plan, remainingRunsLabel, remainingRunsToday]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInitialQuota();
  }, [loadInitialQuota]);

  const loadFavoritesAnalysis = useCallback(
    (force = false) => loadMarketAnalysis({ scope: "favorites", force }),
    [loadMarketAnalysis]
  );

  useEffect(() => {
    loadFavoritesAnalysis();
  }, [loadFavoritesAnalysis]);

  useEffect(() => {
    if (!profile.lastAnalysisViewedAt) {
      try {
        const now = new Date().toISOString();
        setProfile({ lastAnalysisViewedAt: now });
      } catch (e) {
        console.warn("Failed to set last analysis viewed timestamp", e);
      }
    }
  }, [profile.lastAnalysisViewedAt, setProfile]);

  async function onRefresh() {
    setRefreshing(true);
    await loadFavoritesAnalysis(true);
    setRefreshing(false);
  }

  function renderQuotaBanner() {
    return (
      <View style={styles.quotaBanner}>
        <Ionicons name="flash" size={16} color="#000000" />
        <Text style={styles.quotaBannerText}>{quotaBannerLabel}</Text>
      </View>
    );
  }

  function renderCacheRibbon() {
    if (!cacheEntries.length) return null;

    return (
      <View style={styles.cacheRibbon}>
        <Text style={styles.cacheRibbonTitle}>Recent Analyses</Text>
        {cacheEntries.map((entry) => (
          <Pressable
            key={entry.key}
            style={styles.cacheEntry}
            onPress={() => useCachedScreener(entry.key)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cacheEntryTitle}>
                {entry.key.includes("favorites") ? "Favorites" : "Custom"}
              </Text>
              <Text style={styles.cacheEntryMeta}>
                {formatDistanceToNow(new Date(entry.timestamp), {
                  addSuffix: true,
                })}
                {entry.fromCache ? " • cached" : ""}
              </Text>
            </View>
            <Ionicons name="download" size={16} color="#00D4AA" />
          </Pressable>
        ))}
      </View>
    );
  }

  function renderStockList(
    stocks: ScanResult[],
    title: string,
    icon: string,
    color: string,
    showAlert = false
  ) {
    if (!stocks || stocks.length === 0) {
      return (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.sectionIcon, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={14} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionSubtitle}>No data available</Text>
              </View>
            </View>
          </View>

          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={32} color="#888888" />
            <Text style={styles.emptyStateText}>
              No stocks match the criteria for {title.toLowerCase()}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.sectionIcon, { backgroundColor: color }]}>
              <Ionicons name={icon as any} size={14} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionSubtitle}>
                {stocks.length} stocks found
              </Text>
            </View>
          </View>
        </View>

        {stocks.slice(0, 5).map((result, index) => {
          const { symbol, analysis, alerts, score } = result;
          const currentPrice = analysis.currentPrice;
          const change = currentPrice * 0.02 * (Math.random() - 0.5); // Mock change
          const changePercent = (change / currentPrice) * 100;
          const isPositive = change >= 0;

          return (
            <View key={`${symbol}-${index}`} style={styles.stockRow}>
              <View style={styles.stockLeft}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.stockSymbol}>{symbol}</Text>
                  {showAlert && alerts.length > 0 && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertBadgeText}>{alerts.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.stockMetrics}>
                  RSI: {analysis.indicators.rsi.toFixed(0)} • Vol:{" "}
                  {analysis.indicators.volume.ratio.toFixed(1)}x • Score:{" "}
                  {score.toFixed(0)}
                </Text>
              </View>

              <View style={styles.stockRight}>
                <Text style={styles.stockPrice}>
                  ${currentPrice.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.stockChange,
                    isPositive ? styles.positiveChange : styles.negativeChange,
                  ]}
                >
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Market Screener</Text>
          <Text style={styles.headerSubtitle}>Loading market data...</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Scanning markets...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={styles.headerTitle}>Market Screener</Text>
            <Text style={styles.headerSubtitle}>
              {lastUpdated
                ? `${
                    fromCache ? "Showing cached analysis" : "Last run"
                  } · ${lastUpdatedLabel}`
                : "Run the analysis to get insights"}
            </Text>
            <Text style={styles.headerMeta}>
              {plan} plan • Used {runsUsedToday}{" "}
              {remainingRunsToday !== null
                ? `of ${runsUsedToday + remainingRunsToday}`
                : "runs"}{" "}
              • {remainingRunsLabel}
            </Text>
            <Text style={styles.headerMeta}>
              Symbols scanned: {lastSymbols.length}
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={16} color="#000000" />
            <Text style={styles.refreshButtonText}>
              {refreshing ? "Updating..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      {renderQuotaBanner()}
      {renderCacheRibbon()}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
          />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#F97316" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Market Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[styles.sectionIcon, { backgroundColor: "#6366f1" }]}
              >
                <Ionicons name="stats-chart" size={14} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Market Overview</Text>
                <Text style={styles.sectionSubtitle}>
                  {plan === "Free" && data?.topGainers?.length
                    ? "Analyzing your favorites · Upgrade for full market coverage"
                    : plan === "Free"
                    ? "Add favorites to run analysis"
                    : "Key market statistics"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Top Gainers</Text>
              <Text style={styles.overviewValue}>
                {data?.topGainers?.length || 0}
              </Text>
              <Text style={styles.overviewSubvalue}>Strong performers</Text>
            </View>

            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>High Volume</Text>
              <Text style={styles.overviewValue}>
                {data?.highVolume?.length || 0}
              </Text>
              <Text style={styles.overviewSubvalue}>Active trading</Text>
            </View>

            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Breakouts</Text>
              <Text style={styles.overviewValue}>
                {data?.breakouts?.length || 0}
              </Text>
              <Text style={styles.overviewSubvalue}>Technical patterns</Text>
            </View>

            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Signal Alerts</Text>
              <Text style={styles.overviewValue}>
                {data?.signalAlerts?.length || 0}
              </Text>
              <Text style={styles.overviewSubvalue}>AI recommendations</Text>
            </View>
          </View>
        </View>

        {/* Top Gainers */}
        {renderStockList(
          data?.topGainers || [],
          "Top Gainers",
          "trending-up",
          "#00D4AA"
        )}

        {/* High Volume */}
        {renderStockList(
          data?.highVolume || [],
          "High Volume",
          "pulse",
          "#3B82F6"
        )}

        {/* Breakouts */}
        {renderStockList(
          data?.breakouts || [],
          "Breakouts",
          "arrow-up-circle",
          "#8B5CF6"
        )}

        {/* Oversold Opportunities */}
        {renderStockList(
          data?.oversold || [],
          "Oversold Opportunities",
          "arrow-down-circle",
          "#10B981"
        )}

        {/* Signal Alerts */}
        {renderStockList(
          data?.signalAlerts || [],
          "AI Signal Alerts",
          "notifications",
          "#F59E0B",
          true
        )}

        {/* Top Losers */}
        {renderStockList(
          data?.topLosers || [],
          "Top Losers",
          "trending-down",
          "#EF4444"
        )}

        {/* Overbought Stocks */}
        {renderStockList(
          data?.overbought || [],
          "Overbought Stocks",
          "warning",
          "#F97316"
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
