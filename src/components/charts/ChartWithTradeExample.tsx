import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
} from "react-native";
import KLineProChart, {
  TradeLevel,
  TradeZone,
  ChartAnalysis,
} from "./KLineProChart";
import TradeAnalysisChart from "./TradeAnalysisChart";

export default function ChartWithTradeExample() {
  const [selectedExample, setSelectedExample] = useState<
    "basic" | "analysis" | "manual"
  >("basic");

  // Example 1: Basic chart with manual trade levels
  const basicTradeLevels: TradeLevel[] = [
    {
      price: 150.5,
      color: "#00D4AA",
      label: "Entry Level",
    },
    {
      price: 155.0,
      color: "#4CAF50",
      label: "Take Profit",
    },
    {
      price: 147.0,
      color: "#FF5252",
      label: "Stop Loss",
    },
  ];

  // Example 2: Manual trade zones
  const manualTradeZones: TradeZone[] = [
    {
      entryPrice: 150.5,
      exitPrice: 155.0,
      stopLoss: 147.0,
      takeProfit: 158.0,
      startTime: Date.now() - 86400000 * 2, // 2 days ago
      endTime: Date.now() + 86400000 * 3, // 3 days from now
      color: "rgba(0, 212, 170, 0.2)",
      label: "Long Position",
      type: "long",
    },
    {
      entryPrice: 152.0,
      exitPrice: 148.0,
      stopLoss: 154.5,
      takeProfit: 145.0,
      startTime: Date.now() - 86400000, // 1 day ago
      endTime: Date.now() + 86400000 * 2, // 2 days from now
      color: "rgba(255, 82, 82, 0.2)",
      label: "Short Position",
      type: "short",
    },
  ];

  const handleTradeAnalysis = (analysis: ChartAnalysis) => {
    console.log("Chart Analysis Results:", analysis);
    // You can use this analysis to:
    // 1. Automatically place trades
    // 2. Send notifications
    // 3. Update your trading strategy
    // 4. Store analysis in database
  };

  const renderBasicExample = () => (
    <View style={styles.exampleContainer}>
      <Text style={styles.exampleTitle}>
        Basic Chart with Manual Trade Levels
      </Text>
      <KLineProChart
        symbol="AAPL"
        timeframe="1d"
        height={300}
        theme="dark"
        market="stocks"
        showYAxis={true}
        tradeLevels={basicTradeLevels}
        tradeZones={[]}
        onTradeAnalysis={handleTradeAnalysis}
      />
      <Text style={styles.description}>
        This example shows how to manually add price lines for entry, stop loss,
        and take profit levels.
      </Text>
    </View>
  );

  const renderAnalysisExample = () => (
    <View style={styles.exampleContainer}>
      <Text style={styles.exampleTitle}>Interactive Chart Analysis</Text>
      <TradeAnalysisChart
        symbol="TSLA"
        timeframe="4h"
        height={350}
        theme="dark"
        market="stocks"
      />
      <Text style={styles.description}>
        Click "Analyze Chart" to automatically detect entry/exit levels based on
        technical analysis. The chart will draw trade zones and price levels
        automatically.
      </Text>
    </View>
  );

  const renderManualExample = () => (
    <View style={styles.exampleContainer}>
      <Text style={styles.exampleTitle}>Chart with Trade Zones</Text>
      <KLineProChart
        symbol="NVDA"
        timeframe="1h"
        height={300}
        theme="dark"
        market="stocks"
        showYAxis={true}
        tradeLevels={[]}
        tradeZones={manualTradeZones}
        onTradeAnalysis={handleTradeAnalysis}
      />
      <Text style={styles.description}>
        This example shows colored rectangles representing long and short
        positions with entry/exit levels, stop losses, and take profit targets.
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Chart Trading Visualization Examples</Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedExample === "basic" && styles.activeTab]}
          onPress={() => setSelectedExample("basic")}
        >
          <Text
            style={[
              styles.tabText,
              selectedExample === "basic" && styles.activeTabText,
            ]}
          >
            Basic Levels
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedExample === "analysis" && styles.activeTab,
          ]}
          onPress={() => setSelectedExample("analysis")}
        >
          <Text
            style={[
              styles.tabText,
              selectedExample === "analysis" && styles.activeTabText,
            ]}
          >
            Auto Analysis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedExample === "manual" && styles.activeTab]}
          onPress={() => setSelectedExample("manual")}
        >
          <Text
            style={[
              styles.tabText,
              selectedExample === "manual" && styles.activeTabText,
            ]}
          >
            Trade Zones
          </Text>
        </TouchableOpacity>
      </View>

      {selectedExample === "basic" && renderBasicExample()}
      {selectedExample === "analysis" && renderAnalysisExample()}
      {selectedExample === "manual" && renderManualExample()}

      <View style={styles.codeExample}>
        <Text style={styles.codeTitle}>Usage Example:</Text>
        <Text style={styles.codeText}>
          {`// Basic usage with trade levels
<KLineProChart
  symbol="AAPL"
  tradeLevels={[
    { price: 150.50, color: '#00D4AA', label: 'Entry' },
    { price: 155.00, color: '#4CAF50', label: 'Take Profit' },
    { price: 147.00, color: '#FF5252', label: 'Stop Loss' }
  ]}
  tradeZones={[
    {
      entryPrice: 150.50,
      exitPrice: 155.00,
      stopLoss: 147.00,
      takeProfit: 158.00,
      type: 'long',
      label: 'Long Position'
    }
  ]}
  onTradeAnalysis={(analysis) => {
    console.log('Analysis:', analysis);
    // Use analysis to make trading decisions
  }}
/>`}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    padding: 20,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: "#00D4AA",
  },
  tabText: {
    color: "#888",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  exampleContainer: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  exampleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  description: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  codeExample: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00D4AA",
    marginBottom: 8,
  },
  codeText: {
    color: "#ccc",
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 16,
  },
});
