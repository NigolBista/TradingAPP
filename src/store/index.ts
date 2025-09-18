// Unified app store using Zustand with slices pattern
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { AppState, StoreConfig } from './types';
import type { StoreActions } from './types';
import { createAuthSlice } from './slices/authSlice';
import { createTradingSlice } from './slices/tradingSlice';
import { createPortfolioSlice } from './slices/portfolioSlice';
import { createMarketSlice } from './slices/marketSlice';
import { createUISlice } from './slices/uiSlice';
import { createWebSocketSlice } from './slices/websocketSlice';

// Store configuration
const storeConfig: StoreConfig = {
  persist: {
    name: 'trading-app-store',
    partialize: (state) => ({
      auth: {
        preferences: state.auth.preferences,
        // Don't persist sensitive data like tokens
      },
      ui: {
        theme: state.ui.theme,
        // Persist UI preferences
      },
    }),
    version: 1,
  },
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
    name: 'TradingApp Store',
  },
  middleware: {
    websocket: true,
    persistence: true,
    devtools: true,
  },
};

// Initial state (defined before store creation)
const initialState: AppState = {
  auth: {
    user: null,
    profile: null,
    session: null,
    isAuthenticated: false,
    permissions: [],
    preferences: {
      notifications: {
        email: {
          marketAlerts: true,
          portfolioUpdates: true,
          newsDigest: false,
          productUpdates: false,
          securityAlerts: true,
        },
        push: {
          priceAlerts: true,
          portfolioChanges: true,
          marketNews: false,
          tradingSignals: true,
        },
        inApp: {
          realTimeQuotes: true,
          chartAnnotations: true,
          socialFeatures: false,
        },
      },
      trading: {
        defaultTimeframe: '1D',
        chartStyle: 'candle',
        indicators: ['SMA_20', 'RSI'],
        riskLevel: 'moderate',
        autoRefresh: true,
        soundAlerts: false,
        paperTrading: false,
      },
      privacy: {
        profileVisibility: 'private',
        portfolioVisibility: 'private',
        tradingActivityVisible: false,
        analyticsOptIn: true,
        marketingOptIn: false,
      },
    },
    _meta: {
      lastUpdated: 0,
      isLoading: false,
      error: null,
    },
  },
  trading: {
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
  },
  portfolio: {
    accounts: {},
    positions: {},
    summary: null,
    history: {},
    transactions: {},
    performance: {},
    _meta: {
      lastUpdated: 0,
      isLoading: false,
      error: null,
    },
  },
  market: {
    quotes: {},
    charts: {},
    news: {
      global: [],
      bySymbol: {},
    },
    marketSummary: null,
    watchlists: {},
    searchResults: {},
    trends: {
      gainers: [],
      losers: [],
      mostActive: [],
    },
    _meta: {
      lastUpdated: 0,
      isLoading: false,
      error: null,
    },
  },
  ui: {
    theme: 'auto',
    activeTab: 'Dashboard',
    modals: {},
    notifications: [],
    connectionStatus: {
      api: 'disconnected',
      websocket: 'disconnected',
    },
    _meta: {
      lastUpdated: 0,
      isLoading: false,
      error: null,
    },
  },
  websocket: {
    isConnected: false,
    isConnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
    subscriptions: [],
  },
  apiClient: null as any,
  secureStorage: null as any,
};

