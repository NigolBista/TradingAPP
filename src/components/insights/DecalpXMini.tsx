import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppDataStore } from "../../store/appDataStore";
import { useTheme } from "../../providers/ThemeProvider";

const DecalpXMini = React.memo(function DecalpXMini() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // Memoize the navigation function to prevent re-renders
  const handlePress = useCallback(() => {
    navigation.navigate("DecalpX" as never);
  }, [navigation]);
  // Use centralized store instead of old marketOverviewStore
  const { getMarketOverview, getSentimentSummary, getNewsSentimentCounts } =
    useAppDataStore();
  const overview1d = getMarketOverview("1D");

  // Get sentiment and counts from centralized store
  const sentimentSummary = getSentimentSummary();
  const counts = getNewsSentimentCounts();

  const total = counts.positive + counts.negative + counts.neutral || 1;
  const posRatio = counts.positive / total;
  const negRatio = counts.negative / total;

  // Enhanced metrics with oversold/momentum indicators
  const volScore = Math.min(
    100,
    (overview1d?.upcomingEvents?.length || 0) * 10 +
      (overview1d?.keyHighlights?.length || 0) * 5
  );
  const trendHeat = Math.min(
    100,
    (overview1d?.trendingStocks?.length || 0) * 12
  );
  const signalStrength = Math.min(
    100,
    (overview1d?.keyHighlights?.length || 0) * 12 + Math.round(posRatio * 20)
  );

  // Enhanced indicators: Oversold and Momentum with better calculations
  const rsi = Math.max(0, Math.min(100, 50 + (posRatio - 0.5) * 100));
  const oversoldLevel = rsi < 30 ? 100 - rsi : Math.max(0, 70 - rsi);
  const momentumScore = Math.min(
    100,
    Math.abs(posRatio - 0.5) * 200 + trendHeat * 0.4 + volScore * 0.2
  );

  // Enhanced timeframe bullish signals with momentum consideration
  const bullishSignals = {
    day: posRatio > 0.6 && volScore < 60 && momentumScore > 30,
    swing: posRatio > 0.55 && trendHeat > 40 && oversoldLevel < 70,
    longterm: posRatio > 0.52 && signalStrength > 50 && momentumScore > 25,
  };

  // Market condition assessment
  const marketCondition =
    oversoldLevel > 70
      ? "OVERSOLD"
      : momentumScore > 80
      ? "MOMENTUM"
      : signalStrength > 75
      ? "STRONG"
      : "NEUTRAL";

  const styles = createStyles(theme);

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>DecalpX Pro</Text>
          <Text style={styles.marketCondition}>{marketCondition}</Text>
        </View>
        <View style={styles.badgeContainer}>
          <View
            style={[
              styles.badge,
              sentimentSummary?.overall === "bullish"
                ? styles.badgeBull
                : sentimentSummary?.overall === "bearish"
                ? styles.badgeBear
                : styles.badgeNeutral,
            ]}
          >
            <Ionicons
              name={
                sentimentSummary?.overall === "bullish"
                  ? "trending-up"
                  : sentimentSummary?.overall === "bearish"
                  ? "trending-down"
                  : "remove"
              }
              color="#fff"
              size={10}
            />
            <Text style={styles.badgeText}>
              {sentimentSummary
                ? `${Math.round(sentimentSummary.confidence)}%`
                : "--%"}
            </Text>
          </View>
          {/* Condensed timeframe bullish indicators */}
          <View style={styles.timeframeBadges}>
            {(bullishSignals.day ||
              bullishSignals.swing ||
              bullishSignals.longterm) && (
              <View style={styles.timeframeBadge}>
                <Text style={styles.timeframeText}>
                  {[
                    bullishSignals.day && "D",
                    bullishSignals.swing && "S",
                    bullishSignals.longterm && "L",
                  ]
                    .filter(Boolean)
                    .join("")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Most important condensed metrics */}
      <View style={styles.keyMetricsRow}>
        <CompactMetric
          label="O/S"
          value={oversoldLevel}
          suffix={oversoldLevel > 70 ? "!" : ""}
          color={
            oversoldLevel > 70
              ? "#ef4444"
              : oversoldLevel > 40
              ? "#f59e0b"
              : "#10b981"
          }
          styles={styles}
        />
        <CompactMetric
          label="Mom"
          value={momentumScore}
          suffix={momentumScore > 80 ? "🚀" : ""}
          color={
            momentumScore > 70
              ? "#10b981"
              : momentumScore > 40
              ? "#f59e0b"
              : "#6b7280"
          }
          styles={styles}
        />
        <CompactMetric
          label="Sig"
          value={signalStrength}
          suffix={signalStrength > 75 ? "⭐" : ""}
          color={
            signalStrength > 70
              ? "#10b981"
              : signalStrength > 40
              ? "#f59e0b"
              : "#ef4444"
          }
          styles={styles}
        />
        <CompactMetric
          label="RSI"
          value={Math.round(rsi)}
          suffix={rsi < 30 ? "📉" : rsi > 70 ? "📈" : ""}
          color={
            rsi < 30 || rsi > 70
              ? "#ef4444"
              : rsi < 40 || rsi > 60
              ? "#f59e0b"
              : "#10b981"
          }
          styles={styles}
        />
      </View>
    </Pressable>
  );
});

export default DecalpXMini;

function CompactMetric({
  label,
  value,
  color,
  suffix = "",
  styles,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  styles: any;
}) {
  return (
    <View style={styles.compactMetric}>
      <Text style={styles.compactLabel}>{label}</Text>
      <View style={styles.compactValueRow}>
        <Text style={[styles.compactValue, { color }]}>
          {Math.round(value)}
        </Text>
        {suffix && <Text style={styles.compactSuffix}>{suffix}</Text>}
      </View>
      <View style={styles.compactBar}>
        <View
          style={[
            styles.compactFill,
            {
              width: `${Math.min(100, Math.max(0, value))}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.blueTransparent,
      borderRadius: 12,
      padding: 16,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    titleContainer: {
      flexDirection: "column",
    },
    title: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
    marketCondition: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: "600",
      marginTop: 2,
    },
    badgeContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeBull: { backgroundColor: "#16a34a" },
    badgeBear: { backgroundColor: "#dc2626" },
    badgeNeutral: { backgroundColor: "#6b7280" },
    badgeText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
    timeframeBadges: {
      flexDirection: "row",
    },
    timeframeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: "#10b981",
      alignItems: "center",
      justifyContent: "center",
    },
    timeframeText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "700",
    },
    keyMetricsRow: {
      flexDirection: "row",
      gap: 8,
    },
    compactMetric: {
      flex: 1,
      alignItems: "center",
    },
    compactLabel: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontWeight: "600",
      marginBottom: 3,
    },
    compactValueRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 3,
    },
    compactValue: {
      fontSize: 14,
      fontWeight: "700",
    },
    compactSuffix: {
      fontSize: 10,
      marginLeft: 2,
    },
    compactBar: {
      width: "100%",
      height: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: 2,
    },
    compactFill: {
      height: 4,
      borderRadius: 2,
    },
  });
