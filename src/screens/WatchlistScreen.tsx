import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MarketScanner, ScanResult, ScanFilter } from "../services/marketScanner";
import { fetchCandles } from "../services/marketProviders";
import { performComprehensiveAnalysis } from "../services/aiAnalytics";

const { width: screenWidth } = Dimensions.get("window");

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  rsi?: number;
  volumeRatio?: number;
  signals?: number;
  alerts?: string[];
  score?: number;
}

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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#00D4AA",
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#000000",
  },
  tabTextInactive: {
    color: "#888888",
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#00D4AA",
    borderColor: "#00D4AA",
  },
  filterChipText: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#000000",
  },
  stockCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stockSymbol: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  stockName: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  stockPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  stockChange: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  positiveChange: {
    color: "#00D4AA",
  },
  negativeChange: {
    color: "#FF5722",
  },
  stockMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#888888",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  alertsContainer: {
    marginTop: 8,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF5722",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 10,
    color: "#ffffff",
    marginLeft: 4,
    flex: 1,
  },
  scoreContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#00D4AA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
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
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: "#00D4AA",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  addButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    color: "#888888",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
  },
});

const filterPresets = [
  { id: "all", label: "All Stocks", filter: {} },
  { id: "oversold", label: "Oversold", filter: { rsiMax: 30, volumeRatioMin: 1.2 } },
  { id: "momentum", label: "Momentum", filter: { rsiMin: 60, volumeRatioMin: 1.5 } },
  { id: "breakout", label: "Breakouts", filter: { volumeRatioMin: 2.0, minConfidence: 70 } },
  { id: "signals", label: "High Signals", filter: { minConfidence: 75 } },
];

