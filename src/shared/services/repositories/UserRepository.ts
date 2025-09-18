import { BaseRepository, RepositoryResponse, ApiClient } from './BaseRepository';

// User and authentication types
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  location?: string;
  timezone: string;
  language: string;
  currency: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
  notificationPreferences: NotificationPreferences;
  tradingPreferences: TradingPreferences;
  privacySettings: PrivacySettings;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  email: {
    marketAlerts: boolean;
    portfolioUpdates: boolean;
    newsDigest: boolean;
    productUpdates: boolean;
    securityAlerts: boolean;
  };
  push: {
    priceAlerts: boolean;
    portfolioChanges: boolean;
    marketNews: boolean;
    tradingSignals: boolean;
  };
  inApp: {
    realTimeQuotes: boolean;
    chartAnnotations: boolean;
    socialFeatures: boolean;
  };
}

export interface TradingPreferences {
  defaultTimeframe: string;
  chartStyle: 'candle' | 'line' | 'area';
  indicators: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  autoRefresh: boolean;
  soundAlerts: boolean;
  paperTrading: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  portfolioVisibility: 'public' | 'private' | 'friends';
  tradingActivityVisible: boolean;
  analyticsOptIn: boolean;
  marketingOptIn: boolean;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
  notes?: string;
  alertsEnabled: boolean;
  sortOrder: number;
}

export interface Watchlist {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic: boolean;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
  shareCode?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
  scope: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  agreeToTerms: boolean;
  marketingOptIn?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  newPassword: string;
}

