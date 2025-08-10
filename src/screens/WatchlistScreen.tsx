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
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
// Removed AdvancedTradingChart import - now handled in StockDetailScreen
import {
  searchStocks,
  getPopularStocks,
  type StockSearchResult,
} from "../services/stockSearch";
import { getStockBySymbol } from "../services/stockData";
import StockAutocomplete from "../components/common/StockAutocomplete";
import AddToWatchlistModal from "../components/common/AddToWatchlistModal";
import SwipeableStockItem from "../components/common/SwipeableStockItem";

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
  companyName?: string;
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
    toggleGlobalFavorite,
    isGlobalFavorite,
    setActiveWatchlist,
  } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stockData, setStockData] = useState<StockData[]>([]);
  // Removed chart-related states since we now navigate to StockDetailScreen

  // Modal states
  const [showCreateWatchlistModal, setShowCreateWatchlistModal] =
    useState(false);
  const [showAddToWatchlistModal, setShowAddToWatchlistModal] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newWatchlistDescription, setNewWatchlistDescription] = useState("");

  // View states
  const [viewMode, setViewMode] = useState<"favorites" | "watchlist">(
    "favorites"
  ); // Start with favorites like Robinhood
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(
    null
  );

  // Stock search states
  const [selectedStocks, setSelectedStocks] = useState<StockSearchResult[]>([]);
  const [favoriteStocks, setFavoriteStocks] = useState<Set<string>>(new Set());

  const activeWatchlist = getActiveWatchlist();

  useEffect(() => {
    loadDisplayData();
  }, [viewMode, selectedWatchlistId, profile.favorites, profile.watchlists]);

  useEffect(() => {
    // Reset selected stocks when modal opens
    if (showCreateWatchlistModal) {
      setSelectedStocks([]);
      setFavoriteStocks(new Set());
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

  async function loadDisplayData() {
    let symbols: string[] = [];

    // Get symbols based on current view mode
    if (viewMode === "favorites") {
      symbols = profile.favorites;
    } else if (selectedWatchlistId) {
      const watchlist = profile.watchlists.find(
        (w) => w.id === selectedWatchlistId
      );
      symbols = watchlist?.items.map((item) => item.symbol) || [];
    }

    if (symbols.length === 0) {
      setStockData([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const results: StockData[] = [];

      for (const symbol of symbols) {
        try {
          // Get company name first
          const stockInfo = await getStockBySymbol(symbol);
          const companyName = stockInfo?.name || symbol;

          const candles = await fetchCandles(symbol, { resolution: "D" });

          if (candles.length >= 2) {
            const analysis = await performComprehensiveAnalysis(symbol, {
              "1d": candles,
            });

            const currentPrice = candles[candles.length - 1]?.close || 0;
            const previousPrice =
              candles[candles.length - 2]?.close || currentPrice;
            const change = currentPrice - previousPrice;
            const changePercent =
              previousPrice > 0 ? (change / previousPrice) * 100 : 0;

            const stockData: StockData = {
              symbol,
              analysis,
              alerts: [],
              score: analysis.overallRating.score,
              currentPrice,
              change,
              changePercent,
              companyName,
            };

            results.push(stockData);
          } else {
            // Still add the stock even if we don't have full data
            const stockData: StockData = {
              symbol,
              analysis: {} as any, // Use placeholder analysis
              alerts: [],
              score: 0,
              currentPrice: 0,
              change: 0,
              changePercent: 0,
              companyName,
            };
            results.push(stockData);
          }
        } catch (error) {
          console.error(`Error loading data for ${symbol}:`, error);
          // Still add the stock with placeholder data
          const stockData: StockData = {
            symbol,
            analysis: {} as any, // Use placeholder analysis
            alerts: [],
            score: 0,
            currentPrice: 0,
            change: 0,
            changePercent: 0,
            companyName: symbol, // Fallback to symbol if we can't get name
          };
          results.push(stockData);
        }
      }

      // Sort by performance for now (can add favorites sorting later)
      results.sort((a, b) => b.changePercent - a.changePercent);

      setStockData(results);
    } catch (error) {
      console.error("Error loading display data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Removed loadChartData function - chart now handled in StockDetailScreen

  async function onRefresh() {
    setRefreshing(true);
    await loadDisplayData();
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
      setShowCreateWatchlistModal(false);

      // Refresh data
      loadDisplayData();
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
    if (viewMode === "favorites") {
      // Remove from global favorites
      toggleGlobalFavorite(symbol);
      loadDisplayData();
    } else if (selectedWatchlistId) {
      // Remove from specific watchlist
      const watchlist = profile.watchlists.find(
        (w) => w.id === selectedWatchlistId
      );
      if (!watchlist) return;

      Alert.alert("Remove Stock", `Remove ${symbol} from ${watchlist.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeFromWatchlist(selectedWatchlistId, symbol);
            loadDisplayData();
          },
        },
      ]);
    }
  }

  function handleStockPress(symbol: string) {
    // Navigate to dedicated stock detail page
    (navigation as any).navigate("StockDetail", { symbol });
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
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Watchlists</Text>
          <Text style={styles.headerSubtitle}>Loading your stocks...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Loading watchlist data...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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
            <Text style={styles.headerTitle}>
              {viewMode === "favorites"
                ? "Favorites"
                : selectedWatchlistId
                ? profile.watchlists.find((w) => w.id === selectedWatchlistId)
                    ?.name || "Watchlist"
                : "Watchlists"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {viewMode === "favorites"
                ? `${profile.favorites.length} favorite${
                    profile.favorites.length !== 1 ? "s" : ""
                  }`
                : selectedWatchlistId
                ? `${
                    profile.watchlists.find((w) => w.id === selectedWatchlistId)
                      ?.items.length || 0
                  } stocks`
                : `${profile.watchlists.length} watchlist${
                    profile.watchlists.length !== 1 ? "s" : ""
                  }`}
            </Text>
          </View>
          <Pressable
            style={{ padding: 8 }}
            onPress={() => setShowAddToWatchlistModal(true)}
          >
            <Ionicons name="add" size={24} color="#00D4AA" />
          </Pressable>
        </View>
      </View>

      {/* View Selector - Favorites and Watchlists */}
      <View style={styles.watchlistSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
            {/* Favorites Option */}
            <Pressable
              style={[
                styles.watchlistChip,
                viewMode === "favorites" &&
                  !selectedWatchlistId &&
                  styles.watchlistChipActive,
              ]}
              onPress={() => {
                setViewMode("favorites");
                setSelectedWatchlistId(null);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="star"
                  size={12}
                  color={
                    viewMode === "favorites" && !selectedWatchlistId
                      ? "#00D4AA"
                      : "#FFD700"
                  }
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.watchlistChipText,
                    viewMode === "favorites" &&
                      !selectedWatchlistId &&
                      styles.watchlistChipTextActive,
                  ]}
                >
                  Favorites
                </Text>
              </View>
            </Pressable>

            {/* Individual Watchlists */}
            {profile.watchlists.map((watchlist) => (
              <Pressable
                key={watchlist.id}
                style={[
                  styles.watchlistChip,
                  selectedWatchlistId === watchlist.id &&
                    styles.watchlistChipActive,
                ]}
                onPress={() => {
                  setViewMode("watchlist");
                  setSelectedWatchlistId(watchlist.id);
                }}
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
                      selectedWatchlistId === watchlist.id &&
                        styles.watchlistChipTextActive,
                    ]}
                  >
                    {watchlist.name}
                  </Text>
                </View>
              </Pressable>
            ))}

            {/* Create New Watchlist */}
            <Pressable
              style={[styles.watchlistChip, { borderStyle: "dashed" }]}
              onPress={() => setShowCreateWatchlistModal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="add"
                  size={12}
                  color="#888888"
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.watchlistChipText, { color: "#888888" }]}>
                  New List
                </Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      {/* Chart Section Removed - Now handled in StockDetailScreen */}

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
        {stockData.length === 0 && loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#00D4AA" />
            <Text style={styles.emptyStateText}>Loading stocks...</Text>
          </View>
        ) : stockData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={viewMode === "favorites" ? "star-outline" : "list"}
              size={48}
              color="#888888"
            />
            <Text style={styles.emptyStateText}>
              {viewMode === "favorites"
                ? "No favorites yet\nTap the star to add favorites!"
                : selectedWatchlistId
                ? "This watchlist is empty\nAdd some stocks to get started!"
                : "Select a watchlist or view favorites"}
            </Text>
          </View>
        ) : (
          stockData.map((stock) => {
            const isGlobalFav = isGlobalFavorite(stock.symbol);

            return (
              <SwipeableStockItem
                key={stock.symbol}
                symbol={stock.symbol}
                companyName={stock.companyName}
                currentPrice={stock.currentPrice}
                change={stock.change}
                changePercent={stock.changePercent}
                isGlobalFavorite={isGlobalFav}
                onPress={() => handleStockPress(stock.symbol)}
                onToggleFavorite={() => toggleGlobalFavorite(stock.symbol)}
                onRemove={() => handleRemoveStock(stock.symbol)}
              />
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
              <StockAutocomplete
                onStockSelect={handleStockSelect}
                selectedStocks={selectedStocks}
                maxResults={15}
                placeholder="Search from 6,000+ NASDAQ stocks..."
                containerStyle={{ marginBottom: 16 }}
              />
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

      {/* Add to Watchlist Modal */}
      <AddToWatchlistModal
        visible={showAddToWatchlistModal}
        onClose={() => setShowAddToWatchlistModal(false)}
      />
    </GestureHandlerRootView>
  );
}
