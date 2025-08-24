import React, { useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import EnhancedKLineProChart, { ChartRef } from "./EnhancedKLineProChart";

/**
 * Simple example showing how to integrate overlay functionality
 * with your existing chart usage patterns
 */
interface Props {
  symbol: string;
  onOverlayCreated?: (overlayId: string) => void;
}

const SimpleOverlayIntegration: React.FC<Props> = ({
  symbol,
  onOverlayCreated,
}) => {
  const chartRef = useRef<ChartRef>(null);

  // Example: Create a horizontal line at current price level
  const addPriceLine = async () => {
    if (!chartRef.current) return;

    try {
      // Using the Pro API directly as shown in your example
      const overlayId = await chartRef.current.createOverlay({
        name: "segment",
        points: [
          { timestamp: Date.now() - 86400000, value: 150 }, // 1 day ago
          { timestamp: Date.now(), value: 155 }, // now
        ],
        styles: {
          line: {
            color: "#00D4AA",
            size: 2,
            style: "solid",
          },
        },
        lock: true,
      });

      if (overlayId && onOverlayCreated) {
        onOverlayCreated(overlayId);
      }
    } catch (error) {
      console.error("Failed to create overlay:", error);
    }
  };

  // Example: Use the simplified horizontal ray method
  const addHorizontalRay = () => {
    if (!chartRef.current) return;

    chartRef.current.addHorizontalRayLineAtLevel(
      155.5, // price level
      Date.now(), // timestamp
      "#FF6B6B", // color
      "Support Level" // label
    );
  };

  return (
    <View style={styles.container}>
      <EnhancedKLineProChart
        ref={chartRef}
        symbol={symbol}
        height={400}
        theme="dark"
        timeframe="1d"
        market="stocks"
      />

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={addPriceLine}>
          <Text style={styles.buttonText}>Add Line Segment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={addHorizontalRay}>
          <Text style={styles.buttonText}>Add Horizontal Ray</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#1a1a1a",
  },
  button: {
    flex: 1,
    backgroundColor: "#00D4AA",
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

export default SimpleOverlayIntegration;
