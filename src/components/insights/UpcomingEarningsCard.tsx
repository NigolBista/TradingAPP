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
import {
  fetchUpcomingEarnings,
  EarningsCalendarItem,
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
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: "#6366F1",
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
      borderLeftColor: "#6366F1",
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
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      marginTop: 8,
    },
    sectionHeaderText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: 4,
    },
    todaySection: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 12,
      marginTop: 8,
    },
    tomorrowSection: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 12,
      marginTop: 8,
    },
  });

export default function UpcomingEarningsCard({
  onEarningsPress,
  compact = false,
}: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);
  const { profile } = useUserStore();
  const [earnings, setEarnings] = useState<EarningsCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's favorite stocks (GLOBAL favorites only)
      const favoriteSymbolsSet = new Set<string>(profile.favorites);

      // Remove duplicates and use default symbols if no favorites
      const uniqueSymbols = Array.from(favoriteSymbolsSet);
      const symbolsToUse = uniqueSymbols;

      console.log(
        "📅 Loading upcoming earnings for favorite stocks:",
        symbolsToUse
      );

      // Determine days ahead until end of current month
      const now = new Date();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      const daysUntilEndOfMonth = Math.max(
        1,
        Math.ceil(
          (endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      const data = await fetchUpcomingEarnings(
        symbolsToUse,
        daysUntilEndOfMonth
      );
      setEarnings(data);
    } catch (err) {
      console.error("Failed to load upcoming earnings:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load earnings data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, [profile.favorites]);

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

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isTomorrow = (dateString: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date(dateString);
    return (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    );
  };

  const groupByWeekAndMonth = (all: EarningsCalendarItem[]) => {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const week: EarningsCalendarItem[] = [];
    const month: EarningsCalendarItem[] = [];

    all.forEach((item) => {
      const d = new Date(item.date);
      if (d <= endOfWeek) {
        week.push(item);
      } else if (d > endOfWeek && d <= endOfMonth) {
        month.push(item);
      }
    });

    return { week, month };
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            <Ionicons
              name="calendar"
              size={16}
              color="#6366F1"
              style={styles.titleIcon}
            />
            Upcoming Earnings - Favorites
          </Text>
        </View>
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
        <View style={styles.header}>
          <Text style={styles.title}>
            <Ionicons
              name="calendar"
              size={16}
              color="#6366F1"
              style={styles.titleIcon}
            />
            Upcoming Earnings - Favorites
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
              name="calendar"
              size={16}
              color="#6366F1"
              style={styles.titleIcon}
            />
            Upcoming Earnings - Favorites
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {profile.favorites.length === 0
              ? "No favorite stocks set. Add stocks to your favorites to see their earnings here."
              : "No upcoming earnings found for your favorite stocks"}
          </Text>
        </View>
      </View>
    );
  }

  const { week, month } = groupByWeekAndMonth(earnings);
  const displayLimit = compact ? 4 : 8;

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          <Ionicons
            name="calendar"
            size={16}
            color="#6366F1"
            style={styles.titleIcon}
          />
          Upcoming Earnings
        </Text>
        {!compact && (
          <Pressable
            style={styles.viewAllButton}
            onPress={() => (navigation as any).navigate("EarningsCalendar")}
          >
            <Text style={styles.viewAllText}>View Calendar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* This Week */}
        {week.length > 0 && (
          <View style={styles.todaySection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={14} color="#6366F1" />
              <Text style={styles.sectionHeaderText}>This Week</Text>
            </View>
            {week
              .slice(0, displayLimit)
              .map((item, index) => renderEarningsItem(item, index))}
          </View>
        )}

        {/* This Month */}
        {month.length > 0 && (
          <View style={styles.tomorrowSection}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="calendar-number-outline"
                size={14}
                color="#A855F7"
              />
              <Text style={styles.sectionHeaderText}>This Month</Text>
            </View>
            {month
              .slice(0, displayLimit)
              .map((item, index) => renderEarningsItem(item, index))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
