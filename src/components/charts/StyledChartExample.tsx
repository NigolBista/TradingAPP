import React from 'react';
import { View } from 'react-native';
import KLineProChart from './KLineProChart';
import { defaultChartStyles, minimalChartStyles, tradingChartStyles } from '../../constants/chartStyles';

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  variant?: 'default' | 'minimal' | 'trading';
}

export default function StyledChartExample({ 
  symbol, 
  timeframe = "1d", 
  height = 320,
  variant = 'default'
}: Props) {
  
  // Select style configuration based on variant
  const getStyleConfig = () => {
    switch (variant) {
      case 'minimal':
        return minimalChartStyles;
      case 'trading':
        return tradingChartStyles;
      case 'default':
      default:
        return defaultChartStyles;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <KLineProChart
        symbol={symbol}
        timeframe={timeframe}
        height={height}
        theme="dark"
        market="stocks"
        showYAxis={variant === 'trading'}
        styleConfig={getStyleConfig()}
      />
    </View>
  );
}

// Example usage in other components:
/*
// Basic usage with default styles
<StyledChartExample symbol="AAPL" />

// Minimal chart for overview
<StyledChartExample symbol="AAPL" variant="minimal" />

// Full trading chart with all features
<StyledChartExample symbol="AAPL" variant="trading" />

// Custom styles - you can also pass your own styleConfig directly:
<KLineProChart
  symbol="AAPL"
  styleConfig={{
    grid: { show: true, horizontal: { color: '#ff0000' } },
    candle: { bar: { upColor: '#00ff00', downColor: '#ff0000' } }
  }}
/>
*/