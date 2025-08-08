import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LightweightCandles from "../components/charts/LightweightCandles";
import { fetchCandles, fetchNews } from "../services/marketProviders";
import NewsList from "../components/insights/NewsList";
import { generateInsights } from "../services/ai";
import { analyzeNewsSentiment } from "../services/sentiment";
import dummyRaw from "../components/charts/dummyData.json";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  gradient: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
    backgroundColor: "#667eea",
  },
  gradientTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  gradientSubtitle: {
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stockSelector: {
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 12,
  },
  stockRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  stockChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  stockChipActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  stockChipInactive: {
    backgroundColor: "white",
    borderColor: "#d1d5db",
  },
  stockChipTextActive: {
    color: "white",
    fontWeight: "500",
  },
  stockChipTextInactive: {
    color: "#374151",
    fontWeight: "500",
  },
  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceSection: {
    flex: 1,
  },
  price: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
  },
  priceLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  changeSection: {
    alignItems: "flex-end",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  changeBadgePositive: {
    backgroundColor: "#dcfce7",
  },
  changeBadgeNegative: {
    backgroundColor: "#fee2e2",
  },
  changeTextPositive: {
    color: "#166534",
    fontWeight: "500",
    marginLeft: 4,
  },
  changeTextNegative: {
    color: "#991b1b",
    fontWeight: "500",
    marginLeft: 4,
  },
  changeValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  controlsCard: {
    gap: 12,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  controlChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlChipActive: {
    backgroundColor: "#6366f1",
  },
  controlChipInactive: {
    backgroundColor: "#f3f4f6",
  },
  controlChipTextActive: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  controlChipTextInactive: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
  },
  chartCard: {
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  loadingContainer: {
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
});

function generateDummyCandles(count: number = 90, stepMs: number = 300000) {
  const now = Date.now();
  let price = 150;
  const out: any[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * stepMs;
    const open = price;
    const delta = (Math.random() - 0.5) * 2.5;
    const close = Math.max(1, open + delta);
    const high = Math.max(open, close) + Math.random() * 1.2;
    const low = Math.min(open, close) - Math.random() * 1.2;
    out.push({ time, open, high, low, close });
    price = close;
  }
  return out;
}

function parseDummyFromJson() {
  try {
    const series = (dummyRaw as any)["Weekly Time Series"] || {};
    const entries = Object.entries(series) as [string, any][];
    return entries
      .map(([date, v]) => ({
        time: new Date(date).getTime(),
        open: parseFloat(v["1. open"]),
        high: parseFloat(v["2. high"]),
        low: parseFloat(v["3. low"]),
        close: parseFloat(v["4. close"]),
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-180);
  } catch {
    return [] as any[];
  }
}

export default function DashboardScreen() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [candles, setCandles] = useState<any[]>(parseDummyFromJson());
  const [news, setNews] = useState<any[]>([]);
  const [insight, setInsight] = useState("");
  const [sentiment, setSentiment] = useState<{
    label: string;
    score: number;
  } | null>(null);
  const [interval, setInterval] = useState<
    "1min" | "5min" | "15min" | "30min" | "60min" | "daily"
  >("daily");
  const [chartKind, setChartKind] = useState<
    "candlestick" | "area" | "line" | "bar"
  >("candlestick");

  const stockSymbols = [
    "AAPL",
    "GOOGL",
    "MSFT",
    "TSLA",
    "AMZN",
    "NVDA",
    "META",
  ];

  const intervals = [
    "1min",
    "5min",
    "15min",
    "30min",
    "60min",
    "daily",
  ] as const;
  const chartTypes = ["candlestick", "area", "line", "bar"];

  useEffect(() => {
    loadData();
  }, [symbol, interval]);

  async function loadData() {
    try {
      setLoading(candles.length === 0);

      // Simplified data loading for demo
      const c = parseDummyFromJson();
      if (!c.length) {
        const dummyCandles = generateDummyCandles(
          interval === "daily" ? 120 : 180,
          interval === "daily" ? 86_400_000 : 300_000
        );
        setCandles(dummyCandles);
      } else {
        setCandles(c);
      }

      // Mock news and insights
      setNews([
        { title: "Market Update", description: "Latest market movements" },
        { title: "Tech Earnings", description: "Technology sector earnings" },
      ]);
      setInsight(
        "Market showing positive momentum with strong tech sector performance."
      );
      setSentiment({ label: "Positive", score: 0.75 });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  const currentPrice =
    candles.length > 0 ? candles[candles.length - 1].close : 0;
  const previousPrice =
    candles.length > 1 ? candles[candles.length - 2].close : 0;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent =
    previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.gradient}>
        <Text style={styles.gradientTitle}>Portfolio Dashboard</Text>
        <Text style={styles.gradientSubtitle}>
          Track your investments and market insights
        </Text>
      </View>

      <View style={styles.content}>
        {/* Stock Symbol Selector */}
        <View style={[styles.card, styles.stockSelector]}>
          <Text style={styles.selectorLabel}>Select Stock</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.stockRow}>
              {stockSymbols.map((stock) => (
                <Pressable
                  key={stock}
                  onPress={() => setSymbol(stock)}
                  style={[
                    styles.stockChip,
                    symbol === stock
                      ? styles.stockChipActive
                      : styles.stockChipInactive,
                  ]}
                >
                  <Text
                    style={
                      symbol === stock
                        ? styles.stockChipTextActive
                        : styles.stockChipTextInactive
                    }
                  >
                    {stock}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Price Display */}
        <View style={[styles.card, styles.priceCard]}>
          <View style={styles.priceSection}>
            <Text style={styles.price}>${currentPrice.toFixed(2)}</Text>
            <Text style={styles.priceLabel}>{symbol} Stock Price</Text>
          </View>
          <View style={styles.changeSection}>
            <View
              style={[
                styles.changeBadge,
                isPositive
                  ? styles.changeBadgePositive
                  : styles.changeBadgeNegative,
              ]}
            >
              <Ionicons
                name={isPositive ? "trending-up" : "trending-down"}
                size={16}
                color={isPositive ? "#166534" : "#991b1b"}
              />
              <Text
                style={
                  isPositive
                    ? styles.changeTextPositive
                    : styles.changeTextNegative
                }
              >
                {isPositive ? "+" : ""}
                {priceChangePercent.toFixed(2)}%
              </Text>
            </View>
            <Text
              style={[
                styles.changeValue,
                { color: isPositive ? "#166534" : "#991b1b" },
              ]}
            >
              {isPositive ? "+" : ""}${priceChange.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Chart Controls */}
        <View style={[styles.card, styles.controlsCard]}>
          <Text style={styles.selectorLabel}>Timeframe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.controlsRow}>
              {intervals.map((i) => (
                <Pressable
                  key={i}
                  onPress={() => setInterval(i)}
                  style={[
                    styles.controlChip,
                    interval === i
                      ? styles.controlChipActive
                      : styles.controlChipInactive,
                  ]}
                >
                  <Text
                    style={
                      interval === i
                        ? styles.controlChipTextActive
                        : styles.controlChipTextInactive
                    }
                  >
                    {i}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.selectorLabel}>Chart Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.controlsRow}>
              {chartTypes.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setChartKind(k as any)}
                  style={[
                    styles.controlChip,
                    chartKind === k
                      ? { backgroundColor: "#059669" }
                      : styles.controlChipInactive,
                  ]}
                >
                  <Text
                    style={
                      chartKind === k
                        ? {
                            color: "white",
                            fontSize: 14,
                            fontWeight: "500",
                            textTransform: "capitalize",
                          }
                        : {
                            ...styles.controlChipTextInactive,
                            textTransform: "capitalize",
                          }
                    }
                  >
                    {k}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Chart */}
        <View style={[styles.card, styles.chartCard]}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Price Chart</Text>
            <Ionicons name="analytics-outline" size={20} color="#6366f1" />
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : (
            <LightweightCandles data={candles} height={300} type={chartKind} />
          )}
        </View>

        {/* Market Sentiment */}
        {sentiment && (
          <View style={styles.card}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#e0e7ff",
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="pulse-outline" size={20} color="#6366f1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Market Sentiment</Text>
                <Text style={styles.sectionSubtitle}>
                  Based on latest news analysis
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: 18, fontWeight: "bold", color: "#166534" }}
                >
                  {sentiment.label}
                </Text>
                <Text style={{ fontSize: 14, color: "#6b7280" }}>
                  Score: {sentiment.score.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* AI Insights */}
        {insight && (
          <View style={styles.card}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#e0e7ff",
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="sparkles-outline" size={20} color="#6366f1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>AI Market Insights</Text>
                <Text style={styles.sectionSubtitle}>
                  AI-powered analysis for {symbol}
                </Text>
              </View>
            </View>
            <Text
              style={{ color: "#374151", lineHeight: 24, marginBottom: 12 }}
            >
              {insight}
            </Text>
            <View
              style={{
                backgroundColor: "#fef3c7",
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: "#92400e" }}>
                ⚠️ Not financial advice. For educational purposes only.
              </Text>
            </View>
          </View>
        )}

        {/* Latest News */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#e0e7ff",
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="newspaper-outline" size={20} color="#6366f1" />
              </View>
              <Text style={styles.sectionTitle}>Latest News</Text>
            </View>
            <Pressable style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text
                style={{ color: "#6366f1", fontSize: 14, fontWeight: "500" }}
              >
                View All
              </Text>
            </Pressable>
          </View>
          <Text style={styles.sectionSubtitle}>
            Recent headlines for {symbol}
          </Text>
          <NewsList items={news.slice(0, 3)} />
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