// User repository implementation
export class UserRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<RepositoryResponse<{ user: User; session: AuthSession }>> {
    try {
      const result = await this.apiClient.post<{ user: User; session: AuthSession }>('/auth/login', credentials);

      // Cache user data
      await this.cache.set(`user:${result.user.id}`, result.user, 86400000); // 24 hours

      return {
        data: result,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(data: RegisterData): Promise<RepositoryResponse<{ user: User; session: AuthSession }>> {
    try {
      const result = await this.apiClient.post<{ user: User; session: AuthSession }>('/auth/register', data);

      // Cache user data
      await this.cache.set(`user:${result.user.id}`, result.user, 86400000); // 24 hours

      return {
        data: result,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.post('/auth/logout');

      // Clear all user-related cache
      await this.clearUserCache();

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async refreshToken(refreshToken: string): Promise<RepositoryResponse<AuthSession>> {
    try {
      const session = await this.apiClient.post<AuthSession>('/auth/refresh', { refreshToken });

      return {
        data: session,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async requestPasswordReset(request: PasswordResetRequest): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.post('/auth/password-reset/request', request);

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(reset: PasswordReset): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.post('/auth/password-reset/confirm', reset);

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // User profile methods
  async getCurrentUser(): Promise<RepositoryResponse<User>> {
    const cacheKey = 'user:current';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<User>('/user/me'),
      86400000 // 24 hours cache
    );
  }

  async getUserProfile(): Promise<RepositoryResponse<UserProfile>> {
    const cacheKey = 'user:profile';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<UserProfile>('/user/profile'),
      3600000 // 1 hour cache
    );
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<RepositoryResponse<UserProfile>> {
    try {
      const profile = await this.apiClient.put<UserProfile>('/user/profile', updates);

      // Update cache
      await this.cache.set('user:profile', profile, 3600000);

      return {
        data: profile,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(updates: Partial<User>): Promise<RepositoryResponse<User>> {
    try {
      const user = await this.apiClient.put<User>('/user/me', updates);

      // Update cache
      await this.cache.set('user:current', user, 86400000);
      await this.cache.set(`user:${user.id}`, user, 86400000);

      return {
        data: user,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.post('/user/change-password', {
        currentPassword,
        newPassword,
      });

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyEmail(token: string): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.post('/user/verify-email', { token });

      // Invalidate user cache to refresh verification status
      await this.invalidateCache('user:*');

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Watchlist management
  async getWatchlists(): Promise<RepositoryResponse<Watchlist[]>> {
    const cacheKey = 'user:watchlists';

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Watchlist[]>('/user/watchlists'),
      300000 // 5 minutes cache
    );
  }

  async getWatchlist(watchlistId: string): Promise<RepositoryResponse<Watchlist>> {
    const cacheKey = `user:watchlist:${watchlistId}`;

    return this.fetchWithCache(
      cacheKey,
      () => this.apiClient.get<Watchlist>(`/user/watchlists/${watchlistId}`),
      300000 // 5 minutes cache
    );
  }

  async createWatchlist(watchlist: Omit<Watchlist, 'id' | 'createdAt' | 'updatedAt'>): Promise<RepositoryResponse<Watchlist>> {
    try {
      const newWatchlist = await this.apiClient.post<Watchlist>('/user/watchlists', watchlist);

      // Invalidate watchlists cache
      await this.invalidateCache('user:watchlists');

      return {
        data: newWatchlist,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateWatchlist(
    watchlistId: string,
    updates: Partial<Watchlist>
  ): Promise<RepositoryResponse<Watchlist>> {
    try {
      const watchlist = await this.apiClient.put<Watchlist>(`/user/watchlists/${watchlistId}`, updates);

      // Update cache
      await this.cache.set(`user:watchlist:${watchlistId}`, watchlist, 300000);
      await this.invalidateCache('user:watchlists');

      return {
        data: watchlist,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteWatchlist(watchlistId: string): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.delete(`/user/watchlists/${watchlistId}`);

      // Invalidate cache
      await this.invalidateCache(`user:watchlist:${watchlistId}`);
      await this.invalidateCache('user:watchlists');

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addToWatchlist(
    watchlistId: string,
    item: Omit<WatchlistItem, 'addedAt' | 'sortOrder'>
  ): Promise<RepositoryResponse<Watchlist>> {
    try {
      const watchlist = await this.apiClient.post<Watchlist>(`/user/watchlists/${watchlistId}/items`, item);

      // Update cache
      await this.cache.set(`user:watchlist:${watchlistId}`, watchlist, 300000);
      await this.invalidateCache('user:watchlists');

      return {
        data: watchlist,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeFromWatchlist(watchlistId: string, symbol: string): Promise<RepositoryResponse<Watchlist>> {
    try {
      const watchlist = await this.apiClient.delete<Watchlist>(
        `/user/watchlists/${watchlistId}/items/${symbol}`
      );

      // Update cache
      await this.cache.set(`user:watchlist:${watchlistId}`, watchlist, 300000);
      await this.invalidateCache('user:watchlists');

      return {
        data: watchlist,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Preferences management
  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<RepositoryResponse<UserProfile>> {
    try {
      const profile = await this.apiClient.put<UserProfile>('/user/preferences/notifications', preferences);

      // Update cache
      await this.cache.set('user:profile', profile, 3600000);

      return {
        data: profile,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTradingPreferences(
    preferences: Partial<TradingPreferences>
  ): Promise<RepositoryResponse<UserProfile>> {
    try {
      const profile = await this.apiClient.put<UserProfile>('/user/preferences/trading', preferences);

      // Update cache
      await this.cache.set('user:profile', profile, 3600000);

      return {
        data: profile,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<RepositoryResponse<UserProfile>> {
    try {
      const profile = await this.apiClient.put<UserProfile>('/user/preferences/privacy', settings);

      // Update cache
      await this.cache.set('user:profile', profile, 3600000);

      return {
        data: profile,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Cache management
  async clearUserCache(): Promise<void> {
    await this.invalidateCache('user:*');
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidateCache(`user:${userId}`);
    await this.invalidateCache('user:current');
    await this.invalidateCache('user:profile');
    await this.invalidateCache('user:watchlists');
  }

  // Account deletion and data export
  async exportUserData(): Promise<RepositoryResponse<any>> {
    try {
      const data = await this.apiClient.get('/user/export', { timeout: 30000 });

      return {
        data,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAccount(password: string): Promise<RepositoryResponse<boolean>> {
    try {
      await this.apiClient.delete('/user/me', {
        headers: { 'X-Confirm-Password': password },
      });

      // Clear all caches
      await this.clearUserCache();

      return {
        data: true,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check for user services
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/user/health', { timeout: 5000 });
      return response === 'ok';
    } catch {
      return false;
    }
  }
}