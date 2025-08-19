import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import type { AggregatedPosition } from "../../services/portfolioAggregationService";

interface Props {
  positions: AggregatedPosition[];
  limit?: number;
}

export default function HoldingsList({ positions, limit = 100 }: Props) {
  const items = useMemo(() => {
    const sorted = [...positions].sort(
      (a, b) => b.totalMarketValue - a.totalMarketValue
    );
    return sorted.slice(0, limit);
  }, [positions, limit]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const renderItem = ({ item }: { item: AggregatedPosition }) => {
    const isUp = item.unrealizedPnL >= 0;
    return (
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.sub}>
            {item.totalQuantity.toFixed(2)} shares • Avg{" "}
            {formatCurrency(item.averagePrice)}
          </Text>
          <Text style={styles.providers}>
            {item.providers.map((p) => p.provider).join(" · ")}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.value}>
            {formatCurrency(item.totalMarketValue)}
          </Text>
          <Text style={[styles.pnl, isUp ? styles.up : styles.down]}>
            {isUp ? "▲" : "▼"} {formatCurrency(Math.abs(item.unrealizedPnL))} (
            {Math.abs(item.unrealizedPnLPercent).toFixed(2)}%)
          </Text>
        </View>
      </View>
    );
  };

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No holdings to display</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.symbol}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  left: { flex: 1, paddingRight: 12 },
  right: { alignItems: "flex-end" },
  symbol: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  sub: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  providers: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  value: { color: "#ffffff", fontWeight: "700" },
  pnl: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  up: { color: "#10B981" },
  down: { color: "#EF4444" },
  sep: { height: 1, backgroundColor: "#2a2a2a" },
  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: "#9ca3af" },
});
