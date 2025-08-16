import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";

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
  const [custom, setCustom] = React.useState<ExtendedTimeframe | null>(null);
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
          <Text style={styles.title}>Select Timeframe</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {groups.map((g) => (
              <View key={g.title} style={styles.group}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                <View style={styles.grid}>
                  {g.items.map((tf) => {
                    const isSel = selected === tf;
                    return (
                      <Pressable
                        key={tf}
                        onPress={() => {
                          onSelect(tf);
                          onClose();
                        }}
                        style={[styles.cell, isSel && styles.cellSelected]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            isSel && styles.cellTextSelected,
                          ]}
                        >
                          {tf}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Custom add/remove row */}
            <View style={[styles.group, { marginTop: 4 }]}>
              <Text style={styles.groupTitle}>Customize</Text>
              <View style={styles.grid}>
                {(
                  [
                    "2m",
                    "3m",
                    "4m",
                    "10m",
                    "45m",
                    "2h",
                    "4h",
                  ] as ExtendedTimeframe[]
                ).map((tf) => (
                  <Pressable
                    key={`custom-${tf}`}
                    onPress={() => {
                      setCustom(tf);
                      onSelect(tf);
                      onClose();
                    }}
                    style={[styles.cell]}
                  >
                    <Text style={styles.cellText}>Add {tf}</Text>
                  </Pressable>
                ))}
              </View>
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
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
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
  cellText: { color: "#ccc", fontWeight: "600" },
  cellTextSelected: { color: "#000" },
});
