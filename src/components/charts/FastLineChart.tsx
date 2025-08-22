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

interface FastLineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  dotSize?: number;
  animated?: boolean;
  style?: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function FastLineChart({
  data,
  width = screenWidth - 32,
  height = 200,
  color = "#00D4AA",
  strokeWidth = 2,
  showDots = false,
  dotSize = 4,
  animated = false,
  style,
}: FastLineChartProps) {
  // Memoize all calculations for maximum performance
  const { pathData, points, minValue, maxValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathData: "", points: [], minValue: 0, maxValue: 0 };
    }

    // Calculate min/max values
    const values = data.map((d) => d.value).filter((v) => Number.isFinite(v));
    if (values.length === 0) {
      return { pathData: "", points: [], minValue: 0, maxValue: 0 };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = Math.max(maxVal - minVal, 0.01); // Prevent division by zero

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
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    // Generate optimized SVG path
    let path = "";
    if (chartPoints.length > 0) {
      path = `M${chartPoints[0].x},${chartPoints[0].y}`;
      for (let i = 1; i < chartPoints.length; i++) {
        path += ` L${chartPoints[i].x},${chartPoints[i].y}`;
      }
    }

    return {
      pathData: path,
      points: chartPoints,
      minValue: minVal,
      maxValue: maxVal,
    };
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return <View style={[styles.container, { width, height }, style]} />;
  }

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Main line path */}
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
              fill={color}
              opacity={0.8}
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
