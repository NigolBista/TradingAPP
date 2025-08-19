import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import MarketOverview from "../components/insights/MarketOverview";
import DecalpXMini from "../components/insights/DecalpXMini";
import IndexStrip from "../components/insights/IndexStrip";
import { useMarketOverviewStore } from "../store/marketOverviewStore";

export default function MarketOverviewPage() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const ensureOverview = useMarketOverviewStore((s) => s.ensureOverview);
  const overview1d = useMarketOverviewStore((s) => s.overviewByTf["1D"]);
  const rawNews = useMarketOverviewStore((s) => s.rawNews);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await ensureOverview("1D", { force: true });
    } catch (error) {
      console.error("Error refreshing market overview:", error);
    } finally {
      setRefreshing(false);
    }
  }, [ensureOverview]);

  const handleDecalpXPress = useCallback(() => {
    navigation.navigate("DecalpX" as never);
  }, [navigation]);

  // Calculate sentiment summary for header
  const sentimentSummary = React.useMemo(() => {
    const ov = overview1d;
    if (!ov && !rawNews?.length) return null;
    if ((ov as any)?.marketSentiment) {
      return (ov as any).marketSentiment;
    }
    const news = rawNews || [];
    let positive = 0,
      negative = 0,
      neutral = 0;
    for (const n of news) {
      const sentiment = (n.sentiment || "").toLowerCase();
      if (sentiment === "positive") positive++;
      else if (sentiment === "negative") negative++;
      else neutral++;
    }
    const total = positive + negative + neutral;
    if (total === 0) return null;
    const pos = positive / total;
    const neg = negative / total;
    let overall: "bullish" | "bearish" | "neutral";
    let confidence: number;
    if (pos > 0.6) {
      overall = "bullish";
      confidence = Math.round(pos * 100);
    } else if (neg > 0.6) {
      overall = "bearish";
      confidence = Math.round(neg * 100);
    } else {
      overall = "neutral";
      confidence = Math.round(Math.max(pos, neg) * 100);
    }
    return { overall, confidence };
  }, [overview1d, rawNews]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Market Overview</Text>
          {sentimentSummary && (
            <View
              style={[
                styles.sentimentBadge,
                sentimentSummary.overall === "bullish"
                  ? styles.badgeBull
                  : sentimentSummary.overall === "bearish"
                  ? styles.badgeBear
                  : styles.badgeNeutral,
              ]}
            >
              <Ionicons
                name={
                  sentimentSummary.overall === "bullish"
                    ? "trending-up"
                    : sentimentSummary.overall === "bearish"
                    ? "trending-down"
                    : "remove"
                }
                color="#fff"
                size={12}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.sentimentText}>
                {sentimentSummary.overall.toUpperCase()}{" "}
                {sentimentSummary.confidence}%
              </Text>
            </View>
          )}
        </View>
        <Pressable onPress={handleDecalpXPress} style={styles.decalpxButton}>
          <Ionicons name="analytics" size={20} color="#60a5fa" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Index Strip */}
        <View style={styles.section}>
          <IndexStrip />
        </View>

        {/* DecalpX Snapshot */}
        <View style={styles.section}>
          <DecalpXMini />
        </View>

        {/* Full Market Overview */}
        <View style={styles.section}>
          <MarketOverview fullWidth={true} compact={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
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
  sentimentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  badgeBull: { backgroundColor: "#16a34a" },
  badgeBear: { backgroundColor: "#dc2626" },
  badgeNeutral: { backgroundColor: "#6b7280" },
  sentimentText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  decalpxButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});
