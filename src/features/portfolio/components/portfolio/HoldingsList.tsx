import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import type { AggregatedPosition } from "../../../../shared/services/portfolioAggregationService";

interface Props {
  positions: AggregatedPosition[];
  limit?: number;
  scrollEnabled?: boolean;
}

export default function HoldingsList({
  positions = [],
  limit = 100,
  scrollEnabled = true,
}: Props) {
  const items = useMemo(() => {
    const sorted = [...positions].sort((a: any, b: any) => {
      const aValue = (a.totalMarketValue ?? a.marketValue ?? 0) as number;
      const bValue = (b.totalMarketValue ?? b.marketValue ?? 0) as number;
      return bValue - aValue;
    });
    return sorted.slice(0, limit);
  }, [positions, limit]);

  const formatCurrency = (value: number | undefined | null) => {
    if (!value || !Number.isFinite(value)) return "$0.00";
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const renderItem = ({ item }: { item: AggregatedPosition | any }) => {
    const quantity = (item.totalQuantity ?? item.quantity ?? 0) as number;
    const averagePrice = (item.averagePrice ?? item.averageCost ?? 0) as number;
    const marketValue = (item.totalMarketValue ??
      item.marketValue ??
      0) as number;
    const isUp = ((item.unrealizedPnL ?? 0) as number) >= 0;
    const providersList: string[] = Array.isArray(item?.providers)
      ? (item.providers as any[]).map((p) => p.provider)
      : item?.provider
      ? [item.provider]
      : [];
    return (
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.sub}>
            {quantity.toFixed(2)} shares • Avg {formatCurrency(averagePrice)}
          </Text>
          <Text style={styles.providers}>{providersList.join(" · ")}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.value}>{formatCurrency(marketValue)}</Text>
          <Text style={[styles.pnl, isUp ? styles.up : styles.down]}>
            {isUp ? "▲" : "▼"}{" "}
            {formatCurrency(Math.abs(item.unrealizedPnL || 0))} (
            {Math.abs(item.unrealizedPnLPercent || 0).toFixed(2)}%)
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
      keyExtractor={(item, index) => `${item.symbol || "unknown"}-${index}`}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      scrollEnabled={scrollEnabled}
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
