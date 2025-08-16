import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Svg, Path, Defs, LinearGradient, Stop } from "react-native-svg";

interface DataPoint {
  time: number;
  close: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  strokeWidth?: number;
  extraSeries?: { data: DataPoint[]; color?: string; strokeWidth?: number }[];
  showFill?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");

export default function SimpleLineChart({
  data,
  height = 200,
  color = "#00D4AA",
  strokeWidth = 2,
  extraSeries = [],
  showFill = true,
}: SimpleLineChartProps) {
  if (!data || data.length === 0) {
    return <View style={[styles.container, { height }]} />;
  }

  const chartWidth = screenWidth - 32; // Account for margins
  const chartHeight = height;

  // Calculate min/max for scaling across all series
  const prices = [
    ...data.map((d) => d.close),
    ...extraSeries.flatMap((s) => s.data.map((d) => d.close)),
  ];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  // Create path points for primary
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * chartWidth;
    const y =
      chartHeight - ((point.close - minPrice) / priceRange) * chartHeight;
    return { x, y };
  });

  // Generate SVG path
  const pathData = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M${point.x},${point.y}`;
    }
    return `${path} L${point.x},${point.y}`;
  }, "");

  // Generate gradient fill path
  const fillPathData = `${pathData} L${chartWidth},${chartHeight} L0,${chartHeight} Z`;

  // Build paths for extra series
  const extraPaths = extraSeries.map((series) => {
    if (!series.data || series.data.length === 0) return "";
    const pts = series.data.map((point, index) => {
      const x = (index / (series.data.length - 1)) * chartWidth;
      const y =
        chartHeight - ((point.close - minPrice) / priceRange) * chartHeight;
      return { x, y };
    });
    const p = pts.reduce(
      (path, pt, idx) =>
        idx === 0 ? `M${pt.x},${pt.y}` : `${path} L${pt.x},${pt.y}`,
      ""
    );
    return p;
  });

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Gradient fill */}
        {showFill && <Path d={fillPathData} fill="url(#gradient)" />}

        {/* Extra series (behind for visibility) */}
        {extraPaths.map((p, idx) => (
          <Path
            key={`extra-${idx}`}
            d={p}
            stroke={extraSeries[idx].color || "#6EA8FE"}
            strokeWidth={extraSeries[idx].strokeWidth || 2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        ))}

        {/* Primary line */}
        <Path
          d={pathData}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
