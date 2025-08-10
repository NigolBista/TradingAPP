import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Svg, Rect, Line } from "react-native-svg";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CompactCandlestickChartProps {
  data: CandleData[];
  height?: number;
  greenColor?: string;
  redColor?: string;
}

const { width: screenWidth } = Dimensions.get("window");

export default function CompactCandlestickChart({
  data,
  height = 200,
  greenColor = "#00D4AA",
  redColor = "#FF6B6B",
}: CompactCandlestickChartProps) {
  if (!data || data.length === 0) {
    return <View style={[styles.container, { height }]} />;
  }

  const chartWidth = screenWidth - 32; // Account for margins
  const chartHeight = height;
  const candleWidth = Math.max(1, (chartWidth / data.length) * 0.8);

  // Calculate min/max for scaling
  const allPrices = data.flatMap((d) => [d.high, d.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;

  // Helper function to convert price to Y coordinate
  const priceToY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  // Generate candles
  const candles = data.map((candle, index) => {
    const x = (index / (data.length - 1)) * chartWidth;
    const isGreen = candle.close >= candle.open;
    const color = isGreen ? greenColor : redColor;

    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const highY = priceToY(candle.high);
    const lowY = priceToY(candle.low);

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY);

    return {
      key: `candle-${index}`,
      x,
      openY,
      closeY,
      highY,
      lowY,
      bodyTop,
      bodyHeight,
      color,
      isGreen,
    };
  });

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={chartWidth} height={chartHeight}>
        {candles.map((candle) => (
          <React.Fragment key={candle.key}>
            {/* Wick line */}
            <Line
              x1={candle.x}
              y1={candle.highY}
              x2={candle.x}
              y2={candle.lowY}
              stroke={candle.color}
              strokeWidth="1"
            />

            {/* Candle body */}
            <Rect
              x={candle.x - candleWidth / 2}
              y={candle.bodyTop}
              width={candleWidth}
              height={Math.max(1, candle.bodyHeight)}
              fill={candle.isGreen ? candle.color : "transparent"}
              stroke={candle.color}
              strokeWidth="1"
            />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});
