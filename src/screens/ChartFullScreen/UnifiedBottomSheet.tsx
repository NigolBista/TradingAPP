import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExtendedTimeframe } from "../../components/charts/TimeframePickerModal";
import { type ChartType } from "../../components/charts/ChartSettingsModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  chartType: ChartType;
  onSelectChartType: (t: ChartType) => void;
  extendedTf: ExtendedTimeframe;
  pinned: ExtendedTimeframe[];
  onSelectTimeframe: (tf: ExtendedTimeframe) => void;
  onTogglePin: (tf: ExtendedTimeframe) => Promise<boolean> | boolean;
  showSessions: boolean;
  onSetShowSessions: (enabled: boolean) => void;
  showReasonIcon: boolean;
  onSetShowReasonIcon: (enabled: boolean) => void;
  priceColors?: { up: string; down: string; noChange?: string };
  onSetPriceColors?: (c: {
    up: string;
    down: string;
    noChange?: string;
  }) => void;
};

export default function UnifiedBottomSheet({
  visible,
  onClose,
  chartType,
  onSelectChartType,
  extendedTf,
  pinned,
  onSelectTimeframe,
  onTogglePin,
  showSessions,
  onSetShowSessions,
  showReasonIcon,
  onSetShowReasonIcon,
  priceColors,
  onSetPriceColors,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  const allTfs: ExtendedTimeframe[] = [
    "1m",
    "2m",
    "3m",
    "5m",
    "10m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "1Y",
    "5Y",
    "ALL",
  ] as any;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <ScrollView
              style={{ maxHeight: 600 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Text style={styles.sectionTitle}>Chart Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartTypeRow}
                >
                  {[
                    {
                      type: "line" as ChartType,
                      label: "Line",
                      icon: "trending-up",
                    },
                    {
                      type: "area" as ChartType,
                      label: "Area",
                      icon: "analytics",
                    },
                    {
                      type: "candlestick" as ChartType,
                      label: "Candles",
                      icon: "bar-chart",
                    },
                    {
                      type: "candle_stroke" as ChartType,
                      label: "Hollow",
                      icon: "bar-chart",
                    },
                    {
                      type: "candle_up_stroke" as ChartType,
                      label: "Up",
                      icon: "bar-chart",
                    },
                    {
                      type: "candle_down_stroke" as ChartType,
                      label: "Down",
                      icon: "bar-chart",
                    },
                    {
                      type: "ohlc" as ChartType,
                      label: "OHLC",
                      icon: "stats-chart",
                    },
                  ].map((item) => (
                    <Pressable
                      key={item.type}
                      onPress={() => {
                        onSelectChartType(item.type);
                        onClose();
                      }}
                      style={[
                        styles.chartTypeButton,
                        chartType === item.type && styles.chartTypeButtonActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={chartType === item.type ? "#000" : "#fff"}
                        style={{ marginBottom: 4 }}
                      />
                      <Text
                        style={[
                          styles.chartTypeButtonText,
                          chartType === item.type &&
                            styles.chartTypeButtonTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Timeframes - Single horizontal row with scroll */}
              <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                <Text style={styles.sectionTitle}>Timeframes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {allTfs.map((tf) => {
                      const isSelected = extendedTf === tf;
                      const isPinned = pinned.includes(tf);
                      return (
                        <Pressable
                          key={tf}
                          onPress={() => onSelectTimeframe(tf)}
                          onLongPress={() => onTogglePin(tf)}
                          style={[
                            styles.timeframeButton,
                            isSelected && styles.timeframeButtonActive,
                            isPinned && styles.timeframeButtonPinned,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timeframeButtonText,
                              isSelected && styles.timeframeButtonTextActive,
                              isPinned && styles.timeframeButtonTextPinned,
                            ]}
                          >
                            {tf}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Trading Session + Reasoning side-by-side */}
              <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                <View style={styles.dualRow}>
                  <View style={styles.dualCol}>
                    <Text style={styles.sectionTitle}>After Hours</Text>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Extended</Text>
                      <Switch
                        value={showSessions}
                        onValueChange={onSetShowSessions}
                        trackColor={{ false: "#2a2a2a", true: "#00D4AA" }}
                        thumbColor={showSessions ? "#000" : "#888"}
                      />
                    </View>
                  </View>
                  <View style={styles.dualCol}>
                    <Text style={styles.sectionTitle}>Reasoning</Text>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Overlay</Text>
                      <Switch
                        value={showReasonIcon}
                        onValueChange={onSetShowReasonIcon}
                        trackColor={{ false: "#2a2a2a", true: "#00D4AA" }}
                        thumbColor={showReasonIcon ? "#000" : "#888"}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                {/* Up/Down Colors */}
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>Ups/Downs Color</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        {
                          up: "#10B981",
                          down: "#EF4444",
                          upLabel: "Green Up",
                          downLabel: "Red Down",
                        },
                        {
                          up: "#EF4444",
                          down: "#10B981",
                          upLabel: "Red Up",
                          downLabel: "Green Down",
                        },
                        {
                          up: "#10B981",
                          down: "#F59E0B",
                          upLabel: "Green Up",
                          downLabel: "Yellow Down",
                        },
                        {
                          up: "#4B5563",
                          down: "#9CA3AF",
                          upLabel: "Grey Up",
                          downLabel: "Grey Down",
                        },
                      ].map((scheme, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() =>
                            onSetPriceColors &&
                            onSetPriceColors({
                              up: scheme.up,
                              down: scheme.down,
                              noChange: priceColors?.noChange || "#9CA3AF",
                            })
                          }
                          style={[
                            styles.colorSchemeCard,
                            priceColors &&
                              priceColors.up === scheme.up &&
                              priceColors.down === scheme.down &&
                              styles.colorSchemeCardActive,
                          ]}
                        >
                          <View style={styles.cardContent}>
                            <View style={styles.colorInfo}>
                              <Text style={styles.colorText}>
                                {scheme.upLabel}
                              </Text>
                              <Ionicons
                                name="trending-up"
                                size={20}
                                color={scheme.up}
                                style={styles.trendIcon}
                              />
                            </View>
                            {scheme.downLabel ? (
                              <View style={styles.colorInfo}>
                                <Text style={styles.colorText}>
                                  {scheme.downLabel}
                                </Text>
                                <Ionicons
                                  name="trending-down"
                                  size={20}
                                  color={scheme.down}
                                  style={styles.trendIcon}
                                />
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Removed old grouped timeframe sections in favor of single horizontal list

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  handleWrap: { width: "100%", alignItems: "center", marginBottom: 20 },
  handle: { width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 },
  sectionTitle: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartTypeRow: { flexDirection: "row", gap: 12 },
  chartTypeButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    minWidth: 110,
  },
  chartTypeButtonActive: { backgroundColor: "#00D4AA" },
  chartTypeButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chartTypeButtonTextActive: { color: "#000" },
  sessionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sessionButtonActive: { backgroundColor: "#00D4AA", borderColor: "#00D4AA" },
  sessionButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sessionButtonTextActive: { color: "#000" },
  timeframeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    minWidth: 60,
    alignItems: "center",
  },
  timeframeButtonActive: { backgroundColor: "#00D4AA" },
  timeframeButtonPinned: {
    borderColor: "#00D4AA",
    borderWidth: 2,
    backgroundColor: "#002921",
  },
  timeframeButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  timeframeButtonTextActive: { color: "#000" },
  timeframeButtonTextPinned: { color: "#00D4AA" },
  dualRow: { flexDirection: "row", gap: 16 },
  dualCol: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#2a2a2a",
  },
  switchLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  colorSchemeCard: {
    minWidth: 140,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSchemeCardActive: {
    borderColor: "#007AFF",
  },
  cardContent: {
    gap: 8,
  },
  colorInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  trendIcon: {
    marginLeft: 8,
  },
});
