import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppDataStore } from "../../../../../store/appDataStore";
import { useTheme } from "../../../providers/ThemeProvider";
import { useUserStore, type TraderType } from "../../../../../store/userStore";

type SentimentSummary = {
  overall: "bullish" | "bearish" | "neutral";
  confidence: number;
};

type SentimentCounts = {
  positive: number;
  negative: number;
  neutral: number;
};

const DecalpXMini = React.memo(function DecalpXMini({
  countsOverride,
  sentimentOverride,
  signalOverride,
}: {
  countsOverride?: SentimentCounts;
  sentimentOverride?: SentimentSummary | null;
  signalOverride?: {
    action: "buy" | "sell" | "hold";
    type: string;
    confidence: number;
    entry: number;
    stopLoss: number;
    riskReward: number;
  } | null;
}) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const profile = useUserStore((s) => s.profile);

  // Memoize the navigation function to prevent re-renders
  const handlePress = useCallback(() => {
    navigation.navigate("DecalpX" as never);
  }, [navigation]);
  // Use centralized store instead of old marketOverviewStore
  const { getMarketOverview, getSentimentSummary, getNewsSentimentCounts } =
    useAppDataStore();
  const overview1d = getMarketOverview("1D");

  // Get sentiment and counts from centralized store
  const sentimentSummary = sentimentOverride || getSentimentSummary();
  const counts = countsOverride || getNewsSentimentCounts();

  const total = counts.positive + counts.negative + counts.neutral || 1;
  const posRatio = counts.positive / total;
  const negRatio = counts.negative / total;
  const moneyFlow = Math.round((counts.positive / total) * 100);

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

      {/* Mode-based timeframe ribbon */}
      <TimeframeRibbon
        theme={theme}
        traderType={profile.traderType}
        momentumScore={momentumScore}
        signalStrength={signalStrength}
        styles={styles}
      />

      {/* Composite bull/bear summary */}
      <CompositeSummary
        theme={theme}
        traderType={profile.traderType}
        momentumScore={momentumScore}
        signalStrength={signalStrength}
        styles={styles}
      />

      {/* Primary signal strip (only when provided) */}
      {signalOverride && (
        <View style={styles.signalRow}>
          <View
            style={[
              styles.actionPill,
              signalOverride.action === "buy"
                ? styles.actionBuy
                : signalOverride.action === "sell"
                ? styles.actionSell
                : styles.actionHold,
            ]}
          >
            <Text style={styles.actionText}>
              {signalOverride.action.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.signalMetaText}>
              {signalOverride.type.toUpperCase()} • {""}
              {Math.round(signalOverride.confidence)}% • R/R {""}
              {signalOverride.riskReward}:1
            </Text>
            <SignalLevels
              action={signalOverride.action}
              entry={signalOverride.entry}
              stopLoss={signalOverride.stopLoss}
              styles={styles}
            />
          </View>
        </View>
      )}

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
          label="Flow"
          value={moneyFlow}
          suffix="%"
          color={
            moneyFlow > 60 ? "#10b981" : moneyFlow > 45 ? "#f59e0b" : "#ef4444"
          }
          styles={styles}
        />
      </View>
    </Pressable>
  );
});

export default DecalpXMini;

type TradeMode = "day" | "swing" | "long";

const TIMEFRAME_MAP: Record<
  TradeMode,
  Array<"1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w">
> = {
  day: ["1m", "5m", "15m", "30m", "1h"],
  swing: ["5m", "15m", "30m", "1h", "4h", "1d"],
  long: ["1h", "4h", "1d", "1w"],
};

const TF_WEIGHTS: Record<string, { mom: number; sig: number }> = {
  "1m": { mom: 0.9, sig: 0.1 },
  "5m": { mom: 0.8, sig: 0.2 },
  "15m": { mom: 0.7, sig: 0.3 },
  "30m": { mom: 0.6, sig: 0.4 },
  "1h": { mom: 0.5, sig: 0.5 },
  "4h": { mom: 0.35, sig: 0.65 },
  "1d": { mom: 0.25, sig: 0.75 },
  "1w": { mom: 0.15, sig: 0.85 },
};

function mapTraderTypeToMode(traderType: TraderType): TradeMode {
  if (traderType === "Day trader") return "day";
  if (traderType === "Swing trader") return "swing";
  return "long";
}

