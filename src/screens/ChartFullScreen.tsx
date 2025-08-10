import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TradingViewChart from "../components/charts/TradingViewChart";
import AdvancedTradingChart from "../components/charts/AdvancedTradingChart";

export default function ChartFullScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const symbol: string = route.params?.symbol || "AAPL";
  const chartType: string = route.params?.chartType || "line";
  const timeframe: string = route.params?.timeframe || "1D";

  const chartHeight = Math.max(0, height - insets.top - insets.bottom - 60); // Account for header

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
        <Text style={styles.headerTitle}>
          {symbol} • {timeframe}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Chart */}
      <View style={{ flex: 1 }}>
        <TradingViewChart symbol={symbol} height={chartHeight} />
      </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
});
