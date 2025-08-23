import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
} from "react-native";
import AIAnalysisChart from "./AIAnalysisChart";
import {
  AnalysisRequest,
  ParsedAnalysis,
} from "../../services/chartAnalysisPrompt";

// Mock LLM function - replace this with your actual LLM integration
const mockLLMAnalysis = async (
  prompt: string,
  request: AnalysisRequest
): Promise<string> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock LLM response with XML formatting
  return `
**Technical Analysis for ${request.symbol} (${request.timeframe} timeframe)**

The chart shows a strong bullish trend with price consolidating above key moving averages. RSI indicates healthy momentum without being overbought, while MACD shows positive divergence suggesting continued upward movement.

\`\`\`xml
<indicators>
  <indicator type="EMA" period="20" color="#00D4AA" />
  <indicator type="EMA" period="50" color="#FF6B35" />
  <indicator type="RSI" period="14" overbought="70" oversold="30" />
  <indicator type="MACD" fast="12" slow="26" signal="9" />
  <indicator type="BOLLINGER" period="20" deviation="2" />
</indicators>
\`\`\`

**Key Observations:**
- Price is trading above both 20 and 50 EMA, confirming bullish trend
- RSI at 62, showing strong momentum without being overbought
- MACD line above signal line with increasing histogram
- Bollinger Bands expanding, indicating increased volatility

\`\`\`xml
<trade_levels>
  <entry price="152.75" color="#00D4AA" label="Breakout Entry" confidence="85%" />
  <exit price="161.50" color="#4CAF50" label="Target Exit" rr_ratio="1:2.1" />
  <stop_loss price="148.20" color="#FF5252" label="Support Break" risk_percent="3%" />
  <take_profit price="165.80" color="#2196F3" label="Extended Target" />
</trade_levels>
\`\`\`

\`\`\`xml
<trade_zones>
  <zone 
    entry_price="152.75" 
    exit_price="161.50" 
    stop_loss="148.20" 
    take_profit="165.80"
    start_time="2024-01-15T09:30:00Z"
    end_time="2024-01-22T16:00:00Z"
    type="long"
    color="rgba(0, 212, 170, 0.25)"
    label="Bullish Breakout Trade"
    confidence="85%"
    risk_reward="1:2.1"
  />
</trade_zones>
\`\`\`

\`\`\`xml
<levels>
  <support price="148.20" strength="strong" label="Key Support Zone" />
  <resistance price="165.80" strength="moderate" label="Previous High" />
  <pivot price="155.50" type="daily" label="Daily Pivot Point" />
</levels>
\`\`\`

\`\`\`xml
<patterns>
  <pattern 
    type="ascending_triangle" 
    confidence="78%" 
    breakout_target="168.00"
    timeframe="4h"
    status="forming"
  />
</patterns>
\`\`\`

**Trading Strategy:**
1. **Entry**: Wait for breakout above $152.75 with volume confirmation
2. **Position Size**: Risk 2% of portfolio (based on stop loss distance)
3. **Stop Loss**: Place below key support at $148.20
4. **Take Profit**: Primary target at $161.50, extended target at $165.80
5. **Risk/Reward**: 1:2.1 ratio provides favorable risk-adjusted returns

**Risk Considerations:**
- Market volatility could trigger stop loss prematurely
- Watch for volume confirmation on breakout
- Consider scaling out at partial profit levels
- Monitor broader market conditions for correlation risks
  `;
};