function computeTimeframeSignals(
  traderType: TraderType,
  momentumScore: number,
  signalStrength: number
) {
  const mode = mapTraderTypeToMode(traderType);
  const tfs = TIMEFRAME_MAP[mode];
  return tfs.map((tf) => {
    const w = TF_WEIGHTS[tf] || { mom: 0.5, sig: 0.5 };
    const composite =
      w.mom * (momentumScore - 50) + w.sig * (signalStrength - 50);
    const direction =
      composite > 2 ? "bull" : composite < -2 ? "bear" : "neutral";
    const strengthPct = Math.min(
      100,
      Math.max(0, Math.round(Math.abs(composite)))
    );
    return { timeframe: tf, direction, strengthPct } as const;
  });
}

function TimeframeRibbon({
  theme,
  traderType,
  momentumScore,
  signalStrength,
  styles,
}: {
  theme: any;
  traderType: TraderType;
  momentumScore: number;
  signalStrength: number;
  styles: any;
}) {
  const signals = computeTimeframeSignals(
    traderType,
    momentumScore,
    signalStrength
  );
  return (
    <View style={styles.ribbonRow}>
      {signals.map((s) => {
        const isBull = s.direction === "bull";
        const isBear = s.direction === "bear";
        const bg = isBull ? "#065f46" : isBear ? "#7f1d1d" : "#374151";
        const color = isBull
          ? "#10b981"
          : isBear
          ? "#ef4444"
          : theme.colors.textSecondary;
        return (
          <View
            key={s.timeframe}
            style={[styles.ribbonChip, { backgroundColor: bg }]}
          >
            <Text style={[styles.ribbonTf, { color }]}>{s.timeframe}</Text>
            <View style={styles.ribbonMeta}>
              <Ionicons
                name={isBull ? "arrow-up" : isBear ? "arrow-down" : "remove"}
                size={10}
                color={color}
              />
              <Text style={[styles.ribbonPct, { color }]}>
                {s.strengthPct}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function CompositeSummary({
  theme,
  traderType,
  momentumScore,
  signalStrength,
  styles,
}: {
  theme: any;
  traderType: TraderType;
  momentumScore: number;
  signalStrength: number;
  styles: any;
}) {
  const signals = computeTimeframeSignals(
    traderType,
    momentumScore,
    signalStrength
  );
  const totalStrength = signals.reduce((sum, s) => sum + s.strengthPct, 0) || 1;
  const signed = signals.reduce((sum, s) => {
    const dir = s.direction === "bull" ? 1 : s.direction === "bear" ? -1 : 0;
    return sum + dir * s.strengthPct;
  }, 0);
  const score = Math.max(
    -100,
    Math.min(100, Math.round((signed / totalStrength) * 100))
  );
  const isBear = score < 0;
  const label = isBear
    ? "Total Bearish"
    : score > 0
    ? "Total Bullish"
    : "Neutral";
  const pct = Math.abs(score);
  const fillColor = isBear
    ? "#ef4444"
    : score > 0
    ? "#10b981"
    : theme.colors.textSecondary;
  return (
    <View style={styles.compositeRow}>
      <Text style={[styles.compositeLabel, { color: fillColor }]}>
        {label} {pct}%
      </Text>
      <View style={styles.compositeBar}>
        <View
          style={[
            styles.compositeFill,
            { width: `${pct}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
    </View>
  );
}

function SignalLevels({
  action,
  entry,
  stopLoss,
  styles,
}: {
  action: "buy" | "sell" | "hold";
  entry: number;
  stopLoss: number;
  styles: any;
}) {
  const delta = Math.abs(entry - stopLoss);
  const halfR = delta * 0.5;
  const isBuy = action === "buy";
  const entryExtended = isBuy ? entry + halfR : entry - halfR;
  const exit = stopLoss;
  const exitExtended = isBuy ? stopLoss - halfR : stopLoss + halfR;
  return (
    <Text style={styles.signalLevelsText}>
      Entry ${entry.toFixed(2)} (Ext ${entryExtended.toFixed(2)}) • Exit $
      {exit.toFixed(2)} (Ext ${exitExtended.toFixed(2)})
    </Text>
  );
}

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
    ribbonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 12,
    },
    ribbonChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 6,
    },
    ribbonTf: {
      fontSize: 11,
      fontWeight: "700",
    },
    ribbonMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ribbonPct: {
      fontSize: 11,
      fontWeight: "700",
    },
    compositeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    compositeLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    compositeBar: {
      flex: 1,
      height: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: 2,
    },
    compositeFill: {
      height: 4,
      borderRadius: 2,
    },
    signalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    actionPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBuy: { backgroundColor: "#10b981" },
    actionSell: { backgroundColor: "#ef4444" },
    actionHold: { backgroundColor: "#6b7280" },
    actionText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
    signalMetaText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 2,
    },
    signalLevelsText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
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
