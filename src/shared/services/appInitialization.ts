import { preloadStocksData } from "./stockData";
import { initializeAppDataStore } from "../../store/appDataStore";
import { useEarningsStore } from "../../store/earningsStore";
import { realtimeDataManager } from "./realtimeDataManager";
import { useUserStore } from "../../store/userStore";
import { getGlobalMarketData } from "./marketDataCache";

/**
 * App initialization service
 * Handles preloading of critical data for optimal performance
 */

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the app by preloading critical data
 */
export async function initializeApp(): Promise<void> {
  if (isInitialized) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise(async (resolve) => {
    try {
      console.log("🚀 Initializing app...");

      // Start preloading stocks data in the background
      const stocksPromise = preloadStocksData();

      // Initialize the centralized app data store
      const storePromise = initializeAppDataStore();

      // Hydrate earnings data at app launch
      const earningsPromise = useEarningsStore.getState().hydrateEarningsData();

      // Warm global market cache (news, events, Fed data)
      const marketDataPromise = getGlobalMarketData();

      // Wait for core initialization to complete first
      await Promise.all([
        stocksPromise,
        storePromise,
        earningsPromise,
        marketDataPromise,
      ]);
      console.log("✅ Stocks database loaded successfully");
      console.log("✅ App data store initialized successfully");
      console.log("✅ Earnings data hydrated successfully");
      console.log("✅ Global market data cached successfully");

      // Pre-load watchlist quotes in background (non-blocking)
      preloadWatchlistData().catch((error) => {
        console.error("❌ Watchlist pre-loading failed:", error);
      });

      isInitialized = true;
      resolve();
    } catch (error) {
      console.error("❌ App initialization failed:", error);
      // Don't reject - let the app continue even if preloading fails
      isInitialized = true;
      resolve();
    }
  });

  return initPromise;
}

/**
 * Pre-load watchlist data for instant access
 */
async function preloadWatchlistData(): Promise<void> {
  try {
    const userState = useUserStore.getState();
    const profile = userState.profile;

    // Get all unique symbols from all watchlists and favorites
    const allSymbols = new Set<string>();

    // Add symbols from legacy watchlist (backward compatibility)
    if (profile.watchlist && profile.watchlist.length > 0) {
      profile.watchlist.forEach((symbol) => allSymbols.add(symbol));
    }

    // Add symbols from new watchlists
    if (profile.watchlists && profile.watchlists.length > 0) {
      profile.watchlists.forEach((watchlist) => {
        watchlist.items.forEach((item) => allSymbols.add(item.symbol));
      });
    }

    // Add global favorites
    if (profile.favorites && profile.favorites.length > 0) {
      profile.favorites.forEach((symbol) => allSymbols.add(symbol));
    }

    // Add some default popular stocks if watchlist is empty
    if (allSymbols.size === 0) {
      const defaultStocks = [
        "AAPL",
        "MSFT",
        "GOOGL",
        "AMZN",
        "TSLA",
        "NVDA",
        "META",
        "NFLX",
      ];
      defaultStocks.forEach((symbol) => allSymbols.add(symbol));
    }

    const symbolsArray = Array.from(allSymbols);
    console.log(
      "🚀 Pre-loading data for",
      symbolsArray.length,
      "watchlist stocks:",
      symbolsArray
    );

    // Pre-load watchlist quotes and subscribe to realtime; charts handled by KLine Pro
    await realtimeDataManager.preloadWatchlistData(symbolsArray);

    console.log("✅ Watchlist data pre-loaded successfully");
  } catch (error) {
    console.error("❌ Failed to pre-load watchlist data:", error);
    throw error;
  }
}

/**
 * Check if app is fully initialized
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}

/**
 * Force re-initialization (useful for testing or error recovery)
 */
export function resetInitialization(): void {
  isInitialized = false;
  initPromise = null;
}
