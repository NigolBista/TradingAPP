import React from "react";
import { View, Text, ScrollView } from "react-native";

export default function JourneyScreen() {
  const sections = [
    {
      title: "Beginner Path",
      items: [
        "Trading basics",
        "How to read charts",
        "Portfolio diversification",
      ],
    },
    {
      title: "Intermediate Path",
      items: ["Swing trading strategies", "Risk management"],
    },
    {
      title: "Expert Path",
      items: ["Algorithmic trading concepts", "Advanced technical analysis"],
    },
  ];
  return (
    <ScrollView className="flex-1 bg-white dark:bg-black p-4">
      <Text className="text-2xl font-bold text-black dark:text-white mb-4">
        Trader's Journey
      </Text>
      {sections.map((s) => (
        <View key={s.title} className="mb-5">
          <Text className="text-xl font-semibold text-black dark:text-white mb-2">
            {s.title}
          </Text>
          {s.items.map((i) => (
            <View
              key={i}
              className="bg-gray-100 dark:bg-gray-900 rounded-xl p-3 mb-2"
            >
              <Text className="text-black dark:text-white">{i}</Text>
            </View>
          ))}
        </View>
      ))}
      <View className="h-4" />
    </ScrollView>
  );
}
