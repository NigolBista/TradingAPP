import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import FastAreaChart from "./FastAreaChart";
import FastLineChart from "./FastLineChart";

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

  // Transform data to match FastChart format
  const chartData = data.map((point) => ({
    time: point.time,
    value: point.close,
  }));

  // Transform extra series data
  const extraSeriesData = extraSeries.map((series) => ({
    data: series.data.map((point) => ({
      time: point.time,
      value: point.close,
    })),
    color: series.color || "#6EA8FE",
    strokeWidth: series.strokeWidth || 2,
  }));

  // Use FastAreaChart if showFill is true, otherwise use FastLineChart
  if (showFill) {
    return (
      <View style={[styles.container, { height }]}>
        <FastAreaChart
          data={chartData}
          width={chartWidth}
          height={height}
          color={color}
          strokeWidth={strokeWidth}
          fillOpacity={0.3}
          showLine={true}
          showDots={false}
          style={{ backgroundColor: "transparent" }}
        />

        {/* Render extra series as line charts on top */}
        {extraSeriesData.map((series, index) => (
          <View
            key={`extra-${index}`}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "transparent" },
            ]}
          >
            <FastLineChart
              data={series.data}
              width={chartWidth}
              height={height}
              color={series.color}
              strokeWidth={series.strokeWidth}
              showDots={false}
              style={{ backgroundColor: "transparent" }}
            />
          </View>
        ))}
      </View>
    );
  }

  // Use FastLineChart for line-only charts
  return (
    <View style={[styles.container, { height }]}>
      <FastLineChart
        data={chartData}
        width={chartWidth}
        height={height}
        color={color}
        strokeWidth={strokeWidth}
        showDots={false}
        style={{ backgroundColor: "transparent" }}
      />

      {/* Render extra series as line charts on top */}
      {extraSeriesData.map((series, index) => (
        <View
          key={`extra-${index}`}
          style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
        >
          <FastLineChart
            data={series.data}
            width={chartWidth}
            height={height}
            color={series.color}
            strokeWidth={series.strokeWidth}
            showDots={false}
            style={{ backgroundColor: "transparent" }}
          />
        </View>
      ))}
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
