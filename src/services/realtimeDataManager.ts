import {
  getCachedQuotes,
  fetchAndCacheBulkQuotes,
  type SimpleQuote,
} from "./quotes";
import { smartCandleManager } from "./smartCandleManager";
import Constants from "expo-constants";
import realtimeRouter from "./realtimeRouter";

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

      // Live subscribe if polygon is configured
      if (watchlist.length) {
        try {
          await realtimeRouter.subscribe(watchlist);
        } catch (e) {
          console.warn("Realtime subscribe failed", e);
        }
      }

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

      // First try to get cached quotes (no API calls)
      const cachedQuotes = await getCachedQuotes(symbols);
      console.log("✅ Got", Object.keys(cachedQuotes).length, "cached quotes");

      // Find symbols that need fresh data
      const missingSymbols = symbols.filter((s) => !cachedQuotes[s]);

      if (missingSymbols.length > 0) {
        console.log("🔄 Fetching", missingSymbols.length, "missing quotes");

        // Chunk missing symbols to avoid API limits (max 20 symbols per request)
        const chunkSize = 20;
        for (let i = 0; i < missingSymbols.length; i += chunkSize) {
          const chunk = missingSymbols.slice(i, i + chunkSize);

          try {
            console.log(
              `📡 Fetching quotes chunk ${
                Math.floor(i / chunkSize) + 1
              }/${Math.ceil(missingSymbols.length / chunkSize)}:`,
              chunk
            );
            await fetchAndCacheBulkQuotes(chunk);

            // Rate limiting: wait between chunks to avoid overwhelming API
            if (i + chunkSize < missingSymbols.length) {
              await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay
            }
          } catch (error) {
            console.error(
              "❌ Watchlist quotes fetch failed for chunk:",
              chunk,
              error
            );
            // Continue with other chunks even if one fails
          }
        }
      }

      console.log("✅ Watchlist quotes loading completed");
    } catch (error) {
      console.error("❌ Failed to load watchlist quotes:", error);
    }
  }

  // Load chart data for all watchlist stocks using smart caching
  private async loadWatchlistCharts(symbols: string[]): Promise<void> {
    console.log("📈 Smart pre-loading charts for", symbols.length, "stocks");

    // Load charts sequentially to avoid API rate limits
    const batchSize = 3; // Conservative batch size to stay under 50 concurrent limit
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (symbol) => {
          try {
            // Single preload call per symbol - much more efficient!
            await smartCandleManager.preloadSymbol(symbol);
            console.log("📈 Smart cached", symbol);
          } catch (error) {
            console.warn("⚠️ Failed to smart cache", symbol, error);
          }
        })
      );

      // Longer delay to respect API rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 300)); // 300ms delay
      }
    }

    console.log("✅ Smart chart pre-caching completed");
    console.log("📊 Cache stats:", smartCandleManager.getStats());
  }

  // Start 5-second watchlist refresh
  startWatchlistRefresh(watchlist: string[], callback?: RefreshCallback): void {
    console.log("🔄 Starting watchlist refresh every 5 seconds");
    this.currentWatchlist = watchlist;

    if (callback) {
      this.refreshCallbacks.push(callback);
    }

    // Clear any existing interval
    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
    }

    // Start new interval
    this.watchlistInterval = setInterval(async () => {
      try {
        console.log("🔄 Refreshing watchlist data...");
        await this.loadWatchlistQuotes(this.currentWatchlist);

        // Notify callbacks
        this.refreshCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (error) {
            console.error("❌ Refresh callback error:", error);
          }
        });
      } catch (error) {
        console.error("❌ Watchlist refresh failed:", error);
      }
    }, 5000);
  }

  // Stop watchlist refresh
  stopWatchlistRefresh(): void {
    console.log("⏹️ Stopping watchlist refresh");
    if (this.watchlistInterval) {
      clearInterval(this.watchlistInterval);
      this.watchlistInterval = null;
    }
    this.refreshCallbacks = [];
    try {
      realtimeRouter.clearAll();
    } catch {}
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

    // Live subscribe for the focused symbol if available
    if (symbol) {
      try {
        // fire and forget
        void realtimeRouter.subscribe([symbol]);
      } catch (e) {
        console.warn("Realtime subscribe failed for stock detail", e);
      }
    }

    // Start new interval
    this.stockDetailInterval = setInterval(async () => {
      try {
        console.log(
          "🔄 Refreshing stock detail data for",
          this.currentStock,
          this.currentTimeframe
        );

        if (this.currentStock) {
          // Smart incremental update - much more efficient!
          await smartCandleManager.updateSymbol(this.currentStock);

          // Refresh quote
          await getCachedQuotes([this.currentStock]);

          // Notify callbacks
          this.refreshCallbacks.forEach((cb) => {
            try {
              cb();
            } catch (error) {
              console.error("❌ Refresh callback error:", error);
            }
          });
        }
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
    try {
      realtimeRouter.clearAll();
    } catch {}
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
