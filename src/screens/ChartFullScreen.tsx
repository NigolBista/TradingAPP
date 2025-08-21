import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Text,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TradingViewChart from "../components/charts/TradingViewChart";
import TimeframePickerModal, {
  ExtendedTimeframe,
} from "../components/charts/TimeframePickerModal";
import AdvancedTradingChart from "../components/charts/AdvancedTradingChart";
import StockSearchBar from "../components/common/StockSearchBar";
import { searchStocksAutocomplete } from "../services/stockData";
import { useTimeframeStore } from "../store/timeframeStore";

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const symbol: string = route.params?.symbol || "AAPL";
  const chartType: string = route.params?.chartType || "line";
  const timeframe: string = route.params?.timeframe || "1D";
  const levels = route.params?.levels;
  const [tfModalVisible, setTfModalVisible] = useState(false);
  const [extendedTf, setExtendedTf] = useState<ExtendedTimeframe>("1D");
  const [stockName, setStockName] = useState<string>("");
  const { pinned, hydrate } = useTimeframeStore();

  const chartHeight = Math.max(0, height - insets.top - insets.bottom - 60); // Account for header

  useEffect(() => {
    loadStockName();
    hydrate();
  }, [symbol]);

  function mapExtendedToTradingView(
    tf: ExtendedTimeframe
  ): "1" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W" | "M" {
    switch (tf) {
      case "1m":
        return "1";
      case "2m":
      case "3m":
      case "4m":
        return "1"; // Nearest supported
      case "5m":
      case "10m":
        return "5";
      case "15m":
        return "15";
      case "30m":
      case "45m":
        return "30";
      case "1h":
        return "60";
      case "2h":
        return "120";
      case "4h":
        return "240";
      case "1D":
        return "D";
      case "1W":
        return "W";
      case "1M":
      case "3M":
      case "6M":
        return "M";
      case "1Y":
      case "2Y":
      case "5Y":
      case "ALL":
        return "W";
      default:
        return "D";
    }
  }

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
        <TradingViewChart
          symbol={symbol}
          height={chartHeight}
          interval={mapExtendedToTradingView(extendedTf)}
          showExpand={false}
          levels={levels}
        />
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
