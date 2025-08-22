import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Svg, Line, Text as SvgText } from "react-native-svg";

interface TradePlanOverlayProps {
  width: number;
  height: number;
  data: Array<{ time: number; close: number; high: number; low: number }>;
  tradePlan?: {
    entry?: number;
    lateEntry?: number;
    exit?: number;
    lateExit?: number;
    stop?: number;
    targets?: number[];
    side?: "long" | "short";
  };
  levels?: {
    entry?: number;
    entryExtended?: number;
    exit?: number;
    exitExtended?: number;
  };
}

export default function TradePlanOverlay({
  width,
  height,
  data,
  tradePlan,
  levels,
}: TradePlanOverlayProps) {
  if ((!tradePlan && !levels) || !data || data.length === 0) {
    return null;
  }

  // Calculate price range for positioning
  const prices = data.flatMap((d) => [d.high, d.low, d.close]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = Math.max(maxPrice - minPrice, 0.01);

  // Helper function to convert price to Y coordinate
  const priceToY = (price: number) => {
    return height - ((price - minPrice) / priceRange) * height;
  };

  // Combine levels from both sources
  const allLevels = {
    entry: tradePlan?.entry || levels?.entry,
    lateEntry: tradePlan?.lateEntry || levels?.entryExtended,
    exit: tradePlan?.exit || levels?.exit,
    lateExit: tradePlan?.lateExit || levels?.exitExtended,
    stop: tradePlan?.stop,
    targets: tradePlan?.targets,
  };

  const levelLines = [];

  // Entry levels
  if (allLevels.entry) {
    const y = priceToY(allLevels.entry);
    levelLines.push({
      y,
      price: allLevels.entry,
      label: "Entry",
      color: "#10B981",
    });
  }

  if (allLevels.lateEntry) {
    const y = priceToY(allLevels.lateEntry);
    levelLines.push({
      y,
      price: allLevels.lateEntry,
      label: "Late Entry",
      color: "#14b8a6",
    });
  }

  // Exit levels
  if (allLevels.exit) {
    const y = priceToY(allLevels.exit);
    levelLines.push({
      y,
      price: allLevels.exit,
      label: "Exit",
      color: "#EF4444",
    });
  }

  if (allLevels.lateExit) {
    const y = priceToY(allLevels.lateExit);
    levelLines.push({
      y,
      price: allLevels.lateExit,
      label: "Late Exit",
      color: "#F97316",
    });
  }

  // Stop loss
  if (allLevels.stop) {
    const y = priceToY(allLevels.stop);
    levelLines.push({
      y,
      price: allLevels.stop,
      label: "Stop",
      color: "#DC2626",
    });
  }

  // Targets
  if (allLevels.targets && allLevels.targets.length > 0) {
    allLevels.targets.forEach((target, index) => {
      const y = priceToY(target);
      levelLines.push({
        y,
        price: target,
        label: `T${index + 1}`,
        color: "#8B5CF6",
      });
    });
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Svg width={width} height={height}>
        {levelLines.map((level, index) => (
          <React.Fragment key={index}>
            {/* Horizontal line */}
            <Line
              x1={0}
              y1={level.y}
              x2={width}
              y2={level.y}
              stroke={level.color}
              strokeWidth={1}
              strokeDasharray="5,5"
              opacity={0.8}
            />

            {/* Price label */}
            <SvgText
              x={width - 80}
              y={level.y - 4}
              fontSize={11}
              fill={level.color}
              fontWeight="600"
              textAnchor="start"
            >
              {level.label}: ${level.price.toFixed(2)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
