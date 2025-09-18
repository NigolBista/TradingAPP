import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../providers/ThemeProvider";
import { useUserStore } from "../../../../store/userStore";
import {
  fetchRecentEarnings,
  RecentEarningsItem,
  formatEPS,
  formatCurrency,
  calculateEPSSurprise,
} from "../../../../shared/services/earningsData";

interface Props {
  onEarningsPress?: (symbol: string) => void;
  compact?: boolean;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: "transparent",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: "#10B981",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flexDirection: "row",
      alignItems: "center",
    },
    titleIcon: {
      marginRight: 8,
    },
    viewAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 6,
    },
    viewAllText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "600",
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: "center",
    },
    loadingText: {
      color: theme.colors.textSecondary,
      marginTop: 8,
      fontSize: 12,
    },
    earningsContainer: {
      gap: 12,
    },
    earningsItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 3,
    },
    earningsItemBeat: {
      borderLeftColor: "#10B981",
    },
    earningsItemMissed: {
      borderLeftColor: "#EF4444",
    },
    earningsItemNeutral: {
      borderLeftColor: "#6B7280",
    },
    earningsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    symbolContainer: {
      flex: 1,
    },
    symbol: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    companyName: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    dateContainer: {
      alignItems: "flex-end",
    },
    date: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    performanceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
    },
    performanceBadgeBeat: {
      backgroundColor: "rgba(16, 185, 129, 0.2)",
    },
    performanceBadgeMissed: {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
    },
    performanceBadgeNeutral: {
      backgroundColor: "rgba(107, 114, 128, 0.2)",
    },
    performanceBadgeText: {
      fontSize: 9,
      fontWeight: "600",
    },
    performanceBadgeTextBeat: {
      color: "#10B981",
    },
    performanceBadgeTextMissed: {
      color: "#EF4444",
    },
    performanceBadgeTextNeutral: {
      color: "#6B7280",
    },
    metricsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    metricItem: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    surpriseValue: {
      fontSize: 12,
      fontWeight: "600",
    },
    surprisePositive: {
      color: "#10B981",
    },
    surpriseNegative: {
      color: "#EF4444",
    },
    emptyContainer: {
      paddingVertical: 20,
      alignItems: "center",
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
    },
    errorContainer: {
      paddingVertical: 20,
      alignItems: "center",
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      textAlign: "center",
      marginBottom: 8,
    },
    retryButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 6,
    },
    retryButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "600",
    },
  });

export default function RecentEarningsCard({
  onEarningsPress,
  compact = false,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const profile = useUserStore((s) => s.profile);
  const getActiveWatchlist = useUserStore((s) => s.getActiveWatchlist);
  const [earnings, setEarnings] = useState<RecentEarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's favorite stocks
      const favoriteSymbols = [...profile.favorites];

      // Also get favorites from active watchlist
      const activeWatchlist = getActiveWatchlist();
      if (activeWatchlist) {
        const watchlistFavorites = activeWatchlist.items
          .filter((item) => item.isFavorite)
          .map((item) => item.symbol);
        favoriteSymbols.push(...watchlistFavorites);
      }

      // Remove duplicates and use default symbols if no favorites
      const uniqueSymbols = [...new Set(favoriteSymbols)];
      const symbolsToUse =
        uniqueSymbols.length > 0
          ? uniqueSymbols
          : ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX"];

      const data = await fetchRecentEarnings(symbolsToUse, 7);
      setEarnings(data);
    } catch (err) {
      console.error("Failed to load recent earnings:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load earnings data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, [profile.favorites, profile.activeWatchlistId]);

  const handleEarningsPress = (symbol: string) => {
    if (onEarningsPress) {
      onEarningsPress(symbol);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPerformanceInfo = (item: RecentEarningsItem) => {
    if (item.beatEstimate) {
      return {
        text: "BEAT",
        style: styles.performanceBadgeBeat,
        textStyle: styles.performanceBadgeTextBeat,
        borderStyle: styles.earningsItemBeat,
      };
    } else if (item.missedEstimate) {
      return {
        text: "MISS",
        style: styles.performanceBadgeMissed,
        textStyle: styles.performanceBadgeTextMissed,
        borderStyle: styles.earningsItemMissed,
      };
    } else {
      return {
        text: "N/A",
        style: styles.performanceBadgeNeutral,
        textStyle: styles.performanceBadgeTextNeutral,
        borderStyle: styles.earningsItemNeutral,
      };
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            <Ionicons
              name="bar-chart"
              size={16}
              color="#10B981"
              style={styles.titleIcon}
            />
            Recent Earnings - Favorites
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.loadingText}>Loading recent earnings...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            <Ionicons
              name="bar-chart"
              size={16}
              color="#10B981"
              style={styles.titleIcon}
            />
            Recent Earnings - Favorites
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadEarnings}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (earnings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            <Ionicons
              name="bar-chart"
              size={16}
              color="#10B981"
              style={styles.titleIcon}
            />
            Recent Earnings - Favorites
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {profile.favorites.length === 0 &&
            !getActiveWatchlist()?.items.some((item) => item.isFavorite)
              ? "No favorite stocks set. Add stocks to your favorites to see their earnings here."
              : "No recent earnings reports found for your favorite stocks"}
          </Text>
        </View>
      </View>
    );
  }

  const displayEarnings = compact ? earnings.slice(0, 3) : earnings.slice(0, 6);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          <Ionicons
            name="bar-chart"
            size={16}
            color="#10B981"
            style={styles.titleIcon}
          />
          Recent Earnings
        </Text>
        {!compact && (
          <Pressable style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.earningsContainer}>
        {displayEarnings.map((item, index) => {
          const performance = getPerformanceInfo(item);
          const surprise = calculateEPSSurprise(
            item.actualEPS,
            item.estimatedEPS
          );

          return (
            <Pressable
              key={`${item.symbol}-${index}`}
              style={[styles.earningsItem, performance.borderStyle]}
              onPress={() => handleEarningsPress(item.symbol)}
            >
              <View style={styles.earningsHeader}>
                <View style={styles.symbolContainer}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                </View>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>{formatDate(item.date)}</Text>
                  <View style={[styles.performanceBadge, performance.style]}>
                    <Text
                      style={[
                        styles.performanceBadgeText,
                        performance.textStyle,
                      ]}
                    >
                      {performance.text}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricsContainer}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Actual EPS</Text>
                  <Text style={styles.metricValue}>
                    {formatEPS(item.actualEPS)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Est. EPS</Text>
                  <Text style={styles.metricValue}>
                    {formatEPS(item.estimatedEPS)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Surprise</Text>
                  <Text
                    style={[
                      styles.surpriseValue,
                      surprise !== undefined
                        ? surprise >= 0
                          ? styles.surprisePositive
                          : styles.surpriseNegative
                        : { color: theme.colors.textSecondary },
                    ]}
                  >
                    {surprise !== undefined ? `${surprise.toFixed(1)}%` : "N/A"}
                  </Text>
                </View>
                {!compact && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Revenue</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(item.actualRevenue, { compact: true })}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
