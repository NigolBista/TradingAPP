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
import UpcomingEarningsCard from "./UpcomingEarningsCard";
import { useAppDataStore } from "../../store/appDataStore";
import { useTheme } from "../../providers/ThemeProvider";

interface Props {
  onNewsPress?: () => void;
  compact?: boolean;
  onNewsDataFetched?: (news: NewsItem[]) => void; // Callback to share news data with parent
  navigation?: any; // Navigation prop for routing
  fullWidth?: boolean; // New prop for full width display
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    compactContainer: {
      backgroundColor: theme.colors.background,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    refreshButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
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
      padding: 16,
      alignItems: "center",
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontSize: 14,
      lineHeight: 20,
    },
    retryButton: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: "#ffffff",
      fontWeight: "600",
    },
    content: {
      padding: 8,
    },
    compactContent: {
      padding: 8,
    },

    summaryContainer: {
      marginBottom: 16,
      marginHorizontal: 8,
      padding: 12,
      backgroundColor: "transparent",
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    summaryText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    highlightsContainer: {
      marginTop: 12,
      marginBottom: 20,
    },
    highlightsTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 12,
    },
    highlightItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
    },
    highlightBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
      marginTop: 7,
      marginRight: 10,
    },
    highlightText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    sectionContainer: {
      marginBottom: 16,
      marginHorizontal: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
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
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    trendingTicker: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
      marginRight: 4,
    },
    trendingMentions: {
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    eventsContainer: {
      gap: 8,
    },
    eventItem: {
      padding: 12,
      backgroundColor: theme.colors.surface,
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
      color: theme.colors.text,
      marginBottom: 4,
    },
    eventDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    newsSection: {
      marginTop: 8,
    },
    newsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
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
    lastUpdated: {
      textAlign: "center",
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 16,
      fontStyle: "italic",
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
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    fedEventItem: {
      backgroundColor: "transparent",
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
      color: theme.colors.text,
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
      color: theme.colors.textSecondary,
      lineHeight: 16,
      marginBottom: 4,
    },
    fedEventDate: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontStyle: "italic",
    },
    economicIndicatorsContainer: {
      marginTop: 16,
    },
    indicatorsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    indicatorItem: {
      backgroundColor: theme.colors.blueTransparent,
      borderRadius: 8,
      padding: 10,
      minWidth: "48%",
      flex: 1,
    },
    indicatorTitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
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
      color: theme.colors.text,
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

    // Enhanced Market Overview Styles
    enhancedContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 0, // Full width
    },
    marketSentimentCard: {
      backgroundColor: "transparent",
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 0,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sentimentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    sentimentTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sentimentBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
    },
    sentimentBadgeBullish: {
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      borderColor: "#10B981",
      borderWidth: 1,
    },
    sentimentBadgeBearish: {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      borderColor: "#EF4444",
      borderWidth: 1,
    },
    sentimentBadgeNeutral: {
      backgroundColor: "rgba(156, 163, 175, 0.2)",
      borderColor: "#9CA3AF",
      borderWidth: 1,
    },
    sentimentBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      marginLeft: 4,
    },
    sentimentBadgeTextBullish: {
      color: "#10B981",
    },
    sentimentBadgeTextBearish: {
      color: "#EF4444",
    },
    sentimentBadgeTextNeutral: {
      color: "#9CA3AF",
    },
    confidenceBar: {
      height: 4,
      backgroundColor: "#374151",
      borderRadius: 2,
      marginBottom: 12,
    },
    confidenceFill: {
      height: "100%",
      borderRadius: 2,
    },
    confidenceFillBullish: {
      backgroundColor: "#10B981",
    },
    confidenceFillBearish: {
      backgroundColor: "#EF4444",
    },
    confidenceFillNeutral: {
      backgroundColor: "#9CA3AF",
    },
    sentimentFactors: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    sentimentFactor: {
      backgroundColor: "#374151",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    sentimentFactorText: {
      fontSize: 11,
      color: "#D1D5DB",
    },

    dayAheadCard: {
      backgroundColor: "transparent",
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 8,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: "#6366F1",
    },
    dayAheadTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
    },

    enhancedSummaryContainer: {
      marginHorizontal: 8,
      marginBottom: 16,
      padding: 16,
      backgroundColor: "transparent",
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    enhancedSummaryTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
    },
    enhancedSummaryText: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.textSecondary,
    },
  });

