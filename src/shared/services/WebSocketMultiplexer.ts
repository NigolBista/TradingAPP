import { supabase } from '../lib/supabase';
import { Quote } from './BatchDataFetcher';

// Types for WebSocket handling
export interface MarketDataUpdate {
  ticker: string;
  data: Quote;
  timestamp: number;
}

export interface SubscriptionInfo {
  ticker: string;
  users: Set<string>;
  subscribedAt: number;
}

export interface WebSocketMetrics {
  connectionsCount: number;
  subscriptionsCount: number;
  messagesReceived: number;
  messagesDistributed: number;
  reconnectionAttempts: number;
  averageLatency: number;
  uptime: number;
}

export interface UserSubscription {
  userId: string;
  tickers: string[];
  preferences?: {
    updateInterval?: number;
    priceThreshold?: number;
  };
}

/**
 * WebSocket Multiplexer for cost-effective real-time data distribution
 *
 * Key Features:
 * - Single WebSocket connection for all users
 * - Reference counting for ticker subscriptions
 * - Automatic reconnection with exponential backoff
 * - Intelligent message distribution via Supabase Realtime
 * - Cost tracking and optimization
 * - Connection health monitoring
 */
export class WebSocketMultiplexer {
  private connection: WebSocket | null = null;
  private subscriptions: Map<string, SubscriptionInfo> = new Map(); // ticker -> subscription info
  private userMappings: Map<string, Set<string>> = new Map(); // userId -> tickers

  // Connection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connectionStartTime = 0;
  private isConnecting = false;

  // Metrics and monitoring
  private metrics: WebSocketMetrics = {
    connectionsCount: 0,
    subscriptionsCount: 0,
    messagesReceived: 0,
    messagesDistributed: 0,
    reconnectionAttempts: 0,
    averageLatency: 0,
    uptime: 0
  };

  // Message queue for offline scenarios
  private messageQueue: MarketDataUpdate[] = [];
  private maxQueueSize = 1000;

  // Supabase realtime channels for distribution
  private realtimeChannels: Map<string, any> = new Map();

  constructor() {
    this.setupPeriodicTasks();
  }

