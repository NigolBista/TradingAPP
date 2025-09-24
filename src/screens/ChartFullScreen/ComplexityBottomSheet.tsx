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
import { StrategyComplexity } from "../../logic/types";
import { useUserStore, type StrategyGroup } from "../../store/userStore";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../../logic/strategyComplexity";

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
}: Props) {
  const storeProfile = useUserStore((s) => s.profile);
  const selectStrategyGroup = useUserStore((s) => s.selectStrategyGroup);
  const saveStrategyPreferences = useUserStore(
    (s) => s.saveStrategyPreferences
  );
  const anim = useRef(new Animated.Value(0)).current;
  const ownedGroups = (storeProfile?.strategyGroups || []) as StrategyGroup[];
  const groups = ownedGroups;
  const canShowGroups = groups.length > 0;
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

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
              {/* Signal Group Selection (show if user has any group context) */}
              {canShowGroups ? (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 11,
                      fontWeight: "700",
                      marginBottom: 8,
                    }}
                  >
                    Signal Group
                  </Text>
                  {groups && groups.length > 0 ? (
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {groups.map((g) => {
                        const active =
                          storeProfile.selectedStrategyGroupId === g.id;
                        return (
                          <Pressable
                            key={g.id}
                            onPress={() => selectStrategyGroup(g.id)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: active ? "#00D4AA" : "#111827",
                              borderWidth: 1,
                              borderColor: active ? "#00D4AA" : "#333",
                            }}
                          >
                            <Text
                              style={{
                                color: active ? "#000" : "#ccc",
                                fontWeight: "700",
                                fontSize: 12,
                              }}
                            >
                              {g.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ color: "#888" }}>
                      No strategy groups. Create one from the Strategy tab.
                    </Text>
                  )}
                </View>
              ) : null}

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
                        try {
                          saveStrategyPreferences({
                            tradeMode: "day",
                            tradePace: "day",
                          } as any);
                        } catch {}
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
                        try {
                          saveStrategyPreferences({
                            tradeMode: "swing",
                            tradePace: "swing",
                          } as any);
                        } catch {}
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
                    onPress={() => {
                      const next =
                        contextMode === "news_sentiment"
                          ? "price_action"
                          : "news_sentiment";
                      setContextMode(next);
                      try {
                        saveStrategyPreferences({
                          contextMode: next as any,
                          newsSentimentEnabled: next === "news_sentiment",
                        } as any);
                      } catch {}
                    }}
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
