import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import type { PortfolioHistory } from "../../../../shared/services/portfolioAggregationService";
import { COLORS } from "../../../../shared/constants/colors";
import { useTheme } from "../../../providers/ThemeProvider";
import SimpleKLineChart from "../charts/SimpleKLineChart";

type Period = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

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
  const { theme } = useTheme();
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

  // Ensure ascending order by time
  const sortedSeries = useMemo(() => {
    const s = [...chartSeries].sort((a, b) => a.time - b.time);
    return s;
  }, [chartSeries]);

  useEffect(() => {
    if (!history) {
      console.log("[PerformanceCard] No history available");
      return;
    }
    const count = sortedSeries.length;
    const first = count > 0 ? sortedSeries[0] : null;
    const last = count > 0 ? sortedSeries[count - 1] : null;
    console.log("[PerformanceCard] Net worth series", {
      count,
      first,
      last,
      period: selected,
    });
  }, [sortedSeries, selected, history]);

  const periods: Period[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];
  const styles = createStyles(theme);

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

      <View style={styles.chartContainer}>
        <SimpleKLineChart
          symbol={"NETWORTH"}
          timeframe={selected}
          height={120}
          theme={theme.mode === "dark" ? "dark" : "light"}
          chartType={"area"}
          showVolume={false}
          showMA={false}
          showTopInfo={false}
          showGrid={false}
          showPriceAxisLine={false}
          showTimeAxisLine={false}
          showPriceAxisText={false}
          showTimeAxisText={false}
          showLastPriceLabel={false}
          customBars={sortedSeries.map((d) => ({
            timestamp: d.time,
            open: d.close,
            high: d.close,
            low: d.close,
            close: d.close,
            volume: 0,
            turnover: 0,
          }))}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: "transparent",
      borderRadius: 0,
      padding: 0,
      minHeight: 220,
    },
    header: { alignItems: "flex-start" },
    title: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    netWorth: {
      color: theme.colors.text,
      fontSize: 32,
      fontWeight: "700",
      marginTop: 4,
    },
    changeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    change: { fontSize: 14, fontWeight: "600" },
    period: { color: theme.colors.textSecondary, fontSize: 12 },
    up: { color: "#10B981" },
    down: { color: "#EF4444" },
    chartContainer: {
      marginTop: 12,
      height: 120,
      overflow: "hidden",
    },
    tabs: { flexDirection: "row", gap: 4, marginTop: 16 },
    tab: {
      flex: 1,
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    tabActive: { backgroundColor: theme.colors.primary },
    tabText: {
      color: theme.colors.textSecondary,
      fontWeight: "600",
      fontSize: 11,
      textAlign: "center",
    },
    tabTextActive: { color: "#fff", fontWeight: "700" },
  });
