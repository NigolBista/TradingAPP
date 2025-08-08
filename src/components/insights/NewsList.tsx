import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { NewsItem } from "../../services/marketProviders";

interface Props {
  items: NewsItem[];
}

export default function NewsList({ items }: Props) {
  if (!items?.length) return null;
  return (
    <View className="px-4 space-y-3">
      {items.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => Linking.openURL(n.url)}
          className="bg-gray-100 dark:bg-gray-900 rounded-xl p-3"
        >
          <Text className="text-black dark:text-white font-medium">
            {n.title}
          </Text>
          {n.source ? (
            <Text className="text-xs text-gray-500 mt-1">
              {n.source}{" "}
              {n.publishedAt
                ? `• ${new Date(n.publishedAt).toLocaleString()}`
                : ""}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
