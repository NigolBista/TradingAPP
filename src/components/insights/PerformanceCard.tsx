import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import type { PortfolioHistory } from "../../services/portfolioAggregationService";
import { fetchYahooCandles } from "../../services/marketProviders";
import SimpleLineChart from "../charts/SimpleLineChart";

type Period = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

interface Props {
  history: PortfolioHistory | null;
  totalNetWorth: number;
  netWorthChange: number;
  netWorthChangePercent: number;
  selected: Period;
  onChange: (p: Period) => void;
}

export default function PerformanceCard({
  history,
  totalNetWorth,
  netWorthChange,
  netWorthChangePercent,
  selected,
  onChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  // Sanitize numeric values
  const safeNetWorth = Number.isFinite(totalNetWorth) ? totalNetWorth : 0;
  const safeNetWorthChange = Number.isFinite(netWorthChange)
    ? netWorthChange
    : 0;
  const safeNetWorthChangePercent = Number.isFinite(netWorthChangePercent)
    ? netWorthChangePercent
    : 0;

  // Format net worth for display
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Chart series from history
  const chartSeries = useMemo(() => {
    if (!history || history.data.length === 0)
      return [] as { time: number; close: number }[];
    return history.data
      .map((p) => ({
        time: new Date(p.date).getTime(),
        close: Number.isFinite(p.totalValue) ? p.totalValue : 0,
      }))
      .filter(
        (point) => Number.isFinite(point.time) && Number.isFinite(point.close)
      );
  }, [history]);

  const periods: Period[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Total Net Worth</Text>
        <Text style={styles.netWorth}>{formatCurrency(safeNetWorth)}</Text>
        <View style={styles.changeRow}>
          <Text
            style={[
              styles.change,
              safeNetWorthChangePercent >= 0 ? styles.up : styles.down,
            ]}
          >
            {safeNetWorthChangePercent >= 0 ? "▲" : "▼"}{" "}
            {formatCurrency(Math.abs(safeNetWorthChange))} (
            {Math.abs(safeNetWorthChangePercent).toFixed(2)}%)
          </Text>
          <Text style={styles.period}>Today</Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <SimpleLineChart
          data={chartSeries}
          height={120}
          color="#60a5fa"
          strokeWidth={2}
          showFill={false}
        />
      </View>

      <View style={styles.tabs}>
        {periods.map((p) => (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            style={[styles.tab, selected === p && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, selected === p && styles.tabTextActive]}
            >
              {p}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16 },
  header: { alignItems: "center" },
  title: { color: "#9ca3af", fontSize: 14, fontWeight: "600" },
  netWorth: { color: "#ffffff", fontSize: 32, fontWeight: "700", marginTop: 4 },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  change: { fontSize: 14, fontWeight: "600" },
  period: { color: "#6b7280", fontSize: 12 },
  up: { color: "#10B981" },
  down: { color: "#EF4444" },
  tabs: { flexDirection: "row", gap: 8, marginTop: 12 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { color: "#9ca3af", fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#fff" },
});
