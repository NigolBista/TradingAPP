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
// Removed IndicatorConfigModal - now using IndicatorConfigScreen
// LineStyleModal now imported in IndicatorConfigScreen
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
    (route.params?.chartType as ChartType) || "candlestick",
  );

  const initialTimeframe: string | undefined = route.params?.initialTimeframe;
  const isDayUp: boolean | undefined = route.params?.isDayUp;
  const [dayUp, setDayUp] = useState<boolean | undefined>(isDayUp);
  const initialDataParam: any[] | undefined = route.params?.initialData;
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
  const overrideIndicatorRef = React.useRef<
    | ((id: string | { name: string; paneId?: string }, styles: any) => void)
    | null
  >(null);

  // Rate limiting state for historical data requests
  const lastHistoricalRequestRef = useRef<number>(0);
  const historicalRequestTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State variables
  const [data, setData] = useState<any[]>(initialDataParam || []);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>(
    (initialTimeframe as ExtendedTimeframe) || defaultTimeframe || "1D",
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
    initialTradePlan,
  );
  const [showMA, setShowMA] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(false);
  const [indicatorsExpanded, setIndicatorsExpanded] = useState<boolean>(false);
  // Indicators state
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const latestIndicatorsRef = useRef<IndicatorConfig[]>([]);
  const styleRetryRef = useRef<NodeJS.Timeout | null>(null);
  const [showIndicatorsSheet, setShowIndicatorsSheet] = useState(false);
  // migrated animations handled in extracted components
  const [showIndicatorsAccordion, setShowIndicatorsAccordion] = useState(false);
  useEffect(() => {
    latestIndicatorsRef.current = indicators;
  }, [indicators]);
  useEffect(() => {
    return () => {
      if (styleRetryRef.current) clearInterval(styleRetryRef.current);
    };
  }, []);
  // Removed indicator config modal state - now using screen navigation
  // Line style editing now handled in IndicatorConfigScreen
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
        : "auto",
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
    initialAnalysisContext?.desiredRR || 1.5,
  );
  const [contextMode, setContextMode] = useState<
    "price_action" | "news_sentiment"
  >((initialAnalysisContext?.contextMode as any) || "price_action");
  // Simplified: mode is UI-only; analysis runs when user presses Analyze
  const [tradeMode, setTradeMode] = useState<"day" | "swing">("day");
  const [showCustomRrModal, setShowCustomRrModal] = useState<boolean>(false);

  // Auto-analysis and streaming output
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState<boolean>(
    !!initialAnalysisContext || !!initialAiMeta, // Skip auto-analysis if we have existing analysis data
  );
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Reasoning box visibility control
  const [showReasoning, setShowReasoning] = useState<boolean>(false);
  const [hasExistingReasoning, setHasExistingReasoning] =
    useState<boolean>(!!initialAiMeta);

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
      8,
  );

  useEffect(() => {
    loadStockName();
    hydrate();
    // Only reset auto-analysis flag if we don't have existing analysis data
    if (!initialAnalysisContext && !initialAiMeta) {
      setHasAutoAnalyzed(false);
    }
  }, [symbol]);

  const applyIndicatorStyles = React.useCallback(() => {
    if (styleRetryRef.current) clearInterval(styleRetryRef.current);

    const attempt = () => {
      if (!overrideIndicatorRef.current) return;
      latestIndicatorsRef.current.forEach((indicator) => {
        if (indicator.styles?.lines) {
          overrideIndicatorRef.current!(indicator.name, {
            lines: indicator.styles.lines,
          });
        }
      });
    };

    // Run once immediately and then retry for a short period to handle chart resets
    attempt();
    let tries = 0;
    styleRetryRef.current = setInterval(() => {
      attempt();
      tries += 1;
      if (tries > 20) {
        if (styleRetryRef.current) clearInterval(styleRetryRef.current);
        styleRetryRef.current = null;
      }
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

  function toggleIndicator(name: string) {
    setIndicators((prev) => {
      const updated = toggleIndicatorInList(prev as any, name) as any;

      // If we added a new indicator, apply its default styles to the chart
      if (updated.length > prev.length) {
        const newIndicator = updated.find((ind: any) => ind.name === name);
        if (newIndicator && overrideIndicatorRef.current) {
          console.log(
            `🎨 Applying default colors for ${name}:`,
            newIndicator.styles?.lines,
          );
          overrideIndicatorRef.current(name, {
            lines: newIndicator.styles?.lines || [],
          });
        }
      }

      latestIndicatorsRef.current = updated;
      return updated;
    });
    applyIndicatorStyles();
  }

  function updateIndicatorLine(
    name: string,
    lineIndex: number,
    updates: Partial<{ color: string; size: number; style: string }>,
  ) {
    setIndicators((prev) => {
      const updated = updateIndicatorLineInList(
        prev as any,
        name,
        lineIndex,
        updates as any,
      ) as any;

      // Apply the style override to the chart immediately with the updated state
      if (overrideIndicatorRef.current) {
        const indicator = updated.find((i: any) => i.name === name);
        if (indicator) {
          const count = Array.isArray(indicator.calcParams)
            ? indicator.calcParams.length
            : 1;
          const lines = Array.isArray((indicator.styles as any)?.lines)
            ? ((indicator.styles as any).lines as any[]).slice()
            : [];

          // Create a new lines array with only the specific line updated
          const updatedLines = [];
          for (let i = 0; i < count; i++) {
            if (i === lineIndex) {
              // Apply updates to the specific line
              updatedLines.push({ ...lines[i], ...updates });
            } else {
              // Keep existing line style
              updatedLines.push(
                lines[i] || { color: "#3B82F6", size: 1, style: "solid" },
              );
            }
          }

          // Apply override to chart with line index information
          overrideIndicatorRef.current(name, {
            lines: updatedLines,
            lineIndex: lineIndex, // Pass the line index for precise targeting
          });
        }
      }

      latestIndicatorsRef.current = updated;
      return updated;
    });
    applyIndicatorStyles();
  }

  // Line style editor functions removed - now handled in IndicatorConfigScreen

  function openIndicatorConfig(name: string) {
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
  }

  // Removed closeIndicatorConfig - no longer needed with screen navigation

  function addIndicatorParam(name: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setIndicators((prev) => {
      const { list, newIndex } = addIndicatorParamInList(
        prev as any,
        name,
        Math.floor(value),
      );
      // Note: configSelectedIndex no longer needed with screen navigation
      // Note: No need to update indicatorToEdit since we're using screen navigation
      // Force shallow copy to change array reference for WebView key
      return list.slice() as any;
    });
  }

  function removeIndicatorParam(name: string, value: number) {
    setIndicators((prev) => {
      const updated = removeIndicatorParamInList(
        prev as any,
        name,
        value,
      ) as any;
      // Note: No need to update indicatorToEdit since we're using screen navigation
      // Force shallow copy to change array reference for WebView key
      return updated.slice();
    });
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
          (prev) =>
            prev + (currentIndex === 0 ? "" : " ") + words[currentIndex],
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

  // Test function to demonstrate indicator style overrides
  function testIndicatorOverrides() {
    if (!overrideIndicatorRef.current) {
      console.log("❌ overrideIndicatorRef.current is null");
      return;
    }

    console.log(
      "🔍 Current indicators:",
      indicators.map((i) => i.name),
    );

    // First, let's add an EMA indicator if it doesn't exist
    if (!indicators.find((i) => i.name === "EMA")) {
      console.log("➕ Adding EMA indicator for testing");
      toggleIndicator("EMA");

      // Wait a bit for the indicator to be added, then apply override
      setTimeout(() => {
        applyTestOverride();
      }, 1000);
    } else {
      applyTestOverride();
    }
  }

  function applyTestOverride() {
    if (!overrideIndicatorRef.current) return;

    console.log("🎨 Applying test override...");

    // Test different styles for EMA indicator - line-specific
    const emaId = "EMA";

    // Test 1: Change only the first line (EMA9) to orange with dashed line
    overrideIndicatorRef.current(emaId, {
      lines: [
        {
          color: "#ff9800",
          size: 3,
          style: "dashed",
          dashedValue: [6, 3],
        },
        {
          color: "#00D4AA", // Keep second line default
          size: 1,
          style: "solid",
        },
        {
          color: "#00D4AA", // Keep third line default
          size: 1,
          style: "solid",
        },
      ],
      lineIndex: 0, // Specify we're updating line 0 (EMA9)
    });

    // Test 2: Change only the second line (EMA12) to red
    setTimeout(() => {
      if (overrideIndicatorRef.current) {
        console.log("🎨 Trying line-specific override for EMA12...");
        overrideIndicatorRef.current(emaId, {
          lines: [
            {
              color: "#ff9800", // Keep first line orange
              size: 3,
              style: "dashed",
              dashedValue: [6, 3],
            },
            {
              color: "#ff0000", // Change second line to red
              size: 4,
              style: "solid",
            },
            {
              color: "#00D4AA", // Keep third line default
              size: 1,
              style: "solid",
            },
          ],
          lineIndex: 1, // Specify we're updating line 1 (EMA12)
        });
      }
    }, 2000);

    console.log(
      "✅ Applied test indicator override for EMA with line-specific styling",
    );
  }

  // Test function to check chart capabilities
  function testChartCapabilities() {
    if (!overrideIndicatorRef.current) return;

    console.log("🔍 Testing chart capabilities...");

    // Try a direct injection test
    const testCode = `
      if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.testChartCapabilities) {
        window.__SIMPLE_KLINE__.testChartCapabilities();
      } else {
        console.log('❌ testChartCapabilities function not available');
      }
    `;

    // Send a test message that will trigger the test function
    console.log("📤 Sending capability test message");

    // We need to access the WebView to send the message
    // For now, let's just trigger the test by calling the overrideIndicator with a special test case
    if (overrideIndicatorRef.current) {
      // Send a test message by calling overrideIndicator with test parameters
      console.log("📤 Triggering test via overrideIndicator call");
      overrideIndicatorRef.current("TEST_CAPABILITIES", { test: true });
    }
  }

  // Function to get current indicator styles
  function getCurrentIndicatorStyles(indicatorName: string) {
    console.log("🔍 Getting current styles for:", indicatorName);

    // We need to access the WebView to call the function
    // For now, let's just log what we expect
    console.log("📤 Would call getCurrentIndicatorStyles for:", indicatorName);
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

      {/* Indicator Config now handled by IndicatorConfigScreen navigation */}
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
          onOverrideIndicator={(overrideFn) => {
            overrideIndicatorRef.current = overrideFn;
            applyIndicatorStyles();
          }}
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
                    3,
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

        {/* Test Indicator Override Button - Remove this in production */}
        <View
          style={{
            marginTop: 8,
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Pressable
            onPress={testIndicatorOverrides}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: "#ff9800",
            }}
          >
            <Text style={{ color: "#000", fontWeight: "600", fontSize: 12 }}>
              Test Override
            </Text>
          </Pressable>
          <Pressable
            onPress={testChartCapabilities}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: "#3B82F6",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
              Test Capabilities
            </Text>
          </Pressable>
          <Pressable
            onPress={() => getCurrentIndicatorStyles("EMA")}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: "#10B981",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
              Get EMA Styles
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
            prev ? applyComplexityToPlan(prev, c) : prev,
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
