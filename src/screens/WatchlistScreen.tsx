import React, { useState, useEffect, useRef } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ScanResult } from "../services/marketScanner";
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
import { useTheme } from "../providers/ThemeProvider";
import { fetchBulkQuotes, type SimpleQuote } from "../services/quotes";
import { realtimeDataManager } from "../services/realtimeDataManager";
import { useFocusEffect } from "@react-navigation/native";

const { width: screenWidth } = Dimensions.get("window");

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.text },
    headerSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },

    // Watchlist selector
    watchlistSelector: {
      backgroundColor: "transparent",
      paddingHorizontal: 16,
      paddingBottom: 16, // Add proper bottom padding
    },
    watchlistChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: "transparent",
    },
    watchlistChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + "20",
    },
    watchlistChipText: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: "500",
    },
    watchlistChipTextActive: { color: theme.colors.primary },

    // Chart section
    chartSection: {
      backgroundColor: theme.colors.card,
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
    sectionTitle: { fontSize: 18, fontWeight: "600", color: theme.colors.text },

    // Add/Create modals
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
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
    modalTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.text },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      color: theme.colors.text,
      fontSize: 16,
      marginBottom: 16,
    },
    createButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
    },
    createButtonText: {
      color: theme.isDark ? "#ffffff" : "#000000",
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
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    stockResultItemSelected: {
      backgroundColor: theme.colors.primary + "20",
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    stockResultInfo: {
      flex: 1,
      marginRight: 12,
    },
    stockResultSymbol: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    stockResultName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    stockResultType: {
      fontSize: 10,
      color: theme.colors.primary,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    selectedStocksSection: {
      marginBottom: 16,
    },
    selectedStocksTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    selectedStockChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primary + "20",
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
      marginBottom: 8,
    },
    selectedStockText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "500",
      marginRight: 4,
    },

    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: { color: theme.colors.textSecondary, marginTop: 12 },

    emptyState: {
      alignItems: "center",
      padding: 32,
    },
    emptyStateText: {
      color: theme.colors.textSecondary,
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
  const { theme } = useTheme();
  const profile = useUserStore((s) => s.profile);
  const getActiveWatchlist = useUserStore((s) => s.getActiveWatchlist);
  const createWatchlist = useUserStore((s) => s.createWatchlist);
  const deleteWatchlist = useUserStore((s) => s.deleteWatchlist);
  const addToWatchlist = useUserStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useUserStore((s) => s.removeFromWatchlist);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const toggleGlobalFavorite = useUserStore((s) => s.toggleGlobalFavorite);
  const isGlobalFavorite = useUserStore((s) => s.isGlobalFavorite);
  const setActiveWatchlist = useUserStore((s) => s.setActiveWatchlist);

  const styles = createStyles(theme);

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
  const quotesSignatureRef = useRef<string | null>(null);
  const companyNamesRef = useRef<Record<string, string>>({});
  const stockDataRef = useRef<StockData[]>([]);
  useEffect(() => {
    stockDataRef.current = stockData;
  }, [stockData]);

  const activeWatchlist = getActiveWatchlist();

  useEffect(() => {
    loadDisplayData();
  }, [viewMode, selectedWatchlistId, profile.favorites, profile.watchlists]);

  // Start/stop real-time refresh when screen is focused/unfocused
  useFocusEffect(
    React.useCallback(() => {
      const computeSymbols = (): string[] => {
        if (viewMode === "favorites") return profile.favorites;
        if (selectedWatchlistId) {
          const watchlist = profile.watchlists.find(
            (w) => w.id === selectedWatchlistId
          );
          return watchlist?.items.map((item) => item.symbol) || [];
        }
        return [];
      };

      const symbols = computeSymbols();
      if (symbols && symbols.length > 0) {
        if (__DEV__)
          console.log(
            "🔄 Starting watchlist refresh for",
            symbols.length,
            "stocks"
          );
        realtimeDataManager.startWatchlistRefresh(symbols, () => {
          // Refresh callback - update the UI when new data arrives
          setRefreshing(false); // Ensure refresh indicator is off
        });
      }

      return () => {
        if (__DEV__) console.log("⏹️ Stopping watchlist refresh");
        realtimeDataManager.stopWatchlistRefresh();
      };
    }, [viewMode, selectedWatchlistId, profile.favorites, profile.watchlists])
  );

  // Poll cached quotes periodically so UI reflects background quote refreshes
  useEffect(() => {
    let isMounted = true;
    quotesSignatureRef.current = null; // reset when dependencies change

    const computeSymbols = (): string[] => {
      if (viewMode === "favorites") return profile.favorites;
      if (selectedWatchlistId) {
        const watchlist = profile.watchlists.find(
          (w) => w.id === selectedWatchlistId
        );
        return watchlist?.items.map((item) => item.symbol) || [];
      }
      return [];
    };

    const tick = async () => {
      if (!isMounted) return;
      const symbols = computeSymbols();
      if (!symbols || symbols.length === 0) return;

      try {
        const cached = await fetchBulkQuotes(symbols);
        if (!isMounted) return;

        const signature = symbols
          .map((s) => {
            const q = cached[s];
            return `${s}:${q?.last ?? 0}:${q?.change ?? 0}:${
              q?.changePercent ?? 0
            }`;
          })
          .join("|");

        if (signature === quotesSignatureRef.current) return;
        quotesSignatureRef.current = signature;

        // Build updated display data using existing company names when available
        const existingNameMap = new Map<string, string>();
        for (const sd of stockDataRef.current) {
          existingNameMap.set(sd.symbol, sd.companyName || sd.symbol);
        }

        const updated: StockData[] = symbols.map((symbol) => {
          const q = cached[symbol] as SimpleQuote | undefined;
          const price = q?.last ?? 0;
          const change = q?.change ?? 0;
          const pct = q?.changePercent ?? 0;
          return {
            symbol,
            analysis: {} as any,
            alerts: [],
            score: 0,
            currentPrice: price,
            change,
            changePercent: pct,
            companyName:
              companyNamesRef.current[symbol] ||
              existingNameMap.get(symbol) ||
              symbol,
          };
        });
        updated.sort((a, b) => b.changePercent - a.changePercent);
        setStockData(updated);

        // Backfill any missing names asynchronously and update list once
        const missingSymbols = symbols.filter(
          (s) =>
            !companyNamesRef.current[s] &&
            (!existingNameMap.get(s) || existingNameMap.get(s) === s)
        );
        if (missingSymbols.length > 0) {
          Promise.all(
            missingSymbols.map(async (s) => {
              try {
                const info = await getStockBySymbol(s);
                if (info?.name) companyNamesRef.current[s] = info.name;
              } catch {}
            })
          ).then(() => {
            const refreshed: StockData[] = symbols.map((symbol) => {
              const q = cached[symbol] as SimpleQuote | undefined;
              const price = q?.last ?? 0;
              const change = q?.change ?? 0;
              const pct = q?.changePercent ?? 0;
              return {
                symbol,
                analysis: {} as any,
                alerts: [],
                score: 0,
                currentPrice: price,
                change,
                changePercent: pct,
                companyName:
                  companyNamesRef.current[symbol] ||
                  existingNameMap.get(symbol) ||
                  symbol,
              };
            });
            refreshed.sort((a, b) => b.changePercent - a.changePercent);
            setStockData(refreshed);
          });
        }
      } catch {
        // ignore cache polling errors
      }
    };

    // Initial tick and interval
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
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

      // Preload company names in parallel
      const nameMap: Record<string, string> = {};
      await Promise.all(
        symbols.map(async (s) => {
          try {
            const info = await getStockBySymbol(s);
            if (info?.name) nameMap[s] = info.name;
          } catch {}
        })
      );
      Object.assign(companyNamesRef.current, nameMap);

      // Fetch fresh quotes from Polygon
      const cached = await fetchBulkQuotes(symbols);
      const hasAnyCached = Object.keys(cached).length > 0;
      if (hasAnyCached) {
        const immediate: StockData[] = symbols.map((symbol) => {
          const q = cached[symbol];
          const price = q?.last ?? 0;
          const change = q?.change ?? 0;
          const pct = q?.changePercent ?? 0;
          return {
            symbol,
            analysis: {} as any,
            alerts: [],
            score: 0,
            currentPrice: price,
            change,
            changePercent: pct,
            companyName:
              companyNamesRef.current[symbol] || nameMap[symbol] || symbol,
          };
        });
        immediate.sort((a, b) => b.changePercent - a.changePercent);
        setStockData(immediate);
        setLoading(false);
      }

      // Background fetch fresh quotes (bulk)
      const fresh = await fetchBulkQuotes(symbols);
      const updated: StockData[] = symbols.map((symbol) => {
        const q = fresh[symbol] as SimpleQuote | undefined;
        const price = q?.last ?? 0;
        const change = q?.change ?? 0;
        const pct = q?.changePercent ?? 0;
        return {
          symbol,
          analysis: {} as any,
          alerts: [],
          score: 0,
          currentPrice: price,
          change,
          changePercent: pct,
          companyName:
            companyNamesRef.current[symbol] || nameMap[symbol] || symbol,
        };
      });
      updated.sort((a, b) => b.changePercent - a.changePercent);
      setStockData(updated);
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

  function handleStockPress(stock: StockData) {
    // Navigate to dedicated stock detail page with initial quote for instant price
    (navigation as any).navigate("StockDetail", {
      symbol: stock.symbol,
      initialQuote: {
        symbol: stock.symbol,
        last: stock.currentPrice,
        change: stock.change,
        changePercent: stock.changePercent,
      },
    });
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
      <SafeAreaView style={styles.container} edges={["top"]}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Watchlists</Text>
            <Text style={styles.headerSubtitle}>Loading your stocks...</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading watchlist data...</Text>
          </View>
        </GestureHandlerRootView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
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
                      profile.watchlists.find(
                        (w) => w.id === selectedWatchlistId
                      )?.items.length || 0
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
              <Ionicons name="add" size={24} color={theme.colors.primary} />
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
                        ? theme.colors.primary
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
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.watchlistChipText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
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
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        >
          {stockData.length === 0 && loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.emptyStateText}>Loading stocks...</Text>
            </View>
          ) : stockData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={viewMode === "favorites" ? "star-outline" : "list"}
                size={48}
                color={theme.colors.textSecondary}
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
                  onPress={() => handleStockPress(stock)}
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
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              style={[styles.modalContent, { maxHeight: "85%" }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Watchlist</Text>
                <Pressable onPress={() => setShowCreateWatchlistModal(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>

              {/* Watchlist Info */}
              <TextInput
                style={styles.input}
                placeholder="Watchlist name"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWatchlistName}
                onChangeText={setNewWatchlistName}
              />

              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                placeholderTextColor={theme.colors.textSecondary}
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
                          <Ionicons
                            name="close"
                            size={14}
                            color={theme.colors.primary}
                          />
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
                disabled={
                  !newWatchlistName.trim() || selectedStocks.length === 0
                }
              >
                <Text style={styles.createButtonText}>
                  Create Watchlist{" "}
                  {selectedStocks.length > 0 &&
                    `(${selectedStocks.length} stocks)`}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add to Watchlist Modal */}
        <AddToWatchlistModal
          visible={showAddToWatchlistModal}
          onClose={() => setShowAddToWatchlistModal(false)}
        />
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}
