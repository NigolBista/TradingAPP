import { StateCreator } from 'zustand';
import { AppState, AuthState, StoreActions } from '../types';
import { UserRepository, LoginCredentials } from '../../services/repositories';

// Initial auth state
const initialAuthState: AuthState = {
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
};

// Auth slice creator
export const createAuthSlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  AuthState & { auth: StoreActions['auth'] }
> = (set, get) => ({
  ...initialAuthState,

  auth: {
    // Login action
    login: async (credentials: LoginCredentials) => {
      const userRepo = new UserRepository(get().apiClient);

      set((state) => ({
        auth: {
          ...state.auth,
          _meta: { ...state.auth._meta, isLoading: true, error: null },
        },
      }));

      try {
        const response = await userRepo.login(credentials);
        const { user, session } = response.data;

        // Get user profile
        const profileResponse = await userRepo.getUserProfile();
        const profile = profileResponse.data;

        // Update API client with auth token
        get().apiClient.setAuthToken(session.accessToken);

        set((state) => ({
          auth: {
            ...state.auth,
            user,
            profile,
            session,
            isAuthenticated: true,
            preferences: {
              notifications: profile.notificationPreferences,
              trading: profile.tradingPreferences,
              privacy: profile.privacySettings,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        // Store session in secure storage
        await get().secureStorage.setItem('auth_session', JSON.stringify(session));

        // Connect WebSocket after successful login
        get().websocket.connect();

        // Hydrate other stores
        await Promise.all([
          get().portfolio.refreshSummary(),
          get().market.refreshMarketSummary(),
        ]);
      } catch (error) {
        set((state) => ({
          auth: {
            ...state.auth,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: error.message,
            },
          },
        }));
        throw error;
      }
    },

    // Logout action
    logout: async () => {
      const userRepo = new UserRepository(get().apiClient);

      try {
        await userRepo.logout();
      } catch (error) {
        console.warn('Logout API call failed:', error);
      }

      // Clear auth state
      set((state) => ({
        auth: {
          ...initialAuthState,
          _meta: {
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
        },
      }));

      // Clear API client auth
      get().apiClient.clearAuthToken();

      // Clear secure storage
      await get().secureStorage.removeItem('auth_session');

      // Disconnect WebSocket
      get().websocket.disconnect();

      // Clear other stores
      get().reset();
    },

    // Update profile action
    updateProfile: async (updates) => {
      const userRepo = new UserRepository(get().apiClient);

      set((state) => ({
        auth: {
          ...state.auth,
          _meta: { ...state.auth._meta, isLoading: true, error: null },
        },
      }));

      try {
        const response = await userRepo.updateUserProfile(updates);
        const profile = response.data;

        set((state) => ({
          auth: {
            ...state.auth,
            profile,
            preferences: {
              notifications: profile.notificationPreferences,
              trading: profile.tradingPreferences,
              privacy: profile.privacySettings,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        set((state) => ({
          auth: {
            ...state.auth,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: error.message,
            },
          },
        }));
        throw error;
      }
    },

    // Refresh token action
    refreshToken: async () => {
      const userRepo = new UserRepository(get().apiClient);
      const currentSession = get().auth.session;

      if (!currentSession?.refreshToken) {
        throw new Error('No refresh token available');
      }

      try {
        const response = await userRepo.refreshToken(currentSession.refreshToken);
        const session = response.data;

        // Update API client with new token
        get().apiClient.setAuthToken(session.accessToken);

        set((state) => ({
          auth: {
            ...state.auth,
            session,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        // Store new session
        await get().secureStorage.setItem('auth_session', JSON.stringify(session));
      } catch (error) {
        // Refresh failed, logout user
        await get().auth.logout();
        throw error;
      }
    },
  },
});

// Auth-related selectors
export const authSelectors = {
  // Basic selectors
  isAuthenticated: (state: AppState) => state.auth.isAuthenticated,
  user: (state: AppState) => state.auth.user,
  profile: (state: AppState) => state.auth.profile,
  session: (state: AppState) => state.auth.session,

  // Loading states
  isLoading: (state: AppState) => state.auth._meta.isLoading,
  error: (state: AppState) => state.auth._meta.error,

  // Preferences
  tradingPreferences: (state: AppState) => state.auth.preferences.trading,
  notificationPreferences: (state: AppState) => state.auth.preferences.notifications,
  privacySettings: (state: AppState) => state.auth.preferences.privacy,

  // Permissions
  hasPermission: (permission: string) => (state: AppState) =>
    state.auth.permissions.includes(permission),

  // Session status
  isSessionValid: (state: AppState) => {
    const session = state.auth.session;
    if (!session) return false;
    return Date.now() < session.expiresAt;
  },

  // User display info
  displayName: (state: AppState) => {
    const user = state.auth.user;
    const profile = state.auth.profile;

    if (profile?.displayName) return profile.displayName;
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.username) return user.username;
    return user?.email || 'Unknown User';
  },
};

// Auth-related hooks helpers
export const useAuthHelpers = () => {
  const state = get();

  return {
    // Check if token needs refresh
    needsTokenRefresh: () => {
      const session = state.auth.session;
      if (!session) return false;

      // Refresh if token expires in less than 5 minutes
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() + fiveMinutes > session.expiresAt;
    },

    // Auto-refresh token
    autoRefreshToken: async () => {
      if (state.auth.isAuthenticated && useAuthHelpers().needsTokenRefresh()) {
        try {
          await state.auth.refreshToken();
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }
    },

    // Restore session from storage
    restoreSession: async () => {
      try {
        const sessionData = await state.secureStorage.getItem('auth_session');
        if (!sessionData) return false;

        const session = JSON.parse(sessionData);

        // Check if session is still valid
        if (Date.now() >= session.expiresAt) {
          await state.secureStorage.removeItem('auth_session');
          return false;
        }

        // Set auth token and get user data
        state.apiClient.setAuthToken(session.accessToken);

        const userRepo = new UserRepository(state.apiClient);
        const [userResponse, profileResponse] = await Promise.all([
          userRepo.getCurrentUser(),
          userRepo.getUserProfile(),
        ]);

        set((prevState) => ({
          auth: {
            ...prevState.auth,
            user: userResponse.data,
            profile: profileResponse.data,
            session,
            isAuthenticated: true,
            preferences: {
              notifications: profileResponse.data.notificationPreferences,
              trading: profileResponse.data.tradingPreferences,
              privacy: profileResponse.data.privacySettings,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        return true;
      } catch (error) {
        console.error('Session restoration failed:', error);
        await state.secureStorage.removeItem('auth_session');
        return false;
      }
    },
  };
};