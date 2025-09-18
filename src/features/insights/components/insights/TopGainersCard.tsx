import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchYahooCandles } from "../../shared/services/marketProviders";

interface Position {
  symbol: string;
  name?: string;
  quantity: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  provider: string;
}

interface Props {
  positions: Position[];
  onPositionPress?: (position: Position) => void;
}

interface PositionWithDayChange extends Position {
  dayChange: number;
  dayChangePercent: number;
}

export default function TopGainersCard({ positions, onPositionPress }: Props) {
  const [positionsWithDayChange, setPositionsWithDayChange] = useState<
    PositionWithDayChange[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [lastFetchedSymbols, setLastFetchedSymbols] = useState<string>("");

  // Fetch day change data for all positions
  useEffect(() => {
    if (!positions.length) return;

    // Create a stable key from positions to avoid unnecessary refetches
    const currentSymbols = positions
      .map((p) => `${p.symbol}-${p.provider}`)
      .sort()
      .join(",");

    // Skip if we already have data for the same positions
    if (
      currentSymbols === lastFetchedSymbols &&
      positionsWithDayChange.length > 0
    ) {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        // Only show loading if we don't have any existing data
        if (positionsWithDayChange.length === 0) {
          setLoading(true);
        }

        const enrichedPositions = await Promise.all(
          positions.map(async (position) => {
            try {
              // Fetch 2 days of data to get previous close
              const candles = await fetchYahooCandles(
                position.symbol,
                "2d",
                "1d"
              );
              if (candles.length >= 2) {
                const prevClose = candles[candles.length - 2].close;
                const currentPrice = candles[candles.length - 1].close;
                const dayChange = currentPrice - prevClose;
                const dayChangePercent = (dayChange / prevClose) * 100;

                return {
                  ...position,
                  currentPrice, // Update with latest price
                  dayChange,
                  dayChangePercent,
                };
              }
              // Fallback if no data
              return {
                ...position,
                dayChange: 0,
                dayChangePercent: 0,
              };
            } catch {
              return {
                ...position,
                dayChange: 0,
                dayChangePercent: 0,
              };
            }
          })
        );

        if (mounted) {
          setPositionsWithDayChange(enrichedPositions);
          setLastFetchedSymbols(currentSymbols);
        }
      } catch (error) {
        console.error("Error fetching day changes:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [positions, lastFetchedSymbols, positionsWithDayChange.length]);

  // Sort by day change percent (top gainers first)
  const sortedPositions = useMemo(() => {
    return [...positionsWithDayChange].sort(
      (a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0)
    );
  }, [positionsWithDayChange]);

  const formatCurrency = (value: number | undefined | null) => {
    if (!value || !Number.isFinite(value)) return "$0.00";
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Only show loading state if we have no data at all
  if (loading && !sortedPositions.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Top Movers</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#00D4AA" />
          <Text style={styles.loadingText}>Loading positions...</Text>
        </View>
      </View>
    );
  }

  if (!sortedPositions.length && !loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Top Movers</Text>
        <Text style={styles.emptyText}>No positions found</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your Top Movers</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        {sortedPositions.slice(0, 10).map((position, index) => (
          <Pressable
            key={`${position.symbol}-${position.provider}-${index}`}
            style={styles.positionCard}
            onPress={() => onPositionPress?.(position)}
          >
            <View style={styles.positionHeader}>
              <Text style={styles.symbol}>{position.symbol}</Text>
              <Text
                style={[
                  styles.dayChangePercent,
                  (position.dayChangePercent || 0) >= 0
                    ? styles.up
                    : styles.down,
                ]}
              >
                {(position.dayChangePercent || 0) >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(position.dayChangePercent || 0).toFixed(2)}%
              </Text>
            </View>

            <Text style={styles.price}>
              {formatCurrency(position.currentPrice)}
            </Text>

            <View style={styles.positionFooter}>
              <Text style={styles.quantity}>
                {(position.quantity || 0).toFixed(0)} shares
              </Text>
              <Text
                style={[
                  styles.dayChange,
                  (position.dayChange || 0) >= 0 ? styles.up : styles.down,
                ]}
              >
                {formatCurrency(
                  (position.dayChange || 0) * (position.quantity || 0)
                )}
              </Text>
            </View>

            <Text style={styles.provider}>{position.provider}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  scrollView: {
    marginHorizontal: -4,
  },
  positionCard: {
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    width: 140,
    minHeight: 120,
  },
  positionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  symbol: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  dayChangePercent: {
    fontSize: 12,
    fontWeight: "600",
  },
  price: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  positionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  quantity: {
    color: "#9ca3af",
    fontSize: 11,
  },
  dayChange: {
    fontSize: 11,
    fontWeight: "600",
  },
  provider: {
    color: "#6b7280",
    fontSize: 10,
    textAlign: "right",
  },
  up: {
    color: "#10B981",
  },
  down: {
    color: "#EF4444",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    color: "#9ca3af",
    marginLeft: 8,
  },
  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
});
