import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";

import NewsList from "../../components/insights/NewsList";

export interface StockNewsSectionProps {
  symbol: string;
  news: Array<any>;
  newsLoading: boolean;
  onRetry: () => void;
}

export function StockNewsSection({ symbol, news, newsLoading, onRetry }: StockNewsSectionProps) {
  return (
    <View style={styles.newsSection}>
      {newsLoading ? (
        <View style={styles.newsSectionHeader}>
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <ActivityIndicator size="small" color="#00D4AA" />
            <Text style={{ color: "#888", fontSize: 14, marginTop: 8 }}>
              Loading latest news for {symbol}...
            </Text>
          </View>
        </View>
      ) : news.length > 0 ? (
        <NewsList items={news.slice(0, 20)} fullScreen={true} />
      ) : (
        <>
          <View style={styles.newsSectionHeader}>
            <Text style={styles.newsSectionTitle}>Latest News</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
            <Text style={styles.noNewsText}>
              No recent news found for {symbol}
            </Text>
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry Loading News</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  newsSection: {
    backgroundColor: "#0a0a0a",
    marginVertical: 6,
  },
  newsSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  newsSectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  noNewsText: {
    color: "#888",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: "center",
  },
  retryButtonText: {
    color: "#00D4AA",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default StockNewsSection;

