import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigation from "./src/navigation";
import { ThemeProvider } from "./src/providers/ThemeProvider";
import { StripeProvider } from "./src/providers/StripeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
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
            <StatusBar style="auto" />
            <RootNavigation />
          </AuthProvider>
        </StripeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
