import React, { useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import KLineProChart from "./KLineProChart";
import {
  addHorizontalRayLineAtLevel,
  addSupportResistanceLevels,
} from "./chartUtils";

interface Props {
  symbol?: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
}

export default function HorizontalRayLineExample({
  symbol = "AAPL",
  timeframe = "1d",
  height = 400,
  theme = "dark",
}: Props) {
  const chartRef = useRef<any>(null);

  // Example usage functions using the utility function (matches your original signature)
  const addRayLineAt45000 = () => {
    // Usage example: Add a horizontal ray line at current price + 5%
    if (chartRef.current) {
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.analyzeChart) {
              var analysis = window.__KLP__.analyzeChart();
              if (analysis && analysis.currentPrice) {
                var targetPrice = analysis.currentPrice * 1.05; // 5% above current
                if (window.__KLP__.addHorizontalRayLineAtLevel) {
                  window.__KLP__.addHorizontalRayLineAtLevel(targetPrice, Date.now(), '#00D4AA', 'Target +5%');
                }
              }
            }
          } catch(e) {
            console.error('Failed to add ray line:', e);
          }
        })();
      `);
    }
  };

  const addRayLineAt55000WithTimestamp = () => {
    // Usage example: Add a horizontal ray line at current price - 5%
    if (chartRef.current) {
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.analyzeChart) {
              var analysis = window.__KLP__.analyzeChart();
              if (analysis && analysis.currentPrice) {
                var targetPrice = analysis.currentPrice * 0.95; // 5% below current
                if (window.__KLP__.addHorizontalRayLineAtLevel) {
                  window.__KLP__.addHorizontalRayLineAtLevel(targetPrice, 1640995200000, '#FFA500', 'Support -5%');
                }
              }
            }
          } catch(e) {
            console.error('Failed to add ray line:', e);
          }
        })();
      `);
    }
  };

  const addCustomRayLine = () => {
    // Add a ray line with custom color and label at current price
    if (chartRef.current) {
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.analyzeChart) {
              var analysis = window.__KLP__.analyzeChart();
              if (analysis && analysis.currentPrice) {
                if (window.__KLP__.addHorizontalRayLineAtLevel) {
                  window.__KLP__.addHorizontalRayLineAtLevel(analysis.currentPrice, Date.now(), '#FF5252', 'Current Price');
                }
              }
            }
          } catch(e) {
            console.error('Failed to add ray line:', e);
          }
        })();
      `);
    }
  };

  const addSupportResistanceLines = () => {
    // Add both support and resistance lines using utility function
    addSupportResistanceLevels(chartRef.current, 226, 220);
  };

  const addTestLine = () => {
    // Add a test line with a very visible color and fixed price
    if (chartRef.current) {
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            // Use a fixed price that should be visible (around current AAPL range)
            var testPrice = 225; // Fixed test price
            if (window.__KLP__ && window.__KLP__.addHorizontalRayLineAtLevel) {
              window.__KLP__.addHorizontalRayLineAtLevel(testPrice, Date.now(), '#FF00FF', 'TEST LINE - BRIGHT MAGENTA');
            }
          } catch(e) {
            console.error('Test line failed:', e);
          }
        })();
      `);
    }
  };

  const clearAllDrawings = () => {
    if (chartRef.current) {
      chartRef.current.clearAllDrawings();
    }
  };

  const testDirectAPI = () => {
    if (chartRef.current) {
      // Test direct KLineCharts API
      chartRef.current.testDirectOverlay(225, "horizontalStraightLine");
    }
  };

  const getSupportedOverlays = () => {
    if (chartRef.current) {
      chartRef.current.getSupportedOverlays();
    }
  };

  const debugWindowObjects = () => {
    if (chartRef.current) {
      chartRef.current.debugWindowObjects();
    }
  };

  return (
    <View style={styles.container}>
      <KLineProChart
        ref={chartRef}
        symbol={symbol}
        timeframe={timeframe}
        height={height}
        theme={theme}
        showYAxis={true}
      />

      {/* Control buttons */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={addRayLineAt45000}>
          <Text style={styles.buttonText}>Add Target Line (+5%)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#9C27B0" }]}
          onPress={testDirectAPI}
        >
          <Text style={styles.buttonText}>Test Direct API</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#607D8B" }]}
          onPress={getSupportedOverlays}
        >
          <Text style={styles.buttonText}>Get Supported Overlays</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#E91E63" }]}
          onPress={debugWindowObjects}
        >
          <Text style={styles.buttonText}>Debug Window Objects</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={addRayLineAt55000WithTimestamp}
        >
          <Text style={styles.buttonText}>Add Support Line (-5%)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resistanceButton]}
          onPress={addCustomRayLine}
        >
          <Text style={styles.buttonText}>Add Current Price Line</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.supportButton]}
          onPress={addSupportResistanceLines}
        >
          <Text style={styles.buttonText}>Add Support & Resistance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#FF00FF" }]}
          onPress={addTestLine}
        >
          <Text style={styles.buttonText}>Add Test Line (Magenta)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearAllDrawings}
        >
          <Text style={styles.buttonText}>Clear All Lines</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  controls: {
    padding: 16,
    gap: 12,
  },
  button: {
    backgroundColor: "#00D4AA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resistanceButton: {
    backgroundColor: "#FF5252",
  },
  supportButton: {
    backgroundColor: "#4CAF50",
  },
  clearButton: {
    backgroundColor: "#757575",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
