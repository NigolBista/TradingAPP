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
import { useTheme } from "../../providers/ThemeProvider";
import { useNavigation } from "@react-navigation/native";
import { useUserStore } from "../../store/userStore";
import { useEarningsStore } from "../../store/earningsStore";
import {
  fetchUpcomingEarnings,
  fetchRecentEarnings,
  fetchTodaysEarnings,
  EarningsCalendarItem,
  RecentEarningsItem,
  formatEPS,
  formatCurrency,
  formatEarningsTime,
} from "../../services/earningsData";

interface Props {
  onEarningsPress?: (symbol: string) => void;
  compact?: boolean;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: "transparent",
      borderRadius: 12,
      marginBottom: 16,
      marginTop: 12,
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
      marginBottom: 8,
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
    dateTimeContainer: {
      alignItems: "flex-end",
    },
    date: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    time: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    timeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
    },
    timeBadgeBMO: {
      backgroundColor: "rgba(59, 130, 246, 0.2)",
    },
    timeBadgeAMC: {
      backgroundColor: "rgba(168, 85, 247, 0.2)",
    },
    timeBadgeDMH: {
      backgroundColor: "rgba(245, 158, 11, 0.2)",
    },
    timeBadgeTBD: {
      backgroundColor: "rgba(107, 114, 128, 0.2)",
    },
    timeBadgeText: {
      fontSize: 8,
      fontWeight: "600",
    },
    timeBadgeTextBMO: {
      color: "#3B82F6",
    },
    timeBadgeTextAMC: {
      color: "#A855F7",
    },
    timeBadgeTextDMH: {
      color: "#F59E0B",
    },
    timeBadgeTextTBD: {
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
    quarterInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    quarterText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flexDirection: "row",
      alignItems: "center",
    },
    sectionHeaderText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: 6,
    },
    sectionContainer: {},
  });

