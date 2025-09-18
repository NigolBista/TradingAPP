/**
 * Request Deduplication Utility
 * Prevents duplicate API calls by caching in-flight requests
 */

interface RequestOptions {
  signal?: AbortSignal;
  [key: string]: any;
}

type RequestFunction<T> = (signal?: AbortSignal) => Promise<T>;

class RequestDeduplicator {
  private inflightRequests = new Map<string, Promise<any>>();
  private requestTimeouts = new Map<string, NodeJS.Timeout>();
  private requestControllers = new Map<string, AbortController>();

  /**
   * Deduplicate requests by key
   * If a request with the same key is already in flight, return the existing promise
   */
  async deduplicate<T>(
    key: string,
    requestFn: RequestFunction<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    // Check if request is already in flight
    if (this.inflightRequests.has(key)) {
      const existingRequest = this.inflightRequests.get(key);
      return existingRequest as Promise<T>;
    }

    // Create AbortController for this request
    const controller = new AbortController();
    this.requestControllers.set(key, controller);

    // Create new request with the controller's signal
    const requestOptions = { ...options, signal: controller.signal };
    const request = this.createRequest(key, requestFn, requestOptions);
    this.inflightRequests.set(key, request);

    // Set timeout to clean up completed requests
    const timeout = setTimeout(() => {
      // Defensive cleanup - only delete if entries still exist
      if (this.inflightRequests.has(key)) {
        this.inflightRequests.delete(key);
      }
      if (this.requestTimeouts.has(key)) {
        this.requestTimeouts.delete(key);
      }
      if (this.requestControllers.has(key)) {
        this.requestControllers.delete(key);
      }
    }, 5000); // Clean up after 5 seconds

    this.requestTimeouts.set(key, timeout);

    try {
      const result = await request;
      return result;
    } catch (error) {
      // Error cleanup is handled inside createRequest
      throw error;
    }
  }

  private async createRequest<T>(
    key: string,
    requestFn: RequestFunction<T>,
    options: RequestOptions
  ): Promise<T> {
    const { signal } = options;

    // Handle request cancellation
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      const result = await requestFn(signal);

      // Note: Successful completion cleanup is handled by the timeout
      // in deduplicate() method to avoid race conditions

      return result;
    } catch (error) {
      // Clean up failed request immediately in createRequest
      if (this.inflightRequests.has(key)) {
        this.inflightRequests.delete(key);
      }
      const timeout = this.requestTimeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.requestTimeouts.delete(key);
      }
      if (this.requestControllers.has(key)) {
        this.requestControllers.delete(key);
      }
      throw error;
    }
  }

  /**
   * Cancel all in-flight requests for a specific prefix
   * This will abort the actual requests and clean up tracking
   */
  cancelRequestsWithPrefix(prefix: string) {
    for (const [key] of this.inflightRequests) {
      if (key.startsWith(prefix)) {
        // Abort the actual request first
        const controller = this.requestControllers.get(key);
        if (controller) {
          controller.abort();
          this.requestControllers.delete(key);
        }

        // Clean up tracking
        this.inflightRequests.delete(key);
        const timeout = this.requestTimeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.requestTimeouts.delete(key);
        }
      }
    }
  }

  /**
   * Get current in-flight request count
   */
  getInflightCount(): number {
    return this.inflightRequests.size;
  }

  /**
   * Clear all in-flight requests
   */
  clear() {
    // Abort all in-flight requests
    this.requestControllers.forEach(controller => controller.abort());
    this.requestControllers.clear();

    // Clear tracking
    this.inflightRequests.clear();
    this.requestTimeouts.forEach(timeout => clearTimeout(timeout));
    this.requestTimeouts.clear();
  }
}

// Global instance for the entire app
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Helper function to create a request key
 */
export function createRequestKey(
  operation: string,
  symbol: string,
  params?: Record<string, any>
): string {
  const baseKey = `${operation}:${symbol}`;

  if (!params) {
    return baseKey;
  }

  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${baseKey}:${paramString}`;
}

/**
 * Decorator for automatic request deduplication
 */
export function deduplicated(operation: string) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      // Extract symbol and options from arguments
      const [symbol, ...otherArgs] = args;

      const key = createRequestKey(
        operation,
        String(symbol),
        otherArgs.length > 0 ? { args: otherArgs } : undefined
      );

      return requestDeduplicator.deduplicate(
        key,
        (signal) => {
          // Create new arguments array for method call
          const newArgs = [...args];
          const lastIndex = newArgs.length - 1;
          const lastArg = newArgs[lastIndex];

          // Check if last argument is an options object
          const isOptionsObject = lastArg !== null &&
                                  typeof lastArg === 'object' &&
                                  !Array.isArray(lastArg);

          if (isOptionsObject) {
            // Merge signal into existing options
            newArgs[lastIndex] = { ...lastArg, signal };
          } else {
            // Add new options object with signal
            newArgs.push({ signal } as any);
          }

          return method.apply(this, newArgs as T);
        }
      );
    };

    return descriptor;
  };
}