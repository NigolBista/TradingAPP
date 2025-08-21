import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Animated,
  Dimensions,
} from "react-native";
import {
  RouteProp,
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import LightweightCandles, {
  type LWCDatum,
} from "../components/charts/LightweightCandles";
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
  fetchNews,
} from "../services/marketProviders";
import { getUpcomingFedEvents } from "../services/federalReserve";
import {
  performComprehensiveAnalysis,
  type MarketAnalysis,
} from "../services/aiAnalytics";
import {
  fetchNews as fetchSymbolNews,
  fetchStockNewsApi,
  type NewsItem,
} from "../services/newsProviders";

import { type SignalSummary } from "../services/signalEngine";
import NewsList from "../components/insights/NewsList";
import { sendLocalNotification } from "../services/notifications";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
import { useChatStore, ChatMessage } from "../store/chatStore";
import { useSignalCacheStore, CachedSignal } from "../store/signalCacheStore";
import { runAIStrategy, aiOutputToTradePlan } from "../logic/aiStrategyEngine";

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
    marginVertical: 6,
    borderRadius: 12,
    padding: 12,
  },
  newsSection: {
    backgroundColor: "#0a0a0a",
    marginVertical: 6,
  },
  newsSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  newsSectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
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
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  signalAction: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  buyAction: { color: "#00D4AA" },
  sellAction: { color: "#FF5722" },
  signalType: {
    fontSize: 12,
    color: "#888888",
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
  horizontalSeparator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 16,
    marginVertical: 12,
  },
  unifiedControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  expandButton: {
    backgroundColor: "#1a1a1a",
    padding: 8,
    borderRadius: 8,
  },
  bottomSheetTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 4,
  },
  bottomSheetTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  bottomSheetTabActive: {
    backgroundColor: "#00D4AA",
  },
  bottomSheetTabText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomSheetTabTextActive: {
    color: "#000",
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

export default function StockDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "StockDetail">>();
  const navigation = useNavigation();
  const symbol = route.params?.symbol || "AAPL";

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [dailySeries, setDailySeries] = useState<LWCDatum[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [summary, setSummary] = useState<SignalSummary | null>(null);
  const [newsLoading, setNewsLoading] = useState<boolean>(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [stockName, setStockName] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showChartSettings, setShowChartSettings] = useState(false);
  const { pinned, defaultTimeframe, hydrate, toggle, setDefaultTimeframe } =
    useTimeframeStore();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1D");
  const [tfModalVisible, setTfModalVisible] = useState(false);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>(
    defaultTimeframe || "1D"
  );
  const { messages, addAnalysisMessage, clearSymbolMessages } = useChatStore();
  const { cacheSignal, getCachedSignal, isSignalFresh, clearSignal } =
    useSignalCacheStore();
  const [activeTab, setActiveTab] = useState<"overview" | "signals" | "news">(
    "overview"
  );
  const [signalLoading, setSignalLoading] = useState(false);
  const [cachedSignal, setCachedSignal] = useState<CachedSignal | null>(null);
  const [showTimeframeBottomSheet, setShowTimeframeBottomSheet] =
    useState(false);
  const [showChartTypeBottomSheet, setShowChartTypeBottomSheet] =
    useState(false);
  const [showUnifiedBottomSheet, setShowUnifiedBottomSheet] = useState(false);
  const [unifiedBottomSheetTab, setUnifiedBottomSheetTab] = useState<
    "timeframe" | "chartType"
  >("timeframe");
  const [bottomSheetAnim] = useState(new Animated.Value(0));

  const symbolSentimentCounts = useMemo(() => {
    if (!news || news.length === 0) return null;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const n of news) {
      const s = (n.sentiment || "").toLowerCase();
      if (s === "positive") positive++;
      else if (s === "negative") negative++;
      else neutral++;
    }
    return { positive, negative, neutral };
  }, [news]);

  // Filter signals for current symbol
  const symbolSignals = useMemo(() => {
    return messages
      .filter((msg) => msg.symbol === symbol)
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }, [messages, symbol]);

  const symbolSentimentSummary = useMemo(() => {
    if (!symbolSentimentCounts) return null;
    const total =
      symbolSentimentCounts.positive +
      symbolSentimentCounts.negative +
      symbolSentimentCounts.neutral;
    if (total === 0) return null;
    const pos = symbolSentimentCounts.positive / total;
    const neg = symbolSentimentCounts.negative / total;
    let overall: "bullish" | "bearish" | "neutral";
    let confidence: number;
    if (pos > 0.6) {
      overall = "bullish";
      confidence = Math.round(pos * 100);
    } else if (neg > 0.6) {
      overall = "bearish";
      confidence = Math.round(neg * 100);
    } else {
      overall = "neutral";
      confidence = Math.round(Math.max(pos, neg) * 100);
    }
    return { overall, confidence };
  }, [symbolSentimentCounts]);

  const showBottomSheet = (type: "timeframe" | "chartType") => {
    if (type === "timeframe") {
      setShowTimeframeBottomSheet(true);
    } else {
      setShowChartTypeBottomSheet(true);
    }
    Animated.timing(bottomSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const showUnifiedBottomSheetWithTab = (tab: "timeframe" | "chartType") => {
    setUnifiedBottomSheetTab(tab);
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
      setShowTimeframeBottomSheet(false);
      setShowChartTypeBottomSheet(false);
      setShowUnifiedBottomSheet(false);
    });
  };

  useEffect(() => {
    load();
    loadStockName();
    hydrate();
  }, [symbol]);

  // Update extendedTf when defaultTimeframe changes
  useEffect(() => {
    if (defaultTimeframe) {
      setExtendedTf(defaultTimeframe);
    }
  }, [defaultTimeframe]);

  // Refresh cached signal when screen comes into focus and periodically
  useFocusEffect(
    useCallback(() => {
      const refreshCachedSignal = () => {
        const cached = getCachedSignal(symbol);
        if (cached) {
          // Only update if the cached signal is different (newer timestamp)
          if (!cachedSignal || cached.timestamp > cachedSignal.timestamp) {
            setCachedSignal(cached);
          }
        } else {
          // If no cached signal, clear the current one
          setCachedSignal(null);
        }
      };

      // Initial refresh
      refreshCachedSignal();

      // Set up periodic refresh while screen is focused
      const interval = setInterval(refreshCachedSignal, 1000); // Check every second

      // Return cleanup function
      return () => {
        clearInterval(interval);
      };
    }, [symbol, getCachedSignal, cachedSignal])
  );

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

  // Auto-analysis function for immediate signal display
  async function performAutoAnalysis() {
    try {
      setSignalLoading(true);

      // Check if we have a fresh cached signal first
      const cached = getCachedSignal(symbol);
      if (cached && isSignalFresh(symbol)) {
        setCachedSignal(cached);
        setSignalLoading(false);
        return;
      }

      // Fetch candle data for analysis
      const get = async (res: "D" | "1H" | "15" | "5") => {
        try {
          return await fetchCandles(symbol, { resolution: res });
        } catch (e) {
          return await fetchCandles(symbol, {
            resolution: res,
            providerOverride: "yahoo",
          });
        }
      };

      const [d, h1, m15, m5] = await Promise.all([
        get("D"),
        get("1H"),
        get("15"),
        get("5"),
      ]);

      // Fetch context data for comprehensive analysis
      let newsBrief: any[] | undefined = undefined;
      let marketNewsBrief: any[] | undefined = undefined;
      let fedBrief: any[] | undefined = undefined;

      try {
        // Fetch symbol news
        const news = await fetchNews(symbol);
        newsBrief = (news || []).slice(0, 5).map((n: any) => ({
          title: n.title,
          summary: (n.summary || "").slice(0, 180),
          source: n.source,
          publishedAt: n.publishedAt,
        }));

        // Fetch market news
        const marketNews = await fetchNews("SPY"); // Use SPY as market proxy
        marketNewsBrief = (marketNews || []).slice(0, 3).map((n: any) => ({
          title: n.title,
          summary: (n.summary || "").slice(0, 120),
          source: n.source,
        }));

        // Fetch FOMC events
        const events = await getUpcomingFedEvents();
        fedBrief = (events || []).slice(0, 3).map((e: any) => ({
          title: e.title,
          date: e.date,
          impact: e.impact,
          type: e.type,
        }));
      } catch (error) {
        console.warn("Failed to fetch context data:", error);
      }

      // Run AI strategy analysis
      const output = await runAIStrategy({
        symbol,
        mode: "auto",
        candleData: {
          "1d": d.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "1h": h1.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "15m": m15.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "5m": m5.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
        },
        indicators: {},
        context: {
          userBias: "neutral",
          strategyPreference: "auto",
          userPreferences: {
            pace: "auto",
            desiredRR: 2.0,
          },
          includeFlags: {
            macro: true,
            sentiment: true,
            vix: true,
            fomc: true,
            market: true,
            fundamentals: true,
          },
          news: newsBrief,
          marketNews: marketNewsBrief,
          fedEvents: fedBrief,
          fundamentals: { level: "comprehensive" },
          analysisType: "comprehensive_auto",
        },
      });

      if (output) {
        const tradePlan = aiOutputToTradePlan(output);
        const aiMeta = {
          strategyChosen: String(output.strategyChosen),
          side: output.side,
          confidence: output.confidence,
          why: output.why || [],
          notes: output.tradePlanNotes || [],
          targets: output.targets || [],
          riskReward: output.riskReward,
        };
        const analysisContext = {
          mode: "auto",
          tradePace: "auto",
          desiredRR: 2.0,
          contextMode: "comprehensive",
          isAutoAnalysis: true,
        };

        // Cache the signal
        const cachedSignalData: CachedSignal = {
          symbol,
          timestamp: Date.now(),
          tradePlan,
          aiMeta,
          analysisContext,
          rawAnalysisOutput: output,
        };

        cacheSignal(cachedSignalData);
        setCachedSignal(cachedSignalData);
      }
    } catch (error) {
      console.error("Auto-analysis failed:", error);
    } finally {
      setSignalLoading(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      // Fetch only default timeframe first (daily) for fast initial render
      const d = await fetchCandles(symbol, { resolution: "D" });
      setDailySeries(toLWC(d));

      // Start auto-analysis immediately for signal display
      performAutoAnalysis();

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
          setNewsLoading(true);
          try {
            // Try Stock News API first for enhanced features (sentiment, images, etc.)
            let items: NewsItem[] = [];
            try {
              items = await fetchStockNewsApi(symbol, 25);
            } catch (stockNewsError) {
              console.log(
                "Stock News API failed, falling back to default provider:",
                stockNewsError
              );
              // Fallback to default news provider
              items = await fetchSymbolNews(symbol);
            }
            setNews(items);
          } catch (error) {
            console.error("All news providers failed:", error);
            setNews([]);
          } finally {
            setNewsLoading(false);
          }
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
    setDefaultTimeframe(tf); // Save as user's preferred default
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

  // Navigate to chart with signal data
  const navigateToChartWithSignal = (signal: ChatMessage) => {
    (navigation as any).navigate("ChartFullScreen", {
      symbol: signal.symbol,
      tradePlan: signal.tradePlan,
      ai: signal.aiMeta,
      analysisContext: signal.analysisContext,
    });
  };

  // Clear all signals for current symbol
  function clearAllSignals() {
    Alert.alert(
      "Clear Signals",
      `Are you sure you want to clear all signals for ${symbol}? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // Clear cached signal
            clearSignal(symbol);
            setCachedSignal(null);

            // Clear signals from chat store for this symbol
            clearSymbolMessages(symbol);
          },
        },
      ]
    );
  }

  // Analyze again function - performs new analysis and adds to chat store
  async function analyzeAgain() {
    try {
      setSignalLoading(true);

      // Fetch fresh candle data
      const get = async (res: "D" | "1H" | "15" | "5") => {
        try {
          return await fetchCandles(symbol, { resolution: res });
        } catch (e) {
          return await fetchCandles(symbol, {
            resolution: res,
            providerOverride: "yahoo",
          });
        }
      };

      const [d, h1, m15, m5] = await Promise.all([
        get("D"),
        get("1H"),
        get("15"),
        get("5"),
      ]);

      // Fetch fresh context data for comprehensive analysis
      let newsBrief: any[] | undefined = undefined;
      let marketNewsBrief: any[] | undefined = undefined;
      let fedBrief: any[] | undefined = undefined;

      try {
        // Fetch symbol news
        const news = await fetchNews(symbol);
        newsBrief = (news || []).slice(0, 5).map((n: any) => ({
          title: n.title,
          summary: (n.summary || "").slice(0, 180),
          source: n.source,
          publishedAt: n.publishedAt,
        }));

        // Fetch market news
        const marketNews = await fetchNews("SPY"); // Use SPY as market proxy
        marketNewsBrief = (marketNews || []).slice(0, 3).map((n: any) => ({
          title: n.title,
          summary: (n.summary || "").slice(0, 120),
          source: n.source,
        }));

        // Fetch FOMC events
        const events = await getUpcomingFedEvents();
        fedBrief = (events || []).slice(0, 3).map((e: any) => ({
          title: e.title,
          date: e.date,
          impact: e.impact,
          type: e.type,
        }));
      } catch (error) {
        console.warn("Failed to fetch context data:", error);
      }

      // Run fresh AI strategy analysis
      const output = await runAIStrategy({
        symbol,
        mode: "auto",
        candleData: {
          "1d": d.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "1h": h1.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "15m": m15.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          "5m": m5.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
        },
        indicators: {},
        context: {
          userBias: "neutral",
          strategyPreference: "auto",
          userPreferences: {
            pace: "auto",
            desiredRR: 2.0,
          },
          includeFlags: {
            macro: true,
            sentiment: true,
            vix: true,
            fomc: true,
            market: true,
            fundamentals: true,
          },
          news: newsBrief,
          marketNews: marketNewsBrief,
          fedEvents: fedBrief,
          fundamentals: { level: "comprehensive" },
          analysisType: "comprehensive_auto",
        },
      });

      if (output) {
        // First, move the current cached signal to history if it exists
        if (cachedSignal) {
          addAnalysisMessage({
            symbol: cachedSignal.symbol,
            strategy: cachedSignal.aiMeta?.strategyChosen,
            side: cachedSignal.aiMeta?.side,
            entry: cachedSignal.tradePlan?.entry,
            lateEntry: cachedSignal.tradePlan?.lateEntry,
            exit: cachedSignal.tradePlan?.exit,
            lateExit: cachedSignal.tradePlan?.lateExit,
            stop: cachedSignal.tradePlan?.stop,
            targets: cachedSignal.aiMeta?.targets,
            riskReward: cachedSignal.aiMeta?.riskReward,
            confidence: cachedSignal.aiMeta?.confidence,
            why: cachedSignal.aiMeta?.why,
            tradePlan: cachedSignal.tradePlan,
            aiMeta: cachedSignal.aiMeta,
            analysisContext: cachedSignal.analysisContext,
          });
        }

        // Now create the new signal
        const tradePlan = aiOutputToTradePlan(output);
        const aiMeta = {
          strategyChosen: String(output.strategyChosen),
          side: output.side,
          confidence: output.confidence,
          why: output.why || [],
          notes: output.tradePlanNotes || [],
          targets: output.targets || [],
          riskReward: output.riskReward,
        };
        const analysisContext = {
          mode: "auto",
          tradePace: "auto",
          desiredRR: 2.0,
          contextMode: "comprehensive",
          isAutoAnalysis: false, // This is a manual re-analysis
        };

        // Cache the new signal (but don't add to history yet)
        const cachedSignalData: CachedSignal = {
          symbol,
          timestamp: Date.now(),
          tradePlan,
          aiMeta,
          analysisContext,
          rawAnalysisOutput: output,
        };

        cacheSignal(cachedSignalData);
        setCachedSignal(cachedSignalData);
      }
    } catch (error) {
      console.error("Analyze again failed:", error);
      Alert.alert("Error", "Failed to analyze. Please try again.");
    } finally {
      setSignalLoading(false);
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

      <ScrollView style={{ flex: 1 }}>
        {/* Chart Section */}
        <View style={styles.chartSection}>
          {/* Chart */}
          <View style={[styles.chartContainer, { paddingHorizontal: 16 }]}>
            <LightweightCandles
              data={dailySeries}
              height={280}
              type={chartType}
              theme="dark"
              showVolume={false}
              showMA={false}
              showGrid={true}
              showCrosshair={true}
            />
          </View>

          {/* Unified Chart Controls */}
          <View style={styles.unifiedControls}>
            {/* Pinned Timeframes */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "center" }}
              style={{ flex: 1 }}
            >
              {(pinned as ExtendedTimeframe[]).map((tf) => (
                <Pressable
                  key={`pin-${tf}`}
                  onPress={() => applyExtendedTimeframe(tf)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: extendedTf === tf ? "#00D4AA" : "#1a1a1a",
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

            {/* Unified Settings Button */}
            <Pressable
              onPress={() => showUnifiedBottomSheetWithTab("timeframe")}
              style={styles.expandButton}
            >
              <Ionicons name="options" size={16} color="#fff" />
            </Pressable>

            {/* Expand Button */}
            <Pressable
              onPress={() =>
                (navigation as any).navigate("ChartFullScreen", {
                  symbol,
                  chartType,
                  timeframe: selectedTimeframe,
                  // Pass cached signal data if available
                  ...(cachedSignal && {
                    tradePlan: cachedSignal.tradePlan,
                    ai: cachedSignal.aiMeta,
                    analysisContext: cachedSignal.analysisContext,
                  }),
                })
              }
              style={styles.expandButton}
            >
              <Ionicons name="expand" size={16} color="#fff" />
            </Pressable>
          </View>

          {/* Horizontal Separator */}
          <View style={styles.horizontalSeparator} />

          {/* Tab Switcher - Moved below timeframes */}
          <View
            style={[
              styles.section,
              {
                paddingVertical: 8,
                marginBottom: 0,
                marginTop: 12,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#0f0f0f",
                borderRadius: 10,
              }}
            >
              <Pressable
                onPress={() => setActiveTab("overview")}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor:
                    activeTab === "overview" ? "#00D4AA" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: activeTab === "overview" ? "#000" : "#aaa",
                    fontWeight: "700",
                  }}
                >
                  Overview
                </Text>
              </Pressable>
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
                  backgroundColor:
                    activeTab === "news" ? "#00D4AA" : "transparent",
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
        </View>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Market Overview</Text>
            </View>

            {/* Price and Change Info */}
            <View style={{ padding: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <View>
                  <Text
                    style={{
                      color: "#E5E7EB",
                      fontSize: 24,
                      fontWeight: "700",
                    }}
                  >
                    ${currentPrice.toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      color: priceChangePercent >= 0 ? "#10B981" : "#EF4444",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {priceChangePercent >= 0 ? "+" : ""}
                    {priceChangePercent.toFixed(2)}% (
                    {priceChangePercent >= 0 ? "+" : ""}$
                    {priceChange.toFixed(2)})
                  </Text>
                </View>
                {symbolSentimentSummary && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                      Sentiment
                    </Text>
                    <Text
                      style={{
                        color:
                          symbolSentimentSummary.overall === "bullish"
                            ? "#10B981"
                            : symbolSentimentSummary.overall === "bearish"
                            ? "#EF4444"
                            : "#9CA3AF",
                        fontSize: 14,
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {symbolSentimentSummary.overall} (
                      {symbolSentimentSummary.confidence}%)
                    </Text>
                  </View>
                )}
              </View>

              {/* Analysis Summary */}
              {analysis && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      color: "#E5E7EB",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Technical Analysis
                  </Text>
                  {analysis.signals && analysis.signals.length > 0 && (
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {analysis.signals.slice(0, 3).map((signal, index) => (
                        <View
                          key={index}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                            backgroundColor:
                              signal.action === "buy"
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(239, 68, 68, 0.2)",
                            borderWidth: 1,
                            borderColor:
                              signal.action === "buy"
                                ? "rgba(16, 185, 129, 0.3)"
                                : "rgba(239, 68, 68, 0.3)",
                          }}
                        >
                          <Text
                            style={{
                              color:
                                signal.action === "buy" ? "#10B981" : "#EF4444",
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            {signal.type.toUpperCase()}{" "}
                            {signal.action.toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* News Sentiment Breakdown */}
              {symbolSentimentCounts && (
                <View>
                  <Text
                    style={{
                      color: "#E5E7EB",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    News Sentiment
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#10B981",
                          fontSize: 18,
                          fontWeight: "700",
                        }}
                      >
                        {symbolSentimentCounts.positive}
                      </Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                        Positive
                      </Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#9CA3AF",
                          fontSize: 18,
                          fontWeight: "700",
                        }}
                      >
                        {symbolSentimentCounts.neutral}
                      </Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                        Neutral
                      </Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#EF4444",
                          fontSize: 18,
                          fontWeight: "700",
                        }}
                      >
                        {symbolSentimentCounts.negative}
                      </Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                        Negative
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* AI Signals */}
        {activeTab === "signals" && (
          <View style={styles.section}>
            {/* Only show header when we have signals or are loading */}
            {(cachedSignal || symbolSignals.length > 0 || signalLoading) && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>AI Signals</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={{ color: "#666", fontSize: 12 }}>
                    {(cachedSignal ? 1 : 0) + symbolSignals.length} signals
                  </Text>
                  {/* Clear Button - show when we have any signals */}
                  {(cachedSignal || symbolSignals.length > 0) && (
                    <Pressable
                      onPress={clearAllSignals}
                      disabled={signalLoading}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: "#EF4444",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  )}
                  {/* Analyze Again Button */}
                  <Pressable
                    onPress={analyzeAgain}
                    disabled={signalLoading}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: signalLoading ? "#374151" : "#00D4AA",
                      opacity: signalLoading ? 0.6 : 1,
                    }}
                  >
                    {signalLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          color: "#000",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        Analyze Again
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Current Signal as first item in unified list */}
            {cachedSignal && !signalLoading && (
              <Pressable
                onPress={() =>
                  (navigation as any).navigate("ChartFullScreen", {
                    symbol,
                    chartType,
                    timeframe: selectedTimeframe,
                    tradePlan: cachedSignal.tradePlan,
                    ai: cachedSignal.aiMeta,
                    analysisContext: cachedSignal.analysisContext,
                  })
                }
                style={{
                  backgroundColor: "#1F2937",
                  marginBottom: 12,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(0, 212, 170, 0.3)", // Subtle green border to indicate it's most recent
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
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Signal Type Pill */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor:
                          cachedSignal.aiMeta?.side === "long"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        borderWidth: 1,
                        borderColor:
                          cachedSignal.aiMeta?.side === "long"
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(239, 68, 68, 0.3)",
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            cachedSignal.aiMeta?.side === "long"
                              ? "#10B981"
                              : "#EF4444",
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {cachedSignal.aiMeta?.side === "long" ? "BUY" : "SHORT"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: "#E5E7EB",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {cachedSignal.aiMeta?.strategyChosen || "AI Strategy"}
                    </Text>
                  </View>
                  <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                    {new Date().toLocaleDateString()}
                  </Text>
                </View>

                {/* Entry/Exit/Stop Info */}
                {cachedSignal.tradePlan && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: "#D1D5DB", fontSize: 12 }}>
                      {cachedSignal.tradePlan.entry &&
                        `Entry: $${cachedSignal.tradePlan.entry.toFixed(2)}  `}
                      {cachedSignal.tradePlan.stop &&
                        `Stop: $${cachedSignal.tradePlan.stop.toFixed(2)}  `}
                      {cachedSignal.aiMeta?.targets &&
                        cachedSignal.aiMeta.targets.length > 0 &&
                        `Target: $${cachedSignal.aiMeta.targets[0].toFixed(2)}`}
                    </Text>
                  </View>
                )}

                {/* Confidence and Risk/Reward */}
                {(cachedSignal.aiMeta?.confidence ||
                  cachedSignal.aiMeta?.riskReward) && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                      {cachedSignal.aiMeta.confidence &&
                        `Confidence: ${Math.round(
                          cachedSignal.aiMeta.confidence
                        )}%  `}
                      {cachedSignal.aiMeta.riskReward &&
                        `R/R: ${cachedSignal.aiMeta.riskReward.toFixed(2)}`}
                    </Text>
                  </View>
                )}

                <View style={{ marginTop: 8, alignItems: "flex-end" }}>
                  <Text style={{ color: "#6B7280", fontSize: 10 }}>
                    Tap to view on chart
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Show loading state when analyzing and no cached signal */}
            {signalLoading && !cachedSignal && (
              <View
                style={{
                  backgroundColor: "#1F2937",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="small" color="#00D4AA" />
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 8 }}>
                  Analyzing {symbol}...
                </Text>
              </View>
            )}

            {/* Show empty state when no signals and not loading */}
            {!signalLoading && !cachedSignal && symbolSignals.length === 0 ? (
              <View style={{ alignItems: "center", marginTop: 40 }}>
                <Text
                  style={{ color: "#888", textAlign: "center", fontSize: 14 }}
                >
                  No AI signals found for {symbol}
                </Text>
                <Text
                  style={{
                    color: "#666",
                    textAlign: "center",
                    fontSize: 12,
                    marginTop: 8,
                    marginBottom: 20,
                  }}
                >
                  Generate your first signal to get started
                </Text>
                {/* Analyze Again Button for empty state */}
                <Pressable
                  onPress={analyzeAgain}
                  disabled={signalLoading}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: "#00D4AA",
                  }}
                >
                  <Text
                    style={{
                      color: "#000",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    Analyze {symbol}
                  </Text>
                </Pressable>
              </View>
            ) : (
              symbolSignals.map((signal) => (
                <Pressable
                  key={signal.id}
                  onPress={() => navigateToChartWithSignal(signal)}
                  style={{
                    backgroundColor: "#1F2937",
                    marginBottom: 12,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
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
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {/* Signal Type Pill */}
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                          backgroundColor:
                            signal.side === "long"
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
                          borderWidth: 1,
                          borderColor:
                            signal.side === "long"
                              ? "rgba(16, 185, 129, 0.3)"
                              : "rgba(239, 68, 68, 0.3)",
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              signal.side === "long" ? "#10B981" : "#EF4444",
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {signal.side === "long" ? "BUY" : "SHORT"}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: "#E5E7EB",
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                      >
                        {signal.strategy || "AI Strategy"}
                      </Text>
                    </View>
                    <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                      {new Date(signal.timestamp).toLocaleDateString()}
                    </Text>
                  </View>

                  {/* Entry/Exit/Stop Info */}
                  {(signal.entry ||
                    signal.stop ||
                    (signal.targets && signal.targets.length > 0)) && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: "#D1D5DB", fontSize: 12 }}>
                        {signal.entry && `Entry: $${signal.entry.toFixed(2)}  `}
                        {signal.stop && `Stop: $${signal.stop.toFixed(2)}  `}
                        {signal.targets &&
                          signal.targets.length > 0 &&
                          `Target: $${signal.targets[0].toFixed(2)}`}
                      </Text>
                    </View>
                  )}

                  {/* Confidence and Risk/Reward */}
                  {(signal.confidence || signal.riskReward) && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                        {signal.confidence &&
                          `Confidence: ${Math.round(signal.confidence)}%  `}
                        {signal.riskReward &&
                          `R/R: ${signal.riskReward.toFixed(2)}`}
                      </Text>
                    </View>
                  )}

                  <View style={{ marginTop: 8, alignItems: "flex-end" }}>
                    <Text style={{ color: "#6B7280", fontSize: 10 }}>
                      Tap to view on chart
                    </Text>
                  </View>
                </Pressable>
              ))
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
          <View style={styles.newsSection}>
            <NewsList items={news.slice(0, 20)} fullScreen={true} />
          </View>
        )}
        {activeTab === "news" && news.length === 0 && (
          <View style={styles.newsSection}>
            <View style={styles.newsSectionHeader}>
              <Text style={styles.newsSectionTitle}>Latest News</Text>
            </View>
            <Text
              style={{
                color: "#888",
                textAlign: "center",
                paddingHorizontal: 16,
              }}
            >
              No recent news found for {symbol}. Pull to refresh or try again
              shortly.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Unified Bottom Sheet */}
      {(showTimeframeBottomSheet ||
        showChartTypeBottomSheet ||
        showUnifiedBottomSheet) && (
        <Modal
          visible={
            showTimeframeBottomSheet ||
            showChartTypeBottomSheet ||
            showUnifiedBottomSheet
          }
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

                {/* Content */}
                {showTimeframeBottomSheet && (
                  <View>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: "#fff",
                        textAlign: "center",
                        marginBottom: 20,
                      }}
                    >
                      Select Timeframe
                    </Text>
                    <ScrollView
                      style={{ maxHeight: 300 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {[
                        "1m",
                        "5m",
                        "15m",
                        "30m",
                        "1h",
                        "2h",
                        "4h",
                        "6h",
                        "12h",
                        "1D",
                        "1W",
                        "1M",
                        "3M",
                        "6M",
                        "1Y",
                        "ALL",
                      ].map((tf) => (
                        <Pressable
                          key={tf}
                          onPress={() => {
                            applyExtendedTimeframe(tf as ExtendedTimeframe);
                            hideBottomSheet();
                          }}
                          style={{
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                            borderBottomWidth: 1,
                            borderBottomColor: "#333",
                            backgroundColor:
                              extendedTf === tf ? "#00D4AA20" : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              color: extendedTf === tf ? "#00D4AA" : "#fff",
                              fontSize: 16,
                              fontWeight: extendedTf === tf ? "600" : "400",
                            }}
                          >
                            {tf}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {showChartTypeBottomSheet && (
                  <View>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: "#fff",
                        textAlign: "center",
                        marginBottom: 20,
                      }}
                    >
                      Chart Type
                    </Text>
                    <View style={{ paddingHorizontal: 20 }}>
                      {[
                        {
                          type: "line" as ChartType,
                          label: "Line",
                          icon: "trending-up",
                        },
                        {
                          type: "candlestick" as ChartType,
                          label: "Candlestick",
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
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            marginBottom: 8,
                            backgroundColor:
                              chartType === item.type ? "#00D4AA20" : "#2a2a2a",
                          }}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={24}
                            color={chartType === item.type ? "#00D4AA" : "#fff"}
                            style={{ marginRight: 16 }}
                          />
                          <Text
                            style={{
                              color:
                                chartType === item.type ? "#00D4AA" : "#fff",
                              fontSize: 16,
                              fontWeight:
                                chartType === item.type ? "600" : "400",
                              flex: 1,
                            }}
                          >
                            {item.label}
                          </Text>
                          {chartType === item.type && (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color="#00D4AA"
                            />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {showUnifiedBottomSheet && (
                  <ScrollView
                    style={{ maxHeight: 600 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Chart Type Row */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                      <Text style={styles.timeframeSectionTitle}>
                        Chart Type
                      </Text>
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
                        <Text style={styles.timeframeSectionTitle}>
                          Minutes
                        </Text>
                        <View style={styles.timeframeGrid}>
                          {[
                            "1m",
                            "2m",
                            "3m",
                            "4m",
                            "5m",
                            "10m",
                            "15m",
                            "30m",
                            "45m",
                          ].map((tf) => {
                            const isSelected = extendedTf === tf;
                            const isPinned = pinned.includes(
                              tf as ExtendedTimeframe
                            );
                            return (
                              <Pressable
                                key={tf}
                                onPress={() => {
                                  applyExtendedTimeframe(
                                    tf as ExtendedTimeframe
                                  );
                                  hideBottomSheet();
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
                          })}
                        </View>
                      </View>

                      {/* Hours */}
                      <View style={{ marginBottom: 24 }}>
                        <Text style={styles.timeframeSectionTitle}>Hours</Text>
                        <View style={styles.timeframeGrid}>
                          {["1h", "2h", "4h", "6h", "8h", "12h"].map((tf) => {
                            const isSelected = extendedTf === tf;
                            const isPinned = pinned.includes(
                              tf as ExtendedTimeframe
                            );
                            return (
                              <Pressable
                                key={tf}
                                onPress={() => {
                                  applyExtendedTimeframe(
                                    tf as ExtendedTimeframe
                                  );
                                  hideBottomSheet();
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
                          })}
                        </View>
                      </View>

                      {/* Days */}
                      <View style={{ marginBottom: 24 }}>
                        <Text style={styles.timeframeSectionTitle}>Days</Text>
                        <View style={styles.timeframeGrid}>
                          {[
                            "1D",
                            "1W",
                            "1M",
                            "3M",
                            "6M",
                            "1Y",
                            "2Y",
                            "5Y",
                            "ALL",
                          ].map((tf) => {
                            const isSelected = extendedTf === tf;
                            const isPinned = pinned.includes(
                              tf as ExtendedTimeframe
                            );
                            return (
                              <Pressable
                                key={tf}
                                onPress={() => {
                                  applyExtendedTimeframe(
                                    tf as ExtendedTimeframe
                                  );
                                  hideBottomSheet();
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
                          })}
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                )}
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

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
