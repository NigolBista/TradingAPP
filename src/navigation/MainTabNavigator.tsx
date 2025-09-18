import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { useTheme } from '../providers/ThemeProvider';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import MarketOverviewTabScreen from '../screens/MarketOverviewTabScreen';
import FocusScreen from '../screens/FocusScreen';
import ProfileScreen from '../screens/ProfileScreen';

const MainTab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'Watchlist':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Market':
              iconName = focused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'Focus':
              iconName = focused ? 'flag' : 'flag-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Portfolio',
          tabBarBadge: undefined, // Can be used for notifications
        }}
      />
      <MainTab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          title: 'Watchlist',
        }}
      />
      <MainTab.Screen
        name="Market"
        component={MarketOverviewTabScreen}
        options={{
          title: 'Market',
        }}
      />
      <MainTab.Screen
        name="Focus"
        component={FocusScreen}
        options={{
          title: 'Focus',
        }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </MainTab.Navigator>
  );
}