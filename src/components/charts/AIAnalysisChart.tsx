import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import KLineProChart, {
  TradeLevel,
  TradeZone,
  ChartAnalysis,
} from "./KLineProChart";
import { AnalysisParser } from "../../services/analysisParser";
import {
  CHART_ANALYSIS_SYSTEM_PROMPT,
  AnalysisRequest,
  ParsedAnalysis,
  TechnicalIndicator,
} from "../../services/chartAnalysisPrompt";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex";
  onAnalysisComplete?: (analysis: ParsedAnalysis) => void;
  llmAnalysisFunction?: (
    prompt: string,
    request: AnalysisRequest
  ) => Promise<string>;
}

export default function AIAnalysisChart({
  symbol,
  timeframe = "4h",
  height = 400,
  theme = "dark",
  market = "stocks",
  onAnalysisComplete,
  llmAnalysisFunction,
}: Props) {
  const [tradeLevels, setTradeLevels] = useState<TradeLevel[]>([]);
  const [tradeZones, setTradeZones] = useState<TradeZone[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([]);
  const [analysis, setAnalysis] = useState<ParsedAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const chartRef = useRef<any>(null);

  /**
   * Trigger AI analysis of the current chart
   */
  const handleAIAnalysis = useCallback(async () => {
    if (!llmAnalysisFunction) {
      console.warn("No LLM analysis function provided");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Get current chart data (this would come from your chart data source)
      const analysisRequest: AnalysisRequest = {
        symbol,
        timeframe,
        currentPrice: 0, // This should be populated with real data
        analysisType: "detailed",
        indicators: ["SMA", "EMA", "RSI", "MACD", "BOLLINGER"],
      };

      // Create the analysis prompt
      const analysisPrompt = `
${CHART_ANALYSIS_SYSTEM_PROMPT}

## Current Chart Analysis Request

**Symbol**: ${symbol}
**Timeframe**: ${timeframe}
**Market**: ${market}

Please analyze the current chart for ${symbol} on the ${timeframe} timeframe and provide:

1. **Technical Indicators**: Add relevant indicators (SMA, EMA, RSI, MACD, etc.)
2. **Entry/Exit Levels**: Identify optimal entry and exit points
3. **Risk Management**: Provide stop loss and take profit levels
4. **Trade Zones**: Draw colored rectangles showing trade opportunities
5. **Support/Resistance**: Mark key price levels
6. **Pattern Analysis**: Identify any chart patterns

**IMPORTANT**: Format your response using the XML tags as specified in the system prompt so our parser can extract and visualize your recommendations on the chart.

Provide a comprehensive analysis with high confidence levels and clear reasoning for each recommendation.
      `;

      // Call the LLM analysis function
      const llmResponse = await llmAnalysisFunction(
        analysisPrompt,
        analysisRequest
      );

      // Parse the LLM response
      const parsedAnalysis = AnalysisParser.parseAnalysisResponse(llmResponse);

      // Convert to chart format
      const chartData = AnalysisParser.toChartFormat(parsedAnalysis);

      // Update chart with analysis results
      setTradeLevels(chartData.tradeLevels);
      setTradeZones(chartData.tradeZones);
      setIndicators(chartData.indicators);
      setAnalysis(parsedAnalysis);
      setAnalysisText(parsedAnalysis.textAnalysis);

      // Apply indicators to chart
      if (chartData.indicators.length > 0) {
        applyIndicatorsToChart(chartData.indicators);
      }

      // Callback for parent component
      if (onAnalysisComplete) {
        onAnalysisComplete(parsedAnalysis);
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [symbol, timeframe, market, llmAnalysisFunction, onAnalysisComplete]);

  /**
   * Apply technical indicators to the chart
   */
  const applyIndicatorsToChart = (indicators: TechnicalIndicator[]) => {
    if (!chartRef.current) return;

    indicators.forEach((indicator) => {
      const indicatorScript = `
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.addIndicator) {
              window.__KLP__.addIndicator({
                type: "${indicator.type}",
                period: ${indicator.period || 20},
                color: "${indicator.color}",
                parameters: ${JSON.stringify(indicator.parameters || {})}
              });
            }
          } catch(e) {
            console.error('Failed to add indicator:', e);
          }
        })();
      `;

      chartRef.current.injectJavaScript(indicatorScript);
    });
  };

  /**
   * Clear all analysis and drawings
   */
  const clearAnalysis = () => {
    setTradeLevels([]);
    setTradeZones([]);
    setIndicators([]);
    setAnalysis(null);
    setAnalysisText("");

    if (chartRef.current) {
      chartRef.current.injectJavaScript(`
        (function(){
          try {
            if (window.__KLP__ && window.__KLP__.clearAllDrawings) {
              window.__KLP__.clearAllDrawings();
            }
            if (window.__KLP__ && window.__KLP__.clearIndicators) {
              window.__KLP__.clearIndicators();
            }
          } catch(e) {
            console.error('Failed to clear analysis:', e);
          }
        })();
      `);
    }
  };

  /**
   * Handle manual chart analysis (from chart component)
   */
  const handleChartAnalysis = (chartAnalysis: ChartAnalysis) => {
    // This is the basic analysis from the chart component
    // You can combine this with AI analysis or use it as fallback
    console.log("Chart Analysis:", chartAnalysis);
  };

  /**
   * Quick analysis presets
   */
  const runQuickAnalysis = (type: "scalp" | "swing" | "position") => {
    // Implement quick analysis presets
    console.log(`Running ${type} analysis...`);
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
        onTradeAnalysis={handleChartAnalysis}
      />

      {/* Analysis Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.aiButton]}
          onPress={handleAIAnalysis}
          disabled={isAnalyzing || !llmAnalysisFunction}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>🤖 AI Analysis</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.scalpButton]}
          onPress={() => runQuickAnalysis("scalp")}
          disabled={isAnalyzing}
        >
          <Text style={styles.buttonText}>⚡ Scalp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.swingButton]}
          onPress={() => runQuickAnalysis("swing")}
          disabled={isAnalyzing}
        >
          <Text style={styles.buttonText}>📈 Swing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearAnalysis}
        >
          <Text style={styles.buttonText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Analysis Results */}
      {analysis && (
        <ScrollView style={styles.analysisContainer}>
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
              🎯 AI Analysis Results
            </Text>

            {/* Indicators Summary */}
            {indicators.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    theme === "dark" ? styles.darkText : styles.lightText,
                  ]}
                >
                  📊 Active Indicators ({indicators.length})
                </Text>
                {indicators.map((indicator, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.indicatorText,
                      theme === "dark" ? styles.darkText : styles.lightText,
                    ]}
                  >
                    • {indicator.type}{" "}
                    {indicator.period ? `(${indicator.period})` : ""}
                  </Text>
                ))}
              </View>
            )}

            {/* Trade Levels Summary */}
            {tradeLevels.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    theme === "dark" ? styles.darkText : styles.lightText,
                  ]}
                >
                  🎯 Trade Levels ({tradeLevels.length})
                </Text>
                {tradeLevels.map((level, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.levelText,
                      theme === "dark" ? styles.darkText : styles.lightText,
                    ]}
                  >
                    • {level.label}: ${level.price.toFixed(2)}
                  </Text>
                ))}
              </View>
            )}

            {/* Trade Zones Summary */}
            {tradeZones.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    theme === "dark" ? styles.darkText : styles.lightText,
                  ]}
                >
                  📦 Trade Zones ({tradeZones.length})
                </Text>
                {tradeZones.map((zone, index) => (
                  <View key={index} style={styles.zoneInfo}>
                    <Text
                      style={[
                        styles.zoneText,
                        theme === "dark" ? styles.darkText : styles.lightText,
                      ]}
                    >
                      • {zone.label} ({zone.type.toUpperCase()})
                    </Text>
                    <Text
                      style={[
                        styles.zoneDetails,
                        theme === "dark" ? styles.darkText : styles.lightText,
                      ]}
                    >
                      Entry: ${zone.entryPrice.toFixed(2)} | Exit: $
                      {zone.exitPrice.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.zoneDetails,
                        theme === "dark" ? styles.darkText : styles.lightText,
                      ]}
                    >
                      R/R: {zone.riskReward} | Confidence: {zone.confidence}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Text Analysis */}
            {analysisText && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    theme === "dark" ? styles.darkText : styles.lightText,
                  ]}
                >
                  📝 Analysis Summary
                </Text>
                <Text
                  style={[
                    styles.analysisText,
                    theme === "dark" ? styles.darkText : styles.lightText,
                  ]}
                >
                  {analysisText}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>
            🤖 AI is analyzing the chart...
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
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: "center",
  },
  aiButton: {
    backgroundColor: "#00D4AA",
  },
  scalpButton: {
    backgroundColor: "#FF6B35",
  },
  swingButton: {
    backgroundColor: "#4ECDC4",
  },
  clearButton: {
    backgroundColor: "#FF5252",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 12,
  },
  analysisContainer: {
    maxHeight: 300,
  },
  analysisPanel: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
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
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
  },
  indicatorText: {
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 8,
  },
  levelText: {
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 8,
  },
  zoneInfo: {
    marginLeft: 8,
    marginBottom: 8,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: "600",
  },
  zoneDetails: {
    fontSize: 11,
    opacity: 0.8,
    marginLeft: 8,
  },
  analysisText: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 8,
  },
  darkText: {
    color: "#fff",
  },
  lightText: {
    color: "#333",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
});
