import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StockSearchResult } from "../../services/stockSearch";
import {
  searchStocksAutocomplete,
  preloadStocksData,
  getLoadingStatus,
} from "../../services/stockData";

const { width: screenWidth } = Dimensions.get("window");

interface StockAutocompleteProps {
  onStockSelect: (stock: StockSearchResult) => void;
  placeholder?: string;
  maxResults?: number;
  selectedStocks?: StockSearchResult[];
  showSelectedBadge?: boolean;
  style?: any;
  inputStyle?: any;
  containerStyle?: any;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#333333",
  },
  inputFocused: {
    borderColor: "#00D4AA",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -10,
  },
  resultsContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "#333333",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  lastResultItem: {
    borderBottomWidth: 0,
  },
  resultSelected: {
    backgroundColor: "#00D4AA20",
  },
  resultInfo: {
    flex: 1,
  },
  resultSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  resultName: {
    fontSize: 14,
    color: "#cccccc",
    marginTop: 2,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  resultType: {
    fontSize: 12,
    color: "#00D4AA",
    textTransform: "uppercase",
    fontWeight: "600",
    marginRight: 8,
  },
  resultSector: {
    fontSize: 12,
    color: "#888888",
  },
  resultMarketCap: {
    fontSize: 12,
    color: "#888888",
    marginLeft: 8,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingText: {
    color: "#888888",
    marginTop: 8,
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noResultsText: {
    color: "#888888",
    fontSize: 14,
  },
  selectedBadge: {
    backgroundColor: "#00D4AA",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  selectedBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
});

export default function StockAutocomplete({
  onStockSelect,
  placeholder = "Search stocks by symbol or name...",
  maxResults = 10,
  selectedStocks = [],
  showSelectedBadge = true,
  style,
  inputStyle,
  containerStyle,
}: StockAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Format market cap for display
  const formatMarketCap = (marketCap: number | undefined): string => {
    if (!marketCap || marketCap <= 0) return "";

    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(1)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(1)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(1)}M`;
    } else {
      return `$${marketCap.toLocaleString()}`;
    }
  };

  // Check if stock is already selected
  const isStockSelected = (stock: StockSearchResult): boolean => {
    return selectedStocks.some((s) => s.symbol === stock.symbol);
  };

  // Preload data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await preloadStocksData();
        setDataReady(true);
      } catch (error) {
        console.error("Failed to preload stocks data:", error);
      }
    };

    const status = getLoadingStatus();
    if (status.isReady) {
      setDataReady(true);
    } else {
      loadData();
    }
  }, []);

  // Instant search function (no debounce needed since it's now instant)
  useEffect(() => {
    if (!dataReady) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (query.trim().length === 0) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Very short debounce to avoid too many rapid searches while typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchStocksAutocomplete(query, maxResults);
        setResults(searchResults);
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      }
    }, 50); // Much shorter debounce since search is now instant

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, maxResults, dataReady]);

  const handleStockSelect = (stock: StockSearchResult) => {
    onStockSelect(stock);
    setQuery("");
    setShowResults(false);
  };

  const clearInput = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, focused && styles.inputFocused, inputStyle]}
          placeholder={dataReady ? placeholder : "Loading stock data..."}
          placeholderTextColor="#888888"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Delay hiding results to allow for selection
            setTimeout(() => setShowResults(false), 150);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          editable={dataReady}
        />
        {query.length > 0 && (
          <Pressable style={styles.clearButton} onPress={clearInput}>
            <Ionicons name="close-circle" size={20} color="#888888" />
          </Pressable>
        )}
      </View>

      {(showResults || (!dataReady && query.length > 0)) && (
        <View style={styles.resultsContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!dataReady ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#00D4AA" />
                <Text style={styles.loadingText}>
                  Loading stock database...
                </Text>
              </View>
            ) : loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#00D4AA" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No stocks found</Text>
              </View>
            ) : (
              results.map((stock, index) => {
                const isSelected = isStockSelected(stock);
                const isLast = index === results.length - 1;

                return (
                  <Pressable
                    key={stock.symbol}
                    style={[
                      styles.resultItem,
                      isLast && styles.lastResultItem,
                      isSelected && styles.resultSelected,
                    ]}
                    onPress={() => handleStockSelect(stock)}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultSymbol}>{stock.symbol}</Text>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {stock.name}
                      </Text>
                      <View style={styles.resultMeta}>
                        <Text style={styles.resultType}>{stock.type}</Text>
                        {stock.sector && (
                          <Text style={styles.resultSector} numberOfLines={1}>
                            {stock.sector}
                          </Text>
                        )}
                        {stock.marketCap && (
                          <Text style={styles.resultMarketCap}>
                            {formatMarketCap(stock.marketCap)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {isSelected && showSelectedBadge && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>ADDED</Text>
                      </View>
                    )}

                    <Ionicons
                      name={
                        isSelected ? "checkmark-circle" : "add-circle-outline"
                      }
                      size={24}
                      color={isSelected ? "#00D4AA" : "#888888"}
                      style={{ marginLeft: 8 }}
                    />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
