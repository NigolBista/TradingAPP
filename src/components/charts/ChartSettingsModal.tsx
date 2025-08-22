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
  showExtendedHours?: boolean;
  onExtendedHoursChange?: (enabled: boolean) => void;
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
  showExtendedHours = true,
  onExtendedHoursChange,
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

          {/* Extended Hours Toggle */}
          {onExtendedHoursChange && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trading Sessions</Text>
                <Pressable
                  style={styles.option}
                  onPress={() => onExtendedHoursChange(!showExtendedHours)}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={showExtendedHours ? "#00D4AA" : "#888"}
                      />
                    </View>
                    <View style={styles.toggleContent}>
                      <Text
                        style={[
                          styles.optionLabel,
                          showExtendedHours && styles.selectedLabel,
                        ]}
                      >
                        Show Extended Hours
                      </Text>
                      <Text style={styles.optionSubtitle}>
                        Include pre-market (4:00-9:30 ET) and after-hours
                        (16:00-20:00 ET) data
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.toggle,
                        showExtendedHours && styles.toggleActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          showExtendedHours && styles.toggleThumbActive,
                        ]}
                      />
                    </View>
                  </View>
                </Pressable>
              </View>
            </>
          )}
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
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 20,
    marginVertical: 8,
  },
  section: {
    padding: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
    marginLeft: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleContent: {
    flex: 1,
  },
  optionSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#333",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#00D4AA",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    transform: [{ translateX: 0 }],
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});
