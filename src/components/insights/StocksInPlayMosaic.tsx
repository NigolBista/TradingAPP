import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../providers/ThemeProvider";

export type MosaicCategory = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  palette: [string, string];
  metricLabel: string;
  metricValue: string;
  deltaLabel: string;
  deltaValue: string;
  deltaTone?: "positive" | "negative" | "neutral";
  onPress: () => void;
  onLongPress?: () => void;
};

type StocksInPlayMosaicProps = {
  categories: MosaicCategory[];
  loading?: boolean;
};

export default function StocksInPlayMosaic({
  categories,
  loading,
}: StocksInPlayMosaicProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = Math.max(280, Math.min(screenWidth * 0.78, 360));

  if (!categories.length) return null;

  const tiles = categories.slice(0, 8);

  return (
    <View style={styles.containerScroll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tiles.map((category, index) => {
          const TileComponent =
            index === 1 || index === 2 ? LinearGradient : View;
          const tileStyle = [
            styles.tile,
            styles[`tile${index}` as const],
            { width: cardWidth, marginRight: 12 },
          ];
          const gradientProps =
            TileComponent === LinearGradient
              ? {
                  colors: category.palette,
                  start: { x: 0, y: 0 },
                  end: { x: 1, y: 1 },
                }
              : {};

          return (
            <TileComponent
              key={category.id}
              {...gradientProps}
              style={
                TileComponent === LinearGradient
                  ? [tileStyle, styles.gradientTile]
                  : tileStyle
              }
            >
              <Pressable
                onPress={category.onPress}
                onLongPress={category.onLongPress}
                style={styles.pressable}
              >
                <View style={styles.tileHeader}>
                  <View style={styles.iconBadge}>
                    <Ionicons
                      name={category.icon as any}
                      size={18}
                      color={theme.colors.surface}
                    />
                  </View>
                  <Text style={styles.tileSubtitle} numberOfLines={1}>
                    {category.subtitle}
                  </Text>
                </View>

                <View style={styles.titleWrap}>
                  <Text style={styles.tileTitle} numberOfLines={3}>
                    {category.title}
                  </Text>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>
                      {category.metricLabel}
                    </Text>
                    <Text style={styles.metricValue}>
                      {category.metricValue}
                    </Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>
                      {category.deltaLabel}
                    </Text>
                    <Text
                      style={[
                        styles.deltaValue,
                        category.deltaTone === "negative"
                          ? styles.deltaNegative
                          : category.deltaTone === "neutral"
                          ? styles.deltaNeutral
                          : styles.deltaPositive,
                      ]}
                    >
                      {category.deltaValue}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </TileComponent>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Text style={styles.loadingText}>Loading focus plays…</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    containerScroll: {
      marginTop: 8,
    },
    scrollContent: {
      paddingHorizontal: 16,
    },
    tile: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: theme.mode === "dark" ? "#111827" : theme.colors.surface,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 16,
      elevation: 8,
      overflow: "hidden",
    },
    gradientTile: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
    },
    tile0: {
      backgroundColor: "rgba(15, 23, 42, 0.85)",
      borderWidth: 1,
      borderColor: "rgba(56,189,248,0.2)",
    },
    tile1: {},
    tile2: {},
    tile3: {
      backgroundColor: theme.mode === "dark" ? "#1F2937" : "#F9FAFB",
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.08)",
    },
    pressable: {
      flex: 1,
      justifyContent: "space-between",
      minHeight: 220,
    },
    tileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    titleWrap: {
      minHeight: 72,
      justifyContent: "flex-end",
      marginBottom: 12,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    tileSubtitle: {
      color:
        theme.mode === "dark" ? "rgba(226,232,240,0.8)" : "rgba(15,23,42,0.6)",
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginLeft: 8,
      flex: 1,
    },
    tileTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#E0F2FE" : theme.colors.text,
    },
    metricRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 10,
    },
    metricBlock: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 12,
      color:
        theme.mode === "dark"
          ? "rgba(226,232,240,0.65)"
          : "rgba(15,23,42,0.55)",
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.mode === "dark" ? "#38BDF8" : theme.colors.text,
    },
    deltaValue: {
      fontSize: 18,
      fontWeight: "700",
    },
    deltaPositive: {
      color: theme.colors.success,
    },
    deltaNegative: {
      color: theme.colors.error,
    },
    deltaNeutral: {
      color: theme.colors.textSecondary,
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20,
      backgroundColor: "rgba(15, 23, 42, 0.65)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: theme.colors.surface,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
  });