export default function LLMChartIntegrationExample() {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [selectedTimeframe, setSelectedTimeframe] = useState("4h");
  const [analysisResults, setAnalysisResults] = useState<ParsedAnalysis | null>(
    null
  );
  const [customPrompt, setCustomPrompt] = useState("");

  const symbols = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"];
  const timeframes = ["1h", "4h", "1d", "1w"];

  const handleAnalysisComplete = (analysis: ParsedAnalysis) => {
    setAnalysisResults(analysis);
    console.log("Analysis completed:", analysis);
  };

  // Your actual LLM integration function would go here
  const yourLLMFunction = async (
    prompt: string,
    request: AnalysisRequest
  ): Promise<string> => {
    // Replace this with your actual LLM API call
    // Example integrations:

    // OpenAI GPT-4
    // const response = await openai.chat.completions.create({
    //   model: "gpt-4",
    //   messages: [{ role: "user", content: prompt }],
    //   temperature: 0.1
    // });
    // return response.choices[0].message.content;

    // Anthropic Claude
    // const response = await anthropic.messages.create({
    //   model: "claude-3-sonnet-20240229",
    //   messages: [{ role: "user", content: prompt }],
    //   max_tokens: 2000
    // });
    // return response.content[0].text;

    // Local LLM (Ollama, etc.)
    // const response = await fetch('http://localhost:11434/api/generate', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     model: 'llama2',
    //     prompt: prompt,
    //     stream: false
    //   })
    // });
    // const data = await response.json();
    // return data.response;

    // For now, use the mock function
    return mockLLMAnalysis(prompt, request);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🤖 LLM Chart Analysis Integration</Text>

      <Text style={styles.description}>
        This example shows how to integrate your LLM with the chart analysis
        system. The LLM will analyze the chart and automatically draw
        indicators, entry/exit levels, and trade zones using XML-formatted
        responses.
      </Text>

      {/* Symbol and Timeframe Selection */}
      <View style={styles.selectionContainer}>
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>Symbol:</Text>
          <View style={styles.buttonGroup}>
            {symbols.map((symbol) => (
              <TouchableOpacity
                key={symbol}
                style={[
                  styles.selectorButton,
                  selectedSymbol === symbol && styles.selectedButton,
                ]}
                onPress={() => setSelectedSymbol(symbol)}
              >
                <Text
                  style={[
                    styles.selectorButtonText,
                    selectedSymbol === symbol && styles.selectedButtonText,
                  ]}
                >
                  {symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>Timeframe:</Text>
          <View style={styles.buttonGroup}>
            {timeframes.map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.selectorButton,
                  selectedTimeframe === tf && styles.selectedButton,
                ]}
                onPress={() => setSelectedTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.selectorButtonText,
                    selectedTimeframe === tf && styles.selectedButtonText,
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* AI Analysis Chart */}
      <AIAnalysisChart
        symbol={selectedSymbol}
        timeframe={selectedTimeframe}
        height={400}
        theme="dark"
        market="stocks"
        onAnalysisComplete={handleAnalysisComplete}
        llmAnalysisFunction={yourLLMFunction}
      />

      {/* Custom Prompt Input */}
      <View style={styles.promptContainer}>
        <Text style={styles.promptLabel}>Custom Analysis Prompt:</Text>
        <TextInput
          style={styles.promptInput}
          multiline
          numberOfLines={4}
          placeholder="Add custom instructions for the LLM analysis..."
          placeholderTextColor="#666"
          value={customPrompt}
          onChangeText={setCustomPrompt}
        />
        <Text style={styles.promptHint}>
          💡 Tip: Ask for specific analysis like "Focus on scalping
          opportunities" or "Look for swing trade setups with 1:3 risk/reward"
        </Text>
      </View>

      {/* Integration Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>
          🔧 Integration Instructions
        </Text>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>1.</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Replace the Mock LLM Function</Text>
            <Text style={styles.stepText}>
              Update the `yourLLMFunction` in this component to call your actual
              LLM API (OpenAI GPT-4, Anthropic Claude, local LLM, etc.)
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>2.</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Ensure XML Response Format</Text>
            <Text style={styles.stepText}>
              Make sure your LLM is instructed to use the XML format specified
              in the system prompt for indicators, trade levels, and trade
              zones.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>3.</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Real Chart Data</Text>
            <Text style={styles.stepText}>
              Connect real OHLCV data to the AnalysisRequest to provide the LLM
              with actual market data for analysis.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>4.</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Customize Analysis Types</Text>
            <Text style={styles.stepText}>
              Implement different analysis presets (scalping, swing trading,
              etc.) by modifying the system prompt based on user selection.
            </Text>
          </View>
        </View>
      </View>

      {/* Example XML Output */}
      <View style={styles.xmlExampleContainer}>
        <Text style={styles.xmlTitle}>📋 Expected LLM XML Output Format</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.xmlCode}>
            {`<indicators>
  <indicator type="EMA" period="20" color="#00D4AA" />
  <indicator type="RSI" period="14" overbought="70" oversold="30" />
</indicators>

<trade_levels>
  <entry price="152.75" color="#00D4AA" label="Entry" confidence="85%" />
  <stop_loss price="148.20" color="#FF5252" label="Stop Loss" />
  <take_profit price="161.50" color="#4CAF50" label="Take Profit" />
</trade_levels>

<trade_zones>
  <zone 
    entry_price="152.75" 
    exit_price="161.50" 
    stop_loss="148.20" 
    take_profit="161.50"
    type="long"
    color="rgba(0, 212, 170, 0.25)"
    label="Bullish Trade"
    confidence="85%"
    risk_reward="1:2.1"
  />
</trade_zones>`}
          </Text>
        </ScrollView>
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
  description: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  selectionContainer: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  selectorGroup: {
    marginBottom: 16,
  },
  selectorLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  selectorButton: {
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedButton: {
    backgroundColor: "#00D4AA",
  },
  selectorButtonText: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedButtonText: {
    color: "#fff",
  },
  promptContainer: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  promptLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: "#333",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  promptHint: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  instructionsContainer: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    color: "#00D4AA",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  step: {
    flexDirection: "row",
    marginBottom: 16,
  },
  stepNumber: {
    color: "#00D4AA",
    fontSize: 18,
    fontWeight: "bold",
    marginRight: 12,
    minWidth: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  stepText: {
    color: "#ccc",
    fontSize: 12,
    lineHeight: 16,
  },
  xmlExampleContainer: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  xmlTitle: {
    color: "#00D4AA",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  xmlCode: {
    color: "#ccc",
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 14,
    backgroundColor: "#0a0a0a",
    padding: 12,
    borderRadius: 6,
  },
});
