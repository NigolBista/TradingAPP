import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../providers/ThemeProvider";
import { useUserStore } from "../store/userStore";
import { useEarningsStore } from "../store/earningsStore";
import {
  fetchUpcomingEarnings,
  fetchRecentEarnings,
  fetchWeeklyEarnings,
  EarningsCalendarItem,
  RecentEarningsItem,
  formatEPS,
  formatCurrency,
  formatEarningsTime,
  calculateEPSSurprise,
} from "../services/earningsData";

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      backgroundColor: "#1a1a1a",
      borderBottomWidth: 1,
      borderBottomColor: "#2a2a2a",
    },
    backButton: {
      padding: 8,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "700",
    },
    headerSubtitle: {
      color: "#9CA3AF",
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    filterButton: {
      padding: 8,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      paddingVertical: 12,
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      borderRadius: 8,
      padding: 4,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 6,
    },
    activeTab: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    activeTabText: {
      color: "#ffffff",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      marginTop: 12,
      fontSize: 14,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    retryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: "#ffffff",
      fontWeight: "600",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionIcon: {
      marginRight: 8,
    },
    sectionHeaderText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: 8,
    },
    earningsItem: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
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
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    companyName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    dateTimeContainer: {
      alignItems: "flex-end",
    },
    date: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    time: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    timeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
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
      fontSize: 10,
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
      gap: 16,
    },
    metricItem: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    surpriseValue: {
      fontSize: 13,
      fontWeight: "600",
    },
    surprisePositive: {
      color: "#10B981",
    },
    surpriseNegative: {
      color: "#EF4444",
    },
    performanceIndicator: {
      width: 4,
      height: "100%",
      position: "absolute",
      left: 0,
      top: 0,
    },
    performanceIndicatorBeat: {
      backgroundColor: "#10B981",
    },
    performanceIndicatorMissed: {
      backgroundColor: "#EF4444",
    },
    performanceIndicatorNeutral: {
      backgroundColor: "#6B7280",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
    },
  });

