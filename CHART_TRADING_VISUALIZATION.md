# Chart Trading Visualization Guide

This guide explains how to use the enhanced KLineProChart component with automatic trade visualization capabilities.

## Overview

The enhanced chart component now supports:

- **Price Lines**: Horizontal lines for entry/exit levels
- **Trade Zones**: Colored rectangles representing trade positions
- **Automatic Analysis**: Built-in technical analysis with suggested trade levels
- **Interactive Drawing**: Programmatic control of chart drawings

## Key Features

### 1. Drawing Tools Integration

- ✅ **Price Lines** - Horizontal lines that move with price scale
- ✅ **Trade Rectangles** - Colored zones anchored to time and price
- ✅ **Stop Loss/Take Profit** - Automatic level visualization
- ✅ **Chart Analysis** - Built-in technical analysis engine

### 2. Movement Behavior

- **Price Lines**: Stay fixed at price levels, extend across chart width
- **Trade Zones**: Move with both time and price, scale with zoom
- **Drawings**: Persist through chart navigation and timeframe changes

## Usage Examples

### Basic Price Lines

```tsx
import KLineProChart, { TradeLevel } from "./components/charts/KLineProChart";

const tradeLevels: TradeLevel[] = [
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

<KLineProChart symbol="AAPL" tradeLevels={tradeLevels} showYAxis={true} />;
```

### Trade Zones (Rectangles)

```tsx
import { TradeZone } from "./components/charts/KLineProChart";

const tradeZones: TradeZone[] = [
  {
    entryPrice: 150.5,
    exitPrice: 155.0,
    stopLoss: 147.0,
    takeProfit: 158.0,
    startTime: Date.now() - 86400000, // 1 day ago
    endTime: Date.now() + 86400000, // 1 day from now
    color: "rgba(0, 212, 170, 0.2)",
    label: "Long Position",
    type: "long",
  },
];

<KLineProChart symbol="AAPL" tradeZones={tradeZones} showYAxis={true} />;
```

### Automatic Chart Analysis

```tsx
import { ChartAnalysis } from "./components/charts/KLineProChart";

const handleAnalysis = (analysis: ChartAnalysis) => {
  console.log("Current Price:", analysis.currentPrice);
  console.log("Trend:", analysis.trend);
  console.log("Suggested Entry:", analysis.suggestedEntry);
  console.log("Suggested Exit:", analysis.suggestedExit);
  console.log("Stop Loss:", analysis.stopLoss);
  console.log("Take Profit:", analysis.takeProfit);

  // Use analysis to automatically place trades
  // or update your trading strategy
};

<KLineProChart
  symbol="AAPL"
  onTradeAnalysis={handleAnalysis}
  showYAxis={true}
/>;
```

### Interactive Analysis Component

```tsx
import TradeAnalysisChart from "./components/charts/TradeAnalysisChart";

<TradeAnalysisChart
  symbol="TSLA"
  timeframe="4h"
  height={400}
  theme="dark"
  market="stocks"
/>;
```

## Programmatic Control

### JavaScript API

The chart exposes a JavaScript API through `window.__KLP__`:

```javascript
// Draw price line
window.__KLP__.drawPriceLine(150.5, "#00D4AA", "Entry Level");

// Draw trade zone
window.__KLP__.drawTradeZone(
  150.5, // entryPrice
  155.0, // exitPrice
  Date.now() - 86400000, // startTime
  Date.now() + 86400000, // endTime
  "rgba(0, 212, 170, 0.2)", // color
  "Long Position", // label
  "long" // type
);

// Draw stop loss
window.__KLP__.drawStopLoss(147.0, "#FF5252", "Stop Loss");

// Draw take profit
window.__KLP__.drawTakeProfit(158.0, "#4CAF50", "Take Profit");

// Analyze chart
const analysis = window.__KLP__.analyzeChart();

// Clear all drawings
window.__KLP__.clearAllDrawings();
```

### React Native Integration

