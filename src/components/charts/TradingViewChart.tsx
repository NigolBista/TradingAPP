import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  useColorScheme,
  Pressable,
  ActivityIndicator,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import LightweightCandles, { TradePlanOverlay } from "./LightweightCandles";
import {
  fetchCandles,
  fetchMarketDataCandlesWindow,
  MarketDataResolution,
  aggregateCandles,
} from "../../services/marketProviders";
import {
  runAIStrategy,
  aiOutputToTradePlan,
} from "../../logic/aiStrategyEngine";
import { useChatStore } from "../../store/chatStore";

type TradeLevels = {
  entry?: number;
  entryExtended?: number;
  exit?: number;
  exitExtended?: number;
};

type Props = {
  symbol: string; // e.g. "AAPL" or "NASDAQ:AAPL"
  height?: number;
  interval?: "1" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W" | "M";
  theme?: "light" | "dark";
  showExpand?: boolean;
  levels?: TradeLevels;
  tradePlan?: TradePlanOverlay; // optional richer levels, overrides `levels`
  enableRealtime?: boolean; // Enable real-time updates
};

export default function TradingViewChart({
  symbol,
  height = 560,
  interval = "D",
  theme,
  showExpand = true,
  levels,
  tradePlan,
  enableRealtime = false,
}: Props) {
  const scheme = useColorScheme();
  const resolvedTheme = theme || (scheme === "dark" ? "dark" : "light");
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentTradePlan, setCurrentTradePlan] = useState<
    TradePlanOverlay | undefined
  >(tradePlan);
  const { addAnalysisMessage } = useChatStore();
  const loadingHistoryRef = React.useRef(false);

  const normalizedSymbol = useMemo(
    () => (symbol.includes(":") ? symbol.split(":")[1] : symbol),
    [symbol]
  );

  // Convert TradingView interval to timeframe string for real-time updates
  const timeframe = useMemo(() => {
    switch (interval) {
      case "1":
        return "1m";
      case "5":
        return "5m";
      case "15":
        return "15m";
      case "30":
        return "30m";
      case "60":
        return "1h";
      case "120":
        return "2h";
      case "240":
        return "4h";
      case "D":
        return "1d";
      case "W":
        return "1w";
      case "M":
        return "1M";
      default:
        return "1m";
    }
  }, [interval]);

  // Determine chart type based on timeframe for Robinhood-like experience
  const chartType = useMemo(() => {
    // Use area for very short timeframes (daily and weekly), candles for intraday
    if (interval === "D" || interval === "W") {
      return "area";
    }
    return "candlestick";
  }, [interval]);

  async function handleLoadMoreData(requestedBars: number, toMs?: number) {
    if (loadingHistoryRef.current) return []; // throttle duplicate requests
    loadingHistoryRef.current = true;
    try {
      const earliestMs =
        typeof toMs === "number"
          ? toMs
          : data.length > 0
          ? Math.min(
              ...data.map((d) =>
                typeof d.time === "number" ? d.time : +new Date(d.time)
              )
            )
          : Date.now();

      // Map interval to base resolution (same logic you already use)
      let base: MarketDataResolution =
        interval === "60"
          ? "1H"
          : interval === "120"
          ? "1H"
          : interval === "240"
          ? "1H"
          : (interval as MarketDataResolution);

      // Fetch historical data using windowed fetch
      const requestedCount = Math.max(150, requestedBars || 0);
      const toMs = earliestMs;
      // Calculate fromMs based on timeframe to get sufficient data
      const timeSpanMs =
        interval === "1"
          ? requestedCount * 60 * 1000 // 1 minute
          : interval === "5"
          ? requestedCount * 5 * 60 * 1000 // 5 minutes
          : interval === "15"
          ? requestedCount * 15 * 60 * 1000 // 15 minutes
          : interval === "30"
          ? requestedCount * 30 * 60 * 1000 // 30 minutes
          : interval === "60"
          ? requestedCount * 60 * 60 * 1000 // 1 hour
          : interval === "120"
          ? requestedCount * 2 * 60 * 60 * 1000 // 2 hours
          : interval === "240"
          ? requestedCount * 4 * 60 * 60 * 1000 // 4 hours
          : interval === "D"
          ? requestedCount * 24 * 60 * 60 * 1000 // 1 day
          : interval === "W"
          ? requestedCount * 7 * 24 * 60 * 60 * 1000 // 1 week
          : requestedCount * 30 * 24 * 60 * 60 * 1000; // 1 month for monthly
      const fromMs = toMs - timeSpanMs;

      const olderCandles = await fetchMarketDataCandlesWindow(
        normalizedSymbol,
        base,
        fromMs,
        toMs,
        requestedCount
      );

      // Map provider -> our shape (epoch ms)
      const mapped = olderCandles.map((c: any) => ({
        time:
          typeof c.time === "number" && c.time < 1e12 ? c.time * 1000 : c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      // Merge into RN state (so WebView will receive appendLeft diff)
      setData((prev) => {
        const merged = [...mapped, ...prev];
        merged.sort((a, b) => a.time - b.time);
        // de-dupe by time
        const out: typeof merged = [];
        for (const it of merged) {
          if (!out.length || out[out.length - 1].time !== it.time) out.push(it);
          else out[out.length - 1] = it;
        }
        return out;
      });

      // Return LWCDatum[] (epoch ms) as the contract expects
      return mapped.map((m) => ({ ...m }));
    } catch (error) {
      console.warn("Failed to load more historical data:", error);
      return [];
    } finally {
      loadingHistoryRef.current = false;
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        // Map TradingView-style interval to our provider resolution and optional aggregation factor
        let base: MarketDataResolution =
          interval === "60"
            ? "1H"
            : interval === "120"
            ? "1H"
            : interval === "240"
            ? "1H"
            : (interval as MarketDataResolution);
        const group = interval === "120" ? 2 : interval === "240" ? 4 : 1;

        // Try configured provider; on 403 or failure, fallback to Yahoo open endpoint
        let candles: any[] = [];
        try {
          candles = await fetchCandles(normalizedSymbol, {
            resolution: base,
          });
        } catch (primaryErr) {
          console.warn(
            "Primary provider failed, retrying with Yahoo:",
            primaryErr
          );
          candles = await fetchCandles(normalizedSymbol, {
            resolution: base,
            providerOverride: "marketData",
          });
        }
        if (group > 1) {
          candles = aggregateCandles(candles, group);
        }
        if (!isMounted) return;
        setData(
          candles.map((c) => ({
            time:
              typeof c.time === "number" && c.time < 1e12
                ? c.time * 1000
                : c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }))
        );
      } catch (e) {
        console.warn("Failed to load candles", e);
        if (isMounted) setData([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol, interval]);

  useEffect(() => {
    setCurrentTradePlan(tradePlan);
  }, [tradePlan]);

  async function handleAnalyzePress() {
    try {
      setAnalyzing(true);
      const get = async (res: "D" | "1H" | "15" | "5") => {
        try {
          return await fetchCandles(normalizedSymbol, { resolution: res });
        } catch (e) {
          return await fetchCandles(normalizedSymbol, {
            resolution: res,
            providerOverride: "marketData",
          });
        }
      };
      const [d, h1, m15, m5] = await Promise.all([
        get("D"),
        get("1H"),
        get("15"),
        get("5"),
      ]);

      const output = await runAIStrategy({
        symbol: normalizedSymbol,
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
        context: {},
      });

      if (output) {
        const tp = aiOutputToTradePlan(output);
        setCurrentTradePlan(tp);
        addAnalysisMessage({
          symbol: normalizedSymbol,
          strategy: String(output.strategyChosen),
          side: output.side,
          entry: output.entry,
          lateEntry: output.lateEntry,
          exit: output.exit,
          lateExit: output.lateExit,
          stop: output.stop,
          targets: output.targets,
          riskReward: output.riskReward,
          confidence: output.confidence,
          why: output.why,
        });
      }
    } catch (error) {
      console.warn("AI analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  }

  const effectiveLevels = useMemo(() => {
    if (
      levels &&
      (levels.entry ||
        levels.exit ||
        levels.entryExtended ||
        levels.exitExtended)
    ) {
      return levels;
    }
    if (data && data.length > 0) {
      const last = data[data.length - 1];
      const close = Number(last.close) || 0;
      if (!close) return undefined;
      const delta = close * 0.01; // 1% bands default
      return {
        entry: close + delta * 0.5,
        entryExtended: close + delta * 1.0,
        exit: Math.max(0, close - delta * 0.5),
        exitExtended: Math.max(0, close - delta * 1.0),
      };
    }
    return undefined;
  }, [levels, data]);

  return (
    <View style={{ height, width: "100%", backgroundColor: "transparent" }}>
      {loading ? (
        <View
          style={{
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <LightweightCandles
          data={data}
          height={height}
          type={chartType}
          theme={resolvedTheme}
          showVolume={false}
          showMA={false}
          showGrid={true}
          showCrosshair={true}
          levels={effectiveLevels}
          tradePlan={currentTradePlan}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          enableRealtime={enableRealtime}
          onLoadMoreData={handleLoadMoreData}
        />
      )}
      <Pressable
        onPress={handleAnalyzePress}
        disabled={analyzing}
        style={{
          position: "absolute",
          right: 12,
          bottom: 20,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 20,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
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
      {showExpand && (
        <Pressable
          onPress={() =>
            navigation.navigate("ChartFullScreen", {
              symbol: normalizedSymbol,
              tradePlan: currentTradePlan,
            })
          }
          style={{
            position: "absolute",
            right: 12,
            top: 20,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 20,
            padding: 8,
          }}
          hitSlop={10}
        >
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
