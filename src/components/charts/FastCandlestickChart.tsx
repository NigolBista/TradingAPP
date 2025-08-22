import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import {
  Svg,
  Rect,
  Line,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface FastCandlestickChartProps {
  data: CandleData[];
  width?: number;
  height?: number;
  candleWidth?: number;
  wickWidth?: number;
  showVolume?: boolean;
  volumeHeight?: number;
  bullishColor?: string;
  bearishColor?: string;
  wickColor?: string;
  volumeColor?: string;
  showMovingAverage?: boolean;
  maPeriod?: number;
  maColor?: string;
  style?: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function FastCandlestickChart({
  data,
  width = screenWidth - 32,
  height = 300,
  candleWidth = 8,
  wickWidth = 1,
  showVolume = false,
  volumeHeight = 60,
  bullishColor = "#16a34a",
  bearishColor = "#dc2626",
  wickColor = "#6b7280",
  volumeColor = "#9ca3af",
  showMovingAverage = false,
  maPeriod = 20,
  maColor = "#f59e0b",
  style,
}: FastCandlestickChartProps) {
  // Memoize all calculations for maximum performance
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        candles: [],
        volumes: [],
        movingAverage: [],
        priceMin: 0,
        priceMax: 0,
        volumeMax: 0,
        chartHeight: height,
        volumeStartY: height,
      };
    }

    // Filter valid data
    const validData = data.filter(
      (d) =>
        Number.isFinite(d.open) &&
        Number.isFinite(d.high) &&
        Number.isFinite(d.low) &&
        Number.isFinite(d.close)
    );

    if (validData.length === 0) {
      return {
        candles: [],
        volumes: [],
        movingAverage: [],
        priceMin: 0,
        priceMax: 0,
        volumeMax: 0,
        chartHeight: height,
        volumeStartY: height,
      };
    }

    // Calculate price range
    const prices = validData.flatMap((d) => [d.open, d.high, d.low, d.close]);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const priceRange = Math.max(priceMax - priceMin, 0.01);

    // Calculate volume range if showing volume
    let volumeMax = 0;
    if (showVolume) {
      const volumes = validData.map((d) => d.volume || 0).filter((v) => v > 0);
      volumeMax = volumes.length > 0 ? Math.max(...volumes) : 0;
    }

    // Calculate chart dimensions
    const actualVolumeHeight = showVolume ? volumeHeight : 0;
    const actualChartHeight = height - actualVolumeHeight;
    const volumeStartY = actualChartHeight;

    // Calculate candle spacing
    const totalCandleSpace = width;
    const candleSpacing = totalCandleSpace / Math.max(validData.length, 1);
    const actualCandleWidth = Math.min(candleWidth, candleSpacing * 0.8);

    // Calculate moving average if enabled
    let movingAveragePoints: { x: number; y: number }[] = [];
    if (showMovingAverage && maPeriod > 0) {
      movingAveragePoints = validData
        .map((_, index) => {
          if (index < maPeriod - 1) return null;

          const sum = validData
            .slice(index - maPeriod + 1, index + 1)
            .reduce((acc, d) => acc + d.close, 0);
          const average = sum / maPeriod;

          const x = (index + 0.5) * candleSpacing;
          const y =
            actualChartHeight -
            ((average - priceMin) / priceRange) * actualChartHeight;

          return { x, y };
        })
        .filter(Boolean) as { x: number; y: number }[];
    }

    // Generate candle elements
    const candles = validData.map((candle, index) => {
      const x = (index + 0.5) * candleSpacing;
      const centerX = x;

      // Calculate Y positions (inverted for SVG coordinate system)
      const openY =
        actualChartHeight -
        ((candle.open - priceMin) / priceRange) * actualChartHeight;
      const closeY =
        actualChartHeight -
        ((candle.close - priceMin) / priceRange) * actualChartHeight;
      const highY =
        actualChartHeight -
        ((candle.high - priceMin) / priceRange) * actualChartHeight;
      const lowY =
        actualChartHeight -
        ((candle.low - priceMin) / priceRange) * actualChartHeight;

      const isBullish = candle.close >= candle.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1); // Minimum 1px height

      return {
        // Wick (high-low line)
        wickX: centerX,
        wickY1: highY,
        wickY2: lowY,

        // Body (open-close rectangle)
        bodyX: centerX - actualCandleWidth / 2,
        bodyY: bodyTop,
        bodyWidth: actualCandleWidth,
        bodyHeight,

        // Colors
        bodyColor: isBullish ? bullishColor : bearishColor,
        bodyOpacity: isBullish ? 0.8 : 1,

        // Data
        isBullish,
        candle,
      };
    });

    // Generate volume bars if enabled
    const volumes =
      showVolume && volumeMax > 0
        ? validData
            .map((candle, index) => {
              const volume = candle.volume || 0;
              if (volume <= 0) return null;

              const x = (index + 0.5) * candleSpacing;
              const barHeight = (volume / volumeMax) * actualVolumeHeight;
              const barY = volumeStartY + actualVolumeHeight - barHeight;

              return {
                x: x - actualCandleWidth / 2,
                y: barY,
                width: actualCandleWidth,
                height: barHeight,
                volume,
              };
            })
            .filter(Boolean)
        : [];

    return {
      candles,
      volumes,
      movingAverage: movingAveragePoints,
      priceMin,
      priceMax,
      volumeMax,
      chartHeight: actualChartHeight,
      volumeStartY,
    };
  }, [
    data,
    width,
    height,
    candleWidth,
    showVolume,
    volumeHeight,
    showMovingAverage,
    maPeriod,
  ]);

  // Generate moving average path
  const movingAveragePath = useMemo(() => {
    if (chartData.movingAverage.length === 0) return "";

    let path = `M${chartData.movingAverage[0].x},${chartData.movingAverage[0].y}`;
    for (let i = 1; i < chartData.movingAverage.length; i++) {
      path += ` L${chartData.movingAverage[i].x},${chartData.movingAverage[i].y}`;
    }
    return path;
  }, [chartData.movingAverage]);

  if (!data || data.length === 0) {
    return <View style={[styles.container, { width, height }, style]} />;
  }

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={volumeColor} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={volumeColor} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Volume bars */}
        {showVolume &&
          chartData.volumes.map((volume, index) => (
            <Rect
              key={`volume-${index}`}
              x={volume.x}
              y={volume.y}
              width={volume.width}
              height={volume.height}
              fill="url(#volumeGradient)"
            />
          ))}

        {/* Volume separator line */}
        {showVolume && (
          <Line
            x1={0}
            y1={chartData.volumeStartY}
            x2={width}
            y2={chartData.volumeStartY}
            stroke="#374151"
            strokeWidth={0.5}
            opacity={0.3}
          />
        )}

        {/* Candlesticks */}
        {chartData.candles.map((candle, index) => (
          <React.Fragment key={`candle-${index}`}>
            {/* Wick */}
            <Line
              x1={candle.wickX}
              y1={candle.wickY1}
              x2={candle.wickX}
              y2={candle.wickY2}
              stroke={wickColor}
              strokeWidth={wickWidth}
            />

            {/* Body */}
            <Rect
              x={candle.bodyX}
              y={candle.bodyY}
              width={candle.bodyWidth}
              height={candle.bodyHeight}
              fill={candle.bodyColor}
              fillOpacity={candle.bodyOpacity}
              stroke={candle.bodyColor}
              strokeWidth={0.5}
            />
          </React.Fragment>
        ))}

        {/* Moving Average */}
        {showMovingAverage && movingAveragePath && (
          <Path
            d={movingAveragePath}
            stroke={maColor}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}
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
