import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMarketOverviewStore } from "../../store/marketOverviewStore";
import { useTheme } from "../../providers/ThemeProvider";

const DecalpXMini = React.memo(function DecalpXMini() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // Memoize the navigation function to prevent re-renders
  const handlePress = useCallback(() => {
    navigation.navigate("DecalpX" as never);
  }, [navigation]);
  // Select slices individually to keep types and avoid selector/equality overload issues
  const ensureOverview = useMarketOverviewStore((s) => s.ensureOverview);
  const overview1d = useMarketOverviewStore((s) => s.overviewByTf["1D"]);
  const rawNews = useMarketOverviewStore((s) => s.rawNews);

  // Calculate sentiment with memoization to prevent recalculation
  const sentimentSummary = React.useMemo(() => {
    const ov = overview1d;
    if (!ov && !rawNews?.length) return null;
    if ((ov as any)?.marketSentiment) {
      return (ov as any).marketSentiment;
    }
    const news = rawNews || [];
    let positive = 0,
      negative = 0,
      neutral = 0;
    for (const n of news) {
      const sentiment = (n.sentiment || "").toLowerCase();
      if (sentiment === "positive") positive++;
      else if (sentiment === "negative") negative++;
      else neutral++;
    }
    const total = positive + negative + neutral;
    if (total === 0) return null;
    const pos = positive / total;
    const neg = negative / total;
    let overall: "bullish" | "bearish" | "neutral";
    let confidence: number;
    if (pos > 0.6) {
      overall = "bullish";
      confidence = Math.round(pos * 100);
    } else if (neg > 0.6) {
      overall = "bearish";
      confidence = Math.round(neg * 100);
    } else {
      overall = "neutral";
      confidence = Math.round(Math.max(pos, neg) * 100);
    }
    return { overall, confidence };
  }, [overview1d, rawNews]);

  // Memoize the ensure function to prevent unnecessary calls
  const ensureData = useCallback(() => {
    if (!overview1d) {
      ensureOverview("1D").catch(() => {});
    }
  }, [overview1d, ensureOverview]);

  useEffect(() => {
    ensureData();
  }, [ensureData]);

  // Calculate counts directly from rawNews to avoid function calls
  const counts = React.useMemo(() => {
    const news = rawNews || [];
    let positive = 0,
      negative = 0,
      neutral = 0;
    for (const n of news) {
      const sentiment = (n.sentiment || "").toLowerCase();
      if (sentiment === "positive") positive++;
      else if (sentiment === "negative") negative++;
      else neutral++;
    }
    return { positive, negative, neutral };
  }, [rawNews]);

  const total = counts.positive + counts.negative + counts.neutral || 1;
  const posRatio = counts.positive / total;
  const negRatio = counts.negative / total;
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

  const styles = createStyles(theme);

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>DecalpX Snapshot</Text>
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
            size={14}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.badgeText}>
            {(sentimentSummary?.overall || "neutral").toUpperCase()} •{" "}
            {sentimentSummary
              ? `${Math.round(sentimentSummary.confidence)}%`
              : "--%"}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric
          label="Volatility"
          value={volScore}
          color="#f59e0b"
          hint={volScore < 35 ? "Calm" : volScore < 65 ? "Moderate" : "High"}
          styles={styles}
        />
        <Metric
          label="Trend Heat"
          value={trendHeat}
          color="#eab308"
          hint={trendHeat < 35 ? "Cool" : trendHeat < 65 ? "Warm" : "Hot"}
          styles={styles}
        />
      </View>
      <View style={styles.metricsRow}>
        <Metric
          label="Money Flow"
          value={Math.round(posRatio * 100)}
          color="#10b981"
          hint={
            posRatio > 0.55 ? "Inflow" : posRatio < 0.45 ? "Outflow" : "Neutral"
          }
          styles={styles}
        />
        <Metric
          label="Signal Strength"
          value={signalStrength}
          color="#22c55e"
          hint={
            signalStrength > 70
              ? "Strong"
              : signalStrength > 40
              ? "Medium"
              : "Weak"
          }
          styles={styles}
        />
      </View>
    </Pressable>
  );
});

export default DecalpXMini;

function Metric({
  label,
  value,
  color,
  hint,
  styles,
}: {
  label: string;
  value: number;
  color: string;
  hint?: string;
  styles: any;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, Math.max(0, value))}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeBull: { backgroundColor: "#16a34a" },
    badgeBear: { backgroundColor: "#dc2626" },
    badgeNeutral: { backgroundColor: "#6b7280" },
    badgeText: { color: "#ffffff", fontWeight: "700" },
    metricsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 10,
    },
    metric: { flex: 1 },
    metricHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    metricLabel: { color: theme.colors.textSecondary, fontSize: 12 },
    metricValue: { fontSize: 12, fontWeight: "700" },
    progressBg: {
      height: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      marginTop: 6,
    },
    progressFill: { height: 6, borderRadius: 999 },
    metricHint: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      marginTop: 6,
    },
  });
