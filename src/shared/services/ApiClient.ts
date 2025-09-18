// @ts-nocheck
import { ApiClient, RequestConfig } from './repositories/BaseRepository';

// HTTP client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  defaultHeaders: Record<string, string>;
  retryCount: number;
  retryDelay: number;
  apiKey?: string;
  authToken?: string;
}

// Request/Response interceptors
export interface RequestInterceptor {
  (config: RequestConfig & { url: string; method: string; data?: any }): Promise<RequestConfig & { url: string; method: string; data?: any }>;
}

export interface ResponseInterceptor {
  (response: any): Promise<any>;
}

export interface ErrorInterceptor {
  (error: ApiError): Promise<never>;
}

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public response?: any,
    public request?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// HTTP client implementation
export class HttpApiClient implements ApiClient {
  private config: ApiClientConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.EXPO_PUBLIC_API_URL || 'https://api.tradingapp.com',
      timeout: config.timeout || 30000,
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.defaultHeaders,
      },
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      apiKey: config.apiKey || process.env.EXPO_PUBLIC_API_KEY,
      authToken: config.authToken,
    };

    // Set up default interceptors
    this.setupDefaultInterceptors();
  }

  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    config: RequestConfig = {}
  ): Promise<T> {
    const fullUrl = this.buildUrl(url);

    let requestConfig = {
      url: fullUrl,
      method: method.toLowerCase(),
      data,
      ...config,
      headers: {
        ...this.config.defaultHeaders,
        ...this.getAuthHeaders(),
        ...config.headers,
      },
      timeout: config.timeout || this.config.timeout,
    };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      requestConfig = await interceptor(requestConfig);
    }

    // Implement retry logic
    const maxRetries = config.retries || this.config.retryCount;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(requestConfig);

        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse);
        }

        return processedResponse;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          break;
        }

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }

    // Apply error interceptors
    for (const interceptor of this.errorInterceptors) {
      await interceptor(lastError as ApiError);
    }

    throw lastError;
  }

  // HTTP method implementations
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>('POST', url, data, config);
  }

  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>('PUT', url, data, config);
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  // Execute the actual HTTP request using fetch
  private async executeRequest(config: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const fetchConfig: RequestInit = {
        method: config.method,
        headers: config.headers,
        signal: controller.signal,
      };

      // Add body for POST/PUT requests
      if (config.data && (config.method === 'post' || config.method === 'put')) {
        if (config.headers['Content-Type'] === 'application/json') {
          fetchConfig.body = JSON.stringify(config.data);
        } else {
          fetchConfig.body = config.data;
        }
      }

      const response = await fetch(config.url, fetchConfig);

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new ApiError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.code || 'HTTP_ERROR',
          errorData,
          config
        );
      }

      // Handle different content types
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        return await response.json();
      } else if (contentType?.includes('text/')) {
        return await response.text();
      } else {
        return await response.blob();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(
            'Request timeout',
            0,
            'TIMEOUT_ERROR',
            undefined,
            config
          );
        }

        throw new ApiError(
          error.message,
          0,
          'NETWORK_ERROR',
          undefined,
          config
        );
      }

      throw error;
    }
  }

  // Configuration and utility methods
  updateConfig(updates: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  setAuthToken(token: string): void {
    this.config.authToken = token;
  }

  clearAuthToken(): void {
    this.config.authToken = undefined;
  }

  // Interceptor management
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  removeRequestInterceptor(interceptor: RequestInterceptor): void {
    const index = this.requestInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.requestInterceptors.splice(index, 1);
    }
  }

  removeResponseInterceptor(interceptor: ResponseInterceptor): void {
    const index = this.responseInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.responseInterceptors.splice(index, 1);
    }
  }

  removeErrorInterceptor(interceptor: ErrorInterceptor): void {
    const index = this.errorInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.errorInterceptors.splice(index, 1);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods
  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    return `${this.config.baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    return headers;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupDefaultInterceptors(): void {
    // Request interceptor for logging
    this.addRequestInterceptor(async (config) => {
      if (__DEV__) {
        console.log(`🚀 ${config.method.toUpperCase()} ${config.url}`);
        if (config.data) {
          console.log('📤 Request data:', config.data);
        }
      }
      return config;
    });

    // Response interceptor for logging
    this.addResponseInterceptor(async (response) => {
      if (__DEV__) {
        console.log('📥 Response:', response);
      }
      return response;
    });

    // Error interceptor for logging
    this.addErrorInterceptor(async (error) => {
      console.error('❌ API Error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        url: error.request?.url,
      });
      throw error;
    });

    // Request interceptor for adding request ID
    this.addRequestInterceptor(async (config) => {
      config.headers = {
        ...config.headers,
        'X-Request-ID': this.generateRequestId(),
      };
      return config;
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function for creating API client instances
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  return new HttpApiClient(config);
}

// Singleton instance for the app
export const apiClient = createApiClient();

// Export types for use in other modules
export type { ApiClientConfig, RequestInterceptor, ResponseInterceptor, ErrorInterceptor };