// Create the unified store
export const useAppStore = create<AppState & StoreActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initialize with default state
        ...initialState,

        // Combine all slice actions
        ...createAuthSlice(set, get),
        ...createTradingSlice(set, get),
        ...createPortfolioSlice(set, get),
        ...createMarketSlice(set, get),
        ...createUISlice(set, get),
        ...createWebSocketSlice(set, get),

        // Global store actions
        hydrate: async () => {
          try {
            set((state) => ({
              ui: {
                ...state.ui,
                _meta: { ...state.ui._meta, isLoading: true, error: null },
              },
            }));

            // Initialize WebSocket if authenticated
            if (get().auth.isAuthenticated) {
              get().connect();
            }

            // Load initial market data
            await get().refreshMarketSummary();

            set((state) => ({
              ui: {
                ...state.ui,
                _meta: { ...state.ui._meta, isLoading: false, error: null },
              },
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Store hydration failed';
            console.error('Store hydration failed:', error);

            set((state) => ({
              ui: {
                ...state.ui,
                _meta: { ...state.ui._meta, isLoading: false, error: errorMessage },
              },
            }));

            // Show error notification
            get().addNotification({
              type: 'error',
              title: 'Initialization Failed',
              message: 'Failed to load application data. Please refresh the page.',
              autoClose: false,
            });
          }
        },

        reset: () => {
          // Reset all slices to initial state
          set(() => ({
            ...initialState,
          }));
        },

        // Shared services (will be injected)
        apiClient: null as any,
        secureStorage: null as any,
      }))
    ),
    {
      enabled: storeConfig.devtools.enabled,
      name: storeConfig.devtools.name,
    }
  )
);

// Selector hooks for optimized subscriptions
export const useAuth = () => useAppStore((state) => state.auth);
export const useTrading = () => useAppStore((state) => state.trading);
export const usePortfolio = () => useAppStore((state) => state.portfolio);
export const useMarket = () => useAppStore((state) => state.market);
export const useUI = () => useAppStore((state) => state.ui);
export const useWebSocket = () => useAppStore((state) => state.websocket);

// Action hooks with better type safety
export const useAuthActions = () => {
  const login = useAppStore((state) => state.login);
  const logout = useAppStore((state) => state.logout);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const refreshToken = useAppStore((state) => state.refreshToken);
  return { login, logout, updateProfile, refreshToken };
};

export const useTradingActions = () => {
  const submitOrder = useAppStore((state) => state.submitOrder);
  const cancelOrder = useAppStore((state) => state.cancelOrder);
  const updatePosition = useAppStore((state) => state.updatePosition);
  const createAlert = useAppStore((state) => state.createAlert);
  const subscribeToSymbol = useAppStore((state) => state.subscribeToSymbol);
  const unsubscribeFromSymbol = useAppStore((state) => state.unsubscribeFromSymbol);
  return { submitOrder, cancelOrder, updatePosition, createAlert, subscribeToSymbol, unsubscribeFromSymbol };
};

export const usePortfolioActions = () => {
  const refreshSummary = useAppStore((state) => state.refreshSummary);
  const syncAccount = useAppStore((state) => state.syncAccount);
  const updatePortfolioHistory = useAppStore((state) => state.updatePortfolioHistory);
  return { refreshSummary, syncAccount, updatePortfolioHistory };
};

export const useMarketActions = () => {
  const getQuote = useAppStore((state) => state.getQuote);
  const getChart = useAppStore((state) => state.getChart);
  const searchSymbols = useAppStore((state) => state.searchSymbols);
  const refreshMarketSummary = useAppStore((state) => state.refreshMarketSummary);
  const updateWatchlist = useAppStore((state) => state.updateWatchlist);
  return { getQuote, getChart, searchSymbols, refreshMarketSummary, updateWatchlist };
};

export const useUIActions = () => {
  const setTheme = useAppStore((state) => state.setTheme);
  const openModal = useAppStore((state) => state.openModal);
  const closeModal = useAppStore((state) => state.closeModal);
  const addNotification = useAppStore((state) => state.addNotification);
  const removeNotification = useAppStore((state) => state.removeNotification);
  const updateConnectionStatus = useAppStore((state) => state.updateConnectionStatus);
  return { setTheme, openModal, closeModal, addNotification, removeNotification, updateConnectionStatus };
};

export const useWebSocketActions = () => {
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const subscribe = useAppStore((state) => state.subscribe);
  const unsubscribe = useAppStore((state) => state.unsubscribe);
  const handleMessage = useAppStore((state) => state.handleMessage);
  return { connect, disconnect, subscribe, unsubscribe, handleMessage };
};

// Global actions
export const useStoreActions = () => useAppStore((state) => ({
  hydrate: state.hydrate,
  reset: state.reset,
}));

// Type-safe store access
export type AppStore = typeof useAppStore;
export type StoreState = ReturnType<AppStore['getState']>;
export type StoreActions = Parameters<AppStore['subscribe']>[0];

export default useAppStore;