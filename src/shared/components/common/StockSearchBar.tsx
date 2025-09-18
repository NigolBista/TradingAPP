import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchStocksAutocomplete } from "../../../../shared/services/stockData";
import type { StockSearchResult } from "../../../../shared/services/stockSearch";

interface StockSearchBarProps {
  currentSymbol: string;
  currentStockName: string;
  displayOnly?: boolean; // When true, only shows stock info without search functionality
}

// Popular stocks to show by default
const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "META", name: "Meta Platforms, Inc." },
  { symbol: "NFLX", name: "Netflix, Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
];

export default function StockSearchBar({
  currentSymbol,
  currentStockName,
  displayOnly = false,
}: StockSearchBarProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [defaultStocks, setDefaultStocks] = useState<StockSearchResult[]>([]);
  const [recentStocks, setRecentStocks] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Load default and recent stocks when modal opens
  useEffect(() => {
    if (isModalVisible) {
      loadDefaultStocks();
      loadRecentStocks();
    }
  }, [isModalVisible]);

  const loadDefaultStocks = async () => {
    try {
      const results = POPULAR_STOCKS.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        type: "stock" as const,
      }));
      setDefaultStocks(results);
    } catch (error) {
      console.error("Error loading default stocks:", error);
    }
  };

  const loadRecentStocks = () => {
    // For now, we'll just show the current stock as "recent"
    // In a real app, you'd load this from AsyncStorage or similar
    const recent: StockSearchResult[] = [
      {
        symbol: currentSymbol,
        name: currentStockName,
        type: "stock",
      },
    ];
    setRecentStocks(recent);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchStocksAutocomplete(query, 10);
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStockSelect = (symbol: string) => {
    setIsModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);

    // Navigate to the selected stock
    (navigation as any).replace("StockDetail", { symbol });
  };

  return (
    <>
      {/* Search Bar Display */}
      {displayOnly ? (
        // Display-only mode: just show stock info without search interaction
        <View style={styles.stockInfoDisplay}>
          <Text style={styles.symbolText}>{currentSymbol}</Text>
          <Text style={styles.nameText} numberOfLines={1}>
            {currentStockName}
          </Text>
        </View>
      ) : (
        // Interactive mode: clickable search bar
        <Pressable
          style={styles.searchBar}
          onPress={() => setIsModalVisible(true)}
        >
          <Ionicons name="search" size={16} color="#888" />
          <View style={styles.stockInfo}>
            <Text style={styles.symbolText}>{currentSymbol}</Text>
            <Text style={styles.nameText} numberOfLines={1}>
              {currentStockName}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#888" />
        </Pressable>
      )}

      {/* Search Modal - Only render when not in display-only mode */}
      {!displayOnly && (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Search Stocks</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Search Input - Now in the detail screen area */}
            <View style={styles.searchSection}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={16} color="#888" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search stocks..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => handleSearch("")}>
                    <Ionicons name="close-circle" size={16} color="#888" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Stock Lists */}
            <ScrollView style={styles.resultsContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#00D4AA" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : searchQuery.length > 0 ? (
                // Show search results
                searchResults.length === 0 ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No stocks found</Text>
                  </View>
                ) : (
                  searchResults.map((stock, index) => (
                    <Pressable
                      key={`search-${stock.symbol}-${index}`}
                      style={styles.resultItem}
                      onPress={() => handleStockSelect(stock.symbol)}
                    >
                      <View style={styles.resultContent}>
                        <Text style={styles.resultSymbol}>{stock.symbol}</Text>
                        <Text style={styles.resultName} numberOfLines={2}>
                          {stock.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#888" />
                    </Pressable>
                  ))
                )
              ) : (
                // Show recent and popular stocks
                <>
                  {recentStocks.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>Recent</Text>
                      {recentStocks.map((stock, index) => (
                        <Pressable
                          key={`recent-${stock.symbol}-${index}`}
                          style={styles.resultItem}
                          onPress={() => handleStockSelect(stock.symbol)}
                        >
                          <View style={styles.resultContent}>
                            <Text style={styles.resultSymbol}>
                              {stock.symbol}
                            </Text>
                            <Text style={styles.resultName} numberOfLines={2}>
                              {stock.name}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#888"
                          />
                        </Pressable>
                      ))}
                    </>
                  )}

                  <Text style={styles.sectionTitle}>Popular</Text>
                  {defaultStocks.map((stock, index) => (
                    <Pressable
                      key={`popular-${stock.symbol}-${index}`}
                      style={styles.resultItem}
                      onPress={() => handleStockSelect(stock.symbol)}
                    >
                      <View style={styles.resultContent}>
                        <Text style={styles.resultSymbol}>{stock.symbol}</Text>
                        <Text style={styles.resultName} numberOfLines={2}>
                          {stock.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#888" />
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flex: 1,
    // marginRight: 12,
  },
  stockInfo: {
    flex: 1,
    marginLeft: 8,
  },
  stockInfoDisplay: {
    flex: 1,
    marginRight: 12,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  nameText: {
    fontSize: 12,
    color: "#888",
    marginTop: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  cancelButton: {
    padding: 4,
  },
  cancelText: {
    fontSize: 16,
    color: "#00D4AA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    marginLeft: 8,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    color: "#888",
    marginLeft: 8,
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noResultsText: {
    color: "#888",
    fontSize: 16,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  resultContent: {
    flex: 1,
  },
  resultSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  resultName: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: "#0a0a0a",
  },
});