export default function MarketOverview({
  onNewsPress,
  compact = false,
  onNewsDataFetched,
  navigation,
  fullWidth = false,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [marketSentiment, setMarketSentiment] = useState<{
    overall: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  } | null>(null);

  // Use centralized store instead of old marketOverviewStore
  const {
    getMarketOverview,
    news: storeRawNews,
    refreshInBackground,
  } = useAppDataStore();

  const loadMarketOverview = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        // Trigger background refresh for fresh data
        refreshInBackground();
      } else {
        setLoading(true);
      }
      setError(null);

      // Get data from centralized store - always available immediately
      const data = getMarketOverview("1D");

      if (data) {
        setOverview(data);

        // Share the news data with parent component
        if (onNewsDataFetched && storeRawNews.length > 0) {
          onNewsDataFetched(storeRawNews);
        }

        // Calculate market sentiment
        await calculateMarketSentiment(storeRawNews, data.trendingStocks);
      } else {
        // Show loading placeholder if no data available yet
        setOverview({
          summary: "Market data loading from live sources...",
          keyHighlights: [
            "Fetching real-time market data",
            "AI analysis in progress",
          ],
          topStories: [],
          trendingStocks: [],
          upcomingEvents: [],
          fedEvents: [],
          economicIndicators: [],
          lastUpdated: new Date().toISOString(),
          marketSentiment: { overall: "neutral", confidence: 50, factors: [] },
        });
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
  }, []); // Load on mount

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Force refresh the global cache first
      await refreshGlobalCache(compact ? 15 : 30, !compact, !compact);
      // Trigger background refresh for fresh data
      refreshInBackground();
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

  // Calculate overall market sentiment based on both news and market performance
  const calculateMarketSentiment = async (
    newsItems: NewsItem[],
    trendingStocks: any[]
  ) => {
    try {
      // Get news sentiment
      const sentiments = newsItems
        .map((item) => item.sentiment)
        .filter((sentiment) => sentiment);

      let newsSentimentScore = 0;
      if (sentiments.length > 0) {
        const positiveCount = sentiments.filter(
          (s) => s && s.toLowerCase() === "positive"
        ).length;
        const negativeCount = sentiments.filter(
          (s) => s && s.toLowerCase() === "negative"
        ).length;

        const totalCount = sentiments.length;
        const positiveRatio = positiveCount / totalCount;
        const negativeRatio = negativeCount / totalCount;

        // Convert to score (-100 to +100)
        newsSentimentScore = (positiveRatio - negativeRatio) * 100;
      }

      // Get market performance sentiment (fetch major indices)
      let marketPerformanceScore = 0;
      try {
        const { fetchYahooCandles } = await import(
          "../../services/marketProviders"
        );
        const indices = ["SPY", "QQQ", "DIA"]; // Major ETFs representing market
        const performances = await Promise.all(
          indices.map(async (symbol) => {
            try {
              const candles = await fetchYahooCandles(symbol, "5d", "1d");
              if (candles.length >= 2) {
                const current = candles[candles.length - 1].close;
                const previous = candles[candles.length - 2].close;
                return ((current - previous) / previous) * 100;
              }
              return 0;
            } catch {
              return 0;
            }
          })
        );

        // Average performance of major indices
        marketPerformanceScore =
          performances.reduce((sum, perf) => sum + perf, 0) /
          performances.length;
        // Scale to -100 to +100 range (assuming ±5% is extreme)
        marketPerformanceScore = Math.max(
          -100,
          Math.min(100, marketPerformanceScore * 20)
        );
      } catch (error) {
        console.log("Could not fetch market performance for sentiment");
      }

      // Combine news sentiment (40%) and market performance (60%)
      const combinedScore =
        newsSentimentScore * 0.4 + marketPerformanceScore * 0.6;

      let overall: "bullish" | "bearish" | "neutral";
      let confidence: number;

      if (combinedScore > 15) {
        overall = "bullish";
        confidence = Math.min(Math.abs(combinedScore), 95);
      } else if (combinedScore < -15) {
        overall = "bearish";
        confidence = Math.min(Math.abs(combinedScore), 95);
      } else {
        overall = "neutral";
        confidence = Math.max(50, 100 - Math.abs(combinedScore));
      }

      const factors = [
        `Market performance: ${
          marketPerformanceScore > 0 ? "+" : ""
        }${marketPerformanceScore.toFixed(1)}%`,
        `News sentiment: ${
          newsSentimentScore > 0 ? "+" : ""
        }${newsSentimentScore.toFixed(1)}%`,
        `${trendingStocks.length} trending stocks`,
      ];

      setMarketSentiment({ overall, confidence, factors });
    } catch (error) {
      console.error("Error calculating market sentiment:", error);
    }
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
    <View
      style={
        compact
          ? styles.compactContainer
          : fullWidth
          ? styles.enhancedContainer
          : styles.container
      }
    >
      <ContentComponent {...contentProps}>
        {/* Enhanced Market Overview Content */}
        {fullWidth && (
          <>
            {/* Market Sentiment Dashboard */}
            {marketSentiment && (
              <View style={styles.marketSentimentCard}>
                <View style={styles.sentimentHeader}>
                  <Text style={styles.sentimentTitle}>Market Sentiment</Text>
                  <View
                    style={[
                      styles.sentimentBadge,
                      marketSentiment.overall === "bullish"
                        ? styles.sentimentBadgeBullish
                        : marketSentiment.overall === "bearish"
                        ? styles.sentimentBadgeBearish
                        : styles.sentimentBadgeNeutral,
                    ]}
                  >
                    <Ionicons
                      name={
                        marketSentiment.overall === "bullish"
                          ? "trending-up"
                          : marketSentiment.overall === "bearish"
                          ? "trending-down"
                          : "remove"
                      }
                      size={18}
                      color={
                        marketSentiment.overall === "bullish"
                          ? "#10B981"
                          : marketSentiment.overall === "bearish"
                          ? "#EF4444"
                          : "#9CA3AF"
                      }
                    />
                    <Text
                      style={[
                        styles.sentimentBadgeText,
                        marketSentiment.overall === "bullish"
                          ? styles.sentimentBadgeTextBullish
                          : marketSentiment.overall === "bearish"
                          ? styles.sentimentBadgeTextBearish
                          : styles.sentimentBadgeTextNeutral,
                      ]}
                    >
                      {marketSentiment?.overall?.toUpperCase() || "NEUTRAL"}
                    </Text>
                  </View>
                </View>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      marketSentiment.overall === "bullish"
                        ? styles.confidenceFillBullish
                        : marketSentiment.overall === "bearish"
                        ? styles.confidenceFillBearish
                        : styles.confidenceFillNeutral,
                      { width: `${marketSentiment?.confidence || 0}%` },
                    ]}
                  />
                </View>
                <Text
                  style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 12 }}
                >
                  Confidence: {Math.round(marketSentiment?.confidence || 0)}%
                </Text>
                <View style={styles.sentimentFactors}>
                  {(marketSentiment?.factors || []).map((factor, index) => (
                    <View key={index} style={styles.sentimentFactor}>
                      <Text style={styles.sentimentFactorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View
          style={
            compact
              ? styles.compactContent
              : fullWidth
              ? { paddingHorizontal: 0 }
              : styles.content
          }
        >
          {/* Key Highlights */}
          <View style={[styles.highlightsContainer]}>
            <Text style={styles.highlightsTitle}>Key Market Highlights</Text>
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
              <Pressable
                style={styles.sectionTitle}
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
                <Text style={styles.sectionTitle}>Federal Reserve</Text>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={theme.colors.text}
                />
              </Pressable>

              {/* Fed Events */}
              {overview.fedEvents.length > 0 && (
                <View style={styles.fedEventsContainer}>
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
                  <Text style={styles.sectionTitle}>Key Economic Data</Text>
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

          <View style={styles.sectionContainer}>
            <UpcomingEarningsCard
              onEarningsPress={(symbol) => {
                if (navigation) {
                  navigation.navigate("StockDetail", { symbol });
                }
              }}
              compact={false}
            />
          </View>

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
          {!compact && overview.upcomingEvents.length > 0 && !fullWidth && (
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
          <View style={styles.newsSection}>
            <Pressable style={styles.newsSectionHeader} onPress={onNewsPress}>
              <Text style={styles.sectionTitle}>Top Stories</Text>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={theme.colors.text}
              />
            </Pressable>
            <NewsList items={overview.topStories} fullScreen={false} />
          </View>

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            🔄 Last updated: {new Date(overview.lastUpdated).toLocaleString()}
          </Text>
        </View>
      </ContentComponent>
    </View>
  );
}
