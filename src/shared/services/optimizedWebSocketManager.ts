/**
 * Optimized WebSocket Manager with Throttling and Connection Pooling
 * Handles efficient real-time price updates for trading app
 */

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  change?: number;
  changePercent?: number;
}

interface SubscriptionOptions {
  throttleMs?: number; // Throttle updates to this frequency
  maxUpdatesPerSecond?: number; // Maximum updates per second
}

type PriceCallback = (update: PriceUpdate) => void;
type ErrorCallback = (error: Error) => void;

class OptimizedWebSocketManager {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private subscriptions = new Map<string, Set<PriceCallback>>();
  private throttledCallbacks = new Map<string, NodeJS.Timeout>();
  private lastUpdateTime = new Map<string, number>();
  private updateBuffer = new Map<string, PriceUpdate>();
  private errorCallbacks = new Set<ErrorCallback>();

  // Configuration
  private readonly reconnectDelay = 5000; // 5 seconds
  private readonly maxReconnectAttempts = 10;
  private readonly defaultThrottleMs = 100; // 10 Hz default
  private readonly maxUpdatesPerSecond = 20; // Rate limit

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionQuality = 'good'; // 'good' | 'poor' | 'disconnected'

  /**
   * Connect to WebSocket with automatic reconnection
   * Compatible with Polygon WebSocket API format
   */
  async connect(url: string, apiKey?: string): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      await this.establishConnection(url, apiKey);
      this.reconnectAttempts = 0;
      this.connectionQuality = 'good';
    } catch (error) {
      this.connectionQuality = 'disconnected';
      this.handleConnectionError(error as Error);
    } finally {
      this.isConnecting = false;
    }
  }

  private async establishConnection(url: string, apiKey?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      const connectionTimeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000); // 10 second timeout

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('🔌 WebSocket connected');

        if (apiKey) {
          this.authenticate(apiKey);
        }

        this.isConnected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.connectionQuality = 'disconnected';

        if (event.code !== 1000) { // Not a normal closure
          this.scheduleReconnect(url, apiKey);
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('🔌 WebSocket error:', error);
        this.connectionQuality = 'poor';
        reject(error);
      };
    });
  }

  private authenticate(apiKey: string): void {
    this.send({
      action: 'auth',
      params: apiKey
    });
  }

  private handleMessage(data: string): void {
    try {
      const messages = JSON.parse(data);
      const messageArray = Array.isArray(messages) ? messages : [messages];

      for (const message of messageArray) {
        this.processMessage(message);
      }
    } catch (error) {
      console.error('🔌 Failed to parse WebSocket message:', error);
    }
  }

  private processMessage(message: any): void {
    // Handle authentication response
    if (message.ev === 'status' && message.status === 'auth_success') {
      console.log('🔌 WebSocket authenticated');
      return;
    }

    // Handle price updates (trades)
    if (message.ev === 'T') {
      this.handlePriceUpdate({
        symbol: message.sym,
        price: message.p,
        timestamp: message.t,
        change: message.c,
        changePercent: message.cp
      });
    }

    // Handle aggregate bars
    if (message.ev === 'A' || message.ev === 'AM') {
      this.handlePriceUpdate({
        symbol: message.sym,
        price: message.c, // Close price
        timestamp: message.t,
      });
    }
  }

  private handlePriceUpdate(update: PriceUpdate): void {
    const { symbol } = update;

    // Rate limiting check
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(symbol) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    if (timeSinceLastUpdate < (1000 / this.maxUpdatesPerSecond)) {
      // Buffer the update for throttled delivery
      this.updateBuffer.set(symbol, update);
      return;
    }

    this.lastUpdateTime.set(symbol, now);
    this.deliverUpdate(update);
  }

  private deliverUpdate(update: PriceUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol);
    if (!callbacks || callbacks.size === 0) {
      return;
    }

    // Deliver to all subscribers
    callbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('🔌 Error in price callback:', error);
      }
    });
  }

  /**
   * Subscribe to price updates for a symbol with throttling
   */
  subscribe(
    symbol: string,
    callback: PriceCallback,
    options: SubscriptionOptions = {}
  ): () => void {
    const { throttleMs = this.defaultThrottleMs } = options;

    // Create throttled callback if needed
    let throttledCallback = callback;

    if (throttleMs > 0) {
      let lastCallTime = 0;
      let pendingUpdate: PriceUpdate | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      throttledCallback = (update: PriceUpdate) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        if (timeSinceLastCall >= throttleMs) {
          // Call immediately
          lastCallTime = now;
          callback(update);
        } else {
          // Buffer the update and schedule delayed call
          pendingUpdate = update;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          timeoutId = setTimeout(() => {
            if (pendingUpdate) {
              lastCallTime = Date.now();
              callback(pendingUpdate);
              pendingUpdate = null;
            }
            timeoutId = null;
          }, throttleMs - timeSinceLastCall);
        }
      };
    }

    // Add to subscriptions
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
      this.subscribeToSymbol(symbol);
    }

    this.subscriptions.get(symbol)!.add(throttledCallback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(throttledCallback);

        if (callbacks.size === 0) {
          this.subscriptions.delete(symbol);
          this.unsubscribeFromSymbol(symbol);
        }
      }
    };
  }

  private subscribeToSymbol(symbol: string): void {
    if (!this.isConnected) {
      console.warn(`🔌 Cannot subscribe to ${symbol}: not connected`);
      return;
    }

    // Subscribe to trades and minute aggregates
    this.send({
      action: 'subscribe',
      params: `T.${symbol},AM.${symbol}`
    });

    console.log(`🔌 Subscribed to ${symbol}`);
  }

  private unsubscribeFromSymbol(symbol: string): void {
    if (!this.isConnected) {
      return;
    }

    this.send({
      action: 'unsubscribe',
      params: `T.${symbol},AM.${symbol}`
    });

    console.log(`🔌 Unsubscribed from ${symbol}`);
  }

  /**
   * Subscribe to error events
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  private handleConnectionError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        console.error('🔌 Error in error callback:', e);
      }
    });
  }

  private scheduleReconnect(url: string, apiKey?: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔌 Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`🔌 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(url, apiKey);
    }, delay);
  }

  private send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('🔌 Cannot send message: WebSocket not open');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('🔌 Failed to send message:', error);
    }
  }

  /**
   * Get connection status and quality
   */
  getConnectionStatus(): {
    connected: boolean;
    quality: string;
    subscribedSymbols: string[];
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      quality: this.connectionQuality,
      subscribedSymbols: Array.from(this.subscriptions.keys()),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Process buffered updates (call periodically)
   */
  flushBufferedUpdates(): void {
    const now = Date.now();

    this.updateBuffer.forEach((update, symbol) => {
      const lastUpdate = this.lastUpdateTime.get(symbol) || 0;
      const timeSinceLastUpdate = now - lastUpdate;

      if (timeSinceLastUpdate >= (1000 / this.maxUpdatesPerSecond)) {
        this.lastUpdateTime.set(symbol, now);
        this.deliverUpdate(update);
        this.updateBuffer.delete(symbol);
      }
    });
  }

  /**
   * Close WebSocket connection
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear all throttled callbacks
    this.throttledCallbacks.forEach(timeout => clearTimeout(timeout));
    this.throttledCallbacks.clear();

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.isConnected = false;
    this.connectionQuality = 'disconnected';
    this.subscriptions.clear();
    this.updateBuffer.clear();
    this.lastUpdateTime.clear();
  }
}

// Global instance
export const optimizedWebSocketManager = new OptimizedWebSocketManager();

// Module-scoped flush interval reference
let flushIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize WebSocket manager - call during app startup
 */
export function initializeWebSocketManager(): void {
  try {
    // Setup buffer flush interval if not already running
    if (flushIntervalId === null) {
      flushIntervalId = setInterval(() => {
        optimizedWebSocketManager.flushBufferedUpdates();
      }, 50); // Flush every 50ms

      console.log('🔌 WebSocket manager initialized with buffer flushing');
    }
  } catch (error) {
    console.error('Failed to initialize WebSocket manager:', error);
  }
}

/**
 * Shutdown WebSocket manager - call during app teardown or in tests
 */
export function shutdownWebSocketManager(): void {
  try {
    // Clear the flush interval
    if (flushIntervalId !== null) {
      clearInterval(flushIntervalId);
      flushIntervalId = null;
    }

    // Disconnect WebSocket
    optimizedWebSocketManager.disconnect();

    console.log('🔌 WebSocket manager shutdown completed');
  } catch (error) {
    console.error('Error during WebSocket manager shutdown:', error);
  }
}