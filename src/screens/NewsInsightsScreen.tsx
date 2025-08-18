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
import { Ionicons } from "@expo/vector-icons";
import {
  fetchNews,
  fetchGeneralMarketNews,
  fetchStockNewsApi,
  fetchTrendingStocks,
  type NewsItem,
  type TrendingStock,
} from "../services/newsProviders";
import {
  analyzeNewsWithEnhancedSentiment,
  type SentimentAnalysis,
} from "../services/sentiment";
import { useUserStore } from "../store/userStore";
import NewsList from "../components/insights/NewsList";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  headerSubtitle: { color: "#888888", fontSize: 14, marginTop: 4 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
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
  tabActive: { backgroundColor: "#00D4AA" },
  tabInactive: { backgroundColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#000000" },
  tabTextInactive: { color: "#888888" },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  newsCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  newsSource: { fontSize: 12, color: "#888888", marginBottom: 8 },
  newsSummary: { fontSize: 14, color: "#cccccc", lineHeight: 20 },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  sentimentText: { fontSize: 12, fontWeight: "600" },
  sentimentOverview: {
    alignItems: "center",
    padding: 20,
  },
  sentimentCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sentimentScore: { fontSize: 28, fontWeight: "bold", color: "#ffffff" },
  sentimentLabel: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  sentimentDesc: { fontSize: 14, color: "#888888", textAlign: "center" },
  economicEvent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  eventTime: { fontSize: 12, color: "#888888", minWidth: 60 },
  eventText: { fontSize: 14, color: "#ffffff", flex: 1, marginLeft: 12 },
  eventImpact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  eventImpactText: { fontSize: 10, fontWeight: "600" },
  keywordChip: {
    backgroundColor: "#333333",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  keywordText: { fontSize: 12, color: "#ffffff" },
  trendingContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  trendingCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    minWidth: 120,
    alignItems: "center",
  },
  trendingTicker: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  trendingMentions: {
    fontSize: 12,
    color: "#aaaaaa",
    marginBottom: 8,
  },
  trendingSentiment: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendingSentimentText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
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
  const { profile } = useUserStore();
  const [activeTab, setActiveTab] = useState<"news" | "sentiment" | "calendar">(
    "news"
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [sentiment, setSentiment] = useState<SentimentAnalysis | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load general market news with enhanced Stock News API
      let generalNews: NewsItem[] = [];
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

      // Load trending stocks
      try {
        const trending = await fetchTrendingStocks(7);
        setTrendingStocks(trending.slice(0, 10));
      } catch (trendingError) {
        console.log("Failed to fetch trending stocks:", trendingError);
        setTrendingStocks([]);
      }

      // Analyze overall sentiment
      const allNews = [...generalNews, ...flatWatchlistNews];
      if (allNews.length > 0) {
        const sentimentAnalysis = await analyzeNewsWithEnhancedSentiment(
          allNews
        );
        setSentiment(sentimentAnalysis);
      }
    } catch (error) {
      console.error("Error loading news:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  function getSentimentColor(score: number) {
    if (score > 0.3) return "#00D4AA";
    if (score < -0.3) return "#FF5722";
    return "#FFB020";
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
        {/* Mock sentiment for individual articles */}
        <View
          style={[
            styles.sentimentBadge,
            {
              backgroundColor: Math.random() > 0.5 ? "#00D4AA20" : "#FF572220",
            },
          ]}
        >
          <Text
            style={[
              styles.sentimentText,
              { color: Math.random() > 0.5 ? "#00D4AA" : "#FF5722" },
            ]}
          >
            {Math.random() > 0.5 ? "Positive" : "Negative"}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Insights</Text>
        <Text style={styles.headerSubtitle}>
          Market news with AI sentiment analysis
        </Text>
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
            activeTab === "sentiment" ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab("sentiment")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "sentiment"
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Sentiment
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
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
                        <View
                          style={[
                            styles.trendingSentiment,
                            {
                              backgroundColor: getSentimentColor(
                                stock.sentiment === "Positive"
                                  ? 0.5
                                  : stock.sentiment === "Negative"
                                  ? -0.5
                                  : 0
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.trendingSentimentText}>
                            {stock.sentiment}
                          </Text>
                        </View>
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

        {activeTab === "sentiment" && sentiment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Sentiment Analysis</Text>

            <View style={styles.sentimentOverview}>
              <View style={styles.sentimentCircle}>
                <Text style={styles.sentimentScore}>
                  {Math.abs(sentiment.score * 100).toFixed(0)}
                </Text>
                <Ionicons
                  name={
                    sentiment.score > 0
                      ? "trending-up"
                      : sentiment.score < 0
                      ? "trending-down"
                      : "remove"
                  }
                  size={20}
                  color="#888888"
                />
              </View>

              <Text
                style={[
                  styles.sentimentLabel,
                  { color: getSentimentColor(sentiment.score) },
                ]}
              >
                {sentiment.label}
              </Text>

              <Text style={styles.sentimentDesc}>{sentiment.summary}</Text>
            </View>

            {/* Positive Keywords */}
            {sentiment.keywords.positive.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text
                  style={{
                    color: "#00D4AA",
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 12,
                  }}
                >
                  Positive Indicators
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {sentiment.keywords.positive.slice(0, 8).map((keyword, i) => (
                    <View
                      key={i}
                      style={[
                        styles.keywordChip,
                        { backgroundColor: "#00D4AA20" },
                      ]}
                    >
                      <Text style={[styles.keywordText, { color: "#00D4AA" }]}>
                        {keyword}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Negative Keywords */}
            {sentiment.keywords.negative.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    color: "#FF5722",
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 12,
                  }}
                >
                  Risk Factors
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {sentiment.keywords.negative.slice(0, 8).map((keyword, i) => (
                    <View
                      key={i}
                      style={[
                        styles.keywordChip,
                        { backgroundColor: "#FF572220" },
                      ]}
                    >
                      <Text style={[styles.keywordText, { color: "#FF5722" }]}>
                        {keyword}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
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
                backgroundColor: "#2a2a2a",
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
              <Text style={{ color: "#888888", fontSize: 12 }}>
                High-impact events can cause significant market volatility.
                Consider position sizing and risk management.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
