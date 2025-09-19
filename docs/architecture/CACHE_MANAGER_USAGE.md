# Performance Utilities Usage Guide

## Overview

Both the cache manager and WebSocket manager have been updated to remove module-level side effects and provide proper initialization/shutdown lifecycle management.

## Usage

### App Initialization

Call initialization functions during app startup:

```tsx
// App.tsx or index.js
import { initializeCacheManager, shutdownCacheManager } from './src/utils/cacheManager';
import { initializeWebSocketManager, shutdownWebSocketManager } from './src/services/optimizedWebSocketManager';

export default function App() {
  useEffect(() => {
    // Initialize performance utilities on app start
    const initializePerformanceUtils = async () => {
      await initializeCacheManager();
      initializeWebSocketManager();
    };

    initializePerformanceUtils();
  }, []);

  return (
    // Your app components
  );
}
```

### App Cleanup

Call shutdown functions during app teardown:

```tsx
// App.tsx
export default function App() {
  useEffect(() => {
    // Initialize on mount
    const initializePerformanceUtils = async () => {
      await initializeCacheManager();
      initializeWebSocketManager();
    };

    initializePerformanceUtils();

    // Cleanup on app unmount
    return () => {
      const shutdownPerformanceUtils = async () => {
        await shutdownCacheManager();
        shutdownWebSocketManager();
      };

      shutdownPerformanceUtils();
    };
  }, []);

  return (
    // Your app components
  );
}
```

### Testing

Always call shutdown functions in test cleanup to prevent timer leaks:

```tsx
// __tests__/setup.ts or individual test files
import { shutdownCacheManager } from '../src/utils/cacheManager';
import { shutdownWebSocketManager } from '../src/services/optimizedWebSocketManager';

afterEach(async () => {
  // Cleanup after each test
  await shutdownCacheManager();
  shutdownWebSocketManager();
});

// Or in Jest setup:
afterAll(async () => {
  // Final cleanup
  await shutdownCacheManager();
  shutdownWebSocketManager();
});
```

## Changes Made

### Fixed Issues

#### Cache Manager (`src/utils/cacheManager.ts`)

1. **Removed Module-Level Side Effects**:
   - No longer calls `restoreCache()` automatically on import
   - No longer creates `setInterval` on module load
   - Prevents memory leaks and uncontrolled initialization

2. **Added Proper Lifecycle Management**:
   - `initializeCacheManager()` - Call during app startup
   - `shutdownCacheManager()` - Call during app teardown or test cleanup
   - Interval ID stored in module-scoped variable for proper cleanup

3. **Fixed SWR Cache Clearing**:
   - Changed from `mutate(() => true, ...)` to targeted stock key filtering
   - Only clears stock-related cache entries (`quote:`, `news:`, `sentiment:`)
   - Prevents accidental clearing of other SWR cache entries

#### WebSocket Manager (`src/services/optimizedWebSocketManager.ts`)

1. **Removed Module-Level Side Effects**:
   - No longer creates buffer flush `setInterval` on module load
   - Prevents timer leaks during testing and development

2. **Added Proper Lifecycle Management**:
   - `initializeWebSocketManager()` - Call during app startup
   - `shutdownWebSocketManager()` - Call during app teardown or test cleanup
   - Buffer flush interval properly managed with cleanup

### Benefits

- **No Memory Leaks**: Proper cleanup of intervals and timers
- **Test-Friendly**: Tests can properly initialize and teardown
- **Controlled Initialization**: App decides when to start cache manager
- **Targeted Cache Clearing**: Only affects stock-related cache entries

## Migration Required

Update your app initialization code to call `initializeCacheManager()` and ensure proper cleanup with `shutdownCacheManager()`.