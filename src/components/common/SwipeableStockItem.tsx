import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Ionicons } from "@expo/vector-icons";

interface SwipeableStockItemProps {
  symbol: string;
  companyName?: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  isGlobalFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}

export default function SwipeableStockItem({
  symbol,
  companyName,
  currentPrice,
  change,
  changePercent,
  isGlobalFavorite,
  onPress,
  onToggleFavorite,
  onRemove,
}: SwipeableStockItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleFavoritePress = () => {
    onToggleFavorite();
    swipeableRef.current?.close();
  };

  const handleRemovePress = () => {
    onRemove();
    swipeableRef.current?.close();
  };

  const renderLeftActions = () => (
    <View style={styles.leftActionsContainer}>
      <Pressable style={styles.leftAction} onPress={handleFavoritePress}>
        <Ionicons
          name={isGlobalFavorite ? "star" : "star-outline"}
          size={20}
          color={isGlobalFavorite ? "#FFD700" : "#00D4AA"}
        />
      </Pressable>
    </View>
  );

  const renderRightActions = () => (
    <View style={styles.rightActionsContainer}>
      <Pressable style={styles.rightAction} onPress={handleRemovePress}>
        <Ionicons name="trash-outline" size={20} color="#FF5722" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        leftThreshold={40}
        rightThreshold={40}
      >
        <Pressable style={styles.stockCard} onPress={onPress}>
          <View style={styles.stockHeader}>
            <View style={styles.stockInfo}>
              <View style={styles.symbolRow}>
                <Text style={styles.stockSymbol}>{symbol}</Text>
                {isGlobalFavorite && (
                  <Ionicons
                    name="star"
                    size={14}
                    color="#FFD700"
                    style={styles.favoriteIcon}
                  />
                )}
              </View>
              {companyName && companyName !== symbol && (
                <Text
                  style={styles.companyName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {companyName}
                </Text>
              )}
            </View>

            <View style={styles.priceInfo}>
              <Text style={styles.stockPrice}>${currentPrice.toFixed(2)}</Text>
              <Text
                style={[
                  styles.stockChange,
                  change >= 0 ? styles.positiveChange : styles.negativeChange,
                ]}
              >
                {change >= 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  leftActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftAction: {
    width: 80,
    height: "100%",
    backgroundColor: "#00D4AA20",
    justifyContent: "center",
    alignItems: "center",
  },
  rightAction: {
    width: 80,
    height: "100%",
    backgroundColor: "#FF572220",
    justifyContent: "center",
    alignItems: "center",
  },
  stockCard: {
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockInfo: {
    flex: 1,
    marginRight: 12,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockSymbol: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  favoriteIcon: {
    marginLeft: 6,
  },
  companyName: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  priceInfo: {
    alignItems: "flex-end",
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: "700",
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
});
