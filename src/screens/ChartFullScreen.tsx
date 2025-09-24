import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Text,
  useColorScheme,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SimpleKLineChart, {
  type IndicatorConfig,
} from "../components/charts/SimpleKLineChart";
import { type ChartType } from "../components/charts/ChartSettingsModal";
import { ExtendedTimeframe } from "../components/charts/TimeframePickerModal";
import ChartHeader from "./ChartFullScreen/ChartHeader";
import IndicatorsAccordion from "./ChartFullScreen/IndicatorsAccordion";
import OHLCRow from "./ChartFullScreen/OHLCRow";
import TimeframeBar from "./ChartFullScreen/TimeframeBar";
import UnifiedBottomSheet from "./ChartFullScreen/UnifiedBottomSheet";
import ComplexityBottomSheet from "./ChartFullScreen/ComplexityBottomSheet";
import ReasoningBottomSheet from "./ChartFullScreen/ReasoningBottomSheet";
import IndicatorsSheet from "./ChartFullScreen/IndicatorsSheet";
import {
  toggleIndicatorInList,
  updateIndicatorLineInList,
  addIndicatorParamInList,
  removeIndicatorParamInList,
  getDefaultIndicator,
  buildDefaultLines,
} from "./ChartFullScreen/indicators";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
import { fetchNews as fetchSymbolNews } from "../services/newsProviders";
import {
  runAIStrategy,
  aiOutputToTradePlan,
  applyComplexityToPlan,
} from "../logic/aiStrategyEngine";
import {
  registerChartBridge,
  unregisterChartBridge,
  type ChartAction,
  updateChartState,
} from "../logic/chartBridge";
import { useChatStore } from "../store/chatStore";
import { useSignalCacheStore } from "../store/signalCacheStore";
import { useUserStore } from "../store/userStore";
import { useAlertStore } from "../store/alertStore";
import alertsService from "../services/alertsService";
import { useAuth } from "../providers/AuthProvider";
import { StrategyComplexity } from "../logic/types";
import { sendSignal } from "../services/signalService";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../logic/strategyComplexity";
import { fetchSingleQuote, type SimpleQuote } from "../services/quotes";
// removed unused federalReserve import
import {
  fetchCandles,
  fetchCandlesForTimeframe,
  type Candle,
} from "../services/marketProviders";
// removed unused timeframeSpacingMs
import { buildDayTradePlan } from "../logic/dayTrade";
import { buildSwingTradePlan } from "../logic/swingTrade";
import useMarketStatus from "../hooks/useMarketStatus";
import {
  getUserChartSettings,
  upsertUserChartSettings,
} from "../services/chartSettingsService";
import { useComposeDraftStore } from "../store/composeDraftStore";
import useTradeDraftSync from "../hooks/useTradeDraftSync";
import {
  upsertUserDraftPlan,
  deleteUserDraftPlan,
} from "../services/draftPlanService";

