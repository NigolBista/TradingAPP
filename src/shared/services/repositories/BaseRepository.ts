// @ts-nocheck
import { CacheManager } from "../../utils/cacheManager";

// Base interface for API clients
export interface ApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<T>;
  post<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  put<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  delete<T>(url: string, config?: RequestConfig): Promise<T>;
}

// Request configuration interface
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
}

// Base error class for repository operations
export class RepositoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

// Generic repository response wrapper
export interface RepositoryResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  cached?: boolean;
  timestamp: number;
}

// Base repository class with common functionality
export abstract class BaseRepository {
  protected cache: CacheManager;

  constructor(protected apiClient: ApiClient) {
    this.cache = new CacheManager();
  }

  // Generic fetch with caching
  protected async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300000 // 5 minutes default
  ): Promise<RepositoryResponse<T>> {
    try {
      // Try to get from cache first
      const cachedData = await this.cache.get<T>(key);
      if (cachedData) {
        return {
          data: cachedData,
          success: true,
          cached: true,
          timestamp: Date.now(),
        };
      }

      // Fetch fresh data
      const data = await fetcher();

      // Cache the result
      await this.cache.set(key, data, ttl);

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

  // Retry mechanism for failed requests
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }

    throw this.handleError(lastError!);
  }

  // Batch operations helper
  protected async batchFetch<T, K>(
    items: K[],
    fetcher: (item: K) => Promise<T>,
    batchSize: number = 10
  ): Promise<RepositoryResponse<T[]>> {
    try {
      const results: T[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(fetcher);
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.warn('Batch operation failed for item:', result.reason);
          }
        }
      }

      return {
        data: results,
        success: true,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Invalidate cache for specific patterns
  protected async invalidateCache(pattern: string): Promise<void> {
    await this.cache.invalidatePattern(pattern);
  }

  // Clear all cache
  protected async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  // Error handling
  protected handleError(error: unknown): RepositoryError {
    if (error instanceof RepositoryError) {
      return error;
    }

    if (error instanceof Error) {
      // Handle network errors
      if (error.message.includes('Network')) {
        return new RepositoryError(
          'Network connection failed',
          'NETWORK_ERROR',
          undefined,
          error
        );
      }

      // Handle timeout errors
      if (error.message.includes('timeout')) {
        return new RepositoryError(
          'Request timed out',
          'TIMEOUT_ERROR',
          undefined,
          error
        );
      }

      // Handle API errors with status codes
      const apiError = error as any;
      if (apiError.status) {
        return new RepositoryError(
          apiError.message || 'API request failed',
          'API_ERROR',
          apiError.status,
          error
        );
      }

      return new RepositoryError(
        error.message,
        'UNKNOWN_ERROR',
        undefined,
        error
      );
    }

    return new RepositoryError(
      'An unknown error occurred',
      'UNKNOWN_ERROR'
    );
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check for repository
  async healthCheck(): Promise<boolean> {
    try {
      // Implement basic health check - can be overridden by subclasses
      return true;
    } catch {
      return false;
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    size: number;
    hitRate: number;
    missRate: number;
  }> {
    return this.cache.getStats();
  }
}
