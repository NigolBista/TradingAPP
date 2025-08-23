# LLM Chart Analysis Integration Guide

This guide explains how to integrate your LLM with the chart analysis system to enable automatic technical analysis, indicator placement, and trade visualization.

## 🎯 Overview

The system allows your LLM to:

- **Analyze charts** using technical indicators
- **Draw entry/exit levels** automatically
- **Create trade zones** with risk management
- **Add technical indicators** to charts
- **Provide detailed analysis** with confidence levels

## 🔧 System Architecture

```
User Request → LLM Analysis → XML Parser → Chart Visualization
     ↓              ↓            ↓              ↓
  "Analyze      System Prompt   Extract Data   Draw on Chart
   AAPL 4H"    + Chart Data    from XML       + Show Results
```

## 📋 LLM System Prompt

The LLM receives a comprehensive system prompt that includes:

### Available Tools

- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, etc.
- **Drawing Tools**: Price lines, trade zones, support/resistance levels
- **Pattern Recognition**: Triangles, flags, head & shoulders, etc.
- **Risk Management**: Stop loss, take profit, position sizing

### Required XML Output Format

The LLM must respond using specific XML tags:

#### 1. Technical Indicators

```xml
<indicators>
  <indicator type="EMA" period="20" color="#00D4AA" />
  <indicator type="RSI" period="14" overbought="70" oversold="30" />
  <indicator type="MACD" fast="12" slow="26" signal="9" />
</indicators>
```

#### 2. Trade Levels

```xml
<trade_levels>
  <entry price="152.75" color="#00D4AA" label="Entry" confidence="85%" />
  <stop_loss price="148.20" color="#FF5252" label="Stop Loss" />
  <take_profit price="161.50" color="#4CAF50" label="Take Profit" />
</trade_levels>
```

#### 3. Trade Zones

```xml
<trade_zones>
  <zone
    entry_price="152.75"
    exit_price="161.50"
    stop_loss="148.20"
    take_profit="161.50"
    type="long"
    color="rgba(0, 212, 170, 0.25)"
    label="Bullish Breakout"
    confidence="85%"
    risk_reward="1:2.1"
  />
</trade_zones>
```

## 🚀 Implementation Steps

### Step 1: Set Up the System Prompt

```typescript
import { CHART_ANALYSIS_SYSTEM_PROMPT } from "./services/chartAnalysisPrompt";

const analysisPrompt = `
${CHART_ANALYSIS_SYSTEM_PROMPT}

## Current Analysis Request
Symbol: ${symbol}
Timeframe: ${timeframe}
Market: ${market}

Please analyze this chart and provide XML-formatted recommendations.
`;
```

### Step 2: Create Your LLM Function

```typescript
const yourLLMFunction = async (
  prompt: string,
  request: AnalysisRequest
): Promise<string> => {
  // OpenAI GPT-4 Example
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2000,
  });

  return response.choices[0].message.content;

  // Anthropic Claude Example
  // const response = await anthropic.messages.create({
  //   model: "claude-3-sonnet-20240229",
  //   messages: [{ role: "user", content: prompt }],
  //   max_tokens: 2000
  // });
  // return response.content[0].text;
};
```

### Step 3: Parse LLM Response

```typescript
import { AnalysisParser } from "./services/analysisParser";

const llmResponse = await yourLLMFunction(prompt, request);
const parsedAnalysis = AnalysisParser.parseAnalysisResponse(llmResponse);
const chartData = AnalysisParser.toChartFormat(parsedAnalysis);
```

### Step 4: Apply to Chart

```typescript
// Update chart with analysis results
setTradeLevels(chartData.tradeLevels);
setTradeZones(chartData.tradeZones);
setIndicators(chartData.indicators);
```

## 📊 Complete Integration Example

```typescript
import React from "react";
import AIAnalysisChart from "./components/charts/AIAnalysisChart";

export default function TradingApp() {
  const handleLLMAnalysis = async (
    prompt: string,
    request: AnalysisRequest
  ) => {
    // Your LLM integration here
    const response = await callYourLLM(prompt);
    return response;
  };

  return (
    <AIAnalysisChart
      symbol="AAPL"
      timeframe="4h"
      height={400}
      theme="dark"
      market="stocks"
      llmAnalysisFunction={handleLLMAnalysis}
      onAnalysisComplete={(analysis) => {
        console.log("Analysis completed:", analysis);
        // Handle the parsed analysis results
      }}
    />
  );
}
```

## 🎯 LLM Response Examples

### Example 1: Bullish Analysis

````
**Technical Analysis for AAPL (4H Timeframe)**

The chart shows a strong bullish breakout from an ascending triangle pattern.
Price is above all major moving averages with increasing volume.

```xml
<indicators>
  <indicator type="EMA" period="20" color="#00D4AA" />
  <indicator type="EMA" period="50" color="#FF6B35" />
  <indicator type="RSI" period="14" overbought="70" oversold="30" />
</indicators>
````

**Analysis**: RSI at 65 shows strong momentum. MACD bullish crossover confirmed.

```xml
<trade_levels>
  <entry price="152.75" color="#00D4AA" label="Breakout Entry" confidence="85%" />
  <stop_loss price="148.20" color="#FF5252" label="Support Break" />
  <take_profit price="161.50" color="#4CAF50" label="Pattern Target" />
