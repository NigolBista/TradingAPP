import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../providers/ThemeProvider";
import type { MarketSessionPhase } from "../../lib/marketSessions";
import { isExtendedSession } from "../../lib/marketSessions";

interface SwipeableStockItemProps {
  symbol: string;
  companyName?: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  sessionPhase?: MarketSessionPhase;
  afterHoursPercent?: number;
  afterHoursDelta?: number;
  showAhChange?: boolean;
  onTogglePriceMode?: () => void;
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
  sessionPhase,
  afterHoursPercent,
  afterHoursDelta,
  showAhChange,
  onTogglePriceMode,
  isGlobalFavorite,
  onPress,
  onToggleFavorite,
  onRemove,
}: SwipeableStockItemProps) {
  const { theme } = useTheme();
  const swipeableRef = useRef<any>(null);

  const styles = createStyles(theme);

  const extendedPhase = sessionPhase ?? "regular";
  const isExtended = isExtendedSession(extendedPhase);
  const extendedLabel = extendedPhase === "pre-market" ? "Pre" : "After";

  const ahPct = isExtended
    ? typeof afterHoursDelta === "number" &&
      typeof currentPrice === "number" &&
      currentPrice > 0
      ? (afterHoursDelta / currentPrice) * 100
      : afterHoursPercent
    : undefined;

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
          color={isGlobalFavorite ? "#FFD700" : theme.colors.primary}
        />
      </Pressable>
    </View>
  );

  const renderRightActions = () => (
    <View style={styles.rightActionsContainer}>
      <Pressable style={styles.rightAction} onPress={handleRemovePress}>
        <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
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

            <Pressable
              style={styles.priceInfo}
              onPress={(e: any) => {
                // Toggle between daily % and extended-hours delta/%
                e?.stopPropagation?.();
                if (isExtended) onTogglePriceMode?.();
              }}
            >
              <Text style={styles.stockPrice}>${currentPrice.toFixed(2)}</Text>
              <View style={styles.changeRow}>
                {(!isExtended || (isExtended && !showAhChange)) && (
                  <Text
                    style={[
                      styles.stockChange,
                      change >= 0
                        ? styles.positiveChange
                        : styles.negativeChange,
                    ]}
                  >
                    {change >= 0 ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </Text>
                )}
                {isExtended && showAhChange && typeof ahPct === "number" && (
                  <Text
                    style={[
                      styles.afterHoursText,
                      (ahPct ?? 0) >= 0
                        ? styles.positiveChange
                        : styles.negativeChange,
                    ]}
                  >
                    {`${extendedLabel}: ${
                      afterHoursDelta !== undefined
                        ? `${afterHoursDelta >= 0 ? "+" : ""}$${Math.abs(
                            afterHoursDelta
                          ).toFixed(2)} `
                        : ""
                    }(${(ahPct ?? 0) >= 0 ? "+" : ""}${(ahPct ?? 0).toFixed(
                      2
                    )}%)`}
                  </Text>
                )}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    rightAction: {
      width: 80,
      height: "100%",
      backgroundColor: theme.colors.error + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    stockCard: {
      backgroundColor: "rgba(17, 24, 39, 0.5)",
      borderRadius: 12,
      borderWidth: 0,
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
      color: theme.colors.text,
    },
    favoriteIcon: {
      marginLeft: 6,
    },
    companyName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    priceInfo: {
      alignItems: "flex-end",
    },
    stockPrice: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    stockChange: {
      fontSize: 14,
      fontWeight: "500",
      marginTop: 2,
    },
    changeRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    afterHoursText: {
      fontSize: 12,
      marginLeft: 8,
    },
    positiveChange: {
      color: theme.colors.success,
    },
    negativeChange: {
      color: theme.colors.error,
    },
  });
