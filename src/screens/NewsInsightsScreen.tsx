import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Linking,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchNews,
  fetchGeneralMarketNews,
  fetchStockNewsApi,
  fetchTrendingStocks,
  type NewsItem,
  type TrendingStock,
} from "../services/newsProviders";
// Removed sentiment analysis - we get sentiment from Stock News API directly
import { useUserStore } from "../store/userStore";
import { useNavigation } from "@react-navigation/native";
import { useMarketData } from "../hooks/useMarketData";
import { getAllCachedData } from "../services/marketDataCache";
import NewsList from "../components/insights/NewsList";
import { useTheme } from "../providers/ThemeProvider";

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerContent: {
      alignItems: "flex-start",
    },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.text },
    headerSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginTop: 16, // Add proper top margin for spacing between header and tabs
      marginBottom: 16, // Add proper bottom margin for spacing
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: "center",
    },
    tabActive: { backgroundColor: theme.colors.primary },
    tabInactive: { backgroundColor: "transparent" },
    tabText: { fontSize: 14, fontWeight: "600" },
    tabTextActive: { color: theme.isDark ? "#ffffff" : "#000000" },
    tabTextInactive: { color: theme.colors.textSecondary },
    section: {
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 12,
    },
    newsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    newsTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    newsSource: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    newsSummary: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },

    economicEvent: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    eventTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      minWidth: 60,
    },
    eventText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
      marginLeft: 12,
    },
    eventImpact: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    eventImpactText: { fontSize: 10, fontWeight: "600" },
    keywordChip: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginRight: 6,
      marginBottom: 6,
    },
    keywordText: { fontSize: 12, color: theme.colors.text },
    trendingContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 12,
    },
    trendingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      minWidth: 120,
      alignItems: "center",
    },
    trendingTicker: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 4,
    },
    trendingMentions: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
  });

const ECONOMIC_EVENTS = [
  { time: "8:30 AM", event: "Jobless Claims", impact: "Medium" },
  { time: "10:00 AM", event: "ISM Services PMI", impact: "High" },
  { time: "2:00 PM", event: "Fed Chair Speech", impact: "High" },
  { time: "4:00 PM", event: "Treasury Auction", impact: "Low" },
  { time: "After Close", event: "NVDA Earnings", impact: "High" },
];

