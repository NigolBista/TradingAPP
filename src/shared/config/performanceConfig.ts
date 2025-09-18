/**
 * Performance optimization configuration
 * Toggle between original and optimized implementations for A/B testing
 */

// Feature flags for performance optimizations
export const PERFORMANCE_CONFIG = {
  // Use optimized WebSocket manager instead of direct Polygon WebSocket
  USE_OPTIMIZED_WEBSOCKET: false, // Set to true to enable optimization

  // WebSocket optimization settings
  WEBSOCKET_THROTTLE_MS: 100, // Throttle updates to 10Hz by default
  WEBSOCKET_MAX_UPDATES_PER_SECOND: 10, // Rate limit to prevent UI flooding

  // Performance monitoring
  ENABLE_PERFORMANCE_MONITORING: __DEV__, // Only in development by default

  // Connection settings
  WEBSOCKET_RECONNECT_DELAY: 5000, // 5 seconds
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS: 10,

  // Buffer settings
  WEBSOCKET_BUFFER_FLUSH_INTERVAL_MS: 50, // Flush buffered updates every 50ms
};

/**
 * Get the appropriate stock details hook based on configuration
 */
export function getStockDetailsHook() {
  if (PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET) {
    // Dynamic import to avoid loading optimized code when not needed
    return import('../hooks/useOptimizedStockDetails').then(
      module => module.useOptimizedStockDetails
    );
  } else {
    return import('../hooks/useStockDetails').then(
      module => module.useStockDetails
    );
  }
}

/**
 * Performance test configuration
 */
export const TEST_CONFIG = {
  // Test scenarios
  BASELINE_TEST_DURATION_MS: 30000, // 30 seconds
  STRESS_TEST_DURATION_MS: 60000, // 1 minute
  STRESS_TEST_UPDATE_RATE: 50, // updates per second

  // Test symbols
  TEST_SYMBOLS: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'],

  // Performance thresholds
  TARGET_WEBSOCKET_LATENCY_MS: 100,
  TARGET_RENDER_TIME_MS: 16, // 60fps
  TARGET_DROPPED_UPDATES: 0,
  TARGET_PERFORMANCE_SCORE: 80, // out of 100
};

/**
 * Enable optimized WebSocket for performance testing
 */
export function enableOptimizedWebSocket() {
  (PERFORMANCE_CONFIG as any).USE_OPTIMIZED_WEBSOCKET = true;
  console.log('🚀 Optimized WebSocket enabled for testing');
}

/**
 * Disable optimized WebSocket (revert to original)
 */
export function disableOptimizedWebSocket() {
  (PERFORMANCE_CONFIG as any).USE_OPTIMIZED_WEBSOCKET = false;
  console.log('📊 Reverted to original WebSocket implementation');
}

/**
 * Get current configuration status
 */
export function getPerformanceConfig() {
  return {
    ...PERFORMANCE_CONFIG,
    isOptimized: PERFORMANCE_CONFIG.USE_OPTIMIZED_WEBSOCKET,
    testConfig: TEST_CONFIG,
  };
}

// Expose configuration to global scope in development for easy testing
if (__DEV__) {
  (global as any).enableOptimizedWebSocket = enableOptimizedWebSocket;
  (global as any).disableOptimizedWebSocket = disableOptimizedWebSocket;
  (global as any).getPerformanceConfig = getPerformanceConfig;
}