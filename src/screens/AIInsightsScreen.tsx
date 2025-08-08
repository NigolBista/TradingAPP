import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { generateInsights } from "../services/ai";
import { fetchNews } from "../services/marketProviders";

export default function AIInsightsScreen() {
  const [symbols, setSymbols] = useState("AAPL, NVDA");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [headlines, setHeadlines] = useState<any[]>([]);

  async function run() {
    try {
      setLoading(true);
      const list = symbols.split(/[,\s]+/).filter(Boolean);
      const [insight, news] = await Promise.all([
        generateInsights({
          symbols: list,
          skillLevel: "Intermediate",
          traderType: "Swing trader",
          timeframe: "today",
        }),
        fetchNews(list[0] || "AAPL"),
      ]);
      setResponse(insight);
      setHeadlines(news);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="p-4 space-y-3">
        <Text className="text-2xl font-bold text-black dark:text-white">
          AI Insights
        </Text>
        <Text className="text-gray-500 dark:text-gray-400">
          Get sentiment, Buy/Sell/Hold ideas, and risk/reward suggestions.
        </Text>
        <View className="flex-row gap-2 items-center">
          <TextInput
            value={symbols}
            onChangeText={setSymbols}
            placeholder="Symbols e.g. AAPL, NVDA"
            className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-xl px-3 py-2 text-black dark:text-white"
          />
          <Pressable
            onPress={run}
            className="bg-indigo-600 rounded-xl px-4 py-2"
          >
            <Text className="text-white font-medium">Analyze</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="py-10 items-center">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="px-4 pb-6">
          <Text className="text-black dark:text-white leading-6">
            {response}
          </Text>
        </View>
      )}

      <View className="px-4 pb-3">
        <Text className="text-xl font-semibold text-black dark:text-white">
          Related Headlines
        </Text>
      </View>
      <View className="px-4 space-y-3 pb-8">
        {headlines.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => Linking.openURL(h.url)}
            className="bg-gray-100 dark:bg-gray-900 rounded-xl p-3"
          >
            <Text className="text-black dark:text-white">{h.title}</Text>
            <Text className="text-xs text-gray-500 mt-1">{h.source}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
