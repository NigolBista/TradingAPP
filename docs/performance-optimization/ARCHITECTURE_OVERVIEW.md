# WebSocket Optimization Architecture Overview

This document explains the technical architecture of the WebSocket performance optimization system.

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    StockDetail Screen                       │
├─────────────────────────────────────────────────────────────┤
│  Feature Flag Switch: Original vs Optimized Implementation │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────┐                 ┌────▼─────┐
│Original│                 │Optimized │
│  Hook  │                 │   Hook   │
└───┬────┘                 └────┬─────┘
    │                           │
┌───▼────┐                 ┌────▼─────┐
│Polygon │                 │Optimized │
│WebSocket│                │WebSocket │
│ Direct │                 │ Manager  │
└────────┘                 └──────────┘
                                │
                      ┌─────────▼─────────┐
                      │ Performance       │
                      │ Monitoring        │
                      │ & Analytics       │
                      └───────────────────┘
```

## 📁 Component Structure

### Core Components

#### 1. Feature Flag System (`src/config/performanceConfig.ts`)
**Purpose**: Runtime switching between implementations

```typescript
export const PERFORMANCE_CONFIG = {
  USE_OPTIMIZED_WEBSOCKET: false, // Toggle optimization
  WEBSOCKET_THROTTLE_MS: 100,     // Update frequency control
  WEBSOCKET_MAX_UPDATES_PER_SECOND: 10, // Rate limiting
}
```

**Key Functions**:
- `enableOptimizedWebSocket()` - Switch to optimized implementation
- `disableOptimizedWebSocket()` - Revert to original
- `getPerformanceConfig()` - Get current configuration

#### 2. Performance Monitoring (`src/utils/performanceMonitor.ts`)
**Purpose**: Comprehensive metrics collection

```typescript
interface StockDetailMetrics {
  websocket: WebSocketMetrics;      // Latency, drops, reconnects
  rendering: RenderMetrics;         // Render times, slow renders
  dataFetching: DataFetchMetrics;   // API call performance
  userExperience: UXMetrics;        // Time to first render, etc.
}
```

**Key Features**:
- Real-time metric collection
- Memory usage tracking
- Performance event recording
- Statistical analysis

#### 3. Original Implementation (`src/hooks/useStockDetails.ts`)
**Purpose**: Current production WebSocket handling

**Architecture**:
- Direct Polygon WebSocket connection
- Immediate render triggers on price updates
- No throttling or rate limiting
- Basic error handling and reconnection

**Performance Characteristics**:
- Lower latency for individual updates
- Higher CPU usage during market activity
- Potential UI flooding during high-frequency updates
- More network connections

#### 4. Optimized Implementation (`src/hooks/useOptimizedStockDetails.ts`)
**Purpose**: Enhanced WebSocket with performance optimizations

**Architecture**:
- Optimized WebSocket manager with connection pooling
- Intelligent throttling and rate limiting
- Buffered update delivery
- Enhanced error handling and reconnection logic

**Performance Optimizations**:
- **Throttling**: Limits UI updates to configurable frequency (default 10Hz)
- **Rate Limiting**: Prevents overwhelming UI with rapid updates
- **Connection Pooling**: Efficient resource management
- **Buffer Management**: Smooth delivery of batched updates

### 5. Optimized WebSocket Manager (`src/services/optimizedWebSocketManager.ts`)
**Purpose**: Core optimization engine

```typescript
class OptimizedWebSocketManager {
  // Connection management
  private ws: WebSocket | null = null;
  private isConnected = false;

  // Throttling and rate limiting
  private throttledCallbacks = new Map<string, NodeJS.Timeout>();
  private lastUpdateTime = new Map<string, number>();
  private updateBuffer = new Map<string, PriceUpdate>();

  // Configuration
  private readonly defaultThrottleMs = 100;     // 10Hz updates
  private readonly maxUpdatesPerSecond = 20;    // Rate limit
  private readonly reconnectDelay = 5000;       // 5s reconnection
}
```

**Key Optimizations**:

1. **Intelligent Throttling**
   ```typescript
   subscribe(symbol: string, callback: PriceCallback, options: {
     throttleMs?: number;           // Custom throttle per subscription
     maxUpdatesPerSecond?: number;  // Custom rate limit
   })
   ```

2. **Buffer Management**
   ```typescript
   private handlePriceUpdate(update: PriceUpdate): void {
     // Rate limiting check
     if (timeSinceLastUpdate < rateLimitThreshold) {
       this.updateBuffer.set(symbol, update); // Buffer for later
       return;
     }

     this.deliverUpdate(update); // Immediate delivery
   }
   ```

3. **Connection Resilience**
   ```typescript
   private scheduleReconnect(): void {
     const delay = Math.min(
       this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
       30000 // Max 30s
     );
   }
   ```

## 🔄 Data Flow Comparison

### Original Implementation Flow
```
Polygon WebSocket → Direct Callback → Immediate State Update → Component Render
```

**Characteristics**:
- Low latency for individual updates
- No buffering or throttling
- Direct state mutations
- Potential for render thrashing

### Optimized Implementation Flow
```
Polygon WebSocket → Optimized Manager → Throttling Layer → Buffer → Scheduled Delivery → State Update → Render
```

**Characteristics**:
- Controlled update frequency
- Buffered delivery for smooth UI
- Rate limiting prevents overload
- Optimized render cycles

## 📊 Performance Monitoring Architecture

### Metrics Collection Pipeline

```
Component Events → Performance Monitor → Metric Aggregation → Analysis & Export
```

#### 1. Event Collection
```typescript
// WebSocket events
recordWebSocketMessage(latency?: number)
recordWebSocketReconnect()
recordDroppedUpdate()

