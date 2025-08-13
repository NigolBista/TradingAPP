import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

export type BrokerageProvider = "robinhood" | "webull";

export interface BrokerageSession {
  provider: BrokerageProvider;
  cookies: string;
  tokens: Record<string, string>;
  expiresAt: number;
  userId?: string;
  refreshToken?: string;
}

export interface AuthResult {
  success: boolean;
  session?: BrokerageSession;
  error?: string;
}

// Encryption key for storing sensitive session data
const STORAGE_KEY = "brokerage_sessions";
const ENCRYPTION_SECRET = "your-app-encryption-secret-key";

class BrokerageAuthService {
  private sessions: Map<BrokerageProvider, BrokerageSession> = new Map();

  constructor() {
    this.loadSessions();
  }

  // Load encrypted sessions from storage
  private async loadSessions() {
    try {
      const encrypted = await AsyncStorage.getItem(STORAGE_KEY);
      if (encrypted) {
        const decrypted = CryptoJS.AES.decrypt(
          encrypted,
          ENCRYPTION_SECRET
        ).toString(CryptoJS.enc.Utf8);
        const sessions = JSON.parse(decrypted);

        // Filter out expired sessions
        const now = Date.now();
        Object.entries(sessions).forEach(
          ([provider, session]: [string, any]) => {
            if (session.expiresAt > now) {
              this.sessions.set(provider as BrokerageProvider, session);
            }
          }
        );
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  }

  // Save encrypted sessions to storage
  private async saveSessions() {
    try {
      const sessionsObj: Record<string, BrokerageSession> = {};
      this.sessions.forEach((session, provider) => {
        sessionsObj[provider] = session;
      });

      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(sessionsObj),
        ENCRYPTION_SECRET
      ).toString();
      await AsyncStorage.setItem(STORAGE_KEY, encrypted);
    } catch (error) {
      console.error("Failed to save sessions:", error);
    }
  }

  // Get login URL for each provider
  getLoginUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://robinhood.com/login";
      case "webull":
        return "https://www.webull.com/login";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Extract session data from WebView after successful login
  async extractSessionFromWebView(
    provider: BrokerageProvider,
    webViewRef: React.RefObject<WebView> | React.RefObject<WebView | null>,
    url: string
  ): Promise<AuthResult> {
    try {
      // Check if we're on a success page (dashboard, account, etc.)
      const isLoginSuccess = this.isLoginSuccessUrl(provider, url);

      if (!isLoginSuccess) {
        return { success: false, error: "Not on success page yet" };
      }

      // Extract cookies and tokens
      const cookiesScript = `
        (function() {
          return document.cookie;
        })();
      `;

      const cookies = await this.executeScript(webViewRef, cookiesScript);

      // Extract auth tokens from localStorage/sessionStorage
      const tokensScript = `
        (function() {
          const tokens = {};
          
          // Try to get common auth tokens
          ['authToken', 'accessToken', 'sessionToken', 'jwt', 'bearerToken'].forEach(key => {
            const value = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (value) tokens[key] = value;
          });
          
          // Provider-specific token extraction
          ${this.getProviderSpecificTokenScript(provider)}
          
          return JSON.stringify(tokens);
        })();
      `;

      const tokensJson = await this.executeScript(webViewRef, tokensScript);
      const tokens = JSON.parse(tokensJson || "{}");

      // Create session
      const session: BrokerageSession = {
        provider,
        cookies,
        tokens,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours default
      };

      // Store session
      this.sessions.set(provider, session);
      await this.saveSessions();

      return { success: true, session };
    } catch (error) {
      console.error("Failed to extract session:", error);
      return { success: false, error: error.message };
    }
  }

  // Check if URL indicates successful login
  private isLoginSuccessUrl(provider: BrokerageProvider, url: string): boolean {
    switch (provider) {
      case "robinhood":
        return (
          url.includes("robinhood.com") &&
          (url.includes("/dashboard") ||
            url.includes("/account") ||
            url.includes("/positions"))
        );
      case "webull":
        return (
          url.includes("webull.com") &&
          (url.includes("/trading") ||
            url.includes("/account") ||
            url.includes("/portfolio"))
        );
      default:
        return false;
    }
  }

  // Provider-specific token extraction scripts
  private getProviderSpecificTokenScript(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return `
          // Robinhood-specific token extraction
          if (window.RH && window.RH.auth) {
            tokens.rhAuth = JSON.stringify(window.RH.auth);
          }
          
          // Check for API tokens in network requests
          const authHeaders = [];
          if (window.fetch) {
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              const headers = args[1]?.headers;
              if (headers && headers.Authorization) {
                authHeaders.push(headers.Authorization);
              }
              return originalFetch.apply(this, args);
            };
          }
        `;
      case "webull":
        return `
          // Webull-specific token extraction
          if (window.webull && window.webull.user) {
            tokens.webullUser = JSON.stringify(window.webull.user);
          }
          
          // Look for common Webull tokens
          ['wbAccessToken', 'refreshToken', 'deviceId'].forEach(key => {
            const value = localStorage.getItem(key);
            if (value) tokens[key] = value;
          });
        `;
      default:
        return "";
    }
  }

