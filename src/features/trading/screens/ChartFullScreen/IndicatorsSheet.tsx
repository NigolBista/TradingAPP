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
import type { IndicatorConfig } from "../../components/charts/SimpleKLineChart";
import { BUILTIN_INDICATORS, isSelectedIndicator } from "./indicators";

type Props = {
  visible: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onToggleIndicator: (name: string) => void;
};

export default function IndicatorsSheet({
  visible,
  onClose,
  indicators,
  onToggleIndicator,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible)
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
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
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                Indicators
              </Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 10 }}
              >
                Tap an item to toggle it on or off. Configure periods and colors
                from the indicator settings. Overlay supported on MA, EMA, SMA,
                BBI, BOLL, SAR.
              </Text>
              <View style={{ gap: 10 }}>
                {BUILTIN_INDICATORS.map((ind) => {
                  const selected = isSelectedIndicator(indicators, ind.name);
                  return (
                    <Pressable
                      key={ind.name}
                      onPress={() => onToggleIndicator(ind.name)}
                      style={[
                        styles.indicatorItem,
                        selected && styles.indicatorItemActive,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text style={styles.indicatorTitle}>{ind.title}</Text>
                          <Text style={styles.indicatorSubtitle}>
                            {ind.name}
                          </Text>
                        </View>
                        <Text style={styles.indicatorDescription}>
                          {ind.description}
                        </Text>
                        {ind.compatOverlay && (
                          <View style={styles.badgeOverlay}>
                            <Text style={styles.badgeOverlayText}>Overlay</Text>
                          </View>
                        )}
                      </View>
                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#00D4AA"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
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
    maxHeight: Dimensions.get("window").height * 0.85,
  },
  handleWrap: { alignItems: "center", paddingBottom: 16 },
  handle: { width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 },
  indicatorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#111",
  },
  indicatorItemActive: { borderColor: "#00D4AA", backgroundColor: "#002921" },
  indicatorTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  indicatorSubtitle: { color: "#9CA3AF", fontSize: 12, marginLeft: 8 },
  indicatorDescription: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  badgeOverlay: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#0b322a",
    borderWidth: 1,
    borderColor: "#00D4AA",
  },
  badgeOverlayText: {
    color: "#00D4AA",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
