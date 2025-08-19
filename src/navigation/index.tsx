import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useColorScheme,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DashboardScreen from "../screens/DashboardScreen";
import ChartFullScreen from "../screens/ChartFullScreen";
import WatchlistScreen from "../screens/WatchlistScreen";
import AIInsightsScreen from "../screens/AIInsightsScreen";
import JourneyScreen from "../screens/JourneyScreen";
import ProfileScreen from "../screens/ProfileScreen";
// Portfolio functionality moved to Dashboard
import BrokerageAccountsScreen from "../screens/BrokerageAccountsScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import MarketScreenerScreen from "../screens/MarketScreenerScreen";
import StockDetailScreen from "../screens/StockDetailScreen";
import SignalsFeedScreen from "../screens/SignalsFeedScreen";
import NewsInsightsScreen from "../screens/NewsInsightsScreen";
import MarketOverviewScreen from "../screens/MarketOverviewScreen";
import MarketOverviewTabScreen from "../screens/MarketOverviewTabScreen";
import FederalReserveScreen from "../screens/FederalReserveScreen";
import StockNewsApiDemoScreen from "../screens/StockNewsApiDemoScreen";
import DecalpXScreen from "../screens/DecalpXScreen";
import MarketOverviewPage from "../screens/MarketOverviewPage";
import { useAuth } from "../providers/AuthProvider";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loadingContainerDark: {
    backgroundColor: "#000000",
  },
});

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "wallet" : "wallet-outline";
              break;
            case "Watchlist":
              iconName = focused ? "list" : "list-outline";
              break;
            case "Scanner":
              iconName = focused ? "search" : "search-outline";
              break;
            case "AI Insights":
              iconName = focused ? "sparkles" : "sparkles-outline";
              break;
            case "Market":
              iconName = focused ? "trending-up" : "trending-up-outline";
              break;
            case "News":
              iconName = focused ? "newspaper" : "newspaper-outline";
              break;
            case "Profile":
              iconName = focused ? "person" : "person-outline";
              break;
            default:
              iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        headerShown: false,
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />
      <Tab.Screen name="Market" component={MarketOverviewTabScreen} />
      <Tab.Screen name="News" component={NewsInsightsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthRoutes() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigation() {
  const scheme = useColorScheme();
  const { user, loading } = useAuth();

  if (loading) {
    function LoadingScreen() {
      return (
        <View
          style={[
            styles.loadingContainer,
            scheme === "dark" && styles.loadingContainerDark,
          ]}
        >
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }

    return (
      <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Loading" component={LoadingScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme}>
      {user ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Root" component={Tabs} />
          <RootStack.Screen
            name="ChartFullScreen"
            component={ChartFullScreen}
          />
          <RootStack.Screen name="StockDetail" component={StockDetailScreen} />
          <RootStack.Screen name="Scanner" component={MarketScreenerScreen} />
          <RootStack.Screen name="Journey" component={JourneyScreen} />
          <RootStack.Screen name="AIInsights" component={AIInsightsScreen} />
          <RootStack.Screen
            name="BrokerageAccounts"
            component={BrokerageAccountsScreen}
          />
          <RootStack.Screen
            name="MarketOverview"
            component={MarketOverviewScreen}
            options={{ headerShown: true, title: "Market Overview" }}
          />
          <RootStack.Screen
            name="FederalReserve"
            component={FederalReserveScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="StockNewsApiDemo"
            component={StockNewsApiDemoScreen}
            options={{ headerShown: true, title: "Stock News API Demo" }}
          />
          <RootStack.Screen
            name="DecalpX"
            component={DecalpXScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="MarketOverviewPage"
            component={MarketOverviewPage}
            options={{ headerShown: false }}
          />
        </RootStack.Navigator>
      ) : (
        <AuthRoutes />
      )}
    </NavigationContainer>
  );
}
