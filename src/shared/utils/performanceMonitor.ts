/**
 * Performance monitoring utilities for measuring real-time data updates
 */

import { useEffect } from 'react';

interface PerformanceMetric {
  name: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface WebSocketMetrics {
  connectionsCount: number;
  messagesReceived: number;
  messagesPerSecond: number;
  averageLatency: number;
  reconnectCount: number;
  droppedUpdates: number;
  throttledUpdates: number;
}

interface RenderMetrics {
  componentRenders: number;
  averageRenderTime: number;
  slowRenders: number; // renders > 16ms
  priceUpdatesReceived: number;
  priceUpdatesApplied: number;
  memoryUsage?: number;
}

interface StockDetailMetrics {
  websocket: WebSocketMetrics;
  rendering: RenderMetrics;
  dataFetching: {
    quoteFetchTime: number;
    newsFetchTime: number;
    sentimentFetchTime: number;
    chartDataFetchTime: number;
  };
  userExperience: {
    timeToFirstRender: number;
    timeToInteractive: number;
    priceUpdateLatency: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private startTimes = new Map<string, number>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private counters = new Map<string, number>();

  // Memory management constants
  private readonly MAX_METRICS = 10000; // Prevent unbounded metrics growth
  private readonly MAX_STORED_MESSAGES = 1000; // WebSocket message history limit

  // WebSocket specific tracking
  private wsConnectionStart?: number;
  private wsMessageTimes: number[] = [];
  private wsLatencies: number[] = [];
  private wsReconnects = 0;
  private wsDroppedUpdates = 0;
  private wsThrottledUpdates = 0;

  // Render tracking
  private renderTimes: number[] = [];
  private renderCount = 0;
  private priceUpdatesReceived = 0;
  private priceUpdatesApplied = 0;

  /**
   * Start timing an operation
   */
  startTiming(name: string, metadata?: Record<string, any>): void {
    const now = performance.now();
    this.startTimes.set(name, now);

    this.metrics.push({
      name: `${name}_start`,
      timestamp: now,
      metadata,
    });
  }

  /**
   * End timing an operation and record duration
   */
  endTiming(name: string, metadata?: Record<string, any>): number {
    const now = performance.now();
    const startTime = this.startTimes.get(name);

    if (!startTime) {
      console.warn(`No start time found for metric: ${name}`);
      return 0;
    }

    const duration = now - startTime;
    this.startTimes.delete(name);

    this.metrics.push({
      name: `${name}_end`,
      timestamp: now,
      duration,
      metadata,
    });

    return duration;
  }

  /**
   * Record a single point-in-time metric
   */
  recordMetric(name: string, value?: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      name,
      timestamp: performance.now(),
      duration: value,
      metadata,
    });

    // Prevent unbounded memory growth
    if (this.metrics.length > this.MAX_METRICS) {
      const excess = this.metrics.length - this.MAX_METRICS;
      this.metrics = this.metrics.slice(excess);
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, by: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + by);
  }

  /**
   * Get current counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Start monitoring WebSocket connection
   */
  startWebSocketMonitoring(): void {
    this.wsConnectionStart = performance.now();
    this.wsMessageTimes = [];
    this.wsLatencies = [];
    this.wsReconnects = 0;
    this.wsDroppedUpdates = 0;
    this.wsThrottledUpdates = 0;

    // Sample message rate every second
    const interval = setInterval(() => {
      const now = Date.now();
      const recentMessages = this.wsMessageTimes.filter(time => now - time < 1000);
      this.recordMetric('ws_messages_per_second', recentMessages.length);
    }, 1000);

    this.intervals.set('ws_monitoring', interval);
  }

  /**
   * Record WebSocket message received
   */
  recordWebSocketMessage(latency?: number): void {
    const now = Date.now();
    this.wsMessageTimes.push(now);

    if (latency !== undefined) {
      this.wsLatencies.push(latency);
    }

    // Keep only last 60 seconds of data
    const cutoff = now - 60000;
    const originalLength = this.wsMessageTimes.length;
    this.wsMessageTimes = this.wsMessageTimes.filter(time => time > cutoff);

    // Remove corresponding latencies for removed messages
    const removedCount = originalLength - this.wsMessageTimes.length;
    if (removedCount > 0 && this.wsLatencies.length >= removedCount) {
      this.wsLatencies = this.wsLatencies.slice(removedCount);
    }

    // Prevent unbounded memory growth
    if (this.wsMessageTimes.length > this.MAX_STORED_MESSAGES) {
      const excess = this.wsMessageTimes.length - this.MAX_STORED_MESSAGES;
      this.wsMessageTimes = this.wsMessageTimes.slice(excess);
      if (this.wsLatencies.length >= excess) {
        this.wsLatencies = this.wsLatencies.slice(excess);
      }
    }
  }

  /**
   * Record WebSocket reconnection
   */
  recordWebSocketReconnect(): void {
    this.wsReconnects++;
    this.recordMetric('ws_reconnect', this.wsReconnects);
  }

  /**
   * Record dropped update due to rate limiting
   */
  recordDroppedUpdate(): void {
    this.wsDroppedUpdates++;
  }