</trade_levels>
```

```xml
<trade_zones>
  <zone
    entry_price="152.75"
    exit_price="161.50"
    stop_loss="148.20"
    take_profit="161.50"
    type="long"
    color="rgba(0, 212, 170, 0.25)"
    label="Triangle Breakout"
    confidence="85%"
    risk_reward="1:1.9"
  />
</trade_zones>
```

**Trading Plan**: Enter long on breakout with 2% risk, target 1:1.9 R/R ratio.

```

### Example 2: Bearish Analysis

```

**Technical Analysis for TSLA (1H Timeframe)**

Bearish head and shoulders pattern forming. Price rejected at resistance with declining volume.

```xml
<indicators>
  <indicator type="SMA" period="20" color="#FF5252" />
  <indicator type="RSI" period="14" overbought="70" oversold="30" />
  <indicator type="BOLLINGER" period="20" deviation="2" />
</indicators>
```

```xml
<trade_levels>
  <entry price="245.50" color="#FF5252" label="Short Entry" confidence="78%" />
  <stop_loss price="252.00" color="#00D4AA" label="Pattern Invalidation" />
  <take_profit price="235.00" color="#4CAF50" label="Support Target" />
</trade_levels>
```

```xml
<trade_zones>
  <zone
    entry_price="245.50"
    exit_price="235.00"
    stop_loss="252.00"
    take_profit="235.00"
    type="short"
    color="rgba(255, 82, 82, 0.25)"
    label="H&S Breakdown"
    confidence="78%"
    risk_reward="1:1.6"
  />
</trade_zones>
```

````

## 🛠️ Advanced Features

### Custom Analysis Types

```typescript
// Scalping Analysis
const scalpingPrompt = `
${CHART_ANALYSIS_SYSTEM_PROMPT}

Focus on 1-5 minute scalping opportunities with:
- Quick entry/exit levels
- Tight stop losses (0.5-1% risk)
- High probability setups only
- Volume confirmation required
`;

// Swing Trading Analysis
const swingPrompt = `
${CHART_ANALYSIS_SYSTEM_PROMPT}

Analyze for swing trading opportunities with:
- 3-10 day holding periods
- 1:3 minimum risk/reward ratios
- Multi-timeframe confirmation
- Key support/resistance levels
`;
````

### Real-Time Data Integration

```typescript
const analysisRequest: AnalysisRequest = {
  symbol: "AAPL",
  timeframe: "4h",
  currentPrice: getCurrentPrice("AAPL"),
  ohlcData: getOHLCData("AAPL", "4h", 100), // Last 100 candles
  volumeData: getVolumeData("AAPL", "4h", 100),
  indicators: ["SMA", "EMA", "RSI", "MACD"],
  analysisType: "detailed",
};
```

### Error Handling

```typescript
const parseWithFallback = (llmResponse: string) => {
  try {
    return AnalysisParser.parseAnalysisResponse(llmResponse);
  } catch (error) {
    console.error("XML parsing failed:", error);

    // Fallback: Extract basic price levels from text
    return extractBasicLevels(llmResponse);
  }
};
```

## 📈 Chart Visualization

The parsed analysis automatically creates:

### Visual Elements

- **Price Lines**: Horizontal lines at entry/exit levels
- **Trade Rectangles**: Colored zones showing trade ranges
- **Technical Indicators**: Overlays on the chart
- **Labels**: Clear text labels for all levels

### Interactive Features

- **Click to analyze**: Trigger analysis with button press
- **Real-time updates**: Analysis updates with new data
- **Multiple timeframes**: Switch between different timeframes
- **Export results**: Save analysis for later review

## 🔒 Best Practices

### 1. Prompt Engineering

- Be specific about analysis requirements
- Include risk management instructions
- Specify confidence level requirements
- Request multiple timeframe analysis

### 2. Data Validation

- Validate XML format before parsing
- Check price levels are reasonable
- Verify risk/reward ratios
- Confirm indicator parameters

### 3. Error Handling

- Implement fallback parsing methods
- Handle API rate limits gracefully
- Provide user feedback on failures
- Log errors for debugging

### 4. Performance Optimization

- Cache analysis results
- Implement request throttling
- Use streaming for real-time updates
- Optimize chart rendering

## 🚀 Getting Started

1. **Install Dependencies**

   ```bash
   npm install @klinecharts/pro react-native-webview
   ```

2. **Set Up LLM Integration**

   - Choose your LLM provider (OpenAI, Anthropic, etc.)
   - Configure API credentials
   - Test with the provided examples

3. **Implement Components**

   - Use `AIAnalysisChart` for full integration
   - Customize the system prompt for your needs
   - Add your LLM function

4. **Test and Deploy**
   - Test with various symbols and timeframes
   - Validate XML parsing accuracy
   - Monitor performance and error rates

## 📞 Support

For issues or questions:

- Check the example implementations
- Review the XML format requirements
- Test with the mock LLM function first
- Ensure your LLM follows the system prompt

This integration provides a complete solution for AI-powered chart analysis with automatic visualization of trading opportunities!