// Types
type AIMeta = {
  strategyChosen?: string;
  side?: "long" | "short";
  confidence?: number;
  why?: string[];
  notes?: string[];
  targets?: number[];
  riskReward?: number;
};

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  // Route params
  const symbol: string = route.params?.symbol || "AAPL";
  const initialTimeframe: string | undefined = route.params?.initialTimeframe;
  const isDayUp: boolean | undefined = route.params?.isDayUp;
  const initialDataParam: any[] | undefined = route.params?.initialData;
  const initialTradePlan: any | undefined = route.params?.tradePlan;
  const initialAiMeta: AIMeta | undefined = route.params?.ai;
  const initialAnalysisContext = route.params?.analysisContext;

  // Store hooks
  const { addAnalysisMessage } = useChatStore();
  const { cacheSignal, getCachedSignal } = useSignalCacheStore();
  const { profile, setProfile } = useUserStore();
  const { addAlert, updateAlert } = useAlertStore();
  const upsertAlert = useAlertStore((s) => s.upsertAlert);
  const { user } = useAuth();
  const allAlerts = useAlertStore((s) => s.alerts);
  const alertsForSymbol = React.useMemo(
    () => allAlerts.filter((a) => a.symbol === symbol),
    [allAlerts, symbol]
  );
  const alertLines = React.useMemo(
    () =>
      alertsForSymbol.map((alert) => ({
        id: alert.id,
        price: alert.price,
        condition: alert.condition,
        isActive: alert.isActive,
      })),
    [alertsForSymbol]
  );

  // Debug logging for alert changes
  React.useEffect(() => {
    console.log(
      `[ChartFullScreen] Alerts for ${symbol}:`,
      alertsForSymbol.length
    );
  }, [symbol, alertsForSymbol]);
  const { pinned, defaultTimeframe, hydrate, setDefaultTimeframe, toggle } =
    useTimeframeStore();

  // Core state
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>(
    (initialTimeframe as ExtendedTimeframe) || defaultTimeframe || "1D"
  );
  const [stockName, setStockName] = useState<string>("");
  const [dayUp, setDayUp] = useState<boolean | undefined>(isDayUp);
  const [chartType, setChartType] = useState<ChartType>(
    (route.params?.chartType as ChartType) || "candlestick"
  );

  // UI state
  const [showUnifiedBottomSheet, setShowUnifiedBottomSheet] = useState(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [currentTradePlan, setCurrentTradePlan] = useState<any | undefined>(
    initialTradePlan
  );
  const [showMA, setShowMA] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(false);
  const [showSessions] = useState<boolean>(true); // Always enabled
  const [areaStyle, setAreaStyle] = useState<any | undefined>(undefined);
  const [priceColors, setPriceColors] = useState<{
    up: string;
    down: string;
    noChange?: string;
  }>({ up: "#10B981", down: "#EF4444" });
  // Use accordion expansion to influence layout height; no separate expanded state

  // Indicators state
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const latestIndicatorsRef = useRef<IndicatorConfig[]>([]);
  const styleRetryRef = useRef<NodeJS.Timeout | null>(null);
  const [showIndicatorsSheet, setShowIndicatorsSheet] = useState(false);
  const [showIndicatorsAccordion, setShowIndicatorsAccordion] = useState(false);
  // Compose mode state for crosshair actions
  const [composeMode, setComposeMode] = useState<boolean>(false);
  const [composeButtons, setComposeButtons] = useState<
    Array<{ id: string; label: string; icon?: string }>
  >([]);
  const [composeDraft, setComposeDraft] = useState<{
    entries: number[];
    exits: number[];
    tps: number[];
  }>({ entries: [], exits: [], tps: [] });

  const drafts = useComposeDraftStore((s) => s.drafts);
  const setDraftPlan = useComposeDraftStore((s) => s.setDraftPlan);
  const clearDraftPlan = useComposeDraftStore((s) => s.clearDraftPlan);

  useTradeDraftSync({ symbol, userId: user?.id });

  const composeDraftFromPlan = useCallback((plan: any) => {
    if (!plan) {
      return { entries: [], exits: [], tps: [] };
    }
    return {
      entries: Array.isArray(plan.entries) ? [...plan.entries] : [],
      exits: Array.isArray(plan.exits) ? [...plan.exits] : [],
      tps: Array.isArray(plan.tps) ? [...plan.tps] : [],
    };
  }, []);

  const createDraftSignature = useCallback(
    (draft: { entries: number[]; exits: number[]; tps: number[] }) =>
      JSON.stringify({
        entries: Array.isArray(draft.entries) ? draft.entries : [],
        exits: Array.isArray(draft.exits) ? draft.exits : [],
        tps: Array.isArray(draft.tps) ? draft.tps : [],
      }),
    []
  );

  const composeDraftSignature = React.useMemo(
    () => createDraftSignature(composeDraft),
    [composeDraft, createDraftSignature]
  );
  const emptyDraftSignature = React.useMemo(
    () => createDraftSignature({ entries: [], exits: [], tps: [] }),
    [createDraftSignature]
  );
  // Keep chart overlays in sync with cached signal persistence
  const signalsMap = useSignalCacheStore((s) => s.signals);
  const cachedPlanForSymbol = React.useMemo(() => {
    const cached = signalsMap[symbol];
    return cached && cached.tradePlan ? cached.tradePlan : null;
  }, [signalsMap, symbol]);
  const draftForSymbol = React.useMemo(() => {
    return drafts[symbol] || null;
  }, [drafts, symbol]);

  useEffect(() => {
    const next = composeDraftFromPlan(draftForSymbol);
    const nextSignature = createDraftSignature(next);

    if (!draftForSymbol) {
      if (composeDraftSignature !== emptyDraftSignature) {
        setComposeDraft({ entries: [], exits: [], tps: [] });
        skipRemotePersistRef.current = true;
        lastRemotePayloadRef.current = emptyDraftSignature;
      }
      return;
    }

    if (composeDraftSignature !== nextSignature) {
      setComposeDraft(next);
      skipRemotePersistRef.current = true;
      lastRemotePayloadRef.current = nextSignature;
    }
  }, [
    draftForSymbol,
    composeDraftFromPlan,
    composeDraftSignature,
    createDraftSignature,
    emptyDraftSignature,
  ]);

  useEffect(() => {
    try {
      if (!chartBridgeRef.current) return;
      const plan: any =
        draftForSymbol || cachedPlanForSymbol || currentTradePlan;
      if (plan) {
        console.log("🔄 Applying levels in ChartFullScreen:", plan);
        chartBridgeRef.current.updateLevels({
          entries: plan.entries,
          exits: plan.exits?.length ? plan.exits : [],
          tps: plan.tps,
        });
      } else {
        // Clear levels if no cached plan exists
        chartBridgeRef.current.updateLevels({});
      }
    } catch (_) {}
  }, [cachedPlanForSymbol, currentTradePlan, draftForSymbol]);

  // Re-apply levels when timeframe changes (like alerts do)
  useEffect(() => {
    try {
      if (!chartBridgeRef.current) return;
      const plan: any =
        draftForSymbol || cachedPlanForSymbol || currentTradePlan;
      if (plan) {
        // Small delay to ensure chart has updated timeframe first
        setTimeout(() => {
          try {
            if (chartBridgeRef.current) {
              chartBridgeRef.current.updateLevels({
                entries: plan.entries,
                exits: plan.exits?.length ? plan.exits : [],
                tps: plan.tps,
              });
            }
          } catch (_) {}
        }, 150);
      }
    } catch (_) {}
  }, [cachedPlanForSymbol, currentTradePlan, draftForSymbol, extendedTf]);

  // Analysis state
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);
  const [aiMeta, setAiMeta] = useState<AIMeta | undefined>(initialAiMeta);

  // Trading mode state
  const [mode, setMode] = useState<"auto" | "day_trade" | "swing_trade">(
    initialAnalysisContext?.mode === "day_trade"
      ? "day_trade"
      : initialAnalysisContext?.mode === "swing_trade"
      ? "swing_trade"
      : "auto"
  );

  // Trading configuration
  const [tradePace, setTradePace] = useState<
    "auto" | "day" | "scalp" | "swing"
  >((initialAnalysisContext?.tradePace as any) || profile.tradePace || "auto");
  const [contextLookback, setContextLookback] = useState<{
    mode: "auto" | "fixed";
    ms?: number;
  }>({
    mode: (initialAnalysisContext?.contextLookback?.mode as any) || "auto",
    ms: initialAnalysisContext?.contextLookback?.ms,
  });
  const [desiredRR, setDesiredRR] = useState<number>(
    initialAnalysisContext?.desiredRR || 1.5
  );
  const [contextMode, setContextMode] = useState<
    "price_action" | "news_sentiment"
  >(
    (initialAnalysisContext?.contextMode as any) ||
      profile.contextMode ||
      "price_action"
  );
  const [tradeMode, setTradeMode] = useState<"day" | "swing">(
    profile.tradeMode || "day"
  );
  const [showCustomRrModal, setShowCustomRrModal] = useState<boolean>(false);

  // Analysis and streaming state
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [showReasoning, setShowReasoning] = useState<boolean>(false);
  const [hasExistingReasoning, setHasExistingReasoning] = useState<boolean>(
    !!initialAiMeta
  );

  // Bottom sheet states
  const [showComplexityBottomSheet, setShowComplexityBottomSheet] =
    useState<boolean>(false);
  const [selectedComplexity, setSelectedComplexity] =
    useState<StrategyComplexity>("advanced");
  const [showReasoningBottomSheet, setShowReasoningBottomSheet] =
    useState<boolean>(false);
  const [showReasonIcon] = useState<boolean>(true); // Always enabled
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [proposedAlertPrice, setProposedAlertPrice] = useState<number | null>(
    null
  );
  const marketStatus = useMarketStatus();

  // Refs
  const [pinError, setPinError] = useState<string | null>(null);
  const overrideIndicatorRef = React.useRef<
    | ((
        id: string | { name: string; paneId?: string },
        styles: any,
        calcParams?: any
      ) => void)
    | null
  >(null);

  const chartBridgeRef = React.useRef<{
    updateTimeframe: (timeframe: string) => void;
    updateChartType: (chartType: string) => void;
    updateIndicators: (indicators: IndicatorConfig[]) => void;
    updateDisplayOptions: (options: any) => void;
    updateTheme: (theme: string) => void;
    updateAlerts: (alerts: any[]) => void;
    updateLevels: (levels: any) => void;
  } | null>(null);

  // Compose buttons per complexity
  const computeComposeButtons = useCallback(
    (
      _complexity: StrategyComplexity
    ): Array<{ id: string; label: string; icon?: string }> => {
      return [
        { id: "entry", label: "Entry" },
        { id: "exit", label: "Exit" },
        { id: "tp", label: "TP" },
        { id: "back", label: "Back", icon: "arrow_back" },
      ];
    },
    []
  );

  // Sync selectedComplexity with profile changes
  useEffect(() => {
    if (
      profile.strategyComplexity &&
      profile.strategyComplexity !== selectedComplexity
    ) {
      setSelectedComplexity(profile.strategyComplexity);
    }
  }, [profile.strategyComplexity, selectedComplexity]);

  useEffect(() => {
    // Refresh compose buttons when complexity changes
    setComposeButtons(computeComposeButtons(selectedComplexity));
  }, [selectedComplexity, computeComposeButtons]);

  const resetCompose = useCallback(() => {
    setComposeMode(false);
    setComposeDraft({ entries: [], exits: [], tps: [] });
    setComposeButtons(computeComposeButtons(selectedComplexity));
    // Clear the draft from the store
    try {
      clearDraftPlan(symbol);
    } catch (_) {}
    // Clear levels from chart
    try {
      chartBridgeRef.current?.updateLevels({});
    } catch (_) {}
    if (user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id)) {
      if (remoteSaveRef.current) {
        clearTimeout(remoteSaveRef.current);
        remoteSaveRef.current = null;
      }
      lastRemotePayloadRef.current = emptyDraftSignature;
      deleteUserDraftPlan(user.id, symbol).catch((error) => {
        console.warn(
          `[ChartFullScreen] Failed to delete remote draft for ${symbol}:`,
          error
        );
      });
    }
  }, [selectedComplexity, computeComposeButtons, clearDraftPlan, symbol]);

  const handleSendSignal = useCallback(() => {
    try {
      const groupId = profile.selectedStrategyGroupId;
      if (!profile.isSignalProvider || !groupId) {
        // silently ignore or show a toast later
        resetCompose();
        return;
      }
      const payload = {
        symbol,
        groupId,
        timeframe: extendedTf,
        plan: {
          entries: composeDraft.entries,
          exits: composeDraft.exits,
          tps: composeDraft.tps,
        },
        createdAt: Date.now(),
        side: (aiMeta?.side as any) || (currentTradePlan?.side as any),
        confidence: (aiMeta as any)?.confidence ?? undefined,
        rationale: (aiMeta as any)?.why?.join("\n") ?? undefined,
        groupName: profile.strategyGroups?.find((g) => g.id === groupId)?.name,
        providerName:
          user?.user_metadata?.full_name ||
          user?.email ||
          profile?.email ||
          undefined,
      };
      // TODO: replace with real backend call. For now, fire local notification via Alerts
      try {
        // Reuse chat message store to log
        addAnalysisMessage({
          symbol,
          strategy: "manual_signal",
          side: (aiMeta?.side as any) || (currentTradePlan?.side as any),
          entry: payload.plan.entries[0],
          exit: payload.plan.exits[0],
          targets: payload.plan.tps,
          why: [`Manual signal for group ${groupId}`, `TF: ${extendedTf}`],
          timestamp: Date.now(),
        } as any);
        // send via service (stub)
        sendSignal({
          symbol,
          groupId,
          timeframe: String(extendedTf),
          entries: payload.plan.entries,
          exits: payload.plan.exits,
          tps: payload.plan.tps,
          createdAt: payload.createdAt,
          side: payload.side === "short" ? "sell" : "buy",
          confidence: payload.confidence,
          rationale: payload.rationale,
          groupName: payload.groupName,
          providerName: payload.providerName,
        }).catch(() => {});
      } catch (_) {}
      resetCompose();
    } catch (_) {
      resetCompose();
    }
  }, [
    profile,
    symbol,
    extendedTf,
    composeDraft,
    addAnalysisMessage,
    aiMeta?.side,
    currentTradePlan,
    resetCompose,
  ]);

  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const skipSaveRef = useRef<boolean>(true);

  const remoteSaveRef = useRef<NodeJS.Timeout | null>(null);
  const lastRemotePayloadRef = useRef<string | null>(null);
  const skipRemotePersistRef = useRef<boolean>(false);

  // Layout calculations
  const headerHeight = 52;
  const ohlcRowHeight = 24;
  const timeframeRowHeight = 48;
  const bottomNavHeight = 56;
  const chartHeight = Math.max(
    120,
    height -
      insets.top -
      insets.bottom -
      headerHeight -
      ohlcRowHeight -
      timeframeRowHeight -
      bottomNavHeight
  );

  // Removed unused dimensions listener and bar spacing calculations

  // Update indicators ref and cleanup
  useEffect(() => {
    latestIndicatorsRef.current = indicators;
  }, [indicators]);

  useEffect(() => {
    return () => {
      if (styleRetryRef.current) clearInterval(styleRetryRef.current);
    };
  }, []);

  // Initialize component
  useEffect(() => {
    loadStockName();
    hydrate();
  }, [symbol]);

  // Hydrate user chart settings from Supabase (per-symbol with global fallback)
  useEffect(() => {
    let isMounted = true;
    async function hydrateServerSettings() {
      try {
        const canPersist = !!(user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id));
        if (!canPersist) {
          skipSaveRef.current = false;
          return;
        }
        const settings = await getUserChartSettings(user!.id);
        if (!isMounted || !settings) {
          skipSaveRef.current = false;
          return;
        }

        if (settings.timeframe) {
          setExtendedTf(settings.timeframe as ExtendedTimeframe);
          try {
            chartBridgeRef.current?.updateTimeframe(
              settings.timeframe as string
            );
          } catch {}
        }
        if (settings.chart_type) {
          setChartType(settings.chart_type as any);
          try {
            chartBridgeRef.current?.updateChartType(
              settings.chart_type as string
            );
          } catch {}
        }
        if (typeof settings.show_volume === "boolean")
          setShowVolume(settings.show_volume);
        if (typeof settings.show_ma === "boolean") setShowMA(settings.show_ma);
        // showSessions is always enabled - no need to set from settings
        if (settings.indicators && Array.isArray(settings.indicators)) {
          setIndicators(settings.indicators as any);
          try {
            chartBridgeRef.current?.updateIndicators(
              settings.indicators as any
            );
          } catch {}
        }
      } catch (_) {
        // ignore hydration errors
      } finally {
        skipSaveRef.current = false;
      }
    }
    hydrateServerSettings();
    return () => {
      isMounted = false;
    };
  }, [user?.id, symbol]);

  // Debounced save of chart settings to Supabase
  useEffect(() => {
    const canPersist = !!(user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id));
    if (!canPersist || skipSaveRef.current) return;
    try {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    } catch {}
    saveDebounceRef.current = setTimeout(() => {
      upsertUserChartSettings({
        user_id: user!.id,
        timeframe: extendedTf as any,
        chart_type: chartType as any,
        show_volume: !!showVolume,
        show_ma: !!showMA,
        show_sessions: !!showSessions,
        indicators: indicators as any,
      }).catch(() => {});
    }, 600);
    return () => {
      try {
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      } catch {}
    };
  }, [
    user?.id,
    symbol,
    extendedTf,
    chartType,
    showVolume,
    showMA,
    showSessions,
    indicators,
  ]);

  // Register a chart bridge so external agents can manipulate the chart state
  useEffect(() => {
    const bridge = {
      async perform(action: ChartAction) {
        switch (action.type) {
          case "addIndicator":
            // Use bridge to update indicators directly in WebView without React re-render
            if (chartBridgeRef.current) {
              const base = getDefaultIndicator(action.indicator);
              const options: any = action.options || {};

              const calcParams = Array.isArray(options.calcParams)
                ? options.calcParams.map((v: number) => Math.floor(v))
                : base.calcParams;

              const lineCount = Array.isArray(calcParams)
                ? calcParams.length
                : 1;

              let lines = buildDefaultLines(
                lineCount,
                (base.styles as any)?.lines?.[0]?.color
              );

              if (options.styles?.lines) {
                lines = lines.map((line, idx) => ({
                  ...line,
                  ...(options.styles.lines[idx] || {}),
                }));
              }

              let cfg: IndicatorConfig = {
                ...base,
                ...options,
                calcParams,
                styles: { ...(base.styles as any), lines },
              } as IndicatorConfig;

              // Update local state for consistency but don't trigger re-render
              setIndicators((prev) => {
                // Enforce: Only 1 main overlay indicator at a time
                if (cfg.overlay) {
                  const existingIndex = prev.findIndex(
                    (i) =>
                      i.name.toLowerCase() === action.indicator.toLowerCase()
                  );
                  const overlayIndex = prev.findIndex((i) => !!i.overlay);
                  if (overlayIndex >= 0) {
                    const copy = prev.slice();
                    // Replace existing overlay (either same indicator or another overlay)
                    copy[overlayIndex] = cfg;
                    chartBridgeRef.current?.updateIndicators(copy);
                    updateChartState({
                      indicators: copy.map((i) => ({
                        indicator: i.name,
                        options: { calcParams: i.calcParams, styles: i.styles },
                      })),
                    });
                    return copy;
                  }
                  // No overlay yet -> add new overlay
                  const next = [...prev, cfg];
                  chartBridgeRef.current?.updateIndicators(next);
                  updateChartState({
                    indicators: next.map((i) => ({
                      indicator: i.name,
                      options: { calcParams: i.calcParams, styles: i.styles },
                    })),
                  });
                  return next;
                }

                // Enforce max 3 sub-indicators (non-overlay)
                const isSub = !cfg.overlay;
                const subCount = prev.filter((i) => !i.overlay).length;
                if (isSub && subCount >= 3) {
                  // Replace the oldest sub-indicator (first non-overlay) to keep cap
                  const replaceIndex = prev.findIndex((i) => !i.overlay);
                  if (replaceIndex >= 0) {
                    const copy = prev.slice();
                    copy[replaceIndex] = cfg;
                    chartBridgeRef.current?.updateIndicators(copy);
                    updateChartState({
                      indicators: copy.map((i) => ({
                        indicator: i.name,
                        options: { calcParams: i.calcParams, styles: i.styles },
                      })),
                    });
                    return copy;
                  }
                }

                const existingIndex = prev.findIndex(
                  (i) => i.name.toLowerCase() === action.indicator.toLowerCase()
                );

                if (existingIndex >= 0) {
                  const copy = prev.slice();
                  copy[existingIndex] = cfg;
                  // Update WebView directly
                  chartBridgeRef.current?.updateIndicators(copy);
                  updateChartState({
                    indicators: copy.map((i) => ({
                      indicator: i.name,
                      options: { calcParams: i.calcParams, styles: i.styles },
                    })),
                  });
                  return copy;
                }

                const next = [...prev, cfg];
                // Update WebView directly
                chartBridgeRef.current?.updateIndicators(next);
                updateChartState({
                  indicators: next.map((i) => ({
                    indicator: i.name,
                    options: { calcParams: i.calcParams, styles: i.styles },
                  })),
                });
                return next;
              });
            } else {
              console.warn("Chart bridge not available for indicator update");
            }
            break;
          case "setTimeframe":
            // Use bridge to update timeframe directly in WebView
            if (chartBridgeRef.current) {
              chartBridgeRef.current.updateTimeframe(action.timeframe);
              setExtendedTf(action.timeframe as ExtendedTimeframe);
              updateChartState({ timeframe: action.timeframe });
            } else {
              console.warn("Chart bridge not available for timeframe update");
            }
            break;
          case "setChartType":
            // Use bridge to update chart type directly in WebView
            if (chartBridgeRef.current) {
              chartBridgeRef.current.updateChartType(action.chartType);
              setChartType(action.chartType as ChartType);
              updateChartState({ chartType: action.chartType });
            } else {
              console.warn("Chart bridge not available for chart type update");
            }
            break;
          case "toggleDisplayOption":
            // Use bridge to update display options directly in WebView
            if (chartBridgeRef.current) {
              const options: any = {};
              if (action.option === "ma") {
                options.showMA = action.enabled;
                setShowMA(action.enabled);
              }
              if (action.option === "volume") {
                options.showVolume = action.enabled;
                setShowVolume(action.enabled);
              }
              if (action.option === "sessions") {
                options.showSessions = action.enabled;
                // showSessions is always enabled - no state update needed
              }
              if (action.option === "showGrid") {
                options.showGrid = !!action.enabled;
              }
              if (action.option === "tooltipRule") {
                options.tooltipRule = String(action.enabled);
              }
              if (action.option === "removeIndicator") {
                const toRemove = String(action.enabled).toUpperCase();
                setIndicators((prev) => {
                  const next = prev.filter(
                    (i) => i.name.toUpperCase() !== toRemove
                  );
                  chartBridgeRef.current?.updateIndicators(next);
                  updateChartState({
                    indicators: next.map((i) => ({
                      indicator: i.name,
                      options: { calcParams: i.calcParams, styles: i.styles },
                    })),
                  });
                  return next;
                });
              }
              chartBridgeRef.current.updateDisplayOptions(options);
            } else {
              console.warn(
                "Chart bridge not available for display options update"
              );
            }
            break;
          default:
            console.warn("Unhandled chart action", action);
        }
      },
    };

    registerChartBridge(bridge);
    return () => unregisterChartBridge();
  }, [
    setIndicators,
    setExtendedTf,
    setChartType,
    setShowMA,
    setShowVolume,
    symbol,
  ]);

  // Apply indicator styles and parameters
  const applyIndicatorStyles = useCallback(() => {
    if (styleRetryRef.current) clearInterval(styleRetryRef.current);

    const attempt = () => {
      if (!overrideIndicatorRef.current) return;
      latestIndicatorsRef.current.forEach((indicator) => {
        const styles = indicator.styles?.lines
          ? { lines: indicator.styles.lines }
          : {};
        const calcParams = indicator.calcParams;

        // Always call overrideIndicator with both styles and calcParams
        // The WebView will decide whether to recreate the indicator or just update styles
        overrideIndicatorRef.current!(indicator.name, styles, calcParams);
      });
    };

    attempt();
    // Retry once after 200ms to ensure styles are applied
    styleRetryRef.current = setTimeout(() => {
      attempt();
      styleRetryRef.current = null;
    }, 200);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      applyIndicatorStyles();
    });
    return unsubscribe;
  }, [navigation, applyIndicatorStyles]);

  useEffect(() => {
    applyIndicatorStyles();
  }, [indicators, applyIndicatorStyles]);

  // Fallback: if no isDayUp provided, hydrate from cached quotes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof isDayUp === "boolean") {
        setDayUp(isDayUp);
        return;
      }
      try {
        const q: SimpleQuote = await fetchSingleQuote(symbol);
        if (q && mounted) {
          if (typeof q.change === "number") setDayUp(q.change >= 0);
          else if (typeof q.changePercent === "number")
            setDayUp(q.changePercent >= 0);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [symbol, isDayUp]);

  // Update timeframe when store is hydrated
  useEffect(() => {
    if (defaultTimeframe && !initialAnalysisContext) {
      setExtendedTf(defaultTimeframe);
    }
  }, [defaultTimeframe, initialAnalysisContext]);

  // Initialize streaming text for existing analysis
  useEffect(() => {
    if (initialAiMeta && initialAiMeta.why && initialAiMeta.notes) {
      const reasoningText =
        (initialAiMeta.why || []).join(". ") +
        (initialAiMeta.notes ? ". " + initialAiMeta.notes.join(". ") : "");

      if (reasoningText) {
        setStreamingText(reasoningText);
        setIsStreaming(false);
      }
    }
  }, [initialAiMeta]);

  // Core analysis function
  const performAnalysis = useCallback(async () => {
    try {
      setAnalyzing(true);

      // Fetch candle data based on trade pace
      let d: any[] = [];
      let h1: any[] = [];
      let m15: any[] = [];
      let m5: any[] = [];
      let m1: any[] = [];

      const pace = tradePace;
      try {
        if (pace === "scalp") {
          const [c1, c5, c15, c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "1", limit: 120 }),
            fetchCandles(symbol, { resolution: "5", limit: 60 }),
            fetchCandles(symbol, { resolution: "15", limit: 32 }),
            fetchCandles(symbol, { resolution: "1H", limit: 24 }),
            fetchCandles(symbol, { resolution: "D", limit: 20 }),
          ]);
          m1 = c1;
          m5 = c5;
          m15 = c15;
          h1 = c60;
          d = cd;
        } else if (pace === "day") {
          const [c5, c15, c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "5", limit: 78 }),
            fetchCandles(symbol, { resolution: "15", limit: 52 }),
            fetchCandles(symbol, { resolution: "1H", limit: 48 }),
            fetchCandles(symbol, { resolution: "D", limit: 45 }),
          ]);
          m5 = c5;
          m15 = c15;
          h1 = c60;
          d = cd;
        } else if (pace === "swing") {
          const [c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "1H", limit: 200 }),
            fetchCandles(symbol, { resolution: "D", limit: 180 }),
          ]);
          h1 = c60;
          d = cd;
          const [c15, c5] = await Promise.all([
            fetchCandles(symbol, { resolution: "15", limit: 32 }),
            fetchCandles(symbol, { resolution: "5", limit: 60 }),
          ]);
          m15 = c15;
          m5 = c5;
        } else {
          const [c5, c15, c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "5", limit: 78 }),
            fetchCandles(symbol, { resolution: "15", limit: 40 }),
            fetchCandles(symbol, { resolution: "1H", limit: 72 }),
            fetchCandles(symbol, { resolution: "D", limit: 120 }),
          ]);
          m5 = c5;
          m15 = c15;
          h1 = c60;
          d = cd;
        }
      } catch (err) {
        console.warn("Candle fetch failed for AI analysis:", err);
      }

      // Context fetches
      const shouldFetchContext = contextMode === "news_sentiment";
      let newsBrief: any[] | undefined = undefined;
      let marketNewsBrief: any[] | undefined = undefined;
      let fedBrief: any[] | undefined = undefined;
      let vixSnapshot:
        | { value: number; bucket: "low" | "moderate" | "high" }
        | undefined = undefined;

      if (shouldFetchContext) {
        try {
          const news = await fetchSymbolNews(symbol);
          newsBrief = (news || []).slice(0, 5).map((n: any) => ({
            title: n.title,
            summary: (n.summary || "").slice(0, 180),
            source: n.source,
            publishedAt: n.publishedAt,
          }));
        } catch {}
      }

      // Derive sentiment from news
      let sentimentSummary:
        | { label: "bullish" | "bearish" | "neutral"; score: number }
        | undefined = undefined;
      if (shouldFetchContext && newsBrief && newsBrief.length > 0) {
        const positives = [
          "beat",
          "surge",
          "optimistic",
          "strong",
          "growth",
          "record",
          "win",
          "rally",
        ];
        const negatives = [
          "miss",
          "drop",
          "cut",
          "weak",
          "fell",
          "loss",
          "selloff",
          "concern",
        ];
        let score = 0;
        for (const n of newsBrief) {
          const text = `${n.title} ${n.summary}`.toLowerCase();
          positives.forEach((w) => {
            if (text.includes(w)) score += 1;
          });
          negatives.forEach((w) => {
            if (text.includes(w)) score -= 1;
          });
        }
        const label =
          score > 1 ? "bullish" : score < -1 ? "bearish" : "neutral";
        sentimentSummary = { label, score };
      }

      const analysisMode = mode;
      const candleData: Record<string, any[]> = {};

      if (d && d.length)
        candleData["1d"] = d.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
      if (h1 && h1.length)
        candleData["1h"] = h1.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
      if (m15 && m15.length)
        candleData["15m"] = m15.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
      if (m5 && m5.length)
        candleData["5m"] = m5.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
      if (m1 && m1.length)
        candleData["1m"] = m1.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));

      // Optionally trim candle context based on lookback (AI context only)
      function trimByLookback<T extends { time: number }>(arr: T[]): T[] {
        if (!arr || !arr.length) return arr;
        if (contextLookback?.mode !== "fixed" || !contextLookback.ms)
          return arr;
        const cutoff = Date.now() - contextLookback.ms;
        // Keep only data newer than cutoff
        const idx = arr.findIndex((c) => c.time >= cutoff);
        return idx <= 0 ? arr : arr.slice(idx);
      }

      const trimmedCandleData = {
        "1d": trimByLookback(d),
        "1h": trimByLookback(h1),
        "15m": trimByLookback(m15),
        "5m": trimByLookback(m5),
        "1m": trimByLookback(m1),
      } as Record<string, any[]>;

      const output = await runAIStrategy({
        symbol,
        mode: analysisMode,
        candleData: trimmedCandleData,
        indicators: {},
        context: {
          userBias: "neutral",
          strategyPreference: analysisMode,
          complexity: selectedComplexity,
          riskTolerance:
            profile.riskPerTradePct && profile.riskPerTradePct <= 1
              ? "conservative"
              : profile.riskPerTradePct && profile.riskPerTradePct <= 2
              ? "moderate"
              : "aggressive",
          preferredRiskReward: profile.preferredRiskReward || desiredRR,
          userPreferences: {
            pace: tradePace,
            desiredRR: desiredRR,
          },
          includeFlags: {
            macro: false,
            sentiment: shouldFetchContext,
            vix: false,
            fomc: false,
            market: false,
            fundamentals: true,
          },
          news: newsBrief,
          marketNews: marketNewsBrief,
          fedEvents: fedBrief,
          sentimentSummary,
          vix: vixSnapshot,
          fundamentals: {
            level: "neutral",
          },
          analysisType: "user_directed",
          contextLookback,
        },
      });

      if (output) {
        const tp = aiOutputToTradePlan(output, selectedComplexity);
        setCurrentTradePlan(tp);
        const newAiMeta = {
          strategyChosen: String(output.strategyChosen),
          side: output.side,
          confidence: output.confidence,
          why: output.why || [],
          notes: output.tradePlanNotes || [],
          targets: output.tps || [],
          riskReward: output.riskReward,
        };
        setAiMeta(newAiMeta);

        const reasoningText =
          (output.why || []).join(". ") +
          (output.tradePlanNotes
            ? ". " + output.tradePlanNotes.join(". ")
            : "");
        if (reasoningText) {
          simulateStreamingText(reasoningText);
        }

        setShowReasoning(true);
        setHasExistingReasoning(true);

        const currentCached = getCachedSignal(symbol);
        if (currentCached) {
          addAnalysisMessage({
            symbol: currentCached.symbol,
            strategy: currentCached.aiMeta?.strategyChosen,
            side: currentCached.aiMeta?.side,
            entry: currentCached.tradePlan?.entries[0],
            exit: currentCached.tradePlan?.exits[0],
            targets: currentCached.aiMeta?.targets,
            riskReward: currentCached.aiMeta?.riskReward,
            confidence: currentCached.aiMeta?.confidence,
            why: currentCached.aiMeta?.why,
            tradePlan: currentCached.tradePlan,
            aiMeta: currentCached.aiMeta,
            analysisContext: currentCached.analysisContext,
          });
        }

        const cachedSignalData = {
          symbol,
          timestamp: Date.now(),
          tradePlan: tp,
          aiMeta: newAiMeta,
          analysisContext: {
            mode: analysisMode,
            tradePace: tradePace,
            desiredRR: desiredRR,
            contextMode,
            isAutoAnalysis: false,
            contextLookback,
          },
          rawAnalysisOutput: output,
        };
        cacheSignal(cachedSignalData);
      } else {
        // Fallback: build a local strategy so Analyze always yields a plan
        const pickSeries = () =>
          (m5 && m5.length ? m5 : null) ||
          (m15 && m15.length ? m15 : null) ||
          (h1 && h1.length ? h1 : null) ||
          (d && d.length ? d : null) ||
          (m1 && m1.length ? m1 : []);

        const series = pickSeries() as any[];
        const closes = (series || [])
          .map((c) => c.close)
          .filter((n) => Number.isFinite(n));
        let currentPrice = Number.isFinite(closes[closes.length - 1])
          ? closes[closes.length - 1]
          : Number.isFinite(lastCandle?.close || NaN)
          ? (lastCandle as any).close
          : NaN;

        // If still missing, synthesize a small series around a nominal value
        let recentCloses = closes.slice(-60);
        if (!Number.isFinite(currentPrice)) {
          currentPrice = 100; // nominal
        }
        if (recentCloses.length < 10) {
          const base = Number.isFinite(currentPrice) ? currentPrice : 100;
          recentCloses = Array.from(
            { length: 30 },
            (_, i) => base * (1 + Math.sin(i / 5) * 0.003)
          );
        }

        const prev = recentCloses[recentCloses.length - 10] ?? recentCloses[0];
        const momentumPct =
          Number.isFinite(prev) && prev > 0
            ? ((currentPrice - prev) / prev) * 100
            : 0;

        const riskTolerance =
          profile.riskPerTradePct && profile.riskPerTradePct <= 1
            ? "conservative"
            : profile.riskPerTradePct && profile.riskPerTradePct <= 2
            ? "moderate"
            : "aggressive";

        const ctx = {
          currentPrice,
          recentCloses,
          momentumPct,
          preferredRiskReward: profile.preferredRiskReward || desiredRR,
          riskTolerance,
        } as any;

        const plan = (
          tradeMode === "day" ? buildDayTradePlan : buildSwingTradePlan
        )(ctx);

        setCurrentTradePlan(plan);
        const newAiMeta = {
          strategyChosen:
            tradeMode === "day" ? "day_trade_fallback" : "swing_trade_fallback",
          side: plan.side,
          confidence: 0.4,
          why: [
            "AI analysis unavailable. Generated local strategy using recent price action.",
          ],
          notes: [
            "Adjust risk-reward in settings for different target distances.",
          ],
          targets: plan.tps || [],
          riskReward: plan.riskReward,
        } as any;
        setAiMeta(newAiMeta);

        const reasoningText = `${newAiMeta.why?.join(". ") || ""}`;
        if (reasoningText) {
          simulateStreamingText(reasoningText);
        }

        setHasExistingReasoning(true);

        cacheSignal({
          symbol,
          timestamp: Date.now(),
          tradePlan: plan,
          aiMeta: newAiMeta,
          analysisContext: {
            mode: analysisMode,
            tradePace: tradePace,
            desiredRR: desiredRR,
            contextMode,
            isAutoAnalysis: false,
            contextLookback,
          } as any,
          rawAnalysisOutput: null as any,
        });
      }
    } catch (error) {
      console.warn("AI analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  }, [
    symbol,
    tradePace,
    contextMode,
    selectedComplexity,
    profile,
    desiredRR,
    mode,
    getCachedSignal,
    addAnalysisMessage,
    cacheSignal,
  ]);

  // Fetch last candle for OHLCV row when symbol or timeframe changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const candles = await fetchCandlesForTimeframe(symbol, extendedTf, {
          includeExtendedHours: true,
        });
        if (!cancelled && candles && candles.length > 0) {
          setLastCandle(candles[candles.length - 1]);
        }
      } catch (e) {
        if (!cancelled) setLastCandle(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, extendedTf]);

  // Simulate streaming text output
  const simulateStreamingText = useCallback((fullText: string) => {
    setIsStreaming(true);
    setStreamingText("");

    const words = fullText.split(" ");
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setStreamingText(
          (prev) => prev + (currentIndex === 0 ? "" : " ") + words[currentIndex]
        );
        currentIndex++;
      } else {
        setIsStreaming(false);
        clearInterval(interval);
      }
    }, 80);
  }, []);

  // Bottom sheet handlers
  const showUnifiedBottomSheetWithTab = useCallback(() => {
    setShowUnifiedBottomSheet(true);
  }, []);

  const hideBottomSheet = useCallback(() => {
    setShowUnifiedBottomSheet(false);
  }, []);

  const showComplexityBottomSheetWithTab = useCallback(() => {
    setShowComplexityBottomSheet(true);
  }, []);

  const hideComplexityBottomSheet = useCallback(() => {
    setShowComplexityBottomSheet(false);
  }, []);

  const handleTogglePin = useCallback(
    async (tf: ExtendedTimeframe) => {
      const success = await toggle(tf);
      if (!success) {
        setPinError("You can pin up to 10 timeframes");
        setTimeout(() => setPinError(null), 2000);
      }
      return success;
    },
    [toggle]
  );

  const handleSetPriceColors = useCallback(
    (c: { up: string; down: string; noChange?: string }) => {
      setPriceColors(c);
      try {
        chartBridgeRef.current?.updateDisplayOptions({ priceColors: c });
      } catch (_) {}
    },
    []
  );

  const handleSelectChartType = useCallback((t: ChartType) => {
    setChartType(t);
    try {
      chartBridgeRef.current?.updateChartType(t as any);
    } catch (_) {}
  }, []);

  // Stock name loading
  const loadStockName = useCallback(async () => {
    try {
      const results = await searchStocksAutocomplete(symbol, 1);
      if (results.length > 0) {
        setStockName(results[0].name);
      }
    } catch (error) {
      console.error("Failed to load stock name:", error);
    }
  }, [symbol]);

  // Handle timeframe change and save as default
  const handleTimeframeChange = useCallback(
    async (tf: ExtendedTimeframe) => {
      setExtendedTf(tf);
      setDefaultTimeframe(tf);
      try {
        chartBridgeRef.current?.updateTimeframe(tf as any);
      } catch (_) {}
    },
    [setDefaultTimeframe]
  );

  // Indicator management
  const toggleIndicator = useCallback(
    (name: string) => {
      setIndicators((prev) => {
        const updated = toggleIndicatorInList(prev as any, name) as any;

        if (updated.length > prev.length) {
          const newIndicator = updated.find((ind: any) => ind.name === name);
          if (newIndicator && overrideIndicatorRef.current) {
            console.log(
              `🎨 Applying default colors for ${name}:`,
              newIndicator.styles?.lines
            );
            const styles = newIndicator.styles?.lines
              ? { lines: newIndicator.styles.lines }
              : {};
            const calcParams = newIndicator.calcParams;
            overrideIndicatorRef.current(name, styles, calcParams);
          }
        }

        latestIndicatorsRef.current = updated;
        return updated;
      });
      applyIndicatorStyles();
    },
    [applyIndicatorStyles]
  );

  const updateIndicatorLine = useCallback(
    (
      name: string,
      lineIndex: number,
      updates: Partial<{ color: string; size: number; style: string }>
    ) => {
      setIndicators((prev) => {
        const updated = updateIndicatorLineInList(
          prev as any,
          name,
          lineIndex,
          updates as any
        ) as any;

        if (overrideIndicatorRef.current) {
          const indicator = updated.find((i: any) => i.name === name);
          if (indicator) {
            const count = Array.isArray(indicator.calcParams)
              ? indicator.calcParams.length
              : 1;
            const lines = Array.isArray((indicator.styles as any)?.lines)
              ? ((indicator.styles as any).lines as any[]).slice()
              : [];

            const updatedLines = [];
            for (let i = 0; i < count; i++) {
              if (i === lineIndex) {
                updatedLines.push({ ...lines[i], ...updates });
              } else {
                updatedLines.push(
                  lines[i] || { color: "#3B82F6", size: 1, style: "solid" }
                );
              }
            }

            const styles = { lines: updatedLines };
            const calcParams = indicator.calcParams;
            overrideIndicatorRef.current(name, styles, calcParams);
          }
        }

        latestIndicatorsRef.current = updated;
        return updated;
      });
      applyIndicatorStyles();
    },
    [applyIndicatorStyles]
  );

  const openIndicatorConfig = useCallback(
    (name: string) => {
      const ind = indicators.find((i) => i.name === name) || null;
      if (!ind) return;

      try {
        const count = Array.isArray(ind?.calcParams)
          ? (ind!.calcParams as any[]).length
          : 1;
        const paramValue = count > 0 ? Number(ind?.calcParams?.[0] ?? 9) : 9;

        navigation.navigate("IndicatorConfigScreen" as any, {
          indicatorName: name,
          getCurrentIndicator: () =>
            indicators.find((i) => i.name === name) || null,
          newParamValue: paramValue,
          onAddParam: addIndicatorParam,
          onRemoveParam: removeIndicatorParam,
          onUpdateIndicatorLine: updateIndicatorLine,
        });
      } catch (e) {
        console.warn("Failed to open indicator config:", e);
      }
    },
    [indicators, navigation, updateIndicatorLine]
  );

  const addIndicatorParam = useCallback((name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    setIndicators((prev) => {
      const { list } = addIndicatorParamInList(
        prev as any,
        name,
        Math.floor(value)
      );
      return list.slice() as any;
    });
  }, []);

  const removeIndicatorParam = useCallback((name: string, value: number) => {
    setIndicators((prev) => {
      const updated = removeIndicatorParamInList(
        prev as any,
        name,
        value
      ) as any;
      return updated.slice();
    });
  }, []);

  const openIndicatorsSheet = useCallback(() => {
    setShowIndicatorsSheet(true);
  }, []);

  const closeIndicatorsSheet = useCallback(() => {
    setShowIndicatorsSheet(false);
  }, []);

  // Manual analysis handler
  const handleAnalyzePress = useCallback(() => {
    return performAnalysis();
  }, [performAnalysis]);

  // Decide icon for reasoning float based on AI call side
  const decisionSide = (aiMeta?.side as any) || (currentTradePlan?.side as any);
  const reasoningIconName =
    decisionSide === "long"
      ? "arrow-up"
      : decisionSide === "short"
      ? "arrow-down"
      : "bulb";
  const reasoningIconColor =
    decisionSide === "long"
      ? "#16A34A"
      : decisionSide === "short"
      ? "#EF4444"
      : "#fff";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <ChartHeader
        onBack={() => navigation.goBack()}
        symbol={symbol}
        stockName={stockName}
        onToggleIndicatorsAccordion={() =>
          setShowIndicatorsAccordion((v) => !v)
        }
      />
      {/* OHLCV Row */}
      <OHLCRow lastCandle={lastCandle} />
      {/* Chart */}
      <View style={{ position: "relative", flex: 1 }}>
        <SimpleKLineChart
          key={`chart-${symbol}-${chartHeight}`}
          symbol={symbol}
          timeframe={extendedTf as any}
          height={chartHeight}
          theme={scheme === "dark" ? "dark" : "light"}
          chartType={
            chartType === "candlestick" ? "candle" : (chartType as any)
          }
          showVolume={showVolume}
          showMA={showMA}
          showSessions={showSessions}
          etOffsetMinutes={marketStatus.etOffsetMinutes ?? undefined}
          serverOffsetMs={marketStatus.serverOffsetMs ?? 0}
          showTopInfo={false}
          showPriceAxisText={true}
          showTimeAxisText={true}
          indicators={indicators}
          areaStyle={areaStyle}
          priceColors={priceColors}
          composeMode={composeMode}
          composeButtons={composeButtons}
          onComposeAction={({ action, price }) => {
            if (!composeMode) return;
            if (action === "back") {
              setComposeMode(false);
              setComposeButtons(computeComposeButtons(selectedComplexity));
              return;
            }

            if (!(price > 0)) return;

            setComposeDraft((prev) => {
              const sanitize = (arr?: number[]) =>
                Array.isArray(arr)
                  ? arr.filter(
                      (value) =>
                        typeof value === "number" && Number.isFinite(value)
                    )
                  : [];

              const next = {
                entries: sanitize(prev.entries),
                exits: sanitize(prev.exits),
                tps: sanitize(prev.tps),
              };

              const config = STRATEGY_COMPLEXITY_CONFIGS[selectedComplexity];
              const allowMultipleEntries = !!config?.features.multipleEntries;
              const allowMultipleExits = !!config?.features.multipleExits;
              const maxTargets = config?.features.maxTargets ?? 1;

              const notifyLimitReached = (label: string) => {
                Alert.alert(
                  "Limit reached",
                  `The ${selectedComplexity} strategy allows only ${label}.`
                );
              };

              const addEntry = () => {
                if (allowMultipleEntries) {
                  next.entries = [...next.entries, price];
                  return true;
                }
                if (next.entries.length >= 1) {
                  notifyLimitReached("one entry level");
                  return false;
                }
                next.entries = [price];
                return true;
              };

              const addExit = () => {
                if (allowMultipleExits) {
                  next.exits = [...next.exits, price];
                  return true;
                }
                if (next.exits.length >= 1) {
                  notifyLimitReached("one exit level");
                  return false;
                }
                next.exits = [price];
                return true;
              };

              const addTarget = () => {
                if (maxTargets <= 0) {
                  notifyLimitReached("take profit levels");
                  return false;
                }

                if (next.tps.length >= maxTargets) {
                  notifyLimitReached(
                    maxTargets === 1
                      ? "one take profit level"
                      : `${maxTargets} take profit levels`
                  );
                  return false;
                }

                if (maxTargets === 1) {
                  next.tps = [price];
                } else {
                  next.tps = [...next.tps, price];
                }
                return true;
              };

              let didChange = false;

              if (action === "entry") {
                didChange = addEntry();
              } else if (action === "exit") {
                didChange = addExit();
              } else if (action === "tp") {
                didChange = addTarget();
              }

              if (!didChange) {
                return prev;
              }

              try {
                chartBridgeRef.current?.updateLevels({
                  entries: next.entries,
                  exits: next.exits,
                  tps: next.tps,
                });
              } catch (_) {}

              try {
                const updatedAt = Date.now();
                setDraftPlan(symbol, {
                  entries: next.entries,
                  exits: next.exits,
                  tps: next.tps,
                  updatedAt,
                });

                if (user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id)) {
                  const payloadSignature = createDraftSignature(next);

                  if (skipRemotePersistRef.current) {
                    skipRemotePersistRef.current = false;
                    lastRemotePayloadRef.current = payloadSignature;
                  } else if (
                    payloadSignature !== lastRemotePayloadRef.current
                  ) {
                    if (remoteSaveRef.current) {
                      clearTimeout(remoteSaveRef.current);
                    }

                    remoteSaveRef.current = setTimeout(() => {
                      (async () => {
                        try {
                          await upsertUserDraftPlan({
                            userId: user.id,
                            symbol,
                            draft: {
                              entries: next.entries,
                              exits: next.exits,
                              tps: next.tps,
                              updatedAt,
                            },
                          });
                          lastRemotePayloadRef.current = payloadSignature;
                        } catch (error) {
                          console.warn(
                            `[ChartFullScreen] Failed to persist draft for ${symbol}:`,
                            error
                          );
                        }
                      })();
                    }, 600);
                  }
                }
              } catch (_) {}

              return next;
            });
          }}
          onCrosshairClick={() => {
            setComposeMode(true);
            setComposeButtons(computeComposeButtons(selectedComplexity));
          }}
          onOverrideIndicator={React.useCallback(
            (overrideFn: any) => {
              overrideIndicatorRef.current = overrideFn;
              applyIndicatorStyles();
            },
            [applyIndicatorStyles]
          )}
          onChartBridge={React.useCallback((bridge: any) => {
            chartBridgeRef.current = bridge;
          }, [])}
          onChartReady={() => {
            try {
              if (chartBridgeRef.current) {
                chartBridgeRef.current.updateAlerts(alertLines);

                // Apply draft levels first, then cached plan, then current trade plan
                const plan: any =
                  draftForSymbol || cachedPlanForSymbol || currentTradePlan;
                if (plan) {
                  console.log("🎯 Chart ready - applying levels:", plan);
                  chartBridgeRef.current.updateLevels({
                    entries: plan.entries,
                    exits: plan.exits?.length ? plan.exits : [],
                    tps: plan.tps,
                  });
                }

                // push display options including areaStyle and priceColors
                chartBridgeRef.current.updateDisplayOptions({
                  showSessions,
                  areaStyle,
                  priceColors,
                });
                // ensure compose buttons sync when ready
                // no-op here; SimpleKLineChart will push compose state via effect
              }
            } catch (_) {}
          }}
          onDataApplied={() => {
            try {
              if (chartBridgeRef.current) {
                chartBridgeRef.current.updateAlerts(alertLines);

                // Apply draft levels first, then cached plan, then current trade plan
                const plan: any =
                  draftForSymbol || cachedPlanForSymbol || currentTradePlan;
                if (plan) {
                  console.log("📊 Data applied - reapplying levels:", plan);
                  chartBridgeRef.current.updateLevels({
                    entries: plan.entries,
                    exits: plan.exits?.length ? plan.exits : [],
                    tps: plan.tps,
                  });
                }

                chartBridgeRef.current.updateDisplayOptions({
                  showSessions,
                  areaStyle,
                  priceColors,
                });
              }
            } catch (_) {}
          }}
          levels={
            currentTradePlan
              ? {
                  entries: currentTradePlan.entries,
                  exits: currentTradePlan.exits,
                  tps: currentTradePlan.tps,
                }
              : undefined
          }
          onAlertClick={async (price) => {
            // Persist to Supabase when authenticated, otherwise fall back to local
            try {
              if (user) {
                const created = await alertsService.createAlert(user.id, {
                  symbol,
                  price,
                  condition: "above",
                  message: `Alert at $${price.toFixed(2)}`,
                  isActive: true,
                  repeat: "unlimited",
                } as any);
                try {
                  upsertAlert(created);
                } catch (_) {}
              } else {
                addAlert({
                  symbol,
                  price,
                  condition: "above",
                  message: `Alert at $${price.toFixed(2)}`,
                  repeat: "unlimited",
                });
              }
            } catch (e) {
              // fallback local if server insert fails
              addAlert({
                symbol,
                price,
                condition: "above",
                message: `Alert at $${price.toFixed(2)}`,
                repeat: "unlimited",
              });
            }
          }}
          alerts={alertLines}
          // selection is handled in WebView; no RN state needed
          onAlertSelected={undefined as any}
          onAlertMoved={async ({ id, price }) => {
            if (!id || !(price > 0)) return;
            updateAlert(id, { price, isActive: true, triggeredAt: undefined });
            try {
              if (user) {
                const existing = alertsForSymbol.find((a) => a.id === id);
                if (existing) {
                  await alertsService.updateAlert(user.id, id, {
                    symbol: existing.symbol,
                    price,
                    condition: existing.condition,
                    message: existing.message,
                    isActive: true,
                    repeat: existing.repeat,
                  } as any);
                }
              }
            } catch (_) {}
            setSelectedAlertId(null);
            setProposedAlertPrice(null);
          }}
        />
        {/* Floating Indicators Accordion */}
        {showIndicatorsAccordion && (
          <View style={styles.floatingIndicatorsContainer}>
            <Pressable
              style={styles.floatingIndicatorsBackdrop}
              onPress={() => setShowIndicatorsAccordion(false)}
            />
            <View style={styles.floatingIndicatorsContent}>
              <IndicatorsAccordion
                indicators={indicators}
                onOpenConfig={(name) => openIndicatorConfig(name)}
                onToggleIndicator={(name) => toggleIndicator(name)}
                onOpenAddSheet={openIndicatorsSheet}
              />
            </View>
          </View>
        )}

        {/* Dragging is handled in-chart; removed separate overlay controls */}
        {showReasonIcon ? (
          composeMode ? (
            <>
              {/* Send button on bottom-left (replaces reasoning) */}
              <Pressable
                onPress={handleSendSignal}
                style={styles.reasoningFloatInChart}
                hitSlop={8}
              >
                <Ionicons name="send" size={18} color="#00D4AA" />
              </Pressable>
              {/* Cancel button at lower-right */}
              <Pressable
                onPress={resetCompose}
                style={[
                  styles.reasoningFloatInChart,
                  { right: 8, left: undefined },
                ]}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setShowReasoningBottomSheet(true)}
              style={styles.reasoningFloatInChart}
              hitSlop={8}
            >
              <Ionicons
                name={reasoningIconName as any}
                size={20}
                color={reasoningIconColor}
              />
            </Pressable>
          )
        ) : null}
      </View>
      {/* Timeframe Chips */}
      <TimeframeBar
        pinned={pinned as any}
        extendedTf={extendedTf as any}
        onChangeTimeframe={(tf) => handleTimeframeChange(tf as any)}
        onOpenMore={() => {
          // Default behavior: open unified sheet
          showUnifiedBottomSheetWithTab();
        }}
      />
      Unified Bottom Sheet
      <UnifiedBottomSheet
        visible={showUnifiedBottomSheet}
        onClose={hideBottomSheet}
        chartType={chartType}
        onSelectChartType={(t) => {
          setChartType(t);
          try {
            chartBridgeRef.current?.updateChartType(t as any);
          } catch (_) {}
        }}
        extendedTf={extendedTf as any}
        pinned={pinned as any}
        onSelectTimeframe={(tf) => handleTimeframeChange(tf as any)}
        onTogglePin={async (tf) => {
          const success = await toggle(tf);
          if (!success) {
            setPinError("You can pin up to 10 timeframes");
            setTimeout(() => setPinError(null), 2000);
          }
          return success;
        }}
        priceColors={priceColors}
        onSetPriceColors={(c) => {
          setPriceColors(c);
          try {
            chartBridgeRef.current?.updateDisplayOptions({ priceColors: c });
          } catch (_) {}
        }}
      />
      {/* Reasoning Bottom Sheet */}
      <ReasoningBottomSheet
        visible={showReasoningBottomSheet}
        onClose={() => setShowReasoningBottomSheet(false)}
        isStreaming={isStreaming}
        streamingText={streamingText}
      />
      {/* Floating Reasoning Bulb moved inside chart */}
      {/* Bottom Navigation: Chat, Analyze, Strategy */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          {/* Chat */}
          <Pressable
            onPress={() => navigation.navigate("ChartChat" as any, { symbol })}
            style={styles.bottomNavButton}
            hitSlop={8}
          >
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color="rgba(255,255,255,0.9)"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.bottomNavButtonText}>Chat</Text>
          </Pressable>

          {/* Analyze */}
          <Pressable
            onPress={handleAnalyzePress}
            disabled={analyzing}
            style={[
              styles.analyzeButton,
              {
                backgroundColor: analyzing
                  ? "rgba(0,122,255,0.3)"
                  : "rgba(0,122,255,0.9)",
                shadowOpacity: analyzing ? 0.4 : 0.8,
                shadowRadius: analyzing ? 8 : 12,
              },
            ]}
            hitSlop={10}
          >
            {analyzing ? (
              <Text style={styles.analyzeButtonText}>Analyzing…</Text>
            ) : (
              <>
                <Ionicons
                  name="analytics"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.analyzeButtonText}>Analyze</Text>
              </>
            )}
          </Pressable>

          {/* Strategy */}
          <Pressable
            onPress={showComplexityBottomSheetWithTab}
            style={styles.bottomNavButton}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text
              style={[styles.bottomNavButtonText, { marginLeft: 6 }]}
              numberOfLines={1}
            >
              Strategy
            </Text>
          </Pressable>
        </View>
      </View>
      {/* Strategy Complexity Bottom Sheet */}
      <ComplexityBottomSheet
        visible={showComplexityBottomSheet}
        onClose={hideComplexityBottomSheet}
        selectedComplexity={selectedComplexity}
        onSelectComplexity={(c) => {
          setSelectedComplexity(c);
          setCurrentTradePlan((prev: any) =>
            prev ? applyComplexityToPlan(prev, c) : prev
          );
        }}
        profile={profile}
        onSaveComplexityToProfile={(c) => setProfile({ strategyComplexity: c })}
        tradeMode={tradeMode}
        setTradeMode={setTradeMode}
        setMode={setMode}
        tradePace={tradePace}
        setTradePace={setTradePace}
        contextMode={contextMode}
        setContextMode={setContextMode}
      />
      {/* Indicators Bottom Sheet */}
      <IndicatorsSheet
        visible={showIndicatorsSheet}
        onClose={closeIndicatorsSheet}
        indicators={indicators}
        onToggleIndicator={toggleIndicator}
      />
      {/* Custom R:R Modal */}
      <Modal
        visible={showCustomRrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomRrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            onPress={() => setShowCustomRrModal(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom R:R</Text>
              <Pressable onPress={() => setShowCustomRrModal(false)}>
                <Ionicons name="close" size={20} color="#888" />
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>
              Enter desired risk-reward (e.g., 2.25 for 2.25:1):
            </Text>
            <TextInput
              value={String(desiredRR ?? "")}
              onChangeText={(txt) => {
                const num = Number(txt);
                if (Number.isFinite(num)) setDesiredRR(num);
              }}
              keyboardType="decimal-pad"
              placeholder="2.0"
              placeholderTextColor="#666"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCustomRrModal(false)}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const val = Number(desiredRR);
                  if (Number.isFinite(val) && val > 0) {
                    setShowCustomRrModal(false);
                  }
                }}
                style={styles.modalApplyButton}
              >
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  reasoningFloat: {
    position: "absolute",
    left: 16,
    bottom: 80,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  reasoningFloatInChart: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  floatingIndicatorsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10,
  },
  floatingIndicatorsBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  floatingIndicatorsContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0f0f0f",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  bottomNavButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 90,
    flex: 1,
    marginHorizontal: 2,
  },
  bottomNavButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    minWidth: 120,
    flex: 1.2,
    marginHorizontal: 2,
  },
  analyzeButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    margin: 20,
    padding: 16,
    width: "80%",
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalDescription: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    marginRight: 8,
  },
  modalCancelText: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "600",
  },
  modalApplyButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#00D4AA",
    borderRadius: 8,
  },
  modalApplyText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});
