import React from "react";
import {
  Linking,
  Pressable,
  Text,
  View,
  StyleSheet,
  Image,
} from "react-native";
import type { NewsItem } from "../../../shared/services/newsProviders";
import { useTheme } from "../../../providers/ThemeProvider";

interface Props {
  items: NewsItem[];
  fullScreen?: boolean;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { paddingHorizontal: 0 },
    containerFullScreen: { paddingHorizontal: 0 },
    card: {
      backgroundColor: "rgba(17, 24, 39, 0.5)",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      marginHorizontal: 8,
    },
    cardWithImage: {
      backgroundColor: "rgba(17, 24, 39, 0.5)",
      borderRadius: 12,
      padding: 0,
      marginBottom: 8,
      marginHorizontal: 8,
      overflow: "hidden",
    },
    cardFullScreen: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      marginHorizontal: 16,
    },
    cardWithImageFullScreen: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 0,
      marginBottom: 8,
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
    title: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 15,
      lineHeight: 20,
    },
    meta: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 6 },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 6,
    },
    summary: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
    },
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
      backgroundColor: theme.colors.surface,
      marginRight: 4,
      marginTop: 2,
    },
    tickerText: {
      color: theme.colors.text,
      fontSize: 9,
      fontWeight: "500",
    },
  });

const getSentimentStyle = (styles: any, sentiment?: string) => {
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
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (!items?.length) return null;

  return (
    <View style={fullScreen ? styles.containerFullScreen : styles.container}>
      {items.map((n, index) => {
        const getCardStyle = () => {
          if (fullScreen) {
            return n.imageUrl
              ? styles.cardWithImageFullScreen
              : styles.cardFullScreen;
          }
          return n.imageUrl ? styles.cardWithImage : styles.card;
        };

        // Create a unique key by combining multiple fields to avoid duplicates
        const uniqueKey = `${n.id || n.url || n.title}-${index}`;

        return (
          <Pressable
            key={uniqueKey}
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
                      getSentimentStyle(styles, n.sentiment),
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
