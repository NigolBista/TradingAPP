import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
export type ChartType = "line" | "candlestick" | "area" | "bar";

interface ChartControlsProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onSettingsPress: () => void;
  onExpandPress: () => void;
  onTimeframePickerPress?: () => void;
}

const timeframes: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export default function ChartControls({
  selectedTimeframe,
  onTimeframeChange,
  onSettingsPress,
  onExpandPress,
  onTimeframePickerPress,
}: ChartControlsProps) {
  return (
    <View style={styles.container}>
      {/* Timeframe Buttons (compact) */}
      <View style={{ flexDirection: "row" }}>
        {timeframes.map((timeframe) => (
          <Pressable
            key={timeframe}
            style={[
              styles.button,
              selectedTimeframe === timeframe && styles.selectedButton,
            ]}
            onPress={() => onTimeframeChange(timeframe)}
          >
            <Text
              style={[
                styles.buttonText,
                selectedTimeframe === timeframe && styles.selectedText,
              ]}
            >
              {timeframe}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Timeframe Picker (Webull-style) */}
      <Pressable style={styles.iconButton} onPress={onTimeframePickerPress}>
        <Ionicons name="time-outline" size={16} color="#888" />
      </Pressable>

      {/* Settings Button */}
      <Pressable style={styles.iconButton} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={16} color="#888" />
      </Pressable>

      {/* Expand Button */}
      <Pressable style={styles.iconButton} onPress={onExpandPress}>
        <Ionicons name="expand-outline" size={16} color="#888" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "transparent",
    minWidth: 32,
    alignItems: "center",
    marginHorizontal: 2,
  },
  selectedButton: {
    backgroundColor: "#00D4AA",
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#888",
  },
  selectedText: {
    color: "#000",
    fontWeight: "600",
  },
  iconButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
