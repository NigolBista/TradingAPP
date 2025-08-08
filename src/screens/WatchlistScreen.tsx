import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useUserStore } from "../store/userStore";
import { fetchCandles } from "../services/marketProviders";

export default function WatchlistScreen() {
  const { profile, setProfile } = useUserStore();
  const [input, setInput] = useState("");

  function addSymbol() {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    if (profile.watchlist.includes(sym)) return;
    setProfile({ watchlist: [...profile.watchlist, sym] });
    setInput("");
  }

  async function quickTest(symbol: string) {
    // prefetch to validate symbol
    try {
      await fetchCandles(symbol);
    } catch {}
  }

  const data = useMemo(() => profile.watchlist, [profile.watchlist]);

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="p-4">
        <Text className="text-2xl font-bold text-black dark:text-white">
          Watchlist
        </Text>
        <View className="mt-3 flex-row gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addSymbol}
            placeholder="Add symbol e.g. MSFT"
            className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-xl px-3 py-2 text-black dark:text-white"
          />
          <Pressable
            onPress={addSymbol}
            className="bg-indigo-600 rounded-xl px-4 py-2"
          >
            <Text className="text-white font-medium">Add</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(s) => s}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => quickTest(item)}
            className="flex-row items-center justify-between bg-gray-100 dark:bg-gray-900 rounded-xl px-4 py-3 mb-3"
          >
            <Text className="text-black dark:text-white font-semibold">
              {item}
            </Text>
            <Text className="text-gray-500">Tap to refresh</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
