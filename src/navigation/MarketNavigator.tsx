import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketStackParamList } from './types';
import {
  MarketScreenerScreen,
  MarketOverviewScreen,
  FederalReserveScreen,
  MarketOverviewPage,
  EarningsCalendarScreen
} from '../features/market';
import { AIInsightsScreen, DecalpXScreen, ChatScreen } from '../features/insights';

const MarketStack = createNativeStackNavigator<MarketStackParamList>();

export function MarketNavigator() {
  return (
    <MarketStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <MarketStack.Screen
        name="Scanner"
        component={MarketScreenerScreen}
        options={{
          title: 'Market Scanner',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="AIInsights"
        component={AIInsightsScreen}
        options={{
          title: 'AI Insights',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="MarketOverview"
        component={MarketOverviewScreen}
        options={{
          title: 'Market Overview',
          headerShown: true,
        }}
      />
      <MarketStack.Screen
        name="FederalReserve"
        component={FederalReserveScreen}
        options={{
          title: 'Federal Reserve',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="DecalpX"
        component={DecalpXScreen}
        options={{
          title: 'DecalpX',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="MarketOverviewPage"
        component={MarketOverviewPage}
        options={{
          title: 'Market Analysis',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="EarningsCalendar"
        component={EarningsCalendarScreen}
        options={{
          title: 'Earnings Calendar',
          headerShown: false,
        }}
      />
      <MarketStack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params?.context === 'market' ? 'Market Chat' : 'AI Chat',
          headerShown: false,
        })}
      />
    </MarketStack.Navigator>
  );
}