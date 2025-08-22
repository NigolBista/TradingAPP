import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import FastLineChart from "./FastLineChart";
import FastAreaChart from "./FastAreaChart";
import FastCandlestickChart from "./FastCandlestickChart";
import ChartTouchHandler from "./ChartTouchHandler";

const { width: screenWidth } = Dimensions.get("window");

// Sample data generators
const generateLineData = (points: number = 100) => {
  const data = [];
  let value = 100;
  const now = Date.now();

  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.5) * 10;
    data.push({
      time: now - (points - i) * 60000, // 1 minute intervals
      value: Math.max(50, Math.min(150, value)),
    });
  }

  return data;
};

const generateCandleData = (points: number = 50) => {
  const data = [];
  let price = 100;
  const now = Date.now();

  for (let i = 0; i < points; i++) {
    const open = price;
    const change = (Math.random() - 0.5) * 8;
    const close = Math.max(50, Math.min(150, open + change));
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    const volume = Math.random() * 1000000;

    data.push({
      time: now - (points - i) * 300000, // 5 minute intervals
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return data;
};

export default function FastChartsExample() {
  const [selectedChart, setSelectedChart] = useState<
    "line" | "area" | "candle"
  >("line");

  // Generate sample data
  const lineData = useMemo(() => generateLineData(100), []);
  const areaData = useMemo(() => generateLineData(80), []);
  const candleData = useMemo(() => generateCandleData(50), []);

  const chartWidth = screenWidth - 32;

  const handlePan = (deltaX: number, deltaY: number) => {
    console.log("Pan:", deltaX, deltaY);
  };

  const handleZoom = (scale: number, focalX: number, focalY: number) => {
    console.log("Zoom:", scale, focalX, focalY);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fast Native Charts</Text>

      {/* Chart Type Selector */}
      <View style={styles.selector}>
        <Pressable
          style={[
            styles.selectorButton,
            selectedChart === "line" && styles.selectorButtonActive,
          ]}
          onPress={() => setSelectedChart("line")}
        >
          <Text
            style={[
              styles.selectorText,
              selectedChart === "line" && styles.selectorTextActive,
            ]}
          >
            Line Chart
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.selectorButton,
            selectedChart === "area" && styles.selectorButtonActive,
          ]}
          onPress={() => setSelectedChart("area")}
        >
          <Text
            style={[
              styles.selectorText,
              selectedChart === "area" && styles.selectorTextActive,
            ]}
          >
            Area Chart
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.selectorButton,
            selectedChart === "candle" && styles.selectorButtonActive,
          ]}
          onPress={() => setSelectedChart("candle")}
        >
          <Text
            style={[
              styles.selectorText,
              selectedChart === "candle" && styles.selectorTextActive,
            ]}
          >
            Candlestick
          </Text>
        </Pressable>
      </View>

      {/* Chart Display */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>
          {selectedChart === "line" && "Fast Line Chart"}
          {selectedChart === "area" && "Fast Area Chart"}
          {selectedChart === "candle" && "Fast Candlestick Chart"}
        </Text>

        <View style={styles.chartContainer}>
          <ChartTouchHandler
            width={chartWidth}
            height={selectedChart === "candle" ? 350 : 250}
            onPan={handlePan}
            onZoom={handleZoom}
            enablePan={true}
            enableZoom={true}
          >
            {selectedChart === "line" && (
              <FastLineChart
                data={lineData}
                width={chartWidth}
                height={250}
                color="#3b82f6"
                strokeWidth={2}
                showDots={false}
              />
            )}

            {selectedChart === "area" && (
              <FastAreaChart
                data={areaData}
                width={chartWidth}
                height={250}
                color="#10b981"
                strokeWidth={2}
                fillOpacity={0.3}
                showLine={true}
                showDots={false}
              />
            )}

            {selectedChart === "candle" && (
              <FastCandlestickChart
                data={candleData}
                width={chartWidth}
                height={350}
                candleWidth={12}
                showVolume={true}
                volumeHeight={80}
                showMovingAverage={true}
                maPeriod={20}
                bullishColor="#16a34a"
                bearishColor="#dc2626"
              />
            )}
          </ChartTouchHandler>
        </View>
      </View>

      {/* Performance Info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Performance Benefits</Text>
        <Text style={styles.infoText}>
          ✅ Native SVG rendering (no WebView)
        </Text>
        <Text style={styles.infoText}>✅ 60fps smooth animations</Text>
        <Text style={styles.infoText}>✅ Instant loading (no JS bundle)</Text>
        <Text style={styles.infoText}>✅ Low memory usage</Text>
        <Text style={styles.infoText}>✅ No windowing effects</Text>
        <Text style={styles.infoText}>✅ Touch interactions (pan/zoom)</Text>
      </View>

      {/* Usage Examples */}
      <View style={styles.usageSection}>
        <Text style={styles.usageTitle}>Usage Examples</Text>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Line Chart:</Text>
          <Text style={styles.code}>
            {`<FastLineChart
  data={lineData}
  width={300}
  height={200}
  color="#3b82f6"
  strokeWidth={2}
/>`}
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Area Chart:</Text>
          <Text style={styles.code}>
            {`<FastAreaChart
  data={areaData}
  width={300}
  height={200}
  color="#10b981"
  fillOpacity={0.3}
  showLine={true}
/>`}
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Candlestick Chart:</Text>
          <Text style={styles.code}>
            {`<FastCandlestickChart
  data={candleData}
  width={300}
  height={350}
  showVolume={true}
  showMovingAverage={true}
  maPeriod={20}
/>`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    color: "#1f2937",
  },
  selector: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: 4,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  selectorButtonActive: {
    backgroundColor: "#3b82f6",
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  selectorTextActive: {
    color: "#ffffff",
  },
  chartSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#374151",
  },
  chartContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#374151",
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
    color: "#6b7280",
  },
  usageSection: {
    marginHorizontal: 16,
    marginBottom: 40,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#374151",
  },
  codeBlock: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
    marginBottom: 8,
  },
  code: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#e5e7eb",
    lineHeight: 16,
  },
});
