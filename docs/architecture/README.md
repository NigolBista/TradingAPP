# Architecture Documentation

This folder contains system architecture and infrastructure documentation for the TradingApp.

## 📁 Contents

### 🔧 **Infrastructure & Performance**

#### [`CACHE_MANAGER_USAGE.md`](./CACHE_MANAGER_USAGE.md)
**Performance utilities lifecycle management guide**

- **Purpose**: Proper initialization and cleanup of performance utilities
- **Contains**:
  - Cache manager initialization procedures
  - WebSocket manager lifecycle management
  - Memory leak prevention strategies
  - Testing cleanup procedures

- **Key Features**:
  - Module-level side effect removal
  - Proper lifecycle management
  - SWR cache clearing optimization
  - Test-friendly initialization

- **When to Use**:
  - Setting up app initialization
  - Implementing proper cleanup in tests
  - Preventing memory leaks in production
  - Migrating from automatic to controlled initialization

## 🎯 **Implementation Priority**

### **High Priority**
- **Cache Manager Integration**: Prevents memory leaks and ensures stable performance

### **Key Benefits**
- ✅ **No Memory Leaks**: Proper cleanup of intervals and timers
- ✅ **Test-Friendly**: Tests can properly initialize and teardown
- ✅ **Controlled Initialization**: App decides when to start cache manager
- ✅ **Targeted Cache Clearing**: Only affects stock-related cache entries

## 🚀 **Quick Start**

### **App Integration**
```tsx
// App.tsx or index.js
import { initializeCacheManager, shutdownCacheManager } from './src/utils/cacheManager';
import { initializeWebSocketManager, shutdownWebSocketManager } from './src/services/optimizedWebSocketManager';

export default function App() {
  useEffect(() => {
    const initializePerformanceUtils = async () => {
      await initializeCacheManager();
      initializeWebSocketManager();
    };

    initializePerformanceUtils();

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

### **Test Integration**
```tsx
// __tests__/setup.ts or individual test files
import { shutdownCacheManager } from '../src/utils/cacheManager';
import { shutdownWebSocketManager } from '../src/services/optimizedWebSocketManager';

afterEach(async () => {
  await shutdownCacheManager();
  shutdownWebSocketManager();
});
```

## 🔗 **Related Documentation**

- **Performance Optimization**: [`../performance-optimization/`](../performance-optimization/) - WebSocket optimization testing
- **Migration Analysis**: [`../migration/`](../migration/) - Platform migration recommendations

## ⚠️ **Migration Required**

If you're upgrading from the previous version, you need to update your app initialization code to call `initializeCacheManager()` and ensure proper cleanup with `shutdownCacheManager()`.

The old automatic initialization on module import has been removed to prevent memory leaks and provide better control over the initialization process.