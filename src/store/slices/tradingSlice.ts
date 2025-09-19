// @ts-nocheck
import { StateCreator } from 'zustand';
import { AppState, StoreActions, TradingState, RealTimeUpdate } from '../types';
import { TradingRepository } from "../../shared/services/repositories/TradingRepository";

// Initial trading state
const initialTradingState: TradingState = {
  orders: {},
  positions: {},
  alerts: {},
  strategies: {},
  signals: {},
  riskMetrics: null,
  marketStatus: {
    isOpen: false,
  },
  realTimeData: {},
  subscriptions: new Set(),
  _meta: {
    lastUpdated: 0,
    isLoading: false,
    error: null,
  },
};

// Trading slice creator
export const createTradingSlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  TradingState & Pick<StoreActions, 'submitOrder' | 'cancelOrder' | 'updatePosition' | 'createAlert' | 'subscribeToSymbol' | 'unsubscribeFromSymbol'>
> = (set, get) => ({
  ...initialTradingState,

  // Trading actions
  submitOrder: async (order) => {
    const tradingRepo = new TradingRepository(get().apiClient);

      set((state) => ({
        trading: {
          ...state.trading,
          _meta: { ...state.trading._meta, isLoading: true, error: null },
        },
      }));

      try {
        const response = await tradingRepo.submitOrder(order);
        const newOrder = response.data;

        set((state) => ({
          trading: {
            ...state.trading,
            orders: {
              ...state.trading.orders,
              [newOrder.id]: newOrder,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        return newOrder.id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          trading: {
            ...state.trading,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    cancelOrder: async (orderId) => {
      const tradingRepo = new TradingRepository(get().apiClient);

      try {
        const response = await tradingRepo.cancelOrder(orderId);
        const cancelledOrder = response.data;

        set((state) => ({
          trading: {
            ...state.trading,
            orders: {
              ...state.trading.orders,
              [orderId]: cancelledOrder,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          trading: {
            ...state.trading,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Position management
    updatePosition: async (accountId, symbol) => {
      const tradingRepo = new TradingRepository(get().apiClient);

      try {
        const response = await tradingRepo.getPosition(accountId, symbol);
        if (response.data) {
          const positionKey = `${accountId}:${symbol}`;
          set((state) => ({
            trading: {
              ...state.trading,
              positions: {
                ...state.trading.positions,
                [positionKey]: response.data!,
              },
              _meta: {
                lastUpdated: Date.now(),
                isLoading: false,
                error: null,
              },
            },
          }));
        }
      } catch (error) {
        console.error('Failed to update position:', error);
      }
    },

    // Alert management
    createAlert: async (alert) => {
      const tradingRepo = new TradingRepository(get().apiClient);

      try {
        const response = await tradingRepo.createAlert(alert);
        const newAlert = response.data;

        set((state) => ({
          trading: {
            ...state.trading,
            alerts: {
              ...state.trading.alerts,
              [newAlert.id]: newAlert,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        console.error('Failed to create alert:', error);
        throw error;
      }
    },

    // Real-time data subscriptions
    subscribeToSymbol: (symbol) => {
      set((state) => ({
        trading: {
          ...state.trading,
          subscriptions: new Set([...state.trading.subscriptions, symbol]),
        },
      }));

      // Tell WebSocket to subscribe to this symbol
      get().subscribe(`quotes:${symbol}`);
    },

    unsubscribeFromSymbol: (symbol) => {
      set((state) => {
        const newSubscriptions = new Set(state.trading.subscriptions);
        newSubscriptions.delete(symbol);
        return {
          trading: {
            ...state.trading,
            subscriptions: newSubscriptions,
          },
        };
      });

      // Tell WebSocket to unsubscribe
      get().unsubscribe(`quotes:${symbol}`);
    },
});

// Trading-related selectors
export const tradingSelectors = {
  // Orders
  allOrders: (state: AppState) => Object.values(state.trading.orders),
  openOrders: (state: AppState) =>
    Object.values(state.trading.orders).filter(
      (order) => order.status === 'pending' || order.status === 'submitted'
    ),
  orderById: (orderId: string) => (state: AppState) => state.trading.orders[orderId],

  // Positions
  allPositions: (state: AppState) => Object.values(state.trading.positions),
  positionBySymbol: (accountId: string, symbol: string) => (state: AppState) =>
    state.trading.positions[`${accountId}:${symbol}`],

  // Alerts
  activeAlerts: (state: AppState) =>
    Object.values(state.trading.alerts).filter((alert) => alert.isActive),
  alertsBySymbol: (symbol: string) => (state: AppState) =>
    Object.values(state.trading.alerts).filter((alert) => alert.symbol === symbol),

  // Market status
  isMarketOpen: (state: AppState) => state.trading.marketStatus.isOpen,

  // Real-time data
  quoteForSymbol: (symbol: string) => (state: AppState) =>
    state.trading.realTimeData[symbol],
  isSubscribedTo: (symbol: string) => (state: AppState) =>
    state.trading.subscriptions.has(symbol),

  // Loading states
  isLoading: (state: AppState) => state.trading._meta.isLoading,
  error: (state: AppState) => state.trading._meta.error,
};

// Real-time update handler
export const handleTradingUpdate = (update: RealTimeUpdate) => {
  const { useAppStore } = require('../index');
  const store = useAppStore.getState();

  switch (update.type) {
    case 'quote':
      store.trading.subscriptions.has(update.symbol!) &&
        useAppStore.setState((state) => ({
          trading: {
            ...state.trading,
            realTimeData: {
              ...state.trading.realTimeData,
              [update.symbol!]: update.data,
            },
          },
        }));
      break;

    case 'order':
      useAppStore.setState((state) => ({
        trading: {
          ...state.trading,
          orders: {
            ...state.trading.orders,
            [update.data.id]: update.data,
          },
        },
      }));
      break;

    case 'position':
      const positionKey = `${update.data.accountId}:${update.data.symbol}`;
      useAppStore.setState((state) => ({
        trading: {
          ...state.trading,
          positions: {
            ...state.trading.positions,
            [positionKey]: update.data,
          },
        },
      }));
      break;

    case 'alert':
      if (update.data.isTriggered) {
        useAppStore.setState((state) => ({
          trading: {
            ...state.trading,
            alerts: {
              ...state.trading.alerts,
              [update.data.id]: update.data,
            },
          },
        }));

        // Show notification for triggered alert
        store.ui.addNotification({
          type: 'info',
          title: 'Alert Triggered',
          message: update.data.message || `Alert for ${update.data.symbol}`,
        });
      }
      break;
  }
};
