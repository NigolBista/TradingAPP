import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TradingStackParamList } from './types';
import {
  StockDetailScreen,
  ChartFullScreen,
  ChartChatScreen,
  IndicatorConfigScreen
} from '../features/trading';

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
        })}
      />
      <TradingStack.Screen
        name="ChartChat"
        component={ChartChatScreen}
        options={{
          title: 'Chart Analysis',
          headerShown: false,
        }}
      />
      <TradingStack.Screen
        name="IndicatorConfig"
        component={IndicatorConfigScreen}
        options={({ route }) => ({
          title: `${route.params.symbol} Indicators`,
          headerShown: false,
        })}
      />
    </TradingStack.Navigator>
  );
}