export default function NewsInsightsScreen() {
  const { theme } = useTheme();
  const { profile } = useUserStore();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    news: cachedNews,
    trendingStocks: cachedTrending,
    isValid: cacheValid,
    refreshData,
  } = useMarketData();

  const styles = createStyles(theme);

  const [activeTab, setActiveTab] = useState<"news" | "calendar">("news");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  // Removed sentiment state - using Stock News API sentiment directly

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Check if we have valid cached data from global cache
      let generalNews: NewsItem[] = [];
      const globalCacheData = getAllCachedData();

      if (globalCacheData.isValid && globalCacheData.news.length > 0) {
        console.log("📦 NewsInsights using global cached data", {
          newsCount: globalCacheData.news.length,
          cacheAge:
            Math.round((Date.now() - globalCacheData.lastUpdate) / 1000) + "s",
        });
        generalNews = globalCacheData.news;
        setMarketNews(generalNews);
      } else {
        console.log("🔄 NewsInsights fetching fresh data - no valid cache");
        // Load general market news with enhanced Stock News API
        try {
          generalNews = await fetchGeneralMarketNews(30);
        } catch (stockNewsError) {
          console.log(
            "Stock News API failed for market news, falling back:",
            stockNewsError
          );
          // Fallback to default provider
          generalNews = await fetchNews("market");
        }
        setMarketNews(generalNews);
      }

      // Load watchlist-specific news with enhanced features
      const watchlistSymbols = profile.watchlist || ["AAPL", "MSFT", "GOOGL"];
      const watchlistNewsPromises = watchlistSymbols
        .slice(0, 5)
        .map(async (symbol) => {
          try {
            // Try Stock News API first for enhanced features
            return await fetchStockNewsApi(symbol, 5);
          } catch {
            // Fallback to default provider
            return await fetchNews(symbol).catch(() => []);
          }
        });
      const allWatchlistNews = await Promise.all(watchlistNewsPromises);
      const flatWatchlistNews = allWatchlistNews.flat().slice(0, 20);
      setWatchlistNews(flatWatchlistNews);

      // Use cached trending stocks if available
      if (
        globalCacheData.isValid &&
        globalCacheData.trendingStocks.length > 0
      ) {
        console.log("📦 NewsInsights using cached trending stocks");
        setTrendingStocks(globalCacheData.trendingStocks.slice(0, 10));
      } else {
        console.log("🔄 NewsInsights fetching fresh trending stocks");
        // Load trending stocks
        try {
          const trending = await fetchTrendingStocks(7);
          setTrendingStocks(trending.slice(0, 10));
        } catch (trendingError) {
          console.log("Failed to fetch trending stocks:", trendingError);
          setTrendingStocks([]);
        }
      }

      // Sentiment analysis removed - using Stock News API sentiment directly from news items
    } catch (error) {
      console.error("Error loading news:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      // Force refresh the cache first to get fresh data
      await refreshData(30, true, true);
    } catch (error) {
      console.log("Cache refresh failed, continuing with regular load:", error);
    }
    await loadData();
  }

  function getEventImpactColor(impact: string) {
    switch (impact.toLowerCase()) {
      case "high":
        return "#FF5722";
      case "medium":
        return "#FFB020";
      default:
        return "#888888";
    }
  }

  function renderNewsItem(item: NewsItem, index: number) {
    return (
      <Pressable
        key={item.id || index}
        style={styles.newsCard}
        onPress={() => Linking.openURL(item.url)}
      >
        <Text style={styles.newsTitle}>{item.title}</Text>
        <Text style={styles.newsSource}>
          {item.source} •{" "}
          {item.publishedAt
            ? new Date(item.publishedAt).toLocaleTimeString()
            : "Recent"}
        </Text>
        {item.summary && <Text style={styles.newsSummary}>{item.summary}</Text>}
        {/* Sentiment display removed - using Stock News API sentiment directly in NewsList component */}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>News & Insights</Text>
            <Text style={styles.headerSubtitle}>
              Market news with AI sentiment analysis
            </Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "news" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("news")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "news"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Market News
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "calendar" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("calendar")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "calendar"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Calendar
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 0 }} // Remove top padding to eliminate gap
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {activeTab === "news" && (
          <>
            {/* Market News */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Market News</Text>
            </View>
            <NewsList items={marketNews.slice(0, 10)} fullScreen={true} />

            {/* Trending Stocks */}
            {trendingStocks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  📈 Trending Stocks (7 days)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.trendingContainer}>
                    {trendingStocks.map((stock, index) => (
                      <View key={index} style={styles.trendingCard}>
                        <Text style={styles.trendingTicker}>
                          {stock.ticker}
                        </Text>
                        <Text style={styles.trendingMentions}>
                          {stock.mentions} mentions
                        </Text>
                        {/* Sentiment display removed - using Stock News API sentiment directly */}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Watchlist News */}
            {watchlistNews.length > 0 && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Watchlist News</Text>
                </View>
                <NewsList items={watchlistNews.slice(0, 8)} fullScreen={true} />
              </>
            )}
          </>
        )}

        {activeTab === "calendar" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Economic Calendar</Text>

            {ECONOMIC_EVENTS.map((event, index) => (
              <View key={index} style={styles.economicEvent}>
                <Text style={styles.eventTime}>{event.time}</Text>
                <Text style={styles.eventText}>{event.event}</Text>
                <View
                  style={[
                    styles.eventImpact,
                    {
                      backgroundColor: getEventImpactColor(event.impact) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.eventImpactText,
                      { color: getEventImpactColor(event.impact) },
                    ]}
                  >
                    {event.impact}
                  </Text>
                </View>
              </View>
            ))}

            <View
              style={{
                marginTop: 20,
                padding: 12,
                backgroundColor: theme.colors.surface,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "#FFB020",
                  fontSize: 14,
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                ⚠️ Market Impact Notice
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                High-impact events can cause significant market volatility.
                Consider position sizing and risk management.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
