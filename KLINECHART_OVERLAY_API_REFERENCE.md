# KLineChart Overlay API Reference

## Overview

This document provides a complete API reference for the KLineChart overlay system implemented in your application. The API is accessible through multiple interfaces: React refs, JavaScript injection, and utility functions.

## Table of Contents

1. [React Ref API](#react-ref-api)
2. [Window.**KLP** JavaScript API](#windowklp-javascript-api)
3. [Utility Functions API](#utility-functions-api)
4. [Data Types](#data-types)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## React Ref API

Access these methods through the chart ref: `chartRef.current?.methodName()`

### Core Drawing Methods

#### `addHorizontalRayLineAtLevel(priceLevel, timestamp?, color?, label?)`

Adds a horizontal ray line at the specified price level.

**Parameters:**

- `priceLevel: number` - The price level where to draw the line
- `timestamp?: number` - Optional timestamp for anchoring (defaults to current time)
- `color?: string` - Optional color (defaults to theme color)
- `label?: string` - Optional label text

**Example:**

```typescript
chartRef.current?.addHorizontalRayLineAtLevel(
  225,
  Date.now(),
  "#00D4AA",
  "Target Price"
);
```

#### `clearAllDrawings()`

Removes all overlay drawings from the chart.

**Example:**

```typescript
chartRef.current?.clearAllDrawings();
```

#### `testDirectOverlay(priceLevel, overlayType?)`

Tests direct overlay creation using KLineCharts API.

**Parameters:**

- `priceLevel: number` - Price level for the overlay
- `overlayType?: string` - Overlay type (defaults to 'horizontalStraightLine')

**Example:**

```typescript
chartRef.current?.testDirectOverlay(225, "horizontalRayLine");
```

### Indicator Methods

#### `showIndicators()`

Shows technical indicators on the chart.

#### `hideIndicators()`

Hides technical indicators on the chart.

#### `clearIndicators()`

Removes all technical indicators from the chart.

### Debug Methods

#### `getSupportedOverlays()`

Logs supported overlay types to console.

#### `debugWindowObjects()`

Logs detailed information about available window objects and methods.

### JavaScript Injection

#### `injectJavaScript(script: string)`

Injects custom JavaScript code into the WebView.

**Parameters:**

- `script: string` - JavaScript code to execute

**Example:**

```typescript
chartRef.current?.injectJavaScript(`
  window.__KLP__?.drawPriceLine(225, '#00D4AA', 'Target');
`);
```

---

## Window.**KLP** JavaScript API

Access these methods within injected JavaScript: `window.__KLP__.methodName()`

### Core Drawing Functions

#### `drawPriceLine(price, color?, label?)`

Draws a horizontal price line.

**Parameters:**

- `price: number` - Price level
- `color?: string` - Line color (defaults to '#00D4AA')
- `label?: string` - Line label

**Returns:** `string | null` - Overlay ID or null if failed

**Example:**

```javascript
var lineId = window.__KLP__.drawPriceLine(225, "#00D4AA", "Target Price");
```

#### `drawHorizontalLineWithValue(price, color?, label?, showValue?, valuePosition?)`

Draws an enhanced horizontal line with value display.

**Parameters:**

- `price: number` - Price level
- `color?: string` - Line color
- `label?: string` - Line label
- `showValue?: boolean` - Whether to show price value (defaults to true)
- `valuePosition?: 'left' | 'right'` - Position of value text (defaults to 'right')

**Returns:** `string | null` - Overlay ID or null if failed

**Example:**

```javascript
var lineId = window.__KLP__.drawHorizontalLineWithValue(
  225,
  "#FF5252",
  "Resistance",
  true,
  "right"
);
```

#### `drawTradeZone(entryPrice, exitPrice, startTime, endTime, color?, label?, type?)`

Draws a rectangular trade zone.

**Parameters:**

- `entryPrice: number` - Entry price level
- `exitPrice: number` - Exit price level
- `startTime: number` - Start timestamp
- `endTime: number` - End timestamp
- `color?: string` - Zone color (defaults based on trade type)
- `label?: string` - Zone label
- `type?: 'long' | 'short'` - Trade type (defaults to 'long')

**Returns:** `string | null` - Overlay ID or null if failed

**Example:**

```javascript
var zoneId = window.__KLP__.drawTradeZone(
  220,
  230,
  Date.now() - 86400000,
  Date.now(),
  "rgba(0, 212, 170, 0.2)",
  "Long Trade",
  "long"
);
```

#### `drawStopLoss(price, color?, label?)`

Draws a stop loss line.

**Parameters:**

- `price: number` - Stop loss price
- `color?: string` - Line color (defaults to '#FF5252')
- `label?: string` - Line label (defaults to 'Stop Loss')

**Returns:** `string | null` - Overlay ID or null if failed

#### `drawTakeProfit(price, color?, label?)`

Draws a take profit line.

**Parameters:**

- `price: number` - Take profit price
- `color?: string` - Line color (defaults to '#00D4AA')
- `label?: string` - Line label (defaults to 'Take Profit')

**Returns:** `string | null` - Overlay ID or null if failed

#### `addHorizontalRayLineAtLevel(priceLevel, timestamp?, color?, label?)`

Adds a horizontal ray line with multiple fallback mechanisms.

**Parameters:**

- `priceLevel: number` - Price level
- `timestamp?: number` - Timestamp for anchoring
- `color?: string` - Line color
- `label?: string` - Line label

**Returns:** `string | null` - Overlay ID or null if failed

### Overlay Management

#### `createOverlay(options)`

Creates a generic overlay with fallback mechanisms.

**Parameters:**

- `options: OverlayOptions` - Overlay configuration object

**OverlayOptions Interface:**

```typescript
interface OverlayOptions {
  name: string; // Overlay type name
  points: Point[]; // Array of points
  styles?: OverlayStyles; // Style configuration
  text?: string; // Overlay text
  lock?: boolean; // Whether overlay is locked
}

interface Point {
  timestamp?: number; // Time coordinate
  value: number; // Price coordinate
}

interface OverlayStyles {
  line?: {
    color?: string;
    size?: number;
    style?: "solid" | "dashed" | "dotted";
  };
  text?: {
    color?: string;
    size?: number;
    family?: string;
    weight?: "normal" | "bold";
    offset?: [number, number];
  };
}
```

**Returns:** `string | null` - Overlay ID or null if failed

**Example:**

```javascript
var overlayId = window.__KLP__.createOverlay({
  name: "horizontalStraightLine",
  points: [{ value: 225 }],
  styles: {
    line: { color: "#00D4AA", size: 2, style: "solid" },
    text: { color: "#00D4AA", size: 12, weight: "bold" },
  },
  text: "Custom Line",
  lock: true,
});
```

#### `overrideOverlay(options)`

Updates an existing overlay.

**Parameters:**

- `options: { id: string, points?: Point[], styles?: OverlayStyles }` - Update options

**Returns:** `string | boolean` - New overlay ID or success status

#### `removeOverlay(filter)`

Removes overlays matching the filter.

**Parameters:**

- `filter: { id?: string }` - Filter criteria

**Returns:** `boolean` - Success status

#### `removeOverlayById(id)`

Removes a specific overlay by ID.

**Parameters:**

- `id: string` - Overlay ID to remove

**Returns:** `boolean` - Success status

#### `clearAllDrawings()`

Removes all overlay drawings.

**Returns:** `void`

#### `getSupportedOverlays()`

Gets list of supported overlay types.

**Returns:** `string[]` - Array of supported overlay type names

### Chart Analysis

#### `analyzeChart()`

Performs technical analysis on the current chart data.

**Returns:** `AnalysisResult | null` - Analysis results or null if failed

**AnalysisResult Interface:**

```typescript
interface AnalysisResult {
  symbol: string;
  currentPrice: number;
  trend: "bullish" | "bearish" | "sideways";
  resistance: number;
  support: number;
  sma20: number;
  sma50: number;
  suggestedEntry: number;
  suggestedExit: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}
```

### Indicator Management

#### `addIndicator(config)`

Adds a technical indicator to the chart.

**Parameters:**

- `config: IndicatorConfig` - Indicator configuration

**IndicatorConfig Interface:**

```typescript
interface IndicatorConfig {
  type: string; // Indicator type (MA, EMA, RSI, MACD, BOLL, VOL)
  period?: number; // Period for calculation (defaults to 20)
  color?: string; // Indicator color
  parameters?: {
    // Additional parameters
    fast?: number; // For MACD
    slow?: number; // For MACD
    signal?: number; // For MACD
    deviation?: number; // For Bollinger Bands
    std?: number; // For Bollinger Bands
  };
}
```

**Returns:** `boolean` - Success status

**Example:**

```javascript
var success = window.__KLP__.addIndicator({
  type: "MA",
  period: 20,
  color: "#00D4AA",
});
```

#### `clearIndicators()`

Removes all indicators.

#### `showIndicators()`

Shows indicator pane.

#### `hideIndicators()`

Hides indicator pane.

### Chart Controls

#### `setChartType(type)`

Changes the chart type.

**Parameters:**

- `type: 'candle' | 'line' | 'area'` - Chart type

#### `setStyles(styleConfig)`

Applies custom styling to the chart.

**Parameters:**

- `styleConfig: object` - KLineCharts style configuration object

---

## Utility Functions API

Import from `./chartUtils`: `import { functionName } from './chartUtils'`

### `addHorizontalRayLineAtLevel(widget, priceLevel, timestamp?, color?, label?)`

Utility function for adding horizontal ray lines.

**Parameters:**

- `widget: any` - Chart widget instance
- `priceLevel: number` - Price level
- `timestamp?: number` - Optional timestamp
- `color?: string` - Optional color
- `label?: string` - Optional label

**Example:**

```typescript
import { addHorizontalRayLineAtLevel } from "./chartUtils";

addHorizontalRayLineAtLevel(
  chartRef.current,
  225,
  Date.now(),
  "#00D4AA",
  "Target"
);
```

### `addMultipleRayLines(widget, levels)`

Batch adds multiple horizontal ray lines.

**Parameters:**

- `widget: any` - Chart widget instance
- `levels: RayLineLevel[]` - Array of level configurations

**RayLineLevel Interface:**

```typescript
interface RayLineLevel {
  price: number;
  timestamp?: number;
  color?: string;
  label?: string;
}
```

### `addSupportResistanceLevels(widget, supportLevel, resistanceLevel, timestamp?)`

Adds support and resistance levels.

**Parameters:**

- `widget: any` - Chart widget instance
- `supportLevel: number` - Support price level
- `resistanceLevel: number` - Resistance price level
- `timestamp?: number` - Optional timestamp

---

## Data Types

### TradeLevel

```typescript
interface TradeLevel {
  price: number;
  timestamp?: number;
  color?: string;
  label?: string;
}
```

### TradeZone

```typescript
interface TradeZone {
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  startTime?: number;
  endTime?: number;
  color?: string;
  label?: string;
  type?: "long" | "short";
}
```

### ChartAnalysis

```typescript
interface ChartAnalysis {
  symbol: string;
  currentPrice: number;
  trend: "bullish" | "bearish" | "sideways";
  resistance: number;
  support: number;
  sma20: number;
  sma50: number;
  suggestedEntry: number;
  suggestedExit: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}
```

---

## Error Handling

### Common Error Patterns

1. **Widget Not Available**

   ```typescript
   if (!chartRef.current) {
     console.error("Chart ref not available");
     return;
   }
   ```

2. **JavaScript Injection Errors**

   ```javascript
   try {
     if (window.__KLP__ && window.__KLP__.drawPriceLine) {
       window.__KLP__.drawPriceLine(225, "#00D4AA", "Target");
     }
   } catch (e) {
     console.error("Failed to draw price line:", e);
   }
   ```

3. **Overlay Creation Failures**
   ```javascript
   var overlayId = window.__KLP__.createOverlay(options);
   if (!overlayId) {
     console.warn("Overlay creation failed, trying fallback method");
     // Implement fallback logic
   }
   ```

### Best Practices

1. **Always Check Availability**

   ```javascript
   if (window.__KLP__ && typeof window.__KLP__.drawPriceLine === "function") {
     // Safe to call
   }
   ```

2. **Handle Null Returns**

   ```javascript
   var result = window.__KLP__.createOverlay(options);
   if (result) {
     console.log("Overlay created with ID:", result);
   } else {
     console.warn("Overlay creation failed");
   }
   ```

3. **Use Try-Catch Blocks**
   ```javascript
   try {
     var analysis = window.__KLP__.analyzeChart();
     if (analysis) {
       // Use analysis data
     }
   } catch (e) {
     console.error("Analysis failed:", e);
   }
   ```

---

## Examples

### Basic Price Line

```typescript
// Using ref
chartRef.current?.addHorizontalRayLineAtLevel(
  225,
  Date.now(),
  "#00D4AA",
  "Target"
);

// Using JavaScript injection
chartRef.current?.injectJavaScript(`
  window.__KLP__?.drawPriceLine(225, '#00D4AA', 'Target');
`);

// Using utility function
import { addHorizontalRayLineAtLevel } from "./chartUtils";
addHorizontalRayLineAtLevel(
  chartRef.current,
  225,
  Date.now(),
  "#00D4AA",
  "Target"
);
```

### Trade Zone with Stop Loss and Take Profit

```typescript
const tradeZones = [
  {
    entryPrice: 220,
    exitPrice: 230,
    startTime: Date.now() - 86400000,
    endTime: Date.now(),
    color: "rgba(0, 212, 170, 0.2)",
    label: "Long Trade",
    type: "long" as const,
    stopLoss: 215,
    takeProfit: 235,
  },
];

<KLineProChart tradeZones={tradeZones} />;
```

### Dynamic Analysis-Based Overlays

```typescript
chartRef.current?.injectJavaScript(`
  (function(){
    try {
      var analysis = window.__KLP__.analyzeChart();
      if (analysis) {
        window.__KLP__.drawHorizontalLineWithValue(analysis.support, '#4CAF50', 'Support', true, 'right');
        window.__KLP__.drawHorizontalLineWithValue(analysis.resistance, '#FF5252', 'Resistance', true, 'right');
        window.__KLP__.drawHorizontalLineWithValue(analysis.sma20, '#2196F3', 'SMA 20', true, 'left');
      }
    } catch(e) {
      console.error('Failed to add analysis overlays:', e);
    }
  })();
`);
```

### Fibonacci Retracement Levels

```typescript
chartRef.current?.injectJavaScript(`
  (function(){
    try {
      var analysis = window.__KLP__.analyzeChart();
      if (analysis) {
        var range = analysis.resistance - analysis.support;
        var fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
        
        fibLevels.forEach(function(fib, index) {
          var price = analysis.support + (range * fib);
          var colors = ['#FFD700', '#FFA500', '#FF6347', '#FF4500', '#DC143C'];
          window.__KLP__.drawHorizontalLineWithValue(
            price, colors[index], 'Fib ' + (fib * 100).toFixed(1) + '%', true, 'left'
          );
        });
      }
    } catch(e) {
      console.error('Fibonacci levels failed:', e);
    }
  })();
`);
```

### Pattern Detection

```typescript
chartRef.current?.injectJavaScript(`
  (function(){
    try {
      var analysis = window.__KLP__.analyzeChart();
      if (analysis) {
        // Golden Cross Detection
        if (analysis.sma20 > analysis.sma50 && analysis.currentPrice > analysis.sma20) {
          window.__KLP__.drawHorizontalLineWithValue(
            analysis.currentPrice * 1.02, '#FFD700', 'Golden Cross Target', true, 'right'
          );
        }
        
        // Breakout Detection
        var resistanceDistance = Math.abs(analysis.currentPrice - analysis.resistance) / analysis.currentPrice;
        if (resistanceDistance < 0.02) {
          window.__KLP__.drawHorizontalLineWithValue(
            analysis.resistance * 1.01, '#00FFFF', 'Breakout Target', true, 'right'
          );
        }
      }
    } catch(e) {
      console.error('Pattern detection failed:', e);
    }
  })();
`);
```

This API reference provides comprehensive documentation for all overlay functionality in your KLineChart implementation. The system is robust, well-designed, and ready for production use.
