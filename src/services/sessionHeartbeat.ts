import { AppState, AppStateStatus } from "react-native";
import { brokerageAuthService, BrokerageProvider } from "./brokerageAuth";
import { brokerageApiService } from "./brokerageApiService";

interface HeartbeatConfig {
  intervalMs: number;
  retryAttempts: number;
  onSessionExpired?: (provider: BrokerageProvider) => void;
  onConnectionLost?: (provider: BrokerageProvider) => void;
}

class SessionHeartbeatService {
  private intervals: Map<BrokerageProvider, NodeJS.Timer> = new Map();
  private config: HeartbeatConfig = {
    intervalMs: 15 * 60 * 1000, // 15 minutes
    retryAttempts: 3,
  };
  private appState: AppStateStatus = "active";
  private retryCount: Map<BrokerageProvider, number> = new Map();

  constructor() {
    // Monitor app state changes
    AppState.addEventListener("change", this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      this.appState.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      // App came to foreground, resume heartbeats and check all sessions
      this.resumeAllHeartbeats();
      this.checkAllSessions();
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background, pause heartbeats to save battery
      this.pauseAllHeartbeats();
    }
    this.appState = nextAppState;
  };

  // Start heartbeat for a specific provider
  startHeartbeat(
    provider: BrokerageProvider,
    config?: Partial<HeartbeatConfig>
  ) {
    this.config = { ...this.config, ...config };
    this.stopHeartbeat(provider); // Clear any existing interval

    const interval = setInterval(async () => {
      await this.performHeartbeat(provider);
    }, this.config.intervalMs);

    this.intervals.set(provider, interval);
    this.retryCount.set(provider, 0);

    console.log(
      `Started heartbeat for ${provider} (interval: ${this.config.intervalMs}ms)`
    );
  }

  // Stop heartbeat for a specific provider
  stopHeartbeat(provider: BrokerageProvider) {
    const interval = this.intervals.get(provider);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(provider);
      this.retryCount.delete(provider);
      console.log(`Stopped heartbeat for ${provider}`);
    }
  }

  // Start heartbeats for all active sessions
  startAllHeartbeats(config?: Partial<HeartbeatConfig>) {
    const activeSessions = brokerageAuthService.getActiveSessions();
    activeSessions.forEach((provider) => {
      this.startHeartbeat(provider, config);
    });
  }

  // Stop all heartbeats
  stopAllHeartbeats() {
    this.intervals.forEach((interval, provider) => {
      this.stopHeartbeat(provider);
    });
  }

  // Pause heartbeats (when app goes to background)
  private pauseAllHeartbeats() {
    this.intervals.forEach((interval, provider) => {
      clearInterval(interval);
    });
    console.log("Paused all heartbeats");
  }

  // Resume heartbeats (when app comes to foreground)
  private resumeAllHeartbeats() {
    const providersToResume = Array.from(this.intervals.keys());
    providersToResume.forEach((provider) => {
      this.startHeartbeat(provider);
    });
    console.log("Resumed all heartbeats");
  }

  // Perform heartbeat check for a provider
  private async performHeartbeat(provider: BrokerageProvider) {
    try {
      console.log(`Performing heartbeat for ${provider}`);

      // First, validate and refresh session if needed
      const isSessionValid =
        await brokerageAuthService.validateAndRefreshSession(provider);
      if (!isSessionValid) {
        console.warn(`Session validation failed for ${provider}`);
        this.handleSessionExpired(provider);
        return;
      }

      // Then, test the connection with a lightweight API call
      const isConnected = await brokerageApiService.checkConnection(provider);
      if (!isConnected) {
        console.warn(`Connection check failed for ${provider}`);
        this.handleConnectionLost(provider);
        return;
      }

      // Reset retry count on success
      this.retryCount.set(provider, 0);
      console.log(`Heartbeat successful for ${provider}`);
    } catch (error) {
      console.error(`Heartbeat error for ${provider}:`, error);
      this.handleHeartbeatError(provider, error);
    }
  }

  // Handle session expiration
  private handleSessionExpired(provider: BrokerageProvider) {
    this.stopHeartbeat(provider);
    this.config.onSessionExpired?.(provider);
    console.log(`Session expired for ${provider}, stopped heartbeat`);
  }

  // Handle connection loss
  private handleConnectionLost(provider: BrokerageProvider) {
    const currentRetries = this.retryCount.get(provider) || 0;

    if (currentRetries >= this.config.retryAttempts) {
      console.warn(`Max retries reached for ${provider}, stopping heartbeat`);
      this.stopHeartbeat(provider);
      this.config.onConnectionLost?.(provider);
    } else {
      this.retryCount.set(provider, currentRetries + 1);
      console.log(
        `Connection lost for ${provider}, retry ${currentRetries + 1}/${
          this.config.retryAttempts
        }`
      );
    }
  }

  // Handle other heartbeat errors
  private handleHeartbeatError(provider: BrokerageProvider, error: any) {
    const currentRetries = this.retryCount.get(provider) || 0;

    if (currentRetries >= this.config.retryAttempts) {
      console.error(
        `Max retries reached for ${provider}, stopping heartbeat:`,
        error
      );
      this.stopHeartbeat(provider);
      this.config.onConnectionLost?.(provider);
    } else {
      this.retryCount.set(provider, currentRetries + 1);
      console.warn(
        `Heartbeat error for ${provider}, retry ${currentRetries + 1}/${
          this.config.retryAttempts
        }:`,
        error
      );
    }
  }

  // Check all active sessions immediately
  async checkAllSessions() {
    const activeSessions = brokerageAuthService.getActiveSessions();

    const checkPromises = activeSessions.map(async (provider) => {
      try {
        await this.performHeartbeat(provider);
      } catch (error) {
        console.error(`Session check failed for ${provider}:`, error);
      }
    });

    await Promise.all(checkPromises);
  }

  // Get heartbeat status for all providers
  getHeartbeatStatus() {
    const status: Record<
      BrokerageProvider,
      { active: boolean; retries: number }
    > = {} as any;

    (["robinhood", "webull"] as BrokerageProvider[]).forEach((provider) => {
      status[provider] = {
        active: this.intervals.has(provider),
        retries: this.retryCount.get(provider) || 0,
      };
    });

    return status;
  }

  // Update heartbeat configuration
  updateConfig(config: Partial<HeartbeatConfig>) {
    this.config = { ...this.config, ...config };

    // Restart active heartbeats with new config
    const activeProviders = Array.from(this.intervals.keys());
    activeProviders.forEach((provider) => {
      this.startHeartbeat(provider);
    });
  }

  // Manual session refresh for all providers
  async refreshAllSessions() {
    const activeSessions = brokerageAuthService.getActiveSessions();

    const refreshPromises = activeSessions.map(async (provider) => {
      try {
        const success = await brokerageAuthService.validateAndRefreshSession(
          provider
        );
        console.log(
          `Session refresh for ${provider}: ${success ? "success" : "failed"}`
        );
        return { provider, success };
      } catch (error) {
        console.error(`Session refresh error for ${provider}:`, error);
        return { provider, success: false };
      }
    });

    const results = await Promise.all(refreshPromises);
    return results;
  }

  // Cleanup when service is destroyed
  destroy() {
    this.stopAllHeartbeats();
    AppState.removeEventListener("change", this.handleAppStateChange);
  }
}

export const sessionHeartbeatService = new SessionHeartbeatService();
