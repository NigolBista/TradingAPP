# Baseline Performance Measurement Guide

## Overview

This document explains how to collect baseline performance metrics for the StockDetail screen before implementing the optimized WebSocket manager.

## Performance Metrics Infrastructure

We've implemented comprehensive performance monitoring tools:

### 📊 Performance Monitor (`src/utils/performanceMonitor.ts`)
- Tracks WebSocket connection metrics
- Measures component render times
- Records data fetching performance
- Monitors memory usage patterns

### 🔧 Performance Instrumentation Hook (`src/hooks/usePerformanceInstrumentation.ts`)
- Instruments StockDetail screen data fetching
- Records price update latency
- Tracks render performance

### 🧪 Performance Test Harness (`src/utils/performanceTest.ts`)
- Runs standardized performance scenarios
- Simulates various load conditions
- Calculates performance scores (0-100)

## How to Collect Baseline Metrics

### Method 1: Manual Testing (Recommended)

1. **Launch the app in development mode**
```bash
npm start
# or
expo start
```

2. **Navigate to any StockDetail screen**
   - Pick an active stock symbol (e.g., AAPL, GOOGL, TSLA)
   - Let the screen load completely

3. **Collect metrics using the debug console**
```javascript
// In React Native debugger or Metro logs:
global.getStockDetailMetrics()    // Get current metrics
global.exportStockDetailMetrics() // Export full performance data
```

4. **Test different scenarios**:
   - **Light Load**: View a single stock with normal market activity
   - **Heavy Load**: Switch between multiple stocks rapidly
   - **Extended Usage**: Keep screen open for 2-3 minutes
   - **Background/Foreground**: Test app state transitions

### Method 2: Automated Testing

1. **Run baseline test script**
```bash
npx ts-node scripts/runBaselineTest.ts
```

2. **Export results**
   - Results are logged to console
   - Save the JSON output for comparison later

## Key Metrics to Monitor

### 🔌 WebSocket Performance
- **Average Latency**: Time from server to client (target: <100ms)
- **Messages per Second**: Update frequency (varies by market activity)
- **Dropped Updates**: Updates lost due to rate limiting (target: 0)
- **Reconnection Count**: Connection stability (target: 0)

### 🖼️ Rendering Performance
- **Average Render Time**: Component render duration (target: <16ms for 60fps)
- **Slow Renders**: Renders >16ms (target: <10% of total)
- **Price Updates Applied**: UI updates processed (should match received)

### 📱 User Experience
- **Time to First Render**: Initial screen load (target: <1000ms)
- **Price Update Latency**: Real-time data delay (target: <200ms)
- **Memory Usage**: Resource consumption (track for leaks)

### 🔄 Data Fetching
- **Quote Fetch Time**: Price data loading (target: <500ms)
- **News Fetch Time**: News data loading (target: <1000ms)
- **Chart Data Fetch Time**: Historical data loading (target: <800ms)

## Expected Baseline Results

Based on the current implementation, expect:

### Current State (Pre-Optimization)
```
📊 Estimated Baseline Performance:
- Overall Score: 60-75/100
- WebSocket Latency: 80-150ms
- Render Time: 12-25ms
- Dropped Updates: 5-15 per minute
- Time to First Render: 800-1200ms
```

### Performance Bottlenecks Identified
1. **No WebSocket Optimization**: Each price update triggers immediate renders
2. **No Throttling**: High-frequency updates can overwhelm the UI
3. **No Connection Pooling**: Multiple connections for different data streams
4. **Re-render Inefficiency**: Price changes trigger cascade of component updates

## Collecting Baseline Data

### Step-by-Step Process

1. **Clean State**: Start with fresh app install or clear cache
2. **Standard Test Sequence**:
   ```
   1. Launch app → Navigate to StockDetail (AAPL)
   2. Wait 30 seconds for initial data load
   3. Export baseline metrics
   4. Switch to different stock (GOOGL)
   5. Wait 30 seconds
   6. Export metrics again
   7. Repeat for 3-4 different stocks
   ```

3. **Record Results**: Save JSON exports with timestamps

### Sample Data Collection
```javascript
// Example baseline data structure:
{
  "timestamp": "2024-01-15T10:30:00Z",
  "symbol": "AAPL",
  "duration": "30s",
  "websocket": {
    "averageLatency": 120.5,
    "messagesPerSecond": 2.3,
    "droppedUpdates": 8,
    "reconnects": 0
  },
  "rendering": {
    "averageRenderTime": 18.2,
    "slowRenders": 12,
    "priceUpdatesApplied": 69
  },
  "userExperience": {
    "timeToFirstRender": 950,
    "priceUpdateLatency": 180
  }
}
```

## Next Steps

After collecting baseline metrics:

1. **Analyze Results**: Identify worst performing scenarios
2. **Implement Optimized WebSocket Manager**: Integrate the pre-built solution
3. **Re-run Tests**: Use same test methodology
4. **Compare Results**: Use `scripts/comparePerformance.ts`
5. **Document Improvements**: Record performance gains

## Troubleshooting

### Common Issues

**Metrics not appearing**:
- Ensure `__DEV__` is true
- Check Metro logs for console output
- Verify performance hooks are imported

**Inconsistent results**:
- Use airplane mode to simulate consistent conditions
- Test during off-market hours for stable baseline
- Clear app cache between tests

**Memory leaks**:
- Monitor over extended periods (5+ minutes)
- Check for climbing memory usage
- Verify cleanup functions are called

## Debug Commands

```javascript
// Available in development console:
global.getStockDetailMetrics()    // Current performance snapshot
global.exportStockDetailMetrics() // Full data export
```

Remember: **Consistent methodology is key** - use the same test conditions before and after optimization to ensure accurate comparison.