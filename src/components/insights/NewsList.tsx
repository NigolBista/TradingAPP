import React from "react";
import {
  Linking,
  Pressable,
  Text,
  View,
  StyleSheet,
  Image,
} from "react-native";
import type { NewsItem } from "../../services/newsProviders";

interface Props {
  items: NewsItem[];
  fullScreen?: boolean;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  containerFullScreen: { paddingHorizontal: 0 },
  card: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardWithImage: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 0,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardFullScreen: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  cardWithImageFullScreen: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 0,
    marginBottom: 10,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    height: 120,
  },
  newsImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  contentContainer: {
    padding: 12,
  },
  title: { color: "#ffffff", fontWeight: "600", fontSize: 15, lineHeight: 20 },
  meta: { color: "#aaaaaa", fontSize: 12, marginTop: 6 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
  },
  summary: { color: "#cccccc", fontSize: 13, lineHeight: 18, marginTop: 6 },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    marginTop: 4,
  },
  sentimentPositive: {
    backgroundColor: "#10B981",
  },
  sentimentNegative: {
    backgroundColor: "#EF4444",
  },
  sentimentNeutral: {
    backgroundColor: "#6B7280",
  },
  sentimentText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    marginRight: 8,
    marginTop: 4,
  },
  typeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "500",
  },
  tickersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  tickerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#374151",
    marginRight: 4,
    marginTop: 2,
  },
  tickerText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "500",
  },
});

const getSentimentStyle = (sentiment?: string) => {
  switch (sentiment) {
    case "Positive":
      return styles.sentimentPositive;
    case "Negative":
      return styles.sentimentNegative;
    default:
      return styles.sentimentNeutral;
  }
};

export default function NewsList({ items, fullScreen = false }: Props) {
  if (!items?.length) return null;

  return (
    <View style={fullScreen ? styles.containerFullScreen : styles.container}>
      {items.map((n) => {
        const getCardStyle = () => {
          if (fullScreen) {
            return n.imageUrl
              ? styles.cardWithImageFullScreen
              : styles.cardFullScreen;
          }
          return n.imageUrl ? styles.cardWithImage : styles.card;
        };

        return (
          <Pressable
            key={n.id}
            onPress={() => n.url && Linking.openURL(n.url)}
            style={getCardStyle()}
          >
            {n.imageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: n.imageUrl }}
                  style={styles.newsImage}
                  defaultSource={require("../../../assets/icon.png")}
                />
              </View>
            )}

            <View style={n.imageUrl ? styles.contentContainer : undefined}>
              {!!n.title && (
                <Text style={styles.title} numberOfLines={3}>
                  {n.title}
                </Text>
              )}

              <View style={styles.metaRow}>
                {n.sentiment && (
                  <View
                    style={[
                      styles.sentimentBadge,
                      getSentimentStyle(n.sentiment),
                    ]}
                  >
                    <Text style={styles.sentimentText}>{n.sentiment}</Text>
                  </View>
                )}

                {n.type && n.type !== "Article" && (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{n.type}</Text>
                  </View>
                )}
              </View>

              {(n.source || n.publishedAt) && (
                <Text style={styles.meta}>
                  {n.source || ""}
                  {n.source && n.publishedAt ? " • " : ""}
                  {n.publishedAt
                    ? new Date(n.publishedAt).toLocaleString()
                    : ""}
                </Text>
              )}

              {n.tickers && n.tickers.length > 0 && (
                <View style={styles.tickersContainer}>
                  {n.tickers.slice(0, 5).map((ticker, idx) => (
                    <View key={idx} style={styles.tickerBadge}>
                      <Text style={styles.tickerText}>{ticker}</Text>
                    </View>
                  ))}
                  {n.tickers.length > 5 && (
                    <View style={styles.tickerBadge}>
                      <Text style={styles.tickerText}>
                        +{n.tickers.length - 5}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {!!n.summary && (
                <Text style={styles.summary} numberOfLines={4}>
                  {n.summary}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
