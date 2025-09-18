import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TradingStackParamList } from './types';
import StockDetailScreen from '../screens/StockDetailScreen';
import ChartFullScreen from '../screens/ChartFullScreen';
import ChartChatScreen from '../screens/ChartChatScreen';
import IndicatorConfigScreen from '../screens/IndicatorConfigScreen';

const TradingStack = createNativeStackNavigator<TradingStackParamList>();

export function TradingNavigator() {
  return (
    <TradingStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <TradingStack.Screen
        name="StockDetail"
        component={StockDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || route.params.symbol,
          headerShown: false,
        })}
      />
      <TradingStack.Screen
        name="ChartFullScreen"
        component={ChartFullScreen}
        options={({ route }) => ({
          title: `${route.params.symbol} Chart`,
          headerShown: false,
          presentation: 'fullScreenModal',
        })}
      />
      <TradingStack.Screen
        name="ChartChat"
        component={ChartChatScreen}
        options={{
          title: 'Chart Analysis',
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <TradingStack.Screen
        name="IndicatorConfig"
        component={IndicatorConfigScreen}
        options={({ route }) => ({
          title: `${route.params.symbol} Indicators`,
          headerShown: false,
          presentation: 'modal',
        })}
      />
    </TradingStack.Navigator>
  );
}