// Render events
recordRender(renderTime: number)
recordPriceUpdateReceived()
recordPriceUpdateApplied()

// Timing events
startTiming(name: string)
endTiming(name: string)
```

#### 2. Metric Aggregation
```typescript
interface StockDetailMetrics {
  websocket: {
    averageLatency: number;
    messagesPerSecond: number;
    droppedUpdates: number;
    reconnectCount: number;
  };
  rendering: {
    averageRenderTime: number;
    slowRenders: number;
    priceUpdatesApplied: number;
  };
  userExperience: {
    timeToFirstRender: number;
    priceUpdateLatency: number;
  };
}
```

#### 3. Real-time Analysis
- Moving averages for smooth metrics
- Percentile calculations for render times
- Rate calculations for throughput
- Statistical comparisons for A/B testing

## 🧪 Testing Architecture

### Test Harness Structure

```
Test Scenarios → Performance Simulation → Metric Collection → Statistical Analysis → Recommendation
```

#### 1. Test Scenarios (`src/utils/performanceTest.ts`)
```typescript
const testScenarios: TestScenario[] = [
  {
    name: 'single_symbol_light',
    symbolsToTest: ['AAPL'],
    testDurationMs: 30000,
    expectedUpdatesPerSecond: 1,
  },
  {
    name: 'stress_test',
    symbolsToTest: ['AAPL'],
    testDurationMs: 30000,
    expectedUpdatesPerSecond: 50,
  }
];
```

#### 2. Performance Simulation
- Mock WebSocket message generation
- Realistic latency simulation
- Variable load scenarios
- Network condition simulation

#### 3. Statistical Analysis
```typescript
private calculatePerformanceScore(metrics: any): number {
  let score = 100;

  // WebSocket performance (30 points)
  score -= latencyPenalty + dropPenalty + reconnectPenalty;

  // Rendering performance (40 points)
  score -= renderTimePenalty + slowRenderPenalty;

  // User experience (30 points)
  score -= firstRenderPenalty + updateLatencyPenalty;

  return Math.max(0, Math.min(100, score));
}
```

## 🔀 Implementation Switching

### Feature Flag Architecture

```typescript
// Runtime switching in StockDetailScreen
const stockDetailsHook = PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET
  ? useOptimizedStockDetails
  : useStockDetails;

const hookResult = stockDetailsHook(symbol, {
  initialQuote: initialQuoteParam,
  // Optimized-specific options
  ...(PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET && {
    throttleMs: PERFORMANCE_CONFIG.WEBSOCKET_THROTTLE_MS,
    maxUpdatesPerSecond: PERFORMANCE_CONFIG.WEBSOCKET_MAX_UPDATES_PER_SECOND,
  }),
});
```

### Visual Indicators
```typescript
// Development-only implementation indicator
{__DEV__ && (
  <View style={{
    backgroundColor: PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET
      ? '#00D4AA'  // Green for optimized
      : '#FF5722', // Red for original
  }}>
    <Text>
      {PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET ? '🚀 OPT' : '📊 ORIG'}
    </Text>
  </View>
)}
```

## 🎯 Performance Targets & Thresholds

### Target Performance Improvements
```typescript
const PERFORMANCE_TARGETS = {
  websocketLatency: {
    current: 120,      // ms
    target: 70,        // ms (58% improvement)
    threshold: 100,    // ms (minimum acceptable)
  },
  renderTime: {
    current: 18.2,     // ms
    target: 12.4,      // ms (32% improvement)
    threshold: 16,     // ms (60fps target)
  },
  droppedUpdates: {
    current: 15,       // per minute
    target: 3,         // per minute (80% reduction)
    threshold: 10,     // per minute (33% reduction minimum)
  },
  overallScore: {
    current: 68.4,     // /100
    target: 82.1,      // /100 (20% improvement)
    threshold: 73.4,   // /100 (5 point minimum)
  }
};
```

### Implementation Thresholds
```typescript
const IMPLEMENTATION_CRITERIA = {
  required: {
    overallScoreImprovement: 5,    // points
    websocketLatencyImprovement: 20, // ms
    noMajorRegressions: true,
    connectionStabilityMaintained: true,
  },

  redFlags: {
    overallScoreDecrease: -2,      // points
    websocketLatencyIncrease: 10,  // ms
    renderTimeIncrease: 3,         // ms
    majorRegressionsCount: 3,
  }
};
```

## 🔧 Configuration Management

### Environment-Based Configuration
```typescript
export const PERFORMANCE_CONFIG = {
  // Core toggles
  USE_OPTIMIZED_WEBSOCKET: false,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,

  // WebSocket settings
  WEBSOCKET_THROTTLE_MS: 100,
  WEBSOCKET_MAX_UPDATES_PER_SECOND: 10,
  WEBSOCKET_RECONNECT_DELAY: 5000,
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS: 10,

  // Buffer settings
  WEBSOCKET_BUFFER_FLUSH_INTERVAL_MS: 50,
};
```

### Runtime Configuration Updates
```typescript
// Global functions for easy testing
global.enableOptimizedWebSocket = () => {
  PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET = true;
};

global.disableOptimizedWebSocket = () => {
  PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET = false;
};
```

This architecture provides a robust foundation for:
- **Safe A/B testing** with easy rollback capability
- **Comprehensive performance monitoring** with detailed metrics
- **Evidence-based optimization** with statistical validation
- **Production-ready deployment** with gradual rollout support