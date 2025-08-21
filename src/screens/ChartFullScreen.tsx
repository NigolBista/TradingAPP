import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Text,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LightweightCandles, {
  type LWCDatum,
  TradePlanOverlay,
} from "../components/charts/LightweightCandles";
import ChartSettingsModal, {
  type ChartType,
} from "../components/charts/ChartSettingsModal";
import TimeframePickerModal, {
  ExtendedTimeframe,
} from "../components/charts/TimeframePickerModal";
import StockSearchBar from "../components/common/StockSearchBar";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";
import {
  fetchCandlesForTimeframe,
  fetchCandles,
} from "../services/marketProviders";
import { runAIStrategy, aiOutputToTradePlan } from "../logic/aiStrategyEngine";
import { useChatStore } from "../store/chatStore";

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const symbol: string = route.params?.symbol || "AAPL";
  const { addAnalysisMessage } = useChatStore();
  const [chartType, setChartType] = useState<ChartType>(
    (route.params?.chartType as ChartType) || "candlestick"
  );
  const timeframe: string = route.params?.timeframe || "1D";
  const levels = route.params?.levels;
  const initialTradePlan: TradePlanOverlay | undefined =
    route.params?.tradePlan;
  const initialAiMeta:
    | undefined
    | {
        strategyChosen?: string;
        confidence?: number;
        why?: string[];
        notes?: string[];
        targets?: number[];
        riskReward?: number;
      } = route.params?.ai;
  const [tfModalVisible, setTfModalVisible] = useState(false);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>("1D");
  const [stockName, setStockName] = useState<string>("");
  const { pinned, hydrate } = useTimeframeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<LWCDatum[]>([]);
  const [showChartSettings, setShowChartSettings] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [currentTradePlan, setCurrentTradePlan] = useState<
    TradePlanOverlay | undefined
  >(initialTradePlan);
  const [aiMeta, setAiMeta] = useState<
    | undefined
    | {
        strategyChosen?: string;
        confidence?: number;
        why?: string[];
        notes?: string[];
        targets?: number[];
        riskReward?: number;
      }
  >(initialAiMeta);

  const chartHeight = Math.max(0, height - insets.top - insets.bottom - 60); // Account for header

  useEffect(() => {
    loadStockName();
    hydrate();
  }, [symbol]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const candles = await fetchCandlesForTimeframe(symbol, extendedTf);
        if (!isMounted) return;
        setData(
          candles.map((c: any) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }))
        );
      } catch (e) {
        console.warn("Failed to load candles:", e);
        if (isMounted) setData([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [symbol, extendedTf]);

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

  async function handleAnalyzePress() {
    try {
      setAnalyzing(true);
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
        context: {},
      });

      if (output) {
        const tp = aiOutputToTradePlan(output);
        setCurrentTradePlan(tp);
        setAiMeta({
          strategyChosen: String(output.strategyChosen),
          confidence: output.confidence,
          why: output.why || [],
          notes: output.tradePlanNotes || [],
          targets: output.targets || [],
          riskReward: output.riskReward,
        });
        addAnalysisMessage({
          symbol,
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
        {loading ? (
          <View
            style={{
              height: chartHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#888" }}>Loading...</Text>
          </View>
        ) : (
          <LightweightCandles
            data={data}
            height={chartHeight}
            type={chartType}
            theme={scheme === "dark" ? "dark" : "light"}
            showVolume={false}
            showMA={false}
            showGrid={true}
            showCrosshair={true}
            levels={effectiveLevels}
            tradePlan={currentTradePlan}
          />
        )}
        <Pressable
          onPress={handleAnalyzePress}
          disabled={analyzing}
          style={{
            position: "absolute",
            right: 16,
            top: 16,
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
        {aiMeta && (
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
              <Text style={{ color: "#E5E7EB", fontWeight: "700" }}>
                AI Reasoning
              </Text>
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
            </View>
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
              {aiMeta.strategyChosen || "-"} ·{" "}
              {Math.round(aiMeta.confidence || 0)}% confidence
            </Text>
            {!!(aiMeta.why && aiMeta.why.length) && (
              <View style={{ marginTop: 8 }}>
                {aiMeta.why.slice(0, 5).map((w, i) => (
                  <Text key={i} style={{ color: "#D1D5DB", fontSize: 12 }}>
                    • {w}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
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
                onPress={() => setExtendedTf(tf)}
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
            <Pressable
              onPress={() => setTfModalVisible(true)}
              style={[styles.tfChip, styles.tfMoreChip]}
              hitSlop={10}
            >
              <Text style={[styles.tfChipText, styles.tfMoreText]}>⋯</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowChartSettings(true)}
              style={[styles.tfChip, styles.tfMoreChip]}
              hitSlop={10}
            >
              <Ionicons name="options" size={16} color="#fff" />
            </Pressable>
          </ScrollView>
        </View>
        {/* Removed left quick row to avoid duplicate controls; modal picker handles timeframe switching */}
      </View>

      <TimeframePickerModal
        visible={tfModalVisible}
        onClose={() => setTfModalVisible(false)}
        selected={extendedTf}
        onSelect={(tf) => setExtendedTf(tf)}
      />
      <ChartSettingsModal
        visible={showChartSettings}
        onClose={() => setShowChartSettings(false)}
        currentChartType={chartType}
        onChartTypeChange={setChartType}
      />
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
});
