import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchYahooCandles } from "../../../shared/services/marketProviders";

type ETFInfo = {
  symbol: string;
  label: string;
  fullName: string;
  changePct: number;
  price: number;
};

interface Props {
  etfs?: { symbol: string; label: string; fullName: string }[];
  compact?: boolean;
}

export default function ETFStrip({
  etfs = [
    { symbol: "SPY", label: "S&P 500", fullName: "SPDR S&P 500 ETF" },
    { symbol: "QQQ", label: "NASDAQ", fullName: "Invesco QQQ Trust" },
    {
      symbol: "DIA",
      label: "DOW",
      fullName: "SPDR Dow Jones Industrial Average ETF",
    },
    { symbol: "IWM", label: "Russell", fullName: "iShares Russell 2000 ETF" },
    {
      symbol: "VTI",
      label: "Total Market",
      fullName: "Vanguard Total Stock Market ETF",
    },
    {
      symbol: "EFA",
      label: "International",
      fullName: "iShares MSCI EAFE ETF",
    },
  ],
  compact = false,
}: Props) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ETFInfo[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const results = await Promise.all(
          etfs.map(async (etf) => {
            try {
              const candles = await fetchYahooCandles(etf.symbol, "5d", "1d");
              const n = candles.length;
              const prev = candles[n - 2]?.close ?? candles[n - 1]?.close ?? 0;
              const last = candles[n - 1]?.close ?? 0;
              const changePct = prev ? ((last - prev) / prev) * 100 : 0;
              return {
                symbol: etf.symbol,
                label: etf.label,
                fullName: etf.fullName,
                changePct,
                price: last,
              } as ETFInfo;
            } catch (error) {
              console.log(`Failed to load ${etf.symbol}:`, error);
              return {
                symbol: etf.symbol,
                label: etf.label,
                fullName: etf.fullName,
                changePct: 0,
                price: 0,
              } as ETFInfo;
            }
          })
        );
        if (mounted) setData(results);
      } catch (error) {
        console.error("Error loading ETF data:", error);
        if (mounted) setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [etfs.map((etf) => etf.symbol).join("|")]);

  const handleETFPress = (symbol: string) => {
    (navigation as any).navigate("StockDetail", { symbol });
  };

  if (loading && data.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#00D4AA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Major ETFs</Text>
        <Text style={styles.headerSubtext}>Exchange-Traded Funds</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        style={styles.scrollView}
      >
        {data.map((etf, idx) => {
          const isUp = etf.changePct >= 0;
          const color = isUp ? "#10B981" : "#EF4444";

          return (
            <Pressable
              key={idx}
              style={[styles.etfCard, { borderColor: color }]}
              onPress={() => handleETFPress(etf.symbol)}
            >
              <View style={styles.etfHeader}>
                <Text style={styles.etfSymbol}>{etf.symbol}</Text>
                <Text style={[styles.etfChange, { color }]}>
                  {isUp ? "▲" : "▼"} {Math.abs(etf.changePct).toFixed(2)}%
                </Text>
              </View>
              <Text style={styles.etfLabel}>{etf.label}</Text>
              {etf.price > 0 && (
                <Text style={styles.etfPrice}>${etf.price.toFixed(2)}</Text>
              )}
              {!compact && (
                <Text style={styles.etfFullName} numberOfLines={2}>
                  {etf.fullName}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerSubtext: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    marginHorizontal: -4, // Offset the padding to align with container edges
  },
  scrollContainer: {
    paddingHorizontal: 4,
    gap: 12,
  },
  etfCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#1a1a1a",
    width: 140, // Fixed width for horizontal scrolling
    marginRight: 0, // Gap is handled by scrollContainer
  },
  etfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  etfSymbol: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  etfChange: {
    fontSize: 12,
    fontWeight: "600",
  },
  etfLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  etfPrice: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  etfFullName: {
    color: "#6b7280",
    fontSize: 11,
    lineHeight: 14,
  },
});
