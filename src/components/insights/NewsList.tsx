import React from "react";
import { Linking, Pressable, Text, View, StyleSheet } from "react-native";
import type { NewsItem } from "../../services/newsProviders";

interface Props {
  items: NewsItem[];
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  card: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  title: { color: "#ffffff", fontWeight: "600", fontSize: 15, lineHeight: 20 },
  meta: { color: "#aaaaaa", fontSize: 12, marginTop: 6 },
  summary: { color: "#cccccc", fontSize: 13, lineHeight: 18, marginTop: 6 },
});

export default function NewsList({ items }: Props) {
  if (!items?.length) return null;
  return (
    <View style={styles.container}>
      {items.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => n.url && Linking.openURL(n.url)}
          style={styles.card}
        >
          {!!n.title && (
            <Text style={styles.title} numberOfLines={3}>
              {n.title}
            </Text>
          )}
          {(n.source || n.publishedAt) && (
            <Text style={styles.meta}>
              {n.source || ""}
              {n.source && n.publishedAt ? " • " : ""}
              {n.publishedAt ? new Date(n.publishedAt).toLocaleString() : ""}
            </Text>
          )}
          {!!n.summary && (
            <Text style={styles.summary} numberOfLines={4}>
              {n.summary}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
