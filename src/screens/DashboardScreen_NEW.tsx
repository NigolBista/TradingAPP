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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchCandles } from "../services/marketProviders";
import {
  performComprehensiveAnalysis,
  type MarketAnalysis,
} from "../services/aiAnalytics";
import { useUserStore, type Watchlist } from "../store/userStore";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  headerSubtitle: { color: "#888888", fontSize: 14, marginTop: 4 },
  content: { flex: 1 },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#ffffff" },

  // Market brief
  briefText: {
    color: "#cccccc",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  // Indices grid
  analysisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  analysisCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    minWidth: (width - 64) / 4,
    alignItems: "center",
  },
  analysisTitle: { fontSize: 10, color: "#888888", fontWeight: "500" },
  analysisValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 2,
  },
  analysisSubvalue: { fontSize: 10, fontWeight: "500", marginTop: 2 },

  // Watchlist cards
  watchlistCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  watchlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  watchlistName: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
  watchlistValue: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  watchlistChange: { fontSize: 14, fontWeight: "500" },
  positiveChange: { color: "#00D4AA" },
  negativeChange: { color: "#FF5722" },

  watchlistMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  metricItem: { alignItems: "center" },
  metricLabel: { fontSize: 12, color: "#888888", marginBottom: 4 },
  metricValue: { fontSize: 14, fontWeight: "600", color: "#ffffff" },

  watchlistColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

