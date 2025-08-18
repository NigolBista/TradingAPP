import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  generateMarketOverview,
  generateMarketOverviewWithData,
  type MarketOverview,
} from "../../services/marketOverview";
import { refreshGlobalCache } from "../../services/marketDataCache";
import type { NewsItem } from "../../services/newsProviders";
import NewsList from "./NewsList";

interface Props {
  onNewsPress?: () => void;
  compact?: boolean;
  onNewsDataFetched?: (news: NewsItem[]) => void; // Callback to share news data with parent
  navigation?: any; // Navigation prop for routing
}

type TimeframeType = "1D" | "1W" | "1M";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1C",
  },
  compactContainer: {
    backgroundColor: "#0A0F1C",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#1F2937",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  compactContent: {
    padding: 12,
  },

  summaryContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#D1D5DB",
  },
  highlightsContainer: {
    marginBottom: 20,
  },
  highlightsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1F2937",
    borderRadius: 8,
  },
  highlightBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4F46E5",
    marginTop: 7,
    marginRight: 10,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#D1D5DB",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  trendingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trendingStock: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  trendingTicker: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    marginRight: 4,
  },
  trendingMentions: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  eventsContainer: {
    gap: 8,
  },
  eventItem: {
    padding: 12,
    backgroundColor: "#1F2937",
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  eventHigh: {
    borderLeftColor: "#EF4444",
  },
  eventMedium: {
    borderLeftColor: "#F59E0B",
  },
  eventLow: {
    borderLeftColor: "#10B981",
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
  },
  newsSection: {
    marginTop: 8,
  },
  newsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#4F46E5",
    borderRadius: 6,
  },
  viewAllText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  lastUpdated: {
    textAlign: "center",
    fontSize: 11,
    color: "#6B7280",
    marginTop: 16,
    fontStyle: "italic",
  },

  // Timeframe selector styles
  timeframeContainer: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  timeframeButtonActive: {
    backgroundColor: "#4F46E5",
  },
  timeframeButtonInactive: {
    backgroundColor: "transparent",
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  timeframeTextActive: {
    color: "#ffffff",
  },
  timeframeTextInactive: {
    color: "#9CA3AF",
  },

  // Full width container
  fullWidthContainer: {
    marginHorizontal: -16, // Negative margin to span full width
  },

  // Federal Reserve styles
  fedEventsContainer: {
    marginTop: 12,
  },
  fedSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  fedEventItem: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
  },
  fedEventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  fedEventTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
    marginRight: 8,
  },
  fedEventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fedEventHighImpact: {
    backgroundColor: "#DC2626",
  },
  fedEventMediumImpact: {
    backgroundColor: "#F59E0B",
  },
  fedEventBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  fedEventDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
    marginBottom: 4,
  },
  fedEventDate: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
  },
  economicIndicatorsContainer: {
    marginTop: 16,
  },
  indicatorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  indicatorItem: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 10,
    minWidth: "48%",
    flex: 1,
  },
  indicatorTitle: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  indicatorValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  indicatorValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  indicatorChange: {
    fontSize: 12,
    fontWeight: "500",
  },
  indicatorPositive: {
    color: "#10B981",
  },
  indicatorNegative: {
    color: "#EF4444",
  },
});

