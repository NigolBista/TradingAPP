import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PortfolioStackParamList } from './types';
import BrokerageAccountsScreen from '../screens/BrokerageAccountsScreen';
import JourneyScreen from '../screens/JourneyScreen';

const PortfolioStack = createNativeStackNavigator<PortfolioStackParamList>();

export function PortfolioNavigator() {
  return (
    <PortfolioStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <PortfolioStack.Screen
        name="BrokerageAccounts"
        component={BrokerageAccountsScreen}
        options={{
          title: 'Accounts',
          headerShown: true,
        }}
      />
      <PortfolioStack.Screen
        name="Journey"
        component={JourneyScreen}
        options={{
          title: 'Investment Journey',
          headerShown: true,
        }}
      />
    </PortfolioStack.Navigator>
  );
}