interface WatchlistAnalytics {
  watchlist: Watchlist;
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  topPerformer: string;
  bottomPerformer: string;
  signalsCount: number;
  favoritesCount: number;
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketBrief, setMarketBrief] = useState<string>("");
  const [indices, setIndices] = useState<any[]>([]);
  const [watchlistAnalytics, setWatchlistAnalytics] = useState<
    WatchlistAnalytics[]
  >([]);
  const { profile, setActiveWatchlist } = useUserStore();

  useEffect(() => {
    loadData();
  }, [profile.watchlists]);

  async function loadData() {
    try {
      setLoading(true);
      await Promise.all([loadWatchlistAnalytics(), loadMarketBrief()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadWatchlistAnalytics() {
    try {
      const analytics: WatchlistAnalytics[] = [];

      for (const watchlist of profile.watchlists) {
        if (watchlist.items.length === 0) {
          analytics.push({
            watchlist,
            totalValue: 0,
            dailyChange: 0,
            dailyChangePercent: 0,
            topPerformer: "",
            bottomPerformer: "",
            signalsCount: 0,
            favoritesCount: watchlist.items.filter((item) => item.isFavorite)
              .length,
          });
          continue;
        }

        let totalValue = 0;
        let totalChange = 0;
        let signalsCount = 0;
        let topPerformerChange = -Infinity;
        let bottomPerformerChange = Infinity;
        let topPerformer = "";
        let bottomPerformer = "";

        for (const item of watchlist.items) {
          try {
            const candles = await fetchCandles(item.symbol, {
              resolution: "D",
            });
            if (candles.length >= 2) {
              const currentPrice = candles[candles.length - 1].close;
              const previousPrice = candles[candles.length - 2].close;
              const change = currentPrice - previousPrice;
              const changePercent = (change / previousPrice) * 100;

              totalValue += currentPrice;
              totalChange += change;

              if (changePercent > topPerformerChange) {
                topPerformerChange = changePercent;
                topPerformer = item.symbol;
              }
              if (changePercent < bottomPerformerChange) {
                bottomPerformerChange = changePercent;
                bottomPerformer = item.symbol;
              }

              // Get signals count
              const analysis = await performComprehensiveAnalysis(item.symbol, {
                "1d": candles,
              });
              signalsCount += analysis.signals.length;
            }
          } catch (error) {
            console.error(`Error loading ${item.symbol}:`, error);
          }
        }

        const dailyChangePercent =
          totalValue > 0 ? (totalChange / totalValue) * 100 : 0;

        analytics.push({
          watchlist,
          totalValue,
          dailyChange: totalChange,
          dailyChangePercent,
          topPerformer,
          bottomPerformer,
          signalsCount,
          favoritesCount: watchlist.items.filter((item) => item.isFavorite)
            .length,
        });
      }

      setWatchlistAnalytics(analytics);
    } catch (error) {
      console.error("Error loading watchlist analytics:", error);
    }
  }

  async function loadMarketBrief() {
    try {
      // Load major indices
      const indexSymbols = ["SPY", "QQQ", "IWM"];
      const indexData = await Promise.all(
        indexSymbols.map(async (sym) => {
          try {
            const candles = await fetchCandles(sym, { resolution: "D" });
            const price = candles[candles.length - 1]?.close || 0;
            const prevPrice = candles[candles.length - 2]?.close || price;
            const change = ((price - prevPrice) / prevPrice) * 100;
            return { symbol: sym, price, change };
          } catch {
            return { symbol: sym, price: 0, change: 0 };
          }
        })
      );
      setIndices(indexData);

      // Generate AI brief
      const hour = new Date().getHours();
      const timeOfDay =
        hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      const spyChange = indexData[0]?.change || 0;
      const marketDirection =
        spyChange > 0.5 ? "rallying" : spyChange < -0.5 ? "declining" : "mixed";

      const totalWatchlists = profile.watchlists.length;
      const totalStocks = profile.watchlists.reduce(
        (sum, w) => sum + w.items.length,
        0
      );

      const brief = `Good ${timeOfDay}! Markets are ${marketDirection} with the S&P 500 ${
        spyChange > 0 ? "up" : "down"
      } ${Math.abs(spyChange).toFixed(1)}%. ${
        Math.abs(spyChange) > 1 ? "Significant moves today - " : ""
      }You're tracking ${totalStocks} stocks across ${totalWatchlists} watchlists.`;

      setMarketBrief(brief);
    } catch (error) {
      console.error("Error loading market brief:", error);
      setMarketBrief(
        "Welcome back! Monitor your watchlists for today's opportunities."
      );
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  function handleWatchlistPress(watchlistId: string) {
    setActiveWatchlist(watchlistId);
    (navigation as any).navigate("Watchlist");
  }

  if (loading && watchlistAnalytics.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Loading market analysis...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          AI-Powered Watchlist Analytics • Live Data
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Market Brief */}
        {marketBrief && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Market Brief</Text>
              <Pressable
                onPress={() => (navigation as any).navigate("News")}
                style={{ padding: 4 }}
              >
                <Ionicons name="newspaper" size={20} color="#00D4AA" />
              </Pressable>
            </View>
            <Text style={styles.briefText}>{marketBrief}</Text>

            {/* Indices Overview */}
            <View style={styles.analysisGrid}>
              {indices.map((index) => (
                <View key={index.symbol} style={styles.analysisCard}>
                  <Text style={styles.analysisTitle}>{index.symbol}</Text>
                  <Text style={styles.analysisValue}>
                    ${index.price.toFixed(0)}
                  </Text>
                  <Text
                    style={[
                      styles.analysisSubvalue,
                      { color: index.change >= 0 ? "#00D4AA" : "#FF5722" },
                    ]}
                  >
                    {index.change >= 0 ? "+" : ""}
                    {index.change.toFixed(2)}%
                  </Text>
                </View>
              ))}
              <Pressable
                style={[
                  styles.analysisCard,
                  { justifyContent: "center", alignItems: "center" },
                ]}
                onPress={() => (navigation as any).navigate("Journey")}
              >
                <Ionicons name="school" size={20} color="#00D4AA" />
                <Text
                  style={[styles.analysisTitle, { fontSize: 10, marginTop: 4 }]}
                >
                  Learn
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Watchlists Analytics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Watchlists</Text>
            <Pressable
              onPress={() => (navigation as any).navigate("Watchlist")}
              style={{ padding: 4 }}
            >
              <Ionicons name="list" size={20} color="#00D4AA" />
            </Pressable>
          </View>

          {watchlistAnalytics.map((analytics) => (
            <Pressable
              key={analytics.watchlist.id}
              style={styles.watchlistCard}
              onPress={() => handleWatchlistPress(analytics.watchlist.id)}
            >
              <View style={styles.watchlistHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <View
                    style={[
                      styles.watchlistColor,
                      { backgroundColor: analytics.watchlist.color },
                    ]}
                  />
                  <View>
                    <Text style={styles.watchlistName}>
                      {analytics.watchlist.name}
                    </Text>
                    <Text style={{ color: "#888888", fontSize: 12 }}>
                      {analytics.watchlist.items.length} stocks •{" "}
                      {analytics.favoritesCount} favorites
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.watchlistChange,
                      analytics.dailyChangePercent >= 0
                        ? styles.positiveChange
                        : styles.negativeChange,
                    ]}
                  >
                    {analytics.dailyChangePercent >= 0 ? "+" : ""}
                    {analytics.dailyChangePercent.toFixed(2)}%
                  </Text>
                  <Text style={{ color: "#888888", fontSize: 12 }}>today</Text>
                </View>
              </View>

              <View style={styles.watchlistMetrics}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Top Performer</Text>
                  <Text style={[styles.metricValue, { color: "#00D4AA" }]}>
                    {analytics.topPerformer || "—"}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Bottom Performer</Text>
                  <Text style={[styles.metricValue, { color: "#FF5722" }]}>
                    {analytics.bottomPerformer || "—"}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Active Signals</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          analytics.signalsCount > 0 ? "#00D4AA" : "#888888",
                      },
                    ]}
                  >
                    {analytics.signalsCount}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Avg Price</Text>
                  <Text style={styles.metricValue}>
                    $
                    {analytics.watchlist.items.length > 0
                      ? (
                          analytics.totalValue /
                          analytics.watchlist.items.length
                        ).toFixed(0)
                      : "0"}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}

          {watchlistAnalytics.length === 0 && (
            <View style={{ alignItems: "center", padding: 32 }}>
              <Ionicons name="list-outline" size={48} color="#888888" />
              <Text
                style={{ color: "#888888", textAlign: "center", marginTop: 12 }}
              >
                No watchlists yet.{"\n"}
                Create your first watchlist to get started!
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: "#2a2a2a",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={() => (navigation as any).navigate("Signals")}
            >
              <Ionicons name="radio" size={24} color="#00D4AA" />
              <Text
                style={{
                  color: "#ffffff",
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Trading Signals
              </Text>
            </Pressable>

            <Pressable
              style={{
                flex: 1,
                backgroundColor: "#2a2a2a",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={() => (navigation as any).navigate("Scanner")}
            >
              <Ionicons name="search" size={24} color="#00D4AA" />
              <Text
                style={{
                  color: "#ffffff",
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Market Scanner
              </Text>
            </Pressable>

            <Pressable
              style={{
                flex: 1,
                backgroundColor: "#2a2a2a",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={() => (navigation as any).navigate("AIInsights")}
            >
              <Ionicons name="sparkles" size={24} color="#00D4AA" />
              <Text
                style={{
                  color: "#ffffff",
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                AI Insights
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
