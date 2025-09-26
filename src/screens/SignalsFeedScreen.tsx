import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  generateSignalSummary,
  type SignalSummary,
  convertSignalToTradePlan,
} from "../services/signalEngine";
import { useUserStore } from "../store/userStore";
import { useSignalCacheStore } from "../store/signalCacheStore";
import {
  runManagedScan,
  getAnalysisQuotaSummary,
} from "../services/analysisManager";
import { useTradingSignalsStore } from "../store/tradingSignalsStore";

const MIN_SCAN_INTERVAL_MS = 5 * 60 * 1000;

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reScanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00D4AA",
    backgroundColor: "#00D4AA",
  },
  reScanDisabled: {
    backgroundColor: "#1f3a36",
    borderColor: "#1f3a36",
  },
  reScanText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaText: { color: "#888888", fontSize: 12 },
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
  signalAction: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
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

export default function SignalsFeedScreen() {
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const cacheSignal = useSignalCacheStore((s) => s.cacheSignal);
  const getStoredScan = useTradingSignalsStore((s) => s.getScan);
  const saveStoredScan = useTradingSignalsStore((s) => s.saveScan);
  const lastSavedFilter = useTradingSignalsStore((s) => s.lastSelectedFilter);
  const setLastSavedFilter = useTradingSignalsStore(
    (s) => s.setLastSelectedFilter
  );

  const [signals, setSignals] = useState<SignalSummary[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState(
    lastSavedFilter || "all"
  );
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remainingRuns, setRemainingRuns] = useState<number | null>(null);
  const [usedRuns, setUsedRuns] = useState<number>(0);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number | null>(
    null
  );
  const [now, setNow] = useState(Date.now());

  const isMountedRef = useRef(false);

  const loadQuota = useCallback(async () => {
    try {
      const summary = await getAnalysisQuotaSummary();
      if (!isMountedRef.current) return;
      setRemainingRuns(summary.remainingRuns);
      setUsedRuns(summary.runsUsed);
    } catch (error) {
      console.error("Failed to load quota summary", error);
    }
  }, []);

  const triggerScan = useCallback(
    async (
      strategyId: string,
      options: { force?: boolean; showRefreshing?: boolean } = {}
    ) => {
      const { force = false, showRefreshing = false } = options;

      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      try {
        const response = await runManagedScan({
          filters: getFilterForStrategy(strategyId),
          force,
          cacheKey: `signals|${strategyId}`,
          cacheTtlMs: MIN_SCAN_INTERVAL_MS,
        });

        const topSymbols = response.results
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
              s.topSignal!.confidence >=
              (profile.signalConfidenceThreshold || 60)
          )
          .sort(
            (a, b) =>
              (b.topSignal?.confidence || 0) - (a.topSignal?.confidence || 0)
          );

        if (!isMountedRef.current) return;

        setSignals(filtered);
        setLastScanTimestamp(response.cacheTimestamp);
        setRemainingRuns(response.remainingRuns);
        setUsedRuns(response.usedRuns);

        saveStoredScan(strategyId, {
          filterId: strategyId,
          timestamp: response.cacheTimestamp,
          signals: filtered,
          remainingRuns: response.remainingRuns,
          usedRuns: response.usedRuns,
        });
      } catch (error: any) {
        console.error("Failed to run managed scan", error);
        if (!isMountedRef.current) return;
        const message =
          error?.code === "ANALYSIS_QUOTA_EXCEEDED"
            ? "Daily analysis limit reached. Upgrade to unlock more scans."
            : error?.message || "Failed to refresh trading signals.";
        Alert.alert("Scan failed", message);
      } finally {
        if (!isMountedRef.current) return;
        if (showRefreshing) {
          setRefreshing(false);
        } else {
          setInitialLoading(false);
        }
      }
    },
    [
      profile.accountSize,
      profile.riskPerTradePct,
      profile.signalConfidenceThreshold,
      saveStoredScan,
    ]
  );

  const hydrateFromCache = useCallback(
    async (strategyId: string) => {
      const cached = getStoredScan(strategyId);
      if (cached) {
        setSignals(cached.signals);
        setLastScanTimestamp(cached.timestamp);
        setRemainingRuns(cached.remainingRuns);
        setUsedRuns(cached.usedRuns);
        setInitialLoading(false);
        return;
      }

      await triggerScan(strategyId, { showRefreshing: false });
    },
    [getStoredScan, triggerScan]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastSavedFilter && lastSavedFilter !== selectedStrategy) {
      setSelectedStrategy(lastSavedFilter);
    }
  }, [lastSavedFilter, selectedStrategy]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await loadQuota();
      if (cancelled) return;
      await hydrateFromCache(selectedStrategy);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [selectedStrategy, loadQuota, hydrateFromCache]);

  const timeSinceLastScan = useMemo(() => {
    if (!lastScanTimestamp) return null;
    return now - lastScanTimestamp;
  }, [lastScanTimestamp, now]);

  const canRunNewScan = useMemo(() => {
    if (timeSinceLastScan === null) return true;
    return timeSinceLastScan >= MIN_SCAN_INTERVAL_MS;
  }, [timeSinceLastScan]);

  const cooldownLabel = useMemo(() => {
    if (timeSinceLastScan === null) return null;
    const remaining = Math.max(0, MIN_SCAN_INTERVAL_MS - timeSinceLastScan);
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  }, [timeSinceLastScan]);

  const scansRemainingText = useMemo(() => {
    if (remainingRuns === null || remainingRuns === undefined) return "∞";
    return remainingRuns.toString();
  }, [remainingRuns]);

  const formatRelativeTime = useCallback(
    (timestamp: number | null) => {
      if (!timestamp) return "Never";
      const diff = now - timestamp;
      if (diff < 60 * 1000) return "Just now";
      if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins === 1 ? "" : "s"} ago`;
      }
      if (diff < 24 * 60 * 60 * 1000) {
        const hrs = Math.floor(diff / (60 * 60 * 1000));
        return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
      }
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days === 1 ? "" : "s"} ago`;
    },
    [now]
  );

  const refreshSignals = useCallback(async () => {
    if (!canRunNewScan) {
      setRefreshing(false);
      Alert.alert(
        "Please wait",
        cooldownLabel
          ? `Next scan available in ${cooldownLabel}.`
          : "Scans are cooling down; try again shortly."
      );
      return;
    }

    await triggerScan(selectedStrategy, { force: true, showRefreshing: true });
  }, [canRunNewScan, cooldownLabel, selectedStrategy, triggerScan]);

  const handleReScan = useCallback(async () => {
    if (!canRunNewScan) {
      Alert.alert(
        "Please wait",
        cooldownLabel
          ? `Next scan available in ${cooldownLabel}.`
          : "Scans are cooling down; try again shortly."
      );
      return;
    }

    await triggerScan(selectedStrategy, {
      force: true,
      showRefreshing: signals.length > 0,
    });
  }, [
    canRunNewScan,
    cooldownLabel,
    selectedStrategy,
    signals.length,
    triggerScan,
  ]);

  const selectStrategy = useCallback(
    (strategyId: string) => {
      if (strategyId === selectedStrategy) return;
      setSelectedStrategy(strategyId);
      setLastSavedFilter(strategyId);
    },
    [selectedStrategy, setLastSavedFilter]
  );

  const renderSignal = useCallback(
    (summary: SignalSummary) => {
      const signal = summary.topSignal!;

      return (
        <Pressable
          key={summary.symbol}
          style={styles.signalCard}
          onPress={() => {
            const tradePlan = convertSignalToTradePlan(
              signal,
              profile.accountSize,
              profile.riskPerTradePct
            );

            cacheSignal({
              symbol: summary.symbol,
              tradePlan,
              aiMeta: {
                side: tradePlan.side,
                confidence: signal.confidence,
                why: signal.reasoning,
                targets: tradePlan.tps,
                riskReward: tradePlan.riskReward,
              },
              analysisContext: {
                mode: signal.type === "intraday" ? "day_trade" : "swing_trade",
                tradePace: signal.type === "intraday" ? "day" : "swing",
                desiredRR: tradePlan.riskReward || signal.riskReward,
                contextMode: "price_action",
                isAutoAnalysis: false,
              },
            });

            navigation.navigate(
              "ChartFullScreen" as never,
              {
                symbol: summary.symbol,
                tradePlan,
                ai: {
                  side: tradePlan.side,
                  confidence: signal.confidence,
                  targets: tradePlan.tps,
                  riskReward: tradePlan.riskReward,
                  why: signal.reasoning,
                },
                initialTimeframe:
                  signal.type === "intraday" ? "15m" : undefined,
                analysisContext: {
                  mode:
                    signal.type === "intraday" ? "day_trade" : "swing_trade",
                  tradePace: signal.type === "intraday" ? "day" : "swing",
                  desiredRR: tradePlan.riskReward || signal.riskReward,
                  contextMode: "price_action",
                  isAutoAnalysis: false,
                },
              } as never
            );
          }}
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
            Entry ${signal.entry.toFixed(2)} • Stop $
            {signal.stopLoss.toFixed(2)}• Targets{" "}
            {signal.targets.map((t) => t.toFixed(2)).join(", ")}
          </Text>

          <Text style={[styles.signalDetails, { marginTop: 4 }]}>
            Size {signal.tradePlan.positionSize}
          </Text>
        </Pressable>
      );
    },
    [profile.accountSize, profile.riskPerTradePct, cacheSignal, navigation]
  );

  if (initialLoading && signals.length === 0) {
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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View>
            <Text style={styles.headerTitle}>Trading Signals</Text>
            <Text style={styles.headerSubtitle}>
              {signals.length} active signals • Last scan{" "}
              {formatRelativeTime(lastScanTimestamp)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.reScanButton,
                (!canRunNewScan || refreshing) && styles.reScanDisabled,
              ]}
              disabled={!canRunNewScan || refreshing}
              onPress={handleReScan}
            >
              <Text style={styles.reScanText}>
                {canRunNewScan
                  ? "Re-Scan"
                  : cooldownLabel
                  ? `Re-Scan (${cooldownLabel})`
                  : "Re-Scan"}
              </Text>
            </Pressable>
            <Pressable
              style={{ padding: 8 }}
              onPress={() => setShowStrategyModal(true)}
            >
              <Ionicons name="options" size={24} color="#00D4AA" />
            </Pressable>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Scans remaining: {scansRemainingText}
          </Text>
          <Text style={styles.metaText}>Runs used today: {usedRuns}</Text>
          {!canRunNewScan && cooldownLabel && (
            <Text style={styles.metaText}>Next scan in: {cooldownLabel}</Text>
          )}
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
                onPress={() => selectStrategy(filter.id)}
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
            onRefresh={refreshSignals}
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
