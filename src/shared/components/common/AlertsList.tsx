import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriceAlert, useAlertStore } from "../../../store/alertStore";
import { useAuth } from "../../../providers/AuthProvider";
import alertsService from "../../shared/services/alertsService";
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

  const handleAddAlert = async (
    alertData: Omit<PriceAlert, "id" | "createdAt" | "isActive">
  ) => {
    if (!user) return;
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Price Alerts</Text>
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Alert</Text>
        </Pressable>
      </View>

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
            const isTriggered = isAlertTriggered(alert);
            const conditionColor = getConditionColor(alert.condition);

            return (
              <View
                key={alert.id}
                style={[
                  styles.alertCard,
                  !alert.isActive && styles.alertCardInactive,
                  isTriggered && styles.alertCardTriggered,
                ]}
              >
                {/* Alert Header */}
                <View style={styles.alertHeader}>
                  <View style={styles.alertInfo}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.alertPrice}>
                        ${alert.price.toFixed(2)}
                      </Text>
                      <View
                        style={[
                          styles.conditionBadge,
                          { backgroundColor: `${conditionColor}20` },
                        ]}
                      >
                        <Ionicons
                          name={getConditionIcon(alert.condition) as any}
                          size={12}
                          color={conditionColor}
                        />
                        <Text
                          style={[
                            styles.conditionText,
                            { color: conditionColor },
                          ]}
                        >
                          {getConditionText(alert.condition)}
                        </Text>
                      </View>
                    </View>
                    {alert.message && (
                      <Text style={styles.alertMessage}>{alert.message}</Text>
                    )}
                  </View>

                  <View style={styles.alertActions}>
                    <Pressable
                      onPress={() => handleToggleAlert(alert)}
                      style={[
                        styles.toggleButton,
                        alert.isActive && styles.toggleButtonActive,
                      ]}
                    >
                      <Ionicons
                        name={alert.isActive ? "pause" : "play"}
                        size={16}
                        color={alert.isActive ? "#000" : "#666"}
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => handleEditAlert(alert)}
                      style={styles.actionButton}
                    >
                      <Ionicons name="create-outline" size={16} color="#888" />
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteAlert(alert)}
                      style={styles.actionButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#EF4444"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Alert Status */}
                <View style={styles.alertStatus}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isTriggered
                            ? "#10B981"
                            : alert.isActive
                            ? "#00D4AA"
                            : "#666",
                        },
                      ]}
                    >
                      {isTriggered
                        ? "Triggered"
                        : alert.isActive
                        ? "Active"
                        : "Inactive"}
                    </Text>
                  </View>

                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Created:</Text>
                    <Text style={styles.statusText}>
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  {alert.triggeredAt && (
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Triggered:</Text>
                      <Text style={styles.statusText}>
                        {new Date(alert.triggeredAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Current Price vs Alert Price */}
                <View style={styles.priceComparison}>
                  <Text style={styles.comparisonLabel}>
                    Current: ${currentPrice.toFixed(2)}
                  </Text>
                  <View style={styles.priceDifference}>
                    <Text
                      style={[
                        styles.differenceText,
                        {
                          color:
                            currentPrice >= alert.price ? "#10B981" : "#EF4444",
                        },
                      ]}
                    >
                      {currentPrice >= alert.price ? "+" : ""}
                      {(
                        ((currentPrice - alert.price) / alert.price) *
                        100
                      ).toFixed(1)}
                      %
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00D4AA",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
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
    padding: 16,
  },
  alertCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  alertCardInactive: {
    opacity: 0.6,
  },
  alertCardTriggered: {
    borderColor: "#10B981",
    backgroundColor: "#10B98110",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  alertInfo: {
    flex: 1,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  alertPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  conditionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  alertMessage: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
  alertActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  toggleButtonActive: {
    backgroundColor: "#00D4AA",
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  alertStatus: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: "#888",
  },
  statusText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  priceComparison: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  comparisonLabel: {
    fontSize: 14,
    color: "#ccc",
    fontWeight: "500",
  },
  priceDifference: {
    alignItems: "flex-end",
  },
  differenceText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
