import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NewsList from "../components/insights/NewsList";
import {
  fetchTeslaNews,
  fetchMultipleTechStocks,
  fetchTechStocksRequireAll,
  fetchOnlyAmazonNews,
  fetchTechnologySectorNews,
  fetchGeneralMarketNews,
  fetchNegativeAmazonNews,
  fetchVideoNewsOnTesla,
  fetchPressReleasesOnly,
  fetchTrendingStocks,
  fetchMarketEvents,
  type NewsItem,
  type TrendingStock,
  type MarketEvent,
} from "../services/newsProviders";
import {
  testStockNewsApi,
  testMarketNewsApi,
  testAllEndpoints,
} from "../services/stockNewsApiTest";

type DemoSection =
  | "tesla"
  | "multiTech"
  | "techRequireAll"
  | "amazonOnly"
  | "techSector"
  | "generalMarket"
  | "negativeAmazon"
  | "videoTesla"
  | "pressReleases"
  | "trending"
  | "events";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1C",
  },
  header: {
    padding: 20,
    paddingTop: 20,
    backgroundColor: "#1a1a2e",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#aaaaaa",
    lineHeight: 20,
  },
  debugContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  debugButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  debugButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonContainer: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  activeButton: {
    backgroundColor: "#10B981",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    margin: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#aaaaaa",
    marginTop: 12,
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    lineHeight: 20,
  },
  trendingContainer: {
    padding: 16,
  },
  trendingItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendingTicker: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  trendingMentions: {
    color: "#aaaaaa",
    fontSize: 12,
  },
  trendingSentiment: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  eventContainer: {
    padding: 16,
  },
  eventItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  eventTitle: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 4,
  },
  eventDescription: {
    color: "#cccccc",
    fontSize: 12,
    lineHeight: 16,
  },
  eventMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  eventDate: {
    color: "#aaaaaa",
    fontSize: 11,
  },
  eventImpact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  eventImpactText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
});

