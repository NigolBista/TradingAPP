import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState("");
  const [authAttempted, setAuthAttempted] = useState(false);

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
          // Trigger auth extraction when page is fully loaded
          checkForAuthSuccess();
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebView message:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect to {providerName}</Text>
        <View style={styles.placeholder} />
      </View>

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

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          1. Log in to your {providerName} account
        </Text>
        <Text style={styles.instructionText}>
          2. Complete any 2FA verification if prompted
        </Text>
        <Text style={styles.instructionText}>
          3. Wait for automatic detection once logged in
        </Text>
      </View>
    </SafeAreaView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  webview: {
    flex: 1,
  },
  instructions: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
});