  /**
   * Record throttled update
   */
  recordThrottledUpdate(): void {
    this.wsThrottledUpdates++;
  }

  /**
   * Start monitoring component renders
   */
  startRenderMonitoring(): void {
    this.renderTimes = [];
    this.renderCount = 0;
    this.priceUpdatesReceived = 0;
    this.priceUpdatesApplied = 0;
  }

  /**
   * Record component render time
   */
  recordRender(renderTime: number): void {
    this.renderTimes.push(renderTime);
    this.renderCount++;

    if (renderTime > 16) {
      this.increment('slow_renders');
    }

    // Keep only last 100 renders
    if (this.renderTimes.length > 100) {
      this.renderTimes = this.renderTimes.slice(-100);
    }
  }

  /**
   * Record price update received
   */
  recordPriceUpdateReceived(): void {
    this.priceUpdatesReceived++;
    this.recordMetric('price_update_received', this.priceUpdatesReceived);
  }

  /**
   * Record price update applied to UI
   */
  recordPriceUpdateApplied(): void {
    this.priceUpdatesApplied++;
    this.recordMetric('price_update_applied', this.priceUpdatesApplied);
  }

  /**
   * Get comprehensive metrics summary
   */
  getMetrics(): StockDetailMetrics {
    const now = Date.now(); // Use Date.now() to match wsMessageTimes format
    const wsMessagesLast60s = this.wsMessageTimes.filter(time => now - time < 60000).length;

    return {
      websocket: {
        connectionsCount: 1, // Assuming single connection
        messagesReceived: this.wsMessageTimes.length,
        messagesPerSecond: wsMessagesLast60s / 60,
        averageLatency: this.wsLatencies.length > 0
          ? this.wsLatencies.reduce((a, b) => a + b, 0) / this.wsLatencies.length
          : 0,
        reconnectCount: this.wsReconnects,
        droppedUpdates: this.wsDroppedUpdates,
        throttledUpdates: this.wsThrottledUpdates,
      },
      rendering: {
        componentRenders: this.renderCount,
        averageRenderTime: this.renderTimes.length > 0
          ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
          : 0,
        slowRenders: this.getCounter('slow_renders'),
        priceUpdatesReceived: this.priceUpdatesReceived,
        priceUpdatesApplied: this.priceUpdatesApplied,
        memoryUsage: this.getMemoryUsage(),
      },
      dataFetching: {
        quoteFetchTime: this.getAverageTime('quote_fetch'),
        newsFetchTime: this.getAverageTime('news_fetch'),
        sentimentFetchTime: this.getAverageTime('sentiment_fetch'),
        chartDataFetchTime: this.getAverageTime('chart_data_fetch'),
      },
      userExperience: {
        timeToFirstRender: this.getTime('time_to_first_render'),
        timeToInteractive: this.getTime('time_to_interactive'),
        priceUpdateLatency: this.wsLatencies.length > 0
          ? this.wsLatencies.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, this.wsLatencies.length)
          : 0,
      },
    };
  }

  /**
   * Get average time for a specific metric
   */
  private getAverageTime(name: string): number {
    const endMetrics = this.metrics.filter(m => m.name === `${name}_end` && m.duration !== undefined);
    if (endMetrics.length === 0) return 0;

    const totalTime = endMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return totalTime / endMetrics.length;
  }

  /**
   * Get single time measurement
   */
  private getTime(name: string): number {
    const metric = this.metrics.find(m => m.name === name);
    return metric?.duration || 0;
  }

  /**
   * Get memory usage (React Native specific)
   */
  private getMemoryUsage(): number {
    // In React Native, we can't access memory usage directly
    // This would need to be implemented with native modules
    if (typeof (global as any).__DEV__ !== 'undefined' && (global as any).__DEV__) {
      // In development, we could potentially use performance.memory if available
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize || 0;
      }
    }
    return 0;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    summary: StockDetailMetrics;
    rawMetrics: PerformanceMetric[];
    counters: Record<string, number>;
  } {
    return {
      summary: this.getMetrics(),
      rawMetrics: [...this.metrics],
      counters: Object.fromEntries(this.counters),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.startTimes.clear();
    this.counters.clear();
    this.wsMessageTimes = [];
    this.wsLatencies = [];
    this.renderTimes = [];
    this.wsReconnects = 0;
    this.wsDroppedUpdates = 0;
    this.wsThrottledUpdates = 0;
    this.renderCount = 0;
    this.priceUpdatesReceived = 0;
    this.priceUpdatesApplied = 0;

    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component render monitoring
export function useRenderMonitoring(componentName: string) {
  const renderStart = performance.now();

  useEffect(() => {
    const renderTime = performance.now() - renderStart;
    performanceMonitor.recordRender(renderTime);
    performanceMonitor.recordMetric(`${componentName}_render`, renderTime);
  }, [componentName]); // Added dependency array
}

// Utility for measuring async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceMonitor.startTiming(name, metadata);
  try {
    const result = await operation();
    performanceMonitor.endTiming(name, { success: true, ...metadata });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    performanceMonitor.endTiming(name, { success: false, error: errorMessage, ...metadata });
    throw error;
  }
}