export default function EarningsCalendarScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { profile } = useUserStore();

  // Use earnings store
  const {
    weeklyEarnings,
    upcomingEarnings,
    recentEarnings,
    isLoading,
    error,
    refreshEarningsData,
  } = useEarningsStore();

  const [activeTab, setActiveTab] = useState<"weekly" | "upcoming" | "recent">(
    "weekly"
  );
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        await refreshEarningsData();
      }
      // Data is now available from the store
    } catch (err) {
      console.error("Failed to refresh earnings data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleEarningsPress = (symbol: string) => {
    (navigation as any).navigate("StockDetail", { symbol });
  };

  const filterEarnings = <T extends { symbol: string; companyName?: string }>(
    earnings: T[]
  ): T[] => {
    if (!searchQuery.trim()) return earnings;

    const query = searchQuery.toLowerCase();
    return earnings.filter(
      (item) =>
        item.symbol.toLowerCase().includes(query) ||
        item.companyName?.toLowerCase().includes(query)
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
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

  const groupEarningsByDate = (earnings: EarningsCalendarItem[]) => {
    const groups: { [key: string]: EarningsCalendarItem[] } = {};

    earnings.forEach((item) => {
      const date = new Date(item.date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });

    return Object.entries(groups).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
    );
  };

  const renderWeeklyEarnings = () => {
    const filteredEarnings = filterEarnings(weeklyEarnings);

    if (filteredEarnings.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "No earnings found matching your search"
              : "No earnings scheduled for this week"}
          </Text>
        </View>
      );
    }

    const groupedEarnings = groupEarningsByDate(filteredEarnings);

    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {groupedEarnings.map(([date, items]) => {
          const dateObj = new Date(date);
          const isToday = dateObj.toDateString() === new Date().toDateString();
          const dayName = dateObj.toLocaleDateString("en-US", {
            weekday: "long",
          });

          return (
            <View key={date}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={isToday ? "today" : "calendar-outline"}
                  size={16}
                  color={isToday ? "#10B981" : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.sectionHeaderText,
                    isToday && { color: "#10B981" },
                  ]}
                >
                  {isToday
                    ? `Today - ${dayName}`
                    : `${dayName} - ${formatDate(date)}`}
                </Text>
              </View>
              {items.map((item, index) => {
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
                        <Text style={styles.time}>
                          {formatEarningsTime(item.time)}
                        </Text>
                        <View style={[styles.timeBadge, timeInfo.style]}>
                          <Text
                            style={[styles.timeBadgeText, timeInfo.textStyle]}
                          >
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
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Est. Revenue</Text>
                        <Text style={styles.metricValue}>
                          {formatCurrency(item.estimatedRevenue, {
                            compact: true,
                          })}
                        </Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Quarter</Text>
                        <Text style={styles.metricValue}>
                          {item.fiscalQuarter || "N/A"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderUpcomingEarnings = () => {
    const filteredEarnings = filterEarnings(upcomingEarnings);

    const favoriteSymbolsSet = new Set<string>(
      (profile?.favorites || []).map((s) => s.toUpperCase())
    );
    const favoriteUpcoming = filteredEarnings.filter((item) =>
      favoriteSymbolsSet.has(item.symbol.toUpperCase())
    );
    const nonFavoriteUpcoming = filteredEarnings.filter(
      (item) => !favoriteSymbolsSet.has(item.symbol.toUpperCase())
    );

    if (filteredEarnings.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "No earnings found matching your search"
              : "No upcoming earnings found"}
          </Text>
        </View>
      );
    }

    const groupedEarnings = groupEarningsByDate(nonFavoriteUpcoming);

    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Favorites Section (deduped from main list) */}
        {favoriteUpcoming.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="star"
                size={16}
                color={theme.colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionHeaderText}>Favorites</Text>
            </View>
            {favoriteUpcoming.map((item, index) => {
              const timeInfo = getTimeInfo(item.time);

              return (
                <Pressable
                  key={`fav-${item.symbol}-${index}`}
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
                      <Text style={styles.time}>
                        {formatEarningsTime(item.time)}
                      </Text>
                      <View style={[styles.timeBadge, timeInfo.style]}>
                        <Text
                          style={[styles.timeBadgeText, timeInfo.textStyle]}
                        >
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
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Est. Revenue</Text>
                      <Text style={styles.metricValue}>
                        {formatCurrency(item.estimatedRevenue, {
                          compact: true,
                        })}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Quarter</Text>
                      <Text style={styles.metricValue}>
                        {item.fiscalQuarter || "N/A"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {groupedEarnings.map(([date, items]) => (
          <View key={date}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionHeaderText}>{formatDate(date)}</Text>
            </View>
            {items.map((item, index) => {
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
                      <Text style={styles.time}>
                        {formatEarningsTime(item.time)}
                      </Text>
                      <View style={[styles.timeBadge, timeInfo.style]}>
                        <Text
                          style={[styles.timeBadgeText, timeInfo.textStyle]}
                        >
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
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Est. Revenue</Text>
                      <Text style={styles.metricValue}>
                        {formatCurrency(item.estimatedRevenue, {
                          compact: true,
                        })}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Quarter</Text>
                      <Text style={styles.metricValue}>
                        {item.fiscalQuarter || "N/A"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderRecentEarnings = () => {
    const filteredEarnings = filterEarnings(recentEarnings);

    if (filteredEarnings.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "No earnings found matching your search"
              : "No recent earnings found"}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredEarnings.map((item, index) => {
          const surprise = calculateEPSSurprise(
            item.actualEPS,
            item.estimatedEPS
          );
          const performanceStyle = item.beatEstimate
            ? styles.performanceIndicatorBeat
            : item.missedEstimate
            ? styles.performanceIndicatorMissed
            : styles.performanceIndicatorNeutral;

          return (
            <Pressable
              key={`${item.symbol}-${index}`}
              style={styles.earningsItem}
              onPress={() => handleEarningsPress(item.symbol)}
            >
              <View style={[styles.performanceIndicator, performanceStyle]} />

              <View style={styles.earningsHeader}>
                <View style={styles.symbolContainer}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                </View>
                <View style={styles.dateTimeContainer}>
                  <Text style={styles.date}>{formatDate(item.date)}</Text>
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
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Revenue</Text>
                  <Text style={styles.metricValue}>
                    {formatCurrency(item.actualRevenue, { compact: true })}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Earnings Calendar</Text>
            <Text style={styles.headerSubtitle}>Recent & Upcoming Reports</Text>
          </View>
          <View style={styles.filterButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading earnings data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Earnings Calendar</Text>
            <Text style={styles.headerSubtitle}>Recent & Upcoming Reports</Text>
          </View>
          <View style={styles.filterButton} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => loadData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Earnings Calendar</Text>
          <Text style={styles.headerSubtitle}>Recent & Upcoming Reports</Text>
        </View>
        <View style={styles.filterButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={16}
          color={theme.colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by symbol or company..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "weekly" && styles.activeTab]}
          onPress={() => setActiveTab("weekly")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "weekly" && styles.activeTabText,
            ]}
          >
            This Week
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "upcoming" && styles.activeTab]}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.activeTabText,
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "recent" && styles.activeTab]}
          onPress={() => setActiveTab("recent")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "recent" && styles.activeTabText,
            ]}
          >
            Recent
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === "weekly"
        ? renderWeeklyEarnings()
        : activeTab === "upcoming"
        ? renderUpcomingEarnings()
        : renderRecentEarnings()}
    </SafeAreaView>
  );
}