export default function WatchlistScreen() {
  const [activeTab, setActiveTab] = useState<"watchlist" | "scanner">("watchlist");
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]);
  const [watchlistData, setWatchlistData] = useState<ScanResult[]>([]);
  const [scannerData, setScannerData] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "scanner") {
      loadScannerData();
    }
  }, [activeTab, selectedFilter]);

  async function loadData() {
    try {
      setLoading(true);
      await loadWatchlistData();
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Error", "Failed to load watchlist data");
    } finally {
      setLoading(false);
    }
  }

  async function loadWatchlistData() {
    const results: ScanResult[] = [];
    
    for (const symbol of watchlist) {
      try {
        const result = await MarketScanner.scanMarket({ minConfidence: 0 });
        const symbolResult = result.find(r => r.symbol === symbol);
        
        if (symbolResult) {
          results.push(symbolResult);
        } else {
          // Create basic data if not found in scanner
          const candles = await fetchCandles(symbol, { resolution: "D" });
          if (candles.length > 0) {
            const analysis = await performComprehensiveAnalysis(symbol, { "1d": candles });
            results.push({
              symbol,
              analysis,
              alerts: [],
              score: analysis.overallRating.score
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load data for ${symbol}:`, error);
      }
    }
    
    setWatchlistData(results.sort((a, b) => b.score - a.score));
  }

  async function loadScannerData() {
    try {
      setLoading(true);
      const filter = filterPresets.find(f => f.id === selectedFilter)?.filter || {};
      const results = await MarketScanner.scanMarket(filter);
      setScannerData(results);
    } catch (error) {
      console.error("Error loading scanner data:", error);
      Alert.alert("Error", "Failed to load market scanner data");
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    if (activeTab === "watchlist") {
      await loadWatchlistData();
    } else {
      await loadScannerData();
    }
    setRefreshing(false);
  }

  function addToWatchlist() {
    if (!newSymbol.trim()) {
      Alert.alert("Error", "Please enter a symbol");
      return;
    }

    const symbol = newSymbol.toUpperCase().trim();
    if (watchlist.includes(symbol)) {
      Alert.alert("Already Added", `${symbol} is already in your watchlist`);
      return;
    }

    setWatchlist(prev => [...prev, symbol]);
    setNewSymbol("");
    setShowAddModal(false);
    
    // Reload watchlist data
    loadWatchlistData();
  }

  function removeFromWatchlist(symbol: string) {
    Alert.alert(
      "Remove Stock",
      `Remove ${symbol} from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setWatchlist(prev => prev.filter(s => s !== symbol));
            setWatchlistData(prev => prev.filter(s => s.symbol !== symbol));
          }
        }
      ]
    );
  }

  function addToWatchlistFromScanner(symbol: string) {
    if (!watchlist.includes(symbol)) {
      setWatchlist(prev => [...prev, symbol]);
      Alert.alert("Added", `${symbol} added to your watchlist`);
    } else {
      Alert.alert("Already Added", `${symbol} is already in your watchlist`);
    }
  }

  function renderStockCard(result: ScanResult, showAddButton = false) {
    const { symbol, analysis, alerts, score } = result;
    const currentPrice = analysis.currentPrice;
    const change = currentPrice * 0.02 * (Math.random() - 0.5); // Mock change
    const changePercent = (change / currentPrice) * 100;
    const isPositive = change >= 0;

    return (
      <View key={symbol} style={styles.stockCard}>
        {score > 75 && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>{score.toFixed(0)}</Text>
          </View>
        )}
        
        <View style={styles.stockHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stockSymbol}>{symbol}</Text>
            <Text style={styles.stockName}>
              {symbol} • {analysis.marketStructure.trend.toUpperCase()}
            </Text>
          </View>
          
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.stockPrice}>${currentPrice.toFixed(2)}</Text>
            <Text style={[styles.stockChange, isPositive ? styles.positiveChange : styles.negativeChange]}>
              {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
            </Text>
          </View>

          {showAddButton ? (
            <Pressable
              onPress={() => addToWatchlistFromScanner(symbol)}
              style={{ marginLeft: 12, padding: 8, backgroundColor: "#00D4AA", borderRadius: 6 }}
            >
              <Ionicons name="add" size={16} color="#000000" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => removeFromWatchlist(symbol)}
              style={{ marginLeft: 12, padding: 8 }}
            >
              <Ionicons name="close" size={16} color="#FF5722" />
            </Pressable>
          )}
        </View>

        <View style={styles.stockMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>RSI</Text>
            <Text style={[styles.metricValue, { 
              color: analysis.indicators.rsi > 70 ? "#FF5722" : analysis.indicators.rsi < 30 ? "#00D4AA" : "#ffffff" 
            }]}>
              {analysis.indicators.rsi.toFixed(0)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Volume</Text>
            <Text style={[styles.metricValue, { 
              color: analysis.indicators.volume.ratio > 1.5 ? "#00D4AA" : "#ffffff" 
            }]}>
              {analysis.indicators.volume.ratio.toFixed(1)}x
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Signals</Text>
            <Text style={[styles.metricValue, { 
              color: analysis.signals.length > 0 ? "#00D4AA" : "#888888" 
            }]}>
              {analysis.signals.length}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Rating</Text>
            <Text style={[styles.metricValue, { 
              color: analysis.overallRating.score > 70 ? "#00D4AA" : 
                     analysis.overallRating.score > 30 ? "#ffffff" : "#FF5722" 
            }]}>
              {analysis.overallRating.score.toFixed(0)}
            </Text>
          </View>
        </View>

        {alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            {alerts.slice(0, 2).map((alert, index) => (
              <View key={index} style={styles.alertItem}>
                <Ionicons name="warning" size={12} color="#ffffff" />
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  const currentData = activeTab === "watchlist" ? watchlistData : scannerData;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Watchlist</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === "watchlist" 
            ? `${watchlist.length} symbols tracked`
            : "AI-powered market scanner"
          }
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "watchlist" ? styles.tabActive : styles.tabInactive]}
          onPress={() => setActiveTab("watchlist")}
        >
          <Text style={[styles.tabText, activeTab === "watchlist" ? styles.tabTextActive : styles.tabTextInactive]}>
            My Watchlist ({watchlist.length})
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.tab, activeTab === "scanner" ? styles.tabActive : styles.tabInactive]}
          onPress={() => setActiveTab("scanner")}
        >
          <Text style={[styles.tabText, activeTab === "scanner" ? styles.tabTextActive : styles.tabTextInactive]}>
            Market Scanner
          </Text>
        </Pressable>
      </View>

      {/* Scanner Filters */}
      {activeTab === "scanner" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Filters</Text>
          <View style={styles.filterRow}>
            {filterPresets.map(preset => (
              <Pressable
                key={preset.id}
                style={[
                  styles.filterChip,
                  selectedFilter === preset.id && styles.filterChipActive
                ]}
                onPress={() => setSelectedFilter(preset.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === preset.id && styles.filterChipTextActive
                ]}>
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4AA" />
        }
      >
        {/* Add Stock Button for Watchlist */}
        {activeTab === "watchlist" && (
          <Pressable
            style={{
              backgroundColor: "#00D4AA",
              borderRadius: 12,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#000000" />
            <Text style={{ color: "#000000", fontWeight: "600", marginLeft: 8 }}>
              Add Stock to Watchlist
            </Text>
          </Pressable>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D4AA" />
            <Text style={styles.loadingText}>
              {activeTab === "watchlist" ? "Loading watchlist..." : "Scanning market..."}
            </Text>
          </View>
        ) : currentData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#888888" />
            <Text style={styles.emptyStateText}>
              {activeTab === "watchlist" 
                ? "Your watchlist is empty.\nAdd some stocks to get started!"
                : "No stocks match your current filters.\nTry adjusting the filter settings."
              }
            </Text>
          </View>
        ) : (
          currentData.map(result => renderStockCard(result, activeTab === "scanner"))
        )}
      </ScrollView>

      {/* Add Stock Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Stock</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter stock symbol (e.g., AAPL)"
              placeholderTextColor="#888888"
              value={newSymbol}
              onChangeText={setNewSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Pressable style={styles.addButton} onPress={addToWatchlist}>
              <Text style={styles.addButtonText}>Add to Watchlist</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}