import React, { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Alert } from "react-native";
import EnhancedKLineProChart, {
  ChartRef,
  OverlayOptions,
} from "./EnhancedKLineProChart";

interface Props {
  symbol?: string;
  height?: number;
  theme?: "dark" | "light";
}

const ProChartExample: React.FC<Props> = ({
  symbol = "AAPL",
  height = 400,
  theme = "dark",
}) => {
  const chartRef = useRef<ChartRef>(null);
  const [overlayIds, setOverlayIds] = useState<string[]>([]);

  const createSegmentOverlay = async () => {
    if (!chartRef.current) return;

    try {
      const overlayOptions: OverlayOptions = {
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
      };

      const overlayId = await chartRef.current.createOverlay(overlayOptions);
      if (overlayId) {
        setOverlayIds((prev) => [...prev, overlayId]);
        Alert.alert("Success", `Created segment overlay with ID: ${overlayId}`);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to create overlay: ${error}`);
    }
  };

  const createHorizontalRayLine = () => {
    if (!chartRef.current) return;

    // Get a random price level for demonstration
    const priceLevel = 150 + Math.random() * 50;

    chartRef.current.addHorizontalRayLineAtLevel(
      priceLevel,
      Date.now(),
      "#FF6B6B",
      `Level: $${priceLevel.toFixed(2)}`
    );

    Alert.alert(
      "Success",
      `Created horizontal ray line at $${priceLevel.toFixed(2)}`
    );
  };

  const createCircleOverlay = async () => {
    if (!chartRef.current) return;

    try {
      const overlayOptions: OverlayOptions = {
        name: "circle",
        points: [
          { timestamp: Date.now() - 43200000, value: 152 }, // Center point
          { timestamp: Date.now() - 21600000, value: 157 }, // Radius point
        ],
        styles: {
          line: {
            color: "#4ECDC4",
            size: 1,
            style: "solid",
          },
        },
        lock: true,
      };

      const overlayId = await chartRef.current.createOverlay(overlayOptions);
      if (overlayId) {
        setOverlayIds((prev) => [...prev, overlayId]);
        Alert.alert("Success", `Created circle overlay with ID: ${overlayId}`);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to create circle overlay: ${error}`);
    }
  };

  const createRectangleOverlay = async () => {
    if (!chartRef.current) return;

    try {
      const overlayOptions: OverlayOptions = {
        name: "rect",
        points: [
          { timestamp: Date.now() - 86400000, value: 148 }, // Bottom-left
          { timestamp: Date.now() - 43200000, value: 158 }, // Top-right
        ],
        styles: {
          line: {
            color: "#FFE66D",
            size: 1,
            style: "solid",
          },
        },
        lock: true,
      };

      const overlayId = await chartRef.current.createOverlay(overlayOptions);
      if (overlayId) {
        setOverlayIds((prev) => [...prev, overlayId]);
        Alert.alert(
          "Success",
          `Created rectangle overlay with ID: ${overlayId}`
        );
      }
    } catch (error) {
      Alert.alert("Error", `Failed to create rectangle overlay: ${error}`);
    }
  };

  const createFibonacciRetracement = async () => {
    if (!chartRef.current) return;

    try {
      const overlayOptions: OverlayOptions = {
        name: "fibonacciSegment",
        points: [
          { timestamp: Date.now() - 172800000, value: 140 }, // Start point (2 days ago, low)
          { timestamp: Date.now() - 86400000, value: 165 }, // End point (1 day ago, high)
        ],
        styles: {
          line: {
            color: "#A8E6CF",
            size: 1,
            style: "dashed",
          },
        },
        lock: true,
      };

      const overlayId = await chartRef.current.createOverlay(overlayOptions);
      if (overlayId) {
        setOverlayIds((prev) => [...prev, overlayId]);
        Alert.alert(
          "Success",
          `Created Fibonacci retracement with ID: ${overlayId}`
        );
      }
    } catch (error) {
      Alert.alert("Error", `Failed to create Fibonacci overlay: ${error}`);
    }
  };

  const clearAllOverlays = () => {
    if (!chartRef.current) return;

    chartRef.current.clearAllOverlays();
    setOverlayIds([]);
    Alert.alert("Success", "Cleared all overlays");
  };

  const getSupportedOverlays = () => {
    if (!chartRef.current) return;

    chartRef.current.getSupportedOverlays();
    Alert.alert("Info", "Check console for supported overlay types");
  };

  const debugChart = () => {
    if (!chartRef.current) return;

    chartRef.current.debugWindowObjects();
    Alert.alert("Info", "Check console for debug information");
  };

  return (
    <View style={styles.container}>
      <EnhancedKLineProChart
        ref={chartRef}
        symbol={symbol}
        height={height}
        theme={theme}
        timeframe="1d"
        market="stocks"
        onTradeAnalysis={(analysis) => {
          console.log("Trade analysis:", analysis);
        }}
      />

      <View style={styles.controls}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={createSegmentOverlay}
          >
            <Text style={styles.buttonText}>Line Segment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={createHorizontalRayLine}
          >
            <Text style={styles.buttonText}>Horizontal Ray</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={createCircleOverlay}>
            <Text style={styles.buttonText}>Circle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={createRectangleOverlay}
          >
            <Text style={styles.buttonText}>Rectangle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={createFibonacciRetracement}
          >
            <Text style={styles.buttonText}>Fibonacci</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearAllOverlays}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={getSupportedOverlays}
          >
            <Text style={styles.buttonText}>Get Overlays</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={debugChart}
          >
            <Text style={styles.buttonText}>Debug Chart</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.info}>Active overlays: {overlayIds.length}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  controls: {
    padding: 16,
    backgroundColor: "#1a1a1a",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#00D4AA",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#FF6B6B",
  },
  debugButton: {
    backgroundColor: "#4ECDC4",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  info: {
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
});

export default ProChartExample;
