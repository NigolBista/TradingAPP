import { type SimpleQuote } from "./quotes";
import { safeFetchBulkQuotes, safeFetchSingleQuote } from "./quoteFetcher";
import { polygonRealtime } from "./polygonRealtime";
import { apiEngine } from "./apiEngine";
import Constants from "expo-constants";

type RefreshCallback = () => void;
class RealtimeDataManager {
  private watchlistInterval: NodeJS.Timeout | null = null;
  private stockDetailInterval: NodeJS.Timeout | null = null;
  private currentWatchlist: string[] = [];
  private currentStock: string | null = null;
  private currentTimeframe: string = "1D";
  private refreshCallbacks: RefreshCallback[] = [];
  private polygonEnabled: boolean = false;
  private onPriceUnsubscribe: (() => void) | null = null;
  private lastPrices: Record<string, number> = {};
  private priceDirty: boolean = false;
  private watchlistRealtimeActive: boolean = false;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private fallbackActive = false;
  private fallbackInFlight = false;
  private fallbackSymbols: string[] = [];
  private fallbackChunkSize = 40;

  private normalizeSymbols(symbols: string[]): string[] {
    if (!Array.isArray(symbols)) return [];
    return Array.from(
      new Set(
        symbols
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim().toUpperCase())
      )
    );
  }

  private async fetchQuotesBurst(
    symbols: string[],
    priority: "critical" | "high" | "normal" | "low" = "high"
  ): Promise<Record<string, SimpleQuote>> {
    const normalized = this.normalizeSymbols(symbols);
    if (normalized.length === 0) return {};

    const MAX_PER_REQUEST = 50;
    const chunkSize =
      normalized.length <= MAX_PER_REQUEST
        ? normalized.length
        : Math.min(this.fallbackChunkSize, MAX_PER_REQUEST);

    const tasks: Promise<Record<string, SimpleQuote>>[] = [];

    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const key = `watchlist-burst:${chunk[0]}:${chunk.length}:${i}`;
      tasks.push(
        apiEngine
          .request(key, () => safeFetchBulkQuotes(chunk), {
            priority,
            cache: false,
            dedupe: false,
          })
          .catch((error) => {
            console.warn("⚠️ Bulk quote fetch failed", chunk, error);
            return {};
          })
      );
    }

    const results = await Promise.all(tasks);
    return results.reduce(
      (acc, cur) => Object.assign(acc, cur),
      {} as Record<string, SimpleQuote>
    );
  }

  private configureFallbackChunks(symbols: string[]): void {
    const normalized = this.normalizeSymbols(symbols);
    this.fallbackSymbols = normalized;

    if (normalized.length > 150) {
      this.fallbackChunkSize = 60;
    } else if (normalized.length > 80) {
      this.fallbackChunkSize = 50;
    } else if (normalized.length > 40) {
      this.fallbackChunkSize = 40;
    } else if (normalized.length > 0) {
      this.fallbackChunkSize = Math.max(10, normalized.length);
    } else {
      this.fallbackChunkSize = 40;
    }
  }

  // Pre-cache all watchlist data on app initialization
  async preloadWatchlistData(watchlist: string[]): Promise<void> {
    const normalizedWatchlist = this.normalizeSymbols(watchlist);
    console.log(
      "🚀 Pre-loading watchlist data for",
      normalizedWatchlist.length,
      "stocks"
    );
    this.currentWatchlist = normalizedWatchlist;
    this.polygonEnabled = Boolean(
      (Constants.expoConfig?.extra as any)?.polygonApiKey
    );

    try {
      // Load quotes for all watchlist stocks
      await this.loadWatchlistQuotes(normalizedWatchlist);

      // Live subscribe if polygon is configured - handled by chart components now

      // Load chart data for all watchlist stocks (parallel)
      await this.loadWatchlistCharts(normalizedWatchlist);

      console.log("✅ Watchlist data pre-loaded successfully");
    } catch (error) {
      console.error("❌ Failed to pre-load watchlist data:", error);
    }
  }

  // Load quotes for all watchlist stocks with rate limiting
  private async loadWatchlistQuotes(symbols: string[]): Promise<void> {
    try {
      const normalized = this.normalizeSymbols(symbols);
      if (normalized.length === 0) return;

      console.log("📊 Loading quotes for", normalized.length, "stocks");

      const quotes = await this.fetchQuotesBurst(normalized, "high");
      let updated = 0;
      normalized.forEach((sym) => {
        const price = quotes?.[sym]?.last;
        if (typeof price === "number" && isFinite(price) && price > 0) {
          this.lastPrices[sym] = price;
          updated += 1;
        }
      });

      if (updated > 0) {
        this.priceDirty = true;
      }

      console.log("✅ Watchlist quotes loading completed", {
        updated,
        requested: normalized.length,
      });
    } catch (error) {
      console.error("❌ Failed to load watchlist quotes:", error);
    }
  }

  // Charts are rendered directly by KLine Pro via Polygon; no chart preloading needed
  private async loadWatchlistCharts(_symbols: string[]): Promise<void> {
    return;
  }

  // Start watchlist refresh - prefers Polygon websocket if available
  startWatchlistRefresh(watchlist: string[], callback?: RefreshCallback): void {
    const normalized = this.normalizeSymbols(watchlist);
    this.polygonEnabled = Boolean(
      (Constants.expoConfig?.extra as any)?.polygonApiKey
    );

    this.currentWatchlist = normalized;
    this.watchlistRealtimeActive = false;
    this.configureFallbackChunks(normalized);

    this.refreshCallbacks = callback ? [callback] : [];

    if (normalized.length > 0) {
      this.fetchQuotesBurst(normalized, "high")
        .then((quotes) => {
          let updated = false;
          normalized.forEach((symbol) => {
            const price = quotes?.[symbol]?.last;
            if (typeof price === "number" && isFinite(price) && price > 0) {
              this.lastPrices[symbol] = price;
              updated = true;
            }
          });
          if (updated) {
            this.priceDirty = true;
            this.emitRefresh(true);
          }
        })
        .catch((error) => {
          console.warn("⚠️ Initial watchlist snapshot failed", error);
        });
    } else {
      this.lastPrices = {};
    }

    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
      this.watchlistInterval = null;
    }
    this.stopFallbackPolling();

    if (this.polygonEnabled && normalized.length > 0) {
      console.log("📡 Subscribing to Polygon websocket for watchlist symbols");

      try {
        polygonRealtime.clearAll();
      } catch {}

      Promise.all([
        polygonRealtime.subscribeTrades(normalized).catch((e) => {
          console.warn("⚠️ Failed to subscribe trades", e);
          throw e;
        }),
        polygonRealtime.subscribeAggSec(normalized).catch((e) => {
          console.warn("⚠️ Failed to subscribe second aggs", e);
          throw e;
        }),
      ])
        .then(() => {
          if (this.onPriceUnsubscribe) {
            try {
              this.onPriceUnsubscribe();
            } catch {}
            this.onPriceUnsubscribe = null;
          }

          const watchlistSet = new Set(this.currentWatchlist);

          this.onPriceUnsubscribe = polygonRealtime.onPrice((symbol, price) => {
            if (!watchlistSet.has(symbol)) return;
            const prev = this.lastPrices[symbol];
            if (prev === undefined || Math.abs(prev - price) >= 0.0001) {
              this.lastPrices[symbol] = price;
              this.priceDirty = true;
            }
          });

          this.watchlistInterval = setInterval(() => {
            this.emitRefresh();
          }, 1000);

          this.watchlistRealtimeActive = true;
        })
        .catch((error) => {
          console.warn("⚠️ Polygon websocket unavailable, falling back", error);
          this.watchlistRealtimeActive = false;
          this.startFallbackPolling(normalized);
        });
      return;
    }

    this.startFallbackPolling(normalized);
  }

  // Stop watchlist refresh
  stopWatchlistRefresh(): void {
    console.log("⏹️ Stopping watchlist refresh");
    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
      this.watchlistInterval = null;
    }
    this.stopFallbackPolling();
    if (this.onPriceUnsubscribe) {
      try {
        this.onPriceUnsubscribe();
      } catch {}
      this.onPriceUnsubscribe = null;
    }
    // Clear websocket subscriptions
    try {
      polygonRealtime.clearAll();
    } catch {}
    this.lastPrices = {};
    this.priceDirty = false;
    this.watchlistRealtimeActive = false;
    this.refreshCallbacks = [];
    // Realtime subscriptions now handled by chart components
  }

  private startFallbackPolling(symbols: string[]): void {
    const normalized = this.normalizeSymbols(symbols);
    this.stopFallbackPolling();
    if (normalized.length === 0) return;

    this.configureFallbackChunks(normalized);
    this.fallbackActive = true;
    this.fallbackInFlight = false;

    const execute = (force: boolean) => {
      void this.pollWatchlistQuotes(force);
    };

    execute(true);
    this.fallbackInterval = setInterval(() => execute(false), 1000);
  }

  private stopFallbackPolling(): void {
    this.fallbackActive = false;
    this.fallbackInFlight = false;
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  private async pollWatchlistQuotes(force = false): Promise<void> {
    if (!this.fallbackActive || this.fallbackInFlight) {
      return;
    }

    const symbols = this.fallbackSymbols;
    if (!symbols || symbols.length === 0) return;

    this.fallbackInFlight = true;
    try {
      const quotes = await this.fetchQuotesBurst(symbols, "high");
      let updated = false;
      symbols.forEach((symbol) => {
        const q = quotes?.[symbol];
        const price = typeof q?.last === "number" ? q.last : undefined;
        if (typeof price === "number" && isFinite(price) && price > 0) {
          const prev = this.lastPrices[symbol];
          if (prev === undefined || Math.abs(prev - price) >= 0.0001) {
            this.lastPrices[symbol] = price;
            updated = true;
          }
        }
      });

      if (updated || force) {
        this.priceDirty = true;
        this.emitRefresh(true);
      }
    } catch (error) {
      console.warn("⚠️ Watchlist polling failed", error);
    } finally {
      this.fallbackInFlight = false;
    }
  }

  private emitRefresh(force = false): void {
    if (!force && !this.priceDirty) return;
    this.priceDirty = false;
    this.refreshCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (error) {
        console.error("❌ Refresh callback error:", error);
      }
    });
  }

  // Expose last known prices for current watchlist (shallow copy)
  getLastPrices(): Record<string, number> {
    return { ...this.lastPrices };
  }

  isWatchlistRealtimeActive(): boolean {
    return this.watchlistRealtimeActive;
  }

  // Start 5-second stock detail refresh
  startStockDetailRefresh(
    symbol: string,
    timeframe: string,
    callback?: RefreshCallback
  ): void {
    console.log(
      "🔄 Starting stock detail refresh every 5 seconds for",
      symbol,
      timeframe
    );
    this.currentStock = symbol;
    this.currentTimeframe = timeframe;
    this.polygonEnabled = Boolean(
      (Constants.expoConfig?.extra as any)?.polygonApiKey
    );

    if (callback) {
      this.refreshCallbacks.push(callback);
    }

    // Clear any existing interval
    if (this.stockDetailInterval) {
      clearInterval(this.stockDetailInterval);
    }

    // Live subscribe for the focused symbol - handled by chart components now

    // Start new interval (quotes-only; charts handled by KLine Pro)
    this.stockDetailInterval = setInterval(async () => {
      try {
        if (!this.currentStock) return;
        await safeFetchSingleQuote(this.currentStock);
        this.refreshCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (error) {
            console.error("❌ Refresh callback error:", error);
          }
        });
      } catch (error) {
        console.error("❌ Stock detail refresh failed:", error);
      }
    }, 5000);
  }

  // Stop stock detail refresh
  stopStockDetailRefresh(): void {
    console.log("⏹️ Stopping stock detail refresh");
    if (this.stockDetailInterval) {
      clearInterval(this.stockDetailInterval);
      this.stockDetailInterval = null;
    }
    this.refreshCallbacks = [];
    // Realtime subscriptions now handled by chart components
  }

  // Update current timeframe for stock detail refresh
  updateTimeframe(timeframe: string): void {
    this.currentTimeframe = timeframe;
    console.log("📊 Updated timeframe to", timeframe);
  }

  // Add refresh callback
  addRefreshCallback(callback: RefreshCallback): void {
    this.refreshCallbacks.push(callback);
  }

  // Remove refresh callback
  removeRefreshCallback(callback: RefreshCallback): void {
    this.refreshCallbacks = this.refreshCallbacks.filter(
      (cb) => cb !== callback
    );
  }

  // Cleanup all intervals
  cleanup(): void {
    this.stopWatchlistRefresh();
    this.stopStockDetailRefresh();
    console.log("🧹 RealtimeDataManager cleaned up");
  }
}

// Export singleton instance
export const realtimeDataManager = new RealtimeDataManager();
export default realtimeDataManager;
