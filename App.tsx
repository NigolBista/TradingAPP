import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./global.css";
import RootNavigation from "./src/navigation";
import { ThemeProvider } from "./src/providers/ThemeProvider";
import { StripeProvider } from "./src/providers/StripeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";

export default function App() {
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
