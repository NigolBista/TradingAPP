import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from "react-native";
import EnhancedKLineProChart, { ChartRef } from "./EnhancedKLineProChart";
import DirectProChart from "./DirectProChart";
import {
  createSegmentOverlay,
  createHorizontalRayOverlay,
  createRectangleOverlay,
  createFibonacciRetracementOverlay,
  createSupportResistanceLevels,
  createPoint,
  getCurrentTimestamp,
  getDaysAgoTimestamp,
  CreateOverlayOptions,
} from "./overlayUtils";

interface Props {
  symbol?: string;
  height?: number;
  theme?: "dark" | "light";
  useFallback?: boolean; // Option to use DirectProChart instead of EnhancedKLineProChart
}

const AdvancedOverlayExample: React.FC<Props> = ({
  symbol = "AAPL",
  height = 500,
  theme = "dark",
  useFallback = false, // Default to using the enhanced chart with text loading
}) => {
  const chartRef = useRef<ChartRef>(null);
  const [overlayCount, setOverlayCount] = useState(0);
  const [isChartReady, setIsChartReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const samplePrices = {
    current: 155.5,
    high: 158.75,
    low: 152.25,
    support: 150.0,
    resistance: 160.0,
  };

  // Wait for chart to be ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Give the chart time to load

    return () => clearTimeout(timer);
  }, []);

  const createOverlay = async (
    overlayOptions: CreateOverlayOptions | CreateOverlayOptions[]
  ) => {
    if (!chartRef.current || !isChartReady) {
      Alert.alert(
        "Error",
        "Chart not ready yet. Please wait a moment and try again."
      );
      return;
    }

    try {
      const overlays = Array.isArray(overlayOptions)
        ? overlayOptions
        : [overlayOptions];

      for (const overlay of overlays) {
        const overlayId = await chartRef.current.createOverlay(overlay);
        if (overlayId) {
          setOverlayCount((prev) => prev + 1);
        }
      }

      Alert.alert("Success", `Created ${overlays.length} overlay(s)`);
    } catch (error) {
      console.error("Overlay creation error:", error);
      Alert.alert("Error", `Failed to create overlay: ${error}`);
    }
  };

  const createTrendLine = () => {
    const overlay = createSegmentOverlay(
      createPoint(getDaysAgoTimestamp(2), samplePrices.low),
      createPoint(getCurrentTimestamp(), samplePrices.high),
      "#00D4AA"
    );
    createOverlay(overlay);
  };

  const createPriceLevel = () => {
    const overlay = createHorizontalRayOverlay(
      samplePrices.current,
      getCurrentTimestamp(),
      "#FF6B6B",
      `Price: $${samplePrices.current}`
    );
    createOverlay(overlay);
  };

  const createTradingBox = () => {
    const overlay = createRectangleOverlay(
      createPoint(getDaysAgoTimestamp(1), samplePrices.low),
      createPoint(getCurrentTimestamp(), samplePrices.high),
      "#FFE66D"
    );
    createOverlay(overlay);
  };

  const createFibonacci = () => {
    const overlay = createFibonacciRetracementOverlay(
      createPoint(getDaysAgoTimestamp(3), samplePrices.low - 5),
      createPoint(getDaysAgoTimestamp(1), samplePrices.high + 3),
      "#A8E6CF"
    );
    createOverlay(overlay);
  };

  const createSupportResistance = () => {
    const overlays = createSupportResistanceLevels(
      [samplePrices.support, samplePrices.resistance],
      "#9B59B6"
    );
    createOverlay(overlays);
  };

  const clearAll = () => {
    if (!chartRef.current) return;
    chartRef.current.clearAllOverlays();
    setOverlayCount(0);
    Alert.alert("Success", "Cleared all overlays");
  };

  const handleChartReady = () => {
    setIsChartReady(true);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00D4AA" />
        <Text style={styles.loadingText}>Loading Chart...</Text>
      </View>
    );
  }

  const ChartComponent = useFallback ? DirectProChart : EnhancedKLineProChart;

  return (
    <View style={styles.container}>
      <ChartComponent
        ref={chartRef}
        symbol={symbol}
        height={height}
        theme={theme}
        timeframe="1d"
        market="stocks"
        onTradeAnalysis={handleChartReady}
      />

      <View style={styles.controls}>
        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={createTrendLine}>
            <Text style={styles.buttonText}>Trend Line</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={createPriceLevel}>
            <Text style={styles.buttonText}>Price Level</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={createTradingBox}>
            <Text style={styles.buttonText}>Trading Box</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={createFibonacci}>
            <Text style={styles.buttonText}>Fibonacci</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={createSupportResistance}
          >
            <Text style={styles.buttonText}>S/R Levels</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearAll}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.info}>
          Active overlays: {overlayCount} | Chart ready:{" "}
          {isChartReady ? "✅" : "⏳"} | Using:{" "}
          {useFallback ? "DirectPro" : "Enhanced"}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 16,
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
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#E74C3C",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  info: {
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
});

export default AdvancedOverlayExample;
