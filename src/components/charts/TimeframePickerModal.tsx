import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTimeframeStore } from "../../store/timeframeStore";

export type ExtendedTimeframe =
  | "1m"
  | "2m"
  | "3m"
  | "4m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "4h"
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "2Y"
  | "5Y"
  | "ALL";

interface Props {
  visible: boolean;
  onClose: () => void;
  selected: ExtendedTimeframe;
  onSelect: (tf: ExtendedTimeframe) => void;
}

const groups: { title: string; items: ExtendedTimeframe[] }[] = [
  {
    title: "Minutes",
    items: ["1m", "2m", "3m", "4m", "5m", "10m", "15m", "30m", "45m"],
  },
  { title: "Hours", items: ["1h", "2h", "4h"] },
  {
    title: "Days",
    items: ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "ALL"],
  },
];

export default function TimeframePickerModal({
  visible,
  onClose,
  selected,
  onSelect,
}: Props) {
  const { pinned, toggle } = useTimeframeStore();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Timeframe</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#888" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {groups.map((g) => (
              <View key={g.title} style={styles.group}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                <View style={styles.grid}>
                  {g.items.map((tf) => {
                    const isSel = selected === tf;
                    const isPinned = pinned.includes(tf);
                    return (
                      <Pressable
                        key={tf}
                        onPress={() => {
                          // Tap toggles favorite; do not close modal
                          toggle(tf);
                        }}
                        style={[
                          styles.cell,
                          isSel && styles.cellSelected,
                          isPinned && styles.cellPinned,
                        ]}
                      >
                        <View style={styles.cellContent}>
                          <Text
                            style={[
                              styles.cellText,
                              isSel && styles.cellTextSelected,
                              isPinned && styles.cellTextPinned,
                            ]}
                          >
                            {tf}
                          </Text>
                          {/* favorited indicated via styles only */}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>
                Tap to add/remove favorites • Close with X or tap outside
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: { position: "absolute", inset: 0 },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    width: "88%",
    maxWidth: 420,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  closeButton: { padding: 4 },
  group: { marginVertical: 8 },
  groupTitle: { color: "#999", fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#111",
  },
  cellSelected: { backgroundColor: "#00D4AA", borderColor: "#00D4AA" },
  cellPinned: {
    borderColor: "#00D4AA",
    borderWidth: 2,
    backgroundColor: "#002921",
  },
  cellContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { color: "#ccc", fontWeight: "600" },
  cellTextSelected: { color: "#000" },
  cellTextPinned: { color: "#00D4AA" },
  instructions: { padding: 16, alignItems: "center" },
  instructionText: { color: "#888", fontSize: 12, textAlign: "center" },
});
