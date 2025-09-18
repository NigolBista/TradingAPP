import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriceAlert } from "../../store/alertStore";

interface AlertModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  onSave: (alert: Omit<PriceAlert, "id" | "createdAt">) => void;
  editingAlert?: PriceAlert | null;
}

const conditions = [
  { value: "above", label: "Above", icon: "trending-up" },
  { value: "below", label: "Below", icon: "trending-down" },
  { value: "crosses_above", label: "Crosses Above", icon: "arrow-up" },
  { value: "crosses_below", label: "Crosses Below", icon: "arrow-down" },
] as const;

export default function AlertModal({
  visible,
  onClose,
  symbol,
  currentPrice,
  onSave,
  editingAlert,
}: AlertModalProps) {
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<PriceAlert["condition"]>("above");
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [repeat, setRepeat] = useState<
    "unlimited" | "once_per_min" | "once_per_day"
  >("unlimited");

  useEffect(() => {
    if (editingAlert) {
      setPrice(editingAlert.price.toString());
      setCondition(editingAlert.condition);
      setMessage(editingAlert.message || "");
      setIsActive(editingAlert.isActive);
      setRepeat(editingAlert.repeat || "unlimited");
    } else {
      setPrice(currentPrice.toFixed(2));
      setCondition("above");
      setMessage("");
      setIsActive(true);
      setRepeat("unlimited");
    }
  }, [editingAlert, currentPrice, visible]);

  const handleSave = () => {
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price greater than 0");
      return;
    }

    if (editingAlert) {
      onSave({
        symbol,
        price: priceValue,
        condition,
        message: message.trim() || undefined,
        isActive,
        repeat,
      });
    } else {
      onSave({
        symbol,
        price: priceValue,
        condition,
        message: message.trim() || undefined,
        isActive,
        repeat,
      });
    }
    onClose();
  };

  const handleClose = () => {
    setPrice("");
    setMessage("");
    setCondition("above");
    setIsActive(true);
    onClose();
  };

  const getConditionDescription = (cond: PriceAlert["condition"]) => {
    switch (cond) {
      case "above":
        return "Alert when price goes above this level";
      case "below":
        return "Alert when price goes below this level";
      case "crosses_above":
        return "Alert when price crosses above this level";
      case "crosses_below":
        return "Alert when price crosses below this level";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {editingAlert ? "Edit Alert" : "Add Price Alert"}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#888" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Symbol */}
            <View style={styles.section}>
              <Text style={styles.label}>Symbol</Text>
              <View style={styles.symbolContainer}>
                <Text style={styles.symbolText}>{symbol}</Text>
                <Text style={styles.currentPriceText}>
                  Current: ${currentPrice.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Price Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Alert Price</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* Condition Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Condition</Text>
              <View style={styles.conditionGrid}>
                {conditions.map((cond) => (
                  <Pressable
                    key={cond.value}
                    onPress={() => setCondition(cond.value)}
                    style={[
                      styles.conditionButton,
                      condition === cond.value && styles.conditionButtonActive,
                    ]}
                  >
                    <Ionicons
                      name={cond.icon as any}
                      size={20}
                      color={condition === cond.value ? "#000" : "#fff"}
                    />
                    <Text
                      style={[
                        styles.conditionButtonText,
                        condition === cond.value &&
                          styles.conditionButtonTextActive,
                      ]}
                    >
                      {cond.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.conditionDescription}>
                {getConditionDescription(condition)}
              </Text>
            </View>

            {/* Message Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Message (Optional)</Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a custom message..."
                placeholderTextColor="#666"
                multiline
                maxLength={100}
              />
              <Text style={styles.characterCount}>{message.length}/100</Text>
            </View>

            {/* Repeat Frequency */}
            <View style={styles.section}>
              <Text style={styles.label}>Repeat</Text>
              <View style={styles.repeatRow}>
                {(
                  [
                    { key: "unlimited", label: "Unlimited" },
                    { key: "once_per_min", label: "Once / min" },
                    { key: "once_per_day", label: "Once / day" },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => setRepeat(opt.key)}
                    style={[
                      styles.repeatButton,
                      repeat === opt.key && styles.repeatButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.repeatButtonText,
                        repeat === opt.key && styles.repeatButtonTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Active Toggle */}
            <View style={styles.section}>
              <Pressable
                onPress={() => setIsActive(!isActive)}
                style={styles.toggleContainer}
              >
                <View style={[styles.toggle, isActive && styles.toggleActive]}>
                  <View
                    style={[
                      styles.toggleThumb,
                      isActive && styles.toggleThumbActive,
                    ]}
                  />
                </View>
                <Text style={styles.toggleLabel}>
                  {isActive ? "Alert Active" : "Alert Inactive"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={20} color="#000" />
              <Text style={styles.saveButtonText}>
                {editingAlert ? "Update Alert" : "Create Alert"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  symbolContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00D4AA",
  },
  currentPriceText: {
    fontSize: 14,
    color: "#888",
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    paddingVertical: 16,
  },
  conditionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  conditionButton: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    gap: 8,
  },
  conditionButtonActive: {
    backgroundColor: "#00D4AA",
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  conditionButtonTextActive: {
    color: "#000",
  },
  conditionDescription: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  messageInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggle: {
    width: 50,
    height: 30,
    backgroundColor: "#444",
    borderRadius: 15,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#00D4AA",
  },
  toggleThumb: {
    width: 26,
    height: 26,
    backgroundColor: "#fff",
    borderRadius: 13,
    alignSelf: "flex-start",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  toggleLabel: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  repeatRow: {
    flexDirection: "row",
    gap: 8,
  },
  repeatButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
  },
  repeatButtonActive: {
    backgroundColor: "#00D4AA",
  },
  repeatButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  repeatButtonTextActive: {
    color: "#000",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#00D4AA",
    gap: 8,
  },
  saveButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
});
