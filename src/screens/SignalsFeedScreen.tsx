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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  generateSignalSummary,
  type SignalSummary,
  convertSignalToTradePlan,
} from "../services/signalEngine";
import { useUserStore, type StrategyGroup } from "../store/userStore";
import { useStrategyBuilderStore } from "../store/strategyBuilderStore";
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
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  headerSubtitle: { color: "#888888", fontSize: 14, marginTop: 4 },
  headerStrip: {
    marginTop: 8,
    backgroundColor: "#141414",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  stripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stripText: { color: "#cbd5e1", fontSize: 12 },
  stripMeta: { color: "#94a3b8", fontSize: 12 },
  metadataRow: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metadataItem: { color: "#94a3b8", fontSize: 12 },
  controlsRow: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  dropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#161616",
  },
  dropdownText: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  filterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#161616",
  },
  filterTriggerText: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  filtersOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    paddingTop: 120,
  },
  filtersCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
  },
  scanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00D4AA",
    backgroundColor: "#00D4AA",
  },
  scanDisabled: {
    backgroundColor: "#1f3a36",
    borderColor: "#1f3a36",
  },
  scanText: {
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
    alignItems: "center",
  },
  filterTabs: {
    marginTop: 12,
  },
  filterTabsContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scopeToggle: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  scopeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#0f0f0f",
  },
  scopeBtnActive: { backgroundColor: "#00D4AA", borderColor: "#00D4AA" },
  scopeBtnText: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  scopeBtnTextActive: { color: "#111827" },
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
    padding: 12,
    marginBottom: 8,
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  signalSymbol: { fontSize: 16, fontWeight: "bold", color: "#ffffff" },
  signalAction: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  buyAction: { color: "#00D4AA" },
  sellAction: { color: "#FF5722" },
  signalType: { fontSize: 11, color: "#888888", marginBottom: 6 },
  signalDetails: { fontSize: 11, color: "#cccccc", marginTop: 4 },
  confidenceBadge: {
    backgroundColor: "#00D4AA",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  confidenceText: { fontSize: 10, fontWeight: "600", color: "#000000" },
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
  strategyItemActive: {
    backgroundColor: "rgba(0, 212, 170, 0.08)",
  },
  strategyName: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  strategyDesc: { fontSize: 14, color: "#888888", marginTop: 4 },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupMeta: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  configModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  configCard: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#111827",
    padding: 20,
  },
  configTitle: {
    fontSize: 20,
    color: "#f8fafc",
    fontWeight: "700",
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 13,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pickerTrigger: {
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerValue: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  pickerList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0b1220",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  pickerOptionActive: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
  },
  pickerOptionText: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  pickerOptionSub: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  pickerRow: { marginBottom: 20 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00D4AA",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  checkboxBoxActive: {
    backgroundColor: "#00D4AA",
  },
  checkboxLabel: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  checkboxDescription: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  configActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  configAction: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  configActionPrimary: {
    backgroundColor: "#00D4AA",
    borderColor: "#00D4AA",
  },
  configActionText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  configActionTextPrimary: {
    color: "#0f172a",
    fontWeight: "700",
  },
  bottomMetaRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0a0a0a",
  },
  navPrimaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#00D4AA",
    shadowOffset: { width: 0, height: 0 },
    minWidth: 120,
    flex: 1.2,
    marginHorizontal: 6,
    backgroundColor: "#00D4AA",
  },
  navPrimaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  bottomNav: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    backgroundColor: "#0a0a0a",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  bottomNavContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomMetaText: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
  },
  bottomNavButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 110,
    flex: 1,
    marginHorizontal: 4,
  },
  bottomNavButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  bottomMetaText: {
    color: "#888888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
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
  const setProfile = useUserStore((s) => s.setProfile);
  const cacheSignal = useSignalCacheStore((s) => s.cacheSignal);
  const getStoredScan = useTradingSignalsStore((s) => s.getScan);
  const saveStoredScan = useTradingSignalsStore((s) => s.saveScan);
  const lastSavedFilter = useTradingSignalsStore((s) => s.lastSelectedFilter);
  const setLastSavedFilter = useTradingSignalsStore(
    (s) => s.setLastSelectedFilter
  );
  const ensureGroupDefaults = useStrategyBuilderStore(
    (s) => s.ensureGroupDefaults
  );

  const strategyGroups = useMemo<StrategyGroup[]>(() => {
    const owned = Array.isArray(profile.strategyGroups)
      ? (profile.strategyGroups as StrategyGroup[])
      : [];
    const subscribed = Array.isArray(profile.subscribedStrategyGroups)
      ? (profile.subscribedStrategyGroups as StrategyGroup[])
      : [];

    const merged = [...owned, ...subscribed];
    const byId = new Map<string, StrategyGroup>();
    merged.forEach((group) => {
      if (group?.id) {
        byId.set(group.id, group);
      }
    });

    const defaultGroup: StrategyGroup = {
      id: "default",
      name: "Default Strategy",
      description: "Use your default AI trading strategy",
    };

    if (byId.has("default")) {
      const existing = byId.get("default")!;
      byId.set("default", { ...defaultGroup, ...existing });
    } else {
      byId.set("default", defaultGroup);
    }

    return Array.from(byId.values()).sort((a, b) => {
      if (a.id === "default") return -1;
      if (b.id === "default") return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [profile.strategyGroups, profile.subscribedStrategyGroups]);

  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (
      profile.selectedStrategyGroupId &&
      strategyGroups.some(
        (group) => group.id === profile.selectedStrategyGroupId
      )
    ) {
      return profile.selectedStrategyGroupId;
    }
    return "default";
  });
  const [signals, setSignals] = useState<SignalSummary[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState(
    lastSavedFilter || "all"
  );
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [useFavorites, setUseFavorites] = useState(true);
  const [useGroupWatchlist, setUseGroupWatchlist] = useState(true);
  const [pendingConfig, setPendingConfig] = useState({
    groupId: selectedGroupId,
    useFavorites: true,
    useGroupWatchlist: true,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remainingRuns, setRemainingRuns] = useState<number | null>(null);
  const [usedRuns, setUsedRuns] = useState<number>(0);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number | null>(
    null
  );
  const [now, setNow] = useState(Date.now());
  const [showFilters, setShowFilters] = useState(false);

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
        const isDefaultGroup = selectedGroupId === "default";
        const scope = (() => {
          if (useFavorites && useGroupWatchlist && !isDefaultGroup) {
            return "group";
          }
          if (useGroupWatchlist && !isDefaultGroup) {
            return "group";
          }
          return "favorites";
        })();

        const response = await runManagedScan({
          filters: getFilterForStrategy(strategyId),
          scope,
          groupId: isDefaultGroup ? undefined : selectedGroupId,
          symbols:
            scope === "favorites" && useFavorites && useGroupWatchlist
              ? undefined
              : undefined,
          force,
          cacheKey: `signals|${selectedGroupId}|${strategyId}|${scope}`,
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

        saveStoredScan(`${selectedGroupId}|${strategyId}`, {
          filterId: strategyId,
          groupId: selectedGroupId,
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
      selectedGroupId,
      useFavorites,
      useGroupWatchlist,
    ]
  );

  const hydrateFromCache = useCallback(
    async (strategyId: string, groupId: string) => {
      const cacheKey = `${groupId}|${strategyId}`;
      const cached = getStoredScan(cacheKey);
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
      await hydrateFromCache(selectedStrategy, selectedGroupId);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [selectedStrategy, selectedGroupId, loadQuota, hydrateFromCache]);

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

    await triggerScan(selectedStrategy, {
      force: true,
      showRefreshing: true,
    });
  }, [canRunNewScan, cooldownLabel, selectedStrategy, triggerScan]);

  useEffect(() => {
    if (showConfigModal) {
      setPendingConfig({
        groupId: selectedGroupId,
        useFavorites,
        useGroupWatchlist,
      });
    }
  }, [showConfigModal, selectedGroupId, useFavorites, useGroupWatchlist]);

  const handleSelectStrategy = useCallback(
    (strategyId: string) => {
      if (strategyId === selectedStrategy) {
        return;
      }
      setSelectedStrategy(strategyId);
      setLastSavedFilter(strategyId);
      hydrateFromCache(strategyId, selectedGroupId).catch((error) => {
        console.error("Failed to hydrate scan for filter change", error);
        triggerScan(strategyId, { showRefreshing: false });
      });
    },
    [
      selectedStrategy,
      selectedGroupId,
      setLastSavedFilter,
      hydrateFromCache,
      triggerScan,
    ]
  );

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      if (groupId === selectedGroupId) {
        setShowStrategyModal(false);
        return;
      }

      setSelectedGroupId(groupId);
      setShowStrategyModal(false);

      if (!isMountedRef.current) return;
      setInitialLoading(true);

      hydrateFromCache(selectedStrategy, groupId).catch((error) => {
        console.error("Failed to hydrate scan for new group", error);
        triggerScan(selectedStrategy, { showRefreshing: false });
      });
    },
    [selectedGroupId, selectedStrategy, hydrateFromCache, triggerScan]
  );

  const handleApplyConfig = useCallback(() => {
    setSelectedGroupId(pendingConfig.groupId);
    setUseFavorites(pendingConfig.useFavorites);
    setUseGroupWatchlist(pendingConfig.useGroupWatchlist);
    setShowConfigModal(false);
  }, [pendingConfig]);

  useEffect(() => {
    if (selectedGroupId === "default") {
      setProfile({ selectedStrategyGroupId: undefined });
      return;
    }

    const group = strategyGroups.find((g) => g.id === selectedGroupId);
    setProfile({ selectedStrategyGroupId: selectedGroupId });

    ensureGroupDefaults(selectedGroupId, {
      groupName: group?.name,
      tradeMode: selectedStrategy === "intraday" ? "day" : "swing",
    });
  }, [
    selectedGroupId,
    selectedStrategy,
    setProfile,
    ensureGroupDefaults,
    strategyGroups,
  ]);

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

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={[
                styles.signalAction,
                signal.action === "buy" ? styles.buyAction : styles.sellAction,
              ]}
            >
              {signal.action}
            </Text>
            <Text style={styles.signalType}>
              {signal.type.toUpperCase()} • R/R {signal.riskReward}:1 • Size{" "}
              {signal.tradePlan.positionSize}
            </Text>
          </View>

          <Text style={styles.signalDetails}>
            Entry ${signal.entry.toFixed(2)} • Stop $
            {signal.stopLoss.toFixed(2)}• Targets{" "}
            {signal.targets.map((t) => t.toFixed(2)).join(", ")}
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color="#e5e7eb" />
            </Pressable>
            <Text style={styles.headerTitle}>Trading Signals</Text>
          </View>
        </View>
      </View>

      {/* Content */}

      {/* Signals List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 180 }}
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

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          <Pressable
            onPress={() => setShowFilters(true)}
            style={styles.bottomNavButton}
            hitSlop={8}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color="rgba(255,255,255,0.9)"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.bottomNavButtonText} numberOfLines={1}>
              {STRATEGY_FILTERS.find((f) => f.id === selectedStrategy)?.label ||
                "All Signals"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navPrimaryButton,
              (!canRunNewScan || refreshing) && styles.scanDisabled,
            ]}
            disabled={!canRunNewScan || refreshing}
            onPress={refreshSignals}
            hitSlop={10}
          >
            <Ionicons
              name="scan-outline"
              size={16}
              color={!canRunNewScan || refreshing ? "#0f172a" : "#0f172a"}
              style={{ marginRight: 8, opacity: 0.9 }}
            />
            <Text style={styles.navPrimaryButtonText}>
              {canRunNewScan
                ? "Scan"
                : cooldownLabel
                ? `Scan (${cooldownLabel})`
                : "Scan"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowConfigModal(true)}
            style={styles.bottomNavButton}
            hitSlop={8}
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color="rgba(255,255,255,0.9)"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.bottomNavButtonText}>Settings</Text>
          </Pressable>
        </View>
        <Text style={styles.bottomMetaText} numberOfLines={1}>
          {`Last Scan ${formatRelativeTime(
            lastScanTimestamp
          )} • Left Scan ${scansRemainingText} / ${usedRuns}${
            !canRunNewScan && cooldownLabel ? ` • Next ${cooldownLabel}` : ""
          }`}
        </Text>
      </View>

      <Modal
        visible={showFilters}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable
          style={styles.filtersOverlay}
          onPress={() => setShowFilters(false)}
        >
          <View style={styles.filtersCard}>
            <ScrollView>
              {STRATEGY_FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  onPress={() => {
                    setShowFilters(false);
                    handleSelectStrategy(filter.id);
                  }}
                  style={[
                    styles.strategyItem,
                    selectedStrategy === filter.id && styles.strategyItemActive,
                  ]}
                >
                  <Text style={styles.strategyName}>{filter.label}</Text>
                  <Text style={styles.strategyDesc}>{filter.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showConfigModal}
        transparent
        animationType="slide"
        onRequestClose={handleApplyConfig}
      >
        <View style={styles.configModal}>
          <Pressable style={{ flex: 1 }} onPress={handleApplyConfig} />
          <View style={[styles.configCard, { paddingBottom: 8 }]}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#334155",
                }}
              />
            </View>
            <Text style={styles.configTitle}>Signal Configuration</Text>

            <View style={styles.pickerRow}>
              <Text style={styles.configLabel}>Strategy Group</Text>
              <Pressable
                style={styles.pickerTrigger}
                onPress={() => setShowGroupPicker((prev) => !prev)}
              >
                <Text style={styles.pickerValue}>
                  {strategyGroups.find(
                    (group) => group.id === pendingConfig.groupId
                  )?.name || "Default Strategy"}
                </Text>
                <Ionicons
                  name={showGroupPicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#94a3b8"
                />
              </Pressable>
              {showGroupPicker && (
                <View style={styles.pickerList}>
                  {strategyGroups.map((group) => (
                    <Pressable
                      key={group.id}
                      style={[
                        styles.pickerOption,
                        pendingConfig.groupId === group.id &&
                          styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setPendingConfig((cfg) => ({
                          ...cfg,
                          groupId: group.id,
                        }));
                        setShowGroupPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{group.name}</Text>
                      <Text style={styles.pickerOptionSub}>
                        {group.description ||
                          (group.id === "default"
                            ? "System-managed strategy"
                            : "Custom group strategy")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.configLabel}>Use Watchlists</Text>
              <View style={styles.pickerList}>
                <Pressable
                  style={styles.pickerOption}
                  onPress={() =>
                    setPendingConfig((cfg) => ({
                      ...cfg,
                      useFavorites: !cfg.useFavorites,
                    }))
                  }
                >
                  <View style={styles.checkboxRow}>
                    <View
                      style={[
                        styles.checkboxBox,
                        pendingConfig.useFavorites && styles.checkboxBoxActive,
                      ]}
                    >
                      {pendingConfig.useFavorites && (
                        <Ionicons name="checkmark" size={14} color="#0f172a" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.checkboxLabel}>Favorites</Text>
                      <Text style={styles.checkboxDescription}>
                        Scan symbols in your personal favorites/watchlists
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.pickerOption}
                  onPress={() =>
                    setPendingConfig((cfg) => ({
                      ...cfg,
                      useGroupWatchlist: !cfg.useGroupWatchlist,
                    }))
                  }
                >
                  <View style={styles.checkboxRow}>
                    <View
                      style={[
                        styles.checkboxBox,
                        pendingConfig.useGroupWatchlist &&
                          styles.checkboxBoxActive,
                      ]}
                    >
                      {pendingConfig.useGroupWatchlist && (
                        <Ionicons name="checkmark" size={14} color="#0f172a" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.checkboxLabel}>Group Watchlist</Text>
                      <Text style={styles.checkboxDescription}>
                        Scan symbols from the selected strategy group
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
