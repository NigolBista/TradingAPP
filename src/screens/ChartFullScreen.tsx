import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Text,
  ScrollView,
  useColorScheme,
  Modal,
  TextInput,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SimpleKLineChart, {
  type IndicatorConfig,
} from "../components/charts/SimpleKLineChart";
// Removed viewportBars usage; we'll lazy-load via timeRangeChange
import { type ChartType } from "../components/charts/ChartSettingsModal";
import { ExtendedTimeframe } from "../components/charts/TimeframePickerModal";
// UI components extracted from monolith
import ChartHeader from "./ChartFullScreen/ChartHeader";
import IndicatorsAccordion from "./ChartFullScreen/IndicatorsAccordion";
import OHLCRow from "./ChartFullScreen/OHLCRow";
import TimeframeBar from "./ChartFullScreen/TimeframeBar";
import UnifiedBottomSheet from "./ChartFullScreen/UnifiedBottomSheet";
import ComplexityBottomSheet from "./ChartFullScreen/ComplexityBottomSheet";
import ReasoningBottomSheet from "./ChartFullScreen/ReasoningBottomSheet";
import IndicatorsSheet from "./ChartFullScreen/IndicatorsSheet";
import IndicatorConfigModal from "./ChartFullScreen/IndicatorConfigModal";
import LineStyleModal from "./ChartFullScreen/LineStyleModal";
import CustomRRModal from "./ChartFullScreen/CustomRRModal";
// Indicator helpers
import {
  toggleIndicatorInList,
  updateIndicatorLineInList,
  addIndicatorParamInList,
  removeIndicatorParamInList,
} from "./ChartFullScreen/indicators";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
// Remove direct candle fetching; KLinePro handles candles internally via Polygon
import { fetchNews as fetchSymbolNews } from "../services/newsProviders";
import {
  runAIStrategy,
  aiOutputToTradePlan,
  applyComplexityToPlan,
} from "../logic/aiStrategyEngine";
// Removed on-the-fly plan generation imports
import { useChatStore } from "../store/chatStore";
import { useSignalCacheStore } from "../store/signalCacheStore";
import { useUserStore } from "../store/userStore";
import { StrategyComplexity } from "../logic/types";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../logic/strategyComplexity";
import { fetchSingleQuote, type SimpleQuote } from "../services/quotes";
import { getUpcomingFedEvents } from "../services/federalReserve";
import {
  fetchCandles,
  fetchCandlesForTimeframe,
  type Candle,
} from "../services/marketProviders";
import { timeframeSpacingMs } from "./ChartFullScreen/utils";

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const symbol: string = route.params?.symbol || "AAPL";
  const { addAnalysisMessage } = useChatStore();
  const { cacheSignal, getCachedSignal } = useSignalCacheStore();
  const { profile, setProfile } = useUserStore();
  const [chartType, setChartType] = useState<ChartType>(
    (route.params?.chartType as ChartType) || "candlestick"
  );
  const timeframe: string = route.params?.timeframe || "1D";
  const initialTimeframe: string | undefined = route.params?.initialTimeframe;
  const isDayUp: boolean | undefined = route.params?.isDayUp;
  const [dayUp, setDayUp] = useState<boolean | undefined>(isDayUp);
  const initialDataParam: any[] | undefined = route.params?.initialData;
  const levels = route.params?.levels;
  const initialTradePlan: any | undefined = route.params?.tradePlan;
  const initialAiMeta:
    | undefined
    | {
        strategyChosen?: string;
        side?: "long" | "short";
        confidence?: number;
        why?: string[];
        notes?: string[];
        targets?: number[];
        riskReward?: number;
      } = route.params?.ai;
  const initialAnalysisContext = route.params?.analysisContext;
  const { pinned, defaultTimeframe, hydrate, setDefaultTimeframe, toggle } =
    useTimeframeStore();
  const [pinError, setPinError] = useState<string | null>(null);
  const chartRef = React.useRef<any>(null);
  const barSpacingRef = React.useRef<number>(60_000);

  // Rate limiting state for historical data requests
  const lastHistoricalRequestRef = useRef<number>(0);
  const historicalRequestTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State variables
  const [data, setData] = useState<any[]>(initialDataParam || []);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>(
    (initialTimeframe as ExtendedTimeframe) || defaultTimeframe || "1D"
  );
  const [stockName, setStockName] = useState<string>("");
  React.useEffect(() => {
    try {
      if (initialDataParam && initialDataParam.length >= 2) {
        const last = initialDataParam[initialDataParam.length - 1];
        const prev = initialDataParam[initialDataParam.length - 2];
        const inferred = Math.max(1, last.time - prev.time);
        barSpacingRef.current = inferred;
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      if (data && data.length >= 2) {
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const inferred = Math.max(1, last.time - prev.time);
        barSpacingRef.current = inferred;
      } else {
        barSpacingRef.current = timeframeSpacingMs(extendedTf);
      }
    } catch {
      barSpacingRef.current = timeframeSpacingMs(extendedTf);
    }
  }, [data, extendedTf]);
  // Real-time logic is now handled by AmChartsCandles component itself

  // Additional state variables
  const [showUnifiedBottomSheet, setShowUnifiedBottomSheet] = useState(false);
  // migrated animations handled in extracted components
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [currentTradePlan, setCurrentTradePlan] = useState<any | undefined>(
    initialTradePlan
  );
  const [showMA, setShowMA] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(false);
  const [indicatorsExpanded, setIndicatorsExpanded] = useState<boolean>(false);
  // Indicators state
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [showIndicatorsSheet, setShowIndicatorsSheet] = useState(false);
  // migrated animations handled in extracted components
  const [showIndicatorsAccordion, setShowIndicatorsAccordion] = useState(false);
  const [showIndicatorConfigModal, setShowIndicatorConfigModal] =
    useState<boolean>(false);
  const [indicatorToEdit, setIndicatorToEdit] =
    useState<IndicatorConfig | null>(null);
  const [configSelectedIndex, setConfigSelectedIndex] = useState<number>(0);
  const [newParamValue, setNewParamValue] = useState<number>(9);
  // Sub-editor for per-line style (color/thickness/style)
  const [showLineStyleModal, setShowLineStyleModal] = useState<boolean>(false);
  const [lineStyleEditIndex, setLineStyleEditIndex] = useState<number>(0);
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);
  const [aiMeta, setAiMeta] = useState<
    | undefined
    | {
        strategyChosen?: string;
        side?: "long" | "short";
        confidence?: number;
        why?: string[];
        notes?: string[];
        targets?: number[];
        riskReward?: number;
      }
  >(initialAiMeta);
  // Remove explicit sentiment; use bias with neutral
  // Initialize state from analysis context if coming from chat
  const [mode, setMode] = useState<"auto" | "day_trade" | "swing_trade">(
    initialAnalysisContext?.mode === "day_trade"
      ? "day_trade"
      : initialAnalysisContext?.mode === "swing_trade"
      ? "swing_trade"
      : "auto"
  );

  const showUnifiedBottomSheetWithTab = () => {
    setShowUnifiedBottomSheet(true);
  };

  const hideBottomSheet = () => {
    setShowUnifiedBottomSheet(false);
  };

  const showComplexityBottomSheetWithTab = () => {
    setShowComplexityBottomSheet(true);
  };

  const hideComplexityBottomSheet = () => {
    setShowComplexityBottomSheet(false);
  };

  const [tradePace, setTradePace] = useState<
    "auto" | "day" | "scalp" | "swing"
  >((initialAnalysisContext?.tradePace as any) || "auto");
  const [desiredRR, setDesiredRR] = useState<number>(
    initialAnalysisContext?.desiredRR || 1.5
  );
  const [contextMode, setContextMode] = useState<
    "price_action" | "news_sentiment"
  >((initialAnalysisContext?.contextMode as any) || "price_action");
  // Simplified: mode is UI-only; analysis runs when user presses Analyze
  const [tradeMode, setTradeMode] = useState<"day" | "swing">("day");
  const [showCustomRrModal, setShowCustomRrModal] = useState<boolean>(false);

  // Auto-analysis and streaming output
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState<boolean>(
    !!initialAnalysisContext || !!initialAiMeta // Skip auto-analysis if we have existing analysis data
  );
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Reasoning box visibility control
  const [showReasoning, setShowReasoning] = useState<boolean>(false);
  const [hasExistingReasoning, setHasExistingReasoning] = useState<boolean>(
    !!initialAiMeta
  );

  // Strategy complexity state
  const [showComplexityBottomSheet, setShowComplexityBottomSheet] =
    useState<boolean>(false);
  // migrated animations handled in extracted components
  const [selectedComplexity, setSelectedComplexity] =
    useState<StrategyComplexity>(profile.strategyComplexity || "advanced");
  // Reasoning bottom sheet state
  const [showReasoningBottomSheet, setShowReasoningBottomSheet] =
    useState<boolean>(false);
  // migrated animations handled in extracted components

  const headerHeight = 52;
  const ohlcRowHeight = 24;
  const indicatorBarHeight = indicatorsExpanded ? 88 : 28;
  const timeframeRowHeight = 48;
  const bottomNavHeight = 56;
  const chartHeight = Math.max(
    120,
    height -
      insets.top -
      insets.bottom -
      headerHeight -
      ohlcRowHeight -
      indicatorBarHeight -
      timeframeRowHeight -
      bottomNavHeight -
      8
  );

  useEffect(() => {
    loadStockName();
    hydrate();
    // Only reset auto-analysis flag if we don't have existing analysis data
    if (!initialAnalysisContext && !initialAiMeta) {
      setHasAutoAnalyzed(false);
    }
  }, [symbol]);

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
        // Set the text immediately without streaming for existing analysis
        setStreamingText(reasoningText);
        setIsStreaming(false);
      }
    }
  }, [initialAiMeta]);

  // Core analysis function
  async function performAnalysis(isAutoAnalysis: boolean = false) {
    try {
      setAnalyzing(true);
      // Fetch a compact, mode-specific candle window to avoid flooding AI with history
      let d: any[] = [];
      let h1: any[] = [];
      let m15: any[] = [];
      let m5: any[] = [];
      let m1: any[] = [];

      const pace = isAutoAnalysis ? tradePace : tradePace; // honor current selection
      try {
        if (pace === "scalp") {
          const [c1, c5, c15, c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "1", limit: 120 }), // ~2 hours of 1m
            fetchCandles(symbol, { resolution: "5", limit: 60 }), // ~5 hours of 5m
            fetchCandles(symbol, { resolution: "15", limit: 32 }), // ~8 hours of 15m
            fetchCandles(symbol, { resolution: "1H", limit: 24 }), // 1 day of 1h
            fetchCandles(symbol, { resolution: "D", limit: 20 }), // ~1 month of daily
          ]);
          m1 = c1;
          m5 = c5;
          m15 = c15;
          h1 = c60;
          d = cd;
        } else if (pace === "day") {
          const [c5, c15, c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "5", limit: 78 }), // 1 trading day (5m)
            fetchCandles(symbol, { resolution: "15", limit: 52 }), // ~2 trading days (15m)
            fetchCandles(symbol, { resolution: "1H", limit: 48 }), // ~2 trading days (1h)
            fetchCandles(symbol, { resolution: "D", limit: 45 }), // ~2 months (daily)
          ]);
          m5 = c5;
          m15 = c15;
          h1 = c60;
          d = cd;
        } else if (pace === "swing") {
          const [c60, cd] = await Promise.all([
            fetchCandles(symbol, { resolution: "1H", limit: 200 }), // ~6-8 weeks hourly
            fetchCandles(symbol, { resolution: "D", limit: 180 }), // ~9 months daily
          ]);
          h1 = c60;
          d = cd;
          // Provide small intraday context for entry refinement
          const [c15, c5] = await Promise.all([
            fetchCandles(symbol, { resolution: "15", limit: 32 }),
            fetchCandles(symbol, { resolution: "5", limit: 60 }),
          ]);
          m15 = c15;
          m5 = c5;
        } else {
          // default (auto): balanced small set
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
        // If candle fetching fails, proceed with minimal arrays
        console.warn("Candle fetch failed for AI analysis:", err);
      }

      // Context fetches - comprehensive for auto-analysis, user-controlled for manual
      const shouldFetchContext =
        isAutoAnalysis || contextMode === "news_sentiment";
      let newsBrief: any[] | undefined = undefined;
      let marketNewsBrief: any[] | undefined = undefined;
      let fedBrief: any[] | undefined = undefined;
      let vixSnapshot:
        | { value: number; bucket: "low" | "moderate" | "high" }
        | undefined = undefined;

      // Fetch symbol news
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

        // For auto-analysis, also fetch comprehensive macro context
        if (isAutoAnalysis) {
          // Fetch market news
          try {
            const marketNews = await fetchSymbolNews("SPY"); // Use SPY as market proxy
            marketNewsBrief = (marketNews || []).slice(0, 3).map((n: any) => ({
              title: n.title,
              summary: (n.summary || "").slice(0, 120),
              source: n.source,
            }));
          } catch {}

          // Fetch FOMC events
          try {
            const events = await getUpcomingFedEvents();
            fedBrief = (events || []).slice(0, 3).map((e: any) => ({
              title: e.title,
              date: e.date,
              impact: e.impact,
              type: e.type,
            }));
          } catch {}

          // Fetch VIX snapshot
          try {
            const val = 0;
            const bucket = val < 15 ? "low" : val <= 25 ? "moderate" : "high";
            vixSnapshot = { value: val, bucket };
          } catch {}
        }
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

      // Enhanced context for comprehensive analysis
      const analysisMode = isAutoAnalysis ? "auto" : mode;

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

      const output = await runAIStrategy({
        symbol,
        mode: analysisMode,
        candleData,
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
            pace: isAutoAnalysis ? "auto" : tradePace,
            desiredRR: isAutoAnalysis ? 2.0 : desiredRR, // Higher R:R for auto-analysis
          },
          includeFlags: {
            macro: isAutoAnalysis,
            sentiment: shouldFetchContext,
            vix: isAutoAnalysis,
            fomc: isAutoAnalysis,
            market: isAutoAnalysis,
            fundamentals: true,
          },
          news: newsBrief,
          marketNews: marketNewsBrief,
          fedEvents: fedBrief,
          sentimentSummary,
          vix: vixSnapshot,
          fundamentals: { level: isAutoAnalysis ? "comprehensive" : "neutral" },
          analysisType: isAutoAnalysis ? "comprehensive_auto" : "user_directed",
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
          targets: output.targets || [],
          riskReward: output.riskReward,
        };
        setAiMeta(newAiMeta);

        // Create streaming text from reasoning
        const reasoningText =
          (output.why || []).join(". ") +
          (output.tradePlanNotes
            ? ". " + output.tradePlanNotes.join(". ")
            : "");

        if (reasoningText) {
          simulateStreamingText(reasoningText);
        }

        // Show reasoning box when new analysis is done
        setShowReasoning(true);
        setHasExistingReasoning(true);

        // For manual analysis (not auto), move current cached signal to history first
        if (!isAutoAnalysis) {
          const currentCached = getCachedSignal(symbol);
          if (currentCached) {
            addAnalysisMessage({
              symbol: currentCached.symbol,
              strategy: currentCached.aiMeta?.strategyChosen,
              side: currentCached.aiMeta?.side,
              entry: currentCached.tradePlan?.entry,
              lateEntry: currentCached.tradePlan?.lateEntry,
              exit: currentCached.tradePlan?.exit,
              lateExit: currentCached.tradePlan?.lateExit,
              stop: currentCached.tradePlan?.stop,
              targets: currentCached.aiMeta?.targets,
              riskReward: currentCached.aiMeta?.riskReward,
              confidence: currentCached.aiMeta?.confidence,
              why: currentCached.aiMeta?.why,
              tradePlan: currentCached.tradePlan,
              aiMeta: currentCached.aiMeta,
              analysisContext: currentCached.analysisContext,
            });
          }
        }

        // Cache the new signal (but don't add to history - it becomes the new "current")
        const cachedSignalData = {
          symbol,
          timestamp: Date.now(),
          tradePlan: tp,
          aiMeta: newAiMeta,
          analysisContext: {
            mode: analysisMode,
            tradePace: isAutoAnalysis ? "auto" : tradePace,
            desiredRR: isAutoAnalysis ? 2.0 : desiredRR,
            contextMode,
            isAutoAnalysis,
          },
          rawAnalysisOutput: output,
        };
        cacheSignal(cachedSignalData);
      }
    } catch (error) {
      console.warn("AI analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  }

  // Auto-analysis on data load
  useEffect(() => {
    if (data.length > 0 && !hasAutoAnalyzed && !analyzing) {
      setHasAutoAnalyzed(true);
      // Delay slightly to ensure chart is rendered
      setTimeout(() => {
        performAnalysis(true);
      }, 500);
    }
  }, [data, hasAutoAnalyzed, analyzing]);

  // No candle fetching; chart is rendered by KLinePro

  // Removed on-the-fly plan generation to avoid auto-analysis side effects

  // Final fallback: derive direction from loaded data if still unknown
  useEffect(() => {
    if (typeof dayUp === "boolean") return;
    if (!data || data.length < 2) return;
    const first = data[0]?.close;
    const last = data[data.length - 1]?.close;
    if (typeof first === "number" && typeof last === "number") {
      setDayUp(last >= first);
    }
  }, [data, dayUp]);

  // Removed unused effectiveLevels; chart levels are derived from currentTradePlan

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

  // Handle timeframe change and save as default
  async function handleTimeframeChange(tf: ExtendedTimeframe) {
    setExtendedTf(tf);
    setDefaultTimeframe(tf); // Save as user's preferred default

    // Reset view state for new timeframe
    // Immediately fetch data for the new timeframe using smart candle manager
  }

  // Indicator helpers
  const BUILTIN_INDICATORS: Array<{
    name: string;
    defaultParams?: any;
    compatOverlay?: boolean;
    defaultColor?: string;
  }> = [
    {
      name: "MA",
      defaultParams: [5, 10, 30, 60],
      compatOverlay: true,
      defaultColor: "#3B82F6",
    },
    {
      name: "EMA",
      defaultParams: [6, 12, 20],
      compatOverlay: true,
      defaultColor: "#22D3EE",
    },
    {
      name: "SMA",
      defaultParams: [12, 2],
      compatOverlay: true,
      defaultColor: "#EAB308",
    },
    {
      name: "BBI",
      defaultParams: [3, 6, 12, 24],
      compatOverlay: true,
      defaultColor: "#A78BFA",
    },
    {
      name: "BOLL",
      defaultParams: [20, 2],
      compatOverlay: true,
      defaultColor: "#F59E0B",
    },
    {
      name: "VOL",
      defaultParams: [5, 10, 20],
      compatOverlay: false,
      defaultColor: "#6EE7B7",
    },
    {
      name: "MACD",
      defaultParams: [12, 26, 9],
      compatOverlay: false,
      defaultColor: "#60A5FA",
    },
    {
      name: "KDJ",
      defaultParams: [9, 3, 3],
      compatOverlay: false,
      defaultColor: "#34D399",
    },
    {
      name: "RSI",
      defaultParams: [6, 12, 24],
      compatOverlay: false,
      defaultColor: "#F472B6",
    },
    {
      name: "SAR",
      defaultParams: [2, 2, 20],
      compatOverlay: true,
      defaultColor: "#FB7185",
    },
    {
      name: "OBV",
      defaultParams: [30],
      compatOverlay: false,
      defaultColor: "#93C5FD",
    },
    {
      name: "DMA",
      defaultParams: [10, 50, 10],
      compatOverlay: false,
      defaultColor: "#67E8F9",
    },
    {
      name: "TRIX",
      defaultParams: [12, 20],
      compatOverlay: false,
      defaultColor: "#FDE047",
    },
    {
      name: "BRAR",
      defaultParams: [26],
      compatOverlay: false,
      defaultColor: "#FCA5A5",
    },
    {
      name: "VR",
      defaultParams: [24, 30],
      compatOverlay: false,
      defaultColor: "#A7F3D0",
    },
    {
      name: "WR",
      defaultParams: [6, 10, 14],
      compatOverlay: false,
      defaultColor: "#F9A8D4",
    },
    {
      name: "MTM",
      defaultParams: [6, 10],
      compatOverlay: false,
      defaultColor: "#C4B5FD",
    },
    {
      name: "EMV",
      defaultParams: [14, 9],
      compatOverlay: false,
      defaultColor: "#FDBA74",
    },
    {
      name: "DMI",
      defaultParams: [14, 6],
      compatOverlay: false,
      defaultColor: "#86EFAC",
    },
    {
      name: "CR",
      defaultParams: [26, 10, 20, 40, 60],
      compatOverlay: false,
      defaultColor: "#FDA4AF",
    },
    {
      name: "PSY",
      defaultParams: [12, 6],
      compatOverlay: false,
      defaultColor: "#FDE68A",
    },
    {
      name: "AO",
      defaultParams: [5, 34],
      compatOverlay: false,
      defaultColor: "#A5B4FC",
    },
    {
      name: "ROC",
      defaultParams: [12, 6],
      compatOverlay: false,
      defaultColor: "#FCA5A5",
    },
    { name: "PVT", compatOverlay: false, defaultColor: "#93C5FD" },
    { name: "AVP", compatOverlay: false, defaultColor: "#FDE68A" },
  ];

  function buildDefaultLines(count: number, baseColor?: string) {
    const palette = [
      "#10B981",
      "#3B82F6",
      "#F59E0B",
      "#EF4444",
      "#A78BFA",
      "#22D3EE",
      "#F472B6",
      "#FDE047",
    ];
    const out: any[] = [];
    for (let i = 0; i < Math.max(1, count); i++) {
      out.push({
        color: i === 0 && baseColor ? baseColor : palette[i % palette.length],
        size: 1,
        style: "solid",
      });
    }
    return out;
  }

  function getDefaultIndicator(name: string): IndicatorConfig {
    const meta = BUILTIN_INDICATORS.find((i) => i.name === name);
    const params = meta?.defaultParams;
    const lines = Array.isArray(params)
      ? buildDefaultLines(params.length, meta?.defaultColor)
      : buildDefaultLines(1, meta?.defaultColor);
    return {
      id: `${name}-${Date.now()}`,
      name,
      overlay: !!meta?.compatOverlay,
      calcParams: params,
      styles: { lines },
    };
  }

  function isSelectedIndicator(name: string): boolean {
    return indicators.some((i) => i.name === name);
  }

  function toggleIndicator(name: string) {
    setIndicators((prev) => toggleIndicatorInList(prev as any, name) as any);
  }

  function updateIndicator(name: string, updates: Partial<IndicatorConfig>) {
    setIndicators((prev) =>
      prev.map((i) => (i.name === name ? { ...i, ...updates } : i))
    );
  }

  function updateIndicatorLine(
    name: string,
    lineIndex: number,
    updates: Partial<{ color: string; size: number; style: string }>
  ) {
    setIndicators(
      (prev) =>
        updateIndicatorLineInList(
          prev as any,
          name,
          lineIndex,
          updates as any
        ) as any
    );
  }

  function openLineStyleEditor(index: number) {
    setLineStyleEditIndex(index);
    setShowLineStyleModal(true);
  }

  function closeLineStyleEditor() {
    setShowLineStyleModal(false);
  }

  function openIndicatorConfig(name: string) {
    const ind = indicators.find((i) => i.name === name) || null;
    setIndicatorToEdit(ind);
    try {
      const count = Array.isArray(ind?.calcParams)
        ? (ind!.calcParams as any[]).length
        : 1;
      setConfigSelectedIndex(count > 0 ? 0 : 0);
      setNewParamValue(count > 0 ? Number(ind?.calcParams?.[0] ?? 9) : 9);
    } catch {}
    setShowIndicatorConfigModal(true);
  }

  function closeIndicatorConfig() {
    setShowIndicatorConfigModal(false);
    setIndicatorToEdit(null);
  }

  function addIndicatorParam(name: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setIndicators((prev) => {
      const { list, newIndex } = addIndicatorParamInList(
        prev as any,
        name,
        Math.floor(value)
      );
      setConfigSelectedIndex(newIndex);
      return list as any;
    });
  }

  function removeIndicatorParam(name: string, value: number) {
    setIndicators(
      (prev) => removeIndicatorParamInList(prev as any, name, value) as any
    );
  }

  const openIndicatorsSheet = () => {
    setShowIndicatorsSheet(true);
  };
  const closeIndicatorsSheet = () => {
    setShowIndicatorsSheet(false);
  };

  function parseNumberList(input: string): number[] | undefined {
    try {
      const parts = input
        .split(/[ ,]+/)
        .map((t) => Number(t.trim()))
        .filter((n) => Number.isFinite(n));
      return parts.length ? parts : undefined;
    } catch {
      return undefined;
    }
  }

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

  // formatting moved to utils; keep local wrappers if needed later

  // Simulate streaming text output
  function simulateStreamingText(fullText: string) {
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
    }, 80); // Adjust speed as needed
  }

  // Manual analysis (called by user button press)
  async function handleAnalyzePress() {
    return performAnalysis(false);
  }

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

      {showIndicatorsAccordion && (
        <IndicatorsAccordion
          indicators={indicators}
          onOpenConfig={(name) => openIndicatorConfig(name)}
          onToggleIndicator={(name) => toggleIndicator(name)}
          onOpenAddSheet={openIndicatorsSheet}
        />
      )}

      {/* Indicator Config Modal */}
      <IndicatorConfigModal
        visible={showIndicatorConfigModal && !!indicatorToEdit}
        onClose={closeIndicatorConfig}
        indicator={indicatorToEdit}
        newParamValue={newParamValue}
        setNewParamValue={setNewParamValue}
        onAddParam={addIndicatorParam}
        onOpenLineStyleEditor={openLineStyleEditor}
      />
      {/* Line Style Sub-Modal */}
      <LineStyleModal
        visible={showLineStyleModal && !!indicatorToEdit}
        onClose={closeLineStyleEditor}
        title={`${indicatorToEdit?.name || ""}${
          Array.isArray(indicatorToEdit?.calcParams)
            ? String(indicatorToEdit?.calcParams?.[lineStyleEditIndex] ?? "")
            : ""
        }`}
        onUpdateColor={(hex) =>
          updateIndicatorLine(indicatorToEdit!.name, lineStyleEditIndex, {
            color: hex,
          })
        }
        onUpdateThickness={(n) =>
          updateIndicatorLine(indicatorToEdit!.name, lineStyleEditIndex, {
            size: n,
          })
        }
        onUpdateStyle={(s) =>
          updateIndicatorLine(indicatorToEdit!.name, lineStyleEditIndex, {
            style: s,
          })
        }
      />
      {/* OHLCV Row */}
      <OHLCRow lastCandle={lastCandle} />

      {/* Chart */}
      <View style={{ marginBottom: 8 }}>
        {/* Controls moved to Strategy Complexity bottom sheet */}
        <SimpleKLineChart
          symbol={symbol}
          timeframe={extendedTf as any}
          height={chartHeight}
          theme={scheme === "dark" ? "dark" : "light"}
          chartType={
            chartType === "candlestick" ? "candle" : (chartType as any)
          }
          showVolume={showVolume}
          showMA={showMA}
          showTopInfo={false}
          showPriceAxisText={true}
          showTimeAxisText={true}
          indicators={indicators}
          levels={
            currentTradePlan
              ? {
                  entry: currentTradePlan.entry,
                  lateEntry: currentTradePlan.lateEntry,
                  exit: currentTradePlan.exit,
                  lateExit: currentTradePlan.lateExit,
                  stop: currentTradePlan.stop,
                  targets: (currentTradePlan.targets || []).slice(
                    0,
                    3
                  ) as number[],
                }
              : undefined
          }
        />
      </View>

      {/* Timeframe Chips - below chart */}
      <TimeframeBar
        pinned={pinned as any}
        extendedTf={extendedTf as any}
        onChangeTimeframe={(tf) => handleTimeframeChange(tf as any)}
        onOpenMore={showUnifiedBottomSheetWithTab}
      />

      {/* Unified Bottom Sheet */}
      <UnifiedBottomSheet
        visible={showUnifiedBottomSheet}
        onClose={hideBottomSheet}
        chartType={chartType}
        onSelectChartType={setChartType}
        extendedTf={extendedTf as any}
        pinned={pinned as any}
        onTogglePin={async (tf) => {
          const success = await toggle(tf);
          if (!success) {
            setPinError("You can pin up to 10 timeframes");
            setTimeout(() => setPinError(null), 2000);
          }
          return success;
        }}
      />

      {/* Reasoning Bottom Sheet */}
      <ReasoningBottomSheet
        visible={showReasoningBottomSheet}
        onClose={() => setShowReasoningBottomSheet(false)}
        isStreaming={isStreaming}
        streamingText={streamingText}
      />

      {/* Bottom Navigation - Reasoning, Analyze (center), Strategy (right) */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#2a2a2a",
          backgroundColor: "#0a0a0a",
          paddingTop: 8,
          paddingBottom: Math.max(12, insets.bottom),
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Reasoning */}
          <Pressable
            onPress={() => {
              if (!aiMeta && !isStreaming && !streamingText) return;
              setShowReasoningBottomSheet(true);
            }}
            disabled={!aiMeta && !isStreaming && !streamingText}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              opacity: !aiMeta && !isStreaming && !streamingText ? 0.6 : 1,
              minWidth: 110,
            }}
            hitSlop={8}
          >
            <Ionicons
              name="bulb"
              size={16}
              color="rgba(255,255,255,0.9)"
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
              Reasoning
            </Text>
          </Pressable>

          {/* Analyze (center) */}
          <Pressable
            onPress={handleAnalyzePress}
            disabled={analyzing}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 12,
              backgroundColor: analyzing
                ? "rgba(0,122,255,0.3)"
                : "rgba(0,122,255,0.9)",
              shadowColor: "#007AFF",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: analyzing ? 0.4 : 0.8,
              shadowRadius: analyzing ? 8 : 12,
              minWidth: 140,
            }}
            hitSlop={10}
          >
            {analyzing ? (
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Analyzing…
              </Text>
            ) : (
              <>
                <Ionicons
                  name="analytics"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Analyze
                </Text>
              </>
            )}
          </Pressable>
          {/* Strategy Complexity */}
          <Pressable
            onPress={showComplexityBottomSheetWithTab}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              minWidth: 110,
            }}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontWeight: "600",
                fontSize: 12,
                marginLeft: 6,
              }}
              numberOfLines={1}
            >
              {selectedComplexity.charAt(0).toUpperCase() +
                selectedComplexity.slice(1)}
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => setShowCustomRrModal(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 12,
              margin: 20,
              padding: 16,
              width: "80%",
              maxWidth: 360,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Custom R:R
              </Text>
              <Pressable onPress={() => setShowCustomRrModal(false)}>
                <Ionicons name="close" size={20} color="#888" />
              </Pressable>
            </View>
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>
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
              style={{
                backgroundColor: "#2a2a2a",
                borderRadius: 8,
                padding: 12,
                color: "#fff",
                fontSize: 16,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Pressable
                onPress={() => setShowCustomRrModal(false)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: "#2a2a2a",
                  borderRadius: 8,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{ color: "#ccc", fontSize: 14, fontWeight: "600" }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const val = Number(desiredRR);
                  if (Number.isFinite(val) && val > 0) {
                    setShowCustomRrModal(false);
                  }
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: "#00D4AA",
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ color: "#000", fontSize: 14, fontWeight: "700" }}
                >
                  Apply
                </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0a0a0a",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  backButton: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeframeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#888",
  },
  timeframeBar: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0a0a0a",
  },
  rangeSwitcherContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 24,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  rangeSwitcherScroll: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  tfChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "transparent",
    marginHorizontal: 4,
  },
  tfChipActive: {
    backgroundColor: "#00D4AA",
  },
  tfChipText: {
    color: "#e5e5e5",
    fontWeight: "600",
    fontSize: 12,
  },
  tfChipTextActive: {
    color: "#000",
  },
  tfMoreChip: {
    backgroundColor: "#1f2937",
  },
  tfMoreText: {
    color: "#fff",
    fontSize: 14,
    marginTop: -1,
  },

  timeframeSectionTitle: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeframeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    minWidth: 60,
    alignItems: "center",
  },
  timeframeButtonActive: {
    backgroundColor: "#00D4AA",
  },
  timeframeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  timeframeButtonTextActive: {
    color: "#000",
  },
  timeframeButtonPinned: {
    borderColor: "#00D4AA",
    borderWidth: 2,
    backgroundColor: "#002921",
  },
  timeframeButtonTextPinned: {
    color: "#00D4AA",
  },
  chartTypeRow: {
    flexDirection: "row",
    gap: 12,
  },
  chartTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  chartTypeButtonActive: {
    backgroundColor: "#00D4AA",
  },
  chartTypeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  chartTypeButtonTextActive: {
    color: "#000",
  },
});