export default function MarketOverview({
  onNewsPress,
  compact = false,
  onNewsDataFetched,
  navigation,
}: Props) {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeType>("1D");

  const loadMarketOverview = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Use the optimized function that returns both overview and raw data
      const { overview: data, rawData } = await generateMarketOverviewWithData({
        newsCount: compact ? 15 : 30,
        analysisDepth: compact ? "brief" : "detailed",
        includeTrending: !compact,
        includeEvents: !compact,
        timeframe: timeframe,
      });

      setOverview(data);

      // Share the news data with parent component to avoid duplicate API calls
      if (onNewsDataFetched && rawData.news.length > 0) {
        onNewsDataFetched(rawData.news);
      }
    } catch (err) {
      console.error("Market Overview Error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load market overview"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarketOverview();
  }, [timeframe]); // Reload when timeframe changes

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Force refresh the global cache first
      await refreshGlobalCache(compact ? 15 : 30, !compact, !compact);
      // Then reload the overview with fresh data
      await loadMarketOverview(true);
    } catch (err) {
      console.error("Refresh Error:", err);
      // Fallback to regular load
      loadMarketOverview(true);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadMarketOverview();
  };

  if (loading && !overview) {
    return (
      <View style={compact ? styles.compactContainer : styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Analyzing market conditions...</Text>
        </View>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={compact ? styles.compactContainer : styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!overview) return null;

  const ContentComponent = compact ? View : ScrollView;
  const contentProps = compact
    ? {}
    : {
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4F46E5"
            colors={["#4F46E5"]}
          />
        ),
      };

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      {!compact && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Market Overview</Text>
            <Text style={styles.headerSubtitle}>
              AI-powered market analysis
            </Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons
              name={refreshing ? "hourglass" : "refresh"}
              size={20}
              color="#9CA3AF"
            />
          </Pressable>
        </View>
      )}

      <ContentComponent {...contentProps}>
        <View
          style={[
            compact ? styles.compactContent : styles.content,
            styles.fullWidthContainer,
          ]}
        >
          {/* Timeframe Selector */}
          <View style={styles.timeframeContainer}>
            {(["1D", "1W", "1M"] as TimeframeType[]).map((tf) => (
              <Pressable
                key={tf}
                style={[
                  styles.timeframeButton,
                  timeframe === tf
                    ? styles.timeframeButtonActive
                    : styles.timeframeButtonInactive,
                ]}
                onPress={() => setTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    timeframe === tf
                      ? styles.timeframeTextActive
                      : styles.timeframeTextInactive,
                  ]}
                >
                  {tf}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={compact ? styles.compactContent : styles.content}>
          {/* AI Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>
              {timeframe === "1D"
                ? "Today's Market Brief"
                : timeframe === "1W"
                ? "This Week's Market Outlook"
                : "Monthly Market Trends"}
            </Text>
            <Text style={styles.summaryText}>{overview.summary}</Text>
          </View>

          {/* Key Highlights */}
          <View style={styles.highlightsContainer}>
            <Text style={styles.highlightsTitle}>Key Highlights</Text>
            {overview.keyHighlights.map((highlight, index) => (
              <View key={index} style={styles.highlightItem}>
                <View style={styles.highlightBullet} />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>

          {/* Federal Reserve Section */}
          {(overview.fedEvents.length > 0 ||
            overview.economicIndicators.length > 0) && (
            <View style={styles.sectionContainer}>
              <View style={styles.newsSectionHeader}>
                <Text style={styles.sectionTitle}>
                  <Ionicons
                    name="business"
                    size={16}
                    color="#DC2626"
                    style={styles.sectionIcon}
                  />
                  Federal Reserve
                </Text>
                {!compact && (
                  <Pressable
                    style={styles.viewAllButton}
                    onPress={() => {
                      if (navigation) {
                        navigation.navigate("FederalReserve");
                      } else {
                        console.log(
                          "Navigation not available for Federal Reserve page"
                        );
                      }
                    }}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                )}
              </View>

              {/* Fed Events */}
              {overview.fedEvents.length > 0 && (
                <View style={styles.fedEventsContainer}>
                  <Text style={styles.fedSubtitle}>
                    {compact ? "Key Events" : "Upcoming Events"}
                  </Text>
                  {overview.fedEvents
                    .slice(0, compact ? 2 : 3)
                    .map((event, index) => (
                      <View key={index} style={styles.fedEventItem}>
                        <View style={styles.fedEventHeader}>
                          <Text style={styles.fedEventTitle}>
                            {event.title}
                          </Text>
                          <View
                            style={[
                              styles.fedEventBadge,
                              event.impact === "high"
                                ? styles.fedEventHighImpact
                                : styles.fedEventMediumImpact,
                            ]}
                          >
                            <Text style={styles.fedEventBadgeText}>
                              {event.impact.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.fedEventDescription}>
                          {event.description}
                        </Text>
                        <Text style={styles.fedEventDate}>
                          {new Date(event.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    ))}
                </View>
              )}

              {/* Economic Indicators */}
              {!compact && overview.economicIndicators.length > 0 && (
                <View style={styles.economicIndicatorsContainer}>
                  <Text style={styles.fedSubtitle}>Key Economic Data</Text>
                  <View style={styles.indicatorsGrid}>
                    {overview.economicIndicators.map((indicator, index) => (
                      <View key={index} style={styles.indicatorItem}>
                        <Text style={styles.indicatorTitle}>
                          {indicator.title}
                        </Text>
                        <View style={styles.indicatorValueRow}>
                          <Text style={styles.indicatorValue}>
                            {indicator.value}
                            {indicator.unit}
                          </Text>
                          {indicator.changePercent && (
                            <Text
                              style={[
                                styles.indicatorChange,
                                indicator.changePercent > 0
                                  ? styles.indicatorPositive
                                  : styles.indicatorNegative,
                              ]}
                            >
                              {indicator.changePercent > 0 ? "+" : ""}
                              {indicator.changePercent.toFixed(1)}%
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Trending Stocks */}
          {!compact && overview.trendingStocks.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons
                  name="flame"
                  size={16}
                  color="#F59E0B"
                  style={styles.sectionIcon}
                />
                Trending Stocks
              </Text>
              <View style={styles.trendingContainer}>
                {overview.trendingStocks.slice(0, 8).map((stock, index) => (
                  <View key={index} style={styles.trendingStock}>
                    <Text style={styles.trendingTicker}>{stock.ticker}</Text>
                    <Text style={styles.trendingMentions}>
                      {stock.mentions} mentions
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Upcoming Events */}
          {!compact && overview.upcomingEvents.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color="#4F46E5"
                  style={styles.sectionIcon}
                />
                Upcoming Events
              </Text>
              <View style={styles.eventsContainer}>
                {overview.upcomingEvents.slice(0, 3).map((event, index) => (
                  <View
                    key={index}
                    style={[
                      styles.eventItem,
                      event.impact === "High"
                        ? styles.eventHigh
                        : event.impact === "Medium"
                        ? styles.eventMedium
                        : styles.eventLow,
                    ]}
                  >
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDescription}>
                      {event.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Top Stories - Only show in full mode, not compact */}
          {!compact && (
            <View style={styles.newsSection}>
              <View style={styles.newsSectionHeader}>
                <Text style={styles.sectionTitle}>
                  <Ionicons
                    name="newspaper"
                    size={16}
                    color="#10B981"
                    style={styles.sectionIcon}
                  />
                  Top Market Stories
                </Text>
                {onNewsPress && (
                  <Pressable style={styles.viewAllButton} onPress={onNewsPress}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </Pressable>
                )}
              </View>
              <NewsList items={overview.topStories} fullScreen={false} />
            </View>
          )}

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            Last updated: {new Date(overview.lastUpdated).toLocaleString()}
          </Text>
        </View>
      </ContentComponent>
    </View>
  );
}
