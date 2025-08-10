import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ChartType = "line" | "candlestick" | "area" | "bar";

interface ChartSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentChartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const chartTypes: { type: ChartType; label: string; icon: string }[] = [
  { type: "line", label: "Line Chart", icon: "trending-up" },
  { type: "candlestick", label: "Candlestick", icon: "bar-chart" },
  { type: "area", label: "Area Chart", icon: "analytics" },
  { type: "bar", label: "Bar Chart", icon: "stats-chart" },
];

export default function ChartSettingsModal({
  visible,
  onClose,
  currentChartType,
  onChartTypeChange,
}: ChartSettingsModalProps) {
  const handleSelect = (type: ChartType) => {
    onChartTypeChange(type);
    onClose();
  };

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
            <Text style={styles.title}>Chart Type</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#888" />
            </Pressable>
          </View>

          <View style={styles.options}>
            {chartTypes.map((chart) => (
              <Pressable
                key={chart.type}
                style={[
                  styles.option,
                  currentChartType === chart.type && styles.selectedOption,
                ]}
                onPress={() => handleSelect(chart.type)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={chart.icon as any}
                      size={20}
                      color={
                        currentChartType === chart.type ? "#00D4AA" : "#888"
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.optionLabel,
                      currentChartType === chart.type && styles.selectedLabel,
                    ]}
                  >
                    {chart.label}
                  </Text>
                  {currentChartType === chart.type && (
                    <Ionicons name="checkmark" size={20} color="#00D4AA" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    margin: 20,
    maxWidth: 300,
    width: "80%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  options: {
    padding: 8,
  },
  option: {
    borderRadius: 12,
    margin: 4,
  },
  selectedOption: {
    backgroundColor: "#2a2a2a",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: "#ccc",
  },
  selectedLabel: {
    color: "#fff",
    fontWeight: "500",
  },
});
