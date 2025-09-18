import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MarketScanner, ScanResult } from "../services/marketScanner";
import {
  performComprehensiveAnalysis,
  MarketAnalysis,
  TradingSignal,
} from "../services/aiAnalytics";
// Removed sentiment analysis - using Stock News API sentiment directly
import { fetchCandles } from "../services/marketProviders";
import { fetchNews } from "../services/newsProviders";
import { generateSignalSummary } from "../services/signalEngine";
import { generateEventSignals, EventSignal } from "../services/eventSignals";
import { useUserStore } from "../store/userStore";
import {
  sendLocalNotification,
  registerForPushNotificationsAsync,
} from "../services/notifications";

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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#00D4AA",
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#000000",
  },
  tabTextInactive: {
    color: "#888888",
  },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#00D4AA",
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000000",
  },
  insightDescription: {
    fontSize: 14,
    color: "#cccccc",
    lineHeight: 20,
    marginBottom: 12,
  },
  insightMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#888888",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  sentimentContainer: {
    alignItems: "center",
    padding: 24,
  },
  sentimentCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sentimentScore: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  sentimentLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#00D4AA",
    marginBottom: 8,
  },
  sentimentDescription: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 20,
  },
  signalCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  signalSymbol: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  signalAction: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  buyAction: {
    color: "#00D4AA",
  },
  sellAction: {
    color: "#FF5722",
  },
  holdAction: {
    color: "#FFB020",
  },
  signalType: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 8,
  },
  signalTargets: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  targetChip: {
    backgroundColor: "#333333",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  targetText: {
    fontSize: 10,
    color: "#ffffff",
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
});

interface AIInsight {
  title: string;
  description: string;
  confidence: number;
  symbols: string[];
  impact: "bullish" | "bearish" | "neutral";
  timeframe: string;
  factors: string[];
}

