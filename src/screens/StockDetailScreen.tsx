import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AdvancedTradingChart, {
  type LWCDatum,
} from "../components/charts/AdvancedTradingChart";
import SimpleLineChart from "../components/charts/SimpleLineChart";
import CompactCandlestickChart from "../components/charts/CompactCandlestickChart";
import ChartSettingsModal, {
  type ChartType,
} from "../components/charts/ChartSettingsModal";
import ChartControls, {
  type Timeframe,
} from "../components/charts/ChartControls";
import TimeframePickerModal, {
  type ExtendedTimeframe,
} from "../components/charts/TimeframePickerModal";
import {
  fetchCandles,
  type Candle,
  fetchCandlesForTimeframe,
} from "../services/marketProviders";
import {
  performComprehensiveAnalysis,
  type MarketAnalysis,
} from "../services/aiAnalytics";
import {
  fetchNews as fetchSymbolNews,
  type NewsItem,
} from "../services/newsProviders";
import {
  generateSignalSummary,
  type SignalSummary,
} from "../services/signalEngine";
import NewsList from "../components/insights/NewsList";
import { sendLocalNotification } from "../services/notifications";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";

type RootStackParamList = {
  StockDetail: { symbol: string };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  stockInfo: {
    flex: 1,
  },
  tickerSymbol: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  stockName: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
  },
  priceRow: {
    alignItems: "flex-start",
  },
  mainPrice: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  todayChange: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  afterHours: {
    fontSize: 13,
    color: "#888",
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
  },
  chartSection: {
    backgroundColor: "#0a0a0a",
    marginHorizontal: 0,
    marginVertical: 0,
    overflow: "hidden",
  },
  chartContainer: {
    backgroundColor: "transparent",
  },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#00D4AA",
  },
  chipText: { color: "#000", fontWeight: "600" },
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  metric: { color: "#ccc", fontSize: 12 },
  signalCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  levelLabel: { fontSize: 12, color: "#888" },
  levelValue: { fontSize: 12, color: "#fff", fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 12 },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#00D4AA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#000",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
});

