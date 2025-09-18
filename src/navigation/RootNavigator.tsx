import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useColorScheme,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

// Navigation types and config
import { RootStackParamList, LinkingConfig } from './types';

// Feature navigators
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { TradingNavigator } from './TradingNavigator';
import { PortfolioNavigator } from './PortfolioNavigator';
import { MarketNavigator } from './MarketNavigator';

// Providers and hooks
import { useAuth } from '../features/authentication';
import { useTheme } from '../providers/ThemeProvider';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function LoadingScreen() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.loadingContainer,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const scheme = useColorScheme();
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  // Show loading screen while authentication is being checked
  if (loading) {
    return (
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen
            name="Main"
            component={LoadingScreen}
            options={{ title: 'Loading...' }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={scheme === 'dark' ? DarkTheme : DefaultTheme}
      linking={LinkingConfig}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 200,
        }}
      >
        {user ? (
          // Authenticated user navigation
          <>
            <RootStack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{
                title: 'Trading App',
              }}
            />
            <RootStack.Screen
              name="Trading"
              component={TradingNavigator}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <RootStack.Screen
              name="Portfolio"
              component={PortfolioNavigator}
              options={{
                presentation: 'modal',
                animation: 'slide_from_right',
              }}
            />
            <RootStack.Screen
              name="Market"
              component={MarketNavigator}
              options={{
                presentation: 'modal',
                animation: 'slide_from_right',
              }}
            />
          </>
        ) : (
          // Unauthenticated user navigation
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{
              title: 'Authentication',
            }}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// Export navigation ref for programmatic navigation
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Helper function for programmatic navigation
export function navigate<T extends keyof RootStackParamList>(
  screen: T,
  params?: RootStackParamList[T]
) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen, params);
  }
}

// Helper function to go back
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

// Helper function to reset navigation state
export function resetToScreen<T extends keyof RootStackParamList>(
  screen: T,
  params?: RootStackParamList[T]
) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: screen, params }],
    });
  }
}