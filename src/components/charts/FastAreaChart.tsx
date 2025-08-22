import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import {
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";

interface DataPoint {
  time: number;
  value: number;
}

interface FastAreaChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  showLine?: boolean;
  showDots?: boolean;
  dotSize?: number;
  gradientColors?: string[];
  style?: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function FastAreaChart({
  data,
  width = screenWidth - 32,
  height = 200,
  color = "#00D4AA",
  strokeWidth = 2,
  fillOpacity = 0.3,
  showLine = true,
  showDots = false,
  dotSize = 4,
  gradientColors,
  style,
}: FastAreaChartProps) {
  // Memoize all calculations for maximum performance
  const { linePath, areaPath, points, minValue, maxValue, isPositive } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          linePath: "",
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
          linePath: "",
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
          const x = (index / Math.max(data.length - 1, 1)) * width;
          const normalizedValue = Number.isFinite(point.value)
            ? point.value
            : minVal;
          const y = height - ((normalizedValue - minVal) / range) * height;

          return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : height,
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
      if (chartPoints.length > 0) {
        area = line;
        // Close the path by drawing to bottom corners
        area += ` L${chartPoints[chartPoints.length - 1].x},${height}`;
        area += ` L${chartPoints[0].x},${height}`;
        area += " Z";
      }

      return {
        linePath: line,
        areaPath: area,
        points: chartPoints,
        minValue: minVal,
        maxValue: maxVal,
        isPositive: positive,
      };
    }, [data, width, height]);

  // Dynamic color selection based on trend
  const dynamicColor = useMemo(() => {
    if (color !== "#00D4AA") return color; // Use custom color if provided
    return isPositive ? "#16a34a" : "#dc2626"; // Green for positive, red for negative
  }, [color, isPositive]);

  // Gradient colors
  const topColor = gradientColors?.[0] || dynamicColor;
  const bottomColor = gradientColors?.[1] || dynamicColor;

  if (!data || data.length === 0) {
    return <View style={[styles.container, { width, height }, style]} />;
  }

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Area gradient */}
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={topColor} stopOpacity={fillOpacity} />
            <Stop offset="100%" stopColor={bottomColor} stopOpacity={0.05} />
          </LinearGradient>

          {/* Line gradient */}
          <LinearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={dynamicColor} stopOpacity="0.8" />
            <Stop offset="50%" stopColor={dynamicColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={dynamicColor} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGradient)" />

        {/* Line stroke */}
        {showLine && (
          <Path
            d={linePath}
            stroke="url(#lineGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

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
