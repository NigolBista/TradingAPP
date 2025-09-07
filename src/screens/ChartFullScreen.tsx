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
} from "./ChartFullScreen/indicators";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
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
import { fetchSingleQuote, type SimpleQuote } from "../services/quotes";
import { getUpcomingFedEvents } from "../services/federalReserve";
import {
  fetchCandles,
  fetchCandlesForTimeframe,
  type Candle,
} from "../services/marketProviders";
import { timeframeSpacingMs } from "./ChartFullScreen/utils";

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
  const [showSessions, setShowSessions] = useState<boolean>(true);
  const [indicatorsExpanded, setIndicatorsExpanded] = useState<boolean>(false);

  // Indicators state
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const latestIndicatorsRef = useRef<IndicatorConfig[]>([]);
  const styleRetryRef = useRef<NodeJS.Timeout | null>(null);
  const [showIndicatorsSheet, setShowIndicatorsSheet] = useState(false);
  const [showIndicatorsAccordion, setShowIndicatorsAccordion] = useState(false);

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
  >((initialAnalysisContext?.tradePace as any) || "auto");
  const [desiredRR, setDesiredRR] = useState<number>(
    initialAnalysisContext?.desiredRR || 1.5
  );
  const [contextMode, setContextMode] = useState<
    "price_action" | "news_sentiment"
  >((initialAnalysisContext?.contextMode as any) || "price_action");
  const [tradeMode, setTradeMode] = useState<"day" | "swing">("day");
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
    useState<StrategyComplexity>(profile.strategyComplexity || "advanced");
  const [showReasoningBottomSheet, setShowReasoningBottomSheet] =
    useState<boolean>(false);

  // Refs
  const [pinError, setPinError] = useState<string | null>(null);
  const barSpacingRef = React.useRef<number>(60_000);
  const overrideIndicatorRef = React.useRef<
    | ((
        id: string | { name: string; paneId?: string },
        styles: any,
        calcParams?: any
      ) => void)
    | null
  >(null);

  // Layout calculations
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

  // Initialize bar spacing from initial data
  React.useEffect(() => {
    if (initialDataParam && initialDataParam.length >= 2) {
      const last = initialDataParam[initialDataParam.length - 1];
      const prev = initialDataParam[initialDataParam.length - 2];
      barSpacingRef.current = Math.max(1, last.time - prev.time);
    } else {
      barSpacingRef.current = timeframeSpacingMs(extendedTf);
    }
  }, [extendedTf]);

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
        onToggleSessions={() => setShowSessions((s) => !s)}
        showSessions={showSessions}
      />

      {showIndicatorsAccordion && (
        <IndicatorsAccordion
          indicators={indicators}
          onOpenConfig={(name) => openIndicatorConfig(name)}
          onToggleIndicator={(name) => toggleIndicator(name)}
          onOpenAddSheet={openIndicatorsSheet}
        />
      )}

      {/* OHLCV Row */}
      <OHLCRow lastCandle={lastCandle} />

      {/* Chart */}
      <View style={{ marginBottom: 8 }}>
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
          showSessions={showSessions}
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
                    3
                  ) as number[],
                }
              : undefined
          }
        />
      </View>

      {/* Timeframe Chips */}
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

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          {/* Reasoning */}
          <Pressable
            onPress={() => {
              if (!aiMeta && !isStreaming && !streamingText) return;
              setShowReasoningBottomSheet(true);
            }}
            disabled={!aiMeta && !isStreaming && !streamingText}
            style={[
              styles.bottomNavButton,
              { opacity: !aiMeta && !isStreaming && !streamingText ? 0.6 : 1 },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="bulb"
              size={16}
              color="rgba(255,255,255,0.9)"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.bottomNavButtonText}>Reasoning</Text>
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

          {/* Strategy Complexity */}
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
              {selectedComplexity.charAt(0).toUpperCase() +
                selectedComplexity.slice(1)}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate("ChartChat", { symbol })}
        style={{
          position: "absolute",
          bottom: bottomNavHeight + 20,
          right: 20,
          backgroundColor: "#2563EB",
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
        hitSlop={8}
      >
        <Ionicons name="chatbubbles" size={22} color="#fff" />
      </Pressable>

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
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 110,
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
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    minWidth: 140,
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
