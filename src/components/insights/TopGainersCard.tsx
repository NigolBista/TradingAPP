import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "../../providers/ThemeProvider";

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const renderEmptyState = () => (
    <View>
      <View>
        <View>
          <Text style={styles.title}>Your Top Movers</Text>
        </View>
        <Ionicons name="bar-chart" size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.emptyStateContent}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons
            name="pulse-outline"
            size={24}
            color={theme.colors.textSecondary}
            style={{ marginBottom: 8 }}
          />
        )}
        <Text style={styles.emptyText}>
          {loading ? "Loading positions..." : "No positions found"}
        </Text>
      </View>
    </View>
  );

  if (!sortedPositions.length) {
    return renderEmptyState();
  }

  return (
    <View>
      <View>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Your Top Movers</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedPositions.slice(0, 10).map((position, index) => (
          <Pressable
            key={`${position.symbol}-${position.provider}-${index}`}
            onPress={() => onPositionPress?.(position)}
            style={styles.cardWrapper}
          >
            <LinearGradient
              colors={getCardGradient(theme, position.dayChangePercent)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.positionCard}
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
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const getCardGradient = (theme: Theme, change?: number): [string, string] => {
  const isPositive = (change || 0) >= 0;
  if (theme.mode === "dark") {
    return isPositive
      ? ["rgba(16, 185, 129, 0.18)", "rgba(6, 95, 70, 0.4)"]
      : ["rgba(248, 113, 113, 0.2)", "rgba(127, 29, 29, 0.4)"];
  }
  return isPositive
    ? ["rgba(16, 185, 129, 0.12)", "rgba(5, 150, 105, 0.18)"]
    : ["rgba(248, 113, 113, 0.12)", "rgba(220, 38, 38, 0.16)"];
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    scrollView: {
      marginHorizontal: -4,
    },
    scrollContent: {
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    cardWrapper: {
      marginHorizontal: 4,
    },
    positionCard: {
      borderRadius: 14,
      padding: 14,
      width: 150,
      minHeight: 130,
      borderWidth: theme.mode === "dark" ? 1 : 0,
      borderColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "transparent",
    },
    positionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    symbol: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    dayChangePercent: {
      fontSize: 12,
      fontWeight: "700",
    },
    price: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
    },
    positionFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    quantity: {
      color: theme.colors.textSecondary,
      fontSize: 11,
    },
    dayChange: {
      fontSize: 11,
      fontWeight: "600",
    },
    provider: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      textAlign: "right",
    },
    up: {
      color: theme.colors.success,
    },
    down: {
      color: theme.colors.error,
    },
    emptyStateCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    emptyStateContent: {
      alignItems: "center",
      marginTop: 12,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      textAlign: "center",
      fontSize: 13,
    },
    headerRow: {
      marginBottom: 16,
    },
  });
