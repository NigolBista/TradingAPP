import React from "react";
import { View } from "react-native";

export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      {children}
    </View>
  );
}
