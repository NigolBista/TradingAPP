import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { MarketScanner, type ScanResult } from "../../../shared/services/marketScanner";
import {
  generateSignalSummary,
  type SignalSummary,
} from "../../../shared/services/signalEngine";
import { useUserStore } from "../../../store/userStore";

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
  section: {
    backgroundColor: "#1a1a1a",
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
    borderColor: "#333333",
    backgroundColor: "transparent",
  },
  filterChipActive: { backgroundColor: "#00D4AA", borderColor: "#00D4AA" },
  filterChipText: { fontSize: 12, color: "#ffffff", fontWeight: "500" },
  filterChipTextActive: { color: "#000000" },
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
  signalSymbol: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
  signalAction: { fontSize: 14, fontWeight: "600", textTransform: "uppercase" },
  buyAction: { color: "#00D4AA" },
  sellAction: { color: "#FF5722" },
  signalType: { fontSize: 12, color: "#888888", marginBottom: 8 },
  signalDetails: { fontSize: 12, color: "#cccccc", marginTop: 6 },
  confidenceBadge: {
    backgroundColor: "#00D4AA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: { fontSize: 12, fontWeight: "600", color: "#000000" },
  strategyModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
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
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#ffffff" },
  strategyItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  strategyName: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  strategyDesc: { fontSize: 14, color: "#888888", marginTop: 4 },
});

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

export default function SignalsFeedScreen() {
  const navigation = useNavigation();
  const profile = useUserStore((s) => s.profile);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signals, setSignals] = useState<SignalSummary[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState("all");
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  useEffect(() => {
    loadSignals();
  }, [selectedStrategy]);

  async function loadSignals() {
    try {
      setLoading(true);

      // Get market signals based on filter
      const scanFilter = getFilterForStrategy(selectedStrategy);
      const scanResults = await MarketScanner.scanMarket(scanFilter);

      // Generate signal summaries for top results
      const topSymbols = scanResults
        .filter((r) => r.analysis.signals.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((r) => r.symbol);

      const summaries = await Promise.all(
        topSymbols.map((symbol) =>
          generateSignalSummary(
            symbol,
            profile.accountSize,
            profile.riskPerTradePct
          )
        )
      );

      const filtered = summaries
        .filter((s): s is SignalSummary => !!s && !!s.topSignal)
        .filter(
          (s) =>
            s.topSignal!.confidence >= (profile.signalConfidenceThreshold || 60)
        )
        .sort(
          (a, b) =>
            (b.topSignal?.confidence || 0) - (a.topSignal?.confidence || 0)
        );

      setSignals(filtered);
    } catch (error) {
      console.error("Error loading signals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    setRefreshing(true);
    await loadSignals();
  }

  function renderSignal(summary: SignalSummary) {
    const signal = summary.topSignal!;

    return (
      <Pressable
        key={summary.symbol}
        style={styles.signalCard}
        onPress={() =>
          navigation.navigate(
            "StockDetail" as never,
            { symbol: summary.symbol } as never
          )
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
          {signal.tradePlan.maxRiskAmount?.toFixed(0) || "N/A"}
        </Text>
      </Pressable>
    );
  }

  if (loading && signals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trading Signals</Text>
          <Text style={styles.headerSubtitle}>Loading AI signals...</Text>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.headerTitle}>Trading Signals</Text>
            <Text style={styles.headerSubtitle}>
              {signals.length} active signals • AI-powered
            </Text>
          </View>
          <Pressable
            style={{ padding: 8 }}
            onPress={() => setShowStrategyModal(true)}
          >
            <Ionicons name="options" size={24} color="#00D4AA" />
          </Pressable>
        </View>
      </View>

      {/* Strategy Filters */}
      <View style={styles.section}>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "600",
            marginBottom: 12,
          }}
        >
          Strategy Filter
        </Text>
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
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
          />
        }
      >
        {signals.length === 0 ? (
          <View style={{ alignItems: "center", padding: 32 }}>
            <Ionicons name="radio-outline" size={48} color="#888888" />
            <Text
              style={{ color: "#888888", textAlign: "center", marginTop: 12 }}
            >
              No signals match your current filter. Try adjusting the strategy
              or check back later.
            </Text>
          </View>
        ) : (
          signals.map(renderSignal)
        )}
      </ScrollView>

      {/* Strategy Info Modal */}
      <Modal
        visible={showStrategyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStrategyModal(false)}
      >
        <View style={styles.strategyModal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trading Strategies</Text>
              <Pressable onPress={() => setShowStrategyModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </Pressable>
            </View>

            <ScrollView>
              {STRATEGY_FILTERS.map((strategy) => (
                <View key={strategy.id} style={styles.strategyItem}>
                  <Text style={styles.strategyName}>{strategy.label}</Text>
                  <Text style={styles.strategyDesc}>
                    {strategy.description}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