export default function StockNewsApiDemoScreen() {
  const [activeSection, setActiveSection] = useState<DemoSection>("tesla");
  const [loading, setLoading] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const demoSections = [
    {
      id: "tesla" as DemoSection,
      label: "Tesla News",
      description: "Latest TSLA news (3 items)",
    },
    {
      id: "multiTech" as DemoSection,
      label: "Tech Stocks",
      description: "META, AMZN, NFLX news",
    },
    {
      id: "techRequireAll" as DemoSection,
      label: "All 3 Mentioned",
      description: "Articles mentioning all 3",
    },
    {
      id: "amazonOnly" as DemoSection,
      label: "Amazon Only",
      description: "Only AMZN mentioned",
    },
    {
      id: "techSector" as DemoSection,
      label: "Tech Sector",
      description: "Technology sector news",
    },
    {
      id: "generalMarket" as DemoSection,
      label: "Market News",
      description: "General market updates",
    },
    {
      id: "negativeAmazon" as DemoSection,
      label: "Negative AMZN",
      description: "Negative sentiment only",
    },
    {
      id: "videoTesla" as DemoSection,
      label: "Tesla Videos",
      description: "Video content only",
    },
    {
      id: "pressReleases" as DemoSection,
      label: "Press Releases",
      description: "Official announcements",
    },
    {
      id: "trending" as DemoSection,
      label: "Trending Stocks",
      description: "Most mentioned stocks",
    },
    {
      id: "events" as DemoSection,
      label: "Market Events",
      description: "Important market events",
    },
  ];

  const fetchData = async (section: DemoSection) => {
    setLoading(true);
    setError(null);
    setNewsItems([]);
    setTrendingStocks([]);
    setMarketEvents([]);

    try {
      switch (section) {
        case "tesla":
          const teslaNews = await fetchTeslaNews(3);
          setNewsItems(teslaNews);
          break;
        case "multiTech":
          const multiTechNews = await fetchMultipleTechStocks(20);
          setNewsItems(multiTechNews);
          break;
        case "techRequireAll":
          const techRequireAllNews = await fetchTechStocksRequireAll(20);
          setNewsItems(techRequireAllNews);
          break;
        case "amazonOnly":
          const amazonNews = await fetchOnlyAmazonNews(20);
          setNewsItems(amazonNews);
          break;
        case "techSector":
          const techSectorNews = await fetchTechnologySectorNews(20);
          setNewsItems(techSectorNews);
          break;
        case "generalMarket":
          const marketNews = await fetchGeneralMarketNews(20);
          setNewsItems(marketNews);
          break;
        case "negativeAmazon":
          const negativeAmazonNews = await fetchNegativeAmazonNews(20);
          setNewsItems(negativeAmazonNews);
          break;
        case "videoTesla":
          const videoTeslaNews = await fetchVideoNewsOnTesla(20);
          setNewsItems(videoTeslaNews);
          break;
        case "pressReleases":
          const pressReleaseNews = await fetchPressReleasesOnly(20);
          setNewsItems(pressReleaseNews);
          break;
        case "trending":
          const trending = await fetchTrendingStocks(7);
          setTrendingStocks(trending);
          break;
        case "events":
          const events = await fetchMarketEvents();
          setMarketEvents(events);
          break;
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      Alert.alert(
        "Error",
        "Failed to fetch data. Please check your API key and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeSection);
  }, [activeSection]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Positive":
        return "#10B981";
      case "Negative":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const renderTrendingStocks = () => (
    <View style={styles.trendingContainer}>
      {trendingStocks.map((stock, index) => (
        <View key={index} style={styles.trendingItem}>
          <View>
            <Text style={styles.trendingTicker}>{stock.ticker}</Text>
            <Text style={styles.trendingMentions}>
              {stock.mentions} mentions
            </Text>
          </View>
          <View
            style={[
              styles.trendingSentiment,
              { backgroundColor: getSentimentColor(stock.sentiment) },
            ]}
          >
            <Text style={styles.buttonText}>{stock.sentiment}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderMarketEvents = () => (
    <View style={styles.eventContainer}>
      {marketEvents.map((event, index) => (
        <View key={index} style={styles.eventItem}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDescription}>{event.description}</Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventDate}>
              {new Date(event.date).toLocaleDateString()}
            </Text>
            <View style={styles.eventImpact}>
              <Text style={styles.eventImpactText}>{event.impact} Impact</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stock News API Demo</Text>
        <Text style={styles.subtitle}>
          Explore different endpoints and features of the Stock News API
          integration. Based on examples from stocknewsapi.com/examples
        </Text>

        {/* Debug Buttons */}
        <View style={styles.debugContainer}>
          <Pressable style={styles.debugButton} onPress={testStockNewsApi}>
            <Text style={styles.debugButtonText}>🧪 Test API Key</Text>
          </Pressable>
          <Pressable style={styles.debugButton} onPress={testMarketNewsApi}>
            <Text style={styles.debugButtonText}>🌍 Test Market API</Text>
          </Pressable>
          <Pressable style={styles.debugButton} onPress={testAllEndpoints}>
            <Text style={styles.debugButtonText}>🔍 Test All Endpoints</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.buttonContainer}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.buttonRow}>
          {demoSections.map((section) => (
            <Pressable
              key={section.id}
              style={[
                styles.button,
                activeSection === section.id && styles.activeButton,
              ]}
              onPress={() => setActiveSection(section.id)}
            >
              <Text style={styles.buttonText}>{section.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>
          {demoSections.find((s) => s.id === activeSection)?.description}
        </Text>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && (
          <>
            {activeSection === "trending" && renderTrendingStocks()}
            {activeSection === "events" && renderMarketEvents()}
            {activeSection !== "trending" && activeSection !== "events" && (
              <NewsList items={newsItems} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