  /**
   * Initialize and connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.connection && this.connection.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = process.env.EXPO_PUBLIC_MARKET_DATA_WEBSOCKET_URL || 'wss://socket.polygon.io/stocks';

      console.log('📡 Connecting to WebSocket:', wsUrl);

      this.connection = new WebSocket(wsUrl);
      this.connectionStartTime = Date.now();

      this.connection.onopen = this.handleOpen.bind(this);
      this.connection.onmessage = this.handleMessage.bind(this);
      this.connection.onclose = this.handleClose.bind(this);
      this.connection.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  /**
   * Subscribe user to ticker updates
   */
  async subscribeTicker(ticker: string, userId: string): Promise<void> {
    try {
      // Update database subscription count
      const { data: isFirstSubscriber } = await supabase
        .rpc('subscribe_user_to_ticker', {
          p_user_id: userId,
          p_ticker: ticker
        });

      // Update local mappings
      if (!this.userMappings.has(userId)) {
        this.userMappings.set(userId, new Set());
      }
      this.userMappings.get(userId)!.add(ticker);

      // Handle subscription info
      if (!this.subscriptions.has(ticker)) {
        this.subscriptions.set(ticker, {
          ticker,
          users: new Set(),
          subscribedAt: Date.now()
        });

        // Subscribe to WebSocket if this is the first subscriber
        if (isFirstSubscriber && this.connection?.readyState === WebSocket.OPEN) {
          this.sendWebSocketSubscription(ticker);
        }
      }

      this.subscriptions.get(ticker)!.users.add(userId);
      this.metrics.subscriptionsCount = this.subscriptions.size;

      // Ensure Supabase Realtime channel exists
      await this.ensureRealtimeChannel(ticker);

      console.log(`✅ User ${userId} subscribed to ${ticker}. Total subscribers: ${this.subscriptions.get(ticker)!.users.size}`);

    } catch (error) {
      console.error(`Error subscribing to ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from ticker updates
   */
  async unsubscribeTicker(ticker: string, userId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(ticker);
      if (!subscription) return;

      // Remove from local mappings
      subscription.users.delete(userId);
      const userTickers = this.userMappings.get(userId);
      if (userTickers) {
        userTickers.delete(ticker);
        if (userTickers.size === 0) {
          this.userMappings.delete(userId);
        }
      }

      // Update database subscription count
      const { data: isLastSubscriber } = await supabase
        .rpc('unsubscribe_user_from_ticker', {
          p_user_id: userId,
          p_ticker: ticker
        });

      // If no more subscribers, clean up
      if (subscription.users.size === 0 || isLastSubscriber) {
        this.subscriptions.delete(ticker);

        // Unsubscribe from WebSocket
        if (this.connection?.readyState === WebSocket.OPEN) {
          this.sendWebSocketUnsubscription(ticker);
        }

        // Clean up Realtime channel
        this.cleanupRealtimeChannel(ticker);
      }

      this.metrics.subscriptionsCount = this.subscriptions.size;

      console.log(`✅ User ${userId} unsubscribed from ${ticker}. Remaining subscribers: ${subscription.users.size}`);

    } catch (error) {
      console.error(`Error unsubscribing from ${ticker}:`, error);
    }
  }

  /**
   * Subscribe user to multiple tickers efficiently
   */
  async subscribeUserToTickers(userId: string, tickers: string[]): Promise<void> {
    const subscribePromises = tickers.map(ticker =>
      this.subscribeTicker(ticker, userId)
    );

    await Promise.allSettled(subscribePromises);
  }

  /**
   * Unsubscribe user from all tickers
   */
  async unsubscribeUserFromAll(userId: string): Promise<void> {
    const userTickers = this.userMappings.get(userId);
    if (!userTickers) return;

    const unsubscribePromises = Array.from(userTickers).map(ticker =>
      this.unsubscribeTicker(ticker, userId)
    );

    await Promise.allSettled(unsubscribePromises);
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('📡 WebSocket connected successfully');

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.metrics.connectionsCount++;

    // Authenticate with API key if needed
    if (process.env.EXPO_PUBLIC_POLYGON_API_KEY) {
      this.connection?.send(JSON.stringify({
        action: 'auth',
        params: process.env.EXPO_PUBLIC_POLYGON_API_KEY
      }));
    }

    // Resubscribe to all active tickers
    this.resubscribeAll();

    // Process any queued messages
    this.processMessageQueue();
  }

  /**
   * Handle WebSocket message
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const data = JSON.parse(event.data);
      this.metrics.messagesReceived++;

      // Handle different message types
      if (Array.isArray(data)) {
        // Batch updates
        for (const update of data) {
          await this.processMarketUpdate(update);
        }
      } else {
        // Single update
        await this.processMarketUpdate(data);
      }

    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }

  /**
   * Process individual market update
   */
  private async processMarketUpdate(update: any): Promise<void> {
    try {
      // Parse update based on Polygon.io format
      if (update.ev === 'Q' && update.sym) { // Quote update
        const ticker = update.sym;
        const marketData: Quote = {
          ticker,
          price: update.bp || update.ap || 0, // bid or ask price
          changePercent: 0, // Calculate if available
          volume: update.bs || update.as || 0, // bid or ask size
          lastUpdated: Date.now(),
          source: 'websocket'
        };

        await this.distributeUpdate({
          ticker,
          data: marketData,
          timestamp: Date.now()
        });
      }

      // Handle other update types (trades, aggregates, etc.)
      if (update.ev === 'T' && update.sym) { // Trade update
        const ticker = update.sym;
        const marketData: Quote = {
          ticker,
          price: update.p || 0, // trade price
          changePercent: 0,
          volume: update.s || 0, // trade size
          lastUpdated: Date.now(),
          source: 'websocket'
        };

        await this.distributeUpdate({
          ticker,
          data: marketData,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Error processing market update:', error);
    }
  }

  /**
   * Distribute update to all subscribed users
   */
  private async distributeUpdate(update: MarketDataUpdate): Promise<void> {
    const { ticker, data } = update;
    const subscription = this.subscriptions.get(ticker);

    if (!subscription || subscription.users.size === 0) return;

    try {
      // Cache the update in database
      await this.cacheMarketData(ticker, data);

      // Distribute via Supabase Realtime to all users
      const channel = this.realtimeChannels.get(ticker);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'quote_update',
          payload: {
            ticker,
            ...data,
            subscriberCount: subscription.users.size
          }
        });

        this.metrics.messagesDistributed++;
      }

      // Track cost savings
      await this.trackDistributionCost(ticker, subscription.users.size);

    } catch (error) {
      console.error(`Error distributing update for ${ticker}:`, error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('📡 WebSocket disconnected:', event.code, event.reason);
    this.connection = null;
    this.isConnecting = false;

    // Attempt reconnection unless it was intentional
    if (event.code !== 1000) { // 1000 = normal closure
      this.handleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event): void {
    console.error('📡 WebSocket error:', error);
    this.handleReconnect();
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    this.metrics.reconnectionAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`🔄 Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send WebSocket subscription for ticker
   */
  private sendWebSocketSubscription(ticker: string): void {
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify({
        action: 'subscribe',
        params: `Q.${ticker},T.${ticker}` // Subscribe to quotes and trades
      }));

      console.log(`📡 Subscribed to WebSocket updates for ${ticker}`);
    }
  }

  /**
   * Send WebSocket unsubscription for ticker
   */
  private sendWebSocketUnsubscription(ticker: string): void {
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify({
        action: 'unsubscribe',
        params: `Q.${ticker},T.${ticker}`
      }));

      console.log(`📡 Unsubscribed from WebSocket updates for ${ticker}`);
    }
  }

  /**
   * Resubscribe to all active tickers
   */
  private async resubscribeAll(): Promise<void> {
    try {
      // Get all active tickers from database
      const { data: activeTickers } = await supabase.rpc('get_active_tickers');

      for (const { ticker } of activeTickers || []) {
        if (this.connection?.readyState === WebSocket.OPEN) {
          this.sendWebSocketSubscription(ticker);
        }

        // Ensure Realtime channel exists
        await this.ensureRealtimeChannel(ticker);
      }

      console.log(`📡 Resubscribed to ${activeTickers?.length || 0} active tickers`);

    } catch (error) {
      console.error('Error resubscribing to tickers:', error);
    }
  }

  /**
   * Ensure Supabase Realtime channel exists for ticker
   */
  private async ensureRealtimeChannel(ticker: string): Promise<void> {
    if (this.realtimeChannels.has(ticker)) return;

    try {
      const channel = supabase.channel(`ticker:${ticker}`, {
        config: {
          broadcast: { self: false }
        }
      });

      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 Realtime channel created for ${ticker}`);
        }
      });

      this.realtimeChannels.set(ticker, channel);

    } catch (error) {
      console.error(`Error creating Realtime channel for ${ticker}:`, error);
    }
  }

  /**
   * Clean up Realtime channel for ticker
   */
  private cleanupRealtimeChannel(ticker: string): void {
    const channel = this.realtimeChannels.get(ticker);
    if (channel) {
      channel.unsubscribe();
      this.realtimeChannels.delete(ticker);
      console.log(`📡 Cleaned up Realtime channel for ${ticker}`);
    }
  }

  /**
   * Cache market data in database
   */
  private async cacheMarketData(ticker: string, data: Quote): Promise<void> {
    try {
      await supabase.rpc('update_market_data_cache', {
        p_ticker: ticker,
        p_quote_data: data,
        p_price: data.price,
        p_change_percent: data.changePercent,
        p_volume: data.volume,
        p_ttl_seconds: 15 // 15 seconds TTL for real-time data
      });

    } catch (error) {
      console.error('Error caching market data:', error);
    }
  }

  /**
   * Track distribution cost for monitoring
   */
  private async trackDistributionCost(ticker: string, userCount: number): Promise<void> {
    try {
      // Each WebSocket message saved us (userCount - 1) API calls
      const costSaved = Math.max(0, userCount - 1) * 1; // 1 cent per API call

      await supabase.rpc('track_api_cost', {
        p_service_type: 'websocket_multiplexer',
        p_operation_type: 'real_time_distribution',
        p_request_count: 1,
        p_cost_cents: -costSaved // Negative cost = savings
      });

    } catch (error) {
      console.error('Error tracking distribution cost:', error);
    }
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`📡 Processing ${this.messageQueue.length} queued messages`);

    const queuedMessages = [...this.messageQueue];
    this.messageQueue = [];

    queuedMessages.forEach(update => {
      this.distributeUpdate(update);
    });
  }

  /**
   * Setup periodic maintenance tasks
   */
  private setupPeriodicTasks(): void {
    // Update metrics every minute
    setInterval(() => {
      this.updateMetrics();
    }, 60000);

    // Clean up stale channels every 5 minutes
    setInterval(() => {
      this.cleanupStaleChannels();
    }, 300000);

    // Heartbeat check every 30 seconds
    setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    this.metrics.uptime = this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0;
    this.metrics.subscriptionsCount = this.subscriptions.size;

    // Log metrics for monitoring
    console.log('📊 WebSocket Metrics:', {
      subscriptions: this.metrics.subscriptionsCount,
      messagesReceived: this.metrics.messagesReceived,
      messagesDistributed: this.metrics.messagesDistributed,
      uptime: Math.round(this.metrics.uptime / 1000) + 's'
    });
  }

  /**
   * Clean up stale Realtime channels
   */
  private cleanupStaleChannels(): void {
    for (const [ticker, channel] of this.realtimeChannels.entries()) {
      if (!this.subscriptions.has(ticker)) {
        channel.unsubscribe();
        this.realtimeChannels.delete(ticker);
        console.log(`🧹 Cleaned up stale channel for ${ticker}`);
      }
    }
  }

  /**
   * Send heartbeat to maintain connection
   */
  private sendHeartbeat(): void {
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify({
        action: 'ping'
      }));
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.connection) {
      this.connection.close(1000, 'Intentional disconnect');
      this.connection = null;
    }

    // Clean up all Realtime channels
    for (const [ticker, channel] of this.realtimeChannels.entries()) {
      channel.unsubscribe();
    }
    this.realtimeChannels.clear();

    console.log('📡 WebSocket disconnected intentionally');
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    subscriptions: number;
    uptime: number;
  } {
    return {
      connected: this.connection?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      uptime: this.metrics.uptime
    };
  }

  /**
   * Get subscriptions for debugging
   */
  getSubscriptions(): Map<string, SubscriptionInfo> {
    return new Map(this.subscriptions);
  }
}

// Singleton instance for global use
export const webSocketMultiplexer = new WebSocketMultiplexer();