export default function StockDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "StockDetail">>();
  const navigation = useNavigation();
  const symbol = route.params?.symbol || "AAPL";

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [dailySeries, setDailySeries] = useState<LWCDatum[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [summary, setSummary] = useState<SignalSummary | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [stockName, setStockName] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1D");
  const [tfModalVisible, setTfModalVisible] = useState(false);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>("1D");
  const { pinned, hydrate, toggle } = useTimeframeStore();
  const [activeTab, setActiveTab] = useState<"signals" | "news">("signals");

  useEffect(() => {
    load();
    loadStockName();
    hydrate();
  }, [symbol]);

  async function loadStockName() {
    try {
      const results = await searchStocksAutocomplete(symbol, 1);
      if (results.length > 0) {
        setStockName(results[0].name);
      }
    } catch (error) {
      console.error("Failed to load stock name:", error);
    }
  }

  async function load() {
    try {
      setLoading(true);
      // Fetch only default timeframe first (daily) for fast initial render
      const d = await fetchCandles(symbol, { resolution: "D" });
      setDailySeries(toLWC(d));
      // Defer secondary data (analysis, news, summary) to not block UI
      Promise.allSettled([
        (async () => {
          try {
            const [h1, m15, m5] = await Promise.all([
              fetchCandles(symbol, { resolution: "1H" }),
              fetchCandles(symbol, { resolution: "15" }),
              fetchCandles(symbol, { resolution: "5" }),
            ]);
            const candleData = {
              "1d": d,
              "1h": h1,
              "15m": m15,
              "5m": m5,
            } as const;
            const a = await performComprehensiveAnalysis(
              symbol,
              candleData as any
            );
            setAnalysis(a);
          } catch {}
        })(),
        (async () => {
          try {
            const items = await fetchSymbolNews(symbol);
            setNews(items);
          } catch {
            setNews([]);
          }
        })(),
        (async () => {
          try {
            const s = await generateSignalSummary(symbol);
            setSummary(s);
          } catch {}
        })(),
      ]);
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to load symbol data"
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyExtendedTimeframe(tf: ExtendedTimeframe) {
    setExtendedTf(tf);
    // Map extended to simple header pills if applicable
    const map: Record<string, Timeframe> = {
      "1m": "1D",
      "2m": "1D",
      "3m": "1D",
      "4m": "1D",
      "5m": "1D",
      "10m": "1D",
      "15m": "1D",
      "30m": "1D",
      "45m": "1D",
      "1h": "1W",
      "2h": "1W",
      "4h": "1M",
      "1D": "1D",
      "1W": "1W",
      "1M": "1M",
      "3M": "3M",
      "6M": "1Y",
      "1Y": "1Y",
      "2Y": "ALL",
      "5Y": "ALL",
      ALL: "ALL",
    };
    setSelectedTimeframe(map[tf]);
    try {
      const candles = await fetchCandlesForTimeframe(symbol, tf);
      setDailySeries(
        candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }))
      );
    } catch (e) {
      console.warn("Failed to load timeframe candles:", e);
    }
  }

  const currentPrice = analysis?.currentPrice || 0;
  const prev = currentPrice * 0.98;
  const priceChange = currentPrice - prev;
  const priceChangePercent = prev > 0 ? (priceChange / prev) * 100 : 0;

  function toLWC(candles: Candle[]): LWCDatum[] {
    return (candles || []).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  async function onSetAlert() {
    await sendLocalNotification(
      `Price alert set for ${symbol}`,
      `We'll notify you on key moves and signals.`
    );
    Alert.alert("Alert Set", "You'll receive notifications for this symbol.");
  }

  function onSaveNote() {
    setShowNoteModal(false);
    if (noteText.trim().length > 0) {
      Alert.alert("Note Saved", "Your note was saved locally.");
    }
    setNoteText("");
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <View style={styles.stockInfo}>
                <Text style={styles.tickerSymbol}>{symbol}</Text>
                <Text style={styles.stockName}>Loading...</Text>
              </View>
            </View>
          </View>
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Robinhood-Style Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {/* Back Button and Search Bar */}
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.stockInfo}>
              <Text style={styles.tickerSymbol}>{symbol}</Text>
              <Text style={styles.stockName}>{stockName || "Loading..."}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.headerActions}>
            <Pressable onPress={onSetAlert} style={styles.headerIconButton}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.headerIconButton}>
              <Ionicons name="add-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Price Information */}
        <View style={styles.priceRow}>
          <Text style={styles.mainPrice}>${currentPrice.toFixed(2)}</Text>
          <Text
            style={[
              styles.todayChange,
              { color: priceChange >= 0 ? "#00D4AA" : "#FF6B6B" },
            ]}
          >
            {priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)} (
            {priceChangePercent.toFixed(2)}%) Today
          </Text>
          {/* After Hours - Mock data for now */}
          <Text style={styles.afterHours}>+$0.06 (0.02%) After hours</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.section, { paddingVertical: 8, marginBottom: 0 }]}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#0f0f0f",
            borderRadius: 10,
          }}
        >
          <Pressable
            onPress={() => setActiveTab("signals")}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: "center",
              borderRadius: 10,
              backgroundColor:
                activeTab === "signals" ? "#00D4AA" : "transparent",
            }}
          >
            <Text
              style={{
                color: activeTab === "signals" ? "#000" : "#aaa",
                fontWeight: "700",
              }}
            >
              Signals
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("news")}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: "center",
              borderRadius: 10,
              backgroundColor: activeTab === "news" ? "#00D4AA" : "transparent",
            }}
          >
            <Text
              style={{
                color: activeTab === "news" ? "#000" : "#aaa",
                fontWeight: "700",
              }}
            >
              News
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Chart Section */}
        <View style={styles.chartSection}>
          {/* Chart */}
          <View style={[styles.chartContainer, { paddingHorizontal: 16 }]}>
            {chartType === "candlestick" ? (
              <CompactCandlestickChart
                data={dailySeries.map((d) => ({
                  time: d.time,
                  open: d.open || d.close,
                  high: d.high || d.close,
                  low: d.low || d.close,
                  close: d.close,
                }))}
                height={200}
                greenColor="#00D4AA"
                redColor="#FF6B6B"
              />
            ) : (
              // Default to simple line chart for all other types on main screen
              <SimpleLineChart
                data={dailySeries}
                height={200}
                color={priceChange >= 0 ? "#00D4AA" : "#FF6B6B"}
                strokeWidth={chartType === "area" ? 1.5 : 2}
              />
            )}
          </View>

          {/* Chart Controls Row */}
          {/* Single compact bar: timeframes + chart type + settings + expand */}
          <ChartControls
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={(tf) => {
              setSelectedTimeframe(tf);
              // For broad pills, keep using the daily series; intraday is handled by extended picker
              if (
                tf === "1D" ||
                tf === "1W" ||
                tf === "1M" ||
                tf === "3M" ||
                tf === "1Y" ||
                tf === "ALL"
              ) {
                // Optionally refetch larger window if needed later
              }
            }}
            onSettingsPress={() => setShowChartSettings(true)}
            onTimeframePickerPress={() => setTfModalVisible(true)}
            onExpandPress={() =>
              (navigation as any).navigate("ChartFullScreen", {
                symbol,
                chartType,
                timeframe: selectedTimeframe,
              })
            }
            renderLeft={
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center" }}
              >
                {(pinned as ExtendedTimeframe[]).map((tf) => (
                  <Pressable
                    key={`pin-${tf}`}
                    onPress={() => applyExtendedTimeframe(tf)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor:
                        extendedTf === tf ? "#00D4AA" : "#1a1a1a",
                      marginRight: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: extendedTf === tf ? "#000" : "#ccc",
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      {tf}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            }
          />

          {/* Webull-style quick timeframe row */}
          {/* Remove the second row to avoid duplicate UI. The clock icon opens full timeframe picker. */}
        </View>

        {/* Signals */}
        {activeTab === "signals" && summary?.topSignal && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Trade Signal</Text>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {summary.topSignal.confidence.toFixed(0)}%
                </Text>
              </View>
            </View>
            <View style={styles.signalCard}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                {summary.topSignal.action.toUpperCase()} •{" "}
                {summary.topSignal.type.toUpperCase()}
              </Text>
              <Text style={{ color: "#ccc", marginTop: 6, fontSize: 12 }}>
                Entry ${summary.topSignal.entry.toFixed(2)} • Stop $
                {summary.topSignal.stopLoss.toFixed(2)} • Targets{" "}
                {summary.topSignal.targets.map((t) => t.toFixed(2)).join(", ")}
              </Text>
              <Text style={{ color: "#888", marginTop: 6, fontSize: 12 }}>
                R/R {summary.topSignal.riskReward}:1 • Size{" "}
                {summary.topSignal.tradePlan.positionSize}
              </Text>
            </View>
          </View>
        )}

        {/* Key Levels */}
        {activeTab === "signals" && analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Key Levels</Text>
            </View>
            {analysis.supportResistance.resistance.map((r, idx) => (
              <View key={`r-${idx}`} style={styles.levelRow}>
                <Text style={styles.levelLabel}>Resistance {idx + 1}</Text>
                <Text style={styles.levelValue}>${r.toFixed(2)}</Text>
              </View>
            ))}
            {analysis.supportResistance.support.map((s, idx) => (
              <View key={`s-${idx}`} style={styles.levelRow}>
                <Text style={styles.levelLabel}>Support {idx + 1}</Text>
                <Text style={styles.levelValue}>${s.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Confluence Zones */}
        {activeTab === "signals" && analysis?.zones && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Confluence Zones</Text>
            </View>

            {analysis.zones.buy.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    color: "#00D4AA",
                    fontWeight: "700",
                    marginBottom: 6,
                  }}
                >
                  Buy Zones
                </Text>
                {analysis.zones.buy.map((z, i) => (
                  <View key={`bz-${i}`} style={styles.signalCard}>
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {`$${z.range.low.toFixed(2)} - $${z.range.high.toFixed(
                        2
                      )}`}
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                      {`Mid $${z.midpoint.toFixed(
                        2
                      )} • Conf ${z.confidence.toFixed(0)}%`}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                      {z.confluenceFactors.slice(0, 4).join(" • ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {analysis.zones.sell.length > 0 && (
              <View>
                <Text
                  style={{
                    color: "#FF6B6B",
                    fontWeight: "700",
                    marginBottom: 6,
                  }}
                >
                  Sell Zones
                </Text>
                {analysis.zones.sell.map((z, i) => (
                  <View key={`sz-${i}`} style={styles.signalCard}>
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {`$${z.range.low.toFixed(2)} - $${z.range.high.toFixed(
                        2
                      )}`}
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                      {`Mid $${z.midpoint.toFixed(
                        2
                      )} • Conf ${z.confidence.toFixed(0)}%`}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                      {z.confluenceFactors.slice(0, 4).join(" • ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Timeframe modal */}
        <TimeframePickerModal
          visible={tfModalVisible}
          onClose={() => setTfModalVisible(false)}
          selected={extendedTf}
          onSelect={(tf) => applyExtendedTimeframe(tf)}
        />

        {/* News */}
        {activeTab === "news" && news.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest News</Text>
            </View>
            <NewsList items={news.slice(0, 20)} />
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                Add Note
              </Text>
              <Pressable onPress={() => setShowNoteModal(false)}>
                <Ionicons name="close" size={22} color="#888" />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Your trading note…"
              placeholderTextColor="#666"
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <Pressable style={styles.saveButton} onPress={onSaveNote}>
              <Ionicons name="save" size={16} color="#000" />
              <Text style={styles.saveButtonText}>Save Note</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Chart Settings Modal */}
      <ChartSettingsModal
        visible={showChartSettings}
        onClose={() => setShowChartSettings(false)}
        currentChartType={chartType}
        onChartTypeChange={setChartType}
      />
    </View>
  );
}
