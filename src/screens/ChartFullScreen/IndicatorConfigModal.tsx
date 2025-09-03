import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, Animated, Dimensions, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IndicatorConfig } from "../../components/charts/SimpleKLineChart";

type Props = {
  visible: boolean;
  onClose: () => void;
  indicator: IndicatorConfig | null;
  newParamValue: number;
  setNewParamValue: (n: number) => void;
  onAddParam: (name: string, value: number) => void;
  onOpenLineStyleEditor: (index: number) => void;
};

export default function IndicatorConfigModal({ visible, onClose, indicator, newParamValue, setNewParamValue, onAddParam, onOpenLineStyleEditor }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, [visible]);

  if (!indicator) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{ backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 24, maxHeight: Dimensions.get("window").height * 0.6, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <Pressable>
            <View style={{ alignItems: "center", paddingBottom: 10 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{indicator.name} Settings</Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {Array.isArray(indicator.calcParams) && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: "#9CA3AF", marginRight: 8 }}>Bars</Text>
                    <TextInput
                      value={String(newParamValue)}
                      onChangeText={(t) => {
                        const n = Number(t.replace(/[^0-9]/g, ""));
                        if (Number.isFinite(n)) setNewParamValue(n);
                      }}
                      placeholder="9"
                      keyboardType="number-pad"
                      style={{ color: "#fff", backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: "#333", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 60 }}
                    />
                  </View>
                  <Pressable onPress={() => onAddParam(indicator.name, newParamValue)} style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#00D4AA", borderRadius: 12 }}>
                    <Text style={{ color: "#000", fontWeight: "700" }}>+ Add</Text>
                  </Pressable>
                </View>
              )}
              {Array.isArray(indicator.calcParams) ? (
                indicator.calcParams.map((period: any, idx: number) => {
                  const lines = (indicator.styles as any)?.lines || [];
                  const current = lines[idx] || { color: "#00D4AA", size: 1, style: "solid" };
                  const namePrefix = indicator.name;
                  const lineTitle = `${namePrefix}${Number(period)}`;
                  return (
                    <Pressable key={`line-${idx}`} onPress={() => onOpenLineStyleEditor(idx)} style={{ borderWidth: 1, borderColor: "#333", borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View>
                        <Text style={{ color: "#fff", fontWeight: "700", marginBottom: 6 }}>{lineTitle}</Text>
                        <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Tap to edit color, thickness, style</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 18, backgroundColor: current.color, marginRight: 10 }} />
                        <View style={{ width: 40, borderBottomWidth: current.size, borderBottomColor: current.color, borderStyle: current.style as any, marginRight: 8 }} />
                        <Ionicons name="chevron-forward" size={18} color="#888" />
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Pressable onPress={() => onOpenLineStyleEditor(0)} style={{ borderWidth: 1, borderColor: "#333", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ color: "#fff", fontWeight: "700", marginBottom: 6 }}>Line</Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Tap to edit color, thickness, style</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 18, height: 18, borderRadius: 18, backgroundColor: (indicator.styles as any)?.lines?.[0]?.color || "#00D4AA", marginRight: 10 }} />
                    <View style={{ width: 40, borderBottomWidth: (indicator.styles as any)?.lines?.[0]?.size || 1, borderBottomColor: (indicator.styles as any)?.lines?.[0]?.color || "#00D4AA", borderStyle: (((indicator.styles as any)?.lines?.[0]?.style as any) || "solid") as any, marginRight: 8 }} />
                    <Ionicons name="chevron-forward" size={18} color="#888" />
                  </View>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}