export default function UpcomingEarningsCard({
  onEarningsPress,
  compact = false,
}: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);
  const { profile } = useUserStore();

  // Use earnings store instead of local state
  const {
    todaysEarnings,
    upcomingEarnings,
    recentEarnings,
    isLoading,
    error,
    isHydrated,
    refreshEarningsData,
  } = useEarningsStore();

  const [favoriteEarnings, setFavoriteEarnings] = useState<
    EarningsCalendarItem[]
  >([]);
  const [favoriteRecentEarnings, setFavoriteRecentEarnings] = useState<
    RecentEarningsItem[]
  >([]);
  const [showingRecent, setShowingRecent] = useState(false);

  const loadEarnings = () => {
    // Get user's favorite stocks (GLOBAL favorites only)
    const favoriteSymbolsSet = new Set<string>(profile.favorites);
    const uniqueFavoriteSymbols = Array.from(favoriteSymbolsSet);

    // Filter cached data for user's favorites
    if (uniqueFavoriteSymbols.length > 0) {
      // Filter upcoming earnings for favorites
      const filteredUpcoming = upcomingEarnings.filter((item) =>
        favoriteSymbolsSet.has(item.symbol.toUpperCase())
      );
      setFavoriteEarnings(filteredUpcoming.slice(0, 5));

      // Filter recent earnings for favorites
      const filteredRecent = recentEarnings.filter((item) =>
        favoriteSymbolsSet.has(item.symbol.toUpperCase())
      );
      setFavoriteRecentEarnings(filteredRecent.slice(0, 5));

      setShowingRecent(false);
    } else {
      setFavoriteEarnings([]);
      setFavoriteRecentEarnings([]);
      setShowingRecent(false);
    }
  };

  useEffect(() => {
    // Trigger refresh if visiting market overview and data needs refresh
    if (isHydrated) {
      refreshEarningsData();
    }
  }, []); // Only run once when component mounts

  useEffect(() => {
    // Filter earnings when favorites or cached data changes
    loadEarnings();
  }, [profile.favorites, upcomingEarnings, recentEarnings, isHydrated]);

  const handleEarningsPress = (symbol: string) => {
    if (onEarningsPress) {
      onEarningsPress(symbol);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getTimeInfo = (time?: string) => {
    switch (time) {
      case "bmo":
        return {
          text: "BMO",
          style: styles.timeBadgeBMO,
          textStyle: styles.timeBadgeTextBMO,
        };
      case "amc":
        return {
          text: "AMC",
          style: styles.timeBadgeAMC,
          textStyle: styles.timeBadgeTextAMC,
        };
      case "dmh":
        return {
          text: "DMH",
          style: styles.timeBadgeDMH,
          textStyle: styles.timeBadgeTextDMH,
        };
      default:
        return {
          text: "TBD",
          style: styles.timeBadgeTBD,
          textStyle: styles.timeBadgeTextTBD,
        };
    }
  };

  if (isLoading && !isHydrated) {
    return (
      <View style={styles.container}>
        <Pressable
          style={styles.sectionTitle}
          onPress={() => (navigation as any).navigate("EarningsCalendar")}
        >
          <Text style={styles.title}>Earnings</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.loadingText}>Loading earnings calendar...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Pressable
          style={styles.sectionTitle}
          onPress={() => (navigation as any).navigate("EarningsCalendar")}
        >
          <Text style={styles.title}>Earnings</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadEarnings}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (
    favoriteEarnings.length === 0 &&
    favoriteRecentEarnings.length === 0 &&
    todaysEarnings.length === 0
  ) {
    return (
      <View style={styles.container}>
        <Pressable
          style={styles.sectionTitle}
          onPress={() => (navigation as any).navigate("EarningsCalendar")}
        >
          <Text style={styles.title}>Earnings</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No earnings found for your favorites
          </Text>
        </View>
      </View>
    );
  }

  const renderEarningsItem = (item: EarningsCalendarItem, index: number) => {
    const timeInfo = getTimeInfo(item.time);

    return (
      <Pressable
        key={`${item.symbol}-${index}`}
        style={styles.earningsItem}
        onPress={() => handleEarningsPress(item.symbol)}
      >
        <View style={styles.earningsHeader}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.companyName} numberOfLines={1}>
              {item.companyName}
            </Text>
          </View>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            <View style={[styles.timeBadge, timeInfo.style]}>
              <Text style={[styles.timeBadgeText, timeInfo.textStyle]}>
                {timeInfo.text}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Est. EPS</Text>
            <Text style={styles.metricValue}>
              {formatEPS(item.estimatedEPS)}
            </Text>
          </View>
          {!compact && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Est. Revenue</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(item.estimatedRevenue, { compact: true })}
              </Text>
            </View>
          )}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Quarter</Text>
            <Text style={styles.metricValue}>
              {item.fiscalQuarter || "N/A"}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderRecentEarningsItem = (
    item: RecentEarningsItem,
    index: number
  ) => {
    const timeInfo = getTimeInfo(item.time);
    const beatEstimate =
      item.actualEPS && item.estimatedEPS
        ? item.actualEPS > item.estimatedEPS
        : false;
    const missedEstimate =
      item.actualEPS && item.estimatedEPS
        ? item.actualEPS < item.estimatedEPS
        : false;

    return (
      <Pressable
        key={`recent-${item.symbol}-${index}`}
        style={styles.earningsItem}
        onPress={() => handleEarningsPress(item.symbol)}
      >
        <View style={styles.earningsHeader}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.companyName} numberOfLines={1}>
              {item.companyName}
            </Text>
          </View>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            {beatEstimate && (
              <View
                style={[
                  styles.timeBadge,
                  { backgroundColor: "rgba(16, 185, 129, 0.2)" },
                ]}
              >
                <Text style={[styles.timeBadgeText, { color: "#10B981" }]}>
                  BEAT
                </Text>
              </View>
            )}
            {missedEstimate && (
              <View
                style={[
                  styles.timeBadge,
                  { backgroundColor: "rgba(239, 68, 68, 0.2)" },
                ]}
              >
                <Text style={[styles.timeBadgeText, { color: "#EF4444" }]}>
                  MISS
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Actual EPS</Text>
            <Text style={styles.metricValue}>{formatEPS(item.actualEPS)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Est. EPS</Text>
            <Text style={styles.metricValue}>
              {formatEPS(item.estimatedEPS)}
            </Text>
          </View>
          {item.surprisePercent !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Surprise</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: item.surprisePercent > 0 ? "#10B981" : "#EF4444" },
                ]}
              >
                {item.surprisePercent > 0 ? "+" : ""}
                {item.surprisePercent.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => (navigation as any).navigate("EarningsCalendar")}
      >
        <Text style={styles.title}>Earnings</Text>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {todaysEarnings.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.earningsContainer}>
              {todaysEarnings.map(
                (item, index) => renderEarningsItem(item, index + 1000) // Use offset to avoid conflicts
              )}
            </View>
          </View>
        )}

        {/* Upcoming Earnings Section */}
        {favoriteEarnings.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderText}>Upcoming</Text>
            <View style={styles.earningsContainer}>
              {favoriteEarnings.map((item, index) =>
                renderEarningsItem(item, index)
              )}
            </View>
          </View>
        )}

        {/* Recent Earnings Section */}
        {favoriteRecentEarnings.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderText}>Recent</Text>
            <View style={styles.earningsContainer}>
              {favoriteRecentEarnings.map((item, index) =>
                renderRecentEarningsItem(item, index)
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
