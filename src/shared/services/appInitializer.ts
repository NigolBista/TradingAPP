import { initializeAppDataStore } from "../../store/appDataStore";

/**
 * App Initializer
 * Handles all app startup initialization tasks
 */
export class AppInitializer {
  private static initialized = false;

  /**
   * Initialize the entire app
   * This should be called once on app startup
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("🔧 App already initialized");
      return;
    }

    console.log("🚀 Starting app initialization...");

    try {
      // Initialize the centralized data store
      await initializeAppDataStore();

      this.initialized = true;
      console.log("✅ App initialization complete");
    } catch (error) {
      console.error("❌ App initialization failed:", error);
      throw error;
    }
  }

  /**
   * Reset initialization state (useful for testing)
   */
  static reset(): void {
    this.initialized = false;
    console.log("🔄 App initialization reset");
  }

  /**
   * Check if app is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
}
