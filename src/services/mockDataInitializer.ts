import { plaidIntegrationService } from "./plaidIntegration";

/**
 * Initialize mock data for development and testing
 * This ensures that the app has sample data to display even without real Plaid connections
 */
export class MockDataInitializer {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("🔧 Mock data already initialized");
      return;
    }

    try {
      console.log("🔧 Initializing mock data...");

      // Ensure we have mock tokens stored
      const existingTokens = plaidIntegrationService.getStoredTokens();

      if (existingTokens.length === 0) {
        console.log("🔧 Creating mock access token for demo");
        // Simulate a token exchange to store mock data
        await plaidIntegrationService.exchangePublicToken(
          "public-sandbox-mock-token"
        );
      }

      this.initialized = true;
      console.log("✅ Mock data initialization complete");
    } catch (error) {
      console.error("❌ Failed to initialize mock data:", error);
    }
  }

  static reset(): void {
    this.initialized = false;
    console.log("🔄 Mock data initialization reset");
  }
}
