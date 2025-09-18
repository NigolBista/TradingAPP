import { StateCreator } from 'zustand';
import { AppState, StoreActions, UIState, AppNotification } from '../types';

// Initial UI state
const initialUIState: UIState = {
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
};

// UI slice creator
export const createUISlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  UIState & Pick<StoreActions, 'setTheme' | 'openModal' | 'closeModal' | 'addNotification' | 'removeNotification' | 'updateConnectionStatus'>
> = (set, get) => ({
  ...initialUIState,

  // UI actions
  setTheme: (theme) => {
    set((state) => ({
        ui: {
          ...state.ui,
          theme,
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));
    },

    // Modal management
    openModal: (modalId, data) => {
      set((state) => ({
        ui: {
          ...state.ui,
          modals: {
            ...state.ui.modals,
            [modalId]: {
              isOpen: true,
              data,
            },
          },
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));
    },

    closeModal: (modalId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          modals: {
            ...state.ui.modals,
            [modalId]: {
              isOpen: false,
              data: undefined,
            },
          },
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));
    },

    // Notification management
    addNotification: (notification) => {
      const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fullNotification: AppNotification = {
        id,
        timestamp: Date.now(),
        autoClose: true,
        duration: 5000, // 5 seconds default
        ...notification,
      };

      set((state) => ({
        ui: {
          ...state.ui,
          notifications: [...state.ui.notifications, fullNotification],
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));

      // Auto-remove notification if autoClose is enabled
      if (fullNotification.autoClose) {
        setTimeout(() => {
          get().ui.removeNotification(id);
        }, fullNotification.duration);
      }
    },

    removeNotification: (notificationId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(
            (notification) => notification.id !== notificationId
          ),
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));
    },

    // Connection status management
    updateConnectionStatus: (service, status) => {
      set((state) => ({
        ui: {
          ...state.ui,
          connectionStatus: {
            ...state.ui.connectionStatus,
            [service]: status,
          },
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));
    },
});

// UI-related selectors
export const uiSelectors = {
  // Theme
  theme: (state: AppState) => state.ui.theme,
  isDarkMode: (state: AppState) => {
    const theme = state.ui.theme;
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // Auto mode - check system preference
    return window?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  },

  // Active tab
  activeTab: (state: AppState) => state.ui.activeTab,

  // Modals
  isModalOpen: (modalId: string) => (state: AppState) =>
    state.ui.modals[modalId]?.isOpen ?? false,
  modalData: (modalId: string) => (state: AppState) =>
    state.ui.modals[modalId]?.data,
  openModals: (state: AppState) =>
    Object.entries(state.ui.modals)
      .filter(([_, modal]) => modal.isOpen)
      .map(([id]) => id),

  // Notifications
  notifications: (state: AppState) => state.ui.notifications,
  notificationCount: (state: AppState) => state.ui.notifications.length,
  unreadNotifications: (state: AppState) =>
    state.ui.notifications.filter((notification) => !notification.actions),

  // Connection status
  connectionStatus: (state: AppState) => state.ui.connectionStatus,
  isApiConnected: (state: AppState) => state.ui.connectionStatus.api === 'connected',
  isWebSocketConnected: (state: AppState) => state.ui.connectionStatus.websocket === 'connected',
  isFullyConnected: (state: AppState) =>
    state.ui.connectionStatus.api === 'connected' &&
    state.ui.connectionStatus.websocket === 'connected',

  // Loading states
  isLoading: (state: AppState) => state.ui._meta.isLoading,
  error: (state: AppState) => state.ui._meta.error,
};

// UI helper functions
export const uiHelpers = {
  // Show success notification
  showSuccess: (message: string, title?: string) => {
    const store = require('../index').useAppStore.getState();
    store.ui.addNotification({
      type: 'success',
      title: title || 'Success',
      message,
    });
  },

  // Show error notification
  showError: (message: string, title?: string) => {
    const store = require('../index').useAppStore.getState();
    store.ui.addNotification({
      type: 'error',
      title: title || 'Error',
      message,
      autoClose: false, // Errors should be manually dismissed
    });
  },

  // Show warning notification
  showWarning: (message: string, title?: string) => {
    const store = require('../index').useAppStore.getState();
    store.ui.addNotification({
      type: 'warning',
      title: title || 'Warning',
      message,
      duration: 8000, // Longer duration for warnings
    });
  },

  // Show info notification
  showInfo: (message: string, title?: string) => {
    const store = require('../index').useAppStore.getState();
    store.ui.addNotification({
      type: 'info',
      title: title || 'Info',
      message,
    });
  },

  // Clear all notifications
  clearAllNotifications: () => {
    const store = require('../index').useAppStore.getState();
    const notificationIds = store.ui.notifications.map(n => n.id);
    notificationIds.forEach(id => store.ui.removeNotification(id));
  },
};