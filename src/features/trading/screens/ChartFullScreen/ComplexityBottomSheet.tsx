import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StrategyComplexity } from "../../types";
import { ExtendedTimeframe } from "../../../../shared/services/marketProviders";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../../services/strategyComplexity";

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedComplexity: StrategyComplexity;
  onSelectComplexity: (c: StrategyComplexity) => void;
  profile: any;
  onSaveComplexityToProfile?: (c: StrategyComplexity) => void;
  tradeMode: "day" | "swing";
  setTradeMode: (m: "day" | "swing") => void;
  setMode: (m: "auto" | "day_trade" | "swing_trade") => void;
  tradePace: "auto" | "day" | "scalp" | "swing";
  setTradePace: (p: "auto" | "day" | "scalp" | "swing") => void;
  contextMode: "price_action" | "news_sentiment";
  setContextMode: (m: "price_action" | "news_sentiment") => void;
  extendedTf: ExtendedTimeframe;
  contextLookback: { mode: "auto" | "fixed"; ms?: number };
  setContextLookback: (v: { mode: "auto" | "fixed"; ms?: number }) => void;
};

export default function ComplexityBottomSheet({
  visible,
  onClose,
  selectedComplexity,
  onSelectComplexity,
  profile,
  onSaveComplexityToProfile,
  tradeMode,
  setTradeMode,
  setMode,
  tradePace,
  setTradePace,
  contextMode,
  setContextMode,
  extendedTf,
  contextLookback,
  setContextLookback,
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

  // Build discrete lookback ticks dynamically based on timeframe
  function buildLookbackTicks(
    tf: ExtendedTimeframe,
    mode: "day" | "swing"
  ): { label: string; ms?: number }[] {
    const m = 60_000;
    const h = 60 * m;
    const d = 24 * h;
    const isMinute = ["1m", "2m", "3m", "5m", "10m", "15m", "30m"].includes(
      tf as any
    );
    const isHour = ["1h", "2h", "4h"].includes(tf as any);

    if (isMinute) {
      if (mode === "swing") {
        return [
          { label: "Auto" },
          { label: "1h", ms: 1 * h },
          { label: "2h", ms: 2 * h },
          { label: "4h", ms: 4 * h },
          { label: "1D", ms: 1 * d },
          { label: "3D", ms: 3 * d },
          { label: "1W", ms: 7 * d },
          { label: "2W", ms: 14 * d },
        ];
      }
      return [
        { label: "Auto" },
        { label: "15m", ms: 15 * m },
        { label: "30m", ms: 30 * m },
        { label: "1h", ms: 1 * h },
        { label: "2h", ms: 2 * h },
        { label: "4h", ms: 4 * h },
        { label: "1D", ms: 1 * d },
      ];
    }
    if (isHour) {
      if (mode === "swing") {
        return [
          { label: "Auto" },
          { label: "1D", ms: 1 * d },
          { label: "3D", ms: 3 * d },
          { label: "1W", ms: 7 * d },
          { label: "2W", ms: 14 * d },
          { label: "1M", ms: 30 * d },
          { label: "3M", ms: 90 * d },
        ];
      }
      return [
        { label: "Auto" },
        { label: "4h", ms: 4 * h },
        { label: "8h", ms: 8 * h },
        { label: "1D", ms: 1 * d },
        { label: "3D", ms: 3 * d },
        { label: "1W", ms: 7 * d },
      ];
    }
    // Day or higher
    if (mode === "swing") {
      return [
        { label: "Auto" },
        { label: "1W", ms: 7 * d },
        { label: "2W", ms: 14 * d },
        { label: "1M", ms: 30 * d },
        { label: "3M", ms: 90 * d },
        { label: "6M", ms: 180 * d },
        { label: "1Y", ms: 365 * d },
      ];
    }
    return [
      { label: "Auto" },
      { label: "3D", ms: 3 * d },
      { label: "1W", ms: 7 * d },
      { label: "2W", ms: 14 * d },
      { label: "1M", ms: 30 * d },
      { label: "3M", ms: 90 * d },
      { label: "6M", ms: 180 * d },
      { label: "1Y", ms: 365 * d },
    ];
  }

  const ticks = buildLookbackTicks(extendedTf, tradeMode);
  const selectedIndex = (() => {
    if (contextLookback?.mode !== "fixed") return 0;
    const idx = ticks.findIndex((t) => t.ms === contextLookback.ms);
    return idx >= 0 ? idx : 0;
  })();

  function handleSelectIndex(idx: number) {
    if (idx <= 0) {
      setContextLookback({ mode: "auto" });
    } else {
      const t = ticks[idx];
      setContextLookback({ mode: "fixed", ms: t.ms });
    }
  }

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
            <View style={{ alignItems: "center", paddingBottom: 20 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: "#666",
                  borderRadius: 2,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff" }}>
                Strategy Complexity
              </Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* AI Context Lookback Slider */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 11,
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  AI Context Window
                </Text>
                <Text style={{ color: "#fff", fontSize: 12, marginBottom: 12 }}>
                  {selectedIndex === 0
                    ? "Auto"
                    : `Last ${ticks[selectedIndex].label}`}
                </Text>
                <View
                  style={{
                    height: 40,
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <View
                    style={{
                      height: 2,
                      backgroundColor: "#333",
                      position: "absolute",
                      left: 16,
                      right: 16,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {ticks.map((t, i) => (
                      <Pressable
                        key={i}
                        onPress={() => handleSelectIndex(i)}
                        hitSlop={8}
                        style={{ alignItems: "center" }}
                      >
                        <View
                          style={{
                            width: i === selectedIndex ? 14 : 10,
                            height: i === selectedIndex ? 14 : 10,
                            borderRadius: 7,
                            backgroundColor:
                              i === selectedIndex ? "#00D4AA" : "#666",
                            borderWidth: i === selectedIndex ? 2 : 1,
                            borderColor:
                              i === selectedIndex ? "#00D4AA" : "#444",
                          }}
                        />
                        {i === 0 ? (
                          <Text
                            style={{
                              color: "#888",
                              fontSize: 10,
                              marginTop: 4,
                            }}
                          >
                            Auto
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    Mode
                  </Text>
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    Include
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: "#111827",
                      borderRadius: 10,
                      padding: 4,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setTradeMode("day");
                        setMode("day_trade");
                        setTradePace("day");
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          tradeMode === "day" ? "#00D4AA" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: tradeMode === "day" ? "#000" : "#ccc",
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Day
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setTradeMode("swing");
                        setMode("swing_trade");
                        setTradePace("swing");
                      }}
                      style={{
                        marginLeft: 4,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          tradeMode === "swing" ? "#00D4AA" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: tradeMode === "swing" ? "#000" : "#ccc",
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Swing
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() =>
                      setContextMode(
                        contextMode === "news_sentiment"
                          ? "price_action"
                          : "news_sentiment"
                      )
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor:
                        contextMode === "news_sentiment"
                          ? "#2563EB"
                          : "#111827",
                      borderWidth: 1,
                      borderColor:
                        contextMode === "news_sentiment" ? "#2563EB" : "#333",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}
                    >
                      News + Sentiment
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  color: "#888",
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                Choose your preferred trading strategy complexity level
              </Text>

              {Object.entries(STRATEGY_COMPLEXITY_CONFIGS).map(
                ([key, config]) => {
                  const complexity = key as StrategyComplexity;
                  const isSelected = selectedComplexity === complexity;
                  return (
                    <Pressable
                      key={complexity}
                      onPress={() => {
                        onSelectComplexity(complexity);
                        if (
                          profile?.autoApplyComplexity &&
                          onSaveComplexityToProfile
                        ) {
                          onSaveComplexityToProfile(complexity);
                        }
                        onClose();
                      }}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isSelected ? "#00D4AA" : "#333",
                        padding: 16,
                        marginBottom: 12,
                        backgroundColor: isSelected
                          ? "rgba(0,212,170,0.1)"
                          : "#2a2a2a",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: isSelected ? "#00D4AA" : "#fff",
                          }}
                        >
                          {complexity.charAt(0).toUpperCase() +
                            complexity.slice(1)}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#00D4AA"
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#ccc",
                          marginBottom: 12,
                        }}
                      >
                        {(config as any).description}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

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
});
