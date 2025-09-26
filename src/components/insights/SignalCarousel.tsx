import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../providers/ThemeProvider";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 16 * 2; // Full width minus horizontal padding
const CARD_HEIGHT = 200;
const LAYER_OFFSET = 10;
const STACK_DEPTH = 4;

// no custom gesture context needed with Gesture API

export type SignalItem = {
  id: string;
  title: string;
  description: string;
  type: "bullish" | "bearish" | "neutral";
  confidence: number;
  time: string;
};

type SignalCarouselProps = {
  items: SignalItem[];
  onDismiss: (id: string) => void;
  onPress?: (item: SignalItem) => void;
  onCycle?: (id: string) => void; // move to bottom
};

const SIGNAL_COLORS = {
  bullish: {
    background: "#064E3B",
    accent: "#10B981",
    icon: "trending-up" as const,
  },
  bearish: {
    background: "#7F1D1D",
    accent: "#F87171",
    icon: "trending-down" as const,
  },
  neutral: {
    background: "#1F2937",
    accent: "#94A3B8",
    icon: "remove" as const,
  },
};

export default function SignalCarousel({
  items,
  onDismiss,
  onPress,
  onCycle,
}: SignalCarouselProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  if (!items.length) {
    return (
      <Animated.View
        entering={FadeInUp}
        exiting={FadeOutUp}
        style={styles.emptyContainer}
      >
        <Text style={styles.emptyText}>No active signals right now.</Text>
      </Animated.View>
    );
  }

  // Create circular array - reorder items based on current index
  const reorderedItems = useMemo(() => {
    const result = [];
    for (let i = 0; i < items.length; i++) {
      const index = (currentIndex + i) % items.length;
      result.push(items[index]);
    }
    return result;
  }, [items, currentIndex]);

  const visibleCards = reorderedItems.slice(0, STACK_DEPTH);
  const topCard = visibleCards[0];
  const paletteTop = SIGNAL_COLORS[topCard.type];

  const cycleToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    onCycle?.(topCard.id);
  };

  const cycleToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    onCycle?.(topCard.id);
  };

  const panGesture = useMemo(() => {
    const swipeThreshold = CARD_WIDTH * 0.3;
    const velocityThreshold = 500;
    const MAX_DRAG_X = CARD_WIDTH * 0.35; // visual bound inside the deck
    const MAX_DRAG_Y = 12; // keep vertical drift minimal
    return Gesture.Pan()
      .activeOffsetX([-10, 10])
      .maxPointers(1)
      .onUpdate((event) => {
        const clampedX = Math.max(
          -MAX_DRAG_X,
          Math.min(MAX_DRAG_X, event.translationX)
        );
        const clampedY = Math.max(
          -MAX_DRAG_Y,
          Math.min(MAX_DRAG_Y, event.translationY)
        );
        translateX.value = clampedX;
        translateY.value = clampedY;
      })
      .onEnd((event) => {
        if (
          Math.abs(event.translationX) > swipeThreshold ||
          Math.abs(event.velocityX) > velocityThreshold
        ) {
          if (event.translationX > 0) {
            // Swipe right - cycle to previous
            translateX.value = withSpring(CARD_WIDTH * 1.5, {}, () => {
              runOnJS(cycleToPrev)();
              translateX.value = 0;
              translateY.value = 0;
            });
          } else {
            // Swipe left - cycle to next
            translateX.value = withSpring(-CARD_WIDTH * 1.5, {}, () => {
              runOnJS(cycleToNext)();
              translateX.value = 0;
              translateY.value = 0;
            });
          }
        } else {
          // Snap back to center
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      });
  }, [cycleToNext, cycleToPrev]);

  const topCardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${translateX.value / 10}deg` },
      ],
    };
  });

  return (
    <View
      style={[
        styles.deckContainer,
        { height: CARD_HEIGHT + (STACK_DEPTH - 1) * LAYER_OFFSET },
      ]}
    >
      {/* Background cards */}
      {visibleCards
        .slice(1)
        .reverse()
        .map((signal, idx) => {
          const layerIndex = visibleCards.length - 1 - idx; // 1, 2, 3...
          const palette = SIGNAL_COLORS[signal.type];
          const scale = 1 - layerIndex * 0.04;
          const opacity = Math.max(0.3, 1 - layerIndex * 0.25);

          return (
            <View
              key={`${signal.id}-${layerIndex}`}
              style={[
                styles.layerCard,
                {
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  top: layerIndex * LAYER_OFFSET,
                  transform: [{ scale }],
                  opacity,
                  backgroundColor: palette.background,
                },
              ]}
            />
          );
        })}

      {/* Top interactive card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[topCardAnimatedStyle, { position: "absolute", top: 0 }]}
        >
          <Pressable
            style={[
              styles.card,
              styles.cardFull,
              {
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                backgroundColor: paletteTop.background,
              },
            ]}
            onPress={() => onPress?.(topCard)}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: paletteTop.accent },
                ]}
              >
                <Ionicons
                  name={paletteTop.icon}
                  size={16}
                  color={theme.colors.surface}
                />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.timeText}>{topCard.time}</Text>
                <Pressable
                  onPress={() => onDismiss(topCard.id)}
                  hitSlop={8}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={theme.colors.surface}
                  />
                </Pressable>
              </View>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {topCard.title}
            </Text>

            <Text style={styles.cardDescription} numberOfLines={2}>
              {topCard.description}
            </Text>

            <View style={styles.footer}>
              <View style={styles.confidenceBarBackground}>
                <View
                  style={[
                    styles.confidenceBarFill,
                    {
                      width: `${topCard.confidence}%`,
                      backgroundColor: paletteTop.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>
                {topCard.confidence}% confidence
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    deckContainer: {
      position: "relative",
      alignItems: "center",
      justifyContent: "flex-start",
      marginHorizontal: 16,
      marginVertical: 12,
    },
    layerCard: {
      position: "absolute",
      borderRadius: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    card: {
      borderRadius: 18,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
    },
    cardFull: {
      // Full width card styles
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    timeText: {
      fontSize: 12,
      color: theme.colors.surface,
      opacity: 0.8,
      fontWeight: "500",
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.surface,
      marginBottom: 8,
      lineHeight: 24,
    },
    cardDescription: {
      fontSize: 14,
      color: theme.colors.surface,
      opacity: 0.85,
      lineHeight: 20,
      marginBottom: 16,
    },
    footer: {
      marginTop: "auto",
    },
    confidenceBarBackground: {
      height: 4,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 2,
      marginBottom: 8,
    },
    confidenceBarFill: {
      height: "100%",
      borderRadius: 2,
    },
    confidenceText: {
      fontSize: 12,
      color: theme.colors.surface,
      opacity: 0.8,
      fontWeight: "600",
    },
    emptyContainer: {
      padding: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      marginHorizontal: 16,
      marginVertical: 12,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
  });
}
