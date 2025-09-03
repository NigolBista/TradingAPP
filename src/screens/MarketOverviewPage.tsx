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
import { COLORS } from "../constants/colors";
import MarketOverview from "../components/insights/MarketOverview";
import IndexStrip from "../components/insights/IndexStrip";
import ETFStrip from "../components/insights/ETFStrip";
import RecentEarningsCard from "../components/insights/RecentEarningsCard";
import UpcomingEarningsCard from "../components/insights/UpcomingEarningsCard";
import { useAppDataStore } from "../store/appDataStore";
// Remove marketOverviewStore to prevent loops

export default function MarketOverviewPage() {
  const navigation = useNavigation();

  // Use centralized store - no loading states needed!
  const {
    getMarketOverview,
    getSentimentSummary,
    news,
    refresh,
    isRefreshing,
  } = useAppDataStore();

  const overview1d = getMarketOverview("1D");
  const sentimentSummary = getSentimentSummary();

  const handleRefresh = useCallback(async () => {
    // Simple refresh - data is always available
    await refresh();
  }, [refresh]);

  const handleDecalpXPress = useCallback(() => {
    navigation.navigate("DecalpX" as never);
  }, [navigation]);

  // Sentiment summary is now available immediately from the store

  return (
    <SafeAreaView style={styles.container}>
      {/* Live Data Banner */}
      <View style={styles.liveDataBanner}>
        <Text style={styles.liveDataText}>
          📡 Live Market Data: Real-time API feeds
        </Text>
      </View>

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
          <Text style={styles.headerSubtitle}>AI Powered Market Analysis</Text>
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
          <Ionicons name="analytics" size={20} color={COLORS.BLUE_BASE} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Index Strip */}
        <View style={styles.indexSection}>
          <IndexStrip />
        </View>

        {/* ETF Strip */}
        <View style={styles.etfSection}>
          <ETFStrip />
        </View>

        {/* Full Market Overview */}
        <View style={styles.marketOverviewSection}>
          <MarketOverview fullWidth={true} compact={false} />
        </View>

        {/* Recent Earnings */}
        <View style={styles.earningsSection}>
          <RecentEarningsCard
            onEarningsPress={(symbol) => {
              // Navigate to stock detail screen
              (navigation as any).navigate("StockDetail", { symbol });
            }}
          />
        </View>

        {/* Upcoming Earnings removed to avoid duplicate section */}

        {/* Bottom spacing */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  liveDataBanner: {
    backgroundColor: "#1a4d3a",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  liveDataText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "600",
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
  indexSection: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  etfSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  marketOverviewSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  earningsSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
});
