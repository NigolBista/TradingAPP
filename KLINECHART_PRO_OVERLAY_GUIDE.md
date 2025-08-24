# KLineCharts Pro Overlay Integration Guide

This guide explains how to use the enhanced KLineCharts Pro library with programmatic overlay creation functionality.

## Overview

We've integrated the KLineCharts Pro library from your local assets folder (`assets/lib/klinecharts-pro.umd.js`) and exposed the overlay creation API for programmatic chart annotation.

## Files Created

### 1. Asset Loader (`src/utils/assetLoader.ts`)

Utility functions to load the Pro library from assets as text and convert it for WebView use.

```typescript
import {
  loadKLineChartsProLibrary,
  createInlineScript,
} from "../utils/assetLoader";

// Load the library
const libraryCode = await loadKLineChartsProLibrary();
const inlineScript = createInlineScript(libraryCode);
```

### 2. Enhanced Chart Component (`src/components/charts/EnhancedKLineProChart.tsx`)

A new chart component that uses the local Pro library and exposes overlay creation methods.

```typescript
import EnhancedKLineProChart, { ChartRef } from "./EnhancedKLineProChart";

const chartRef = useRef<ChartRef>(null);

// Create overlays programmatically
const overlayId = await chartRef.current?.createOverlay({
  name: "segment",
  points: [
    { timestamp: 1640995200000, value: 150 },
    { timestamp: 1641081600000, value: 155 },
  ],
});
```

### 3. Overlay Utilities (`src/components/charts/overlayUtils.ts`)

Helper functions for creating common overlay types with proper configurations.

```typescript
import {
  createSegmentOverlay,
  createHorizontalRayOverlay,
  createRectangleOverlay,
  createFibonacciRetracementOverlay,
  TRADING_OVERLAYS,
} from "./overlayUtils";

// Create a trend line
const trendLine = createSegmentOverlay(
  { timestamp: Date.now() - 86400000, value: 150 },
  { timestamp: Date.now(), value: 155 },
  "#00D4AA"
);
```

### 4. Example Components

- `ProChartExample.tsx` - Basic overlay creation examples
- `AdvancedOverlayExample.tsx` - Advanced patterns and trading overlays

## Available Overlay Types

The Pro library supports these overlay types:

### Basic Overlays

- `segment` - Line segment between two points
- `horizontalRayLine` - Horizontal ray from a point
- `verticalStraightLine` - Vertical line at timestamp
- `straightLine` - Extended trend line
- `arrow` - Arrow between two points

### Geometric Shapes

- `rect` - Rectangle
- `circle` - Circle
- `triangle` - Triangle
- `parallelogram` - Parallelogram

### Technical Analysis

- `fibonacciSegment` - Fibonacci retracement
- `fibonacciCircle` - Fibonacci circles
- `fibonacciSpiral` - Fibonacci spiral
- `gannBox` - Gann box

### Trading Patterns

- `threeWaves` - Elliott wave (3 waves)
- `fiveWaves` - Elliott wave (5 waves)
- `abcd` - ABCD pattern
- `xabcd` - XABCD pattern

## Usage Examples

### Basic Overlay Creation

```typescript
const MyChart = () => {
  const chartRef = useRef<ChartRef>(null);

  const createHorizontalLine = async () => {
    if (!chartRef.current) return;

    const overlayId = await chartRef.current.createOverlay({
      name: "horizontalRayLine",
      points: [{ timestamp: Date.now(), value: 155.5 }],
      styles: {
        line: { color: "#00D4AA", size: 2, style: "solid" },
        text: { color: "#00D4AA", size: 12 },
      },
      text: "Support Level: $155.50",
      lock: true,
    });
  };

  return (
    <EnhancedKLineProChart
      ref={chartRef}
      symbol="AAPL"
      height={400}
      theme="dark"
    />
  );
};
```

### Using Utility Functions

```typescript
import {
  createHorizontalRayOverlay,
  createSupportResistanceLevels,
  createPoint,
  getCurrentTimestamp,
  getDaysAgoTimestamp,
} from "./overlayUtils";

// Create support/resistance levels
const levels = createSupportResistanceLevels(
  [150.0, 155.0, 160.0], // Price levels
  "#9B59B6", // Color
  getCurrentTimestamp()
);

// Create each overlay
for (const level of levels) {
  await chartRef.current?.createOverlay(level);
}
```

### Trading Pattern Example