```tsx
import { useRef } from "react";

const chartRef = useRef<any>(null);

const analyzeChart = () => {
  chartRef.current?.injectJavaScript(`
    (function(){
      if (window.__KLP__ && window.__KLP__.analyzeChart) {
        window.__KLP__.analyzeChart();
      }
    })();
  `);
};

const clearDrawings = () => {
  chartRef.current?.injectJavaScript(`
    (function(){
      if (window.__KLP__ && window.__KLP__.clearAllDrawings) {
        window.__KLP__.clearAllDrawings();
      }
    })();
  `);
};

<KLineProChart
  ref={chartRef}
  symbol="AAPL"
  onTradeAnalysis={(analysis) => {
    // Handle analysis results
    console.log("Analysis:", analysis);
  }}
/>;
```

## Data Structures

### TradeLevel Interface

```tsx
interface TradeLevel {
  price: number; // Price level for the line
  timestamp?: number; // Optional timestamp for time-based anchoring
  color?: string; // Line color (default: '#00D4AA')
  label?: string; // Text label for the line
}
```

### TradeZone Interface

```tsx
interface TradeZone {
  entryPrice: number; // Entry price level
  exitPrice: number; // Exit price level
  stopLoss?: number; // Optional stop loss level
  takeProfit?: number; // Optional take profit level
  startTime?: number; // Start timestamp (default: 1 day ago)
  endTime?: number; // End timestamp (default: now)
  color?: string; // Rectangle color
  label?: string; // Text label
  type?: "long" | "short"; // Trade direction
}
```

### ChartAnalysis Interface

```tsx
interface ChartAnalysis {
  symbol: string; // Stock symbol
  currentPrice: number; // Current market price
  trend: "bullish" | "bearish" | "sideways"; // Market trend
  resistance: number; // Resistance level
  support: number; // Support level
  sma20: number; // 20-period simple moving average
  sma50: number; // 50-period simple moving average
  suggestedEntry: number; // Suggested entry price
  suggestedExit: number; // Suggested exit price
  stopLoss: number; // Suggested stop loss
  takeProfit: number; // Suggested take profit
  timestamp: number; // Analysis timestamp
}
```

## Color Schemes

### Default Colors

- **Entry Level**: `#00D4AA` (Teal)
- **Take Profit**: `#4CAF50` (Green)
- **Stop Loss**: `#FF5252` (Red)
- **Long Position**: `rgba(0, 212, 170, 0.2)` (Transparent Teal)
- **Short Position**: `rgba(255, 82, 82, 0.2)` (Transparent Red)

### Custom Colors

You can customize colors for any drawing element:

```tsx
const customTradeLevels: TradeLevel[] = [
  {
    price: 150.5,
    color: "#FFD700", // Gold
    label: "Golden Entry",
  },
];
```

## Best Practices

### 1. Performance

- Limit the number of drawings on screen (max 10-15 elements)
- Clear old drawings when adding new ones
- Use appropriate time ranges for trade zones

### 2. User Experience

- Use consistent color schemes
- Provide clear labels for all levels
- Show analysis results in a separate panel

### 3. Trading Integration

- Validate analysis results before placing trades
- Implement proper risk management
- Store analysis history for backtesting

## Example Implementation

See the complete example in `ChartWithTradeExample.tsx` which demonstrates:

- Basic price lines
- Interactive analysis
- Trade zone visualization
- Programmatic control

## Integration with Trading Systems

### Automatic Trade Execution

```tsx
const handleTradeAnalysis = async (analysis: ChartAnalysis) => {
  if (
    analysis.trend === "bullish" &&
    analysis.currentPrice <= analysis.suggestedEntry
  ) {
    // Place long order
    await placeOrder({
      symbol: analysis.symbol,
      side: "buy",
      quantity: calculatePosition(analysis),
      price: analysis.suggestedEntry,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit,
    });
  }
};
```

### Risk Management

```tsx
const calculatePosition = (analysis: ChartAnalysis) => {
  const riskAmount = portfolioValue * 0.02; // 2% risk
  const stopDistance = Math.abs(analysis.suggestedEntry - analysis.stopLoss);
  return Math.floor(riskAmount / stopDistance);
};
```

This enhanced chart component provides a complete solution for visualizing trading opportunities directly on price charts, with both manual and automatic analysis capabilities.
