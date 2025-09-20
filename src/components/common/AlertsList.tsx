import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { PriceAlert, useAlertStore } from "../../store/alertStore";
import { useAuth } from "../../providers/AuthProvider";
import alertsService from "../../services/alertsService";
import AlertModal from "./AlertModal";

interface AlertsListProps {
  symbol: string;
  currentPrice: number;
}

export default function AlertsList({ symbol, currentPrice }: AlertsListProps) {
  const { addAlert, deleteAlert, toggleAlert, updateAlert } = useAlertStore();
  const allAlerts = useAlertStore((s) => s.alerts);
  const setAlerts = useAlertStore((s) => s.setAlerts);
  const { user } = useAuth();
  const alerts = React.useMemo(
    () => allAlerts.filter((a) => a.symbol === symbol),
    [allAlerts, symbol]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const swipeableRefs = useRef<{ [key: string]: any }>({});

  const handleAddAlert = async (
    alertData: Omit<PriceAlert, "id" | "createdAt" | "isActive">
  ) => {
    if (!user) return;

    // Check if alert with same price and condition already exists
    const existingAlert = alerts.find(
      (alert) =>
        alert.price === alertData.price &&
        alert.condition === alertData.condition
    );

    if (existingAlert) {
      Alert.alert(
        "Duplicate Alert",
        `You already have a ${getConditionText(
          alertData.condition
        ).toLowerCase()} alert for $${alertData.price.toFixed(2)}`,
        [{ text: "OK" }]
      );
      return;
    }

    try {
      await alertsService.createAlert(user.id, {
        ...alertData,
        isActive: true,
      });
    } catch (e) {
      // fallback local if server fails
      addAlert(alertData);
    }
    setShowAddModal(false);
  };

  const handleEditAlert = (alert: PriceAlert) => {
    setEditingAlert(alert);
  };

  const handleUpdateAlert = async (
    alertData: Omit<PriceAlert, "id" | "createdAt" | "isActive">
  ) => {
    if (!user || !editingAlert) return;

    // Check if alert with same price and condition already exists (excluding current alert)
    const existingAlert = alerts.find(
      (alert) =>
        alert.id !== editingAlert.id &&
        alert.price === alertData.price &&
        alert.condition === alertData.condition
    );

    if (existingAlert) {
      Alert.alert(
        "Duplicate Alert",
        `You already have a ${getConditionText(
          alertData.condition
        ).toLowerCase()} alert for $${alertData.price.toFixed(2)}`,
        [{ text: "OK" }]
      );
      return;
    }

    try {
      await alertsService.updateAlert(user.id, editingAlert.id, alertData);
    } catch (e) {
      updateAlert(editingAlert.id, alertData);
    }
    setEditingAlert(null);
  };

  const handleDeleteAlert = (alert: PriceAlert) => {
    Alert.alert(
      "Delete Alert",
      `Are you sure you want to delete this alert for ${alert.price}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (user) {
              try {
                await alertsService.deleteAlert(user.id, alert.id);
              } finally {
                // Optimistically update local store regardless of server outcome
                deleteAlert(alert.id);
              }
            } else {
              deleteAlert(alert.id);
            }
          },
        },
      ]
    );
  };

  const handleToggleAlert = async (alert: PriceAlert) => {
    toggleAlert(alert.id);
    if (!user) return;
    try {
      await alertsService.updateAlert(user.id, alert.id, {
        symbol: alert.symbol,
        price: alert.price,
        condition: alert.condition,
        message: alert.message,
        isActive: !alert.isActive,
        repeat: alert.repeat,
      } as any);
    } catch (e) {
      // noop, local toggle already applied
    }
  };

  const getConditionIcon = (condition: PriceAlert["condition"]) => {
    switch (condition) {
      case "above":
        return "trending-up";
      case "below":
        return "trending-down";
      case "crosses_above":
        return "arrow-up";
      case "crosses_below":
        return "arrow-down";
    }
  };

  const getConditionColor = (condition: PriceAlert["condition"]) => {
    switch (condition) {
      case "above":
      case "crosses_above":
        return "#10B981";
      case "below":
      case "crosses_below":
        return "#EF4444";
    }
  };

  const getConditionText = (condition: PriceAlert["condition"]) => {
    switch (condition) {
      case "above":
        return "Above";
      case "below":
        return "Below";
      case "crosses_above":
        return "Crosses Above";
      case "crosses_below":
        return "Crosses Below";
    }
  };

  const isAlertTriggered = (alert: PriceAlert) => {
    if (!alert.isActive) return false;

    switch (alert.condition) {
      case "above":
        return currentPrice > alert.price;
      case "below":
        return currentPrice < alert.price;
      case "crosses_above":
        return (
          alert.lastPrice !== undefined &&
          alert.lastPrice <= alert.price &&
          currentPrice > alert.price
        );
      case "crosses_below":
        return (
          alert.lastPrice !== undefined &&
          alert.lastPrice >= alert.price &&
          currentPrice < alert.price
        );
      default:
        return false;
    }
  };

  const renderRightActions = (alert: PriceAlert) => (
    <View style={styles.rightActionsContainer}>
      <Pressable
        style={styles.deleteAction}
        onPress={() => handleDeleteAlert(alert)}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No Alerts Set</Text>
            <Text style={styles.emptyDescription}>
              Create price alerts to get notified when {symbol} reaches your
              target levels
            </Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {alerts.map((alert) => {
              const getSwipeableRef = (id: string) => {
                if (!swipeableRefs.current[id]) {
                  swipeableRefs.current[id] = React.createRef();
                }
                return swipeableRefs.current[id];
              };

              return (
                <Swipeable
                  key={alert.id}
                  ref={getSwipeableRef(alert.id)}
                  renderRightActions={() => renderRightActions(alert)}
                  rightThreshold={40}
                >
                  <View style={styles.alertItem}>
                    <View style={styles.alertContent}>
                      <View style={styles.alertInfo}>
                        <Text style={styles.alertType}>
                          Price{" "}
                          {getConditionText(alert.condition).toLowerCase()}
                        </Text>
                        <Text style={styles.alertPrice}>
                          ${alert.price.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.alertActions}>
                        <Pressable
                          onPress={() => handleEditAlert(alert)}
                          style={styles.editButton}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={16}
                            color="#888"
                          />
                        </Pressable>
                        <Switch
                          value={alert.isActive}
                          onValueChange={() => handleToggleAlert(alert)}
                          trackColor={{ false: "#767577", true: "#007AFF" }}
                          thumbColor={alert.isActive ? "#fff" : "#f4f3f4"}
                        />
                      </View>
                    </View>
                  </View>
                </Swipeable>
              );
            })}
          </View>
        )}

        {/* Add Alert Button */}
        <View style={styles.addAlertContainer}>
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={styles.addAlertButton}
          >
            <Ionicons name="add" size={20} color="#007AFF" />
            <Text style={styles.addAlertText}>Add Alert</Text>
          </Pressable>
        </View>

        {/* Add Alert Modal */}
        <AlertModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          symbol={symbol}
          currentPrice={currentPrice}
          onSave={handleAddAlert}
        />

        {/* Edit Alert Modal */}
        <AlertModal
          visible={editingAlert !== null}
          onClose={() => setEditingAlert(null)}
          symbol={symbol}
          currentPrice={currentPrice}
          onSave={handleUpdateAlert}
          editingAlert={editingAlert}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  alertsList: {
    paddingHorizontal: 0,
  },
  alertItem: {
    backgroundColor: "#1a1a1a",
    marginBottom: 1,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  alertInfo: {
    flex: 1,
  },
  alertType: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 4,
  },
  alertPrice: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  alertActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  editButton: {
    padding: 4,
  },
  rightActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  deleteAction: {
    width: 80,
    height: "100%",
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  addAlertContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  addAlertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  addAlertText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
  },
});
