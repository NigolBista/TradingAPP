import React from "react";
import { View, Text, Pressable, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  desiredRR: number;
  setDesiredRR: (n: number) => void;
  onClose: () => void;
  onApply: () => void;
};

export default function CustomRRModal({ visible, desiredRR, setDesiredRR, onClose, onApply }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ backgroundColor: "#1a1a1a", borderRadius: 12, margin: 20, padding: 16, width: "80%", maxWidth: 360 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Custom R:R</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="#888" />
            </Pressable>
          </View>
          <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>Enter desired risk-reward (e.g., 2.25 for 2.25:1):</Text>
          <TextInput
            value={String(desiredRR ?? "")}
            onChangeText={(txt) => {
              const num = Number(txt);
              if (Number.isFinite(num)) setDesiredRR(num);
            }}
            keyboardType="decimal-pad"
            placeholder="2.0"
            placeholderTextColor="#666"
            style={{ backgroundColor: "#2a2a2a", borderRadius: 8, padding: 12, color: "#fff", fontSize: 16 }}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
            <Pressable onPress={onClose} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#2a2a2a", borderRadius: 8, marginRight: 8 }}>
              <Text style={{ color: "#ccc", fontSize: 14, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onApply} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#00D4AA", borderRadius: 8 }}>
              <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}


