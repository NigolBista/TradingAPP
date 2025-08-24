import React from "react";
import { View, StyleSheet, Text } from "react-native";
import XMLDrivenChart from "./XMLDrivenChart";

export default function RealisticTradeExample() {
  // Your LLM response
  const llmResponse = {
    strategyChosen: "day_trade",
    side: "long",
    entry: 175.5,
    exit: 177,
    stop: 174.5,
    targets: [178, 179],
    confidence: 75,
    riskReward: 1.5,
    why: [
      "Current price is above the 50-period moving average.",
      "Recent bullish momentum indicated by price action.",
      "ATR suggests manageable volatility for intraday trading.",
    ],
    tradePlanNotes: [
      "Monitor for any sudden news that could impact AAPL.",
      "Adjust stop loss to breakeven after reaching first target.",
    ],
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Realistic Trade Visualization</Text>

      {/* 1-hour timeframe with 100 visible candles */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>AAPL 1H Chart (100 candles)</Text>
        <XMLDrivenChart
          symbol="AAPL"
          timeframe="1h"
          height={300}
          theme="dark"
          llmXml={JSON.stringify(llmResponse)}
          visibleCandles={100}
          currentPrice={175.5}
        />
      </View>

      {/* 15-minute timeframe with 50 visible candles */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>AAPL 15M Chart (50 candles)</Text>
        <XMLDrivenChart
          symbol="AAPL"
          timeframe="15m"
          height={300}
          theme="dark"
          llmXml={JSON.stringify(llmResponse)}
          visibleCandles={50}
          currentPrice={175.5}
        />
      </View>

      {/* 4-hour timeframe with 30 visible candles */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>AAPL 4H Chart (30 candles)</Text>
        <XMLDrivenChart
          symbol="AAPL"
          timeframe="4h"
          height={300}
          theme="dark"
          llmXml={JSON.stringify(llmResponse)}
          visibleCandles={30}
          currentPrice={175.5}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>What's Different Now:</Text>
        <Text style={styles.infoText}>
          • Rectangle timestamps are calculated based on actual timeframe
        </Text>
        <Text style={styles.infoText}>
          • 1H chart: Rectangle spans ~12-30 hours in the past
        </Text>
        <Text style={styles.infoText}>
          • 15M chart: Rectangle spans ~2.5-7.5 hours in the past
        </Text>
        <Text style={styles.infoText}>
          • 4H chart: Rectangle spans ~3.6-12 days in the past
        </Text>
        <Text style={styles.infoText}>
          • Rectangles appear in the visible chart area (not off-screen)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  chartContainer: {
    marginBottom: 24,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00D4AA",
    marginBottom: 12,
  },
  infoContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00D4AA",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 6,
    lineHeight: 20,
  },
});
