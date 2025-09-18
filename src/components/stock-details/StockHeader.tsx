import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface StockHeaderProps {
  symbol: string;
  stockName?: string;
  onBackPress: () => void;
  onAlertPress: () => void;
  onAddPress?: () => void;
  testID?: string;
}

export const StockHeader = React.memo(function StockHeader({
  symbol,
  stockName,
  onBackPress,
  onAlertPress,
  onAddPress,
  testID,
}: StockHeaderProps) {
  return (
    <View style={styles.headerRow} testID={testID}>
      <View style={styles.headerLeft}>
        <Pressable onPress={onBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.stockInfo}>
          <Text style={styles.tickerSymbol}>{symbol}</Text>
          <Text style={styles.stockName}>{stockName || "Loading..."}</Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <Pressable onPress={onAlertPress} style={styles.headerIconButton}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
        </Pressable>
        <Pressable
          onPress={onAddPress}
          style={styles.headerIconButton}
          disabled={!onAddPress}
        >
          <Ionicons name="add-outline" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
});

export default StockHeader;
