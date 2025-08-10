import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore, type Watchlist } from "../../store/userStore";
import { StockSearchResult } from "../../services/stockSearch";
import StockAutocomplete from "./StockAutocomplete";

interface AddToWatchlistModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStock?: StockSearchResult | null;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  favoriteSection: {
    marginBottom: 20,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  favoriteButtonActive: {
    backgroundColor: "#FFD700",
  },
  favoriteIcon: {
    marginRight: 12,
  },
  favoriteText: {
    flex: 1,
    fontSize: 16,
    color: "#ffffff",
  },
  favoriteTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  watchlistsSection: {
    marginBottom: 20,
  },
  watchlistItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  watchlistItemSelected: {
    backgroundColor: "#00D4AA20",
    borderWidth: 1,
    borderColor: "#00D4AA",
  },
  watchlistIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  watchlistInfo: {
    flex: 1,
  },
  watchlistName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  watchlistCount: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  selectedStock: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedStockInfo: {
    flex: 1,
  },
  selectedStockSymbol: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  selectedStockName: {
    fontSize: 14,
    color: "#cccccc",
    marginTop: 2,
  },
  addButton: {
    backgroundColor: "#00D4AA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  addButtonDisabled: {
    backgroundColor: "#333333",
    opacity: 0.5,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function AddToWatchlistModal({
  visible,
  onClose,
  selectedStock,
}: AddToWatchlistModalProps) {
  const { profile, addToWatchlist, toggleGlobalFavorite, isGlobalFavorite } =
    useUserStore();

  const [currentStock, setCurrentStock] = useState<StockSearchResult | null>(
    selectedStock || null
  );
  const [selectedWatchlists, setSelectedWatchlists] = useState<Set<string>>(
    new Set()
  );

  React.useEffect(() => {
    setCurrentStock(selectedStock || null);
    setSelectedWatchlists(new Set());
  }, [selectedStock, visible]);

  const handleStockSelect = (stock: StockSearchResult) => {
    setCurrentStock(stock);
  };

  const handleWatchlistToggle = (watchlistId: string) => {
    const newSelected = new Set(selectedWatchlists);
    if (newSelected.has(watchlistId)) {
      newSelected.delete(watchlistId);
    } else {
      newSelected.add(watchlistId);
    }
    setSelectedWatchlists(newSelected);
  };

  const handleFavoriteToggle = () => {
    if (currentStock) {
      toggleGlobalFavorite(currentStock.symbol);
    }
  };

  const handleAddToWatchlists = () => {
    if (!currentStock) return;

    if (selectedWatchlists.size === 0) {
      Alert.alert(
        "No Watchlists Selected",
        "Please select at least one watchlist to add the stock to."
      );
      return;
    }

    // Add to selected watchlists
    selectedWatchlists.forEach((watchlistId) => {
      addToWatchlist(watchlistId, currentStock.symbol);
    });

    Alert.alert(
      "Stock Added",
      `${currentStock.symbol} has been added to ${
        selectedWatchlists.size
      } watchlist${selectedWatchlists.size > 1 ? "s" : ""}.`,
      [{ text: "OK", onPress: onClose }]
    );
  };

  const isInWatchlist = (watchlistId: string): boolean => {
    if (!currentStock) return false;
    const watchlist = profile.watchlists.find((w) => w.id === watchlistId);
    return (
      watchlist?.items.some((item) => item.symbol === currentStock.symbol) ||
      false
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Watchlist</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#888888" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Stock Search */}
            {!currentStock && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>Search Stock</Text>
                <StockAutocomplete
                  onStockSelect={handleStockSelect}
                  placeholder="Search stocks to add to watchlist..."
                  maxResults={10}
                />
              </View>
            )}

            {/* Selected Stock */}
            {currentStock && (
              <>
                <View style={styles.selectedStock}>
                  <View style={styles.selectedStockInfo}>
                    <Text style={styles.selectedStockSymbol}>
                      {currentStock.symbol}
                    </Text>
                    <Text style={styles.selectedStockName} numberOfLines={2}>
                      {currentStock.name}
                    </Text>
                  </View>
                  <Pressable onPress={() => setCurrentStock(null)}>
                    <Ionicons name="close-circle" size={24} color="#888888" />
                  </Pressable>
                </View>

                {/* Add to Favorites */}
                <View style={styles.favoriteSection}>
                  <Text style={styles.sectionTitle}>Favorites</Text>
                  <Pressable
                    style={[
                      styles.favoriteButton,
                      isGlobalFavorite(currentStock.symbol) &&
                        styles.favoriteButtonActive,
                    ]}
                    onPress={handleFavoriteToggle}
                  >
                    <Ionicons
                      name={
                        isGlobalFavorite(currentStock.symbol)
                          ? "star"
                          : "star-outline"
                      }
                      size={20}
                      color={
                        isGlobalFavorite(currentStock.symbol)
                          ? "#000000"
                          : "#FFD700"
                      }
                      style={styles.favoriteIcon}
                    />
                    <Text
                      style={[
                        styles.favoriteText,
                        isGlobalFavorite(currentStock.symbol) &&
                          styles.favoriteTextActive,
                      ]}
                    >
                      {isGlobalFavorite(currentStock.symbol)
                        ? "Remove from Favorites"
                        : "Add to Favorites"}
                    </Text>
                  </Pressable>
                </View>

                {/* Watchlists */}
                <View style={styles.watchlistsSection}>
                  <Text style={styles.sectionTitle}>Watchlists</Text>
                  {profile.watchlists.map((watchlist) => {
                    const isSelected = selectedWatchlists.has(watchlist.id);
                    const alreadyInWatchlist = isInWatchlist(watchlist.id);

                    return (
                      <Pressable
                        key={watchlist.id}
                        style={[
                          styles.watchlistItem,
                          isSelected && styles.watchlistItemSelected,
                        ]}
                        onPress={() =>
                          !alreadyInWatchlist &&
                          handleWatchlistToggle(watchlist.id)
                        }
                        disabled={alreadyInWatchlist}
                      >
                        <View
                          style={[
                            styles.watchlistIndicator,
                            { backgroundColor: watchlist.color },
                          ]}
                        />
                        <View style={styles.watchlistInfo}>
                          <Text style={styles.watchlistName}>
                            {watchlist.name}
                          </Text>
                          <Text style={styles.watchlistCount}>
                            {watchlist.items.length} stocks
                          </Text>
                        </View>
                        <Ionicons
                          name={
                            alreadyInWatchlist
                              ? "checkmark-circle"
                              : isSelected
                              ? "checkmark-circle"
                              : "add-circle-outline"
                          }
                          size={24}
                          color={
                            alreadyInWatchlist
                              ? "#888888"
                              : isSelected
                              ? "#00D4AA"
                              : "#666666"
                          }
                        />
                      </Pressable>
                    );
                  })}
                </View>

                {/* Add Button */}
                <Pressable
                  style={[
                    styles.addButton,
                    selectedWatchlists.size === 0 && styles.addButtonDisabled,
                  ]}
                  onPress={handleAddToWatchlists}
                  disabled={selectedWatchlists.size === 0}
                >
                  <Text style={styles.addButtonText}>
                    Add to {selectedWatchlists.size} Watchlist
                    {selectedWatchlists.size !== 1 ? "s" : ""}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
