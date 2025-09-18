import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MarketScanner, MarketScreenerData, ScanResult } from "../shared/services/marketScanner";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#888888",
    fontSize: 14,
  },
  section: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  stockLeft: {
    flex: 1,
  },
  stockSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  stockMetrics: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  stockRight: {
    alignItems: "flex-end",
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  stockChange: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  positiveChange: {
    color: "#00D4AA",
  },
  negativeChange: {
    color: "#FF5722",
  },
  alertBadge: {
    backgroundColor: "#FF5722",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  overviewCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: (width - 64) / 2 - 4,
  },
  overviewTitle: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  overviewSubvalue: {
    fontSize: 10,
    color: "#888888",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 32,
  },
  loadingText: {
    color: "#888888",
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: "#00D4AA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
});

export default function MarketScreenerScreen() {
  const [screenerData, setScreenerData] = useState<MarketScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  useEffect(() => {
    loadScreenerData();
  }, []);

  async function loadScreenerData() {
    try {
      setLoading(true);
      const data = await MarketScanner.getMarketScreenerData();
      setScreenerData(data);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error("Error loading screener data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadScreenerData();
  }

  function renderStockList(stocks: ScanResult[], title: string, icon: string, color: string, showAlert = false) {
    if (!stocks || stocks.length === 0) {
      return (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.sectionIcon, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={14} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionSubtitle}>No data available</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={32} color="#888888" />
            <Text style={styles.emptyStateText}>
              No stocks match the criteria for {title.toLowerCase()}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.sectionIcon, { backgroundColor: color }]}>
              <Ionicons name={icon as any} size={14} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionSubtitle}>{stocks.length} stocks found</Text>
            </View>
          </View>
        </View>

        {stocks.slice(0, 5).map((result, index) => {
          const { symbol, analysis, alerts, score } = result;
          const currentPrice = analysis.currentPrice;
          const change = currentPrice * 0.02 * (Math.random() - 0.5); // Mock change
          const changePercent = (change / currentPrice) * 100;
          const isPositive = change >= 0;

          return (
            <View key={`${symbol}-${index}`} style={styles.stockRow}>
              <View style={styles.stockLeft}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.stockSymbol}>{symbol}</Text>
                  {showAlert && alerts.length > 0 && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertBadgeText}>{alerts.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.stockMetrics}>
                  RSI: {analysis.indicators.rsi.toFixed(0)} • 
                  Vol: {analysis.indicators.volume.ratio.toFixed(1)}x • 
                  Score: {score.toFixed(0)}
                </Text>
              </View>
              
              <View style={styles.stockRight}>
                <Text style={styles.stockPrice}>${currentPrice.toFixed(2)}</Text>
                <Text style={[styles.stockChange, isPositive ? styles.positiveChange : styles.negativeChange]}>
                  {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  if (loading && !screenerData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Market Screener</Text>
          <Text style={styles.headerSubtitle}>Loading market data...</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Scanning markets...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.headerTitle}>Market Screener</Text>
            <Text style={styles.headerSubtitle}>
              {lastUpdateTime ? `Last updated: ${lastUpdateTime.toLocaleTimeString()}` : "Real-time market analysis"}
            </Text>
          </View>
          
          <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={refreshing}>
            <Ionicons name="refresh" size={16} color="#000000" />
            <Text style={styles.refreshButtonText}>
              {refreshing ? "Updating..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4AA" />
        }
      >
        {/* Market Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.sectionIcon, { backgroundColor: "#6366f1" }]}>
                <Ionicons name="stats-chart" size={14} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Market Overview</Text>
                <Text style={styles.sectionSubtitle}>Key market statistics</Text>
              </View>
            </View>
          </View>

          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Top Gainers</Text>
              <Text style={styles.overviewValue}>{screenerData?.topGainers?.length || 0}</Text>
              <Text style={styles.overviewSubvalue}>Strong performers</Text>
            </View>
            
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>High Volume</Text>
              <Text style={styles.overviewValue}>{screenerData?.highVolume?.length || 0}</Text>
              <Text style={styles.overviewSubvalue}>Active trading</Text>
            </View>
            
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Breakouts</Text>
              <Text style={styles.overviewValue}>{screenerData?.breakouts?.length || 0}</Text>
              <Text style={styles.overviewSubvalue}>Technical patterns</Text>
            </View>
            
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Signal Alerts</Text>
              <Text style={styles.overviewValue}>{screenerData?.signalAlerts?.length || 0}</Text>
              <Text style={styles.overviewSubvalue}>AI recommendations</Text>
            </View>
          </View>
        </View>

        {/* Top Gainers */}
        {renderStockList(
          screenerData?.topGainers || [],
          "Top Gainers",
          "trending-up",
          "#00D4AA"
        )}

        {/* High Volume */}
        {renderStockList(
          screenerData?.highVolume || [],
          "High Volume",
          "pulse",
          "#3B82F6"
        )}

        {/* Breakouts */}
        {renderStockList(
          screenerData?.breakouts || [],
          "Breakouts",
          "arrow-up-circle",
          "#8B5CF6"
        )}

        {/* Oversold Opportunities */}
        {renderStockList(
          screenerData?.oversold || [],
          "Oversold Opportunities",
          "arrow-down-circle",
          "#10B981"
        )}

        {/* Signal Alerts */}
        {renderStockList(
          screenerData?.signalAlerts || [],
          "AI Signal Alerts",
          "notifications",
          "#F59E0B",
          true
        )}

        {/* Top Losers */}
        {renderStockList(
          screenerData?.topLosers || [],
          "Top Losers",
          "trending-down",
          "#EF4444"
        )}

        {/* Overbought Stocks */}
        {renderStockList(
          screenerData?.overbought || [],
          "Overbought Stocks",
          "warning",
          "#F97316"
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}