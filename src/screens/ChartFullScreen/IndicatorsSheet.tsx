import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, Animated, Dimensions, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IndicatorConfig } from "../../components/charts/SimpleKLineChart";
import { BUILTIN_INDICATORS, isSelectedIndicator } from "./indicators";

type Props = {
  visible: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onToggleIndicator: (name: string) => void;
};

export default function IndicatorsSheet({ visible, onClose, indicators, onToggleIndicator }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
          <Pressable>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Indicators</Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 10 }}>
                Tap to toggle. Select to configure periods and color. Overlay is supported on MA, EMA, SMA, BBI, BOLL, SAR.
              </Text>
              <View style={styles.timeframeGrid}>
                {BUILTIN_INDICATORS.map((ind) => {
                  const selected = isSelectedIndicator(indicators, ind.name);
                  return (
                    <Pressable key={ind.name} onPress={() => onToggleIndicator(ind.name)} style={[styles.timeframeButton, selected && styles.timeframeButtonActive]}>
                      <Text style={[styles.timeframeButtonText, selected && styles.timeframeButtonTextActive]}>{ind.name}</Text>
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
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40, maxHeight: Dimensions.get("window").height * 0.85 },
  handleWrap: { alignItems: "center", paddingBottom: 16 },
  handle: { width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 },
  timeframeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeframeButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: "#2a2a2a", minWidth: 60, alignItems: "center" },
  timeframeButtonActive: { backgroundColor: "#00D4AA" },
  timeframeButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  timeframeButtonTextActive: { color: "#000" },
});


