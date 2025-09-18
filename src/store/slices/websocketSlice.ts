import { StateCreator } from 'zustand';
import { AppState, StoreActions, WebSocketState, RealTimeUpdate } from '../types';

// Initial WebSocket state
const initialWebSocketState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  lastConnected: null,
  reconnectAttempts: 0,
  subscriptions: [],
};

// WebSocket slice creator
export const createWebSocketSlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  WebSocketState & Pick<StoreActions, 'connect' | 'disconnect' | 'subscribe' | 'unsubscribe' | 'handleMessage'>
> = (set, get) => ({
  ...initialWebSocketState,

  // WebSocket actions
  connect: () => {
    const state = get();

      // Don't connect if already connected or connecting
      if (state.websocket.isConnected || state.websocket.isConnecting) {
        return;
      }

      // Don't connect if not authenticated
      if (!state.auth.isAuthenticated) {
        console.warn('Cannot connect WebSocket: user not authenticated');
        return;
      }

      set((prevState) => ({
        websocket: {
          ...prevState.websocket,
          isConnecting: true,
        },
      }));

      try {
        // This would be implemented with actual WebSocket connection
        // For now, simulate connection success
        setTimeout(() => {
          set((prevState) => ({
            websocket: {
              ...prevState.websocket,
              isConnected: true,
              isConnecting: false,
              lastConnected: Date.now(),
              reconnectAttempts: 0,
            },
          }));

          // Update UI connection status
          get().updateConnectionStatus('websocket', 'connected');

          // Re-subscribe to existing subscriptions
          const currentSubscriptions = get().websocket.subscriptions;
          currentSubscriptions.forEach((channel) => {
            // Re-subscribe logic would go here
            console.log(`Re-subscribing to ${channel}`);
          });
        }, 1000);
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        set((prevState) => ({
          websocket: {
            ...prevState.websocket,
            isConnecting: false,
            reconnectAttempts: prevState.websocket.reconnectAttempts + 1,
          },
        }));

        get().updateConnectionStatus('websocket', 'error');

        // Retry connection with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, get().websocket.reconnectAttempts), 30000);
        setTimeout(() => {
          if (get().websocket.reconnectAttempts < 5) {
            get().connect();
          }
        }, retryDelay);
      }
    },

    // Disconnect WebSocket
    disconnect: () => {
      set((state) => ({
        websocket: {
          ...state.websocket,
          isConnected: false,
          isConnecting: false,
          subscriptions: [],
        },
      }));

      get().updateConnectionStatus('websocket', 'disconnected');
    },

    // Subscribe to a channel
    subscribe: (channel) => {
      const state = get();

      if (!state.websocket.isConnected) {
        console.warn(`Cannot subscribe to ${channel}: WebSocket not connected`);
        return;
      }

      if (state.websocket.subscriptions.includes(channel)) {
        console.log(`Already subscribed to ${channel}`);
        return;
      }

      set((prevState) => ({
        websocket: {
          ...prevState.websocket,
          subscriptions: [...prevState.websocket.subscriptions, channel],
        },
      }));

      // Send subscription message to WebSocket
      console.log(`Subscribing to ${channel}`);
      // actualWebSocket.send(JSON.stringify({ action: 'subscribe', channel }));
    },

    // Unsubscribe from a channel
    unsubscribe: (channel) => {
      set((state) => ({
        websocket: {
          ...state.websocket,
          subscriptions: state.websocket.subscriptions.filter(sub => sub !== channel),
        },
      }));

      console.log(`Unsubscribing from ${channel}`);
      // actualWebSocket.send(JSON.stringify({ action: 'unsubscribe', channel }));
    },

    // Handle incoming WebSocket message
    handleMessage: (message) => {
      try {
        // Route message to appropriate handler based on type
        switch (message.type) {
          case 'quote':
            // Update trading real-time data
            if (message.symbol) {
              const symbol = message.symbol;
              set((state) => ({
                trading: {
                  ...state.trading,
                  realTimeData: {
                    ...state.trading.realTimeData,
                    [symbol]: message.data,
                  },
                },
              }));

              // Also update market quotes
              set((state) => ({
                market: {
                  ...state.market,
                  quotes: {
                    ...state.market.quotes,
                    [symbol]: message.data,
                  },
                },
              }));
            }
            break;

          case 'order':
            // Update order status
            set((state) => ({
              trading: {
                ...state.trading,
                orders: {
                  ...state.trading.orders,
                  [message.data.id]: message.data,
                },
              },
            }));

            // Show notification for order updates
            get().addNotification({
              type: message.data.status === 'filled' ? 'success' : 'info',
              title: 'Order Update',
              message: `Order ${message.data.id} is ${message.data.status}`,
            });
            break;

          case 'position':
            // Update position data
            const positionKey = `${message.data.accountId}:${message.data.symbol}`;
            set((state) => ({
              trading: {
                ...state.trading,
                positions: {
                  ...state.trading.positions,
                  [positionKey]: message.data,
                },
              },
              portfolio: {
                ...state.portfolio,
                positions: {
                  ...state.portfolio.positions,
                  [positionKey]: message.data,
                },
              },
            }));
            break;

          case 'alert':
            // Handle alert triggers
            if (message.data.isTriggered) {
              set((state) => ({
                trading: {
                  ...state.trading,
                  alerts: {
                    ...state.trading.alerts,
                    [message.data.id]: message.data,
                  },
                },
              }));

              get().addNotification({
                type: 'warning',
                title: 'Alert Triggered',
                message: message.data.message || `Alert for ${message.data.symbol}`,
                autoClose: false,
              });
            }
            break;

          case 'news':
            // Update news data
            if (message.symbol) {
              const symbol = message.symbol;
              set((state) => ({
                market: {
                  ...state.market,
                  news: {
                    ...state.market.news,
                    bySymbol: {
                      ...state.market.news.bySymbol,
                      [symbol]: [
                        message.data,
                        ...(state.market.news.bySymbol[symbol] || []),
                      ].slice(0, 50), // Keep only latest 50 news items
                    },
                  },
                },
              }));
            } else {
              // Global news
              set((state) => ({
                market: {
                  ...state.market,
                  news: {
                    ...state.market.news,
                    global: [message.data, ...state.market.news.global].slice(0, 100),
                  },
                },
              }));
            }
            break;

          default:
            console.warn('Unknown WebSocket message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    },
});

// WebSocket-related selectors
export const webSocketSelectors = {
  // Connection status
  isConnected: (state: AppState) => state.websocket.isConnected,
  isConnecting: (state: AppState) => state.websocket.isConnecting,
  lastConnected: (state: AppState) => state.websocket.lastConnected,
  reconnectAttempts: (state: AppState) => state.websocket.reconnectAttempts,

  // Subscriptions
  subscriptions: (state: AppState) => state.websocket.subscriptions,
  isSubscribedTo: (channel: string) => (state: AppState) =>
    state.websocket.subscriptions.includes(channel),
  subscriptionCount: (state: AppState) => state.websocket.subscriptions.length,

  // Connection health
  connectionAge: (state: AppState) => {
    const lastConnected = state.websocket.lastConnected;
    return lastConnected ? Date.now() - lastConnected : null;
  },
  needsReconnect: (state: AppState) => {
    const connectionAge = webSocketSelectors.connectionAge(state);
    return connectionAge !== null && connectionAge > 300000; // 5 minutes
  },
};