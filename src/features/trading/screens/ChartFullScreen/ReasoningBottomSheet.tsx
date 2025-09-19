import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, Animated, Dimensions, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  isStreaming: boolean;
  streamingText: string;
};

export default function ReasoningBottomSheet({ visible, onClose, isStreaming, streamingText }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={onClose}>
        <Animated.View style={{ backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40, maxHeight: Dimensions.get("window").height * 0.8, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <Pressable>
            <View style={{ width: 40, height: 4, backgroundColor: "#666", borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Reasoning</Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {isStreaming ? (
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 12 }}>Streaming reasoning…</Text>
              ) : null}
              <Text style={{ color: "#E5E7EB", fontSize: 14, lineHeight: 20 }}>
                {streamingText && streamingText.length > 0 ? streamingText : "No reasoning available yet. Run Analyze to generate insights."}
              </Text>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}


