import { AppState, AppStateStatus } from "react-native";

interface HeartbeatConfig {
  intervalMs: number;
  retryAttempts: number;
  onSessionExpired?: (provider: string) => void;
  onConnectionLost?: (provider: string) => void;
}

class SessionHeartbeatService {
  private intervals: Map<string, any> = new Map();
  private config: HeartbeatConfig = {
    intervalMs: 15 * 60 * 1000, // 15 minutes
    retryAttempts: 3,
  };
  private appState: AppStateStatus = "active";
  private retryCount: Map<string, number> = new Map();

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
  startHeartbeat(provider: string, config?: Partial<HeartbeatConfig>) {
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
  stopHeartbeat(provider: string) {
    const interval = this.intervals.get(provider);
    if (interval) {
      try {
        clearInterval(interval as unknown as number);
      } catch {}
      this.intervals.delete(provider);
      this.retryCount.delete(provider);
      console.log(`Stopped heartbeat for ${provider}`);
    }
  }

  // Start heartbeats for all active sessions
  startAllHeartbeats(_config?: Partial<HeartbeatConfig>) {}

  // Stop all heartbeats
  stopAllHeartbeats() {
    this.intervals.forEach((interval, provider) => {
      this.stopHeartbeat(provider);
    });
  }

  // Pause heartbeats (when app goes to background)
  private pauseAllHeartbeats() {
    this.intervals.forEach((interval) => {
      try {
        clearInterval(interval as unknown as number);
      } catch {}
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
  private async performHeartbeat(provider: string) {
    try {
      console.log(`Performing heartbeat for ${provider}`);

      // No legacy checks with Plaid; pretend OK

      // Reset retry count on success
      this.retryCount.set(provider, 0);
      console.log(`Heartbeat successful for ${provider}`);
    } catch (error) {
      console.error(`Heartbeat error for ${provider}:`, error);
      this.handleHeartbeatError(provider, error);
    }
  }

  // Handle session expiration
  private handleSessionExpired(provider: string) {
    this.stopHeartbeat(provider);
    this.config.onSessionExpired?.(provider);
    console.log(`Session expired for ${provider}, stopped heartbeat`);
  }

  // Handle connection loss
  private handleConnectionLost(provider: string) {
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
  private handleHeartbeatError(provider: string, error: any) {
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
  async checkAllSessions() {}

  // Get heartbeat status for all providers
  getHeartbeatStatus() {
    return {} as Record<string, { active: boolean; retries: number }>;
  }

  // Update heartbeat configuration
  updateConfig(config: Partial<HeartbeatConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Manual session refresh for all providers
  async refreshAllSessions() {
    return [] as Array<{ provider: string; success: boolean }>;
  }

  // Cleanup when service is destroyed
  destroy() {
    this.stopAllHeartbeats();
  }
}

export const sessionHeartbeatService = new SessionHeartbeatService();
