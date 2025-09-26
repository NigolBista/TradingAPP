import React, { useMemo, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../providers/ThemeProvider";
import type { NewsItem } from "../../services/newsProviders";

type NewsStackCarouselProps = {
  items: NewsItem[];
  onDismiss: (id: string) => void;
  onPressItem?: (item: NewsItem) => void;
  onViewAll?: () => void;
};

const SENTIMENT_VARIANTS = {
  Positive: {
    gradient: ["#0BA360", "#3CBA92"],
    accent: "#14F195",
    icon: "trending-up" as const,
  },
  Negative: {
    gradient: ["#EF5A5A", "#D74177"],
    accent: "#FEB692",
    icon: "trending-down" as const,
  },
  Neutral: {
    gradient: ["#434343", "#000000"],
    accent: "#A7C5EB",
    icon: "remove" as const,
  },
};

const STACK_DEPTH = 3;

export default function NewsStackCarousel({
  items,
  onDismiss,
  onPressItem,
  onViewAll,
}: NewsStackCarouselProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!items.length) return null;

  const stack = items.slice(0, STACK_DEPTH);
  const topItem = stack[0];
  const trailing = stack.slice(1);
  const sentimentVariant = SENTIMENT_VARIANTS[topItem.sentiment ?? "Neutral"];

  const swipeableRef = useRef<any>(null);

  const handleOpenStory = () => {
    if (onPressItem) {
      onPressItem(topItem);
      return;
    }
    if (topItem.url) Linking.openURL(topItem.url).catch(() => {});
  };

  const handleDismiss = () => {
    onDismiss(topItem.id);
    swipeableRef.current?.close();
  };

  const renderRightActions = () => (
    <Pressable style={styles.dismissAction} onPress={handleDismiss}>
      <Ionicons name="close" size={22} color={theme.colors.surface} />
      <Text style={styles.dismissActionText}>Dismiss</Text>
    </Pressable>
  );

  return (
    <View style={styles.stackContainer}>
      {trailing
        .slice()
        .reverse()
        .map((item, idx) => {
          const layerOffset = idx + 1;
          const layerOpacity = Math.max(0.25, 0.55 - idx * 0.2);
          return (
            <LinearGradient
              key={item.id}
              colors={["rgba(18,24,38,0.85)", "rgba(18,24,38,0.65)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.stackLayer,
                {
                  top: layerOffset * 10,
                  transform: [{ scale: 1 - layerOffset * 0.04 }],
                  opacity: layerOpacity,
                },
              ]}
            />
          );
        })}

      <Swipeable
        ref={(ref) => {
          swipeableRef.current = ref;
        }}
        renderRightActions={renderRightActions}
        rightThreshold={56}
      >
        <LinearGradient
          colors={sentimentVariant.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topCard}
        >
          <Pressable style={styles.cardContent} onPress={handleOpenStory}>
            <View style={styles.cardHeader}>
              {topItem.source ? (
                <View style={styles.sourcePill}>
                  <Ionicons
                    name="newspaper-outline"
                    size={12}
                    color={theme.colors.surface}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.sourceText}>{topItem.source}</Text>
                </View>
              ) : null}
              {topItem.publishedAt ? (
                <Text style={styles.timestampText}>
                  {formatRelativeTime(topItem.publishedAt)}
                </Text>
              ) : null}
            </View>

            <Text style={styles.headline} numberOfLines={3}>
              {topItem.title}
            </Text>

            {topItem.summary ? (
              <Text style={styles.summary} numberOfLines={2}>
                {topItem.summary.trim()}
              </Text>
            ) : null}

            <View style={styles.footerRow}>
              <View style={styles.metaRow}>
                {topItem.sentiment ? (
                  <View style={[styles.metaPill, styles.sentimentPill]}>
                    <Ionicons
                      name={sentimentVariant.icon}
                      size={14}
                      color={theme.colors.surface}
                      style={styles.metaIcon}
                    />
                    <Text style={styles.sentimentText}>
                      {(topItem.sentiment ?? "Neutral").toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {topItem.topics && topItem.topics.length ? (
                  <View style={[styles.metaPill, styles.topicCapsule]}>
                    <Text style={styles.topicText}>
                      {topItem.topics[0]?.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.surface}
              />
            </View>
          </Pressable>
        </LinearGradient>
      </Swipeable>

      <View style={styles.stackFooter}>
        <View style={styles.paginationDots}>
          {items.slice(0, 5).map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.paginationDot,
                index === 0 && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        {onViewAll ? (
          <Pressable style={styles.viewAllBtn} onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={theme.colors.text}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function formatRelativeTime(publishedAt: string) {
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return "";
  const delta = Date.now() - published;
  const minutes = Math.max(1, Math.floor(delta / (60 * 1000)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    stackContainer: {
      position: "relative",
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    stackLayer: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 180,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    topCard: {
      borderRadius: 22,
      padding: 20,
      overflow: "hidden",
      minHeight: 200,
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    cardContent: {
      flex: 1,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sourcePill: {
      backgroundColor: "rgba(0,0,0,0.25)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      flexDirection: "row",
      alignItems: "center",
    },
    sourceText: {
      color: theme.colors.surface,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    timestampText: {
      color: theme.colors.surface,
      fontSize: 12,
      opacity: 0.75,
    },
    headline: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.surface,
      marginBottom: 10,
      letterSpacing: 0.2,
    },
    summary: {
      color: theme.colors.surface,
      opacity: 0.85,
      lineHeight: 18,
      fontSize: 13,
      marginBottom: 18,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    sentimentPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    sentimentText: {
      color: theme.colors.surface,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    topicCapsule: {
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    topicText: {
      color: theme.colors.surface,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    stackFooter: {
      marginTop: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    paginationDots: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    paginationDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(148, 163, 184, 0.35)",
    },
    paginationDotActive: {
      backgroundColor: theme.colors.text,
      width: 18,
    },
    viewAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.08)",
    },
    viewAllText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    dismissAction: {
      width: 88,
      height: "100%",
      backgroundColor: theme.colors.error,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 22,
      marginVertical: 8,
    },
    dismissActionText: {
      color: theme.colors.surface,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 4,
    },
  });