  // Execute JavaScript in WebView
  private executeScript(
    webViewRef: React.RefObject<WebView> | React.RefObject<WebView | null>,
    script: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!webViewRef.current) {
        reject(new Error("WebView ref not available"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Script execution timeout"));
      }, 10000);

      webViewRef.current.postMessage(
        JSON.stringify({ type: "execute", script })
      );

      const messageHandler = (event: any) => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "scriptResult") {
            resolve(data.result);
          }
        } catch (error) {
          reject(error);
        }
      };

      // Note: This is a simplified version. In practice, you'd need to set up proper message handling
      resolve(""); // Placeholder for actual implementation
    });
  }

  // Get active session for provider
  getSession(provider: BrokerageProvider): BrokerageSession | null {
    const session = this.sessions.get(provider);
    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }
    return session;
  }

  // Check if session is valid and refresh if needed
  async validateAndRefreshSession(
    provider: BrokerageProvider
  ): Promise<boolean> {
    const session = this.getSession(provider);
    if (!session) return false;

    // If session expires soon, try to refresh
    const oneHourFromNow = Date.now() + 60 * 60 * 1000;
    if (session.expiresAt < oneHourFromNow && session.refreshToken) {
      return await this.refreshSession(provider);
    }

    return true;
  }

  // Refresh session using refresh token
  private async refreshSession(provider: BrokerageProvider): Promise<boolean> {
    const session = this.sessions.get(provider);
    if (!session?.refreshToken) return false;

    try {
      // Provider-specific refresh logic
      const refreshUrl = this.getRefreshUrl(provider);
      const response = await fetch(refreshUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: session.cookies,
        },
        body: JSON.stringify({
          refresh_token: session.refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update session with new tokens
        session.tokens = { ...session.tokens, ...data.tokens };
        session.expiresAt = Date.now() + data.expires_in * 1000;

        await this.saveSessions();
        return true;
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
    }

    return false;
  }

  // Get refresh URL for provider
  private getRefreshUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://robinhood.com/api-token-auth/";
      case "webull":
        return "https://act.webull.com/webull-login-inquiry/api/passport/refreshToken";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Clear session for provider
  async clearSession(provider: BrokerageProvider) {
    this.sessions.delete(provider);
    await this.saveSessions();
  }

  // Clear all sessions
  async clearAllSessions() {
    this.sessions.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // Get all active sessions
  getActiveSessions(): BrokerageProvider[] {
    const active: BrokerageProvider[] = [];
    const now = Date.now();

    this.sessions.forEach((session, provider) => {
      if (session.expiresAt > now) {
        active.push(provider);
      }
    });

    return active;
  }
}

export const brokerageAuthService = new BrokerageAuthService();
