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
    url: string,
    force: boolean = false
  ): Promise<AuthResult> {
    try {
      // Check if we're on a success page (dashboard, account, etc.)
      const isLoginSuccess = this.isLoginSuccessUrl(provider, url);

      if (!isLoginSuccess && !force) {
        return { success: false, error: "Not on success page yet" };
      }

      console.log(`Extracting session data for ${provider} from URL: ${url}`);

      // Use injectJavaScript directly for more reliable execution
      const extractionScript = `
        (function() {
          try {
            const authData = {
              cookies: document.cookie || '',
              localStorage: {},
              sessionStorage: {},
              tokens: {},
              url: window.location.href
            };
            
            // Extract localStorage
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                authData.localStorage[key] = localStorage.getItem(key);
                // Check for common token patterns
                if (key.toLowerCase().includes('token') || 
                    key.toLowerCase().includes('auth') ||
                    key.toLowerCase().includes('session')) {
                  authData.tokens[key] = localStorage.getItem(key);
                }
              }
            }
            
            // Extract sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) {
                authData.sessionStorage[key] = sessionStorage.getItem(key);
                // Check for common token patterns
                if (key.toLowerCase().includes('token') || 
                    key.toLowerCase().includes('auth') ||
                    key.toLowerCase().includes('session')) {
                  authData.tokens[key] = sessionStorage.getItem(key);
                }
              }
            }
            
            // Extract tokens from cookies (especially for Robinhood)
            if (document.cookie) {
              const cookies = document.cookie.split(';');
              cookies.forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value && (
                    name.includes('Access-Token') || 
                    name.includes('access_token') ||
                    name.includes('Auth-Token') ||
                    name.includes('session_id') ||
                    name.includes('device_id')
                )) {
                  authData.tokens[name] = value;
                }
              });
            }
            
            // Provider-specific extraction
            ${this.getProviderSpecificExtractionScript(provider)}
            
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'sessionExtracted',
              provider: '${provider}',
              data: authData
            }));
            
            return authData;
          } catch (error) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'sessionError',
              provider: '${provider}',
              error: error.message
            }));
            throw error;
          }
        })();
      `;

      // Inject the script
      webViewRef.current?.injectJavaScript(extractionScript);

      // Wait a bit for the script to execute and messages to be posted
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // For now, create a basic session with what we can extract
      // The actual session data will be captured via message handling in the WebView component

      // Try to get cookies directly
      const cookiesScript = `document.cookie || ''`;
      let cookies = "";
      try {
        webViewRef.current?.injectJavaScript(`
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'cookiesExtracted',
            cookies: document.cookie || ''
          }));
        `);
      } catch (e) {
        console.log("Failed to extract cookies directly");
      }

      // Check if we already have a session with extracted data from WebView messages
      const existingSession = this.sessions.get(provider);
      if (existingSession && Object.keys(existingSession.tokens).length > 0) {
        console.log(
          `Using existing session with ${
            Object.keys(existingSession.tokens).length
          } tokens for ${provider}`
        );
        return { success: true, session: existingSession };
      }

      // Only create a basic session if we don't have a properly extracted one
      const session: BrokerageSession = {
        provider,
        cookies: cookies,
        tokens: {},
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours default
      };

      console.log(
        `Created basic session for ${provider} (tokens will be updated via WebView messages):`,
        {
          provider: session.provider,
          hasCookies: !!session.cookies,
          tokenCount: Object.keys(session.tokens).length,
          expiresAt: new Date(session.expiresAt).toISOString(),
        }
      );

      // Store session only if we don't already have a better one
      if (
        !existingSession ||
        Object.keys(existingSession.tokens).length === 0
      ) {
        this.sessions.set(provider, session);
        await this.saveSessions();
      }

      return { success: true, session };
    } catch (error) {
      console.error("Failed to extract session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
            url.includes("/positions") ||
            url.includes("/investing") ||
            url.includes("/home"))
        );
      case "webull":
        return (
          url.includes("webull.com") &&
          (url.includes("/trading") ||
            url.includes("/account") ||
            url.includes("/portfolio") ||
            url.includes("/quote") ||
            url.includes("/overview"))
        );
      default:
        return false;
    }
  }

  // Provider-specific extraction scripts for use in session extraction
  private getProviderSpecificExtractionScript(
    provider: BrokerageProvider
  ): string {
    switch (provider) {
      case "robinhood":
        return `
          // Robinhood-specific token extraction
          try {
            if (window.RH && window.RH.auth) {
              authData.tokens.rhAuth = JSON.stringify(window.RH.auth);
            }
            
            // Look for Robinhood-specific localStorage keys
            ['rh_access_token', 'access_token', 'rh_refresh_token', 'user_id'].forEach(key => {
              const value = localStorage.getItem(key) || sessionStorage.getItem(key);
              if (value) authData.tokens[key] = value;
            });
            
            // Check if we can access any global auth state
            if (typeof window.getState === 'function') {
              try {
                const state = window.getState();
                if (state && state.auth) {
                  authData.tokens.stateAuth = JSON.stringify(state.auth);
                }
              } catch (e) {}
            }
          } catch (e) {
            console.log('Robinhood extraction error:', e);
          }
        `;
      case "webull":
        return `
          // Webull-specific token extraction
          try {
            if (window.webull && window.webull.user) {
              authData.tokens.webullUser = JSON.stringify(window.webull.user);
            }
            
            // Look for common Webull tokens
            ['wbAccessToken', 'refreshToken', 'deviceId', 'wb_access_token', 'wb_refresh_token'].forEach(key => {
              const value = localStorage.getItem(key) || sessionStorage.getItem(key);
              if (value) authData.tokens[key] = value;
            });
            
            // Check for user authentication data
            if (window.wb && window.wb.auth) {
              authData.tokens.wbAuth = JSON.stringify(window.wb.auth);
            }
          } catch (e) {
            console.log('Webull extraction error:', e);
          }
        `;
      default:
        return "// No provider-specific extraction";
    }
  }

  // Provider-specific token extraction scripts (legacy method, keeping for compatibility)
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

      // Store the resolve/reject functions for this specific execution
      const executionId = Math.random().toString(36).substr(2, 9);

      // Inject script with execution ID
      const wrappedScript = `
        (function() {
          try {
            const result = ${script};
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'scriptResult',
              executionId: '${executionId}',
              result: result || ''
            }));
          } catch (error) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'scriptError',
              executionId: '${executionId}',
              error: error.message
            }));
          }
        })();
      `;

      // Execute the script
      webViewRef.current?.injectJavaScript(wrappedScript);

      // Set up a temporary listener (this is a simplified approach)
      // In practice, you'd want a more robust message handling system
      const cleanup = () => {
        clearTimeout(timeout);
      };

      // For now, we'll use a simple approach - extract data directly
      setTimeout(() => {
        cleanup();
        // Fallback: try to extract data using the injected functions
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              if (window.extractAuthData) {
                const authData = window.extractAuthData();
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'authDataExtracted',
                  data: authData
                }));
              }
            } catch (e) {
              console.log('Failed to extract auth data:', e);
            }
          })();
        `);
        resolve(""); // Resolve with empty string for now, actual data will come via messages
      }, 2000);
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

  // Update session with extracted data from WebView message
  async updateSessionFromMessage(
    provider: BrokerageProvider,
    extractedData: any
  ): Promise<void> {
    try {
      const existingSession = this.sessions.get(provider);
      if (!existingSession) {
        console.warn(
          `No existing session found for ${provider}, creating new one`
        );
      }

      // Update session with extracted data
      const updatedSession: BrokerageSession = {
        provider,
        cookies: extractedData.cookies || existingSession?.cookies || "",
        tokens: {
          ...existingSession?.tokens,
          ...extractedData.tokens,
        },
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        userId:
          extractedData.tokens?.user_id ||
          extractedData.tokens?.userId ||
          existingSession?.userId,
        refreshToken:
          extractedData.tokens?.refresh_token ||
          extractedData.tokens?.refreshToken ||
          existingSession?.refreshToken,
      };

      console.log(`Updated session for ${provider}:`, {
        provider: updatedSession.provider,
        hasCookies: !!updatedSession.cookies,
        tokenCount: Object.keys(updatedSession.tokens).length,
        hasUserId: !!updatedSession.userId,
        hasRefreshToken: !!updatedSession.refreshToken,
      });

      this.sessions.set(provider, updatedSession);
      await this.saveSessions();
    } catch (error) {
      console.error(`Failed to update session for ${provider}:`, error);
    }
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

  // Debug method to get session details
  getSessionDebugInfo(provider: BrokerageProvider): any {
    const session = this.sessions.get(provider);
    if (!session) {
      return { error: `No session found for ${provider}` };
    }

    return {
      provider: session.provider,
      hasCookies: !!session.cookies,
      cookiesLength: session.cookies?.length || 0,
      tokenCount: Object.keys(session.tokens).length,
      tokenKeys: Object.keys(session.tokens),
      hasUserId: !!session.userId,
      hasRefreshToken: !!session.refreshToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
      isExpired: session.expiresAt <= Date.now(),
      timeUntilExpiry: Math.max(0, session.expiresAt - Date.now()),
    };
  }

  // Debug method to log all session info
  logAllSessionsDebugInfo(): void {
    console.log("=== BROKERAGE SESSIONS DEBUG INFO ===");
    const providers: BrokerageProvider[] = ["robinhood", "webull"];

    providers.forEach((provider) => {
      const info = this.getSessionDebugInfo(provider);
      console.log(`${provider.toUpperCase()}:`, info);
    });

    console.log("Active sessions:", this.getActiveSessions());
    console.log("=== END DEBUG INFO ===");
  }
}

export const brokerageAuthService = new BrokerageAuthService();
