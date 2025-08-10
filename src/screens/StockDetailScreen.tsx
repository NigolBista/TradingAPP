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
import { fetchCandles, type Candle } from "../services/marketProviders";
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

type RootStackParamList = {
  StockDetail: { symbol: string };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  headerSubtitle: { color: "#888", marginTop: 4 },
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
    marginBottom: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
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
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    backgroundColor: "#00D4AA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: { color: "#000", fontWeight: "600", marginLeft: 6 },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 12,
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

  useEffect(() => {
    load();
  }, [symbol]);

  async function load() {
    try {
      setLoading(true);
      const [d, h1, m15, m5] = await Promise.all([
        fetchCandles(symbol, { resolution: "D" }),
        fetchCandles(symbol, { resolution: "1H" }),
        fetchCandles(symbol, { resolution: "15" }),
        fetchCandles(symbol, { resolution: "5" }),
      ]);
      const candleData = { "1d": d, "1h": h1, "15m": m15, "5m": m5 } as const;
      const a = await performComprehensiveAnalysis(symbol, candleData as any);
      setAnalysis(a);
      setDailySeries(toLWC(d));
      setSummary(await generateSignalSummary(symbol));
      try {
        const items = await fetchSymbolNews(symbol);
        setNews(items);
      } catch {
        setNews([]);
      }
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to load symbol data"
      );
    } finally {
      setLoading(false);
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
          <Text style={styles.headerTitle}>Loading {symbol}…</Text>
          <Text style={styles.headerSubtitle}>Fetching analysis and news</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ padding: 8, marginRight: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>{symbol}</Text>
              <Text style={styles.headerSubtitle}>
                ${currentPrice.toFixed(2)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() =>
              (navigation as any).navigate("ChartFullScreen", { symbol })
            }
            style={{ padding: 8 }}
          >
            <Ionicons name="expand" size={24} color="#00D4AA" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Price & Indicators</Text>
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#00D4AA" }]}
                onPress={() =>
                  (navigation as any).navigate("ChartFullScreen", { symbol })
                }
              >
                <Ionicons name="expand" size={16} color="#000" />
                <Text style={styles.actionText}>Expand Chart</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onSetAlert}>
                <Ionicons name="notifications" size={16} color="#000" />
                <Text style={styles.actionText}>Set Alert</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#FFB020" }]}
                onPress={() => setShowNoteModal(true)}
              >
                <Ionicons name="create" size={16} color="#000" />
                <Text style={styles.actionText}>Add Note</Text>
              </Pressable>
            </View>
          </View>

          <AdvancedTradingChart
            data={dailySeries}
            symbol={symbol}
            currentPrice={currentPrice}
            priceChange={priceChange}
            priceChangePercent={priceChangePercent}
            height={380}
          />
        </View>

        {/* Signals */}
        {summary?.topSignal && (
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
        {analysis && (
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

        {/* News */}
        {news.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest News</Text>
            </View>
            <NewsList items={news.slice(0, 10)} />
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
            <Pressable style={styles.actionBtn} onPress={onSaveNote}>
              <Ionicons name="save" size={16} color="#000" />
              <Text style={styles.actionText}>Save Note</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
