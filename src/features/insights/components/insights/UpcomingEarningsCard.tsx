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
import { useTheme } from "../../../providers/ThemeProvider";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useUserStore } from "../../../../../store/userStore";
import { useEarningsStore } from "../../../../../store/earningsStore";
import { useCallback } from "react";
import {
  fetchUpcomingEarnings,
  fetchRecentEarnings,
  fetchTodaysEarnings,
  EarningsCalendarItem,
  RecentEarningsItem,
  formatEPS,
  formatCurrency,
  formatEarningsTime,
} from "../../../shared/services/earningsData";

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
      gap: 2,
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
    companyRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    favoriteIcon: {
      marginLeft: 6,
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
      marginBottom: 12,
    },
    sectionContainer: {
      marginTop: 16,
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

  // Use earnings store instead of local state
  const {
    todaysEarnings,
    upcomingEarnings,
    recentEarnings,
    isLoading,
    error,
    isHydrated,
    refreshEarningsData,
    forceRefreshEarningsData,
  } = useEarningsStore();

  const [favoriteEarnings, setFavoriteEarnings] = useState<
    EarningsCalendarItem[]
  >([]);
  const [favoriteRecentEarnings, setFavoriteRecentEarnings] = useState<
    RecentEarningsItem[]
  >([]);
  const [showingRecent, setShowingRecent] = useState(false);
  const [topEarnings, setTopEarnings] = useState<EarningsCalendarItem[]>([]);
  const [recentForTop, setRecentForTop] = useState<RecentEarningsItem[]>([]);

  const loadEarnings = async () => {
    if (__DEV__)
      console.log("🔄 Loading earnings with favorites:", profile.favorites);

    // Get user's favorite stocks (GLOBAL favorites only)
    const favoriteSymbolsSet = new Set<string>(
      profile.favorites.map((f) => f.toUpperCase())
    );
    const uniqueFavoriteSymbols = Array.from(favoriteSymbolsSet);

    // Special debug for WKHS
    const hasWKHS = favoriteSymbolsSet.has("WKHS");
    if (__DEV__)
      console.log("🐎 WKHS Debug:", {
        inFavorites: hasWKHS,
        favoriteSymbolsSet: Array.from(favoriteSymbolsSet),
        originalFavorites: profile.favorites,
      });

    if (__DEV__)
      console.log("📊 Available data:", {
        todaysEarnings: todaysEarnings.length,
        upcomingEarnings: upcomingEarnings.length,
        recentEarnings: recentEarnings.length,
        favorites: uniqueFavoriteSymbols,
      });

    // Debug: Show all upcoming earnings symbols
    if (__DEV__) {
      console.log(
        "📋 All upcoming earnings symbols:",
        upcomingEarnings.map((e) => e.symbol.toUpperCase())
      );
      console.log(
        "📋 All today's earnings symbols:",
        todaysEarnings.map((e) => e.symbol.toUpperCase())
      );
    }

    // Debug: Check if any favorites match upcoming earnings
    const matchingUpcoming = upcomingEarnings.filter((item) =>
      favoriteSymbolsSet.has(item.symbol.toUpperCase())
    );
    if (__DEV__)
      console.log(
        "🎯 Matching upcoming earnings for favorites:",
        matchingUpcoming.map((e) => `${e.symbol} - ${e.date}`)
      );

    const matchingTodays = todaysEarnings.filter((item) =>
      favoriteSymbolsSet.has(item.symbol.toUpperCase())
    );
    if (__DEV__)
      console.log(
        "🎯 Matching today's earnings for favorites:",
        matchingTodays.map((e) => `${e.symbol} - ${e.date}`)
      );

    // Special WKHS debug
    const wkhsInUpcoming = upcomingEarnings.find(
      (item) => item.symbol.toUpperCase() === "WKHS"
    );
    const wkhsInTodays = todaysEarnings.find(
      (item) => item.symbol.toUpperCase() === "WKHS"
    );
    if (__DEV__)
      console.log("🐎 WKHS in earnings data:", {
        inUpcoming: wkhsInUpcoming
          ? `${wkhsInUpcoming.symbol} - ${wkhsInUpcoming.date}`
          : "Not found",
        inTodays: wkhsInTodays
          ? `${wkhsInTodays.symbol} - ${wkhsInTodays.date}`
          : "Not found",
        upcomingCount: upcomingEarnings.length,
        todaysCount: todaysEarnings.length,
      });

    // Filter cached data for user's favorites (upcoming earnings within 1 month)
    if (uniqueFavoriteSymbols.length > 0) {
      // Get current date for filtering
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(now.getMonth() + 1);
      oneMonthFromNow.setHours(23, 59, 59, 999); // End of day one month from now

      if (__DEV__)
        console.log("📅 Date filtering range:", {
          now: now.toLocaleDateString(),
          oneMonthFromNow: oneMonthFromNow.toLocaleDateString(),
        });

      // Filter upcoming earnings for favorites within next month
      const filteredUpcoming = upcomingEarnings.filter((item) => {
        const earningsDate = new Date(item.date);
        const isFavorite = favoriteSymbolsSet.has(item.symbol.toUpperCase());
        const isInDateRange =
          earningsDate >= now && earningsDate <= oneMonthFromNow;

        // Debug each favorite check
        if (isFavorite && __DEV__) {
          console.log(`🔍 Checking favorite ${item.symbol}:`, {
            earningsDate: earningsDate.toLocaleDateString(),
            now: now.toLocaleDateString(),
            oneMonthFromNow: oneMonthFromNow.toLocaleDateString(),
            isInDateRange,
            rawDate: item.date,
          });
        }

        // Re-enable strict 30-day filter for favorites
        return isFavorite && isInDateRange;
      });

      if (__DEV__)
        console.log(
          "⭐ Filtered upcoming favorites:",
          filteredUpcoming.map((e) => `${e.symbol} - ${e.date}`)
        );
      let favoritesToShow = filteredUpcoming;

      // Fallback: if cache doesn't include favorite earnings, fetch specifically for favorites
      if (favoritesToShow.length === 0 && uniqueFavoriteSymbols.length > 0) {
        try {
          if (__DEV__)
            console.log(
              "🔁 No favorites found in cached upcoming; fetching favorites directly..."
            );
          const fetchedFavorites = await fetchUpcomingEarnings(
            uniqueFavoriteSymbols,
            60
          );

          // Apply same 30-day window filter
          const filteredFetched = fetchedFavorites.filter((item) => {
            const d = new Date(item.date);
            return d >= now && d <= oneMonthFromNow;
          });

          if (__DEV__)
            console.log(
              "⭐ Fetched favorites within 30 days:",
              filteredFetched.map((e) => `${e.symbol} - ${e.date}`)
            );
          favoritesToShow = filteredFetched;
        } catch (e) {
          console.warn("⚠️ Failed to fetch favorites upcoming earnings:", e);
        }
      }

      const slicedUpcoming = favoritesToShow.slice(0, 5);
      if (__DEV__)
        console.log(
          "⭐ Setting favoriteEarnings to:",
          slicedUpcoming.length,
          "items"
        );
      setFavoriteEarnings(slicedUpcoming);

      // Filter recent earnings for favorites
      const filteredRecent = recentEarnings.filter((item) =>
        favoriteSymbolsSet.has(item.symbol.toUpperCase())
      );

      if (__DEV__)
        console.log(
          "📈 Filtered recent favorites:",
          filteredRecent.map((e) => `${e.symbol} - ${e.date}`)
        );
      setFavoriteRecentEarnings(filteredRecent.slice(0, 5));

      setShowingRecent(false);
    } else {
      if (__DEV__) console.log("❌ No favorites found");
      setFavoriteEarnings([]);
      setFavoriteRecentEarnings([]);
      setShowingRecent(false);
    }

    // Create prioritized top 5 earnings list for main display
    // Combine today's earnings with upcoming earnings, prioritizing favorites
    const allEarnings = [...todaysEarnings, ...upcomingEarnings];
    if (__DEV__)
      console.log("🔄 All earnings for prioritization:", allEarnings.length);
    if (__DEV__)
      console.log(
        "🔄 All earnings symbols:",
        allEarnings.map(
          (e) => `${e.symbol} - ${new Date(e.date).toLocaleDateString()}`
        )
      );

    // Separate favorites and non-favorites
    const favoriteEarningsAll = allEarnings.filter((item) => {
      const isMatch = favoriteSymbolsSet.has(item.symbol.toUpperCase());
      if (isMatch) {
        if (__DEV__)
          console.log(
            `✅ Found favorite match for prioritization: ${item.symbol} - ${item.date}`
          );
      }
      return isMatch;
    });

    const nonFavoriteEarnings = allEarnings.filter(
      (item) => !favoriteSymbolsSet.has(item.symbol.toUpperCase())
    );

    if (__DEV__)
      console.log(
        "🎯 Favorite earnings found for prioritization:",
        favoriteEarningsAll.length
      );
    if (__DEV__)
      console.log(
        "🎯 Non-favorite earnings found:",
        nonFavoriteEarnings.length
      );

    if (__DEV__)
      console.log("🎯 Prioritization breakdown:", {
        favoriteEarningsAll: favoriteEarningsAll.map(
          (e) => `${e.symbol} - ${e.date}`
        ),
        nonFavoriteEarnings: nonFavoriteEarnings
          .slice(0, 3)
          .map((e) => `${e.symbol} - ${e.date}`),
      });

    // Sort by date (earliest first)
    favoriteEarningsAll.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    nonFavoriteEarnings.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Combine favorites first, then fill with non-favorites, limit to 5
    const prioritizedEarnings = [
      ...favoriteEarningsAll.slice(0, 5), // Take up to 5 favorites first
      ...nonFavoriteEarnings.slice(
        0,
        Math.max(0, 5 - favoriteEarningsAll.length)
      ), // Fill remaining slots
    ].slice(0, 5); // Ensure we never exceed 5 total

    if (__DEV__)
      console.log(
        "🏆 Final prioritized earnings:",
        prioritizedEarnings.map((e) => `${e.symbol} - ${e.date}`)
      );
    setTopEarnings(prioritizedEarnings);

    // Fetch recent actuals for top symbols to show actual vs estimate when available
    try {
      const symbolsForTop = Array.from(
        new Set(prioritizedEarnings.map((e) => e.symbol.toUpperCase()))
      );
      if (symbolsForTop.length > 0) {
        const recent = await fetchRecentEarnings(symbolsForTop, 14);
        setRecentForTop(recent);
      } else {
        setRecentForTop([]);
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch recent earnings for top symbols", e);
      setRecentForTop([]);
    }
  };

  useEffect(() => {
    // Force refresh when component mounts to ensure fresh data
    if (__DEV__) console.log("🚀 Component mounted, forcing refresh...");
    if (isHydrated) {
      forceRefreshEarningsData();
    }
  }, []); // Only run once when component mounts

  useEffect(() => {
    // Force refresh when favorites change to get updated earnings data
    if (__DEV__)
      console.log(
        "⭐ Favorites changed, forcing refresh...",
        profile.favorites
      );
    if (isHydrated && profile.favorites.length > 0) {
      forceRefreshEarningsData();
    }
  }, [JSON.stringify(profile.favorites)]); // Watch favorites array content changes

  useEffect(() => {
    // Filter earnings when cached data changes
    if (__DEV__) console.log("🔄 Data changed, reloading earnings...");
    loadEarnings();
  }, [todaysEarnings, upcomingEarnings, recentEarnings, isHydrated]);

  useEffect(() => {
    // Debug when favoriteEarnings state changes
    if (__DEV__)
      console.log(
        "📊 favoriteEarnings state updated:",
        favoriteEarnings.length,
        favoriteEarnings.map((e) => e.symbol)
      );
  }, [favoriteEarnings]);

  // Add focus effect to refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (__DEV__)
        console.log("🎯 Screen focused, checking if refresh needed...");
      if (isHydrated) {
        if (__DEV__)
          console.log("🎯 Screen focused, forcing refresh for latest data...");
        forceRefreshEarningsData();
      }
    }, [isHydrated, forceRefreshEarningsData])
  );

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

  const isSameDay = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
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
    topEarnings.length === 0 &&
    favoriteEarnings.length === 0 &&
    favoriteRecentEarnings.length === 0
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

  const isFavoriteSymbol = (symbol: string): boolean => {
    return profile.favorites
      .map((s) => s.toUpperCase())
      .includes(symbol.toUpperCase());
  };

  const renderEarningsItem = (item: EarningsCalendarItem, index: number) => {
    const timeInfo = getTimeInfo(item.time);
    const isFav = isFavoriteSymbol(item.symbol);
    const matchFromStore = recentEarnings.find(
      (r) =>
        r.symbol.toUpperCase() === item.symbol.toUpperCase() &&
        isSameDay(r.date, item.date)
    );
    const matchFromLocal = recentForTop.find(
      (r) =>
        r.symbol.toUpperCase() === item.symbol.toUpperCase() &&
        isSameDay(r.date, item.date)
    );
    const matchingRecent = matchFromStore || matchFromLocal;

    return (
      <Pressable
        key={`${item.symbol}-${index}`}
        style={styles.earningsItem}
        onPress={() => handleEarningsPress(item.symbol)}
      >
        <View style={styles.earningsHeader}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <View style={styles.companyRow}>
              <Text style={styles.companyName} numberOfLines={1}>
                {item.companyName}
              </Text>
              {isFav && (
                <Ionicons
                  name="star"
                  size={12}
                  color="#F59E0B"
                  style={styles.favoriteIcon}
                />
              )}
            </View>
          </View>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            <View style={[styles.timeBadge, timeInfo.style]}>
              <Text style={[styles.timeBadgeText, timeInfo.textStyle]}>
                {timeInfo.text}
              </Text>
            </View>
            {matchingRecent &&
              matchingRecent.actualEPS !== undefined &&
              matchingRecent.estimatedEPS !== undefined && (
                <View
                  style={[
                    styles.timeBadge,
                    {
                      backgroundColor:
                        matchingRecent.actualEPS > matchingRecent.estimatedEPS
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeBadgeText,
                      {
                        color:
                          matchingRecent.actualEPS > matchingRecent.estimatedEPS
                            ? "#10B981"
                            : "#EF4444",
                      },
                    ]}
                  >
                    {matchingRecent.actualEPS > matchingRecent.estimatedEPS
                      ? "BEAT"
                      : "MISS"}
                  </Text>
                </View>
              )}
          </View>
        </View>

        {matchingRecent ? (
          <>
            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Actual EPS</Text>
                <Text style={styles.metricValue}>
                  {formatEPS(matchingRecent.actualEPS)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Est. EPS</Text>
                <Text style={styles.metricValue}>
                  {formatEPS(matchingRecent.estimatedEPS)}
                </Text>
              </View>
            </View>
            {!compact && (
              <View style={[styles.metricsContainer, { marginTop: 8 }]}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Actual Revenue</Text>
                  <Text style={styles.metricValue}>
                    {formatCurrency(
                      (matchingRecent as any).actualRevenue ??
                        (matchingRecent as any).revenue,
                      { compact: true }
                    )}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Est. Revenue</Text>
                  <Text style={styles.metricValue}>
                    {formatCurrency((matchingRecent as any).estimatedRevenue, {
                      compact: true,
                    })}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
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
        )}
      </Pressable>
    );
  };

  const renderRecentEarningsItem = (
    item: RecentEarningsItem,
    index: number
  ) => {
    const timeInfo = getTimeInfo(item.time);
    const isFav = isFavoriteSymbol(item.symbol);
    const beatEstimate =
      item.actualEPS && item.estimatedEPS
        ? item.actualEPS > item.estimatedEPS
        : false;
    const missedEstimate =
      item.actualEPS && item.estimatedEPS
        ? item.actualEPS < item.estimatedEPS
        : false;
    const actualRevenue =
      (item as any).actualRevenue !== undefined
        ? (item as any).actualRevenue
        : (item as any).revenue;
    const estimatedRevenue = (item as any).estimatedRevenue;

    return (
      <Pressable
        key={`recent-${item.symbol}-${index}`}
        style={styles.earningsItem}
        onPress={() => handleEarningsPress(item.symbol)}
      >
        <View style={styles.earningsHeader}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <View style={styles.companyRow}>
              <Text style={styles.companyName} numberOfLines={1}>
                {item.companyName}
              </Text>
              {isFav && (
                <Ionicons
                  name="star"
                  size={12}
                  color="#F59E0B"
                  style={styles.favoriteIcon}
                />
              )}
            </View>
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

        <View style={[styles.metricsContainer, { marginTop: 8 }]}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Actual Revenue</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(actualRevenue, { compact: true })}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Est. Revenue</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(estimatedRevenue, { compact: true })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // Debug render data
  if (__DEV__)
    console.log("🎨 Rendering with data:", {
      topEarnings: topEarnings.length,
      favoriteEarnings: favoriteEarnings.length,
      favoriteRecentEarnings: favoriteRecentEarnings.length,
      isLoading,
      isHydrated,
    });

  // Debug specific sections
  if (__DEV__)
    console.log("🎨 Section visibility:", {
      showTopEarnings: topEarnings.length > 0,
      showFavoriteEarnings: favoriteEarnings.length > 0,
      showRecentEarnings: favoriteRecentEarnings.length > 0,
      favoriteEarningsItems: favoriteEarnings.map(
        (e) => `${e.symbol} - ${e.date}`
      ),
    });

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.sectionTitle}
        onPress={() => (navigation as any).navigate("EarningsCalendar")}
      >
        <Text style={styles.title}>Earnings</Text>
        <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ marginTop: 12 }}
      >
        {topEarnings.length > 0 && (
          <View style={styles.earningsContainer}>
            {topEarnings.map((item, index) => renderEarningsItem(item, index))}
          </View>
        )}

        {/* Favorite Stocks Upcoming Earnings (Next 30 Days) */}
        {favoriteEarnings.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderText}>Your Favorites</Text>
            <View style={styles.earningsContainer}>
              {favoriteEarnings.map(
                (item, index) => renderEarningsItem(item, index + 2000) // Use offset to avoid conflicts
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
