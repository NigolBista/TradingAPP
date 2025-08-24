# KLineCharts Pro Overlay Usage Guide

Now that the KLineCharts Pro library is integrated directly into your app, you can import and use all overlay functionalities without bundling or HTML script imports.

## Direct Imports

You can now import overlay templates and types directly:

```typescript
import {
  OverlayTemplate,
  Coordinate,
  OverlayCreate,
  OverlayMode,
  KLineData,
  Styles,
  DeepPartial,
  // Individual overlay templates
  arrow,
  circle,
  rect,
  parallelogram,
  triangle,
  fibonacciCircle,
  fibonacciSegment,
  fibonacciSpiral,
  fibonacciSpeedResistanceFan,
  fibonacciExtension,
  gannBox,
  threeWaves,
  fiveWaves,
  eightWaves,
  anyWaves,
  abcd,
  xabcd,
  // All overlays array
  overlays,
} from "./src/lib/klinecharts";
```

## Available Overlay Types

### Basic Shapes

- `arrow` - Arrow annotations
- `circle` - Circle overlays
- `rect` - Rectangle overlays
- `parallelogram` - Parallelogram shapes
- `triangle` - Triangle shapes

### Fibonacci Tools

- `fibonacciCircle` - Fibonacci circles
- `fibonacciSegment` - Fibonacci retracement segments
- `fibonacciSpiral` - Fibonacci spirals
- `fibonacciSpeedResistanceFan` - Fibonacci speed resistance fans
- `fibonacciExtension` - Fibonacci extensions

### Wave Analysis

- `threeWaves` - Three-wave patterns
- `fiveWaves` - Five-wave patterns (Elliott Wave)
- `eightWaves` - Eight-wave patterns
- `anyWaves` - Custom wave patterns

### Advanced Patterns

- `abcd` - ABCD patterns
- `xabcd` - XABCD patterns
- `gannBox` - Gann box overlays

## Usage Examples

### 1. Creating a Horizontal Ray Line

```typescript
import { OverlayCreate } from "./src/lib/klinecharts";

const createHorizontalRayLine = (chart: any, priceLevel: number) => {
  const overlayOptions: OverlayCreate = {
    name: "horizontalRayLine",
    points: [{ timestamp: Date.now(), value: priceLevel }],
    styles: {
      line: {
        color: "#00D4AA",
        size: 2,
        style: "solid",
      },
      text: {
        color: "#00D4AA",
        size: 12,
        family: "Arial",
        weight: "bold",
      },
    },
    text: `Support Level $${priceLevel}`,
  };

  return chart.createOverlay(overlayOptions);
};
```

### 2. Creating a Trade Zone Rectangle

```typescript
const createTradeZone = (chart: any, entryPrice: number, exitPrice: number) => {
  const now = Date.now();
  const overlayOptions: OverlayCreate = {
    name: "rect",
    points: [
      { timestamp: now - 86400000, value: entryPrice }, // Start: 1 day ago
      { timestamp: now, value: exitPrice }, // End: now
    ],
    styles: {
      style: "fill",
      color: "rgba(0, 212, 170, 0.2)",
      borderColor: "#00D4AA",
      borderSize: 1,
      borderStyle: "solid",
    },
    text: "Trade Zone",
  };

  return chart.createOverlay(overlayOptions);
};
```

### 3. Creating Fibonacci Retracement

```typescript
const createFibonacciRetracement = (
  chart: any,
  startPrice: number,
  endPrice: number
) => {
  const now = Date.now();
  const overlayOptions: OverlayCreate = {
    name: "fibonacciSegment",
    points: [
      { timestamp: now - 172800000, value: startPrice }, // Start: 2 days ago
      { timestamp: now - 86400000, value: endPrice }, // End: 1 day ago
    ],
    styles: {
      line: {
        color: "#FFD700",
        size: 1,
        style: "solid",
      },
      text: {
        color: "#FFD700",
        size: 10,
      },
    },
  };

  return chart.createOverlay(overlayOptions);
};
```

