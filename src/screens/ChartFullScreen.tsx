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
import { fetchCandlesForTimeframe } from "../services/marketProviders";

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const symbol: string = route.params?.symbol || "AAPL";
  const [chartType, setChartType] = useState<ChartType>(
    (route.params?.chartType as ChartType) || "candlestick"
  );
  const timeframe: string = route.params?.timeframe || "1D";
  const levels = route.params?.levels;
  const [tfModalVisible, setTfModalVisible] = useState(false);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>("1D");
  const [stockName, setStockName] = useState<string>("");
  const { pinned, hydrate } = useTimeframeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<LWCDatum[]>([]);
  const [showChartSettings, setShowChartSettings] = useState<boolean>(false);

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
          />
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
