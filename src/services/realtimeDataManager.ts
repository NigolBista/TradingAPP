import { type SimpleQuote } from "./quotes";
import { safeFetchBulkQuotes, safeFetchSingleQuote } from "./quoteFetcher";
import { polygonRealtime } from "./polygonRealtime";
import Constants from "expo-constants";

type RefreshCallback = () => void;
type StockDataCache = {
  quotes: Record<string, SimpleQuote>;
  charts: Record<string, any[]>;
};

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
  private watchlistPollingInFlight: boolean = false;

  // Pre-cache all watchlist data on app initialization
  async preloadWatchlistData(watchlist: string[]): Promise<void> {
    console.log(
      "🚀 Pre-loading watchlist data for",
      watchlist.length,
      "stocks"
    );
    this.currentWatchlist = watchlist;
    this.polygonEnabled = Boolean(
      (Constants.expoConfig?.extra as any)?.polygonApiKey
    );

    try {
      // Load quotes for all watchlist stocks
      await this.loadWatchlistQuotes(watchlist);

      // Live subscribe if polygon is configured - handled by chart components now

      // Load chart data for all watchlist stocks (parallel)
      await this.loadWatchlistCharts(watchlist);

      console.log("✅ Watchlist data pre-loaded successfully");
    } catch (error) {
      console.error("❌ Failed to pre-load watchlist data:", error);
    }
  }

  // Load quotes for all watchlist stocks with rate limiting
  private async loadWatchlistQuotes(symbols: string[]): Promise<void> {
    try {
      console.log("📊 Loading quotes for", symbols.length, "stocks");

      // Direct fetch from Polygon (no caching)
      const chunkSize = 50; // Polygon allows up to 50 symbols per request
      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);

        try {
          console.log(
            `📡 Fetching quotes chunk ${
              Math.floor(i / chunkSize) + 1
            }/${Math.ceil(symbols.length / chunkSize)}:`,
            chunk
          );
          const quotes = await safeFetchBulkQuotes(chunk);

          // Update lastPrices so UI can reflect polling results even without websocket
          if (quotes && typeof quotes === "object") {
            for (const sym of chunk) {
              const q = quotes[sym];
              const last = q?.last;
              if (typeof last === "number" && isFinite(last) && last > 0) {
                this.lastPrices[sym] = last;
                this.priceDirty = true;
              }
            }
          }

          // Rate limiting: wait between chunks to avoid overwhelming API
          if (i + chunkSize < symbols.length) {
            await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
          }
        } catch (error) {
          // console.error(
          //   "❌ Watchlist quotes fetch failed for chunk:",
          //   chunk,
          //   error
          // );
          // Continue with other chunks even if one fails
        }
      }

      console.log("✅ Watchlist quotes loading completed");
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
    this.polygonEnabled = Boolean(
      (Constants.expoConfig?.extra as any)?.polygonApiKey
    );

    this.currentWatchlist = watchlist;
    this.watchlistRealtimeActive = false;

    if (callback) {
      this.refreshCallbacks.push(callback);
    }

    // Always clear polling interval when (re)starting
    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
      this.watchlistInterval = null;
    }
    // no polling when using realtime only

    if (this.polygonEnabled && watchlist.length > 0) {
      console.log("📡 Subscribing to Polygon websocket for watchlist symbols");

      // Reset previous websocket subscriptions
      try {
        polygonRealtime.clearAll();
      } catch {}

      // Subscribe to trades and second aggregates for timely last prices
      Promise.all([
        polygonRealtime.subscribeTrades(watchlist).catch((e) => {
          console.warn("⚠️ Failed to subscribe trades", e);
          throw e;
        }),
        polygonRealtime.subscribeAggSec(watchlist).catch((e) => {
          console.warn("⚠️ Failed to subscribe second aggs", e);
          throw e;
        }),
      ])
        .then(() => {
          // Remove existing onPrice listener if any
          if (this.onPriceUnsubscribe) {
            try {
              this.onPriceUnsubscribe();
            } catch {}
            this.onPriceUnsubscribe = null;
          }

          const watchlistSet = new Set(this.currentWatchlist);
          this.lastPrices = {};
          this.priceDirty = false;

          // Listen for live prices and notify UI for symbols in the current watchlist
          this.onPriceUnsubscribe = polygonRealtime.onPrice((symbol, price) => {
            if (!watchlistSet.has(symbol)) return;
            // Only update if price changed meaningfully to avoid unnecessary re-renders
            const prev = this.lastPrices[symbol];
            if (prev === undefined || Math.abs(prev - price) >= 0.0001) {
              this.lastPrices[symbol] = price;
              this.priceDirty = true;
            }
          });

          // Throttle UI updates to once per second; only emit if we got at least one price
          this.watchlistInterval = setInterval(() => {
            if (!this.priceDirty) return;
            this.priceDirty = false;
            this.refreshCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (error) {
                console.error("❌ Refresh callback error:", error);
              }
            });
          }, 1000);

          this.watchlistRealtimeActive = true;
        })
        .catch(() => {
          // Realtime-only mode: if websocket fails, do not poll
          this.watchlistRealtimeActive = false;
        });
      return;
    }

    this.lastPrices = {};
    this.priceDirty = false;

    if (watchlist.length > 0) {
      this.watchlistPollingInFlight = false;
      this.watchlistInterval = setInterval(async () => {
        if (this.watchlistPollingInFlight) return;
        this.watchlistPollingInFlight = true;
        try {
          const symbolsSnapshot = [...this.currentWatchlist];
          if (symbolsSnapshot.length === 0) {
            this.watchlistPollingInFlight = false;
            return;
          }
          const quotes = await safeFetchBulkQuotes(symbolsSnapshot);
          let changed = false;
          for (const sym of symbolsSnapshot) {
            const quote = quotes[sym];
            const last = quote?.last;
            if (typeof last === "number" && isFinite(last) && last > 0) {
              const prev = this.lastPrices[sym];
              if (prev === undefined || Math.abs(prev - last) >= 0.0001) {
                this.lastPrices[sym] = last;
                changed = true;
              }
            }
          }
          if (changed) {
            this.refreshCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (error) {
                console.error("❌ Refresh callback error:", error);
              }
            });
          }
        } catch (error) {
          console.warn("⚠️ Watchlist polling failed", error);
        } finally {
          this.priceDirty = false;
          this.watchlistPollingInFlight = false;
        }
      }, 1000);
    }

    // Realtime-only mode: polygon not configured -> fallback polling handles updates
  }

  // Stop watchlist refresh
  stopWatchlistRefresh(): void {
    console.log("⏹️ Stopping watchlist refresh");
    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
      this.watchlistInterval = null;
    }
    this.watchlistPollingInFlight = false;
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
