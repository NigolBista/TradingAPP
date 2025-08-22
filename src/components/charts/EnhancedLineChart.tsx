import React, { useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import {
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
} from "react-native-svg";
import {
  PanGestureHandler,
  PinchGestureHandler,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";

interface DataPoint {
  time: number;
  value: number;
}

interface EnhancedLineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  dotSize?: number;
  showArea?: boolean;
  areaOpacity?: number;
  showGrid?: boolean;
  gridColor?: string;
  priceScaleWidth?: number;
  timeScaleHeight?: number;
  onPanLeft?: () => void;
  onPanRight?: () => void;
  style?: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function EnhancedLineChart({
  data,
  width = screenWidth - 32,
  height = 200,
  color = "#00D4AA",
  strokeWidth = 2,
  showDots = false,
  dotSize = 4,
  showArea = false,
  areaOpacity = 0.3,
  showGrid = true,
  gridColor = "#374151",
  priceScaleWidth = 60,
  timeScaleHeight = 30,
  onPanLeft,
  onPanRight,
  style,
}: EnhancedLineChartProps) {
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

  // Memoize all calculations for maximum performance
  const { pathData, areaPath, points, minValue, maxValue, isPositive } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          pathData: "",
          areaPath: "",
          points: [],
          minValue: 0,
          maxValue: 0,
          isPositive: true,
        };
      }

      // Calculate min/max values
      const values = data.map((d) => d.value).filter((v) => Number.isFinite(v));
      if (values.length === 0) {
        return {
          pathData: "",
          areaPath: "",
          points: [],
          minValue: 0,
          maxValue: 0,
          isPositive: true,
        };
      }

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = Math.max(maxVal - minVal, 0.01);

      // Determine if trend is positive (for color selection)
      const firstValue = data[0]?.value || 0;
      const lastValue = data[data.length - 1]?.value || 0;
      const positive = lastValue >= firstValue;

      // Calculate points with optimized scaling
      const chartPoints = data
        .map((point, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * chartWidth;
          const normalizedValue = Number.isFinite(point.value)
            ? point.value
            : minVal;
          const y =
            chartHeight - ((normalizedValue - minVal) / range) * chartHeight;

          return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : chartHeight,
            value: point.value,
            time: point.time,
          };
        })
        .filter(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        );

      // Generate line path
      let line = "";
      if (chartPoints.length > 0) {
        line = `M${chartPoints[0].x},${chartPoints[0].y}`;
        for (let i = 1; i < chartPoints.length; i++) {
          line += ` L${chartPoints[i].x},${chartPoints[i].y}`;
        }
      }

      // Generate area path (line + bottom fill)
      let area = "";
      if (showArea && chartPoints.length > 0) {
        area = line;
        // Close the path by drawing to bottom corners
        area += ` L${chartPoints[chartPoints.length - 1].x},${chartHeight}`;
        area += ` L${chartPoints[0].x},${chartHeight}`;
        area += " Z";
      }

      return {
        pathData: line,
        areaPath: area,
        points: chartPoints,
        minValue: minVal,
        maxValue: maxVal,
        isPositive: positive,
      };
    }, [data, chartWidth, chartHeight, showArea]);

  // Generate price scale labels
  const priceLabels = useMemo(() => {
    if (minValue === maxValue) return [];

    const priceRange = maxValue - minValue;
    const labelCount = 6;
    const labels = [];

    for (let i = 0; i <= labelCount; i++) {
      const price = minValue + (priceRange * i) / labelCount;
      const y = chartHeight - (i / labelCount) * chartHeight;
      labels.push({ price, y });
    }

    return labels;
  }, [minValue, maxValue, chartHeight]);

  // Generate time scale labels
  const timeLabels = useMemo(() => {
    if (!data || data.length === 0) return [];

    const labelCount = 5;
    const labels = [];

    for (let i = 0; i <= labelCount; i++) {
      const index = Math.floor(((data.length - 1) * i) / labelCount);
      const point = data[index];
      if (point) {
        const x = (index / Math.max(data.length - 1, 1)) * chartWidth;
        const time = new Date(point.time);
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

    // Horizontal grid lines
    priceLabels.forEach((label) => {
      lines.push({
        x1: 0,
        y1: label.y,
        x2: chartWidth,
        y2: label.y,
      });
    });

    // Vertical grid lines
    timeLabels.forEach((label) => {
      lines.push({
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

  // Dynamic color selection based on trend
  const dynamicColor = useMemo(() => {
    if (color !== "#00D4AA") return color;
    return isPositive ? "#16a34a" : "#dc2626";
  }, [color, isPositive]);

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
              >
                <View style={[{ width: chartWidth, height: chartHeight }]}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      {/* Area gradient */}
                      <LinearGradient
                        id="areaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <Stop
                          offset="0%"
                          stopColor={dynamicColor}
                          stopOpacity={areaOpacity}
                        />
                        <Stop
                          offset="100%"
                          stopColor={dynamicColor}
                          stopOpacity={0.05}
                        />
                      </LinearGradient>

                      {/* Line gradient */}
                      <LinearGradient
                        id="lineGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <Stop
                          offset="0%"
                          stopColor={dynamicColor}
                          stopOpacity="0.8"
                        />
                        <Stop
                          offset="50%"
                          stopColor={dynamicColor}
                          stopOpacity="1"
                        />
                        <Stop
                          offset="100%"
                          stopColor={dynamicColor}
                          stopOpacity="0.8"
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
                      {/* Area fill */}
                      {showArea && (
                        <Path d={areaPath} fill="url(#areaGradient)" />
                      )}

                      {/* Line stroke */}
                      <Path
                        d={pathData}
                        stroke="url(#lineGradient)"
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Optional dots at data points */}
                      {showDots &&
                        points.map((point, index) => (
                          <Circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r={dotSize}
                            fill={dynamicColor}
                            opacity={0.9}
                          />
                        ))}
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
