import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const timeframes: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export default function TimeframeSelector({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps) {
  return (
    <View style={styles.container}>
      {timeframes.map((timeframe) => (
        <Pressable
          key={timeframe}
          style={[
            styles.timeframeButton,
            selectedTimeframe === timeframe && styles.selectedButton,
          ]}
          onPress={() => onTimeframeChange(timeframe)}
        >
          <Text
            style={[
              styles.timeframeText,
              selectedTimeframe === timeframe && styles.selectedText,
            ]}
          >
            {timeframe}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "transparent",
    minWidth: 40,
    alignItems: "center",
  },
  selectedButton: {
    backgroundColor: "#00D4AA",
  },
  timeframeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#888",
  },
  selectedText: {
    color: "#000",
    fontWeight: "600",
  },
});
