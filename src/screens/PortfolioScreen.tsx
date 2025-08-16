import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PortfolioDashboard from "../components/portfolio/PortfolioDashboard";
import PortfolioHistoryChart from "../components/portfolio/PortfolioHistoryChart";
import {
  portfolioAggregationService,
  AggregatedPosition,
} from "../services/portfolioAggregationService";
import { brokerageAuthService } from "../services/brokerageAuth";

export default function PortfolioScreen() {
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] =
    useState<AggregatedPosition | null>(null);
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [allPositions, setAllPositions] = useState<AggregatedPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  useEffect(() => {
    loadPerformanceMetrics();
  }, []);

  const loadPerformanceMetrics = async () => {
    try {
      const metrics = await portfolioAggregationService.getPerformanceMetrics();
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error("Failed to load performance metrics:", error);
    }
  };

  const handlePositionPress = (position: AggregatedPosition) => {
    setSelectedPosition(position);
    setShowPositionModal(true);
  };

  const handleShowAllPositions = async () => {
    try {
      setLoading(true);
      const positions =
        await portfolioAggregationService.getDetailedPositions();
      setAllPositions(positions);
      setShowAllPositions(true);
    } catch (error) {
      console.error("Failed to load all positions:", error);
      Alert.alert("Error", "Failed to load positions");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    portfolioAggregationService.clearCache();
    await loadPerformanceMetrics();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    return change >= 0 ? "#10b981" : "#ef4444";
  };

  const renderPositionModal = () => {
    if (!selectedPosition) return null;

    return (
      <Modal
        visible={showPositionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPositionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPosition.symbol}</Text>
              <TouchableOpacity onPress={() => setShowPositionModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Position Summary */}
              <View style={styles.positionSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Shares</Text>
                  <Text style={styles.summaryValue}>
                    {selectedPosition.totalQuantity.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Market Value</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(selectedPosition.totalMarketValue)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Average Price</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(selectedPosition.averagePrice)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Cost</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(selectedPosition.totalCost)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Unrealized P&L</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: getChangeColor(selectedPosition.unrealizedPnL) },
                    ]}
                  >
                    {formatCurrency(selectedPosition.unrealizedPnL)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Return %</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: getChangeColor(selectedPosition.unrealizedPnL) },
                    ]}
                  >
                    {formatPercent(selectedPosition.unrealizedPnLPercent)}
                  </Text>
                </View>
              </View>

              {/* Provider Breakdown */}
              <View style={styles.providersSection}>
                <Text style={styles.sectionTitle}>Account Breakdown</Text>
                {selectedPosition.providers.map((provider, index) => (
                  <View key={index} style={styles.providerCard}>
                    <View style={styles.providerHeader}>
                      <View style={styles.providerInfo}>
                        <Ionicons
                          name={
                            provider.provider === "robinhood"
                              ? "trending-up"
                              : "bar-chart"
                          }
                          size={20}
                          color={
                            provider.provider === "robinhood"
                              ? "#00C851"
                              : "#FFD700"
                          }
                        />
                        <Text style={styles.providerName}>
                          {provider.provider.charAt(0).toUpperCase() +
                            provider.provider.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.providerDetails}>
                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>Shares</Text>
                        <Text style={styles.providerValue}>
                          {provider.quantity.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>Market Value</Text>
                        <Text style={styles.providerValue}>
                          {formatCurrency(provider.marketValue)}
                        </Text>
                      </View>

                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>Current Price</Text>
                        <Text style={styles.providerValue}>
                          {formatCurrency(provider.price)}
                        </Text>
                      </View>

                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>Cost Basis</Text>
                        <Text style={styles.providerValue}>
                          {formatCurrency(provider.cost)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAllPositionsModal = () => (
    <Modal
      visible={showAllPositions}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAllPositions(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Positions</Text>
            <TouchableOpacity onPress={() => setShowAllPositions(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {allPositions.map((position) => (
              <TouchableOpacity
                key={position.symbol}
                style={styles.positionListItem}
                onPress={() => {
                  setShowAllPositions(false);
                  handlePositionPress(position);
                }}
              >
                <View style={styles.positionLeft}>
                  <Text style={styles.positionSymbol}>{position.symbol}</Text>
                  <Text style={styles.positionShares}>
                    {position.totalQuantity.toFixed(2)} shares
                  </Text>
                  <View style={styles.providersRow}>
                    {position.providers.map((p, index) => (
                      <View key={index} style={styles.providerChip}>
                        <Text style={styles.providerChipText}>
                          {p.provider.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.positionRight}>
                  <Text style={styles.positionValue}>
                    {formatCurrency(position.totalMarketValue)}
                  </Text>
                  <Text
                    style={[
                      styles.positionChange,
                      { color: getChangeColor(position.unrealizedPnL) },
                    ]}
                  >
                    {formatCurrency(position.unrealizedPnL)}
                  </Text>
                  <Text
                    style={[
                      styles.positionPercent,
                      { color: getChangeColor(position.unrealizedPnL) },
                    ]}
                  >
                    {formatPercent(position.unrealizedPnLPercent)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderPerformanceMetrics = () => {
    if (!performanceMetrics) return null;

    return (
      <View style={styles.performanceSection}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Best Day</Text>
            {performanceMetrics.bestDay ? (
              <>
                <Text style={[styles.metricValue, { color: "#10b981" }]}>
                  {formatPercent(performanceMetrics.bestDay.changePercent)}
                </Text>
                <Text style={styles.metricDate}>
                  {new Date(
                    performanceMetrics.bestDay.date
                  ).toLocaleDateString()}
                </Text>
              </>
            ) : (
              <Text style={styles.metricValue}>—</Text>
            )}
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Worst Day</Text>
            {performanceMetrics.worstDay ? (
              <>
                <Text style={[styles.metricValue, { color: "#ef4444" }]}>
                  {formatPercent(performanceMetrics.worstDay.changePercent)}
                </Text>
                <Text style={styles.metricDate}>
                  {new Date(
                    performanceMetrics.worstDay.date
                  ).toLocaleDateString()}
                </Text>
              </>
            ) : (
              <Text style={styles.metricValue}>—</Text>
            )}
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Avg Daily Return</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getChangeColor(performanceMetrics.avgDailyReturn) },
              ]}
            >
              {formatPercent(performanceMetrics.avgDailyReturn)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Volatility</Text>
            <Text style={styles.metricValue}>
              {formatPercent(performanceMetrics.volatility)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const activeSessions = brokerageAuthService.getActiveSessions();

  if (activeSessions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={80} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No Connected Accounts</Text>
          <Text style={styles.emptySubtitle}>
            Connect your brokerage accounts in Profile settings to see your
            portfolio
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name={refreshing ? "hourglass" : "refresh"}
            size={24}
            color="#6366f1"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <PortfolioDashboard
          onPositionPress={handlePositionPress}
          onHistoryPress={handleShowAllPositions}
        />

        <PortfolioHistoryChart initialPeriod="1M" />

        {renderPerformanceMetrics()}
      </ScrollView>

      {renderPositionModal()}
      {renderAllPositionsModal()}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  performanceSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  metricDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  positionSummary: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  providersSection: {
    marginBottom: 20,
  },
  providerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  providerDetails: {
    gap: 8,
  },
  providerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  providerLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  providerValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  positionListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  positionLeft: {
    flex: 1,
  },
  positionSymbol: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  positionShares: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 6,
  },
  providersRow: {
    flexDirection: "row",
    gap: 4,
  },
  providerChip: {
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  providerChipText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  positionRight: {
    alignItems: "flex-end",
  },
  positionValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  positionChange: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  positionPercent: {
    fontSize: 12,
    fontWeight: "500",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
});
