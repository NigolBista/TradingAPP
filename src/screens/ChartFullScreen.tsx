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
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SimpleKLineChart from "../components/charts/SimpleKLineChart";
// Removed viewportBars usage; we'll lazy-load via timeRangeChange
import { type ChartType } from "../components/charts/ChartSettingsModal";
import { ExtendedTimeframe } from "../components/charts/TimeframePickerModal";
import StockSearchBar from "../components/common/StockSearchBar";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
// Remove direct candle fetching; KLinePro handles candles internally via Polygon
import { fetchNews as fetchSymbolNews } from "../services/newsProviders";
import {
  runAIStrategy,
  aiOutputToTradePlan,
  applyComplexityToPlan,
} from "../logic/aiStrategyEngine";
import { useChatStore } from "../store/chatStore";
import { useSignalCacheStore } from "../store/signalCacheStore";
import { useUserStore } from "../store/userStore";
import { StrategyComplexity } from "../logic/types";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../logic/strategyComplexity";
import { fetchSingleQuote, type SimpleQuote } from "../services/quotes";
import { getUpcomingFedEvents } from "../services/federalReserve";
import { fetchCandles } from "../services/marketProviders";

function getExampleSetup(complexity: StrategyComplexity): string {
  switch (complexity) {
    case "simple":
      return "Entry: $150.00 • Stop Loss: $148.00 • Target: $154.00";
    case "partial":
      return "Entry: $150.00 • Stop Loss: $148.00 • TP1: $153.00 • TP2: $155.00";
    case "advanced":
      return "Entry: $150.00 • Late Entry: $150.45 • Stop Loss: $148.00 • Extended Stop: $147.50 • TP1: $152.25 • TP2: $153.75 • TP3: $155.25";
    default:
      return "";
  }
}

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
  function timeframeSpacingMs(tf: ExtendedTimeframe): number {
    switch (tf) {
      case "1m":
        return 60_000;
      case "2m":
        return 120_000;
      case "3m":
        return 180_000;
      case "5m":
        return 300_000;
      case "10m":
        return 600_000;
      case "15m":
        return 900_000;
      case "30m":
        return 1_800_000;
      case "1h":
        return 3_600_000;
      case "2h":
        return 7_200_000;
      case "4h":
        return 14_400_000;
      case "1D":
        return 86_400_000;
      case "1W":
        return 7 * 86_400_000;
      case "1M":
      case "3M":
      case "1Y":
      case "5Y":
      case "ALL":
        return 30 * 86_400_000;
      default:
        return 60_000;
    }
  }
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
  const [bottomSheetAnim] = useState(new Animated.Value(0));
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [currentTradePlan, setCurrentTradePlan] = useState<any | undefined>(
    initialTradePlan
  );
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
    Animated.timing(bottomSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const hideBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowUnifiedBottomSheet(false);
    });
  };

  const showComplexityBottomSheetWithTab = () => {
    setShowComplexityBottomSheet(true);
    Animated.timing(complexityBottomSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const hideComplexityBottomSheet = () => {
    Animated.timing(complexityBottomSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowComplexityBottomSheet(false);
    });
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
  const [complexityBottomSheetAnim] = useState(new Animated.Value(0));
  const [selectedComplexity, setSelectedComplexity] =
    useState<StrategyComplexity>(profile.strategyComplexity || "advanced");

  const chartHeight = Math.max(0, height - insets.top - insets.bottom - 60); // Account for header

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
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <StockSearchBar
            currentSymbol={symbol}
            currentStockName={stockName || "Loading..."}
          />
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Chart */}
      <View style={{ flex: 1 }}>
        {/* Controls moved to Strategy Complexity bottom sheet */}
        <SimpleKLineChart
          symbol={symbol}
          timeframe={extendedTf as any}
          height={chartHeight}
          theme={scheme === "dark" ? "dark" : "light"}
          chartType={
            chartType === "candlestick" ? "candle" : (chartType as any)
          }
          showVolume={true}
          showMA={true}
          showTopInfo={true}
          showPriceAxisText={true}
          showTimeAxisText={true}
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

        {/* Strategy Complexity Button */}
        <Pressable
          onPress={showComplexityBottomSheetWithTab}
          style={{
            position: "absolute",
            right: 16,
            bottom: insets.bottom + 130,
            backgroundColor: "rgba(0,212,170,0.9)",
            borderRadius: 16,
            paddingVertical: 8,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#00D4AA",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 8,
          }}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={16} color="#fff" />
          <Text
            style={{
              color: "#fff",
              fontWeight: "600",
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {selectedComplexity.charAt(0).toUpperCase() +
              selectedComplexity.slice(1)}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleAnalyzePress}
          disabled={analyzing}
          style={{
            position: "absolute",
            right: 16,
            bottom: insets.bottom + 72,
            backgroundColor: analyzing
              ? "rgba(0,122,255,0.3)"
              : "rgba(0,122,255,0.9)",
            borderRadius: 20,
            paddingVertical: 10,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#007AFF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: analyzing ? 0.4 : 0.8,
            shadowRadius: analyzing ? 12 : 16,
            elevation: 12,
          }}
          hitSlop={10}
        >
          {analyzing ? (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Analyzing…</Text>
          ) : (
            <>
              <Ionicons
                name="analytics"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: "#fff", fontWeight: "600" }}>Analyze</Text>
            </>
          )}
        </Pressable>
        {showReasoning && (aiMeta || isStreaming || streamingText) && (
          <View
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: insets.bottom + 64,
              backgroundColor: "rgba(17,24,39,0.9)",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              padding: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* Signal Type Pill */}
                {aiMeta?.side && (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor:
                        aiMeta.side === "long"
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      borderWidth: 1,
                      borderColor:
                        aiMeta.side === "long"
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(239, 68, 68, 0.3)",
                      marginRight: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: aiMeta.side === "long" ? "#10B981" : "#EF4444",
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {aiMeta.side === "long" ? "BUY" : "SHORT"}
                    </Text>
                  </View>
                )}
                <Text style={{ color: "#E5E7EB", fontWeight: "700" }}>
                  {isStreaming && "●"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => (navigation as any).navigate("Chat")}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: "#111827",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}
                  >
                    Open in Chat
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowReasoning(false)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <Ionicons name="close" size={14} color="#EF4444" />
                </Pressable>
              </View>
            </View>
            {aiMeta && (
              <View>
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                  {aiMeta.strategyChosen || "-"} ·{" "}
                  {Math.round(aiMeta.confidence || 0)}% confidence
                </Text>
                {/* Show entry/exit info when loaded from existing strategy */}
                {initialAnalysisContext && currentTradePlan && (
                  <Text
                    style={{ color: "#10B981", fontSize: 11, marginTop: 2 }}
                  >
                    Entry: ${currentTradePlan.entry?.toFixed(2)} · Stop: $
                    {currentTradePlan.stop?.toFixed(2)} ·
                    {currentTradePlan.targets &&
                      currentTradePlan.targets.length > 0 &&
                      `Target: $${currentTradePlan.targets[0].toFixed(2)}`}
                  </Text>
                )}
              </View>
            )}
            {/* Streaming text display */}
            {(isStreaming || streamingText) && (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={{ color: "#D1D5DB", fontSize: 12, lineHeight: 18 }}
                >
                  {streamingText}
                  {isStreaming && <Text style={{ color: "#00D4AA" }}>|</Text>}
                </Text>
              </View>
            )}
            {/* Static reasoning points when not streaming */}
            {!isStreaming &&
              !streamingText &&
              aiMeta?.why &&
              aiMeta.why.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {aiMeta.why.slice(0, 3).map((w, i) => (
                    <Text key={i} style={{ color: "#D1D5DB", fontSize: 12 }}>
                      • {w}
                    </Text>
                  ))}
                </View>
              )}
          </View>
        )}

        {/* Show Reasoning Button - appears when reasoning is hidden but exists */}
        {!showReasoning && hasExistingReasoning && aiMeta && (
          <Pressable
            onPress={() => setShowReasoning(true)}
            style={{
              position: "absolute",
              left: 16,
              bottom: insets.bottom + 72,
              backgroundColor: "transparent",
              borderRadius: 20,
              paddingVertical: 8,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "rgba(255,255,255,0.6)",
            }}
            hitSlop={10}
          >
            <Ionicons
              name="bulb"
              size={16}
              color="rgba(255,255,255,0.8)"
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: "rgba(255,255,255,0.8)",
                fontWeight: "600",
                fontSize: 12,
              }}
            >
              Reasoning
            </Text>
          </Pressable>
        )}

        {/* Unified Chart Controls */}
        <View
          style={[
            styles.rangeSwitcherContainer,
            { bottom: insets.bottom + 12 },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rangeSwitcherScroll}
          >
            {pinned.map((tf) => (
              <Pressable
                key={tf}
                onPress={() => handleTimeframeChange(tf)}
                style={[
                  styles.tfChip,
                  extendedTf === tf && styles.tfChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.tfChipText,
                    extendedTf === tf && styles.tfChipTextActive,
                  ]}
                >
                  {tf}
                </Text>
              </Pressable>
            ))}

            {/* Unified Settings Button */}
            <Pressable
              onPress={showUnifiedBottomSheetWithTab}
              style={[styles.tfChip, styles.tfMoreChip]}
              hitSlop={10}
            >
              <Ionicons name="options" size={16} color="#fff" />
            </Pressable>
          </ScrollView>
        </View>
        {/* Removed left quick row to avoid duplicate controls; modal picker handles timeframe switching */}
      </View>

      {/* Unified Bottom Sheet */}
      {showUnifiedBottomSheet && (
        <Modal
          visible={showUnifiedBottomSheet}
          transparent
          animationType="none"
          onRequestClose={hideBottomSheet}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={hideBottomSheet}
          >
            <Animated.View
              style={{
                backgroundColor: "#1a1a1a",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                paddingBottom: 40,
                maxHeight: Dimensions.get("window").height * 0.8,
                transform: [
                  {
                    translateY: bottomSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable>
                {/* Handle Bar */}
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: "#666",
                    borderRadius: 2,
                    alignSelf: "center",
                    marginBottom: 20,
                  }}
                />

                <ScrollView
                  style={{ maxHeight: 600 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Chart Type Row */}
                  <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                    <Text style={styles.timeframeSectionTitle}>Chart Type</Text>
                    <View style={styles.chartTypeRow}>
                      {[
                        {
                          type: "line" as ChartType,
                          label: "Line",
                          icon: "trending-up",
                        },
                        {
                          type: "candlestick" as ChartType,
                          label: "Candles",
                          icon: "bar-chart",
                        },
                        {
                          type: "area" as ChartType,
                          label: "Area",
                          icon: "analytics",
                        },
                      ].map((item) => (
                        <Pressable
                          key={item.type}
                          onPress={() => {
                            setChartType(item.type);
                            hideBottomSheet();
                          }}
                          style={[
                            styles.chartTypeButton,
                            chartType === item.type &&
                              styles.chartTypeButtonActive,
                          ]}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={20}
                            color={chartType === item.type ? "#000" : "#fff"}
                            style={{ marginBottom: 4 }}
                          />
                          <Text
                            style={[
                              styles.chartTypeButtonText,
                              chartType === item.type &&
                                styles.chartTypeButtonTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Timeframe Sections */}
                  <View style={{ paddingHorizontal: 20 }}>
                    {/* Minutes */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={styles.timeframeSectionTitle}>Minutes</Text>
                      <View style={styles.timeframeGrid}>
                        {["1m", "2m", "3m", "5m", "10m", "15m", "30m"].map(
                          (tf) => {
                            const isSelected = extendedTf === tf;
                            const isPinned = pinned.includes(
                              tf as ExtendedTimeframe
                            );
                            return (
                              <Pressable
                                key={tf}
                                onPress={async () => {
                                  const success = await toggle(
                                    tf as ExtendedTimeframe
                                  );
                                  if (!success) {
                                    setPinError(
                                      "You can pin up to 10 timeframes"
                                    );
                                    setTimeout(() => setPinError(null), 2000);
                                  }
                                }}
                                style={[
                                  styles.timeframeButton,
                                  isSelected && styles.timeframeButtonActive,
                                  isPinned && styles.timeframeButtonPinned,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.timeframeButtonText,
                                    isSelected &&
                                      styles.timeframeButtonTextActive,
                                    isPinned &&
                                      styles.timeframeButtonTextPinned,
                                  ]}
                                >
                                  {tf}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                    </View>

                    {/* Hours */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={styles.timeframeSectionTitle}>Hours</Text>
                      <View style={styles.timeframeGrid}>
                        {["1h", "2h", "4h"].map((tf) => {
                          const isSelected = extendedTf === tf;
                          const isPinned = pinned.includes(
                            tf as ExtendedTimeframe
                          );
                          return (
                            <Pressable
                              key={tf}
                              onPress={() => {
                                toggle(tf as ExtendedTimeframe);
                              }}
                              style={[
                                styles.timeframeButton,
                                isSelected && styles.timeframeButtonActive,
                                isPinned && styles.timeframeButtonPinned,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timeframeButtonText,
                                  isSelected &&
                                    styles.timeframeButtonTextActive,
                                  isPinned && styles.timeframeButtonTextPinned,
                                ]}
                              >
                                {tf}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {/* Days */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={styles.timeframeSectionTitle}>Days</Text>
                      <View style={styles.timeframeGrid}>
                        {["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "ALL"].map(
                          (tf) => {
                            const isSelected = extendedTf === tf;
                            const isPinned = pinned.includes(
                              tf as ExtendedTimeframe
                            );
                            return (
                              <Pressable
                                key={tf}
                                onPress={() => {
                                  toggle(tf as ExtendedTimeframe);
                                }}
                                style={[
                                  styles.timeframeButton,
                                  isSelected && styles.timeframeButtonActive,
                                  isPinned && styles.timeframeButtonPinned,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.timeframeButtonText,
                                    isSelected &&
                                      styles.timeframeButtonTextActive,
                                    isPinned &&
                                      styles.timeframeButtonTextPinned,
                                  ]}
                                >
                                  {tf}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Strategy Complexity Bottom Sheet */}
      {showComplexityBottomSheet && (
        <Modal
          visible={showComplexityBottomSheet}
          transparent
          animationType="none"
          onRequestClose={hideComplexityBottomSheet}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={hideComplexityBottomSheet}
          >
            <Animated.View
              style={{
                backgroundColor: "#1a1a1a",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                paddingBottom: 40,
                maxHeight: Dimensions.get("window").height * 0.8,
                transform: [
                  {
                    translateY: complexityBottomSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable>
                {/* Handle Bar */}
                <View
                  style={{
                    alignItems: "center",
                    paddingBottom: 20,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      backgroundColor: "#666",
                      borderRadius: 2,
                    }}
                  />
                </View>

                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    Strategy Complexity
                  </Text>
                  <Pressable
                    onPress={hideComplexityBottomSheet}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ paddingHorizontal: 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Mode Controls */}
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 11,
                        fontWeight: "700",
                        marginBottom: 8,
                      }}
                    >
                      Mode
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {[
                        { label: "Auto", pace: "auto", mode: "auto" },
                        { label: "Scalp", pace: "scalp", mode: "day_trade" },
                        { label: "Day", pace: "day", mode: "day_trade" },
                        { label: "Swing", pace: "swing", mode: "swing_trade" },
                      ].map((m) => (
                        <Pressable
                          key={m.label}
                          onPress={() => {
                            setMode(m.mode as any);
                            setTradePace(m.pace as any);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor:
                              m.pace === tradePace ||
                              (m.mode === mode && m.pace === "auto")
                                ? "#111827"
                                : "rgba(0,0,0,0.5)",
                            borderWidth: 1,
                            borderColor:
                              m.pace === tradePace ||
                              (m.mode === mode && m.pace === "auto")
                                ? "#6B7280"
                                : "rgba(255,255,255,0.08)",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "600",
                              fontSize: 12,
                            }}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* R:R Controls */}
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 11,
                        fontWeight: "700",
                        marginBottom: 8,
                      }}
                    >
                      R:R
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {[1.0, 1.5, 2.0, 3.0].map((rr) => (
                        <Pressable
                          key={rr}
                          onPress={() => setDesiredRR(rr)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor:
                              desiredRR === rr ? "#0F172A" : "rgba(0,0,0,0.5)",
                            borderWidth: 1,
                            borderColor:
                              desiredRR === rr
                                ? "#334155"
                                : "rgba(255,255,255,0.08)",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "600",
                              fontSize: 12,
                            }}
                          >{`1:${rr}`}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Include Controls */}
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 11,
                        fontWeight: "700",
                        marginBottom: 8,
                      }}
                    >
                      Include
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() =>
                          setContextMode(
                            contextMode === "news_sentiment"
                              ? "price_action"
                              : "news_sentiment"
                          )
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor:
                            contextMode === "news_sentiment"
                              ? "#2563EB"
                              : "rgba(0,0,0,0.5)",
                          borderWidth: 1,
                          borderColor:
                            contextMode === "news_sentiment"
                              ? "#2563EB"
                              : "rgba(255,255,255,0.08)",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          News + Sentiment
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#888",
                      textAlign: "center",
                      marginBottom: 20,
                    }}
                  >
                    Choose your preferred trading strategy complexity level
                  </Text>

                  {/* Strategy Options */}
                  {Object.entries(STRATEGY_COMPLEXITY_CONFIGS).map(
                    ([key, config]) => {
                      const complexity = key as StrategyComplexity;
                      const isSelected = selectedComplexity === complexity;

                      return (
                        <Pressable
                          key={complexity}
                          onPress={() => {
                            try {
                              setSelectedComplexity(complexity);
                              // Re-apply constraints to current plan immediately so chart updates
                              setCurrentTradePlan((prev: any) =>
                                prev
                                  ? applyComplexityToPlan(prev, complexity)
                                  : prev
                              );
                              // Optionally save to user profile
                              if (profile.autoApplyComplexity) {
                                setProfile({ strategyComplexity: complexity });
                              }
                            } finally {
                              hideComplexityBottomSheet();
                            }
                          }}
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isSelected ? "#00D4AA" : "#333",
                            padding: 16,
                            marginBottom: 12,
                            backgroundColor: isSelected
                              ? "rgba(0,212,170,0.1)"
                              : "#2a2a2a",
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
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: "600",
                                color: isSelected ? "#00D4AA" : "#fff",
                              }}
                            >
                              {complexity.charAt(0).toUpperCase() +
                                complexity.slice(1)}
                            </Text>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color="#00D4AA"
                              />
                            )}
                          </View>

                          <Text
                            style={{
                              fontSize: 14,
                              color: "#ccc",
                              marginBottom: 12,
                            }}
                          >
                            {config.description}
                          </Text>

                          {/* Features */}
                          <View style={{ marginBottom: 12 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: "#888",
                                marginBottom: 8,
                                textTransform: "uppercase",
                              }}
                            >
                              Features:
                            </Text>
                            <View style={{ gap: 4 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Ionicons
                                  name={
                                    config.features.multipleEntries
                                      ? "checkmark-circle"
                                      : "close-circle"
                                  }
                                  size={16}
                                  color={
                                    config.features.multipleEntries
                                      ? "#00D4AA"
                                      : "#888"
                                  }
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: config.features.multipleEntries
                                      ? "#fff"
                                      : "#888",
                                  }}
                                >
                                  Multiple Entries
                                </Text>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Ionicons
                                  name={
                                    config.features.multipleExits
                                      ? "checkmark-circle"
                                      : "close-circle"
                                  }
                                  size={16}
                                  color={
                                    config.features.multipleExits
                                      ? "#00D4AA"
                                      : "#888"
                                  }
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: config.features.multipleExits
                                      ? "#fff"
                                      : "#888",
                                  }}
                                >
                                  Multiple Exits
                                </Text>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Ionicons
                                  name="checkmark-circle"
                                  size={16}
                                  color="#00D4AA"
                                />
                                <Text style={{ fontSize: 13, color: "#fff" }}>
                                  Up to {config.features.maxTargets} Target
                                  {config.features.maxTargets > 1 ? "s" : ""}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Example */}
                          <View
                            style={{
                              backgroundColor: "#1a1a1a",
                              borderRadius: 8,
                              padding: 12,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: "#888",
                                marginBottom: 4,
                                textTransform: "uppercase",
                              }}
                            >
                              Example Setup:
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#fff",
                                fontFamily: "monospace",
                              }}
                            >
                              {getExampleSetup(complexity)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }
                  )}

                  {/* Info Box */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: 12,
                      backgroundColor: "rgba(0,212,170,0.1)",
                      borderRadius: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: "#00D4AA",
                      marginBottom: 20,
                    }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color="#00D4AA"
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: "#fff",
                        lineHeight: 16,
                      }}
                    >
                      You can change this setting anytime in your profile or
                      before each analysis.
                    </Text>
                  </View>
                </ScrollView>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
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
    paddingVertical: 12,
    backgroundColor: "#0a0a0a",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  backButton: {
    padding: 8,
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
