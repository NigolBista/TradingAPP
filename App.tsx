import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./global.css";
import RootNavigation from "./src/navigation";
import { ThemeProvider } from "./src/providers/ThemeProvider";
import { StripeProvider } from "./src/providers/StripeProvider";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StripeProvider>
          <StatusBar style="auto" />
          <RootNavigation />
        </StripeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
