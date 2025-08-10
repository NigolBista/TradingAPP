import React, { useEffect, useMemo, useState } from "react";
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
import TradingViewChart from "../components/charts/TradingViewChart";
import { fetchCandles } from "../services/marketProviders";
import { fetchNews } from "../services/newsProviders";
import NewsList from "../components/insights/NewsList";
import {
  performComprehensiveAnalysis,
  MarketAnalysis,
} from "../services/aiAnalytics";
// import { MarketScanner } from "../services/marketScanner";
import {
  analyzeNewsWithEnhancedSentiment,
  getNewsAlerts,
  SentimentAnalysis,
} from "../services/sentiment";
import { generateSignalSummary, SignalSummary } from "../services/signalEngine";
import { useUserStore, type Watchlist } from "../store/userStore";
import { useNavigation } from "@react-navigation/native";

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
  content: {
    flex: 1,
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
  // Stock Selection
  stockSelector: {
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
    backgroundColor: "#00D4AA",
    borderColor: "#00D4AA",
  },
  stockChipInactive: {
    backgroundColor: "transparent",
    borderColor: "#333333",
  },
  stockChipTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  stockChipTextInactive: {
    color: "#ffffff",
    fontWeight: "500",
  },
  // Price Display
  priceSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  priceLeft: {
    flex: 1,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  priceLabel: {
    fontSize: 14,
    color: "#888888",
    marginTop: 4,
  },
  priceRight: {
    alignItems: "flex-end",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  changeBadgePositive: {
    backgroundColor: "#00D4AA",
  },
  changeBadgeNegative: {
    backgroundColor: "#FF5722",
  },
  changeText: {
    fontWeight: "600",
    marginLeft: 4,
  },
  changeTextPositive: {
    color: "#000000",
  },
  changeTextNegative: {
    color: "#ffffff",
  },
  absoluteChange: {
    fontSize: 14,
    fontWeight: "500",
  },
  // Chart Controls
  timeframeSelector: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  timeframeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#333333",
  },
  timeframeChipActive: {
    backgroundColor: "#00D4AA",
  },
  timeframeChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "500",
  },
  timeframeChipTextActive: {
    color: "#000000",
  },
  // Analysis Cards
  analysisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  analysisCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: (width - 64) / 2 - 4,
  },
  analysisTitle: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  analysisValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  analysisSubvalue: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  // Momentum Analysis
  momentumGrid: {
    gap: 8,
  },
  momentumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  momentumTimeframe: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "500",
    minWidth: 40,
  },
  momentumBars: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginHorizontal: 12,
  },
  momentumBar: {
    height: 4,
    backgroundColor: "#333333",
    borderRadius: 2,
    marginHorizontal: 1,
    flex: 1,
  },
  momentumBarActive: {
    backgroundColor: "#00D4AA",
  },
  momentumBarNegative: {
    backgroundColor: "#FF5722",
  },
  momentumDirection: {
    fontSize: 12,
    fontWeight: "500",
    minWidth: 60,
    textAlign: "right",
  },
  bullishText: {
    color: "#00D4AA",
  },
  bearishText: {
    color: "#FF5722",
  },
  neutralText: {
    color: "#888888",
  },
  // Trading Signals
  signalCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  signalType: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#00D4AA",
  },
  signalAction: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  signalConfidence: {
    fontSize: 12,
    color: "#888888",
  },
  signalTargets: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  signalTarget: {
    backgroundColor: "#333333",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  signalTargetText: {
    fontSize: 12,
    color: "#ffffff",
  },
  // Support/Resistance
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  supportLabel: {
    color: "#00D4AA",
  },
  resistanceLabel: {
    color: "#FF5722",
  },
  levelValue: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "500",
  },
  // Alerts
  alertCard: {
    backgroundColor: "#FF5722",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  alertText: {
    color: "#ffffff",
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
  // Market Overview
  marketOverview: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  overviewItem: {
    alignItems: "center",
    flex: 1,
  },
  overviewLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  loadingContainer: {
    height: 200,
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
  const [watchlistAnalytics, setWatchlistAnalytics] = useState<WatchlistAnalytics[]>([]);
  const { profile, getActiveWatchlist } = useUserStore();

  const stockSymbols = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "NFLX",
    "SPY",
    "QQQ",
    "IWM",
    "BTC-USD",
    "ETH-USD",
  ];

  const timeframes = [
    { label: "1m", value: "1" as const },
    { label: "5m", value: "5" as const },
    { label: "15m", value: "15" as const },
    { label: "30m", value: "30" as const },
    { label: "1h", value: "60" as const },
    { label: "1d", value: "D" as const },
  ];

  useEffect(() => {
    loadData();
  }, [symbol]);

  // Avoid heavy market-wide scans on dashboard mount
  // useEffect(() => {
  //   loadMarketOverview();
  // }, []);

  useEffect(() => {
    loadFocusSignals();
    loadMarketBrief();
  }, [profile.watchlist?.join(",")]);

  async function loadData() {
    try {
      setLoading(true);

      // Fetch multiple timeframes for comprehensive analysis
      const timeframePromises = [
        { tf: "1d", resolution: "D" as const },
        { tf: "1h", resolution: "1H" as const },
        { tf: "15m", resolution: "15" as const },
        { tf: "5m", resolution: "5" as const },
      ].map(async ({ tf, resolution }) => {
        try {
          const candles = await fetchCandles(symbol, { resolution });
          return { timeframe: tf, candles };
        } catch {
          return { timeframe: tf, candles: [] };
        }
      });

      const candleResults = await Promise.all(timeframePromises);
      const candleData: { [timeframe: string]: any[] } = {};
      candleResults.forEach(({ timeframe, candles }) => {
        candleData[timeframe] = candles;
      });

      // Perform comprehensive analysis
      if (candleData["1d"]?.length > 0) {
        const analysisResult = await performComprehensiveAnalysis(
          symbol,
          candleData
        );
        setAnalysis(analysisResult);
      }

      // Fetch and analyze news
      try {
        const newsData = await fetchNews(symbol);
        setNews(newsData || []);

        if (newsData && newsData.length > 0) {
          const sentimentResult = await analyzeNewsWithEnhancedSentiment(
            newsData
          );
          setNewsAnalysis(sentimentResult);
        }
      } catch (error) {
        console.warn("Failed to fetch news:", error);
        setNews([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load market data. Please try again.";
      Alert.alert("Market Data Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // async function loadMarketOverview() {
  //   try {
  //     const screenerData = await MarketScanner.getMarketScreenerData();
  //     setMarketOverview(screenerData);
  //   } catch (error) {
  //     console.warn("Failed to load market overview:", error);
  //   }
  // }

  async function loadFocusSignals() {
    try {
      const symbols = (
        profile.watchlist?.length
          ? profile.watchlist
          : ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"]
      ).slice(0, 6);
      const summaries = await Promise.all(
        symbols.map((s) =>
          generateSignalSummary(s, profile.accountSize, profile.riskPerTradePct)
        )
      );
      const filtered = summaries
        .filter((s): s is SignalSummary => !!s && !!s.topSignal)
        .sort(
          (a, b) =>
            (b.topSignal?.confidence || 0) - (a.topSignal?.confidence || 0)
        )
        .slice(0, 3);
      setFocusSignals(filtered);
    } catch (e) {
      // ignore
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

      const brief = `Good ${timeOfDay}! Markets are ${marketDirection} with the S&P 500 ${
        spyChange > 0 ? "up" : "down"
      } ${Math.abs(spyChange).toFixed(1)}%. ${
        Math.abs(spyChange) > 1 ? "Significant moves today - " : ""
      }Key focus: ${profile.watchlist?.[0] || "AAPL"} and ${
        focusSignals.length
      } active signals on your watchlist.`;

      setMarketBrief(brief);
    } catch (error) {
      console.error("Error loading market brief:", error);
      setMarketBrief(
        "Welcome back! Check your watchlist for today's opportunities."
      );
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    await loadMarketBrief();
  }

  const currentPrice = analysis?.currentPrice || 0;
  const previousPrice = currentPrice * 0.98; // Mock previous price
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent =
    previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  const newsAlerts = newsAnalysis ? getNewsAlerts(newsAnalysis) : [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00D4AA"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trading Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          AI-Powered Market Analysis • Live Data
        </Text>
      </View>

      <View style={styles.content}>
        {/* Market Brief */}
        {marketBrief && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Market Brief</Text>
              <Pressable
                onPress={() => navigation.navigate("News" as never)}
                style={{ padding: 4 }}
              >
                <Ionicons name="newspaper" size={20} color="#00D4AA" />
              </Pressable>
            </View>
            <Text
              style={{
                color: "#cccccc",
                fontSize: 14,
                lineHeight: 20,
                marginBottom: 12,
              }}
            >
              {marketBrief}
            </Text>

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
                onPress={() => navigation.navigate("Journey" as never)}
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

        {/* Stock Symbol Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Symbol</Text>
          </View>
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
        <View style={styles.section}>
          <View style={styles.priceSection}>
            <View style={styles.priceLeft}>
              <Text style={styles.currentPrice}>
                ${currentPrice.toFixed(2)}
              </Text>
              <Text style={styles.priceLabel}>{symbol} • Live Price</Text>
            </View>
            <View style={styles.priceRight}>
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
                  color={isPositive ? "#000000" : "#ffffff"}
                />
                <Text
                  style={[
                    styles.changeText,
                    isPositive
                      ? styles.changeTextPositive
                      : styles.changeTextNegative,
                  ]}
                >
                  {isPositive ? "+" : ""}
                  {priceChangePercent.toFixed(2)}%
                </Text>
              </View>
              <Text
                style={[
                  styles.absoluteChange,
                  { color: isPositive ? "#00D4AA" : "#FF5722" },
                ]}
              >
                {isPositive ? "+" : ""}${priceChange.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Overall Rating */}
          {analysis && (
            <View style={styles.analysisGrid}>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>AI Rating</Text>
                <Text style={styles.analysisValue}>
                  {analysis.overallRating.score.toFixed(0)}/100
                </Text>
                <Text style={styles.analysisSubvalue}>
                  {analysis.overallRating.recommendation
                    .replace("_", " ")
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Risk Level</Text>
                <Text style={styles.analysisValue}>
                  {analysis.riskFactors.length === 0
                    ? "Low"
                    : analysis.riskFactors.length === 1
                    ? "Medium"
                    : "High"}
                </Text>
                <Text style={styles.analysisSubvalue}>
                  {analysis.riskFactors.length} Factors
                </Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Signals</Text>
                <Text style={styles.analysisValue}>
                  {analysis.signals.length}
                </Text>
                <Text style={styles.analysisSubvalue}>Active</Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Trend</Text>
                <Text style={styles.analysisValue}>
                  {analysis.marketStructure.trend.toUpperCase()}
                </Text>
                <Text style={styles.analysisSubvalue}>
                  {analysis.marketStructure.trendStrength}% Strength
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Today's Focus (Watchlist Signals) */}
        {focusSignals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Focus</Text>
              <Text style={styles.sectionSubtitle}>
                Top signals from your watchlist
              </Text>
            </View>
            {focusSignals.map((s, idx) => (
              <View key={idx} style={styles.signalCard}>
                <View style={styles.signalHeader}>
                  <View>
                    <Text style={styles.signalType}>{s.symbol}</Text>
                    <Text style={styles.signalAction}>
                      {s.topSignal?.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.signalConfidence}>
                    {s.topSignal?.confidence.toFixed(0)}% Confidence
                  </Text>
                </View>
                <Text
                  style={{ color: "#888888", fontSize: 12, marginBottom: 8 }}
                >
                  Entry: ${s.topSignal?.entry.toFixed(2)} • Stop: $
                  {s.topSignal?.stopLoss.toFixed(2)} • Size:{" "}
                  {s.topSignal?.tradePlan.positionSize}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* News Alerts */}
        {newsAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Market Alerts</Text>
            </View>
            {newsAlerts.map((alert, index) => (
              <View key={index} style={styles.alertCard}>
                <Ionicons name="warning" size={16} color="#ffffff" />
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* TradingView Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Price & Signals</Text>
          </View>

          {/* Timeframe Selector */}
          <View style={styles.timeframeSelector}>
            {timeframes.map((tf) => (
              <Pressable
                key={tf.value}
                onPress={() => setTimeframe(tf.value)}
                style={[
                  styles.timeframeChip,
                  timeframe === tf.value && styles.timeframeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeframeChipText,
                    timeframe === tf.value && styles.timeframeChipTextActive,
                  ]}
                >
                  {tf.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TradingViewChart
            symbol={symbol}
            height={360}
            interval={timeframe}
            theme="dark"
          />

          {focusSignals.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {focusSignals
                .filter((s) => s.symbol === symbol)
                .slice(0, 1)
                .map((s, i) => (
                  <View key={i} style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <Text style={styles.signalType}>Signal</Text>
                      <Text style={styles.signalConfidence}>
                        {s.topSignal?.confidence.toFixed(0)}% Confidence
                      </Text>
                    </View>
                    <Text style={{ color: "#cccccc", fontSize: 12 }}>
                      Entry ${s.topSignal?.entry.toFixed(2)} • Stop $
                      {s.topSignal?.stopLoss.toFixed(2)} • Targets{" "}
                      {s.topSignal?.targets.map((t) => t.toFixed(2)).join(", ")}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Multi-Timeframe Momentum Analysis */}
        {analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Multi-Timeframe Momentum</Text>
              <Text style={styles.sectionSubtitle}>
                Bullish signals across timeframes
              </Text>
            </View>
            <View style={styles.momentumGrid}>
              {Object.entries(analysis.momentum).map(([tf, momentum]) => (
                <View key={tf} style={styles.momentumRow}>
                  <Text style={styles.momentumTimeframe}>{tf}</Text>
                  <View style={styles.momentumBars}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.momentumBar,
                          i < momentum.strength / 10 &&
                            (momentum.direction === "bullish"
                              ? styles.momentumBarActive
                              : momentum.direction === "bearish"
                              ? styles.momentumBarNegative
                              : styles.momentumBar),
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[
                      styles.momentumDirection,
                      momentum.direction === "bullish"
                        ? styles.bullishText
                        : momentum.direction === "bearish"
                        ? styles.bearishText
                        : styles.neutralText,
                    ]}
                  >
                    {momentum.direction.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trading Signals */}
        {analysis && analysis.signals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Trading Signals</Text>
              <Text style={styles.sectionSubtitle}>
                Based on technical confluence
              </Text>
            </View>
            {analysis.signals.map((signal, index) => (
              <View key={index} style={styles.signalCard}>
                <View style={styles.signalHeader}>
                  <View>
                    <Text style={styles.signalType}>{signal.type} Trading</Text>
                    <Text style={styles.signalAction}>
                      {signal.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.signalConfidence}>
                    {signal.confidence.toFixed(0)}% Confidence
                  </Text>
                </View>
                <Text
                  style={{ color: "#888888", fontSize: 12, marginBottom: 8 }}
                >
                  Entry: ${signal.entry.toFixed(2)} • Stop: $
                  {signal.stopLoss.toFixed(2)} • R/R: {signal.riskReward}:1
                </Text>
                <View style={styles.signalTargets}>
                  {signal.targets.map((target, i) => (
                    <View key={i} style={styles.signalTarget}>
                      <Text style={styles.signalTargetText}>
                        T{i + 1}: ${target.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Support & Resistance */}
        {analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Key Levels</Text>
              <Text style={styles.sectionSubtitle}>Support & Resistance</Text>
            </View>
            {analysis.supportResistance.resistance.map((level, index) => (
              <View key={`r-${index}`} style={styles.levelRow}>
                <Text style={[styles.levelLabel, styles.resistanceLabel]}>
                  Resistance {index + 1}
                </Text>
                <Text style={styles.levelValue}>${level.toFixed(2)}</Text>
              </View>
            ))}
            {analysis.supportResistance.support.map((level, index) => (
              <View key={`s-${index}`} style={styles.levelRow}>
                <Text style={[styles.levelLabel, styles.supportLabel]}>
                  Support {index + 1}
                </Text>
                <Text style={styles.levelValue}>${level.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Technical Indicators */}
        {analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Technical Indicators</Text>
            </View>
            <View style={styles.analysisGrid}>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>RSI (14)</Text>
                <Text style={styles.analysisValue}>
                  {analysis.indicators.rsi.toFixed(1)}
                </Text>
                <Text style={styles.analysisSubvalue}>
                  {analysis.indicators.rsi > 70
                    ? "Overbought"
                    : analysis.indicators.rsi < 30
                    ? "Oversold"
                    : "Neutral"}
                </Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>MACD</Text>
                <Text style={styles.analysisValue}>
                  {analysis.indicators.macd.macd.toFixed(2)}
                </Text>
                <Text style={styles.analysisSubvalue}>
                  {analysis.indicators.macd.macd >
                  analysis.indicators.macd.signal
                    ? "Bullish"
                    : "Bearish"}
                </Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Volume</Text>
                <Text style={styles.analysisValue}>
                  {analysis.indicators.volume.ratio.toFixed(1)}x
                </Text>
                <Text style={styles.analysisSubvalue}>vs 20-day avg</Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>ATR</Text>
                <Text style={styles.analysisValue}>
                  ${analysis.indicators.atr.toFixed(2)}
                </Text>
                <Text style={styles.analysisSubvalue}>Volatility</Text>
              </View>
            </View>
          </View>
        )}

        {/* News Analysis */}
        {newsAnalysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>News Sentiment</Text>
              <Text style={styles.sectionSubtitle}>
                {newsAnalysis.urgency.toUpperCase()} Impact
              </Text>
            </View>
            <Text style={{ color: "#ffffff", marginBottom: 8 }}>
              {newsAnalysis.label} ({(newsAnalysis.score * 100).toFixed(0)}%
              score)
            </Text>
            <Text style={{ color: "#888888", fontSize: 14 }}>
              {newsAnalysis.summary}
            </Text>
          </View>
        )}

        {/* Latest News */}
        {news.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest News</Text>
              <Text style={styles.sectionSubtitle}>{symbol}</Text>
            </View>
            <NewsList items={news.slice(0, 5)} />
          </View>
        )}

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
