import { preloadStocksData } from "./stockData";
import { initializeAppDataStore } from "../store/appDataStore";
import { useEarningsStore } from "../store/earningsStore";

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

      // Wait for all to complete
      await Promise.all([stocksPromise, storePromise, earningsPromise]);
      console.log("✅ Stocks database loaded successfully");
      console.log("✅ App data store initialized successfully");
      console.log("✅ Earnings data hydrated successfully");

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
