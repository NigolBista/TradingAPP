import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StockSearchBar from "../../components/common/StockSearchBar";

type Props = {
  onBack: () => void;
  symbol: string;
  stockName: string;
  onToggleIndicatorsAccordion: () => void;
};

export default function ChartHeader({
  onBack,
  symbol,
  stockName,
  onToggleIndicatorsAccordion,
}: Props) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>
      <View style={styles.headerCenter}>
        <StockSearchBar
          currentSymbol={symbol}
          currentStockName={stockName || "Loading..."}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={onToggleIndicatorsAccordion}
          style={{ paddingHorizontal: 8, paddingVertical: 6, marginRight: 4 }}
          hitSlop={8}
        >
          <Ionicons name="funnel" size={20} color="#fff" />
        </Pressable>
        <View style={{ width: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  backButton: { padding: 6 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
