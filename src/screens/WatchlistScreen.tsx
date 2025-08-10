import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  MarketScanner,
  ScanResult,
  ScanFilter,
} from "../services/marketScanner";
import { fetchCandles } from "../services/marketProviders";
import { performComprehensiveAnalysis } from "../services/aiAnalytics";
import {
  useUserStore,
  type Watchlist,
  type WatchlistItem,
} from "../store/userStore";
import AdvancedTradingChart, {
  type LWCDatum,
} from "../components/charts/AdvancedTradingChart";
import {
  searchStocks,
  getPopularStocks,
  type StockSearchResult,
} from "../services/stockSearch";

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  headerSubtitle: { color: "#888888", fontSize: 14, marginTop: 4 },

  // Watchlist selector
  watchlistSelector: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  watchlistChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "transparent",
  },
  watchlistChipActive: { borderColor: "#00D4AA", backgroundColor: "#00D4AA20" },
  watchlistChipText: { fontSize: 12, color: "#ffffff", fontWeight: "500" },
  watchlistChipTextActive: { color: "#00D4AA" },

  // Chart section
  chartSection: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#ffffff" },

  // Stock cards
  stockCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  stockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stockSymbol: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
  stockPrice: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  stockChange: { fontSize: 14, fontWeight: "500" },
  positiveChange: { color: "#00D4AA" },
  negativeChange: { color: "#FF5722" },
  favoriteButton: { padding: 8 },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metricItem: { alignItems: "center" },
  metricLabel: { fontSize: 12, color: "#888888", marginBottom: 4 },
  metricValue: { fontSize: 14, fontWeight: "600", color: "#ffffff" },

  // Add/Create modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#ffffff" },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: "#00D4AA",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  createButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },

  // Stock selection
  stockSearchSection: {
    marginBottom: 16,
  },
  stockSearchInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 12,
  },
  stockResultsContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  stockResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  stockResultItemSelected: {
    backgroundColor: "#00D4AA20",
    borderWidth: 1,
    borderColor: "#00D4AA",
  },
  stockResultInfo: {
    flex: 1,
    marginRight: 12,
  },
  stockResultSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  stockResultName: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  stockResultType: {
    fontSize: 10,
    color: "#00D4AA",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  selectedStocksSection: {
    marginBottom: 16,
  },
  selectedStocksTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  selectedStockChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00D4AA20",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedStockText: {
    color: "#00D4AA",
    fontSize: 14,
    fontWeight: "500",
    marginRight: 4,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#888888", marginTop: 12 },

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

interface StockData extends ScanResult {
  currentPrice: number;
  change: number;
  changePercent: number;
}

export default function WatchlistScreen() {
  const navigation = useNavigation();
  const {
    profile,
    getActiveWatchlist,
    createWatchlist,
    deleteWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleFavorite,
    setActiveWatchlist,
  } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [chartData, setChartData] = useState<LWCDatum[]>([]);

  // Modal states
  const [showCreateWatchlistModal, setShowCreateWatchlistModal] =
    useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newWatchlistDescription, setNewWatchlistDescription] = useState("");

  // Stock search states
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<StockSearchResult[]>([]);
  const [favoriteStocks, setFavoriteStocks] = useState<Set<string>>(new Set());

  const activeWatchlist = getActiveWatchlist();

  useEffect(() => {
    loadWatchlistData();
  }, [profile.activeWatchlistId, activeWatchlist]);

  useEffect(() => {
    async function performSearch() {
      const results = await searchStocks(stockSearchQuery);
      setSearchResults(results);
    }
    performSearch();
  }, [stockSearchQuery]);

  useEffect(() => {
    // Load popular stocks when modal opens
    if (showCreateWatchlistModal) {
      const popular = getPopularStocks();
      setSearchResults(popular);
    }
  }, [showCreateWatchlistModal]);

  // Remove auto-selection of stocks - let user choose when to show chart
  // useEffect(() => {
  //   if (activeWatchlist && activeWatchlist.items.length > 0 && !selectedStock) {
  //     // Auto-select first favorite or first stock
  //     const firstFavorite = activeWatchlist.items.find(
  //       (item) => item.isFavorite
  //     );
  //     const stockToSelect =
  //       firstFavorite?.symbol || activeWatchlist.items[0]?.symbol;
  //     if (stockToSelect) {
  //       setSelectedStock(stockToSelect);
  //       loadChartData(stockToSelect);
  //     }
  //   }
  // }, [activeWatchlist, selectedStock]);

  async function loadWatchlistData() {
    if (!activeWatchlist || activeWatchlist.items.length === 0) {
      setStockData([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const results: StockData[] = [];

      for (const item of activeWatchlist.items) {
        try {
          const candles = await fetchCandles(item.symbol, { resolution: "D" });

          if (candles.length >= 2) {
            const analysis = await performComprehensiveAnalysis(item.symbol, {
              "1d": candles,
            });

            const currentPrice = candles[candles.length - 1]?.close || 0;
            const previousPrice =
              candles[candles.length - 2]?.close || currentPrice;
            const change = currentPrice - previousPrice;
            const changePercent =
              previousPrice > 0 ? (change / previousPrice) * 100 : 0;

            const stockData: StockData = {
              symbol: item.symbol,
              analysis,
              alerts: [],
              score: analysis.overallRating.score,
              currentPrice,
              change,
              changePercent,
            };

            results.push(stockData);
          } else {
            // Still add the stock even if we don't have full data
            const stockData: StockData = {
              symbol: item.symbol,
              analysis: {} as any, // Use placeholder analysis
              alerts: [],
              score: 0,
              currentPrice: 0,
              change: 0,
              changePercent: 0,
            };
            results.push(stockData);
          }
        } catch (error) {
          console.error(`Error loading data for ${item.symbol}:`, error);
          // Still add the stock with placeholder data
          const stockData: StockData = {
            symbol: item.symbol,
            analysis: {} as any, // Use placeholder analysis
            alerts: [],
            score: 0,
            currentPrice: 0,
            change: 0,
            changePercent: 0,
          };
          results.push(stockData);
        }
      }

      // Sort by favorites first, then by performance
      results.sort((a, b) => {
        const aFavorite = activeWatchlist.items.find(
          (item) => item.symbol === a.symbol
        )?.isFavorite;
        const bFavorite = activeWatchlist.items.find(
          (item) => item.symbol === b.symbol
        )?.isFavorite;

        if (aFavorite && !bFavorite) return -1;
        if (!aFavorite && bFavorite) return 1;
        return b.changePercent - a.changePercent;
      });

      setStockData(results);
    } catch (error) {
      console.error("Error loading watchlist data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadChartData(symbol: string) {
    try {
      const candles = await fetchCandles(symbol, { resolution: "D" });
      const lwcData: LWCDatum[] = candles.map((candle) => ({
        time: (candle as any).timestamp
          ? (candle as any).timestamp / 1000
          : Date.now() / 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      }));
      setChartData(lwcData);
    } catch (error) {
      console.error("Error loading chart data:", error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadWatchlistData();
  }

  function handleCreateWatchlist() {
    if (newWatchlistName.trim()) {
      const watchlistId = createWatchlist(
        newWatchlistName.trim(),
        newWatchlistDescription.trim() || undefined
      );

      // Add selected stocks to the new watchlist
      selectedStocks.forEach((stock) => {
        addToWatchlist(watchlistId, stock.symbol);
        if (favoriteStocks.has(stock.symbol)) {
          toggleFavorite(watchlistId, stock.symbol);
        }
      });

      // Reset form
      setNewWatchlistName("");
      setNewWatchlistDescription("");
      setSelectedStocks([]);
      setFavoriteStocks(new Set());
      setStockSearchQuery("");
      setShowCreateWatchlistModal(false);

      // Refresh data
      loadWatchlistData();
    }
  }

  function handleStockSelect(stock: StockSearchResult) {
    const isSelected = selectedStocks.some((s) => s.symbol === stock.symbol);
    if (isSelected) {
      setSelectedStocks((prev) =>
        prev.filter((s) => s.symbol !== stock.symbol)
      );
      setFavoriteStocks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stock.symbol);
        return newSet;
      });
    } else {
      setSelectedStocks((prev) => [...prev, stock]);
    }
  }

  function handleStockFavorite(symbol: string) {
    setFavoriteStocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  }

  function handleRemoveStock(symbol: string) {
    if (!activeWatchlist) return;

    Alert.alert(
      "Remove Stock",
      `Remove ${symbol} from ${activeWatchlist.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeFromWatchlist(activeWatchlist.id, symbol);
            if (selectedStock === symbol) {
              setSelectedStock(null);
            }
            loadWatchlistData();
          },
        },
      ]
    );
  }

  function handleToggleFavorite(symbol: string) {
    if (!activeWatchlist) return;
    toggleFavorite(activeWatchlist.id, symbol);
    loadWatchlistData();
  }

  function handleChartStockSelect(symbol: string) {
    setSelectedStock(symbol);
    loadChartData(symbol);
  }

  function handleDeleteWatchlist(watchlistId: string) {
    const watchlist = profile.watchlists.find((w) => w.id === watchlistId);
    if (!watchlist || watchlist.isDefault) return;

    Alert.alert(
      "Delete Watchlist",
      `Delete "${watchlist.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteWatchlist(watchlistId),
        },
      ]
    );
  }

  if (loading && stockData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Watchlists</Text>
          <Text style={styles.headerSubtitle}>Loading your stocks...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Loading watchlist data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={styles.headerTitle}>Watchlists</Text>
            <Text style={styles.headerSubtitle}>
              {activeWatchlist?.name} • {activeWatchlist?.items.length || 0}{" "}
              stocks
            </Text>
          </View>
          <Pressable
            style={{ padding: 8 }}
            onPress={() => setShowCreateWatchlistModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#00D4AA" />
          </Pressable>
        </View>
      </View>

      {/* Watchlist Selector */}
      <View style={styles.watchlistSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
            {profile.watchlists.map((watchlist) => (
              <Pressable
                key={watchlist.id}
                style={[
                  styles.watchlistChip,
                  profile.activeWatchlistId === watchlist.id &&
                    styles.watchlistChipActive,
                ]}
                onPress={() => setActiveWatchlist(watchlist.id)}
                onLongPress={() =>
                  !watchlist.isDefault && handleDeleteWatchlist(watchlist.id)
                }
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: watchlist.color,
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={[
                      styles.watchlistChipText,
                      profile.activeWatchlistId === watchlist.id &&
                        styles.watchlistChipTextActive,
                    ]}
                  >
                    {watchlist.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Chart Section */}
      {selectedStock && chartData.length > 0 && (
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>{selectedStock} Chart</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                onPress={() =>
                  (navigation as any).navigate("StockDetail", {
                    symbol: selectedStock,
                  })
                }
                style={{ padding: 4 }}
              >
                <Ionicons name="expand" size={20} color="#00D4AA" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setSelectedStock(null);
                  setChartData([]);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={20} color="#888888" />
              </Pressable>
            </View>
          </View>
          <AdvancedTradingChart
            data={chartData}
            height={300}
            symbol={selectedStock}
            currentPrice={
              stockData.find((s) => s.symbol === selectedStock)?.currentPrice ||
              0
            }
            priceChange={
              stockData.find((s) => s.symbol === selectedStock)?.change || 0
            }
            priceChangePercent={
              stockData.find((s) => s.symbol === selectedStock)
                ?.changePercent || 0
            }
          />
        </View>
      )}

      {/* Stocks List */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {!activeWatchlist || activeWatchlist.items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="list" size={48} color="#888888" />
            <Text style={styles.emptyStateText}>
              No stocks in this watchlist.{"\n"}
              Add some stocks to get started!
            </Text>
          </View>
        ) : stockData.length === 0 && loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#00D4AA" />
            <Text style={styles.emptyStateText}>
              Loading {activeWatchlist.items.length} stocks...
            </Text>
          </View>
        ) : stockData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle" size={48} color="#FF5722" />
            <Text style={styles.emptyStateText}>
              Failed to load stock data.{"\n"}
              Pull down to refresh.
            </Text>
          </View>
        ) : (
          stockData.map((stock) => {
            const item = activeWatchlist.items.find(
              (i) => i.symbol === stock.symbol
            );
            const isSelected = selectedStock === stock.symbol;

            return (
              <Pressable
                key={stock.symbol}
                style={[
                  styles.stockCard,
                  isSelected && { borderWidth: 1, borderColor: "#00D4AA" },
                ]}
                onPress={() => handleChartStockSelect(stock.symbol)}
              >
                <View style={styles.stockHeader}>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                      {item?.isFavorite && (
                        <Ionicons
                          name="star"
                          size={16}
                          color="#FFD700"
                          style={{ marginLeft: 8 }}
                        />
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.stockPrice}>
                      ${stock.currentPrice.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.stockChange,
                        stock.change >= 0
                          ? styles.positiveChange
                          : styles.negativeChange,
                      ]}
                    >
                      {stock.change >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginLeft: 12,
                    }}
                  >
                    {isSelected ? (
                      <View style={{ alignItems: "center", marginRight: 8 }}>
                        <Ionicons name="bar-chart" size={16} color="#00D4AA" />
                        <Text
                          style={{
                            fontSize: 9,
                            color: "#00D4AA",
                            marginTop: 1,
                          }}
                        >
                          Chart
                        </Text>
                      </View>
                    ) : (
                      <View style={{ alignItems: "center", marginRight: 8 }}>
                        <Ionicons
                          name="bar-chart-outline"
                          size={16}
                          color="#888888"
                        />
                        <Text
                          style={{
                            fontSize: 9,
                            color: "#888888",
                            marginTop: 1,
                          }}
                        >
                          Chart
                        </Text>
                      </View>
                    )}

                    <Pressable
                      style={styles.favoriteButton}
                      onPress={() => handleToggleFavorite(stock.symbol)}
                    >
                      <Ionicons
                        name={item?.isFavorite ? "star" : "star-outline"}
                        size={20}
                        color={item?.isFavorite ? "#FFD700" : "#888888"}
                      />
                    </Pressable>

                    <Pressable
                      style={styles.favoriteButton}
                      onPress={() => handleRemoveStock(stock.symbol)}
                    >
                      <Ionicons name="close" size={20} color="#FF5722" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>RSI</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        {
                          color:
                            stock.analysis?.indicators?.rsi > 70
                              ? "#FF5722"
                              : stock.analysis?.indicators?.rsi < 30
                              ? "#00D4AA"
                              : "#ffffff",
                        },
                      ]}
                    >
                      {stock.analysis?.indicators?.rsi?.toFixed(0) || "—"}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Volume</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        {
                          color:
                            stock.analysis?.indicators?.volume?.ratio > 1.5
                              ? "#00D4AA"
                              : "#ffffff",
                        },
                      ]}
                    >
                      {stock.analysis?.indicators?.volume?.ratio?.toFixed(1) ||
                        "—"}
                      x
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Signals</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        {
                          color:
                            (stock.analysis?.signals?.length || 0) > 0
                              ? "#00D4AA"
                              : "#888888",
                        },
                      ]}
                    >
                      {stock.analysis?.signals?.length || 0}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Score</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        {
                          color:
                            (stock.analysis?.overallRating?.score || 0) > 70
                              ? "#00D4AA"
                              : (stock.analysis?.overallRating?.score || 0) > 30
                              ? "#ffffff"
                              : "#FF5722",
                        },
                      ]}
                    >
                      {stock.analysis?.overallRating?.score?.toFixed(0) || "—"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Create Watchlist Modal */}
      <Modal
        visible={showCreateWatchlistModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateWatchlistModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={[styles.modalContent, { maxHeight: "90%" }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Watchlist</Text>
              <Pressable onPress={() => setShowCreateWatchlistModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </Pressable>
            </View>

            {/* Watchlist Info */}
            <TextInput
              style={styles.input}
              placeholder="Watchlist name"
              placeholderTextColor="#888888"
              value={newWatchlistName}
              onChangeText={setNewWatchlistName}
            />

            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#888888"
              value={newWatchlistDescription}
              onChangeText={setNewWatchlistDescription}
              multiline
              numberOfLines={3}
            />

            {/* Stock Search */}
            <View style={styles.stockSearchSection}>
              <Text style={styles.selectedStocksTitle}>Add Stocks</Text>
              <TextInput
                style={styles.stockSearchInput}
                placeholder="Search stocks by symbol or name..."
                placeholderTextColor="#888888"
                value={stockSearchQuery}
                onChangeText={setStockSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Search Results */}
              <ScrollView
                style={styles.stockResultsContainer}
                showsVerticalScrollIndicator={false}
              >
                {searchResults.map((stock) => {
                  const isSelected = selectedStocks.some(
                    (s) => s.symbol === stock.symbol
                  );
                  const isFavorite = favoriteStocks.has(stock.symbol);

                  return (
                    <Pressable
                      key={stock.symbol}
                      style={[
                        styles.stockResultItem,
                        isSelected && styles.stockResultItemSelected,
                      ]}
                      onPress={() => handleStockSelect(stock)}
                    >
                      <View style={styles.stockResultInfo}>
                        <Text style={styles.stockResultSymbol}>
                          {stock.symbol}
                        </Text>
                        <Text style={styles.stockResultName}>{stock.name}</Text>
                        <Text style={styles.stockResultType}>{stock.type}</Text>
                      </View>

                      {isSelected && (
                        <Pressable
                          style={{ padding: 4, marginRight: 8 }}
                          onPress={() => handleStockFavorite(stock.symbol)}
                        >
                          <Ionicons
                            name={isFavorite ? "star" : "star-outline"}
                            size={20}
                            color={isFavorite ? "#FFD700" : "#888888"}
                          />
                        </Pressable>
                      )}

                      <Ionicons
                        name={
                          isSelected ? "checkmark-circle" : "add-circle-outline"
                        }
                        size={24}
                        color={isSelected ? "#00D4AA" : "#888888"}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Stocks */}
            {selectedStocks.length > 0 && (
              <View style={styles.selectedStocksSection}>
                <Text style={styles.selectedStocksTitle}>
                  Selected Stocks ({selectedStocks.length})
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {selectedStocks.map((stock) => (
                    <View key={stock.symbol} style={styles.selectedStockChip}>
                      <Text style={styles.selectedStockText}>
                        {stock.symbol}
                      </Text>
                      {favoriteStocks.has(stock.symbol) && (
                        <Ionicons
                          name="star"
                          size={12}
                          color="#FFD700"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Pressable onPress={() => handleStockSelect(stock)}>
                        <Ionicons name="close" size={14} color="#00D4AA" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              style={[
                styles.createButton,
                (!newWatchlistName.trim() || selectedStocks.length === 0) && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleCreateWatchlist}
              disabled={!newWatchlistName.trim() || selectedStocks.length === 0}
            >
              <Text style={styles.createButtonText}>
                Create Watchlist{" "}
                {selectedStocks.length > 0 &&
                  `(${selectedStocks.length} stocks)`}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
