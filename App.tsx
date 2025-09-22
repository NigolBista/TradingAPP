import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigation from "./src/navigation";
import { ThemeProvider } from "./src/providers/ThemeProvider";
import { StripeProvider } from "./src/providers/StripeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { NotificationsProvider } from "./src/providers/NotificationsProvider";
import { OverlayProvider } from "./src/providers/OverlayProvider";
import { initializeApp } from "./src/services/appInitialization";

export default function App() {
  useEffect(() => {
    // Initialize app in the background on startup
    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StripeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <OverlayProvider>
                <StatusBar style="auto" />
                <RootNavigation />
              </OverlayProvider>
            </NotificationsProvider>
          </AuthProvider>
        </StripeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
