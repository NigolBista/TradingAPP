import { InteractionManager } from "react-native";

type Priority = "critical" | "high" | "normal" | "low";

interface RequestOptions {
  ttlMs?: number;
  priority?: Priority;
  cache?: boolean;
  dedupe?: boolean;
  deferToIdle?: boolean;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

interface QueuedTask<T> {
  key: string;
  priority: Priority;
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
};

/**
 * Centralised API engine with request deduplication, caching and
 * cooperative scheduling so expensive flows do not block UI rendering.
 */
class ApiEngine {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private queue: QueuedTask<unknown>[] = [];
  private activeCount = 0;
  private maxConcurrency = 4;

  request<T>(
    key: string,
    task: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      ttlMs = 0,
      priority = "normal",
      cache = true,
      dedupe = true,
      deferToIdle = false,
    } = options;

    if (cache && ttlMs > 0) {
      const cached = this.cache.get(key) as CacheEntry<T> | undefined;
      if (cached && cached.expiry > Date.now()) {
        return Promise.resolve(cached.data);
      }
    }

    if (dedupe) {
      const existing = this.inflight.get(key) as Promise<T> | undefined;
      if (existing) {
        return existing;
      }
    }

    const run = async () => {
      const execute = async () => {
        const result = await task();
        if (cache && ttlMs > 0) {
          this.cache.set(key, { data: result, expiry: Date.now() + ttlMs });
        }
        return result;
      };

      if (deferToIdle) {
        return new Promise<T>((resolve, reject) => {
          InteractionManager.runAfterInteractions(() => {
            execute().then(resolve).catch(reject);
          });
        });
      }

      return execute();
    };

    const promise = new Promise<T>((resolve, reject) => {
      const queued: QueuedTask<T> = {
        key,
        priority,
        run,
        resolve,
        reject,
      };
      this.queue.push(queued as QueuedTask<unknown>);
      this.queue.sort(
        (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
      );
      this.drainQueue();
    });

    this.inflight.set(key, promise);

    promise
      .then(() => {
        this.inflight.delete(key);
      })
      .catch(() => {
        this.inflight.delete(key);
      });

    return promise;
  }

  prefetch<T>(
    key: string,
    task: () => Promise<T>,
    options: RequestOptions = {}
  ): void {
    this.request(key, task, { ...options, dedupe: true }).catch((error) => {
      console.warn("⚠️ Prefetch task failed", key, error);
    });
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
      return;
    }
    this.cache.clear();
  }

  setConcurrency(max: number): void {
    this.maxConcurrency = Math.max(1, Math.floor(max));
    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.activeCount += 1;

      task
        .run()
        .then((result) => {
          (task.resolve as (value: unknown) => void)(result);
        })
        .catch((error) => {
          task.reject(error);
        })
        .finally(() => {
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.drainQueue();
        });
    }
  }
}

export const apiEngine = new ApiEngine();
export default apiEngine;