```typescript
import {
  TRADING_OVERLAYS,
  createPoint,
  getDaysAgoTimestamp,
} from "./overlayUtils";

// Create a bullish flag pattern
const flagPattern = TRADING_OVERLAYS.bullishFlag(
  createPoint(getDaysAgoTimestamp(4), 150), // Pole start
  createPoint(getDaysAgoTimestamp(2), 160), // Pole end
  createPoint(getDaysAgoTimestamp(2), 159), // Flag start
  createPoint(getDaysAgoTimestamp(0), 157) // Flag end
);

// Create all overlays in the pattern
for (const overlay of flagPattern) {
  await chartRef.current?.createOverlay(overlay);
}
```

## Chart API Methods

The enhanced chart exposes these methods through the ref:

```typescript
interface ChartRef {
  // Create overlay with full options
  createOverlay: (options: OverlayOptions) => Promise<string | null>;

  // Remove specific overlay
  removeOverlay: (overlayId: string) => void;

  // Clear all overlays
  clearAllOverlays: () => void;

  // Quick horizontal ray line creation
  addHorizontalRayLineAtLevel: (
    priceLevel: number,
    timestamp?: number,
    color?: string,
    label?: string
  ) => void;

  // Debug methods
  getSupportedOverlays: () => void;
  debugWindowObjects: () => void;
}
```

## Integration with Existing Code

To integrate with your existing chart components:

1. **Replace the library source**: Instead of loading from CDN, use the local asset
2. **Add overlay methods**: Expose the `createOverlay` API
3. **Use utility functions**: Import overlay utilities for common patterns

### Example Integration

```typescript
// In your existing chart component
import {
  loadKLineChartsProLibrary,
  createInlineScript,
} from "../utils/assetLoader";

const [proLibraryCode, setProLibraryCode] = useState<string>("");

useEffect(() => {
  const loadLibrary = async () => {
    const libraryCode = await loadKLineChartsProLibrary();
    setProLibraryCode(libraryCode);
  };
  loadLibrary();
}, []);

// In your HTML template
const html = `
  <script src="https://unpkg.com/klinecharts/dist/klinecharts.umd.js"></script>
  <script>
    ${proLibraryCode ? createInlineScript(proLibraryCode) : ""}
  </script>
  <script>
    // Your chart initialization code
    const chart = new window.klinechartspro.KLineChartPro({
      // ... your config
    });
    
    // Expose overlay API
    window.chart = chart;
  </script>
`;
```

## Styling and Customization

Overlays can be styled with these options:

```typescript
interface OverlayStyles {
  line?: {
    color?: string; // Line color
    size?: number; // Line width
    style?: "solid" | "dashed" | "dotted";
  };
  text?: {
    color?: string; // Text color
    size?: number; // Font size
    family?: string; // Font family
    weight?: string; // Font weight
    offset?: [number, number]; // Text offset [x, y]
  };
  polygon?: {
    color?: string; // Fill color (with alpha for transparency)
  };
}
```

## Error Handling

Always wrap overlay creation in try-catch blocks:

```typescript
const createOverlay = async () => {
  try {
    if (!chartRef.current) {
      throw new Error("Chart not ready");
    }

    const overlayId = await chartRef.current.createOverlay(overlayOptions);
    if (!overlayId) {
      throw new Error("Failed to create overlay");
    }

    console.log("Created overlay:", overlayId);
  } catch (error) {
    console.error("Overlay creation failed:", error);
    Alert.alert("Error", `Failed to create overlay: ${error.message}`);
  }
};
```

## Performance Considerations

1. **Batch operations**: Create multiple overlays in sequence rather than parallel
2. **Cleanup**: Remove unused overlays to maintain performance
3. **Limit overlays**: Too many overlays can impact chart performance
4. **Use appropriate types**: Choose the right overlay type for your use case

## Troubleshooting

### Common Issues

1. **Library not loaded**: Ensure the Pro library loads before chart initialization
2. **Overlay not appearing**: Check console for errors and verify overlay configuration
3. **Performance issues**: Limit the number of active overlays

### Debug Methods

```typescript
// Check supported overlay types
chartRef.current?.getSupportedOverlays();

// Debug chart state
chartRef.current?.debugWindowObjects();

// Check console for detailed logs
```

## Next Steps

1. Test the enhanced chart with your existing data
2. Implement overlay creation in your trading screens
3. Add overlay persistence if needed
4. Customize overlay styles to match your app theme

The enhanced chart provides a powerful foundation for programmatic chart annotation while maintaining compatibility with your existing KLineCharts implementation.
