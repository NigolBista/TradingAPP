import React, { useState, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Alert } from "react-native";
import KLineProChart, {
  TradeLevel,
  TradeZone,
  ChartAnalysis,
} from "./KLineProChart";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex";
}

export default function TradeAnalysisChart({
  symbol,
  timeframe = "1d",
  height = 400,
  theme = "dark",
  market = "stocks",
}: Props) {
  const [tradeLevels, setTradeLevels] = useState<TradeLevel[]>([]);
  const [tradeZones, setTradeZones] = useState<TradeZone[]>([]);
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chartRef = useRef<any>(null);

  const handleAnalyzeChart = () => {
    if (!chartRef.current) return;

    setIsAnalyzing(true);

    try {
      // Trigger chart analysis
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.analyzeChart) {
              window.__KLP__.analyzeChart();
            }
          } catch(e) {
            console.error('Analysis failed:', e);
          }
        })();
      `);
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
      setIsAnalyzing(false);
    }
  };

  const handleTradeAnalysis = (analysisResult: ChartAnalysis) => {
    setAnalysis(analysisResult);
    setIsAnalyzing(false);

    // Auto-draw trade levels based on analysis
    const newTradeLevels: TradeLevel[] = [
      {
        price: analysisResult.suggestedEntry,
        color: "#00D4AA",
        label: `Entry: $${analysisResult.suggestedEntry.toFixed(2)}`,
      },
      {
        price: analysisResult.suggestedExit,
        color: "#2196F3",
        label: `Exit: $${analysisResult.suggestedExit.toFixed(2)}`,
      },
      {
        price: analysisResult.stopLoss,
        color: "#FF5252",
        label: `Stop Loss: $${analysisResult.stopLoss.toFixed(2)}`,
      },
      {
        price: analysisResult.takeProfit,
        color: "#4CAF50",
        label: `Take Profit: $${analysisResult.takeProfit.toFixed(2)}`,
      },
    ];

    setTradeLevels(newTradeLevels);

    // Create trade zone
    const newTradeZone: TradeZone = {
      entryPrice: analysisResult.suggestedEntry,
      exitPrice: analysisResult.suggestedExit,
      stopLoss: analysisResult.stopLoss,
      takeProfit: analysisResult.takeProfit,
      startTime: Date.now() - 86400000, // 1 day ago
      endTime: Date.now() + 86400000, // 1 day from now
      color:
        analysisResult.trend === "bullish"
          ? "rgba(0, 212, 170, 0.2)"
          : "rgba(255, 82, 82, 0.2)",
      label: `${analysisResult.trend.toUpperCase()} Trade`,
      type: analysisResult.trend === "bullish" ? "long" : "short",
    };

    setTradeZones([newTradeZone]);
  };

  const clearDrawings = () => {
    if (!chartRef.current) return;

    setTradeLevels([]);
    setTradeZones([]);
    setAnalysis(null);

    chartRef.current.injectJavaScript(`
      (function(){
        try {
          if (window.__KLP__ && window.__KLP__.clearAllDrawings) {
            window.__KLP__.clearAllDrawings();
          }
        } catch(e) {
          console.error('Failed to clear drawings:', e);
        }
      })();
    `);
  };

  const addManualTrade = () => {
    if (!analysis) {
      Alert.alert(
        "No Analysis",
        "Please analyze the chart first to get price levels."
      );
      return;
    }

    // Example: Add a manual trade zone
    const currentTime = Date.now();
    const manualTrade: TradeZone = {
      entryPrice: analysis.currentPrice,
      exitPrice: analysis.currentPrice * 1.03, // 3% profit target
      stopLoss: analysis.currentPrice * 0.97, // 3% stop loss
      takeProfit: analysis.currentPrice * 1.05, // 5% take profit
      startTime: currentTime,
      endTime: currentTime + 7 * 86400000, // 1 week
      color: "rgba(255, 193, 7, 0.2)",
      label: "Manual Trade",
      type: "long",
    };

    setTradeZones((prev) => [...prev, manualTrade]);
  };

  return (
    <View style={styles.container}>
      <KLineProChart
        ref={chartRef}
        symbol={symbol}
        timeframe={timeframe}
        height={height}
        theme={theme}
        market={market}
        showYAxis={true}
        tradeLevels={tradeLevels}
        tradeZones={tradeZones}
        onTradeAnalysis={handleTradeAnalysis}
      />

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.analyzeButton]}
          onPress={handleAnalyzeChart}
          disabled={isAnalyzing}
        >
          <Text style={styles.buttonText}>
            {isAnalyzing ? "Analyzing..." : "Analyze Chart"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.tradeButton]}
          onPress={addManualTrade}
          disabled={!analysis}
        >
          <Text style={styles.buttonText}>Add Trade</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearDrawings}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {analysis && (
        <View
          style={[
            styles.analysisPanel,
            theme === "dark" ? styles.darkPanel : styles.lightPanel,
          ]}
        >
          <Text
            style={[
              styles.analysisTitle,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Analysis Results
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Trend: {analysis.trend.toUpperCase()}
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Current: ${analysis.currentPrice.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Entry: ${analysis.suggestedEntry.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Exit: ${analysis.suggestedExit.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Stop Loss: ${analysis.stopLoss.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.analysisText,
              theme === "dark" ? styles.darkText : styles.lightText,
            ]}
          >
            Take Profit: ${analysis.takeProfit.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  analyzeButton: {
    backgroundColor: "#00D4AA",
  },
  tradeButton: {
    backgroundColor: "#2196F3",
  },
  clearButton: {
    backgroundColor: "#FF5252",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  analysisPanel: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  darkPanel: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
  },
  lightPanel: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ddd",
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    marginBottom: 4,
  },
  darkText: {
    color: "#fff",
  },
  lightText: {
    color: "#333",
  },
});
