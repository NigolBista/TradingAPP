import { type SimpleQuote } from "./quotes";
import { safeFetchBulkQuotes, safeFetchSingleQuote } from "./quoteFetcher";
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
          await safeFetchBulkQuotes(chunk);

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
    // Realtime subscriptions now handled by chart components
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
