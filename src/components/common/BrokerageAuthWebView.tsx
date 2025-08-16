import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  brokerageAuthService,
  BrokerageProvider,
  AuthResult,
} from "../../services/brokerageAuth";

interface Props {
  provider: BrokerageProvider;
  onAuthSuccess: (result: AuthResult) => void;
  onCancel: () => void;
}

export default function BrokerageAuthWebView({
  provider,
  onAuthSuccess,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState("");
  const [authAttempted, setAuthAttempted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const loginUrl = brokerageAuthService.getLoginUrl(provider);
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  // Monitor URL changes for successful login
  useEffect(() => {
    if (!authAttempted && currentUrl) {
      checkForAuthSuccess();
    }
  }, [currentUrl]);

  const checkForAuthSuccess = async () => {
    if (authAttempted) return;

    // Simple URL-based detection of successful login
    const isSuccessUrl =
      (provider === "robinhood" &&
        currentUrl.includes("robinhood.com") &&
        (currentUrl.includes("/dashboard") ||
          currentUrl.includes("/account") ||
          currentUrl.includes("/positions"))) ||
      (provider === "webull" &&
        currentUrl.includes("webull.com") &&
        (currentUrl.includes("/trading") ||
          currentUrl.includes("/account") ||
          currentUrl.includes("/portfolio")));

    if (isSuccessUrl) {
      setAuthAttempted(true);
      setLoading(true);

      try {
        // Wait a bit for the page to fully load
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const result = await brokerageAuthService.extractSessionFromWebView(
          provider,
          webViewRef,
          currentUrl
        );

        if (result.success) {
          Alert.alert("Success!", `Successfully connected to ${providerName}`, [
            { text: "OK", onPress: () => onAuthSuccess(result) },
          ]);
        } else {
          Alert.alert(
            "Authentication Error",
            result.error || "Failed to extract session data",
            [
              { text: "Try Again", onPress: () => setAuthAttempted(false) },
              { text: "Cancel", onPress: onCancel },
            ]
          );
        }
      } catch (error) {
        Alert.alert("Error", "Failed to process authentication", [
          { text: "Try Again", onPress: () => setAuthAttempted(false) },
          { text: "Cancel", onPress: onCancel },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setLoading(navState.loading);
    setCanGoBack(!!navState.canGoBack);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = (errorEvent: any) => {
    console.error("WebView error:", errorEvent);
    Alert.alert(
      "Connection Error",
      "Failed to load the login page. Please check your internet connection.",
      [
        { text: "Retry", onPress: () => webViewRef.current?.reload() },
        { text: "Cancel", onPress: onCancel },
      ]
    );
  };

  const attemptExtractNow = async () => {
    try {
      setLoading(true);
      const result = await brokerageAuthService.extractSessionFromWebView(
        provider,
        webViewRef,
        currentUrl || loginUrl,
        true
      );
      if (result.success) {
        onAuthSuccess(result);
      } else {
        Alert.alert(
          "Not Connected",
          result.error ||
            "Couldn't confirm the session yet. Stay on the broker page after logging in, then tap Done again.",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      Alert.alert("Error", "Failed to capture the session.", [{ text: "OK" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      onCancel();
    }
  };

  const injectedJavaScript = `
    // Inject JavaScript to help with session extraction
    (function() {
      // Store original postMessage
      const originalPostMessage = window.ReactNativeWebView?.postMessage;
      
      // Monitor for auth tokens in network requests
      const originalFetch = window.fetch;
      const originalXHR = window.XMLHttpRequest.prototype.open;
      
      // Override fetch to capture auth headers
      window.fetch = function(url, options = {}) {
        const headers = options.headers || {};
        if (headers.Authorization || headers['authorization']) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'authToken',
            token: headers.Authorization || headers['authorization'],
            url: url
          }));
        }
        return originalFetch.apply(this, arguments);
      };
      
      // Monitor localStorage changes
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'storageUpdate',
            key: key,
            value: value
          }));
        }
        return originalSetItem.apply(this, arguments);
      };
      
      // Helper function to extract all relevant data
      window.extractAuthData = function() {
        const data = {
          cookies: document.cookie,
          localStorage: {},
          sessionStorage: {},
          tokens: []
        };
        
        // Extract localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data.localStorage[key] = localStorage.getItem(key);
          }
        }
        
        // Extract sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            data.sessionStorage[key] = sessionStorage.getItem(key);
          }
        }
        
        return data;
      };
      
      // Auto-extract data when page loads completely
      window.addEventListener('load', function() {
        setTimeout(function() {
          const authData = window.extractAuthData();
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'pageLoaded',
            authData: authData
          }));
        }, 1000);
      });
    })();
    
    true; // Required for injected scripts
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("WebView message:", data);

      // Handle different message types
      switch (data.type) {
        case "authToken":
          console.log("Auth token detected:", data.token);
          break;
        case "storageUpdate":
          console.log("Storage update:", data.key, data.value);
          break;
        case "pageLoaded":
          console.log("Page loaded with auth data:", data.authData);
          // Update session with the extracted auth data
          if (data.authData) {
            brokerageAuthService.updateSessionFromMessage(
              provider,
              data.authData
            );
          }
          // Trigger auth extraction when page is fully loaded
          checkForAuthSuccess();
          break;
        case "sessionExtracted":
          console.log("Session extracted for", data.provider, ":", data.data);
          // Update session with extracted data
          if (data.provider === provider && data.data) {
            brokerageAuthService.updateSessionFromMessage(provider, data.data);
          }
          break;
        case "sessionError":
          console.error(
            "Session extraction error for",
            data.provider,
            ":",
            data.error
          );
          break;
        case "cookiesExtracted":
          console.log("Cookies extracted:", data.cookies);
          // Update session with cookies
          if (data.cookies) {
            brokerageAuthService.updateSessionFromMessage(provider, {
              cookies: data.cookies,
              tokens: {},
            });
          }
          break;
        case "scriptResult":
          console.log("Script execution result:", data.result);
          break;
        case "scriptError":
          console.error("Script execution error:", data.error);
          break;
        case "authDataExtracted":
          console.log("Auth data extracted:", data.data);
          if (data.data) {
            brokerageAuthService.updateSessionFromMessage(provider, data.data);
          }
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebView message:", error);
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Connect to {providerName}
          </Text>
          <TouchableOpacity
            onPress={attemptExtractNow}
            style={styles.closeButton}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* WebView Container */}
        <View style={styles.webviewContainer}>
          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00C851" />
              <Text style={styles.loadingText}>
                {authAttempted
                  ? "Processing authentication..."
                  : "Loading login page..."}
              </Text>
            </View>
          )}

          {/* WebView */}
          <WebView
            ref={webViewRef}
            source={{ uri: loginUrl }}
            style={styles.webview}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onMessage={handleMessage}
            injectedJavaScript={injectedJavaScript}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
    minHeight: 52,
    zIndex: 1000,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  webviewContainer: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
