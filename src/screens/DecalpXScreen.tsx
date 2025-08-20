import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppDataStore } from "../store/appDataStore";
import StockAutocomplete from "../components/common/StockAutocomplete";
import { StockSearchResult } from "../services/stockSearch";
import { fetchYahooCandles } from "../services/marketProviders";
import { fetchNewsWithDateFilter } from "../services/newsProviders";
import SimpleLineChart from "../components/charts/SimpleLineChart";
import { useTheme } from "../providers/ThemeProvider";

const { width } = Dimensions.get("window");

export default function DecalpXScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [symbolSeries, setSymbolSeries] = useState<
    { time: number; close: number }[] | null
  >(null);
  const [symbolCounts, setSymbolCounts] = useState<{
    positive: number;
    negative: number;
    neutral: number;
  }>({ positive: 0, negative: 0, neutral: 0 });

  // Use centralized store instead of old marketOverviewStore
  const {
    getMarketOverview,
    getSentimentSummary,
    refreshInBackground,
    news: rawNews,
  } = useAppDataStore();
  const overview1d = getMarketOverview("1D");

  // Get sentiment from centralized store
  const sentimentSummary = getSentimentSummary();

  // Data is always available from centralized store - no need to ensure

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger background refresh from centralized store
      refreshInBackground();
    } catch (error) {
      console.error("Failed to refresh DecalpX data:", error);
    } finally {
      setRefreshing(false);
    }
  };

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

  // Baseline (market) metrics
  const marketVolScore = Math.min(
    100,
    (overview1d?.upcomingEvents?.length || 0) * 10 +
      (overview1d?.keyHighlights?.length || 0) * 5
  );
  const marketTrendHeat = Math.min(
    100,
    (overview1d?.trendingStocks?.length || 0) * 12
  );
  const marketSignalStrength = Math.min(
    100,
    (overview1d?.keyHighlights?.length || 0) * 12 + Math.round(posRatio * 20)
  );
  const marketMoneyFlow = Math.round(posRatio * 100);

  // Symbol-specific metrics when a symbol is selected
  const symbolMetrics = useMemo(() => {
    if (!symbolSeries || symbolSeries.length < 10) return null;
    const closes = symbolSeries.map((c) => c.close);
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const r = (closes[i] - closes[i - 1]) / (closes[i - 1] || closes[i]);
      if (isFinite(r)) rets.push(r);
    }
    const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
    const variance =
      rets.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      Math.max(1, rets.length);
    const stdev = Math.sqrt(variance);
    const volScore = Math.min(100, Math.max(0, stdev * 10000));

    const sma = (arr: number[], n: number) => {
      if (arr.length < n) return arr[arr.length - 1] || 0;
      const slice = arr.slice(arr.length - n);
      return slice.reduce((a, b) => a + b, 0) / n;
    };
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const trendDelta = sma50 ? (sma20 - sma50) / sma50 : 0;
    const trendHeat = Math.min(100, Math.abs(trendDelta) * 8000);

    const totalNews =
      symbolCounts.positive + symbolCounts.negative + symbolCounts.neutral || 1;
    const moneyFlow = Math.round((symbolCounts.positive / totalNews) * 100);

    const momentumPct =
      closes.length > 6
        ? ((closes[closes.length - 1] - closes[closes.length - 6]) /
            closes[closes.length - 6]) *
          100
        : 0;
    const momentumScore = Math.min(100, Math.abs(momentumPct) * 3);

    const signalStrength = Math.round(
      0.55 * trendHeat + 0.25 * momentumScore + 0.2 * moneyFlow
    );

    return { volScore, trendHeat, moneyFlow, signalStrength, momentumPct };
  }, [symbolSeries, symbolCounts]);

  const volScore = symbolMetrics?.volScore ?? marketVolScore;
  const trendHeat = symbolMetrics?.trendHeat ?? marketTrendHeat;
  const signalStrength = symbolMetrics?.signalStrength ?? marketSignalStrength;
  const moneyFlow = symbolMetrics?.moneyFlow ?? marketMoneyFlow;
  const marketBlood = Math.round((1 - Math.abs(posRatio - 0.5) * 2) * 100); // How balanced/uncertain
  const oxygenLevel = Math.round(
    ((overview1d?.topStories?.length || 0) / 10) * 100
  ); // News flow
  const pulseRate = Math.min(
    100,
    (overview1d?.fedEvents?.length || 0) * 25 + volScore * 0.3
  );
  const adrenalineLevel = Math.min(100, Math.max(0, (volScore - 50) * 2));
  const gravityScore = 100 - Math.min(100, signalStrength); // Inverse of signal strength

  // Enhanced oversold and momentum calculations
  const rsi = Math.max(0, Math.min(100, 50 + (posRatio - 0.5) * 100));
  const oversoldLevel = rsi < 30 ? 100 - rsi : Math.max(0, 70 - rsi);
  const momentumScore = Math.min(
    100,
    Math.abs(posRatio - 0.5) * 200 + trendHeat * 0.4 + volScore * 0.2
  );

  // Timeframe bullish signals with enhanced logic
  const bullishSignals = {
    day: posRatio > 0.6 && volScore < 60 && momentumScore > 30,
    swing: posRatio > 0.55 && trendHeat > 40 && oversoldLevel < 70,
    longterm: posRatio > 0.52 && signalStrength > 50 && momentumScore > 25,
  };

  // Generate mock SPY data for demo
  const generateSPYData = () => {
    const now = Date.now();
    const data = [];
    let price = 625;
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 60000; // 1 minute intervals
      price += (Math.random() - 0.5) * 2;
      data.push({ time, close: Math.round(price * 100) / 100 });
    }
    return data;
  };

  const [spyData] = useState(generateSPYData());
  const chartData = selected && symbolSeries?.length ? symbolSeries! : spyData;
  const currentPrice = chartData[chartData.length - 1]?.close || 625;
  const previousPrice = chartData[chartData.length - 2]?.close || 625;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = (priceChange / previousPrice) * 100;

  // Trade mode: day vs swing
  const [tradeMode, setTradeMode] = useState<"day" | "swing">("day");
  const { entryPrice, exitPrice } = useMemo(() => {
    const momentum = symbolMetrics?.momentumPct ?? (priceChangePercent || 0);
    const biasLong = momentum >= 0;
    const baseMove = Math.max(
      Math.abs(priceChange) || currentPrice * 0.005,
      currentPrice * 0.004
    );
    const k = tradeMode === "day" ? 1.2 : 3.0;
    const delta = baseMove * k;
    if (biasLong) {
      return {
        entryPrice: Math.max(0, currentPrice - delta * 0.5),
        exitPrice: currentPrice + delta,
      };
    }
    return {
      entryPrice: currentPrice + delta * 0.5,
      exitPrice: Math.max(0, currentPrice - delta),
    };
  }, [currentPrice, priceChange, priceChangePercent, tradeMode, symbolMetrics]);

  // When user selects a ticker, fetch a quick price snapshot
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selected) return;
      try {
        const candles = await fetchYahooCandles(selected.symbol, "5d", "1d");
        const last = candles[candles.length - 1]?.close ?? null;
        const mapped = candles.map((c) => ({ time: c.time, close: c.close }));
        const news = await fetchNewsWithDateFilter(selected.symbol, 72);
        let positive = 0,
          negative = 0,
          neutral = 0;
        for (const n of news) {
          const s = (n.sentiment || "").toLowerCase();
          if (s === "positive") positive++;
          else if (s === "negative") negative++;
          else neutral++;
        }
        if (mounted) setSelectedPrice(last);
        if (mounted) setSymbolSeries(mapped);
        if (mounted) setSymbolCounts({ positive, negative, neutral });
      } catch {
        if (mounted) setSelectedPrice(null);
        if (mounted) setSymbolSeries(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selected]);

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>DECALP X</Text>
        <Pressable onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Ticker picker (Add-to-watchlist style) */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <Text
            style={{
              color: theme.colors.textSecondary,
              marginBottom: 8,
              fontWeight: "600",
            }}
          >
            Analyze a symbol
          </Text>
          <StockAutocomplete
            onStockSelect={(stk) => setSelected(stk)}
            placeholder="Type a symbol..."
            containerStyle={{}}
            inputStyle={{ backgroundColor: theme.colors.surface }}
          />
          {selected && (
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                {selected.symbol} · {selected.name}
              </Text>
              <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
                {selectedPrice ? `$${selectedPrice.toFixed(2)}` : "--"}
              </Text>
            </View>
          )}
        </View>

        {/* Current Time and Status */}
        <View style={styles.timeCard}>
          <Text style={styles.timeText}>Mon, Aug 18 2025 02:52:13 PM</Text>
          <Text style={styles.countdownText}>13d 09h 07m 46s</Text>
          <Text style={styles.statusText}>MAIN CHART MONTHLY UPDATE</Text>
        </View>

        {/* SPY Analysis */}
        <View style={styles.spyCard}>
          <View style={styles.spyHeader}>
            <View>
              <Text style={styles.spyTitle}>{selected?.symbol || "SPY"}</Text>
              {selected?.name ? (
                <Text style={styles.spySubtitle}>{selected.name}</Text>
              ) : (
                <Text style={styles.spySubtitle}>SPDR S&P 500 ETF Trust</Text>
              )}
              <Text style={styles.spyPrice}>
                $
                {selectedPrice
                  ? selectedPrice.toFixed(2)
                  : currentPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.spyChange}>
              <Text
                style={[
                  styles.changeText,
                  priceChange >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)} ({priceChangePercent >= 0 ? "+" : ""}
                {priceChangePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <SimpleLineChart
              data={chartData}
              height={120}
              color={priceChange >= 0 ? "#10B981" : "#EF4444"}
              strokeWidth={2}
              showFill={false}
            />
          </View>
          {/* Trade mode tabs */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => setTradeMode("day")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: tradeMode === "day" ? "#10B981" : "#374151",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Day Trade
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTradeMode("swing")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: tradeMode === "swing" ? "#10B981" : "#374151",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Swing Trade
              </Text>
            </Pressable>
          </View>

          {/* Dynamic targets */}
          <View style={styles.spyMetrics}>
            <View style={styles.spyMetric}>
              <Text style={styles.metricLabel}>Potential Entry:</Text>
              <Text style={styles.metricValue}>${entryPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.spyMetric}>
              <Text style={styles.metricLabel}>Potential Exit:</Text>
              <Text style={styles.metricValue}>${exitPrice.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Market Sentiment + Summary strip */}
        <View style={styles.sentimentCard}>
          <View style={styles.sentimentHeader}>
            <Text style={styles.cardTitle}>SENTIMENT</Text>
            <View
              style={[
                styles.sentimentBadge,
                sentimentSummary?.overall === "bullish"
                  ? styles.bullishBadge
                  : sentimentSummary?.overall === "bearish"
                  ? styles.bearishBadge
                  : styles.neutralBadge,
              ]}
            >
              <Text style={styles.sentimentPercent}>
                {sentimentSummary
                  ? `${Math.round(sentimentSummary.confidence)}%`
                  : "0%"}
              </Text>
            </View>
          </View>
          <Text style={styles.sentimentLabel}>
            {(() => {
              if (!sentimentSummary) return "NEUTRAL";
              const conf = sentimentSummary.confidence;
              if (sentimentSummary.overall === "bullish") {
                if (conf >= 85) return "EXTREME GREED";
                if (conf >= 60) return "GREED";
                return "BULLISH";
              }
              if (sentimentSummary.overall === "bearish") {
                if (conf >= 85) return "EXTREME FEAR";
                if (conf >= 60) return "FEAR";
                return "BEARISH";
              }
              return "NEUTRAL";
            })()}
          </Text>

          {/* Quick Summary Strip for readability */}
          <View
            style={{
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 10,
              backgroundColor: theme.colors.surface,
              borderRadius: 8,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              RSI {Math.round(rsi)}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              Mom {Math.round(momentumScore)}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              Sig {Math.round(signalStrength)}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              O/S {Math.round(oversoldLevel)}
            </Text>
          </View>
        </View>

        {/* Timeframe Bullish Signals */}
        <View style={styles.timeframeCard}>
          <Text style={styles.cardTitle}>BULLISH TIMEFRAMES</Text>
          <View style={styles.timeframeGrid}>
            <TimeframeBullish
              title="Day Trading"
              active={bullishSignals.day}
              confidence={bullishSignals.day ? Math.round(posRatio * 100) : 0}
              condition={
                bullishSignals.day
                  ? momentumScore > 60
                    ? "STRONG"
                    : "MODERATE"
                  : "BEARISH"
              }
              styles={styles}
            />
            <TimeframeBullish
              title="Swing Trading"
              active={bullishSignals.swing}
              confidence={bullishSignals.swing ? Math.round(trendHeat) : 0}
              condition={
                bullishSignals.swing
                  ? oversoldLevel < 30
                    ? "OVERSOLD BUY"
                    : "BULLISH"
                  : "NEUTRAL"
              }
              styles={styles}
            />
            <TimeframeBullish
              title="Long Term"
              active={bullishSignals.longterm}
              confidence={
                bullishSignals.longterm ? Math.round(signalStrength) : 0
              }
              condition={
                bullishSignals.longterm
                  ? signalStrength > 70
                    ? "STRONG BULL"
                    : "BULL TREND"
                  : "BEARISH"
              }
              styles={styles}
            />
          </View>
        </View>

        {/* Market Blood Indicators */}
        <View style={styles.indicatorsGrid}>
          <MarketIndicator
            title="MARKET BLOOD"
            icon="water"
            value={marketBlood}
            color="#3B82F6"
            label={
              marketBlood > 70
                ? "CALM"
                : marketBlood > 40
                ? "ADEQUATE"
                : "STRONG BEAR"
            }
            styles={styles}
          />
          <MarketIndicator
            title="OXYGEN"
            icon="leaf"
            value={oxygenLevel}
            color="#EAB308"
            label={
              oxygenLevel > 70
                ? "ADEQUATE"
                : oxygenLevel > 40
                ? "LIGHT BULLISH"
                : "ACTIVE"
            }
            styles={styles}
          />
          <MarketIndicator
            title="PULSE"
            icon="heart"
            value={pulseRate}
            color="#10B981"
            label="LIGHT BULLISH"
            styles={styles}
          />
          <MarketIndicator
            title="ADRENALINE"
            icon="flash"
            value={adrenalineLevel}
            color="#EF4444"
            label={
              adrenalineLevel > 70
                ? "ACTIVE"
                : adrenalineLevel > 40
                ? "STRONG BEAR"
                : "CALM"
            }
            styles={styles}
          />
          <MarketIndicator
            title="OVERSOLD"
            icon="trending-down"
            value={oversoldLevel}
            color="#F97316"
            label={
              oversoldLevel > 70
                ? "EXTREME"
                : oversoldLevel > 40
                ? "MODERATE"
                : "NORMAL"
            }
            styles={styles}
          />
          <MarketIndicator
            title="MOMENTUM"
            icon="rocket"
            value={momentumScore}
            color="#8B5CF6"
            label={
              momentumScore > 80
                ? "EXPLOSIVE"
                : momentumScore > 60
                ? "STRONG"
                : momentumScore > 40
                ? "MODERATE"
                : "WEAK"
            }
            styles={styles}
          />
        </View>

        {/* Technical Analysis Grid */}
        <View style={styles.technicalGrid}>
          <TechnicalMetric
            title="Pullback Risk"
            value={Math.min(100, volScore * 0.8)}
            color="#F59E0B"
            label="Watch"
            styles={styles}
          />
          <TechnicalMetric
            title="Candle Load"
            value={Math.min(100, trendHeat * 0.6)}
            color="#EAB308"
            label="Moderate"
            styles={styles}
          />
          <TechnicalMetric
            title="Volatility"
            value={volScore}
            color="#06B6D4"
            label="Calm"
            styles={styles}
          />
          <TechnicalMetric
            title="Money Flow"
            value={moneyFlow}
            color="#EF4444"
            label="Neutral"
            styles={styles}
          />
          <TechnicalMetric
            title="Stability"
            value={Math.min(100, 100 - volScore)}
            color="#F97316"
            label="Calm"
            styles={styles}
          />
        </View>

        {/* Trend Heat */}
        <View style={styles.trendHeatCard}>
          <Text style={styles.cardTitle}>Trend Heat</Text>
          <View style={styles.trendHeatGrid}>
            <TrendHeatMetric
              title="Pressure"
              value={75}
              color="#06B6D4"
              label="MOD BULL"
              styles={styles}
            />
            <TrendHeatMetric
              title="Velocity"
              value={71}
              color="#EAB308"
              label="FAST"
              styles={styles}
            />
            <TrendHeatMetric
              title="O/B - O/S"
              value={oversoldLevel}
              color={
                oversoldLevel > 70
                  ? "#EF4444"
                  : oversoldLevel > 30
                  ? "#F97316"
                  : "#10B981"
              }
              label={
                oversoldLevel > 70
                  ? "OVERSOLD"
                  : rsi > 70
                  ? "OVERBOUGHT"
                  : "NEUTRAL"
              }
              styles={styles}
            />
            <TrendHeatMetric
              title="Signal Strength"
              value={92}
              color="#06B6D4"
              label="Strong Bull"
              styles={styles}
            />
          </View>
          <View style={styles.trendHeatBottom}>
            <Text style={styles.trendHeatValue}>36%</Text>
            <Text style={styles.trendHeatLabel}>Warm</Text>
          </View>
        </View>

        {/* Universal Indicator */}
        <View style={styles.universalCard}>
          <Text style={styles.cardTitle}>UNIVERSAL INDICATOR</Text>
          <Text style={styles.universalSubtitle}>MOMENTUM BIAS</Text>
          <View style={styles.universalContent}>
            <Text style={styles.universalTrend}>Bullish (Trend ~51%)</Text>
            <View style={styles.universalProgress}>
              <View style={[styles.universalFill, { width: "51%" }]} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketIndicator({
  title,
  icon,
  value,
  color,
  label,
  styles,
}: {
  title: string;
  icon: string;
  value: number;
  color: string;
  label: string;
  styles: any;
}) {
  return (
    <View style={styles.indicatorCard}>
      <View style={styles.indicatorHeader}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={styles.indicatorValue}>{value}%</Text>
      </View>
      <Text style={styles.indicatorTitle}>{title}</Text>
      <Text style={[styles.indicatorLabel, { color }]}>{label}</Text>
    </View>
  );
}

function TechnicalMetric({
  title,
  value,
  color,
  label,
  styles,
}: {
  title: string;
  value: number;
  color: string;
  label: string;
  styles: any;
}) {
  return (
    <View style={styles.technicalCard}>
      <Text style={styles.technicalTitle}>{title}</Text>
      <View style={styles.technicalProgress}>
        <View
          style={[
            styles.technicalFill,
            { width: `${Math.min(100, value)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View style={styles.technicalBottom}>
        <Text style={styles.technicalValue}>{Math.round(value)}%</Text>
        <Text style={styles.technicalLabel}>{label}</Text>
      </View>
    </View>
  );
}

function TimeframeBullish({
  title,
  active,
  confidence,
  condition,
  styles,
}: {
  title: string;
  active: boolean;
  confidence: number;
  condition: string;
  styles: any;
}) {
  return (
    <View
      style={[
        styles.timeframeBullishCard,
        active && styles.timeframeBullishActive,
      ]}
    >
      <Text style={styles.timeframeBullishTitle}>{title}</Text>
      <View style={styles.timeframeBullishContent}>
        <Text
          style={[
            styles.timeframeBullishConfidence,
            { color: active ? "#10B981" : "#6B7280" },
          ]}
        >
          {confidence}%
        </Text>
        <Text
          style={[
            styles.timeframeBullishCondition,
            { color: active ? "#10B981" : "#6B7280" },
          ]}
        >
          {condition}
        </Text>
      </View>
      <View
        style={[
          styles.timeframeBullishIndicator,
          { backgroundColor: active ? "#10B981" : "#374151" },
        ]}
      />
    </View>
  );
}

function TrendHeatMetric({
  title,
  value,
  color,
  label,
  styles,
}: {
  title: string;
  value: number;
  color: string;
  label: string;
  styles: any;
}) {
  return (
    <View style={styles.trendMetric}>
      <Text style={styles.trendMetricTitle}>{title}</Text>
      <Text style={[styles.trendMetricValue, { color }]}>{value}%</Text>
      <Text style={styles.trendMetricLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.primary,
      letterSpacing: 2,
    },
    refreshButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    timeCard: {
      backgroundColor: theme.colors.blueTransparent,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      alignItems: "center",
    },
    timeText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    countdownText: {
      color: "#F59E0B",
      fontSize: 18,
      fontWeight: "700",
      marginVertical: 4,
    },
    statusText: {
      color: "#6366F1",
      fontSize: 12,
      fontWeight: "600",
    },
    spyCard: {
      backgroundColor: theme.colors.blueTransparent,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    spyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    spyTitle: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: "700",
    },
    spySubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginBottom: 8,
    },
    spyPrice: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "600",
    },
    spyChange: {
      alignItems: "flex-end",
    },
    changeText: {
      fontSize: 16,
      fontWeight: "600",
    },
    positive: {
      color: "#10B981",
    },
    negative: {
      color: "#EF4444",
    },
    chartContainer: {
      marginVertical: 16,
    },
    spyMetrics: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    spyMetric: {
      flex: 1,
    },
    metricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    metricValue: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: "600",
    },
    sentimentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sentimentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    cardTitle: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
    sentimentBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    bullishBadge: {
      backgroundColor: "#10B981",
    },
    bearishBadge: {
      backgroundColor: "#EF4444",
    },
    neutralBadge: {
      backgroundColor: "#6B7280",
    },
    sentimentPercent: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "700",
    },
    sentimentLabel: {
      color: "#10B981",
      fontSize: 18,
      fontWeight: "700",
    },
    timeframeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    timeframeGrid: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },
    timeframeBullishCard: {
      flex: 1,
      backgroundColor: "#1F2937",
      borderRadius: 8,
      padding: 12,
      borderWidth: 2,
      borderColor: "#374151",
    },
    timeframeBullishActive: {
      borderColor: "#10B981",
      backgroundColor: "#10B98110",
    },
    timeframeBullishTitle: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      marginBottom: 8,
    },
    timeframeBullishContent: {
      alignItems: "center",
      marginBottom: 8,
    },
    timeframeBullishConfidence: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 4,
    },
    timeframeBullishCondition: {
      fontSize: 10,
      fontWeight: "600",
    },
    timeframeBullishIndicator: {
      height: 3,
      borderRadius: 2,
    },
    indicatorsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
    },
    indicatorCard: {
      backgroundColor: "#1F2937",
      borderRadius: 12,
      padding: 12,
      width: (width - 48) / 2,
      alignItems: "center",
    },
    indicatorHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    indicatorValue: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "700",
      marginLeft: 8,
    },
    indicatorTitle: {
      color: "#9CA3AF",
      fontSize: 12,
      marginBottom: 4,
    },
    indicatorLabel: {
      fontSize: 12,
      fontWeight: "600",
    },
    technicalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    technicalCard: {
      backgroundColor: "#1F2937",
      borderRadius: 8,
      padding: 12,
      width: (width - 48) / 2,
    },
    technicalTitle: {
      color: "#9CA3AF",
      fontSize: 11,
      marginBottom: 8,
    },
    technicalProgress: {
      height: 4,
      backgroundColor: "#374151",
      borderRadius: 2,
      marginBottom: 8,
    },
    technicalFill: {
      height: 4,
      borderRadius: 2,
    },
    technicalBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    technicalValue: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    technicalLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
    },
    trendHeatCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    trendHeatGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginVertical: 16,
    },
    trendMetric: {
      width: (width - 80) / 2,
      alignItems: "center",
    },
    trendMetricTitle: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      marginBottom: 4,
    },
    trendMetricValue: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 4,
    },
    trendMetricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
    },
    trendHeatBottom: {
      alignItems: "center",
      marginTop: 16,
    },
    trendHeatValue: {
      color: "#EAB308",
      fontSize: 24,
      fontWeight: "700",
    },
    trendHeatLabel: {
      color: "#EAB308",
      fontSize: 14,
      fontWeight: "600",
    },
    universalCard: {
      backgroundColor: theme.colors.blueTransparent,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    universalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginBottom: 16,
    },
    universalContent: {
      alignItems: "center",
    },
    universalTrend: {
      color: "#10B981",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
    },
    universalProgress: {
      width: "100%",
      height: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 4,
    },
    universalFill: {
      height: 8,
      backgroundColor: "#10B981",
      borderRadius: 4,
    },
  });