### 4. Creating Elliott Wave Pattern

```typescript
const createElliottWave = (
  chart: any,
  wavePoints: Array<{ timestamp: number; value: number }>
) => {
  const overlayOptions: OverlayCreate = {
    name: "fiveWaves",
    points: wavePoints,
    styles: {
      line: {
        color: "#9C27B0",
        size: 2,
        style: "solid",
      },
      text: {
        color: "#9C27B0",
        size: 12,
        weight: "bold",
      },
    },
    text: "Elliott Wave",
  };

  return chart.createOverlay(overlayOptions);
};
```

### 5. Creating ABCD Pattern

```typescript
const createABCDPattern = (
  chart: any,
  points: Array<{ timestamp: number; value: number }>
) => {
  const overlayOptions: OverlayCreate = {
    name: "abcd",
    points: points, // Should have 4 points: A, B, C, D
    styles: {
      line: {
        color: "#FF9800",
        size: 2,
        style: "solid",
      },
      text: {
        color: "#FF9800",
        size: 12,
        weight: "bold",
      },
    },
    text: "ABCD Pattern",
  };

  return chart.createOverlay(overlayOptions);
};
```

## Chart Integration

To use these overlays with your chart component:

```typescript
import React, { useRef } from "react";
import { KLineProChart } from "./src/lib/klinecharts";

const MyTradingChart = () => {
  const chartRef = useRef<any>(null);

  const addSupportLine = (price: number) => {
    if (chartRef.current) {
      const overlayId = createHorizontalRayLine(chartRef.current, price);
      console.log("Created overlay:", overlayId);
    }
  };

  const addTradeZone = (entry: number, exit: number) => {
    if (chartRef.current) {
      const overlayId = createTradeZone(chartRef.current, entry, exit);
      console.log("Created trade zone:", overlayId);
    }
  };

  return (
    <View>
      <KLineProChart ref={chartRef} symbol="AAPL" timeframe="1d" height={400} />
      <Button title="Add Support Line" onPress={() => addSupportLine(150)} />
      <Button title="Add Trade Zone" onPress={() => addTradeZone(145, 155)} />
    </View>
  );
};
```

## Overlay Management

### Removing Overlays

```typescript
// Remove specific overlay by ID
chart.removeOverlay(overlayId);

// Remove all overlays
chart.removeOverlay();

// Remove overlays by filter
chart.removeOverlay({ name: "horizontalRayLine" });
```

### Updating Overlays

```typescript
// Override overlay properties
chart.overrideOverlay({
  id: overlayId,
  points: [{ timestamp: Date.now(), value: newPrice }],
  styles: { line: { color: "#FF5252" } },
});
```

### Getting Overlay Information

```typescript
// Get all overlays
const overlays = chart.getOverlayById();

// Get specific overlay
const overlay = chart.getOverlayById(overlayId);
```

## Benefits of Direct Integration

1. **No Bundling Required**: Import overlay functions directly without webpack/bundling
2. **Type Safety**: Full TypeScript support with proper type definitions
3. **Tree Shaking**: Only import the overlays you actually use
4. **Direct API Access**: Call overlay functions directly without HTML script injection
5. **Better Performance**: No WebView JavaScript injection overhead
6. **Easier Debugging**: Direct access to overlay objects and methods

## Custom Overlay Creation

You can also create custom overlays by extending the `OverlayTemplate`:

```typescript
import { OverlayTemplate } from "./src/lib/klinecharts";

const customOverlay: OverlayTemplate = {
  name: "customLine",
  totalStep: 2,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding, precision }) => {
    // Custom overlay implementation
    return [];
  },
  createXAxisFigures: ({ coordinates, bounding, precision }) => {
    return [];
  },
  createYAxisFigures: ({ coordinates, bounding, precision }) => {
    return [];
  },
};

// Register your custom overlay
import { registerOverlay } from "klinecharts";
registerOverlay(customOverlay);
```

This integration gives you complete control over chart overlays and drawing tools directly in your React Native app!
