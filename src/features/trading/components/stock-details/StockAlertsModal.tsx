import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AlertsList from "../../../../shared/components/common/AlertsList";

export interface StockAlertsModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
}

export function StockAlertsModal({
  visible,
  onClose,
  symbol,
  currentPrice,
}: StockAlertsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.alertsModalContainer}>
          <View style={styles.alertsModalHeader}>
            <Text style={styles.alertsModalTitle}>Price Alerts</Text>
            <Pressable onPress={onClose} style={styles.alertsModalCloseButton}>
              <Ionicons name="close" size={24} color="#888" />
            </Pressable>
          </View>
          <AlertsList symbol={symbol} currentPrice={currentPrice} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  alertsModalContainer: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "90%",
    flex: 1,
  },
  alertsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  alertsModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  alertsModalCloseButton: {
    padding: 4,
  },
});

export default StockAlertsModal;

