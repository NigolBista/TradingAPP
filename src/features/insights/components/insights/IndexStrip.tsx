import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { fetchYahooCandles } from "../../../shared/services/marketProviders";

type IndexInfo = {
  symbol: string;
  label: string;
  changePct: number;
};

interface Props {
  tickers?: { symbol: string; label: string }[];
}

export default function IndexStrip({
  tickers = [
    { symbol: "SPY", label: "S&P" },
    { symbol: "QQQ", label: "Nasdaq" },
    { symbol: "DIA", label: "Dow" },
    { symbol: "IWM", label: "Russell" },
    { symbol: "^VIX", label: "VIX" },
  ],
}: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IndexInfo[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const results = await Promise.all(
          tickers.map(async (t) => {
            const candles = await fetchYahooCandles(t.symbol, "5d", "1d");
            const n = candles.length;
            const prev = candles[n - 2]?.close ?? candles[n - 1]?.close ?? 0;
            const last = candles[n - 1]?.close ?? 0;
            const changePct = prev ? ((last - prev) / prev) * 100 : 0;
            return { symbol: t.symbol, label: t.label, changePct } as IndexInfo;
          })
        );
        if (mounted) setData(results);
      } catch {
        if (mounted) setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [tickers.map((t) => t.symbol).join("|")]);

  if (loading && data.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#00D4AA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {data.map((d, idx) => {
        const isUp = d.changePct >= 0;
        const isVix = d.symbol.includes("VIX");
        const color = isVix
          ? isUp
            ? "#EF4444"
            : "#10B981"
          : isUp
          ? "#10B981"
          : "#EF4444";
        return (
          <View key={idx} style={[styles.chip, { borderColor: color }]}>
            <Text style={styles.chipLabel}>{d.label}</Text>
            <Text style={[styles.chipValue, { color }]}>
              {isUp ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#1a1a1a",
  },
  chipLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 2 },
  chipValue: { fontSize: 12, fontWeight: "700" },
});
