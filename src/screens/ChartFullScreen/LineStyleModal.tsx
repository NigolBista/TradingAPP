import React from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  onUpdateColor: (hex: string) => void;
  onUpdateThickness: (n: number) => void;
  onUpdateStyle: (s: string) => void;
};

export default function LineStyleModal({ visible, onClose, title, onUpdateColor, onUpdateThickness, onUpdateStyle }: Props) {
  const colors = [
    "#111827",
    "#1F2937",
    "#374151",
    "#4B5563",
    "#60A5FA",
    "#A78BFA",
    "#F472B6",
    "#F87171",
    "#F59E0B",
    "#FBBF24",
    "#34D399",
    "#22D3EE",
    "#10B981",
    "#3B82F6",
    "#EF4444",
    "#FDE047",
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} onPress={onClose}>
        <View style={{ backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 24, maxHeight: 600 }}>
          <Pressable>
            <View style={{ alignItems: "center", paddingBottom: 10 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              <Text style={{ color: "#9CA3AF", marginBottom: 8 }}>Color</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {colors.map((sw) => (
                  <Pressable key={`style-color-${sw}`} onPress={() => onUpdateColor(sw)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: sw, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: "#111" }} />
                ))}
              </View>
              <Text style={{ color: "#9CA3AF", marginTop: 6, marginBottom: 8 }}>Thickness</Text>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                {[1, 2, 3, 4].map((th) => (
                  <Pressable key={`style-th-${th}`} onPress={() => onUpdateThickness(th)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginRight: 8, backgroundColor: "#111827", borderWidth: 1, borderColor: "#333" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{th}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: "#9CA3AF", marginTop: 6, marginBottom: 8 }}>Style</Text>
              <View style={{ flexDirection: "row" }}>
                {[
                  { k: "solid", label: "Solid" },
                  { k: "dashed", label: "Dashed" },
                  { k: "dotted", label: "Dotted" },
                ].map((opt) => (
                  <Pressable key={`style-st-${opt.k}`} onPress={() => onUpdateStyle(opt.k)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, backgroundColor: "#111827", borderWidth: 1, borderColor: "#333" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}


