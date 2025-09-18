import React from "react";
import { View, Text, StyleSheet } from "react-native";

export interface StockPriceSummaryProps {
  displayPrice: number | null | undefined;
  todayChange?: number | null;
  todayChangePercent?: number | null;
  showAfterHours?: boolean;
  afterHoursDiff?: number | null;
  afterHoursPct?: number | null;
  showPreMarket?: boolean;
}

export function StockPriceSummary({
  displayPrice,
  todayChange,
  todayChangePercent,
  showAfterHours,
  afterHoursDiff,
  afterHoursPct,
  showPreMarket,
}: StockPriceSummaryProps) {
  const priceValue =
    typeof displayPrice === "number" && isFinite(displayPrice)
      ? `$${displayPrice.toFixed(2)}`
      : "--";

  const showTodayChange =
    typeof todayChange === "number" && typeof todayChangePercent === "number";

  const showAfterHoursRow =
    showAfterHours &&
    afterHoursDiff !== null &&
    afterHoursDiff !== undefined &&
    afterHoursPct !== null &&
    afterHoursPct !== undefined;

  return (
    <View style={styles.priceRow}>
      <Text style={styles.mainPrice}>{priceValue}</Text>

      {showTodayChange && (
        <Text
          style={[
            styles.todayChange,
            { color: (todayChange as number) >= 0 ? "#00D4AA" : "#FF6B6B" },
          ]}
        >
          {(todayChange as number) >= 0 ? "+" : ""}${
            (todayChange as number).toFixed(2)
          } ({(todayChangePercent as number).toFixed(2)}%) Today
        </Text>
      )}

      {showAfterHoursRow && (
        <Text
          style={[
            styles.afterHours,
            { color: (afterHoursDiff as number) >= 0 ? "#00D4AA" : "#FF6B6B" },
          ]}
        >
          {`After: ${
            typeof displayPrice === "number" && isFinite(displayPrice)
              ? displayPrice.toFixed(2)
              : "--"
          } ${
            (afterHoursDiff as number) >= 0 ? "+" : ""
          }${(afterHoursDiff as number).toFixed(2)} ${
            (afterHoursPct as number) >= 0 ? "+" : ""
          }${(afterHoursPct as number).toFixed(2)}%`}
        </Text>
      )}

      {showPreMarket && (
        <Text style={[styles.afterHours, { color: "#3b82f6" }]}>Pre-market</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    alignItems: "flex-start",
  },
  mainPrice: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  todayChange: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  afterHours: {
    fontSize: 13,
    color: "#888",
  },
});

export default StockPriceSummary;

