import React, { useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import {
  Svg,
  Rect,
  Line,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from "react-native-svg";
import {
  PanGestureHandler,
  PinchGestureHandler,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface EnhancedCandlestickChartProps {
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
  showGrid?: boolean;
  gridColor?: string;
  priceScaleWidth?: number;
  timeScaleHeight?: number;
  onPanLeft?: () => void; // Callback for loading more historical data
  onPanRight?: () => void; // Callback for loading more recent data
  style?: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function EnhancedCandlestickChart({
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
  showGrid = true,
  gridColor = "#374151",
  priceScaleWidth = 60,
  timeScaleHeight = 30,
  onPanLeft,
  onPanRight,
  style,
}: EnhancedCandlestickChartProps) {
  // Gesture state
  const [translateX, setTranslateX] = useState(0);
  const [scale, setScale] = useState(1);
  const [baseTranslateX, setBaseTranslateX] = useState(0);
  const [baseScale, setBaseScale] = useState(1);
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);

  // Chart dimensions
  const chartWidth = width - priceScaleWidth;
  const chartHeight = height - timeScaleHeight;
  const actualVolumeHeight = showVolume ? volumeHeight : 0;
  const priceChartHeight = chartHeight - actualVolumeHeight;

  // Memoize chart calculations
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        candles: [],
        volumes: [],
        movingAverage: [],
        priceMin: 0,
        priceMax: 0,
        volumeMax: 0,
        timeMin: 0,
        timeMax: 0,
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
        timeMin: 0,
        timeMax: 0,
      };
    }

    // Calculate price and time ranges
    const prices = validData.flatMap((d) => [d.open, d.high, d.low, d.close]);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const priceRange = Math.max(priceMax - priceMin, 0.01);

    const times = validData.map((d) => d.time);
    const timeMin = Math.min(...times);
    const timeMax = Math.max(...times);

    // Calculate volume range
    let volumeMax = 0;
    if (showVolume) {
      const volumes = validData.map((d) => d.volume || 0).filter((v) => v > 0);
      volumeMax = volumes.length > 0 ? Math.max(...volumes) : 0;
    }

    // Calculate spacing
    const candleSpacing = chartWidth / Math.max(validData.length, 1);
    const actualCandleWidth = Math.min(candleWidth, candleSpacing * 0.8);

    // Calculate moving average
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
            priceChartHeight -
            ((average - priceMin) / priceRange) * priceChartHeight;

          return { x, y };
        })
        .filter(Boolean) as { x: number; y: number }[];
    }

    // Generate candle elements
    const candles = validData.map((candle, index) => {
      const x = (index + 0.5) * candleSpacing;
      const centerX = x;

      // Calculate Y positions
      const openY =
        priceChartHeight -
        ((candle.open - priceMin) / priceRange) * priceChartHeight;
      const closeY =
        priceChartHeight -
        ((candle.close - priceMin) / priceRange) * priceChartHeight;
      const highY =
        priceChartHeight -
        ((candle.high - priceMin) / priceRange) * priceChartHeight;
      const lowY =
        priceChartHeight -
        ((candle.low - priceMin) / priceRange) * priceChartHeight;

      const isBullish = candle.close >= candle.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

      return {
        wickX: centerX,
        wickY1: highY,
        wickY2: lowY,
        bodyX: centerX - actualCandleWidth / 2,
        bodyY: bodyTop,
        bodyWidth: actualCandleWidth,
        bodyHeight,
        bodyColor: isBullish ? bullishColor : bearishColor,
        bodyOpacity: isBullish ? 0.8 : 1,
        isBullish,
        candle,
      };
    });

    // Generate volume bars
    const volumes =
      showVolume && volumeMax > 0
        ? validData
            .map((candle, index) => {
              const volume = candle.volume || 0;
              if (volume <= 0) return null;

              const x = (index + 0.5) * candleSpacing;
              const barHeight = (volume / volumeMax) * actualVolumeHeight;
              const barY = priceChartHeight + actualVolumeHeight - barHeight;

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
      timeMin,
      timeMax,
    };
  }, [
    data,
    chartWidth,
    priceChartHeight,
    candleWidth,
    showVolume,
    actualVolumeHeight,
    showMovingAverage,
    maPeriod,
  ]);

  // Generate price scale labels
  const priceLabels = useMemo(() => {
    if (chartData.priceMin === chartData.priceMax) return [];

    const priceRange = chartData.priceMax - chartData.priceMin;
    const labelCount = 8;
    const labels = [];

    for (let i = 0; i <= labelCount; i++) {
      const price = chartData.priceMin + (priceRange * i) / labelCount;
      const y = priceChartHeight - (i / labelCount) * priceChartHeight;
      labels.push({ price, y });
    }

    return labels;
  }, [chartData.priceMin, chartData.priceMax, priceChartHeight]);

  // Generate time scale labels
  const timeLabels = useMemo(() => {
    if (!data || data.length === 0) return [];

    const labelCount = 6;
    const labels = [];

    for (let i = 0; i <= labelCount; i++) {
      const index = Math.floor(((data.length - 1) * i) / labelCount);
      const candle = data[index];
      if (candle) {
        const x = (index + 0.5) * (chartWidth / data.length);
        const time = new Date(candle.time);
        const timeStr = time.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        labels.push({ time: timeStr, x });
      }
    }

    return labels;
  }, [data, chartWidth]);

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines = [];

    // Horizontal grid lines (price levels)
    priceLabels.forEach((label) => {
      lines.push({
        type: "horizontal",
        x1: 0,
        y1: label.y,
        x2: chartWidth,
        y2: label.y,
      });
    });

    // Vertical grid lines (time levels)
    timeLabels.forEach((label) => {
      lines.push({
        type: "vertical",
        x1: label.x,
        y1: 0,
        x2: label.x,
        y2: chartHeight,
      });
    });

    return lines;
  }, [priceLabels, timeLabels, chartWidth, chartHeight]);

  // Pan gesture handler
  const handlePanGestureEvent = (event: any) => {
    const { translationX } = event.nativeEvent;
    const newTranslateX = baseTranslateX + translationX;
    setTranslateX(newTranslateX);
    console.log("Pan active:", newTranslateX);
  };

  const handlePanStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      console.log("Pan started");
    } else if (event.nativeEvent.state === State.END) {
      const translation = event.nativeEvent.translationX;
      const finalTranslateX = baseTranslateX + translation;
      console.log(
        "Pan ended:",
        translation,
        "Final position:",
        finalTranslateX
      );

      // If panning left significantly, load more historical data
      if (Math.abs(translation) > 100) {
        if (translation > 0 && onPanLeft) {
          onPanLeft();
        } else if (translation < 0 && onPanRight) {
          onPanRight();
        }
      }

      // Update base position to maintain the pan
      setBaseTranslateX(finalTranslateX);
      setTranslateX(finalTranslateX);
    }
  };

  // Pinch gesture handler
  const handlePinchGestureEvent = (event: any) => {
    const { scale: eventScale } = event.nativeEvent;
    const newScale = Math.max(0.5, Math.min(5, baseScale * eventScale));
    setScale(newScale);
    console.log("Pinch active:", newScale);
  };

  const handlePinchStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      console.log("Pinch started");
    } else if (event.nativeEvent.state === State.END) {
      console.log("Pinch ended, scale:", scale);
      // Update base scale to maintain the zoom
      setBaseScale(scale);
    }
  };

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
    <GestureHandlerRootView
      style={[styles.container, { width, height }, style]}
    >
      <View style={styles.chartWrapper}>
        {/* Main Chart Area */}
        <View style={styles.mainChart}>
          <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={handlePinchGestureEvent}
            onHandlerStateChange={handlePinchStateChange}
            simultaneousHandlers={panRef}
          >
            <View style={styles.gestureContainer}>
              <PanGestureHandler
                ref={panRef}
                onGestureEvent={handlePanGestureEvent}
                onHandlerStateChange={handlePanStateChange}
                simultaneousHandlers={pinchRef}
                minPointers={1}
                maxPointers={1}
              >
                <View style={[{ width: chartWidth, height: chartHeight }]}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient
                        id="volumeGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <Stop
                          offset="0%"
                          stopColor={volumeColor}
                          stopOpacity="0.6"
                        />
                        <Stop
                          offset="100%"
                          stopColor={volumeColor}
                          stopOpacity="0.2"
                        />
                      </LinearGradient>
                    </Defs>

                    {/* Grid lines */}
                    {showGrid &&
                      gridLines.map((line, index) => (
                        <Line
                          key={index}
                          x1={line.x1}
                          y1={line.y1}
                          x2={line.x2}
                          y2={line.y2}
                          stroke={gridColor}
                          strokeWidth={0.5}
                          opacity={0.3}
                        />
                      ))}

                    {/* Chart content with transform */}
                    <G
                      transform={`translate(${translateX}, 0) scale(${scale}, 1)`}
                    >
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
                          y1={priceChartHeight}
                          x2={chartWidth}
                          y2={priceChartHeight}
                          stroke={gridColor}
                          strokeWidth={0.5}
                          opacity={0.5}
                        />
                      )}

                      {/* Candlesticks */}
                      {chartData.candles.map((candle, index) => (
                        <G key={`candle-${index}`}>
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
                        </G>
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
                    </G>
                  </Svg>
                </View>
              </PanGestureHandler>
            </View>
          </PinchGestureHandler>
        </View>

        {/* Price Scale */}
        <View
          style={[
            styles.priceScale,
            { width: priceScaleWidth, height: chartHeight },
          ]}
        >
          {priceLabels.map((label, index) => (
            <View key={index} style={[styles.priceLabel, { top: label.y - 8 }]}>
              <Text style={styles.priceLabelText}>
                ${label.price.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Time Scale */}
      <View style={[styles.timeScale, { width, height: timeScaleHeight }]}>
        <View
          style={{
            width: chartWidth,
            height: timeScaleHeight,
            flexDirection: "row",
          }}
        >
          {timeLabels.map((label, index) => (
            <View
              key={index}
              style={[styles.timeLabel, { left: label.x - 20 }]}
            >
              <Text style={styles.timeLabelText}>{label.time}</Text>
            </View>
          ))}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  chartWrapper: {
    flexDirection: "row",
  },
  mainChart: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  priceScale: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderLeftWidth: 1,
    borderLeftColor: "#374151",
    position: "relative",
  },
  priceLabel: {
    position: "absolute",
    right: 4,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  priceLabelText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  timeScale: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    position: "relative",
  },
  timeLabel: {
    position: "absolute",
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    top: 4,
  },
  timeLabelText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
