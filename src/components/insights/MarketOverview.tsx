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
import { useMarketOverviewStore } from "../../store/marketOverviewStore";

interface Props {
  onNewsPress?: () => void;
  compact?: boolean;
  onNewsDataFetched?: (news: NewsItem[]) => void; // Callback to share news data with parent
  navigation?: any; // Navigation prop for routing
  fullWidth?: boolean; // New prop for full width display
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

  // Enhanced Market Overview Styles
  enhancedContainer: {
    flex: 1,
    backgroundColor: "#0A0F1C",
    paddingHorizontal: 0, // Full width
  },
  marketSentimentCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#374151",
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
    color: "#ffffff",
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
  newsHighlightsCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  newsHighlightsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  newsHighlightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingVertical: 8,
  },
  newsHighlightBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginTop: 6,
    marginRight: 12,
  },
  newsHighlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#E5E7EB",
  },
  dayAheadCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  dayAheadTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  timeframeBriefing: {
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timeframeBriefingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  timeframeBriefingText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#D1D5DB",
  },
  enhancedSummaryContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  enhancedSummaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 12,
  },
  enhancedSummaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#E5E7EB",
  },
});

export default function MarketOverview({
  onNewsPress,
  compact = false,
  onNewsDataFetched,
  navigation,
  fullWidth = false,
}: Props) {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeType>("1D");
  const [newsHighlights, setNewsHighlights] = useState<string[]>([]);
  const [marketSentiment, setMarketSentiment] = useState<{
    overall: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  } | null>(null);

  const ensureOverview = useMarketOverviewStore((s) => s.ensureOverview);
  const storeRawNews = useMarketOverviewStore((s) => s.rawNews);

  const loadMarketOverview = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Use shared store to avoid duplicate API calls across screens
      const data = await ensureOverview(timeframe, {
        force: false,
        analysisDepth: compact ? "brief" : "detailed",
      });

      setOverview(data);

      // Share the news data with parent component to avoid duplicate API calls
      if (onNewsDataFetched && storeRawNews.length > 0) {
        onNewsDataFetched(storeRawNews);
      }

      // Extract news highlights and market sentiment
      await extractNewsHighlights(storeRawNews);
      await calculateMarketSentiment(storeRawNews, data.trendingStocks);
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
      // Then reload the overview with fresh data (force store to refetch)
      await ensureOverview(timeframe, {
        force: true,
        analysisDepth: compact ? "brief" : "detailed",
      });
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

  // Extract key highlights from news using AI
  const extractNewsHighlights = async (newsItems: NewsItem[]) => {
    try {
      if (newsItems.length === 0) return;

      // Take top 10 most recent news items
      const topNews = newsItems.slice(0, 10);
      const newsText = topNews
        .map((item) => `${item.title}: ${item.summary || ""}`)
        .join("\n");

      // For now, extract highlights from existing key highlights
      // In a full implementation, this would use AI to extract key points
      const highlights = topNews
        .filter((item) => item.title && item.title.length > 20)
        .slice(0, 5)
        .map((item) => item.title);

      setNewsHighlights(highlights);
    } catch (error) {
      console.error("Error extracting news highlights:", error);
    }
  };

  // Calculate overall market sentiment
  const calculateMarketSentiment = async (
    newsItems: NewsItem[],
    trendingStocks: any[]
  ) => {
    try {
      const sentiments = newsItems
        .map((item) => item.sentiment)
        .filter((sentiment) => sentiment);

      if (sentiments.length === 0) return;

      const positiveCount = sentiments.filter(
        (s) => s && s.toLowerCase() === "positive"
      ).length;
      const negativeCount = sentiments.filter(
        (s) => s && s.toLowerCase() === "negative"
      ).length;
      const neutralCount = sentiments.length - positiveCount - negativeCount;

      const totalCount = sentiments.length;
      const positiveRatio = positiveCount / totalCount;
      const negativeRatio = negativeCount / totalCount;

      let overall: "bullish" | "bearish" | "neutral";
      let confidence: number;

      if (positiveRatio > 0.6) {
        overall = "bullish";
        confidence = Math.min(positiveRatio * 100, 95);
      } else if (negativeRatio > 0.6) {
        overall = "bearish";
        confidence = Math.min(negativeRatio * 100, 95);
      } else {
        overall = "neutral";
        confidence = Math.max(60, Math.max(positiveRatio, negativeRatio) * 100);
      }

      const factors = [
        `${positiveCount} positive signals`,
        `${negativeCount} negative signals`,
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
                      size={14}
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
                      {marketSentiment.overall.toUpperCase()}
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
                      { width: `${marketSentiment.confidence}%` },
                    ]}
                  />
                </View>
                <Text
                  style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 12 }}
                >
                  Confidence: {Math.round(marketSentiment.confidence)}%
                </Text>
                <View style={styles.sentimentFactors}>
                  {marketSentiment.factors.map((factor, index) => (
                    <View key={index} style={styles.sentimentFactor}>
                      <Text style={styles.sentimentFactorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* News Highlights */}
            {newsHighlights.length > 0 && (
              <View style={styles.newsHighlightsCard}>
                <Text style={styles.newsHighlightsTitle}>
                  <Ionicons
                    name="flash"
                    size={18}
                    color="#F59E0B"
                    style={{ marginRight: 8 }}
                  />
                  Breaking News Highlights
                </Text>
                {newsHighlights.map((highlight, index) => (
                  <View key={index} style={styles.newsHighlightItem}>
                    <View style={styles.newsHighlightBullet} />
                    <Text style={styles.newsHighlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View
          style={[
            compact ? styles.compactContent : styles.content,
            fullWidth ? { paddingHorizontal: 0 } : styles.fullWidthContainer,
          ]}
        >
          {/* Timeframe Selector */}
          <View
            style={[
              styles.timeframeContainer,
              fullWidth && { marginHorizontal: 16 },
            ]}
          >
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

        <View
          style={
            compact
              ? styles.compactContent
              : fullWidth
              ? { paddingHorizontal: 0 }
              : styles.content
          }
        >
          {/* Enhanced AI Summary */}
          <View
            style={
              fullWidth
                ? styles.enhancedSummaryContainer
                : styles.summaryContainer
            }
          >
            <Text
              style={
                fullWidth ? styles.enhancedSummaryTitle : styles.summaryTitle
              }
            >
              {timeframe === "1D"
                ? "📊 Today's Market Brief"
                : timeframe === "1W"
                ? "📈 This Week's Market Outlook"
                : "📅 Monthly Market Trends"}
            </Text>
            <Text
              style={
                fullWidth ? styles.enhancedSummaryText : styles.summaryText
              }
            >
              {overview.summary}
            </Text>
          </View>

          {/* Day Ahead Briefing - Enhanced for full width */}
          {fullWidth && (
            <View style={styles.dayAheadCard}>
              <Text style={styles.dayAheadTitle}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#6366F1"
                  style={{ marginRight: 8 }}
                />
                Day Ahead Briefing
              </Text>

              {/* Timeframe-specific briefings */}
              <View style={styles.timeframeBriefing}>
                <Text style={styles.timeframeBriefingTitle}>
                  {timeframe === "1D"
                    ? "🌅 Today's Focus"
                    : timeframe === "1W"
                    ? "📅 This Week's Key Events"
                    : "🗓️ Monthly Outlook"}
                </Text>
                <Text style={styles.timeframeBriefingText}>
                  {timeframe === "1D"
                    ? "Key market movers, earnings releases, and economic data to watch today. Stay alert for Fed communications and sector rotation signals."
                    : timeframe === "1W"
                    ? "Major earnings reports, FOMC meetings, economic indicators, and technical levels to monitor this week. Watch for trend confirmations."
                    : "Long-term market themes, policy changes, and seasonal patterns. Focus on major economic cycles and structural market shifts."}
                </Text>
              </View>

              {overview.upcomingEvents.length > 0 && (
                <View>
                  <Text style={styles.timeframeBriefingTitle}>
                    ⚡ Key Events Coming Up
                  </Text>
                  {overview.upcomingEvents.slice(0, 3).map((event, index) => (
                    <View key={index} style={{ marginBottom: 8 }}>
                      <Text
                        style={{
                          color: "#E5E7EB",
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        • {event.title}
                      </Text>
                      <Text
                        style={{
                          color: "#9CA3AF",
                          fontSize: 12,
                          marginLeft: 12,
                        }}
                      >
                        {event.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Key Highlights */}
          <View
            style={[
              styles.highlightsContainer,
              fullWidth && { marginHorizontal: 16 },
            ]}
          >
            <Text style={styles.highlightsTitle}>🎯 Key Market Highlights</Text>
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
            <View
              style={[
                styles.sectionContainer,
                fullWidth && { marginHorizontal: 16 },
              ]}
            >
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
            <View
              style={[
                styles.sectionContainer,
                fullWidth && { marginHorizontal: 16 },
              ]}
            >
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
            <View
              style={[
                styles.sectionContainer,
                fullWidth && { marginHorizontal: 16 },
              ]}
            >
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
            <View
              style={[
                styles.newsSection,
                fullWidth && { marginHorizontal: 16 },
              ]}
            >
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
          <Text
            style={[styles.lastUpdated, fullWidth && { marginHorizontal: 16 }]}
          >
            🔄 Last updated: {new Date(overview.lastUpdated).toLocaleString()}
          </Text>
        </View>
      </ContentComponent>
    </View>
  );
}