export default function AIInsightsScreen() {
  const [activeTab, setActiveTab] = useState<
    "insights" | "signals" | "planner" | "alerts" | "events"
  >("insights");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  // Removed sentiment analysis - using Stock News API sentiment directly
  const [topSignals, setTopSignals] = useState<
    { symbol: string; analysis: MarketAnalysis }[]
  >([]);
  const [planner, setPlanner] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<EventSignal[]>([]);
  const { profile } = useUserStore();

  useEffect(() => {
    loadData();
    if (profile.notificationsEnabled) {
      registerForPushNotificationsAsync().catch(() => {});
    }
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      await Promise.all([
        loadInsights(),
        // Removed sentiment loading - using Stock News API sentiment directly
        loadTopSignals(),
        loadPlanner(),
        loadAlerts(),
        loadEvents(),
      ]);
    } catch (error) {
      console.error("Error loading AI insights:", error);
      Alert.alert("Error", "Failed to load AI insights");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadEvents() {
    try {
      const symbols =
        profile.watchlist.length > 0
          ? profile.watchlist.slice(0, 6)
          : ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"];
      const perSymbol = await Promise.all(
        symbols.map(async (s) => {
          const items = await fetchNews(s);
          const sigs = await generateEventSignals(s, items);
          return sigs;
        })
      );
      const flat = perSymbol.flat();
      flat.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      setEvents(flat.slice(0, 15));
    } catch (e) {
      // ignore
    }
  }

  async function loadInsights() {
    try {
      // Generate AI insights based on market scan
      const scanResults = await MarketScanner.scanMarket({ minConfidence: 70 });
      const generatedInsights: AIInsight[] = [];

      // Bullish momentum insight
      const bullishStocks = scanResults.filter(
        (r) =>
          r.analysis.marketStructure.trend === "uptrend" &&
          r.analysis.indicators.rsi < 70
      );
      if (bullishStocks.length > 0) {
        generatedInsights.push({
          title: "Strong Bullish Momentum Detected",
          description: `${bullishStocks.length} stocks showing strong upward momentum with healthy RSI levels. Multiple timeframe alignment suggests continued strength.`,
          confidence: 82,
          symbols: bullishStocks.slice(0, 5).map((s) => s.symbol),
          impact: "bullish",
          timeframe: "1-2 weeks",
          factors: [
            "Technical breakouts",
            "Volume confirmation",
            "Multi-timeframe alignment",
          ],
        });
      }

      // Oversold bounce opportunity
      const oversoldStocks = scanResults.filter(
        (r) =>
          r.analysis.indicators.rsi < 30 &&
          r.analysis.indicators.volume.ratio > 1.2
      );
      if (oversoldStocks.length > 0) {
        generatedInsights.push({
          title: "Oversold Bounce Opportunities",
          description: `${oversoldStocks.length} quality stocks in oversold territory with increasing volume. Historical patterns suggest potential bounce.`,
          confidence: 75,
          symbols: oversoldStocks.slice(0, 4).map((s) => s.symbol),
          impact: "bullish",
          timeframe: "3-7 days",
          factors: ["Oversold RSI", "Volume spike", "Support levels nearby"],
        });
      }

      // High volume breakouts
      const breakoutStocks = scanResults.filter(
        (r) =>
          r.analysis.indicators.volume.ratio > 2.0 &&
          r.analysis.signals.length > 0
      );
      if (breakoutStocks.length > 0) {
        generatedInsights.push({
          title: "High Volume Breakout Patterns",
          description: `${breakoutStocks.length} stocks breaking out with exceptional volume. These patterns often lead to sustained moves.`,
          confidence: 88,
          symbols: breakoutStocks.slice(0, 3).map((s) => s.symbol),
          impact: "bullish",
          timeframe: "1-4 weeks",
          factors: [
            "Exceptional volume",
            "Technical breakout",
            "AI signal confirmation",
          ],
        });
      }

      // Risk warning for overbought
      const overboughtStocks = scanResults.filter(
        (r) => r.analysis.indicators.rsi > 80
      );
      if (overboughtStocks.length > 0) {
        generatedInsights.push({
          title: "Overbought Risk Warning",
          description: `${overboughtStocks.length} stocks showing extreme overbought conditions. Consider taking profits or reducing exposure.`,
          confidence: 78,
          symbols: overboughtStocks.slice(0, 4).map((s) => s.symbol),
          impact: "bearish",
          timeframe: "immediate",
          factors: ["Extreme RSI", "Low volume", "Potential reversal patterns"],
        });
      }

      setInsights(generatedInsights);
    } catch (error) {
      console.error("Error generating insights:", error);
    }
  }

  // Removed loadSentiment function - using Stock News API sentiment directly

  async function loadTopSignals() {
    try {
      const scanResults = await MarketScanner.scanMarket({ minConfidence: 75 });
      const topResults = scanResults
        .filter((r) => r.analysis.signals.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      const signalsData = topResults.map((result) => ({
        symbol: result.symbol,
        analysis: result.analysis,
      }));

      setTopSignals(signalsData);
    } catch (error) {
      console.error("Error loading top signals:", error);
    }
  }

  async function loadPlanner() {
    try {
      const symbols =
        profile.watchlist.length > 0
          ? profile.watchlist.slice(0, 10)
          : ["AAPL", "MSFT", "NVDA", "TSLA"];
      const plans = await Promise.all(
        symbols.map(async (s) => {
          const summary = await generateSignalSummary(
            s,
            profile.accountSize,
            profile.riskPerTradePct
          );
          return { symbol: s, summary };
        })
      );
      const filtered = plans.filter(
        (p) =>
          p.summary &&
          p.summary.topSignal &&
          p.summary.topSignal!.confidence >=
            (profile.signalConfidenceThreshold ?? 70)
      );
      setPlanner(filtered);
    } catch (e) {
      // ignore
    }
  }

  async function loadAlerts() {
    try {
      const symbols =
        profile.watchlist.length > 0
          ? profile.watchlist.slice(0, 10)
          : ["AAPL", "MSFT", "NVDA", "TSLA"];
      const summaries = await Promise.all(
        symbols.map((s) => generateSignalSummary(s))
      );
      const now = Date.now();
      const items = summaries
        .filter(Boolean)
        .map((s: any) => s as NonNullable<typeof s>)
        .filter(
          (s) =>
            (s.topSignal?.confidence ?? 0) >=
            (profile.signalConfidenceThreshold ?? 70)
        )
        .map((s) => ({
          symbol: s.symbol,
          action: s.topSignal!.action,
          confidence: s.topSignal!.confidence,
          entry: s.topSignal!.entry,
          stop: s.topSignal!.stopLoss,
          rr: s.topSignal!.riskReward,
          ts: now,
        }));
      setAlerts(items);
      if (profile.notificationsEnabled) {
        items.slice(0, 2).forEach((i) => {
          sendLocalNotification(
            `Signal: ${
              i.symbol
            } ${i.action.toUpperCase()} (${i.confidence.toFixed(0)}%)`,
            `Entry ${i.entry.toFixed(2)}, Stop ${i.stop.toFixed(2)}, R/R ${
              i.rr
            }:1`
          );
        });
      }
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  function renderInsight(insight: AIInsight, index: number) {
    return (
      <View key={index} style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  insight.confidence > 80
                    ? "#00D4AA"
                    : insight.confidence > 60
                    ? "#FFB020"
                    : "#FF5722",
              },
            ]}
          >
            <Text style={styles.confidenceText}>{insight.confidence}%</Text>
          </View>
        </View>

        <Text style={styles.insightDescription}>{insight.description}</Text>

        <View style={styles.insightMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Impact</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    insight.impact === "bullish"
                      ? "#00D4AA"
                      : insight.impact === "bearish"
                      ? "#FF5722"
                      : "#FFB020",
                },
              ]}
            >
              {insight.impact.toUpperCase()}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Timeframe</Text>
            <Text style={styles.metricValue}>{insight.timeframe}</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Stocks</Text>
            <Text style={styles.metricValue}>{insight.symbols.length}</Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 12,
          }}
        >
          {insight.symbols.map((symbol) => (
            <View key={symbol} style={styles.targetChip}>
              <Text style={styles.targetText}>{symbol}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderSignal(
    signalData: { symbol: string; analysis: MarketAnalysis },
    index: number
  ) {
    const { symbol, analysis } = signalData;
    const primarySignal = analysis.signals[0];

    if (!primarySignal) return null;

    return (
      <View key={index} style={styles.signalCard}>
        <View style={styles.signalHeader}>
          <Text style={styles.signalSymbol}>{symbol}</Text>
          <Text
            style={[
              styles.signalAction,
              primarySignal.action === "buy"
                ? styles.buyAction
                : primarySignal.action === "sell"
                ? styles.sellAction
                : styles.holdAction,
            ]}
          >
            {primarySignal.action}
          </Text>
        </View>

        <Text style={styles.signalType}>
          {primarySignal.type.toUpperCase()} • {primarySignal.confidence}%
          Confidence
        </Text>

        <Text style={{ color: "#cccccc", fontSize: 12, marginBottom: 8 }}>
          Entry: ${primarySignal.entry.toFixed(2)} • Stop: $
          {primarySignal.stopLoss.toFixed(2)}
        </Text>

        <View style={styles.signalTargets}>
          {primarySignal.targets.map((target, i) => (
            <View key={i} style={styles.targetChip}>
              <Text style={styles.targetText}>
                T{i + 1}: ${target.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: "#888888", fontSize: 10 }}>
            Confluence: {primarySignal.confluence} signals • R/R:{" "}
            {primarySignal.riskReward}:1
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Market Insights</Text>
          <Text style={styles.headerSubtitle}>Loading AI analysis...</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Analyzing markets...</Text>
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
            <Text style={styles.headerTitle}>AI Market Insights</Text>
            <Text style={styles.headerSubtitle}>
              Advanced machine learning analysis
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="sparkles" size={16} color="#000000" />
            <Text style={styles.refreshButtonText}>
              {refreshing ? "Analyzing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "insights" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("insights")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "insights"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Market Insights
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "signals" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("signals")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "signals"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Top Signals
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "planner" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("planner")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "planner"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Planner
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "alerts" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("alerts")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "alerts"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Alerts
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "events" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("events")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "events"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Events
          </Text>
        </Pressable>
      </View>

      {/* Content */}
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
        {activeTab === "insights" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              AI-Generated Market Insights
            </Text>
            {insights.length === 0 ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <Ionicons name="bulb-outline" size={48} color="#888888" />
                <Text
                  style={{
                    color: "#888888",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No significant insights detected at this time. Market
                  conditions appear stable.
                </Text>
              </View>
            ) : (
              insights.map(renderInsight)
            )}
          </View>
        )}

        {activeTab === "events" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event-Driven Signals</Text>
            {events.length === 0 ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <Ionicons name="flash-outline" size={48} color="#888888" />
                <Text
                  style={{
                    color: "#888888",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No recent catalysts detected across your watchlist.
                </Text>
              </View>
            ) : (
              events.map((e, idx) => (
                <View key={idx} style={styles.signalCard}>
                  <View style={styles.signalHeader}>
                    <Text style={styles.signalSymbol}>{e.symbol}</Text>
                    <Text
                      style={[
                        styles.signalAction,
                        e.action === "buy"
                          ? styles.buyAction
                          : styles.sellAction,
                      ]}
                    >
                      {e.action}
                    </Text>
                  </View>
                  <Text style={styles.signalType}>
                    {e.event.replace(/_/g, " ").toUpperCase()} • {e.confidence}%
                  </Text>
                  <Text style={{ color: "#cccccc", fontSize: 12 }}>
                    {e.headline}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "signals" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top AI Trading Signals</Text>
            {topSignals.length === 0 ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <Ionicons name="radio-outline" size={48} color="#888888" />
                <Text
                  style={{
                    color: "#888888",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No high-confidence signals available. Check back later for new
                  opportunities.
                </Text>
              </View>
            ) : (
              topSignals.map(renderSignal)
            )}

            <View
              style={{
                backgroundColor: "#2a2a2a",
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                borderLeftWidth: 4,
                borderLeftColor: "#FFB020",
              }}
            >
              <Text
                style={{
                  color: "#FFB020",
                  fontSize: 12,
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                ⚠️ Risk Disclaimer
              </Text>
              <Text style={{ color: "#888888", fontSize: 11 }}>
                These are AI-generated signals for educational purposes only.
                Not financial advice. Always conduct your own research and risk
                management.
              </Text>
            </View>
          </View>
        )}

        {activeTab === "planner" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Trade Planner (Position Size)
            </Text>
            {planner.length === 0 ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <Ionicons name="calculator-outline" size={48} color="#888888" />
                <Text
                  style={{
                    color: "#888888",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No eligible signals found on your watchlist.
                </Text>
              </View>
            ) : (
              planner.map((p, idx) => {
                const top = p.summary.topSignal;
                return (
                  <View key={idx} style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <Text style={styles.signalSymbol}>{p.symbol}</Text>
                      <Text
                        style={[
                          styles.signalAction,
                          top.action === "buy"
                            ? styles.buyAction
                            : styles.sellAction,
                        ]}
                      >
                        {top.action}
                      </Text>
                    </View>
                    <Text style={styles.signalType}>
                      {top.type.toUpperCase()} • {top.confidence.toFixed(0)}% •
                      Size: {top.tradePlan.positionSize}
                    </Text>
                    <Text
                      style={{
                        color: "#cccccc",
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    >
                      Entry ${top.entry.toFixed(2)} • Stop $
                      {top.stopLoss.toFixed(2)} • Targets{" "}
                      {top.targets.map((t: number) => t.toFixed(2)).join(", ")}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === "alerts" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signal Alerts</Text>
            {alerts.length === 0 ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <Ionicons
                  name="notifications-outline"
                  size={48}
                  color="#888888"
                />
                <Text
                  style={{
                    color: "#888888",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No alerts yet. When high-confidence signals appear, they will
                  show here.
                </Text>
              </View>
            ) : (
              alerts.map((a, idx) => (
                <View key={idx} style={styles.signalCard}>
                  <View style={styles.signalHeader}>
                    <Text style={styles.signalSymbol}>{a.symbol}</Text>
                    <Text
                      style={[
                        styles.signalAction,
                        a.action === "buy"
                          ? styles.buyAction
                          : styles.sellAction,
                      ]}
                    >
                      {a.action}
                    </Text>
                  </View>
                  <Text style={styles.signalType}>
                    {a.confidence.toFixed(0)}% • Entry ${a.entry.toFixed(2)} •
                    Stop ${a.stop.toFixed(2)} • R/R {a.rr}:1
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
