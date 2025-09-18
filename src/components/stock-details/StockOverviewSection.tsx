import React from "react";
import { View, Text, StyleSheet } from "react-native";

import StockPriceSummary from "./StockPriceSummary";

export interface StockOverviewSectionProps {
  currentPrice: number;
  todayChange: number | null;
  todayChangePercent: number | null;
  symbolSentimentSummary:
    | {
        overall: "bullish" | "bearish" | "neutral";
        confidence: number;
      }
    | null;
  symbolSentimentCounts:
    | {
        positive: number;
        neutral: number;
        negative: number;
      }
    | null;
  analysis: {
    signals?: Array<{ action: string; type: string }>;
  } | null;
  displayPrice: number | null;
  showAfterHours: boolean;
  afterHoursDiff: number | null;
  afterHoursPct: number | null;
  showPreMarket: boolean;
}

export const StockOverviewSection = React.memo(function StockOverviewSection({
  currentPrice,
  todayChange,
  todayChangePercent,
  symbolSentimentSummary,
  symbolSentimentCounts,
  analysis,
  displayPrice,
  showAfterHours,
  afterHoursDiff,
  afterHoursPct,
  showPreMarket,
}: StockOverviewSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Market Overview</Text>
      </View>

      <View style={{ padding: 16 }}>
        <View style={styles.priceSummaryRow}>
          <StockPriceSummary
            displayPrice={displayPrice}
            todayChange={todayChange}
            todayChangePercent={todayChangePercent}
            showAfterHours={showAfterHours}
            afterHoursDiff={afterHoursDiff}
            afterHoursPct={afterHoursPct}
            showPreMarket={showPreMarket}
          />

          {symbolSentimentSummary && (
            <View style={styles.sentimentSummaryContainer}>
              <Text style={styles.sentimentLabel}>Sentiment</Text>
              <Text
                style={[
                  styles.sentimentValue,
                  symbolSentimentSummary.overall === "bullish"
                    ? styles.sentimentBullish
                    : symbolSentimentSummary.overall === "bearish"
                    ? styles.sentimentBearish
                    : styles.sentimentNeutral,
                ]}
              >
                {symbolSentimentSummary.overall} (
                {symbolSentimentSummary.confidence}%)
              </Text>
            </View>
          )}
        </View>

        {analysis && analysis.signals && analysis.signals.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.subsectionTitle}>Technical Analysis</Text>
            <View style={styles.signalsRow}>
              {analysis.signals.slice(0, 3).map((signal, index) => (
                <View
                  key={`${signal.type}-${signal.action}-${index}`}
                  style={[
                    styles.signalBadge,
                    signal.action === "buy"
                      ? styles.signalBadgeBuy
                      : styles.signalBadgeSell,
                  ]}
                >
                  <Text
                    style={[
                      styles.signalText,
                      signal.action === "buy"
                        ? styles.signalTextBuy
                        : styles.signalTextSell,
                    ]}
                  >
                    {signal.type.toUpperCase()} {signal.action.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {symbolSentimentCounts && (
          <View>
            <Text style={styles.subsectionTitle}>News Sentiment</Text>
            <View style={styles.sentimentCountsRow}>
              <View style={styles.sentimentCountItem}>
                <Text style={styles.sentimentCountPositive}>
                  {symbolSentimentCounts.positive}
                </Text>
                <Text style={styles.sentimentCountLabel}>Positive</Text>
              </View>
              <View style={styles.sentimentCountItem}>
                <Text style={styles.sentimentCountNeutral}>
                  {symbolSentimentCounts.neutral}
                </Text>
                <Text style={styles.sentimentCountLabel}>Neutral</Text>
              </View>
              <View style={styles.sentimentCountItem}>
                <Text style={styles.sentimentCountNegative}>
                  {symbolSentimentCounts.negative}
                </Text>
                <Text style={styles.sentimentCountLabel}>Negative</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginVertical: 6,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#111",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  priceSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sentimentSummaryContainer: {
    alignItems: "flex-end",
    flex: 1,
    marginLeft: 16,
  },
  sentimentLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  sentimentValue: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  sentimentBullish: {
    color: "#10B981",
  },
  sentimentBearish: {
    color: "#EF4444",
  },
  sentimentNeutral: {
    color: "#9CA3AF",
  },
  subsectionTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  signalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  signalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  signalBadgeBuy: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  signalBadgeSell: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  signalText: {
    fontSize: 11,
    fontWeight: "600",
  },
  signalTextBuy: {
    color: "#10B981",
  },
  signalTextSell: {
    color: "#EF4444",
  },
  sentimentCountsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sentimentCountItem: {
    alignItems: "center",
  },
  sentimentCountPositive: {
    color: "#10B981",
    fontSize: 18,
    fontWeight: "700",
  },
  sentimentCountNeutral: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "700",
  },
  sentimentCountNegative: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "700",
  },
  sentimentCountLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
});

export default StockOverviewSection;

