import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExtendedTimeframe } from "../../components/charts/TimeframePickerModal";

type Props = {
  pinned: ExtendedTimeframe[];
  extendedTf: ExtendedTimeframe;
  onChangeTimeframe: (tf: ExtendedTimeframe) => void;
  onOpenMore: () => void;
};

export default function TimeframeBar({ pinned, extendedTf, onChangeTimeframe, onOpenMore }: Props) {
  return (
    <View style={styles.timeframeBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeSwitcherScroll}>
        {pinned.map((tf) => (
          <Pressable key={tf} onPress={() => onChangeTimeframe(tf)} style={[styles.tfChip, extendedTf === tf && styles.tfChipActive]}>
            <Text style={[styles.tfChipText, extendedTf === tf && styles.tfChipTextActive]}>{tf}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onOpenMore} style={[styles.tfChip, styles.tfMoreChip]} hitSlop={10}>
          <Ionicons name="options" size={16} color="#fff" />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  timeframeBar: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0a0a0a",
  },
  rangeSwitcherScroll: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  tfChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "transparent",
    marginHorizontal: 4,
  },
  tfChipActive: { backgroundColor: "#00D4AA" },
  tfChipText: { color: "#e5e5e5", fontWeight: "600", fontSize: 12 },
  tfChipTextActive: { color: "#000" },
  tfMoreChip: { backgroundColor: "#1f2937" },
});


